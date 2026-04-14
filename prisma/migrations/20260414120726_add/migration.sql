-- CreateTable
CREATE TABLE "DailyAnalytics" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "newUsers" INTEGER NOT NULL DEFAULT 0,
    "activeUsers" INTEGER NOT NULL DEFAULT 0,
    "genCompleted" INTEGER NOT NULL DEFAULT 0,
    "genFailed" INTEGER NOT NULL DEFAULT 0,
    "genPartial" INTEGER NOT NULL DEFAULT 0,
    "genPending" INTEGER NOT NULL DEFAULT 0,
    "revenue" INTEGER NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "paidUsers" INTEGER NOT NULL DEFAULT 0,
    "videoCount" INTEGER NOT NULL DEFAULT 0,
    "videoCompleted" INTEGER NOT NULL DEFAULT 0,
    "videoCost" INTEGER NOT NULL DEFAULT 0,
    "genByStatus" JSONB NOT NULL DEFAULT '{}',
    "genByPlatform" JSONB NOT NULL DEFAULT '{}',
    "genByType" JSONB NOT NULL DEFAULT '{}',
    "genByHour" JSONB NOT NULL DEFAULT '{}',
    "planSales" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyAnalytics_date_key" ON "DailyAnalytics"("date");

-- CreateIndex
CREATE INDEX "DailyAnalytics_date_idx" ON "DailyAnalytics"("date");
