-- AlterTable
ALTER TABLE "Appeal" ADD COLUMN     "aiAnalysis" TEXT,
ADD COLUMN     "aiConfidence" DOUBLE PRECISION,
ADD COLUMN     "reviewedBy" TEXT NOT NULL DEFAULT 'AI';
