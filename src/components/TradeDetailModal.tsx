import React, { useEffect, useRef, useState } from 'react';
import { Trade, TradeSide, TradeStatus } from '../types';

interface TradeDetailModalProps {
  trade: Trade | null;
  position: { x: number; y: number };
}

const DetailRow = ({ label, value, valueClassName = 'text-white' }: { label: string, value: React.ReactNode, valueClassName?: string }) => (
  <>
    <div className="text-gray-400">{label}</div>
    <div className={`font-semibold text-right ${valueClassName}`}>{value}</div>
  </>
);

const PnlDisplay = ({ pnl, prefix = '' }: { pnl: number | null | undefined, prefix?: string }) => {
    if (pnl === null || pnl === undefined) return <span className="text-gray-500">-</span>;
    const isPositive = pnl >= 0;
    const color = isPositive ? 'text-green-400' : 'text-red-400';
    const sign = isPositive ? '+' : '';
    return <span className={color}>{`${prefix}${sign}${pnl.toFixed(2)}%`}</span>;
};

function TradeDetailModal({ trade, position }: TradeDetailModalProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({
    position: 'fixed',
    opacity: 0,
    pointerEvents: 'none',
    zIndex: 50,
  });

  useEffect(() => {
    if (trade && popoverRef.current) {
      const popoverRect = popoverRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let top = position.y + 20;
      let left = position.x + 20;
      
      // Adjust if it goes off the right edge of the viewport
      if (left + popoverRect.width > viewportWidth - 20) {
        left = position.x - popoverRect.width - 20;
      }
      
      // Adjust if it goes off the bottom edge of the viewport
      if (top + popoverRect.height > viewportHeight - 20) {
        top = position.y - popoverRect.height - 20;
      }
      
      // Ensure it doesn't go off the top or left edges
      if (top < 10) top = 10;
      if (left < 10) left = 10;
      
      setStyle({
        ...style,
        top: `${top}px`,
        left: `${left}px`,
        opacity: 1,
        transition: 'opacity 0.1s ease-in-out',
      });
    } else {
        // Hide it when there is no trade
        setStyle(s => ({...s, opacity: 0}));
    }
  }, [trade, position]);

  const formatDate = (timestamp: number | null | undefined) => {
    return timestamp ? new Date(timestamp).toLocaleString() : '-';
  };
  
  if (!trade) {
    // Render the element with opacity 0 so we can measure it on first appearance
    return <div ref={popoverRef} style={style} className="w-full max-w-md"></div>;
  }

  return (
    <div 
        ref={popoverRef}
        style={style}
        className="bg-black/70 backdrop-blur-md border border-white/10 rounded-lg shadow-xl p-6 w-full max-w-md text-sm"
    >
      {/* Header */}
      <div className="flex justify-between items-start pb-3 border-b border-white/10">
          <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">
                  {trade.symbol}
              </h3>
              <div className='flex items-center gap-2 mt-1'>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${trade.side === TradeSide.LONG ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{trade.side}</span>
                  <span className={`text-xs font-semibold ${trade.status === TradeStatus.OPEN ? 'text-blue-400' : (trade.status === TradeStatus.PENDING ? 'text-yellow-400' : 'text-gray-400')}`}>{trade.status}</span>
              </div>
          </div>
      </div>

      {/* Body */}
      <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-black/20 rounded-md">
              <h4 className='col-span-2 text-base font-semibold text-gray-200 mb-1'>Price Levels</h4>
              <DetailRow label="Entry Price" value={trade.entry_price.toLocaleString()} />
              <DetailRow label="Take Profit" value={trade.tp_price?.toLocaleString() ?? '-'} />
              <DetailRow label="Stop Loss" value={trade.sl_price?.toLocaleString() ?? '-'} />
              {trade.status === TradeStatus.CLOSED && <DetailRow label="Exit Price" value={trade.exit_price?.toLocaleString() ?? '-'} />}
          </div>
          
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-black/20 rounded-md">
              <h4 className='col-span-2 text-base font-semibold text-gray-200 mb-1'>Performance</h4>
              {trade.status === TradeStatus.OPEN && <DetailRow label="Unrealized PnL" value={<PnlDisplay pnl={trade.unrealized_pnl_pct} />} />}
              {trade.status === TradeStatus.CLOSED && <DetailRow label="Realized PnL" value={<PnlDisplay pnl={trade.pnl_pct} />} />}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-black/20 rounded-md">
              <h4 className='col-span-2 text-base font-semibold text-gray-200 mb-1'>Timestamps</h4>
              <DetailRow label="Created At" value={formatDate(trade.created_at)} />
              <DetailRow label="Opened At" value={formatDate(trade.opened_at)} />
              {trade.status === TradeStatus.CLOSED && <DetailRow label="Closed At" value={formatDate(trade.closed_at)} />}
          </div>
      </div>
    </div>
  );
}

export default TradeDetailModal;