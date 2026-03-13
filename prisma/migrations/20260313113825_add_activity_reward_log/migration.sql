-- CreateTable
CREATE TABLE "ActivityRewardLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "rewardCredits" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRewardLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityRewardLog_activityId_idx" ON "ActivityRewardLog"("activityId");

-- CreateIndex
CREATE INDEX "ActivityRewardLog_userId_idx" ON "ActivityRewardLog"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRewardLog_userId_activityId_tierId_key" ON "ActivityRewardLog"("userId", "activityId", "tierId");

-- AddForeignKey
ALTER TABLE "ActivityRewardLog" ADD CONSTRAINT "ActivityRewardLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRewardLog" ADD CONSTRAINT "ActivityRewardLog_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRewardLog" ADD CONSTRAINT "ActivityRewardLog_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "ActivityTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
