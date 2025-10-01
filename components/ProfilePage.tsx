import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import DangerZone from './DangerZone';

interface ProfilePageProps {
  onBack: () => void;
}

// FIX: Make children optional to satisfy the type-checker which fails to recognize JSX children.
const ConfigSection = ({ title, children }: { title: string, children?: React.ReactNode }) => (
    <details className="bg-black/20 p-4 rounded-lg border border-white/10" open>
        <summary className="font-semibold text-lg cursor-pointer text-gray-200">{title}</summary>
        <div className="mt-4 space-y-4">
            {children}
        </div>
    </details>
);

function ProfilePage({ onBack }: ProfilePageProps) {
  const { envConfig, setEnvConfig, isAdmin } = useAuth();
  const [localConfig, setLocalConfig] = useState(envConfig);

  const handleInputChange = (key: string, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEnvConfig(localConfig);
  };
  
  const renderInput = (key: string) => (
    <div key={key}>
      <label
        htmlFor={key}
        className="block text-sm font-medium text-gray-400"
      >
        {key}
      </label>
      <div className="mt-1">
        <input
          id={key}
          name={key}
          type="text"
          value={localConfig[key] || ''}
          onChange={(e) => handleInputChange(key, e.target.value)}
          className="block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white placeholder-gray-500 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
        />
      </div>
    </div>
  );

  const appKeys = Object.keys(localConfig).filter(k => !k.includes('API_KEY') && !k.startsWith('VITE_X_'));
  const xKeys = Object.keys(localConfig).filter(k => k.startsWith('VITE_X_'));
  const apiKeys = Object.keys(localConfig).filter(k => k.includes('API_KEY'));

  return (
    <div className="max-w-4xl mx-auto bg-black/30 backdrop-blur-sm border border-white/10 p-8 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">
          Admin Profile & Configuration
        </h2>
        <button
          onClick={onBack}
          className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          &larr; Back to Dashboard
        </button>
      </div>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
        <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <ConfigSection title="Application Settings">
                {appKeys.map(renderInput)}
              </ConfigSection>
              <ConfigSection title="X (Twitter) Ingestion">
                {xKeys.map(renderInput)}
              </ConfigSection>
              <ConfigSection title="Data Provider API Keys">
                {apiKeys.map(renderInput)}
              </ConfigSection>
            </div>
            <div className="mt-8 border-t border-white/10 pt-6">
              <button
                type="submit"
                className="w-full sm:w-auto rounded-md border border-transparent bg-red-500 py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
              >
                Save Configuration
              </button>
            </div>
        </form>
      </div>

      {isAdmin && (
        <div className="mt-10">
          <DangerZone />
        </div>
      )}
    </div>
  );
}

export default ProfilePage;
