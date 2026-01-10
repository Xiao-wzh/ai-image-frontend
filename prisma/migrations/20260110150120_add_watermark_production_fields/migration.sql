-- AlterTable
ALTER TABLE "WatermarkTask" ADD COLUMN     "attemptsMade" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "remoteTaskId" TEXT;
