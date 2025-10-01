import React, { useState, useEffect, useRef } from 'react';
import { Chart } from 'react-chartjs-2';
import type { Chart as ChartJS } from 'chart.js';
import {
  Chart as ChartJSClass,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Filler,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { fetchPnlData } from '../services/api';
import { PnlDataPoint } from '../types';

// Register Line chart stuff
ChartJSClass.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Tooltip,
  Filler,
);

function createGradient(ctx: CanvasRenderingContext2D, area: any, data: number[]) {
  const colorUp = 'rgba(16, 185, 129, 0.4)';   // green-500
  const colorDown = 'rgba(239, 68, 68, 0.4)'; // red-500
  const colorZero = 'rgba(239, 68, 68, 0.0)';

  const gradient = ctx.createLinearGradient(0, area.bottom, 0, area.top);
  const [min, max] = data.reduce((acc, val) => [Math.min(val, acc[0]), Math.max(val, acc[1])], [Infinity, -Infinity]);

  if (max < 0) {
    gradient.addColorStop(0, colorDown);
    gradient.addColorStop(1, colorZero);
  } else if (min > 0) {
    gradient.addColorStop(0, colorZero);
    gradient.addColorStop(1, colorUp);
  } else {
    const zeroPoint = 1 - (max / (max - min));
    gradient.addColorStop(0, colorDown);
    gradient.addColorStop(Math.max(0, zeroPoint - 0.01), colorDown);
    gradient.addColorStop(Math.min(1, zeroPoint + 0.01), colorUp);
    gradient.addColorStop(1, colorUp);
  }

  return gradient;
}

function PnlChart() {
  const [data, setData] = useState<PnlDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const chartRef = useRef<ChartJSClass>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const pnlData = await fetchPnlData();
        setData(pnlData);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  const chartData = {
    labels: data.map(d => d.time),
    datasets: [
      {
        label: 'Cumulative PnL',
        data: data.map(d => d.cumulativePnl),
        borderColor: '#e94057',
        borderWidth: 2,
        pointRadius: 0,
        fill: true,
        backgroundColor: (context: { chart: ChartJS }) => {
          const chart: any = context.chart;
          const { ctx, chartArea } = chart;
          if (!chartArea) return null;
          const pnlValues = data.map(d => d.cumulativePnl);
          return createGradient(ctx, chartArea, pnlValues);
        },
      },
    ],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        type: 'time',
        time: { unit: 'day' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: { color: '#9CA3AF' },
      },
      y: {
        position: 'right',
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: {
          color: '#9CA3AF',
          callback: (value: string | number) => `${value}%`
        },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(10, 10, 15, 0.8)',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => `Cumulative PnL: ${context.formattedValue}%`
        },
      },
    },
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-red-500"></div>
        </div>
      );
    }

    if (data.length <= 1) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-500">
          <p>Not enough data to display PnL chart.</p>
        </div>
      );
    }

    // @ts-ignore
    return <Chart ref={chartRef} type='line' options={options} data={chartData} />;
  };

  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/10 p-4 rounded-lg shadow-lg h-80 min-h-[320px]">
      <h3 className="text-lg font-bold text-white mb-4 bg-gradient-to-r from-red-500 via-pink-500 to-rose-400 text-transparent bg-clip-text">Cumulative PnL Over Time</h3>
      <div className="h-[calc(100%-2.5rem)]">{renderContent()}</div>
    </div>
  );
}

export default PnlChart;
