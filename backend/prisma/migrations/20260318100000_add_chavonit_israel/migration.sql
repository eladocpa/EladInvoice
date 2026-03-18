-- CreateEnum
CREATE TYPE "AllocationStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'FAILED', 'SKIPPED');

-- AlterTable: Add chavonit israel fields to businesses
ALTER TABLE "businesses" ADD COLUMN "chavonit_client_id" TEXT;
ALTER TABLE "businesses" ADD COLUMN "chavonit_client_secret" TEXT;

-- AlterTable: Add allocation fields to documents
ALTER TABLE "documents" ADD COLUMN "allocation_number" TEXT;
ALTER TABLE "documents" ADD COLUMN "allocation_status" "AllocationStatus" NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE "documents" ADD COLUMN "allocation_requested_at" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "allocation_response_raw" JSONB;
