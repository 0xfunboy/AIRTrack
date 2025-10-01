import React, { useState, useEffect, useRef } from 'react';
import { Chart } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  TimeScale,
  TimeSeriesScale
} from 'chart.js';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import 'chartjs-adapter-date-fns';
import annotationPlugin from 'chartjs-plugin-annotation';

import { Trade, OhlcvResponse, TradeStatus } from '../types';
import { ChartIcon } from './icons';

// Register all necessary components for Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  TimeScale,
  TimeSeriesScale,
  CandlestickController,
  CandlestickElement,
  annotationPlugin,
);

interface CandlestickChartProps {
  trade: Trade | null;
  ohlcvData: OhlcvResponse | null;
  isLoading: boolean;
  timeframe: string;
}

const TIMEFRAME_META: Record<string, { unit: 'minute' | 'hour'; label: string; displayFormat: string }> = {
  '1m': { unit: 'minute', label: '1m', displayFormat: 'HH:mm' },
  '5m': { unit: 'minute', label: '5m', displayFormat: 'HH:mm' },
  '15m': { unit: 'minute', label: '15m', displayFormat: 'HH:mm' },
  '30m': { unit: 'minute', label: '30m', displayFormat: 'HH:mm' },
  '1h': { unit: 'hour', label: '1h', displayFormat: 'MMM d, HH:mm' },
  '4h': { unit: 'hour', label: '4h', displayFormat: 'MMM d, HH:mm' },
};

const PnlDisplay = ({ pnl, pnlChange }: { pnl: number, pnlChange: 'up' | 'down' | 'none' }) => {
  const isPositive = pnl >= 0;
  const color = isPositive ? 'text-green-400' : 'text-red-400';
  const sign = isPositive ? '+' : '';
  const animationClass = pnlChange === 'up' ? 'pnl-up' : pnlChange === 'down' ? 'pnl-down' : '';
  
  return (
    <div>
      <span className="text-sm text-gray-400">Unrealized PnL: </span>
      <span className={`font-semibold text-lg px-2 py-1 rounded-md ${color} ${animationClass}`}>{sign}{pnl.toFixed(2)}%</span>
    </div>
  );
};

function CandlestickChart({ trade, ohlcvData, isLoading, timeframe }: CandlestickChartProps) {
  const tfKey = (ohlcvData?.tf || timeframe || '').toLowerCase();
  const tfConfig = TIMEFRAME_META[tfKey] ?? TIMEFRAME_META['1h'];
  const [entryAnnotation, setEntryAnnotation] = useState<any>(null);
  const [pnlChange, setPnlChange] = useState<'up' | 'down' | 'none'>('none');
  const prevPnlRef = useRef<number | undefined>(undefined);
  const prevTradeIdRef = useRef<number | undefined>(undefined);

  // Effect to detect PnL change for animation
  useEffect(() => {
    // If trade ID has changed, reset the previous PnL to prevent false animation
    if (prevTradeIdRef.current !== trade?.id) {
        prevPnlRef.current = undefined;
        prevTradeIdRef.current = trade?.id;
    }

    const currentPnl = typeof trade?.unrealized_pnl_pct === 'number' ? trade.unrealized_pnl_pct : undefined;
    if (trade?.status === TradeStatus.OPEN && prevPnlRef.current !== undefined && currentPnl !== undefined) {
        if (currentPnl > prevPnlRef.current) {
            setPnlChange('up');
        } else if (currentPnl < prevPnlRef.current) {
            setPnlChange('down');
        }
    }
    prevPnlRef.current = currentPnl;
  }, [trade?.id, trade?.unrealized_pnl_pct, trade?.status]);

  // Effect to reset the animation trigger
  useEffect(() => {
    if (pnlChange !== 'none') {
        const timer = setTimeout(() => setPnlChange('none'), 700);
        return () => clearTimeout(timer);
    }
  }, [pnlChange]);

  const chartData = ohlcvData?.data.map(d => ({
    x: d.time,
    o: d.open,
    h: d.high,
    l: d.low,
    c: d.close,
  })) ?? [];

  const execTime = trade?.opened_at ?? trade?.created_at ?? null;
  const yDomainMin = chartData.length > 0 ? Math.min(...chartData.map(d => d.l)) : 0;

  useEffect(() => {
    // Reset on trade deselection
    if (!trade?.entry_price) {
      setEntryAnnotation(null);
      return;
    }

    const targetPrice = trade.entry_price;
    
    // Initial state: transparent and at the bottom of the chart
    const initialAnnotation = {
      type: 'line',
      yMin: yDomainMin,
      yMax: yDomainMin,
      borderColor: 'rgba(56, 189, 248, 0)',
      borderWidth: 1,
      borderDash: [4, 4],
      label: { 
          content: 'Entry', 
          position: 'start', 
          backgroundColor: 'rgba(56, 189, 248, 0)', 
          color: 'rgba(125, 211, 252, 0)',
          font: {size: 10}, 
          yAdjust: -10, 
          padding: {x: 4, y: 2} 
      }
    };
    setEntryAnnotation(initialAnnotation);

    // After a short delay, update to the final state to trigger animation
    const timer = setTimeout(() => {
        setEntryAnnotation({
            ...initialAnnotation,
            yMin: targetPrice,
            yMax: targetPrice,
            borderColor: '#38BDF8',
            label: {
                ...initialAnnotation.label,
                backgroundColor: 'rgba(56, 189, 248, 0.2)',
                color: '#7dd3fc',
            }
        });
    }, 50); // Small delay allows chart.js to register the initial state before animating

    return () => clearTimeout(timer);
  }, [trade?.id, yDomainMin]); // Re-run effect when the trade or chart domain changes


  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
        duration: 800,
        easing: 'easeOutCubic' as const,
    },
    scales: {
      x: {
        type: 'time' as const,
        time: {
          unit: tfConfig.unit,
          displayFormats: {
            hour: tfConfig.displayFormat,
            minute: tfConfig.displayFormat,
          },
        },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9CA3AF' },
      },
      y: {
        position: 'right' as const,
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9CA3AF' },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        backgroundColor: 'rgba(10, 10, 15, 0.8)', // bg-gray-800 with opacity
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        titleFont: { size: 14 },
        bodyFont: { size: 12 },
        padding: 10,
        boxPadding: 4,
      },
      annotation: {
        annotations: {
          ...(entryAnnotation && { entryLine: entryAnnotation }),
          ...(trade?.tp_price && {
            tpLine: { type: 'line', yMin: trade.tp_price, yMax: trade.tp_price, borderColor: '#10B981', borderWidth: 1, borderDash: [4, 4], label: { content: 'TP', position: 'start', backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#34d399', font: {size: 10}, yAdjust: -10, padding: {x: 4, y: 2} } }
          }),
          ...(trade?.sl_price && {
            slLine: { type: 'line', yMin: trade.sl_price, yMax: trade.sl_price, borderColor: '#EF4444', borderWidth: 1, borderDash: [4, 4], label: { content: 'SL', position: 'start', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#f87171', font: {size: 10}, yAdjust: 10, padding: {x: 4, y: 2} } }
          }),
          ...(execTime && {
            execLine: { type: 'line', xMin: execTime, xMax: execTime, borderColor: '#FCD34D', borderWidth: 1, borderDash: [4, 2], label: { content: 'Exec', position: 'start', rotation: 90, backgroundColor: 'rgba(252, 211, 77, 0.2)', color: '#fde047', font: {size: 10}, yAdjust: 20, padding: {x: 4, y: 2} } }
          }),
        },
      },
    },
  };

  const data = {
    datasets: [{
      label: trade?.symbol ?? 'Price',
      data: chartData,
    }],
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-red-500"></div>
        </div>
      );
    }

    if (!trade || chartData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <ChartIcon className="w-16 h-16 mb-4" />
          <p className="text-lg">Select a trade to view its chart</p>
        </div>
      );
    }
    
    // @ts-ignore Chart.js financial types can be tricky with the wrapper
    return <Chart type="candlestick" options={options} data={data} />;
  };

  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 p-4 rounded-lg shadow-lg h-96 min-h-[400px]">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h3 className="text-lg font-bold text-white bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">
            {trade ? `${trade.symbol} – Candlestick Chart` : 'Chart'}
          </h3>
          <p className="text-xs text-gray-400">Timeframe: {tfConfig.label}</p>
        </div>
        {trade?.status === TradeStatus.OPEN && typeof trade.unrealized_pnl_pct === 'number' && (
          <PnlDisplay pnl={trade.unrealized_pnl_pct} pnlChange={pnlChange} />
        )}
      </div>
      <div className="h-[calc(100%-2.5rem)] relative">{renderContent()}</div>
    </div>
  );
}

export default CandlestickChart;
