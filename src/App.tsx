import React, { useState, useMemo } from 'react';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import ProfilePage from './components/ProfilePage';
import ApiInstructionsPage from './components/ApiInstructionsPage';
import AddTradeForm from './components/AddTradeForm';
import { useAuth } from './contexts/AuthContext';
import { useWeb3Modal, useDisconnect, useWeb3ModalAccount } from '@web3modal/ethers/react';

type Page = 'dashboard' | 'login' | 'profile' | 'api_docs';

function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [showAddTrade, setShowAddTrade] = useState(false);
  const { currentUser, logout, isAdmin } = useAuth();
  const { open } = useWeb3Modal();
  const { disconnect } = useDisconnect();
  const { address, isConnected } = useWeb3ModalAccount();

  const displayAddress = useMemo(() => {
    const addr = currentUser?.address || address;
    if (!addr) return null;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }, [currentUser, address]);

  const handleLogout = async () => {
    await disconnect().catch(() => undefined);
    logout();
    setShowAddTrade(false);
    setPage('dashboard');
  };

  const renderPage = () => {
    switch (page) {
      case 'login':
        return <LoginPage onLoginSuccess={() => setPage('dashboard')} />;
      case 'profile':
        if (!currentUser) {
          setPage('login');
          return <LoginPage onLoginSuccess={() => setPage('dashboard')} />;
        }
        return <ProfilePage onBack={() => setPage('dashboard')} />;
      case 'api_docs':
        if (!currentUser) {
            setPage('login');
            return <LoginPage onLoginSuccess={() => setPage('dashboard')} />;
        }
        return <ApiInstructionsPage onBack={() => setPage('dashboard')} />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-gray-200 font-sans">
      {/* Top bar */}
      <header className="bg-black/30 backdrop-blur-sm sticky top-0 z-50 border-b border-white/10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <h1 className="text-2xl font-bold tracking-tight text-white cursor-pointer" onClick={() => setPage('dashboard')}>
              <span className="bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">
                AIR3
              </span>
              <span className="text-gray-300">Track</span>
            </h1>
            <div className="flex items-center gap-4">
              {currentUser ? (
                <>
                  {isAdmin && (
                    <button
                      onClick={() => setShowAddTrade(true)}
                      className="text-sm font-medium bg-red-500/80 hover:bg-red-500 text-white py-1 px-3 rounded-md transition-colors"
                    >
                      Add New Trade
                    </button>
                  )}
                  <button
                    onClick={() => setPage('api_docs')}
                    className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    API Docs
                  </button>
                  <button
                    onClick={() => setPage('profile')}
                    className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
                  >
                    Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="text-sm font-medium bg-red-600/50 hover:bg-red-600/80 text-white py-1 px-3 rounded-md transition-colors"
                  >
                    Disconnect
                  </button>
                  {displayAddress && (
                    <span className="text-xs text-gray-400 hidden sm:inline-block">
                      {displayAddress}
                    </span>
                  )}
                </>
              ) : (
                <button
                  onClick={() => {
                    setPage('login');
                    open();
                  }}
                  className="text-sm font-medium bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded-md transition-colors"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {renderPage()}
        </div>
      </main>

      {showAddTrade && (
        <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="max-w-3xl w-[95%] md:w-3/4 lg:w-2/3">
            <AddTradeForm
              onTradeAdded={() => setShowAddTrade(false)}
              onCancel={() => setShowAddTrade(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
