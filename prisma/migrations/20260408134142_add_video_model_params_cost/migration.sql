-- AlterTable
ALTER TABLE "VideoGeneration" ADD COLUMN     "costPerSecond" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hasRefunded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "modelParams" JSONB;
