export enum TradeStatus {
  PENDING = 'PENDING',
  OPEN = 'OPEN',
  CLOSED = 'CLOSED'
}

export enum TradeSide {
  LONG = 'LONG',
  SHORT = 'SHORT'
}

export interface Trade {
  id: number;
  symbol: string;              // e.g. BTC/USDT (display value)
  quote?: string | null;       // optional quote currency (e.g. USDT)
  side: TradeSide;
  status: TradeStatus;
  entry_price: number;
  exit_price?: number | null;
  tp_price?: number | null;
  sl_price?: number | null;
  quantity?: number | null;     // Optional position size
  opened_at?: number | null;   // ms timestamp
  entry_hit_at?: number | null;// ms timestamp when entry was hit
  closed_at?: number | null;   // ms timestamp
  pnl_pct?: number | null;     // realized PnL% for closed trades
  post_url?: string | null;    // link to social post
  unrealized_pnl_pct?: number | null; // computed for open trades
  created_at: number;          // ms timestamp
  updated_at?: number;         // ms timestamp
  userId?: number;             // owner id
}

export interface ReportSummary {
  totals: {
    open: number;
    pending: number;
    closed: number;
  };
  pnl_realized_pct_sum: number;
}

export type ReportWindow = '7d' | '1m' | 'all';

export type OhlcvDataPoint = {
  time: number; // ms timestamp for Recharts time scale
  open: number;
  high: number;
  low: number;
  close: number;
};

export interface OhlcvResponse {
  symbol: string;
  tf: string; // e.g. "1h"
  data: OhlcvDataPoint[];
}

export interface PnlDataPoint {
  time: number; // ms timestamp
  cumulativePnl: number; // percentage
}
