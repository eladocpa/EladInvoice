-- AlterEnum
ALTER TYPE "Currency" ADD VALUE 'BTC';
ALTER TYPE "Currency" ADD VALUE 'ETH';
ALTER TYPE "Currency" ADD VALUE 'USDT';
ALTER TYPE "Currency" ADD VALUE 'USDC';

-- AlterTable
ALTER TABLE "documents" ADD COLUMN "exchange_rate" INTEGER,
ADD COLUMN "ils_total" INTEGER,
ADD COLUMN "withholding_tax_percent" INTEGER,
ADD COLUMN "withholding_tax_amount" INTEGER,
ADD COLUMN "net_after_tax" INTEGER,
ADD COLUMN "no_vat" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "payer_bank_name" TEXT,
ADD COLUMN "payer_bank_branch" TEXT,
ADD COLUMN "payer_bank_account" TEXT;
