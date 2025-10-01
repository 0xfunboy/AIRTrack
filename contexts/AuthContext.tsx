import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { BrowserProvider } from 'ethers';
import {
  requestAuthChallenge,
  verifyAuth,
  setAuthToken,
} from '../services/api';

interface User {
  address: string;
  isAdmin: boolean;
}

type EnvConfig = Record<string, string>;

type WalletProvider = {
  request: (...args: any[]) => Promise<any>;
};

interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  token: string | null;
  loginWithWallet: (params: {
    address: string;
    chainId: number;
    walletProvider: WalletProvider;
  }) => Promise<boolean>;
  logout: () => void;
  envConfig: EnvConfig;
  setEnvConfig: (newConfig: EnvConfig) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children?: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [envConfig, setEnvConfig] = useState<EnvConfig>({});

  const loginWithWallet = useCallback(
    async ({ address, chainId, walletProvider }: { address: string; chainId: number; walletProvider: WalletProvider; }) => {
      try {
        const normalizedAddress = address.toLowerCase();
        const challenge = await requestAuthChallenge(normalizedAddress, chainId);
        const provider = new BrowserProvider(walletProvider as any);
        const signer = await provider.getSigner();
        const signature = await signer.signMessage(challenge.message);
        const result = await verifyAuth(challenge.message, signature);

        const user: User = {
          address: result.user.address,
          isAdmin: result.user.isAdmin,
        };

        setCurrentUser(user);
        setTokenState(result.token);
        setAuthToken(result.token);
        return true;
      } catch (err) {
        console.error('Wallet authentication failed:', err);
        throw err;
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setCurrentUser(null);
    setTokenState(null);
    setAuthToken(null);
  }, []);

  const handleSetEnvConfig = useCallback((newConfig: EnvConfig) => {
    setEnvConfig(newConfig);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isAdmin: !!currentUser?.isAdmin,
      token,
      loginWithWallet,
      logout,
      envConfig,
      setEnvConfig: handleSetEnvConfig,
    }),
    [currentUser, token, loginWithWallet, logout, envConfig, handleSetEnvConfig]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
