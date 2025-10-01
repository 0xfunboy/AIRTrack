/*
  Warnings:

  - You are about to drop the column `price` on the `Trade` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Trade` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Trade" DROP COLUMN "price",
ADD COLUMN     "closed_at" TIMESTAMP(3),
ADD COLUMN     "entry_hit_at" TIMESTAMP(3),
ADD COLUMN     "entry_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "opened_at" TIMESTAMP(3),
ADD COLUMN     "pnl_realized_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "pnl_unrealized_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "post_url" TEXT,
ADD COLUMN     "quote" TEXT NOT NULL DEFAULT 'USDT',
ADD COLUMN     "side" TEXT NOT NULL DEFAULT 'LONG',
ADD COLUMN     "sl_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "tp_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "quantity" SET DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "Trade_status_symbol_idx" ON "public"."Trade"("status", "symbol");

-- CreateIndex
CREATE INDEX "Trade_createdAt_idx" ON "public"."Trade"("createdAt");
