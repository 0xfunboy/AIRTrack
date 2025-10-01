-- Create initial schema for SQLite
CREATE TABLE "users" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "username" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "isAdmin" INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX "users_username_key" ON "users" ("username");

CREATE TABLE "trades" (
  "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  "symbol" TEXT NOT NULL,
  "quote" TEXT NOT NULL DEFAULT 'USDT',
  "side" TEXT NOT NULL DEFAULT 'LONG',
  "entry_price" REAL NOT NULL DEFAULT 0,
  "tp_price" REAL NOT NULL DEFAULT 0,
  "sl_price" REAL NOT NULL DEFAULT 0,
  "quantity" REAL NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "opened_at" DATETIME,
  "entry_hit_at" DATETIME,
  "closed_at" DATETIME,
  "post_url" TEXT,
  "pnl_unrealized_pct" REAL NOT NULL DEFAULT 0,
  "pnl_realized_pct" REAL NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" INTEGER NOT NULL,
  CONSTRAINT "trades_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "trades_status_symbol_idx" ON "trades" ("status", "symbol");
CREATE INDEX "trades_createdAt_idx" ON "trades" ("createdAt");
