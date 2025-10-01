// services/api.ts
// Production-ready API client. Public GETs, auth only for mutations.
// Works with Vite; uses VITE_API_URL from .env. Safe if missing (defaults localhost).

import { TradeSide, TradeStatus } from '../types';
import type { Trade, OhlcvResponse, OhlcvDataPoint, PnlDataPoint, ReportSummary } from '../types';

const API_BASE =
  (typeof import.meta !== 'undefined' &&
    import.meta.env &&
    (import.meta.env as any).VITE_API_URL) ||
  'http://localhost:5883/api';

// --- Auth token (global, optional) -----------------------------------------
let authToken: string | null = null;

/**
 * Set or clear the global bearer token used by *mutating* requests.
 * Reading endpoints remain public and will NOT send Authorization if no token.
 */
export function setAuthToken(token: string | null) {
  authToken = token;
}

const DEFAULT_QUOTE = 'USDT';

function toNumber(value: unknown, fallback: number | null = null): number | null {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toTimestamp(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const parsed = Date.parse(typeof value === 'string' ? value : String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

function buildSymbol(symbol: unknown, quote: unknown): { display: string; quote: string | null } {
  const base = typeof symbol === 'string' && symbol ? symbol.toUpperCase() : '';
  const normalizedQuote =
    typeof quote === 'string' && quote
      ? quote.toUpperCase()
      : base
        ? DEFAULT_QUOTE
        : null;

  if (!base) {
    return { display: '', quote: normalizedQuote };
  }

  if (!normalizedQuote) {
    return { display: base, quote: normalizedQuote };
  }

  return { display: `${base}/${normalizedQuote}`, quote: normalizedQuote };
}

function normalizeTrade(raw: any): Trade {
  const { display, quote } = buildSymbol(raw?.symbol, raw?.quote);
  const created = toTimestamp(raw?.created_at ?? raw?.createdAt) ?? Date.now();

  const rawSide = String(raw?.side ?? '').toUpperCase();
  const side: TradeSide = rawSide === TradeSide.SHORT ? TradeSide.SHORT : TradeSide.LONG;

  const rawStatus = String(raw?.status ?? '').toUpperCase();
  let status: TradeStatus;
  if (rawStatus === TradeStatus.OPEN || rawStatus === TradeStatus.CLOSED) {
    status = rawStatus as TradeStatus;
  } else {
    status = TradeStatus.PENDING;
  }

  return {
    id: Number(raw?.id ?? 0),
    symbol: display || String(raw?.symbol ?? ''),
    quote,
    side,
    status,
    entry_price: toNumber(raw?.entry_price ?? raw?.entryPrice, 0) ?? 0,
    exit_price: toNumber(raw?.exit_price ?? raw?.exitPrice, null),
    tp_price: toNumber(raw?.tp_price ?? raw?.tpPrice, null),
    sl_price: toNumber(raw?.sl_price ?? raw?.slPrice, null),
    quantity: toNumber(raw?.quantity ?? raw?.qty, null),
    opened_at: toTimestamp(raw?.opened_at ?? raw?.openedAt),
    entry_hit_at: toTimestamp(raw?.entry_hit_at ?? raw?.entryHitAt),
    closed_at: toTimestamp(raw?.closed_at ?? raw?.closedAt),
    pnl_pct: toNumber(
      raw?.pnl_pct ?? raw?.pnl_realized_pct ?? raw?.pnlRealizedPct ?? raw?.pnlRealized_pct,
      null,
    ),
    post_url: raw?.post_url ?? raw?.postUrl ?? null,
    unrealized_pnl_pct: toNumber(
      raw?.unrealized_pnl_pct ?? raw?.pnl_unrealized_pct ?? raw?.pnlUnrealizedPct,
      null,
    ),
    created_at: created,
    updated_at: toTimestamp(raw?.updated_at ?? raw?.updatedAt) ?? created,
    userId: typeof raw?.userId === 'number' ? raw.userId : undefined,
  };
}

function normalizeTrades(raw: any): Trade[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && Array.isArray(raw.trades)
      ? raw.trades
      : [];
  return list.map(normalizeTrade);
}

function normalizeOhlcvPoint(raw: any): OhlcvDataPoint {
  const time = toTimestamp(raw?.time);
  return {
    time: time ?? Date.now(),
    open: toNumber(raw?.open, 0) ?? 0,
    high: toNumber(raw?.high, 0) ?? 0,
    low: toNumber(raw?.low, 0) ?? 0,
    close: toNumber(raw?.close, 0) ?? 0,
  };
}

function normalizeOhlcvResponse(raw: any): OhlcvResponse {
  const dataArray = Array.isArray(raw?.data)
    ? raw.data
    : Array.isArray(raw)
      ? raw
      : [];

  return {
    symbol: typeof raw?.symbol === 'string' ? raw.symbol : '',
    tf: typeof raw?.tf === 'string' ? raw.tf : '1h',
    data: dataArray.map(normalizeOhlcvPoint),
  };
}

function normalizePnlData(raw: any): PnlDataPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const time = toTimestamp(item?.time);
      const value = toNumber(item?.cumulativePnl ?? item?.cumulative_pnl, null);
      if (time === null || value === null) return null;
      return { time, cumulativePnl: value };
    })
    .filter(Boolean) as PnlDataPoint[];
}

function normalizeReport(raw: any): ReportSummary {
  const open = Number(raw?.totals?.open ?? 0) || 0;
  const pending = Number(raw?.totals?.pending ?? 0) || 0;
  const closed = Number(raw?.totals?.closed ?? 0) || 0;
  const pnl = Number(raw?.pnl_realized_pct_sum ?? 0) || 0;

  return {
    totals: { open, pending, closed },
    pnl_realized_pct_sum: pnl,
  };
}

// --- Low level request helper ----------------------------------------------
async function request(
  path: string,
  options: RequestInit = {},
  opts?: { forceAuth?: boolean; token?: string | null }
) {
  const url = `${API_BASE}${path}`;
  const needAuth = !!opts?.forceAuth;
  const explicitToken = opts?.token ?? null;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };

  // Attach bearer only if we have it OR if the call explicitly passed one
  // via options.headers; for public GETs we stay anonymous.
  if (!headers.Authorization) {
    if (explicitToken) {
      headers.Authorization = `Bearer ${explicitToken}`;
    } else if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
  }

  if (needAuth && !headers.Authorization) {
    throw new Error('Missing auth token');
  }

  const res = await fetch(url, { ...options, headers });

  // Try to parse json; if not JSON, still throw a useful error
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `API error: ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

// --- Auth -------------------------------------------------------------------
export async function requestAuthChallenge(address: string, chainId: number) {
  return request('/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ address, chainId }),
  });
}

export interface VerifyAuthResponse {
  token: string;
  user: {
    id: number;
    address: string;
    isAdmin: boolean;
    chainId?: number;
  };
}

export async function verifyAuth(message: string, signature: string): Promise<VerifyAuthResponse> {
  return request('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ message, signature }),
  });
}

// --- Trades (READ = public) -------------------------------------------------

export interface FetchTradesParams {
  statuses?: string[];
  page?: number;
  limit?: number;
  token?: string | null;
}

export async function fetchTrades(params: FetchTradesParams = {}): Promise<Trade[]> {
  const { statuses = [], page = 1, limit = 20, token = null } = params;
  const qs = new URLSearchParams();
  if (statuses.length) qs.set('statuses', statuses.join(','));
  qs.set('page', String(page));
  qs.set('limit', String(limit));

  const raw = await request(`/trades?${qs.toString()}`, { method: 'GET' }, { token });
  return normalizeTrades(raw);
}

export const getTrades = fetchTrades;

export interface FetchOhlcvOptions {
  timeframe?: string;
  token?: string | null;
}

export async function fetchOhlcv(tradeId: number, options: FetchOhlcvOptions = {}): Promise<OhlcvResponse> {
  const { timeframe, token = null } = options;
  const qs = timeframe ? `?tf=${encodeURIComponent(timeframe)}` : '';
  const raw = await request(`/trades/${tradeId}/ohlcv${qs}`, { method: 'GET' }, { token });
  return normalizeOhlcvResponse(raw);
}

export async function fetchPnlData(token?: string | null): Promise<PnlDataPoint[]> {
  const raw = await request('/pnl', { method: 'GET' }, { token });
  return normalizePnlData(raw);
}

export async function fetchReports(window?: string, token?: string | null): Promise<ReportSummary> {
  const qs = window ? `?window=${encodeURIComponent(window)}` : '';
  const raw = await request(`/reports${qs}`, { method: 'GET' }, { token });
  return normalizeReport(raw);
}

// --- Trades (WRITE = auth) --------------------------------------------------

export interface AddTradePayload {
  symbol: string;
  side: TradeSide | 'LONG' | 'SHORT';
  entry_price: number;
  tp_price: number;
  sl_price: number;
  quantity?: number;
  post_url?: string;
  opened_at?: string;
  status?: string;
}

export async function addTrade(payload: AddTradePayload, token?: string | null) {
  return request(
    '/trades',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { forceAuth: true, token }
  );
}

interface CloseTradeOptions {
  token?: string | null;
  action?: 'close' | 'remove';
  exitPrice?: number;
  realizedPct?: number;
}

export async function closeTrade(id: number, options: CloseTradeOptions = {}) {
  const { token = null, action, exitPrice, realizedPct } = options;
  const body: Record<string, unknown> = {};
  if (action === 'remove') body.action = 'remove';
  if (typeof exitPrice === 'number') body.exit_price = exitPrice;
  if (typeof realizedPct === 'number') body.pnl_realized_pct = realizedPct;

  return request(
    `/trades/${id}/close`,
    {
      method: 'POST',
      body: Object.keys(body).length ? JSON.stringify(body) : undefined,
    },
    { forceAuth: true, token }
  );
}

export async function removeTrade(id: number, token?: string | null) {
  return closeTrade(id, { token, action: 'remove' });
}

export async function closeAllTrades(token?: string | null) {
  return request(
    '/trades/close-all',
    { method: 'POST' },
    { forceAuth: true, token }
  );
}

export async function resetDatabase(token?: string | null) {
  return request(
    '/database/reset',
    { method: 'POST' },
    { forceAuth: true, token }
  );
}

export async function fetchCurrentPrice(symbol: string, quote: string = DEFAULT_QUOTE): Promise<number> {
  const base = symbol.trim().toUpperCase();
  if (!base) throw new Error('Ticker is required');

  const params = new URLSearchParams({ fsym: base, tsyms: quote });
  const headers: Record<string, string> = {};
  const apiKey = (typeof import.meta !== 'undefined' && import.meta.env && (import.meta.env as any).VITE_CRYPTOCOMPARE_API_KEY) || '';
  if (apiKey) {
    headers.Authorization = `Apikey ${apiKey}`;
  }

  const resp = await fetch(`https://min-api.cryptocompare.com/data/price?${params.toString()}`, {
    headers,
  });
  if (!resp.ok) {
    throw new Error('Failed to fetch price');
  }
  const data = await resp.json();
  const value = toNumber(data?.[quote], null);
  if (value === null) {
    throw new Error('Ticker not found');
  }
  return value;
}

// --- Realtime ---------------------------------------------------------------

/**
 * Subscribe to trade updates over WS.
 * Accepts (onUpdate, token?) — token is optional; if omitted and you called
 * setAuthToken() on login, it will be taken from there.
 */
export function subscribeToTradeUpdates(
  onUpdate: (trades: Trade[]) => void,
  token?: string
) {
  const base = API_BASE.replace(/\/api$/, '');
  const wsUrl = base.replace(/^http/, 'ws') + '/ws';

  // Pass token via subprotocol if present
  const protocols = token ? [token] : authToken ? [authToken] : [];
  const ws = new WebSocket(wsUrl, protocols);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data?.type === 'tradeUpdate') {
        onUpdate(normalizeTrades(data.payload));
      }
    } catch (e) {
      console.error('WS parse error', e);
    }
  };

  return () => ws.close();
}
