import React, { useRef, useEffect } from 'react';
import { Trade, TradeStatus } from '../types';
import TradeCard from './TradeCard';

type StatusFilter = 'ALL' | TradeStatus.OPEN | TradeStatus.PENDING;

interface TradeListProps {
  trades: Trade[];
  selectedTradeId?: number | null;
  onSelectTrade: (trade: Trade) => void;
  isLoading: boolean;
  onLoadMore: () => void;
  hasMore: boolean;
  filter: StatusFilter;
  setFilter: (filter: StatusFilter) => void;
  onTradeMouseOver: (trade: Trade, e: React.MouseEvent) => void;
  onTradeMouseOut: () => void;
  onForceClose: (trade: Trade) => void;
  onRemove: (trade: Trade) => void;
  isAdmin: boolean;
}

const SkeletonCard = () => (
  <div className="bg-black/20 border border-white/10 p-4 rounded-lg animate-pulse min-h-[120px]">
    <div className="flex justify-between items-center mb-2">
      <div className="h-5 bg-gray-700 rounded w-1/3"></div>
      <div className="h-5 bg-gray-700 rounded w-1/4"></div>
    </div>
    <div className="h-6 bg-gray-700 rounded w-1/2 mt-3"></div>
  </div>
);

const FilterButton = ({ label, isActive, onClick }: { label: string, isActive: boolean, onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
            isActive ? 'bg-red-500 text-white shadow' : 'text-gray-300 hover:bg-white/10'
        }`}
    >
        {label}
    </button>
);


function TradeList({ trades, selectedTradeId, onSelectTrade, isLoading, onLoadMore, hasMore, filter, setFilter, onTradeMouseOver, onTradeMouseOut, onForceClose, onRemove, isAdmin }: TradeListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLoading) return;

    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore();
      }
    });

    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isLoading, hasMore, onLoadMore]);

  const filteredTrades = trades.filter(trade => {
    if (filter === 'ALL') return true;
    return trade.status === filter;
  });

  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 p-4 rounded-lg shadow-lg">
      <div className="px-2 pb-3 border-b border-white/10 mb-4">
        <h3 className="text-lg font-bold text-white mb-3 bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">
            Active & Pending Positions
        </h3>
        <div className="flex space-x-1 bg-black/20 p-1 rounded-md">
            <FilterButton label="All" isActive={filter === 'ALL'} onClick={() => setFilter('ALL')} />
            <FilterButton label="Open" isActive={filter === TradeStatus.OPEN} onClick={() => setFilter(TradeStatus.OPEN)} />
            <FilterButton label="Pending" isActive={filter === TradeStatus.PENDING} onClick={() => setFilter(TradeStatus.PENDING)} />
        </div>
      </div>
      
      <div className="space-y-3 max-h-[calc(100vh-450px)] overflow-y-auto pr-2">
        {(isLoading && filteredTrades.length === 0) ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : filteredTrades.length > 0 ? (
          filteredTrades.map((trade) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              isSelected={trade.id === selectedTradeId}
              onSelect={() => onSelectTrade(trade)}
              onMouseOver={onTradeMouseOver}
              onMouseOut={onTradeMouseOut}
              onForceClose={() => onForceClose(trade)}
              onRemove={() => onRemove(trade)}
              isAdmin={isAdmin}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-500">No trades match the current filter.</div>
        )}
        
        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} style={{ height: '1px' }} />
        
        {isLoading && filteredTrades.length > 0 && (
            <div className="flex justify-center p-4"><div className="w-6 h-6 border-2 border-dashed rounded-full animate-spin border-red-500"></div></div>
        )}

      </div>
    </div>
  );
}

export default TradeList;
