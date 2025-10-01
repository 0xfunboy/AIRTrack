import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import DangerZone from './DangerZone';

interface ProfilePageProps {
  onBack: () => void;
}

const ConfigSection = ({ title, children }: { title: string; children?: React.ReactNode }) => (
  <details className="bg-black/20 p-4 rounded-lg border border-white/10" open>
    <summary className="font-semibold text-lg cursor-pointer text-gray-200">{title}</summary>
    <div className="mt-4 space-y-4">{children}</div>
  </details>
);

const API_SECRET_REGEX = /^[A-Za-z0-9]{1,16}$/;
const DEFAULT_TIMEFRAME = '1h';
const TIMEFRAME_OPTIONS = [
  { value: '1m', label: '1m' },
  { value: '5m', label: '5m' },
  { value: '15m', label: '15m' },
  { value: '30m', label: '30m' },
  { value: '1h', label: '1h' },
  { value: '4h', label: '4h' },
];

function ProfilePage({ onBack }: ProfilePageProps) {
  const { envConfig, setEnvConfig, isAdmin } = useAuth();
  const { showToast } = useToast();

  const mergedConfig = useMemo(() => {
    const next: Record<string, string> = { ...envConfig };
    if (!next.VITE_DEFAULT_TIMEFRAME) next.VITE_DEFAULT_TIMEFRAME = DEFAULT_TIMEFRAME;
    if (next.VITE_API_SECRET_TOKEN === undefined) next.VITE_API_SECRET_TOKEN = '';
    if (next.VITE_TWEET_SOURCE === undefined) next.VITE_TWEET_SOURCE = '';
    return next;
  }, [envConfig]);

  const [localConfig, setLocalConfig] = useState(mergedConfig);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    setLocalConfig(mergedConfig);
  }, [mergedConfig]);

  const handleInputChange = (key: string, value: string) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const rawSecret = (localConfig.VITE_API_SECRET_TOKEN || '').trim();
    if (rawSecret && !API_SECRET_REGEX.test(rawSecret)) {
      setFormError('API secret must be alphanumeric (max 16 characters, no symbols).');
      return;
    }

    const rawTimeframe = (localConfig.VITE_DEFAULT_TIMEFRAME || '').toLowerCase();
    const validTimeframe = TIMEFRAME_OPTIONS.some(opt => opt.value === rawTimeframe) ? rawTimeframe : DEFAULT_TIMEFRAME;

    const sanitizedConfig = {
      ...localConfig,
      VITE_API_SECRET_TOKEN: rawSecret,
      VITE_DEFAULT_TIMEFRAME: validTimeframe,
      VITE_TWEET_SOURCE: (localConfig.VITE_TWEET_SOURCE || '').trim(),
    };

    setEnvConfig(sanitizedConfig);
    showToast('Configuration saved.', { variant: 'success' });
  };

  const renderInput = (key: string) => (
    <div key={key}>
      <label htmlFor={key} className="block text-sm font-medium text-gray-400">
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

  const excludedKeys = new Set(['VITE_DEFAULT_TIMEFRAME', 'VITE_API_SECRET_TOKEN', 'VITE_TWEET_SOURCE']);
  const allKeys = Object.keys(localConfig).filter((key) => typeof localConfig[key] === 'string');
  const appKeys = allKeys.filter(k => !excludedKeys.has(k) && !k.includes('API_KEY') && !k.startsWith('VITE_X_'));
  const xKeys = allKeys.filter(k => !excludedKeys.has(k) && k.startsWith('VITE_X_'));
  const apiKeys = allKeys.filter(k => !excludedKeys.has(k) && k.includes('API_KEY'));

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
            <ConfigSection title="Chart Preferences">
              <div>
                <label htmlFor="VITE_DEFAULT_TIMEFRAME" className="block text-sm font-medium text-gray-400">
                  Default candle timeframe
                </label>
                <select
                  id="VITE_DEFAULT_TIMEFRAME"
                  name="VITE_DEFAULT_TIMEFRAME"
                  value={localConfig.VITE_DEFAULT_TIMEFRAME || DEFAULT_TIMEFRAME}
                  onChange={(e) => handleInputChange('VITE_DEFAULT_TIMEFRAME', e.target.value)}
                  className="mt-1 block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
                >
                  {TIMEFRAME_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-500">
                  The dashboard candlestick chart will reload using this timeframe.
                </p>
              </div>
            </ConfigSection>

            <ConfigSection title="API Access">
              <div>
                <label htmlFor="VITE_API_SECRET_TOKEN" className="block text-sm font-medium text-gray-400">
                  API secret token
                </label>
                <input
                  id="VITE_API_SECRET_TOKEN"
                  name="VITE_API_SECRET_TOKEN"
                  type="text"
                  value={localConfig.VITE_API_SECRET_TOKEN || ''}
                  onChange={(e) => handleInputChange('VITE_API_SECRET_TOKEN', e.target.value.replace(/\s+/g, ''))}
                  maxLength={16}
                  pattern="[A-Za-z0-9]*"
                  className="mt-1 block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white placeholder-gray-500 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
                  placeholder="16-char alphanumeric"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Used by the API instructions page. Letters and numbers only, up to 16 characters.
                </p>
              </div>
            </ConfigSection>

            <ConfigSection title="Tweet Source Filter">
              <div>
                <label htmlFor="VITE_TWEET_SOURCE" className="block text-sm font-medium text-gray-400">
                  Allowed X (Twitter) username
                </label>
                <input
                  id="VITE_TWEET_SOURCE"
                  name="VITE_TWEET_SOURCE"
                  type="text"
                  value={localConfig.VITE_TWEET_SOURCE || ''}
                  onChange={(e) => handleInputChange('VITE_TWEET_SOURCE', e.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
                  className="mt-1 block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white placeholder-gray-500 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
                  placeholder="AIRewardrop"
                />
                <p className="mt-2 text-xs text-gray-500">
                  When set, new trades only accept post URLs from this account (case-insensitive).
                </p>
              </div>
            </ConfigSection>

            {(appKeys.length > 0 || xKeys.length > 0 || apiKeys.length > 0) && (
              <ConfigSection title="Advanced Overrides">
                {appKeys.map(renderInput)}
                {xKeys.map(renderInput)}
                {apiKeys.map(renderInput)}
              </ConfigSection>
            )}
          </div>

          {formError && (
            <p className="mt-6 text-sm text-red-300">{formError}</p>
          )}

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
