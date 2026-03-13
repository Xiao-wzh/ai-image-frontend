-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityTier" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "tierLevel" INTEGER NOT NULL,
    "conditions" JSONB NOT NULL,
    "rewards" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityReferral" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "rechargeAmount" INTEGER NOT NULL,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualLeaderboard" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "fakeName" TEXT NOT NULL,
    "fakeAvatar" TEXT,
    "fakeAmount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualLeaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Activity_isActive_startTime_endTime_idx" ON "Activity"("isActive", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "ActivityTier_activityId_tierLevel_idx" ON "ActivityTier"("activityId", "tierLevel");

-- CreateIndex
CREATE INDEX "ActivityReferral_activityId_inviterId_idx" ON "ActivityReferral"("activityId", "inviterId");

-- CreateIndex
CREATE INDEX "ActivityReferral_inviteeId_idx" ON "ActivityReferral"("inviteeId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityReferral_activityId_orderId_key" ON "ActivityReferral"("activityId", "orderId");

-- CreateIndex
CREATE INDEX "VirtualLeaderboard_activityId_fakeAmount_idx" ON "VirtualLeaderboard"("activityId", "fakeAmount");

-- AddForeignKey
ALTER TABLE "ActivityTier" ADD CONSTRAINT "ActivityTier_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReferral" ADD CONSTRAINT "ActivityReferral_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReferral" ADD CONSTRAINT "ActivityReferral_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReferral" ADD CONSTRAINT "ActivityReferral_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VirtualLeaderboard" ADD CONSTRAINT "VirtualLeaderboard_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
