import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trade } from '../types';

interface ShareTradeModalProps {
  trade: Trade | null;
  onClose: () => void;
}

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 420;

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0.00%';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

const ShareTradeModal: React.FC<ShareTradeModalProps> = ({ trade, onClose }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');

  const shareText = useMemo(() => {
    if (!trade) return '';
    const realized = trade.pnl_pct ?? trade.unrealized_pnl_pct ?? 0;
    const profit = formatPercent(realized);
    const sentiment = realized < 0 ? 'loss' : 'profit';
    return `AIR3 AI Agent by airewardrop just closed a ${trade.side.toLowerCase()} trade on ${trade.symbol} with a ${sentiment} of ${profit}. Check it on AIRTrack!`;
  }, [trade]);

  useEffect(() => {
    if (!trade || !canvasRef.current) {
      setImageUrl('');
      return;
    }

    const canvas = canvasRef.current;
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#111827');
    gradient.addColorStop(0.6, '#1f2937');
    gradient.addColorStop(1, '#dc2626');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    const blocks = 6;
    for (let i = 0; i < blocks; i += 1) {
      const height = 24 + Math.random() * 80;
      const width = (CANVAS_WIDTH / blocks) * 0.6;
      const x = 40 + i * (CANVAS_WIDTH / blocks);
      const y = CANVAS_HEIGHT - height - 80;
      ctx.fillRect(x, y, width, height);
    }

    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 48px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('AIR3 AI Agent', 40, 90);

    ctx.fillStyle = '#f9fafb';
    ctx.font = '600 40px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(`Closed ${trade.side} ${trade.symbol}`, 40, 160);

    ctx.fillStyle = '#e5e7eb';
    ctx.font = '400 28px "Inter", "Segoe UI", sans-serif';
    const opened = trade.opened_at ? new Date(trade.opened_at).toLocaleString() : '—';
    const closed = trade.closed_at ? new Date(trade.closed_at).toLocaleString() : 'Now';
    ctx.fillText(`Opened: ${opened}`, 40, 220);
    ctx.fillText(`Closed: ${closed}`, 40, 260);

    const realized = trade.pnl_pct ?? trade.unrealized_pnl_pct ?? 0;
    const profit = formatPercent(realized);
    ctx.fillStyle = realized < 0 ? '#f87171' : '#86efac';
    ctx.font = '700 72px "Inter", "Segoe UI", sans-serif';
    ctx.fillText(profit, 40, 340);

    ctx.fillStyle = '#f3f4f6';
    ctx.font = '500 22px "Inter", "Segoe UI", sans-serif';
    ctx.fillText('Track every move with AIRTrack • airewardrop', 40, 380);

    const url = canvas.toDataURL('image/jpeg', 0.92);
    setImageUrl(url);
  }, [trade]);

  if (!trade) return null;

  const handleDownload = () => {
    if (!imageUrl) return;
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${trade.symbol}_share.jpg`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleTweet = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://airtrack.app';
    const intentUrl = new URL('https://twitter.com/intent/tweet');
    intentUrl.searchParams.set('text', shareText);
    intentUrl.searchParams.set('url', origin);
    window.open(intentUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h3 className="text-xl font-semibold text-white">Share this trade</h3>
          <button
            onClick={onClose}
            className="text-sm font-medium text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <canvas ref={canvasRef} className="w-full rounded-lg border border-white/10 shadow-inner" />
            </div>
            <div className="space-y-4 text-gray-200">
              <div>
                <h4 className="text-lg font-semibold">Suggested tweet</h4>
                <p className="mt-3 rounded-md bg-black/40 border border-white/10 p-4 text-sm leading-relaxed text-gray-200">
                  {shareText}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Download the image and attach it to your tweet for a rich card preview.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleDownload}
                  className="flex-1 rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                  disabled={!imageUrl}
                >
                  Download Card
                </button>
                <button
                  onClick={handleTweet}
                  className="flex-1 rounded-md border border-transparent bg-sky-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-sky-600 transition-colors"
                >
                  Tweet It
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareTradeModal;
