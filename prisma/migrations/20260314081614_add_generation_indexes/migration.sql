-- CreateIndex
CREATE INDEX "Generation_userId_createdAt_idx" ON "Generation"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Generation_userId_status_idx" ON "Generation"("userId", "status");

-- CreateIndex
CREATE INDEX "Generation_status_idx" ON "Generation"("status");
