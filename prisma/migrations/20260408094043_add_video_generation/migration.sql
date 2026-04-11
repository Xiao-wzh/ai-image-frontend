-- CreateTable
CREATE TABLE "VideoGeneration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "seconds" INTEGER NOT NULL DEFAULT 10,
    "size" TEXT NOT NULL DEFAULT '720x1280',
    "referenceImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "videoUrl" TEXT,
    "errorMsg" TEXT,
    "cost" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "VideoGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VideoGeneration_taskId_key" ON "VideoGeneration"("taskId");

-- CreateIndex
CREATE INDEX "VideoGeneration_userId_idx" ON "VideoGeneration"("userId");

-- CreateIndex
CREATE INDEX "VideoGeneration_status_idx" ON "VideoGeneration"("status");

-- CreateIndex
CREATE INDEX "VideoGeneration_taskId_idx" ON "VideoGeneration"("taskId");

-- CreateIndex
CREATE INDEX "VideoGeneration_createdAt_idx" ON "VideoGeneration"("createdAt");

-- AddForeignKey
ALTER TABLE "VideoGeneration" ADD CONSTRAINT "VideoGeneration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
