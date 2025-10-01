// server.js
// Production backend for AIRTrack: REST API + WS + background worker.
// Matches the original mock data shape (snake_case) so the React frontend renders properly.

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { WebSocketServer } from 'ws';
import { PrismaClient } from '@prisma/client';
import { SiweMessage } from 'siwe';
import { getAddress } from 'ethers';

// ---------- Init ----------
const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

const PORT = Number(process.env.PORT || 5883);
const WS_PORT = Number(process.env.WS_PORT || PORT); // can share same server
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY || process.env.CRYPTOCOMPARE_API || process.env.CRYPTOCOMPARE || '';
const ADMIN_WALLETS = new Set(
  (process.env.ADMIN_WALLETS || '')
    .split(/[;,\s]+/)
    .map((addr) => addr.trim().toLowerCase())
    .filter(Boolean)
);

app.use(cors());
app.use(express.json());

// Static (dist) paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

// ---------- Helpers: normalize & map DB -> client (snake_case) ----------
const U = {
  // status/side always UPPERCASE to match FE enums
  status: (s) => String(s || '').trim().toUpperCase(),
  side: (s) => String(s || '').trim().toUpperCase(),
  num: (v, d = 0) => (v === null || v === undefined || Number.isNaN(Number(v)) ? d : Number(v)),
  iso: (d) => (d ? new Date(d).toISOString() : null),
};

const NONCE_STORE = new Map();
const NONCE_TTL_MS = 5 * 60 * 1000;

function createNonce(address) {
  const nonce = crypto.randomBytes(16).toString('hex');
  NONCE_STORE.set(nonce, {
    address: address.toLowerCase(),
    expires: Date.now() + NONCE_TTL_MS,
  });
  return nonce;
}

function consumeNonce(nonce, address) {
  const entry = NONCE_STORE.get(nonce);
  if (!entry) return false;
  NONCE_STORE.delete(nonce);
  if (entry.expires < Date.now()) return false;
  return entry.address === address.toLowerCase();
}

function pruneNonces() {
  const now = Date.now();
  for (const [nonce, entry] of NONCE_STORE.entries()) {
    if (entry.expires < now) {
      NONCE_STORE.delete(nonce);
    }
  }
}

function getHost(req) {
  return req.get('host') || 'localhost';
}

function getOrigin(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  return `${proto}://${getHost(req)}`;
}

function toClientTrade(t) {
  if (!t) return t;
  return {
    id: t.id,
    symbol: t.symbol,                         // ticker only (e.g. "BTC")
    quote: t.quote || 'USDT',
    side: U.side(t.side),                     // "LONG" | "SHORT"
    entry_price: U.num(t.entry_price ?? t.price),
    tp_price: U.num(t.tp_price),
    sl_price: U.num(t.sl_price),
    quantity: U.num(t.quantity),
    status: U.status(t.status),               // "PENDING" | "OPEN" | "CLOSED"
    opened_at: U.iso(t.opened_at),
    entry_hit_at: U.iso(t.entry_hit_at),
    closed_at: U.iso(t.closed_at),
    post_url: t.post_url || null,
    pnl_unrealized_pct: U.num(t.pnl_unrealized_pct),
    pnl_realized_pct: U.num(t.pnl_realized_pct),
    created_at: U.iso(t.createdAt),
    updated_at: U.iso(t.updatedAt),
    userId: t.userId,
  };
}
const toClientTrades = (rows) => rows.map(toClientTrade);

function ensureAdminFlag(address, fallback = false) {
  if (!address) return fallback;
  return ADMIN_WALLETS.has(address.toLowerCase());
}

// ---------- Auth middleware ----------
function authMiddleware(req, res, next) {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = {
      id: payload.id,
      address: payload.address,
      isAdmin: !!payload.isAdmin,
    };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function requireAdmin(req, res) {
  if (!req.user?.isAdmin) {
    res.status(403).json({ error: 'Admin privileges required' });
    return false;
  }
  return true;
}

// ---------- Auth routes ----------
app.post('/api/auth/challenge', async (req, res) => {
  try {
    pruneNonces();
    const { address, chainId } = req.body || {};
    if (!address || !chainId) {
      return res.status(400).json({ error: 'address and chainId required' });
    }

    let checksumAddress;
    try {
      checksumAddress = getAddress(address);
    } catch {
      return res.status(400).json({ error: 'Invalid address' });
    }

    const lower = checksumAddress.toLowerCase();
    const nonce = createNonce(lower);
    const siweMessage = new SiweMessage({
      domain: getHost(req),
      address: checksumAddress,
      statement: 'Sign in to AIRTrack.',
      uri: getOrigin(req),
      version: '1',
      chainId: Number(chainId),
      nonce,
    });

    res.json({ message: siweMessage.prepareMessage() });
  } catch (e) {
    console.error('AUTH challenge error:', e);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

app.post('/api/auth/verify', async (req, res) => {
  try {
    pruneNonces();
    const { message, signature } = req.body || {};
    if (!message || !signature) {
      return res.status(400).json({ error: 'message and signature required' });
    }

    const siweMessage = new SiweMessage(message);
    const { nonce, address, chainId } = siweMessage;

    if (!nonce || !address) {
      return res.status(400).json({ error: 'Invalid SIWE payload' });
    }

    let checksumAddress;
    try {
      checksumAddress = getAddress(address);
    } catch {
      return res.status(400).json({ error: 'Invalid address in SIWE message' });
    }

    const addressLower = checksumAddress.toLowerCase();
    if (!consumeNonce(nonce, addressLower)) {
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

    let user = await prisma.user.findUnique({ where: { username: addressLower } });
    const isAdmin = ensureAdminFlag(addressLower, false);

    if (!user) {
      const placeholderHash = await bcrypt.hash(addressLower, 10);
      user = await prisma.user.create({
        data: {
          username: addressLower,
          password: placeholderHash,
          isAdmin,
        },
      });
    } else if (user.isAdmin !== isAdmin) {
      user = await prisma.user.update({ where: { id: user.id }, data: { isAdmin } });
    }

    const token = jwt.sign(
      { id: user.id, address: checksumAddress, isAdmin },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        address: checksumAddress,
        isAdmin,
        chainId: Number(chainId),
      },
    });
  } catch (e) {
    console.error('AUTH verify error:', e);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// ---------- Trades API ----------
app.get('/api/trades', async (req, res) => {
  try {
    // FE calls this without token → keep it public
    const { statuses, page = 1, limit = 20 } = req.query;
    const where = {};

    if (statuses) {
      const list = String(statuses)
        .split(',')
        .map((s) => U.status(s))
        .filter(Boolean);
      if (list.length) where.status = { in: list };
    }

    const take = Math.max(1, Number(limit) || 20);
    const skip = (Math.max(1, Number(page) || 1) - 1) * take;

    const rows = await prisma.trade.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    res.json(toClientTrades(rows));
  } catch (e) {
    console.error('GET /api/trades error:', e);
    res.status(500).json({ error: 'Failed to fetch trades' });
  }
});

app.post('/api/trades', authMiddleware, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const {
      symbol, side, entry_price, tp_price, sl_price,
      quantity, post_url, opened_at, status = 'PENDING',
    } = req.body || {};

    if (!symbol || !side || entry_price == null || tp_price == null || sl_price == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const created = await prisma.trade.create({
      data: {
        symbol: String(symbol).toUpperCase(),   // ticker only
        quote: 'USDT',
        side: U.side(side),
        entry_price: U.num(entry_price),
        tp_price: U.num(tp_price),
        sl_price: U.num(sl_price),
        quantity: U.num(quantity),
        post_url: post_url || null,
        opened_at: opened_at ? new Date(opened_at) : null,
        status: U.status(status),
        userId: req.user.id,
      },
    });

    broadcastActiveTrades(); // push update to clients
    res.status(201).json(toClientTrade(created));
  } catch (e) {
    console.error('POST /api/trades error:', e);
    res.status(500).json({ error: 'Failed to create trade' });
  }
});

app.post('/api/trades/:id/close', authMiddleware, async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const id = Number(req.params.id);
    const was = await prisma.trade.findUnique({ where: { id } });
    if (!was) return res.status(404).json({ error: 'Not found' });

    const action = (req.body?.action || '').toString().toLowerCase();
    if (action === 'remove') {
      if (was.status !== 'PENDING') {
        return res.status(400).json({ error: 'Only pending trades can be removed' });
      }

      await prisma.trade.delete({ where: { id } });
      await broadcastActiveTrades();
      return res.json({ status: 'removed', id });
    }

    const now = await prisma.trade.update({
      where: { id },
      data: {
        status: 'CLOSED',
        closed_at: new Date(),
        pnl_unrealized_pct: 0,
        // Keep pnl_realized_pct as-is (or compute if you want)
      },
    });

    broadcastActiveTrades();
    res.json(toClientTrade(now));
  } catch (e) {
    console.error('POST /api/trades/:id/close error:', e);
    res.status(500).json({ error: 'Failed to close trade' });
  }
});

app.post('/api/trades/close-all', authMiddleware, async (_req, res) => {
  if (!requireAdmin(_req, res)) return;
  try {
    const [closedOpen, removedPending] = await prisma.$transaction([
      prisma.trade.updateMany({
        where: { status: 'OPEN' },
        data: { status: 'CLOSED', closed_at: new Date(), pnl_unrealized_pct: 0 },
      }),
      prisma.trade.deleteMany({ where: { status: 'PENDING' } }),
    ]);

    await broadcastActiveTrades();
    res.json({ closedCount: closedOpen.count, removedPending: removedPending.count });
  } catch (e) {
    console.error('POST /api/trades/close-all error:', e);
    res.status(500).json({ error: 'Failed to close all' });
  }
});

app.post('/api/database/reset', authMiddleware, async (_req, res) => {
  if (!requireAdmin(_req, res)) return;
  try {
    await prisma.$transaction([
      prisma.trade.deleteMany({}),
    ]);
    await broadcastActiveTrades();
    res.json({ reset: true });
  } catch (e) {
    console.error('POST /api/database/reset error:', e);
    res.status(500).json({ error: 'Failed to reset database' });
  }
});

// ---------- OHLCV & Reports ----------
app.get('/api/trades/:id/ohlcv', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const t = await prisma.trade.findUnique({ where: { id } });
    if (!t) return res.status(404).json({ error: 'Not found' });

    // CryptoCompare minute candles (limit ~ 120) — FE expects [{time, open, high, low, close, volume}]
    // NOTE: Node 18+ has global fetch.
    const symbol = `${t.symbol}USDT`; // pair for the provider
    let out = [];
    try {
      const url = `https://min-api.cryptocompare.com/data/v2/histominute?fsym=${encodeURIComponent(t.symbol)}&tsym=USDT&limit=120`;
      const r = await fetch(url, {
        headers: CRYPTOCOMPARE_API_KEY ? { Authorization: `Apikey ${CRYPTOCOMPARE_API_KEY}` } : {},
      });
      const j = await r.json();
      if (j?.Data?.Data) {
        out = j.Data.Data.map((d) => ({
          time: d.time * 1000,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: d.volumefrom ?? d.volumeto ?? 0,
        }));
      }
    } catch (_) {
      // Fallback synthetic (shouldn't happen normally)
      const now = Date.now();
      for (let i = 0; i < 60; i++) {
        const base = 100 + i * 0.2;
        out.push({
          time: now - (60 - i) * 60_000,
          open: base,
          high: base + 0.5,
          low: base - 0.5,
          close: base + 0.1,
          volume: 10 + i,
        });
      }
    }

    res.json(out);
  } catch (e) {
    console.error('GET /api/trades/:id/ohlcv error:', e);
    res.status(500).json({ error: 'Failed to fetch ohlcv' });
  }
});

app.get('/api/pnl', async (_req, res) => {
  try {
    const trades = await prisma.trade.findMany();
    // Simple cumulative PnL % over time using createdAt
    const points = [];
    let cum = 0;
    const sorted = trades.sort((a, b) => a.createdAt - b.createdAt);
    for (const t of sorted) {
      cum += U.num(t.pnl_realized_pct);
      points.push({ time: U.iso(t.createdAt), cumulativePnl: cum });
    }
    if (!points.length) {
      const now = new Date();
      points.push({ time: U.iso(now), cumulativePnl: 0 });
    }
    res.json(points);
  } catch (e) {
    console.error('GET /api/pnl error:', e);
    res.status(500).json({ error: 'Failed to fetch pnl' });
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
    res.json({
      totals: { open, pending, closed },
      pnl_realized_pct_sum: U.num(realized._sum.pnl_realized_pct),
    });
  } catch (e) {
    console.error('GET /api/reports error:', e);
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ---------- WebSocket (share same HTTP server) ----------
const wss = new WebSocketServer({ server, path: '/ws' });
// Keep a simple set of live sockets
const sockets = new Set();

wss.on('connection', (ws, req) => {
  // optional auth via Sec-WebSocket-Protocol (subprotocol) = token
  const protos = req.headers['sec-websocket-protocol'];
  if (protos) {
    try {
      const token = Array.isArray(protos) ? protos[0] : protos;
      jwt.verify(token, JWT_SECRET);
    } catch (_) {
      // If invalid, you could ws.close(); but we keep it open for read-only clients
    }
  }

  sockets.add(ws);
  ws.on('close', () => sockets.delete(ws));
});

async function broadcastActiveTrades() {
  try {
    const rows = await prisma.trade.findMany({
      where: { status: { in: ['OPEN', 'PENDING'] } },
      orderBy: { createdAt: 'desc' },
    });
    const payload = JSON.stringify({ type: 'tradeUpdate', payload: toClientTrades(rows) });
    for (const ws of sockets) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  } catch (e) {
    console.error('broadcastActiveTrades error:', e);
  }
}

// ---------- Worker loop (every minute) ----------
const POLL_MS = 60_000;

async function getSpotPrice(ticker = 'BTC', quote = 'USDT') {
  // Use CC aggregate price endpoint
  try {
    const url = `https://min-api.cryptocompare.com/data/price?fsym=${encodeURIComponent(ticker)}&tsyms=${quote}`;
    const r = await fetch(url, {
      headers: CRYPTOCOMPARE_API_KEY ? { Authorization: `Apikey ${CRYPTOCOMPARE_API_KEY}` } : {},
    });
    const j = await r.json();
    const val = j?.[quote];
    return U.num(val, NaN);
  } catch {
    return NaN;
  }
}

async function workerTick() {
  try {
    // 1) Promote PENDING → OPEN if price crosses entry
    const pendings = await prisma.trade.findMany({ where: { status: 'PENDING' } });
    for (const t of pendings) {
      const price = await getSpotPrice(t.symbol, t.quote || 'USDT');
      if (Number.isNaN(price)) continue;

      const crossed =
        (U.side(t.side) === 'LONG' && price >= U.num(t.entry_price)) ||
        (U.side(t.side) === 'SHORT' && price <= U.num(t.entry_price));

      if (crossed) {
        await prisma.trade.update({
          where: { id: t.id },
          data: { status: 'OPEN', entry_hit_at: new Date() },
        });
      }
    }

    // 2) For OPEN trades, update unrealized PnL and close on TP/SL
    const opens = await prisma.trade.findMany({ where: { status: 'OPEN' } });
    for (const t of opens) {
      const price = await getSpotPrice(t.symbol, t.quote || 'USDT');
      if (Number.isNaN(price)) continue;

      const entry = U.num(t.entry_price);
      const tp = U.num(t.tp_price);
      const sl = U.num(t.sl_price);

      // unrealized %
      let unreal = 0;
      if (U.side(t.side) === 'LONG') {
        unreal = ((price - entry) / entry) * 100;
      } else {
        unreal = ((entry - price) / entry) * 100;
      }

      // tp/sl hit?
      let closeNow = false;
      let realized = U.num(t.pnl_realized_pct);

      if (U.side(t.side) === 'LONG') {
        if (price >= tp) { realized += ((tp - entry) / entry) * 100; closeNow = true; }
        if (price <= sl) { realized += ((sl - entry) / entry) * 100; closeNow = true; }
      } else {
        if (price <= tp) { realized += ((entry - tp) / entry) * 100; closeNow = true; }
        if (price >= sl) { realized += ((entry - sl) / entry) * 100; closeNow = true; }
      }

      if (closeNow) {
        await prisma.trade.update({
          where: { id: t.id },
          data: { status: 'CLOSED', closed_at: new Date(), pnl_unrealized_pct: 0, pnl_realized_pct: realized },
        });
      } else {
        await prisma.trade.update({
          where: { id: t.id },
          data: { pnl_unrealized_pct: unreal },
        });
      }
    }

    // 3) Broadcast updates (active trades set changed)
    await broadcastActiveTrades();
  } catch (e) {
    console.error('Worker error:', e);
  }
}

setInterval(workerTick, POLL_MS);
console.log('⏰ Worker running: checking trades...');

// ---------- Static & catch-all (Express 5 safe) ----------
app.use(express.static(DIST_DIR));

// IMPORTANT: Express 5 does not accept '*' path string; use a RegExp
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'));
});

// ---------- Start ----------
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
