import React, { useRef, useEffect } from 'react';
import { Trade, TradeSide } from '../types';
import { ExternalLinkIcon } from './icons';

interface ClosedTradesTableProps {
  trades: Trade[];
  isLoading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  onShare: (trade: Trade) => void;
}

const PnlCell = ({ pnl }: { pnl: number | null | undefined }) => {
  if (pnl === null || pnl === undefined) return <span className="text-gray-500">-</span>;
  const isPositive = pnl >= 0;
  const color = isPositive ? 'text-green-400' : 'text-red-400';
  const sign = isPositive ? '+' : '';
  return <span className={`font-semibold ${color}`}>{sign}{pnl.toFixed(2)}%</span>;
};

const SkeletonRow = () => (
  <tr className="border-b border-white/10 animate-pulse">
    <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-full"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-full"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-full"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-full"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-full"></div></td>
    <td className="px-6 py-4"><div className="h-4 bg-gray-700 rounded w-6 mx-auto"></div></td>
  </tr>
);

function ClosedTradesTable({ trades, isLoading, onLoadMore, hasMore, onShare }: ClosedTradesTableProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  // FIX: Changed sentinelRef type to HTMLTableCellElement to match the td element it is attached to.
  const sentinelRef = useRef<HTMLTableCellElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLoading) return;

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore();
      }
    }, { root: containerRef.current });

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isLoading, hasMore, onLoadMore]);

  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 p-4 rounded-lg shadow-lg">
      <h3 className="text-lg font-bold mb-4 bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">Closed Trades</h3>
      <div ref={containerRef} className="relative overflow-y-auto rounded-lg max-h-96">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-400 uppercase bg-black/50 sticky top-0 backdrop-blur-sm">
            <tr>
              <th className="px-6 py-3">Ticker</th>
              <th className="px-6 py-3">Side</th>
              <th className="px-6 py-3">Entry</th>
              <th className="px-6 py-3">Exit</th>
              <th className="px-6 py-3">PnL</th>
              <th className="px-6 py-3 text-center">Share</th>
            </tr>
          </thead>
          <tbody>
            {(isLoading && trades.length === 0) ? (
              <>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>
            ) : trades.length > 0 ? (
              trades.map((trade) => (
                <tr key={trade.id} className="border-b border-white/10 hover:bg-white/5">
                  <th className="px-6 py-4 font-medium text-white whitespace-nowrap">{trade.symbol}</th>
                  <td className={`px-6 py-4 font-semibold ${trade.side === TradeSide.LONG ? 'text-green-400' : 'text-red-400'}`}>{trade.side}</td>
                  <td className="px-6 py-4">{trade.entry_price.toLocaleString()}</td>
                  <td className="px-6 py-4">{trade.exit_price?.toLocaleString() ?? '-'}</td>
                  <td className="px-6 py-4"><PnlCell pnl={trade.pnl_pct} /></td>
                  <td className="px-6 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => onShare(trade)}
                      className="text-red-400 hover:text-red-300"
                      aria-label={`Share trade ${trade.symbol}`}
                    >
                      <ExternalLinkIcon className="w-5 h-5 inline-block" />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="text-center py-8 text-gray-500">No closed trades to display.</td>
              </tr>
            )}
            {/* Sentinel for infinite scroll */}
            <tr><td colSpan={6} ref={sentinelRef} style={{ height: '1px' }} /></tr>
          </tbody>
        </table>
        {isLoading && trades.length > 0 && (
            <div className="flex justify-center p-4"><div className="w-6 h-6 border-2 border-dashed rounded-full animate-spin border-red-500"></div></div>
        )}
      </div>
    </div>
  );
}

export default ClosedTradesTable;
