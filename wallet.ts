import { createWeb3Modal, defaultConfig } from '@web3modal/ethers/react';

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;
if (!projectId) {
  throw new Error('Missing VITE_WALLETCONNECT_PROJECT_ID environment variable');
}

const defaultChainId = Number(import.meta.env.VITE_DEFAULT_CHAIN_ID || 1);

const chains = [
  {
    chainId: defaultChainId,
    name: defaultChainId === 11155111 ? 'Sepolia' : 'Ethereum',
    currency: 'ETH',
    explorerUrl: defaultChainId === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io',
    rpcUrl: `https://rpc.walletconnect.com/v1/?chainId=eip155:${defaultChainId}&projectId=${projectId}`,
  },
];

const metadata = {
  name: 'AIRTrack',
  description: 'AIRTrack admin dashboard',
  url: window.location.origin,
  icons: ['https://walletconnect.com/_next/static/media/walletconnect-logo.42e07c6c.svg'],
};

createWeb3Modal({
  ethersConfig: defaultConfig({
    metadata,
    defaultChainId,
    enableEIP6963: true,
    enableInjected: true,
    enableCoinbase: true,
    rpcUrl: chains[0].rpcUrl,
  }),
  chains,
  projectId,
  enableAnalytics: false,
});
