import React, { useState, useEffect } from 'react';
import { ReportSummary, ReportWindow } from '../types';
import { fetchReports } from '../services/api';

const StatBadge = ({ label, value, isLoading }: { label: string; value: string | number; isLoading: boolean }) => (
  <div className="bg-black/20 border border-white/10 p-4 rounded-lg text-center shadow-md">
    <dt className="text-sm font-medium text-gray-400 truncate">{label}</dt>
    {isLoading ? (
      <dd className="mt-1 h-8 bg-gray-700 rounded-md animate-pulse w-20 mx-auto"></dd>
    ) : (
      <dd className="mt-1 text-3xl font-semibold tracking-tight text-white">{value}</dd>
    )}
  </div>
);

function ReportStats() {
  const [window, setWindow] = useState<ReportWindow>('7d');
  const [report, setReport] = useState<ReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadReport = async () => {
      try {
        setIsLoading(true);
        const data = await fetchReports(window);
        setReport(data);
      } finally {
        setIsLoading(false);
      }
    };
    loadReport();
  }, [window]);

  const totals = report?.totals ?? { open: 0, pending: 0, closed: 0 };
  const totalTrades = totals.open + totals.pending + totals.closed;
  const realizedPnl = report?.pnl_realized_pct_sum ?? 0;

  const windows: { key: ReportWindow, label: string }[] = [
    { key: '7d', label: '7 Days' },
    { key: '1m', label: '1 Month' },
    { key: 'all', label: 'All Time' },
  ];

  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">Performance</h2>
        <div className="flex space-x-1 bg-black/20 p-1 rounded-md">
          {windows.map(w => (
            <button
              key={w.key}
              onClick={() => setWindow(w.key)}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                window === w.key ? 'bg-red-500 text-white shadow' : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatBadge label="Total Trades" value={totalTrades} isLoading={isLoading} />
        <StatBadge label="Open Trades" value={totals.open} isLoading={isLoading} />
        <StatBadge label="Pending Trades" value={totals.pending} isLoading={isLoading} />
        <StatBadge label="Closed Trades" value={totals.closed} isLoading={isLoading} />
        <StatBadge label="Realized PnL" value={`${realizedPnl.toFixed(2)}%`} isLoading={isLoading} />
      </dl>
    </div>
  );
}

export default ReportStats;
