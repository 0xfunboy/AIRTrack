import React, { useEffect, useState } from 'react';
import {
  useWeb3Modal,
  useWeb3ModalAccount,
  useWeb3ModalProvider,
  useDisconnect,
} from '@web3modal/ethers/react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();
  const { address, chainId, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const { loginWithWallet, currentUser, logout } = useAuth();
  const { showToast } = useToast();
  const [isAuthenticating, setAuthenticating] = useState(false);

  useEffect(() => {
    const authenticate = async () => {
      if (!isConnected || !address || !walletProvider || chainId == null) {
        return;
      }
      setAuthenticating(true);
     try {
        await loginWithWallet({ address, chainId, walletProvider });
        onLoginSuccess();
        showToast('Wallet connected successfully.', { variant: 'success' });
      } catch (err: any) {
        console.error(err);
        showToast(err?.message || 'Wallet authentication failed.', { variant: 'error' });
        await disconnect().catch(() => undefined);
        logout();
      } finally {
        setAuthenticating(false);
      }
    };

    authenticate();
  }, [isConnected, address, walletProvider, chainId, loginWithWallet, onLoginSuccess, showToast, disconnect]);

  const handleDisconnect = async () => {
    await disconnect().catch(() => undefined);
    logout();
  };

  return (
    <div className="flex items-center justify-center py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="bg-black/30 backdrop-blur-sm border border-white/10 p-8 rounded-lg shadow-lg text-center space-y-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">
            Connect your wallet
          </h2>
          <p className="text-sm text-gray-300">
            Use WalletConnect to authenticate and unlock AIRTrack admin features.
          </p>

          {currentUser ? (
            <div className="space-y-4">
              <div className="text-xs text-gray-400 break-all">
                Connected as {currentUser.address}
              </div>
              <button
                onClick={handleDisconnect}
                className="w-full rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => open()}
              disabled={isAuthenticating}
              className="w-full rounded-md border border-transparent bg-red-500 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              {isAuthenticating ? 'Awaiting signature…' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
