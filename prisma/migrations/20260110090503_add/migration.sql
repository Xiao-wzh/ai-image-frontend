-- CreateTable
CREATE TABLE "WatermarkTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalUrl" TEXT NOT NULL,
    "resultUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatermarkTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatermarkTask_userId_idx" ON "WatermarkTask"("userId");

-- CreateIndex
CREATE INDEX "WatermarkTask_status_idx" ON "WatermarkTask"("status");

-- AddForeignKey
ALTER TABLE "WatermarkTask" ADD CONSTRAINT "WatermarkTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
