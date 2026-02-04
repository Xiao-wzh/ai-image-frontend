-- CreateEnum
CREATE TYPE "PlanType" AS ENUM ('CREDIT', 'SUBSCRIPTION');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "planId" TEXT,
ADD COLUMN     "snapshot" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isVIP" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "vipLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "vipValidUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "PlanType" NOT NULL DEFAULT 'CREDIT',
    "price" INTEGER NOT NULL,
    "originalPrice" INTEGER,
    "credits" INTEGER NOT NULL DEFAULT 0,
    "giftCredits" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isRecommend" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_type_idx" ON "Plan"("type");

-- CreateIndex
CREATE INDEX "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE INDEX "Plan_sortOrder_idx" ON "Plan"("sortOrder");

-- CreateIndex
CREATE INDEX "Order_planId_idx" ON "Order"("planId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
