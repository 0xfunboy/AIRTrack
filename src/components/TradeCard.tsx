import React, { useState, useEffect, useRef } from 'react';
import { Trade, TradeSide, TradeStatus } from '../types';
import { ExternalLinkIcon } from './icons';

interface TradeCardProps {
  trade: Trade;
  isSelected: boolean;
  onSelect: () => void;
  onMouseOver: (trade: Trade, e: React.MouseEvent) => void;
  onMouseOut: () => void;
  onForceClose: () => void;
  onRemove: () => void;
  isAdmin: boolean;
}

const PnlDisplay = ({ pnl, pnlChange }: { pnl: number, pnlChange: 'up' | 'down' | 'none' }) => {
  const isPositive = pnl >= 0;
  const color = isPositive ? 'text-green-400' : 'text-red-400';
  const sign = isPositive ? '' : ''; // Negative sign is already there
  const animationClass = pnlChange === 'up' ? 'pnl-up' : pnlChange === 'down' ? 'pnl-down' : '';
  
  return <span className={`font-semibold px-1 rounded-md ${color} ${animationClass}`}>{sign}{pnl.toFixed(2)}%</span>;
};

const TradeCard = ({ trade, isSelected, onSelect, onMouseOver, onMouseOut, onForceClose, onRemove, isAdmin }: TradeCardProps) => {
  const sideColor = trade.side === TradeSide.LONG ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400';
  const statusColor = trade.status === TradeStatus.OPEN ? 'text-blue-400' : (trade.status === TradeStatus.PENDING ? 'text-yellow-400' : 'text-gray-400');
  const selectionClass = isSelected ? 'ring-2 ring-red-500 bg-black/50' : 'bg-black/20 hover:bg-black/40 border-white/10';

  const [pnlChange, setPnlChange] = useState<'up' | 'down' | 'none'>('none');
  const prevPnlRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const currentPnl = typeof trade.unrealized_pnl_pct === 'number' ? trade.unrealized_pnl_pct : undefined;
    if (prevPnlRef.current !== undefined && currentPnl !== undefined) {
      if (currentPnl > prevPnlRef.current) {
        setPnlChange('up');
      } else if (currentPnl < prevPnlRef.current) {
        setPnlChange('down');
      }
    }
    prevPnlRef.current = currentPnl;
  }, [trade.unrealized_pnl_pct]);

  useEffect(() => {
    if (pnlChange !== 'none') {
      const timer = setTimeout(() => setPnlChange('none'), 700);
      return () => clearTimeout(timer);
    }
  }, [pnlChange]);


  const handleForceClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onForceClose();
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return (
    <div 
      onClick={onSelect} 
      onMouseOver={(e) => onMouseOver(trade, e)}
      onMouseOut={onMouseOut}
      className={`p-4 rounded-lg cursor-pointer transition-all duration-200 border ${selectionClass} flex flex-col justify-between min-h-[120px]`}
    >
      <div>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-bold text-lg text-white">{trade.symbol}</span>
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${sideColor}`}>{trade.side}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${statusColor}`}>{trade.status}</span>
            {isAdmin && trade.status === TradeStatus.OPEN && (
              <button
                onClick={handleForceClose}
                className="text-red-500 hover:text-red-400 text-xs font-bold transition-colors"
                aria-label={`Force close trade ${trade.symbol}`}
              >
                [Force Close]
              </button>
            )}
            {isAdmin && trade.status === TradeStatus.PENDING && (
              <button
                onClick={handleRemove}
                className="text-red-400 hover:text-red-300 text-xs font-bold transition-colors"
                aria-label={`Remove trade ${trade.symbol}`}
              >
                [Remove]
              </button>
            )}
          </div>
        </div>

        <div className="mt-2">
          {trade.status === TradeStatus.OPEN && typeof trade.unrealized_pnl_pct === 'number' ? (
            <div>
              <span className="text-sm text-gray-400">Unrealized PnL: </span>
              <PnlDisplay pnl={trade.unrealized_pnl_pct} pnlChange={pnlChange} />
            </div>
          ) : (
            <div>
              <span className="text-sm text-gray-400">Entry Price: </span>
              <span className="font-semibold text-white">{trade.entry_price.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
        <span>{formatDate(trade.created_at)}</span>
        {trade.post_url && (
            <a 
              href={trade.post_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              onClick={(e) => e.stopPropagation()}
              className="text-red-400 hover:text-red-300 inline-flex items-center gap-1"
            >
              Shared Post <ExternalLinkIcon className="w-4 h-4" />
            </a>
        )}
      </div>
    </div>
  );
};

export default TradeCard;
