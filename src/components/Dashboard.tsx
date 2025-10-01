import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReportStats from './ReportStats';
import TradeList from './TradeList';
import CandlestickChart from './CandlestickChart';
import ClosedTradesTable from './ClosedTradesTable';
import PnlChart from './PnlChart';
import TradeDetailModal from './TradeDetailModal';
import ConfirmDialog from './ConfirmDialog';
import ShareTradeModal from './ShareTradeModal';

import {
  fetchTrades,
  fetchOhlcv,
  subscribeToTradeUpdates,
  closeTrade,
  removeTrade,
} from '../services/api';

import { Trade, OhlcvResponse, TradeStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { TRADES_REFRESH_EVENT } from '../utils/events';

const PAGE_SIZE = 10;

type StatusFilter = 'ALL' | TradeStatus.OPEN | TradeStatus.PENDING;
type PendingAction = { type: 'force' | 'remove'; trade: Trade } | null;
const ALLOWED_TIMEFRAMES = new Set(['1m', '5m', '15m', '30m', '1h', '4h']);

function Dashboard() {
  const { isAdmin, token, envConfig } = useAuth();
  const { showToast } = useToast();

  const [activeTrades, setActiveTrades] = useState<Trade[]>([]);
  const [closedTrades, setClosedTrades] = useState<Trade[]>([]);

  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [hoveredTrade, setHoveredTrade] = useState<Trade | null>(null);
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL');

  const [chartData, setChartData] = useState<OhlcvResponse | null>(null);

  const [isLoading, setIsLoading] = useState({ active: false, closed: false, chart: false });
  const [pages, setPages] = useState({ closed: 1 });
  const [hasMoreClosed, setHasMoreClosed] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionInFlight, setActionInFlight] = useState(false);
  const [shareTarget, setShareTarget] = useState<Trade | null>(null);

  const chartTimeframe = useMemo(() => {
    const raw = (envConfig.VITE_DEFAULT_TIMEFRAME || '').toLowerCase();
    return ALLOWED_TIMEFRAMES.has(raw) ? raw : '1h';
  }, [envConfig]);

  const loadActiveTrades = useCallback(async () => {
    setError(null);
    setIsLoading((prev) => ({ ...prev, active: true }));
    try {
      const trades = await fetchTrades({ statuses: [TradeStatus.OPEN, TradeStatus.PENDING] });
      setActiveTrades(trades);

      if (trades.length > 0) {
        setSelectedTrade((current) => {
          if (!current) return trades[0];
          const exists = trades.find((t) => t.id === current.id);
          return exists || trades[0];
        });
      } else {
        setSelectedTrade(null);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load active trades.');
    } finally {
      setIsLoading((prev) => ({ ...prev, active: false }));
    }
  }, []);

  const loadClosedTrades = useCallback(async (page: number = 1) => {
    if (page === 1) {
      setError(null);
    }
    setIsLoading((prev) => ({ ...prev, closed: true }));
    try {
      const trades = await fetchTrades({ statuses: [TradeStatus.CLOSED], page, limit: PAGE_SIZE });
      setClosedTrades((prev) => (page === 1 ? trades : [...prev, ...trades]));
      setHasMoreClosed(trades.length === PAGE_SIZE);
    } catch (err) {
      console.error(err);
      setError('Failed to load closed trades.');
    } finally {
      setIsLoading((prev) => ({ ...prev, closed: false }));
    }
  }, []);

  useEffect(() => {
    loadActiveTrades();
    loadClosedTrades(1);

    const unsubscribe = subscribeToTradeUpdates((updatedActiveTrades) => {
      setActiveTrades(updatedActiveTrades);
      setSelectedTrade((current) => {
        if (!current) return updatedActiveTrades[0] ?? null;
        const updated = updatedActiveTrades.find((t) => t.id === current.id);
        return updated || (updatedActiveTrades[0] ?? null);
      });
    });

    const refreshHandler = () => {
      loadActiveTrades();
      setPages({ closed: 1 });
      loadClosedTrades(1);
    };

    window.addEventListener(TRADES_REFRESH_EVENT, refreshHandler);

    return () => {
      unsubscribe();
      window.removeEventListener(TRADES_REFRESH_EVENT, refreshHandler);
    };
  }, [loadActiveTrades, loadClosedTrades]);

  useEffect(() => {
    if (!selectedTrade) {
      setChartData(null);
      return;
    }

    const run = async () => {
      try {
        setIsLoading((prev) => ({ ...prev, chart: true }));
        const data = await fetchOhlcv(selectedTrade.id, { timeframe: chartTimeframe });
        setChartData(data);
      } catch (err) {
        console.error(err);
        setError(`Failed to load chart data for ${selectedTrade.symbol}.`);
        setChartData(null);
      } finally {
        setIsLoading((prev) => ({ ...prev, chart: false }));
      }
    };

    run();
  }, [selectedTrade, chartTimeframe]);

  const handleTradeMouseOver = (trade: Trade, e: React.MouseEvent) => {
    setHoveredTrade(trade);
    setPopoverPosition({ x: e.clientX, y: e.clientY });
  };

  const handleTradeMouseOut = () => setHoveredTrade(null);

  const openActionDialog = (trade: Trade, type: 'force' | 'remove') => {
    if (!isAdmin) {
      showToast('Log in with an admin account to manage trades.', { variant: 'error' });
      return;
    }
    setPendingAction({ trade, type });
  };

  const executeAction = async () => {
    if (!pendingAction) return;
    if (!token) {
      showToast('Session expired. Please log in again.', { variant: 'error' });
      setPendingAction(null);
      return;
    }

    try {
      setActionInFlight(true);
      if (pendingAction.type === 'force') {
        await closeTrade(pendingAction.trade.id, { token });
        showToast(`${pendingAction.trade.symbol} closed successfully.`, { variant: 'success' });
      } else {
        await removeTrade(pendingAction.trade.id, token);
        showToast(`${pendingAction.trade.symbol} removed successfully.`, { variant: 'success' });
      }

      await loadActiveTrades();
      await loadClosedTrades(1);
      setPages({ closed: 1 });
      setSelectedTrade((current) => {
        if (!current) return null;
        return current.id === pendingAction.trade.id ? null : current;
      });
    } catch (err: any) {
      showToast(err?.message || 'Operation failed. Please try again.', { variant: 'error' });
    } finally {
      setActionInFlight(false);
      setPendingAction(null);
    }
  };

  const handleLoadMoreClosed = () => {
    if (isLoading.closed || !hasMoreClosed) return;
    const nextPage = pages.closed + 1;
    setPages({ closed: nextPage });
    loadClosedTrades(nextPage);
  };

  return (
    <>
      <div className="space-y-8">
        <ReportStats />

        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-100 px-4 py-3 rounded-md" role="alert">
            <p>{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <TradeList
              trades={activeTrades}
              selectedTradeId={selectedTrade?.id ?? null}
              onSelectTrade={(trade) => setSelectedTrade(trade)}
              isLoading={isLoading.active && activeTrades.length === 0}
              onLoadMore={() => {}}
              hasMore={false}
              filter={activeFilter}
              setFilter={setActiveFilter}
              onTradeMouseOver={handleTradeMouseOver}
              onTradeMouseOut={handleTradeMouseOut}
              onForceClose={(trade) => openActionDialog(trade, 'force')}
              onRemove={(trade) => openActionDialog(trade, 'remove')}
              isAdmin={isAdmin}
            />
          </div>
          <div className="lg:col-span-2 space-y-8">
            <CandlestickChart
              trade={selectedTrade}
              ohlcvData={chartData}
              isLoading={isLoading.chart}
              timeframe={chartTimeframe}
            />
            <ClosedTradesTable
              trades={closedTrades}
              isLoading={isLoading.closed}
              onLoadMore={handleLoadMoreClosed}
              hasMore={hasMoreClosed}
              onShare={(trade) => setShareTarget(trade)}
            />
            <PnlChart />
          </div>
        </div>
      </div>

      <TradeDetailModal trade={hoveredTrade} position={popoverPosition} />

      <ConfirmDialog
        open={!!pendingAction}
        loading={actionInFlight}
        title={
          pendingAction?.type === 'remove'
            ? 'Remove this pending trade?'
            : 'Force close this trade?'
        }
        message={
          pendingAction?.type === 'remove'
            ? 'This will delete the pending position. Are you sure?'
            : 'This will immediately close the position. Are you sure?'
        }
        confirmLabel={pendingAction?.type === 'remove' ? 'Remove' : 'Force Close'}
        onCancel={() => {
          if (actionInFlight) return;
          setPendingAction(null);
        }}
        onConfirm={executeAction}
      />

      <ShareTradeModal trade={shareTarget} onClose={() => setShareTarget(null)} />
    </>
  );
}

export default Dashboard;
