import 'dotenv/config';
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'node:crypto';
import { WebSocketServer, WebSocket } from 'ws';
import { PrismaClient, Trade as TradeModel } from '@prisma/client';
import { SiweMessage } from 'siwe';
import { getAddress } from 'ethers';

const DATABASE_URL = process.env.DATABASE_URL || "file:./prisma/dev.db";
const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const PORT = Number(process.env.PORT || 5883);
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const CRYPTOCOMPARE_API_KEY =
  process.env.CRYPTOCOMPARE_API_KEY ||
  process.env.CRYPTOCOMPARE_API ||
  process.env.CRYPTOCOMPARE ||
  '';
const ADMIN_WALLETS = new Set(
  (process.env.ADMIN_WALLETS || '')
    .split(/[;,\s]+/)
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean),
);
const POLL_MS = Number(process.env.WORKER_POLL_MS || 60_000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../../dist');
const DEFAULT_TIMEFRAME = (process.env.DEFAULT_CHART_TIMEFRAME || '1h').toLowerCase();

const TIMEFRAME_SETTINGS: Record<string, { endpoint: 'histominute' | 'histohour'; aggregate: number; limit: number }> = {
  '1m': { endpoint: 'histominute', aggregate: 1, limit: 120 },
  '5m': { endpoint: 'histominute', aggregate: 5, limit: 120 },
  '15m': { endpoint: 'histominute', aggregate: 15, limit: 120 },
  '30m': { endpoint: 'histominute', aggregate: 30, limit: 120 },
  '1h': { endpoint: 'histohour', aggregate: 1, limit: 120 },
  '4h': { endpoint: 'histohour', aggregate: 4, limit: 120 },
};

const NONCE_STORE = new Map<string, { address: string; expires: number }>();
const NONCE_TTL_MS = Number(process.env.NONCE_TTL_MS || 5 * 60 * 1000);

interface JwtPayload {
  id: number;
  address: string;
  isAdmin: boolean;
}

interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

type TradeStatus = 'PENDING' | 'OPEN' | 'CLOSED';
type TradeSide = 'LONG' | 'SHORT';

const toNumber = (value: unknown, fallback = 0): number => {
  if (value === null || value === undefined) return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const toIso = (value: Date | string | null | undefined): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const normalizeStatus = (status: unknown, fallback: TradeStatus = 'PENDING'): TradeStatus => {
  const value = String(status || '').trim().toUpperCase();
  if (value === 'OPEN' || value === 'CLOSED') return value;
  return fallback;
};

const normalizeSide = (side: unknown, fallback: TradeSide = 'LONG'): TradeSide => {
  const value = String(side || '').trim().toUpperCase();
  return value === 'SHORT' ? 'SHORT' : fallback;
};

const toClientTrade = (trade: TradeModel) => ({
  id: trade.id,
  symbol: trade.symbol,
  quote: trade.quote,
  side: normalizeSide(trade.side),
  entry_price: toNumber(trade.entry_price),
  tp_price: toNumber(trade.tp_price),
  sl_price: toNumber(trade.sl_price),
  quantity: toNumber(trade.quantity),
  status: normalizeStatus(trade.status),
  opened_at: toIso(trade.opened_at),
  entry_hit_at: toIso(trade.entry_hit_at),
  closed_at: toIso(trade.closed_at),
  post_url: trade.post_url,
  pnl_unrealized_pct: toNumber(trade.pnl_unrealized_pct),
  pnl_realized_pct: toNumber(trade.pnl_realized_pct),
  created_at: toIso(trade.createdAt),
  updated_at: toIso(trade.updatedAt),
  userId: trade.userId,
});

const toClientTrades = (trades: TradeModel[]) => trades.map(toClientTrade);

const ensureAdminFlag = (address: string | null | undefined, fallback = false): boolean => {
  if (!address) return fallback;
  return ADMIN_WALLETS.has(address.toLowerCase());
};

const createNonce = (address: string): string => {
  const nonce = crypto.randomBytes(16).toString('hex');
  NONCE_STORE.set(nonce, {
    address: address.toLowerCase(),
    expires: Date.now() + NONCE_TTL_MS,
  });
  return nonce;
};

const consumeNonce = (nonce: string, address: string): boolean => {
  const entry = NONCE_STORE.get(nonce);
  if (!entry) return false;
  NONCE_STORE.delete(nonce);
  if (entry.expires < Date.now()) return false;
  return entry.address === address.toLowerCase();
};

const pruneNonces = () => {
  const now = Date.now();
  for (const [nonce, entry] of NONCE_STORE.entries()) {
    if (entry.expires < now) {
      NONCE_STORE.delete(nonce);
    }
  }
};

const getHost = (req: Request) => req.get('host') || 'localhost';

const getOrigin = (req: Request) => {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0];
  return `${proto}://${getHost(req)}`;
};

const authMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

const requireAdmin = (req: AuthenticatedRequest, res: Response): boolean => {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin privileges required' });
    return false;
  }
  return true;
};

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const sockets = new Set<WebSocket>();

app.use(cors());
app.use(express.json());

wss.on('connection', (socket, req) => {
  const protocols = req.headers['sec-websocket-protocol'];
  if (protocols) {
    try {
      const token = Array.isArray(protocols) ? protocols[0] : protocols;
      jwt.verify(token, JWT_SECRET);
    } catch (error) {
      // Keep anonymous read-only socket open even if token is invalid.
    }
  }

  sockets.add(socket);
  socket.on('close', () => sockets.delete(socket));
});

const broadcastActiveTrades = async () => {
  try {
    const trades = await prisma.trade.findMany({
      where: { status: { in: ['OPEN', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
    });
    const payload = JSON.stringify({ type: 'tradeUpdate', payload: toClientTrades(trades) });
    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      }
    }
  } catch (error) {
    console.error('broadcastActiveTrades error:', error);
  }
};

app.post('/api/auth/challenge', async (req, res) => {
  try {
    pruneNonces();
    const { address, chainId } = req.body ?? {};
    if (!address || !chainId) {
      return res.status(400).json({ error: 'address and chainId required' });
    }

    let checksumAddress: string;
    try {
      checksumAddress = getAddress(address);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const normalized = checksumAddress.toLowerCase();
    const nonce = createNonce(normalized);
    const siweMessage = new SiweMessage({
      domain: getHost(req),
      address: checksumAddress,
      statement: 'Sign in to AIRTrack.',
      uri: getOrigin(req),
      version: '1',
      chainId: Number(chainId),
      nonce,
    });

    return res.json({ message: siweMessage.prepareMessage() });
  } catch (error) {
    console.error('AUTH challenge error:', error);
    return res.status(500).json({ error: 'Failed to create challenge' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    pruneNonces();
    const { message, signature } = req.body ?? {};
    if (!message || !signature) {
      return res.status(400).json({ error: 'message and signature required' });
    }

    const siweMessage = new SiweMessage(message);
    const { nonce, address, chainId } = siweMessage;

    if (!nonce || !address) {
      return res.status(400).json({ error: 'Invalid SIWE payload' });
    }

    let checksumAddress: string;
    try {
      checksumAddress = getAddress(address);
    } catch (error) {
      return res.status(400).json({ error: 'Invalid address in SIWE message' });
    }

    const normalized = checksumAddress.toLowerCase();
    if (!consumeNonce(nonce, normalized)) {
      return res.status(401).json({ error: 'Invalid or expired nonce' });
    }

    const verification = await siweMessage.verify({
      signature,
      domain: getHost(req),
      nonce,
    });

    if (!verification.success) {
      return res.status(401).json({ error: 'Signature verification failed' });
    }

    let user = await prisma.user.findUnique({ where: { username: normalized } });
    const isAdmin = ensureAdminFlag(normalized, false);

    if (!user) {
      const placeholderHash = await bcrypt.hash(normalized, 10);
      user = await prisma.user.create({
        data: {
          username: normalized,
          password: placeholderHash,
          isAdmin,
        },
      });
    } else if (user.isAdmin !== isAdmin) {
      user = await prisma.user.update({ where: { id: user.id }, data: { isAdmin } });
    }

    const token = jwt.sign({ id: user.id, address: checksumAddress, isAdmin }, JWT_SECRET, {
      expiresIn: '24h',
    });

    return res.json({
      token,
      user: {
        id: user.id,
        address: checksumAddress,
        isAdmin,
        chainId: Number(chainId),
      },
    });
  } catch (error) {
    console.error('AUTH verify error:', error);
    return res.status(500).json({ error: 'Verification failed' });
  }
});

app.get('/api/trades', async (req, res) => {
  try {
    const { statuses, page = 1, limit = 20 } = req.query;
    const where: Record<string, unknown> = {};

    if (statuses) {
      const list = String(statuses)
        .split(',')
        .map((item) => normalizeStatus(item))
        .filter(Boolean) as TradeStatus[];
      if (list.length) {
        where.status = { in: list };
      }
    }

    const take = Math.max(1, Number(limit) || 20);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const trades = await prisma.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return res.json(toClientTrades(trades));
  } catch (error) {
    console.error('GET /api/trades error:', error);
    return res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.post('/api/trades', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const { symbol, side, entry_price, tp_price, sl_price, quantity, post_url, opened_at, status } =
      req.body ?? {};

    if (!symbol || !side || entry_price == null || tp_price == null || sl_price == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const created = await prisma.trade.create({
      data: {
        symbol: String(symbol).toUpperCase(),
        quote: 'USDT',
        side: normalizeSide(side),
        entry_price: toNumber(entry_price),
        tp_price: toNumber(tp_price),
        sl_price: toNumber(sl_price),
        quantity: toNumber(quantity ?? 0),
        post_url: post_url || null,
        opened_at: opened_at ? new Date(opened_at) : null,
        status: normalizeStatus(status),
        userId: req.user!.id,
      },
    });

    await broadcastActiveTrades();
    return res.status(201).json(toClientTrade(created));
  } catch (error) {
    console.error('POST /api/trades error:', error);
    return res.status(500).json({ error: 'Failed to create trade' });
  }
});

app.post('/api/trades/:id/close', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    const trade = await prisma.trade.findUnique({ where: { id } });
    if (!trade) {
      return res.status(404).json({ error: 'Not found' });
    }

    const action = String(req.body?.action || '').toLowerCase();
    if (action === 'remove') {
      if (trade.status !== 'PENDING') {
        return res.status(400).json({ error: 'Only pending trades can be removed' });
      }

      await prisma.trade.delete({ where: { id } });
      await broadcastActiveTrades();
      return res.json({ status: 'removed', id });
    }

    const updated = await prisma.trade.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closed_at: new Date(),
        pnl_unrealized_pct: 0,
      },
    });

    await broadcastActiveTrades();
    return res.json(toClientTrade(updated));
  } catch (error) {
    console.error('POST /api/trades/:id/close error:', error);
    return res.status(500).json({ error: 'Failed to close trade' });
  }
});

app.post('/api/trades/close-all', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const [closedOpen, removedPending] = await prisma.$transaction([
      prisma.trade.updateMany({
        where: { status: 'OPEN' },
        data: { status: 'CLOSED', closed_at: new Date(), pnl_unrealized_pct: 0 },
      }),
      prisma.trade.deleteMany({ where: { status: 'PENDING' } }),
    ]);

    await broadcastActiveTrades();
    return res.json({ closedCount: closedOpen.count, removedPending: removedPending.count });
  } catch (error) {
    console.error('POST /api/trades/close-all error:', error);
    return res.status(500).json({ error: 'Failed to close all' });
  }
});

app.post('/api/database/reset', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    await prisma.trade.deleteMany({});
    await broadcastActiveTrades();
    return res.json({ reset: true });
  } catch (error) {
    console.error('POST /api/database/reset error:', error);
    return res.status(500).json({ error: 'Failed to reset database' });
  }
});

app.get('/api/trades/:id/ohlcv', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const trade = await prisma.trade.findUnique({ where: { id } });
    if (!trade) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rawTf = Array.isArray(req.query.tf) ? req.query.tf[0] : req.query.tf;
    const normalizedTf = typeof rawTf === 'string' ? rawTf.toLowerCase() : DEFAULT_TIMEFRAME;
    const fallbackTf = TIMEFRAME_SETTINGS[DEFAULT_TIMEFRAME]
      ? DEFAULT_TIMEFRAME
      : '1h';
    const resolvedTf = TIMEFRAME_SETTINGS[normalizedTf] ? normalizedTf : fallbackTf;
    const tfConfig = TIMEFRAME_SETTINGS[resolvedTf];

    const url = new URL(`https://min-api.cryptocompare.com/data/v2/${tfConfig.endpoint}`);
    url.searchParams.set('fsym', trade.symbol);
    url.searchParams.set('tsym', trade.quote || 'USDT');
    url.searchParams.set('limit', String(tfConfig.limit));
    url.searchParams.set('aggregate', String(tfConfig.aggregate));

    const headers: Record<string, string> = {};
    if (CRYPTOCOMPARE_API_KEY) {
      headers.Authorization = `Apikey ${CRYPTOCOMPARE_API_KEY}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`CryptoCompare error: ${response.status}`);
    }

    const json = (await response.json()) as any;
    const data = Array.isArray(json?.Data?.Data) ? json.Data.Data : [];

    const out = data.map((item: any) => ({
      time: Number(item?.time || 0) * 1000,
      open: toNumber(item?.open),
      high: toNumber(item?.high),
      low: toNumber(item?.low),
      close: toNumber(item?.close),
      volume: toNumber(item?.volumefrom ?? item?.volumeto, 0),
    }));

    return res.json({
      symbol: trade.symbol,
      tf: resolvedTf,
      data: out,
    });
  } catch (error) {
    console.error('GET /api/trades/:id/ohlcv error:', error);
    return res.status(500).json({ error: 'Failed to fetch ohlcv' });
  }
});

app.get('/api/pnl', async (_req, res) => {
  try {
    const trades = await prisma.trade.findMany();
    const sorted = trades.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const points = [] as Array<{ time: string | null; cumulativePnl: number }>;
    let cumulative = 0;

    for (const trade of sorted) {
      cumulative += toNumber(trade.pnl_realized_pct, 0);
      points.push({ time: toIso(trade.createdAt), cumulativePnl: cumulative });
    }

    if (!points.length) {
      points.push({ time: toIso(new Date()), cumulativePnl: 0 });
    }

    return res.json(points);
  } catch (error) {
    console.error('GET /api/pnl error:', error);
    return res.status(500).json({ error: 'Failed to fetch pnl' });
  }
});

app.get('/api/reports', async (_req, res) => {
  try {
    const [open, pending, closed] = await Promise.all([
      prisma.trade.count({ where: { status: 'OPEN' } }),
      prisma.trade.count({ where: { status: 'PENDING' } }),
      prisma.trade.count({ where: { status: 'CLOSED' } }),
    ]);

    const realized = await prisma.trade.aggregate({
      _sum: { pnl_realized_pct: true },
    });

    return res.json({
      totals: { open, pending, closed },
      pnl_realized_pct_sum: toNumber(realized._sum.pnl_realized_pct, 0),
    });
  } catch (error) {
    console.error('GET /api/reports error:', error);
    return res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

const getSpotPrice = async (ticker = 'BTC', quote = 'USDT'): Promise<number> => {
  try {
    const url = new URL('https://min-api.cryptocompare.com/data/price');
    url.searchParams.set('fsym', ticker);
    url.searchParams.set('tsyms', quote);

    const headers: Record<string, string> = {};
    if (CRYPTOCOMPARE_API_KEY) {
      headers.Authorization = `Apikey ${CRYPTOCOMPARE_API_KEY}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`CryptoCompare error: ${response.status}`);
    }

    const json = (await response.json()) as Record<string, unknown>;
    const value = json?.[quote];
    return typeof value === 'number' ? value : Number(value ?? NaN);
  } catch (error) {
    console.error('getSpotPrice error:', error);
    return Number.NaN;
  }
};

const workerTick = async () => {
  try {
    const pendings = await prisma.trade.findMany({ where: { status: 'PENDING' } });
    for (const trade of pendings) {
      const price = await getSpotPrice(trade.symbol, trade.quote || 'USDT');
      if (Number.isNaN(price)) continue;

      const entry = toNumber(trade.entry_price);
      const shouldOpen =
        (normalizeSide(trade.side) === 'LONG' && price >= entry) ||
        (normalizeSide(trade.side) === 'SHORT' && price <= entry);

      if (shouldOpen) {
        await prisma.trade.update({
          where: { id: trade.id },
          data: { status: 'OPEN', entry_hit_at: new Date() },
        });
      }
    }

    const opens = await prisma.trade.findMany({ where: { status: 'OPEN' } });
    for (const trade of opens) {
      const price = await getSpotPrice(trade.symbol, trade.quote || 'USDT');
      if (Number.isNaN(price)) continue;

      const entry = toNumber(trade.entry_price);
      const tp = toNumber(trade.tp_price);
      const sl = toNumber(trade.sl_price);
      let unrealized = 0;

      if (normalizeSide(trade.side) === 'LONG') {
        unrealized = ((price - entry) / entry) * 100;
      } else {
        unrealized = ((entry - price) / entry) * 100;
      }

      let closeTrade = false;
      let realized = toNumber(trade.pnl_realized_pct);

      if (normalizeSide(trade.side) === 'LONG') {
        if (price >= tp) {
          realized += ((tp - entry) / entry) * 100;
          closeTrade = true;
        }
        if (price <= sl) {
          realized += ((sl - entry) / entry) * 100;
          closeTrade = true;
        }
      } else {
        if (price <= tp) {
          realized += ((entry - tp) / entry) * 100;
          closeTrade = true;
        }
        if (price >= sl) {
          realized += ((entry - sl) / entry) * 100;
          closeTrade = true;
        }
      }

      if (closeTrade) {
        await prisma.trade.update({
          where: { id: trade.id },
          data: {
            status: 'CLOSED',
            closed_at: new Date(),
            pnl_unrealized_pct: 0,
            pnl_realized_pct: realized,
          },
        });
      } else {
        await prisma.trade.update({
          where: { id: trade.id },
          data: { pnl_unrealized_pct: unrealized },
        });
      }
    }

    await broadcastActiveTrades();
  } catch (error) {
    console.error('Worker error:', error);
  }
};

setInterval(workerTick, POLL_MS);
console.log('⏰ Worker running: checking trades...');

app.use(express.static(DIST_DIR));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📦 Database: ${DATABASE_URL}`);
});
