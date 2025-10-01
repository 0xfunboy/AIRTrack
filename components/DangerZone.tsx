import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { closeAllTrades, resetDatabase } from '../services/api';
import ConfirmDialog from './ConfirmDialog';
import { emitTradesRefresh } from '../utils/events';

const CLOSE_ALL_MESSAGE = 'This will immediately close every open position and remove all pending positions. Are you sure?';
const RESET_DB_MESSAGE = 'This will permanently delete all trades from the database. Are you sure?';

type DangerAction = 'close-all' | 'reset' | null;

function DangerZone() {
  const { isAdmin, token } = useAuth();
  const { showToast } = useToast();
  const [confirming, setConfirming] = useState<DangerAction>(null);
  const [loading, setLoading] = useState<DangerAction>(null);

  if (!isAdmin) {
    return null;
  }

  const requireToken = () => {
    if (!token) {
      showToast('Session expired. Please log in again to perform admin actions.', { variant: 'error' });
      return false;
    }
    return true;
  };

  const handleConfirm = async (action: Exclude<DangerAction, null>) => {
    if (!requireToken()) {
      setConfirming(null);
      return;
    }
    try {
      setLoading(action);
      if (action === 'close-all') {
        await closeAllTrades(token!);
        emitTradesRefresh();
        showToast('All active and pending positions have been closed.', { variant: 'success' });
      } else {
        await resetDatabase(token!);
        emitTradesRefresh();
        showToast('Database has been reset.', { variant: 'success' });
      }
    } catch (err: any) {
      showToast(err?.message || 'Action failed. Please try again.', { variant: 'error' });
    } finally {
      setLoading(null);
      setConfirming(null);
    }
  };

  const openConfirm = (action: Exclude<DangerAction, null>) => () => setConfirming(action);

  return (
    <div className="border border-red-500/30 rounded-lg bg-black/30 backdrop-blur-sm p-6 space-y-4">
      <div>
        <h3 className="text-xl font-bold text-red-400">Danger Zone</h3>
        <p className="mt-2 text-sm text-gray-300">
          These operations are destructive and cannot be undone. Proceed with caution.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button
          onClick={openConfirm('close-all')}
          className="flex-1 rounded-md border border-red-500/50 bg-red-500/10 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-500/30 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
        >
          Close ALL Positions
        </button>
        <button
          onClick={openConfirm('reset')}
          className="flex-1 rounded-md border border-red-500 bg-red-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-gray-900 transition-colors"
        >
          Reset Database
        </button>
      </div>

      <ConfirmDialog
        open={!!confirming}
        loading={loading === confirming}
        title={confirming === 'close-all' ? 'Close all positions?' : 'Reset the database?'}
        message={confirming === 'close-all' ? CLOSE_ALL_MESSAGE : RESET_DB_MESSAGE}
        confirmLabel={confirming === 'close-all' ? 'Close All' : 'Reset'}
        cancelLabel="Cancel"
        onCancel={() => {
          if (loading) return;
          setConfirming(null);
        }}
        onConfirm={() => confirming && handleConfirm(confirming)}
      />
    </div>
  );
}

export default DangerZone;
