import React, { useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { TradeSide, TradeStatus } from '../types';
import { addTrade, fetchCurrentPrice } from '../services/api';
import { emitTradesRefresh } from '../utils/events';

interface AddTradeFormProps {
  onTradeAdded: () => void;
  onCancel?: () => void;
}

interface FormState {
  symbol: string;
  side: TradeSide;
  entry_price: string;
  tp_price: string;
  sl_price: string;
  quantity: string;
  post_url: string;
  opened_at: string;
  status: TradeStatus;
}

const formatLocalDateTime = (date: Date): string => {
  const pad = (value: number) => value.toString().padStart(2, '0');
  return [
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  ].join('T');
};

const createInitialState = (): FormState => ({
  symbol: '',
  side: TradeSide.LONG,
  entry_price: '',
  tp_price: '',
  sl_price: '',
  quantity: '',
  post_url: '',
  opened_at: formatLocalDateTime(new Date()),
  status: TradeStatus.PENDING,
});

const InputField = ({
  id,
  label,
  type = 'text',
  value,
  onChange,
  required = true,
  step,
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  step?: string;
  placeholder?: string;
}) => (
  <div>
    <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
    <input
      id={id}
      name={id}
      type={type}
      required={required}
      value={value}
      onChange={onChange}
      step={step}
      placeholder={placeholder}
      className="block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white placeholder-gray-500 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
    />
  </div>
);

function AddTradeForm({ onTradeAdded, onCancel }: AddTradeFormProps) {
  const { token, envConfig } = useAuth();
  const { showToast } = useToast();
  const [formData, setFormData] = useState<FormState>(() => createInitialState());
  const [isSubmitting, setSubmitting] = useState(false);
  const [isCheckingPrice, setCheckingPrice] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

  const tweetSource = useMemo(() => (envConfig.VITE_TWEET_SOURCE || '').trim().toLowerCase(), [envConfig]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value as TradeStatus;
    setFormData(prev => ({ ...prev, status: value }));
  };

  const cleanSymbol = (raw: string) => raw.toUpperCase().trim().split(/[\/-]/)[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      showToast('Please log in as an admin to add trades.', { variant: 'error' });
      return;
    }

    setSubmitting(true);
    try {
      const requiredFields: (keyof FormState)[] = ['symbol', 'entry_price', 'tp_price', 'sl_price'];
      for (const field of requiredFields) {
        if (!formData[field]) {
          throw new Error(`Field "${field.replace('_', ' ')}" is required.`);
        }
      }

      if (formData.status === TradeStatus.OPEN && !formData.opened_at) {
        throw new Error('Opened At is required for open trades.');
      }

      const postUrl = formData.post_url.trim();
      if (tweetSource && postUrl) {
        try {
          const parsed = new URL(postUrl);
          const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
          if (!['x.com', 'twitter.com'].includes(host)) {
            throw new Error();
          }
          const [username] = parsed.pathname.split('/').filter(Boolean);
          if (!username || username.toLowerCase() !== tweetSource) {
            throw new Error();
          }
        } catch {
          throw new Error(`Post URL must reference https://x.com/${tweetSource}`);
        }
      }

      const payload = {
        symbol: cleanSymbol(formData.symbol),
        side: formData.side,
        entry_price: parseFloat(formData.entry_price),
        tp_price: parseFloat(formData.tp_price),
        sl_price: parseFloat(formData.sl_price),
        quantity: formData.quantity ? parseFloat(formData.quantity) : undefined,
        post_url: postUrl || undefined,
        opened_at: formData.opened_at || undefined,
        status: formData.status,
      };

      await addTrade(payload, token);
      emitTradesRefresh();
      showToast('Trade successfully added.', { variant: 'success' });
      setFormData(createInitialState());
      onTradeAdded();
      onCancel?.();
    } catch (err: any) {
      showToast(err?.message || 'Failed to submit trade.', { variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckPrice = async () => {
    setPriceError(null);
    const trimmed = cleanSymbol(formData.symbol);
    if (!trimmed) {
      setPriceError('Enter a ticker first.');
      return;
    }

    try {
      setCheckingPrice(true);
      const price = await fetchCurrentPrice(trimmed);
      setFormData(prev => ({ ...prev, entry_price: price.toString() }));
      showToast(`Entry price updated with latest ${trimmed} quote.`, { variant: 'info' });
    } catch (err: any) {
      setPriceError(err?.message || 'Unable to fetch price.');
    } finally {
      setCheckingPrice(false);
    }
  };

  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 p-6 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">
          Manually Add Trade
        </h3>
        {onCancel && (
          <button
            onClick={onCancel}
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="symbol">
            Ticker (e.g., BTC)
          </label>
          <div className="flex gap-2">
            <input
              id="symbol"
              name="symbol"
              type="text"
              value={formData.symbol}
              onChange={handleChange}
              required
              className="flex-1 rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white placeholder-gray-500 shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
            />
            <button
              type="button"
              onClick={handleCheckPrice}
              disabled={isCheckingPrice}
              className="px-3 py-2 text-sm font-medium rounded-md border border-red-500/70 text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {isCheckingPrice ? 'Checking…' : 'Check'}
            </button>
          </div>
          {priceError && <p className="mt-2 text-xs text-red-300">{priceError}</p>}
        </div>

        <div>
          <label htmlFor="side" className="block text-sm font-medium text-gray-300 mb-1">Side</label>
          <select
            id="side"
            name="side"
            value={formData.side}
            onChange={handleChange}
            className="block w-full rounded-md border border-white/20 bg-black/30 px-3 py-2 text-white shadow-sm focus:border-red-500 focus:outline-none focus:ring-red-500 sm:text-sm"
          >
            <option value={TradeSide.LONG}>LONG</option>
            <option value={TradeSide.SHORT}>SHORT</option>
          </select>
        </div>

        <InputField id="entry_price" label="Entry Price" type="number" step="any" value={formData.entry_price} onChange={handleChange} />
        <InputField id="tp_price" label="Take Profit" type="number" step="any" value={formData.tp_price} onChange={handleChange} />
        <InputField id="sl_price" label="Stop Loss" type="number" step="any" value={formData.sl_price} onChange={handleChange} />
        <InputField id="post_url" label="Post URL" type="url" value={formData.post_url} onChange={handleChange} placeholder="https://" required={false} />
        <InputField
          id="opened_at"
          label="Opened At"
          type="datetime-local"
          value={formData.opened_at}
          onChange={handleChange}
          required={formData.status === TradeStatus.OPEN}
        />
        <InputField id="quantity" label="Quantity (Optional)" type="number" step="any" value={formData.quantity} onChange={handleChange} required={false} />

        <div className="md:col-span-2 lg:col-span-3">
          <fieldset className="border border-white/10 rounded-md px-4 py-3">
            <legend className="text-sm font-semibold text-gray-200 px-1">Start As</legend>
            <div className="flex flex-wrap gap-4 mt-2">
              <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="radio"
                  name="status"
                  value={TradeStatus.PENDING}
                  checked={formData.status === TradeStatus.PENDING}
                  onChange={handleStatusChange}
                  className="text-red-500 focus:ring-red-500"
                />
                Pending
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="radio"
                  name="status"
                  value={TradeStatus.OPEN}
                  checked={formData.status === TradeStatus.OPEN}
                  onChange={handleStatusChange}
                  className="text-red-500 focus:ring-red-500"
                />
                Open
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Pending positions activate when market price crosses entry. Open positions start tracking PnL immediately.
            </p>
          </fieldset>
        </div>

        <div className="md:col-span-2 lg:col-span-3 flex flex-wrap gap-3 justify-end">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-white/10 px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md border border-transparent bg-red-500 py-2 px-6 text-sm font-medium text-white shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting…' : 'Submit Trade'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default AddTradeForm;
