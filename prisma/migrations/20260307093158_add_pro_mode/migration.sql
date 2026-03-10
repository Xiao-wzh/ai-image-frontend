/*
  Warnings:

  - A unique constraint covering the columns `[productType,taskType,mode,qualityMode,userId]` on the table `ProductTypePrompt` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "ProductTypePrompt_platformId_productType_taskType_mode_idx";

-- DropIndex
DROP INDEX "ProductTypePrompt_productType_taskType_mode_userId_key";

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "aspectRatio" TEXT NOT NULL DEFAULT '1:1',
ADD COLUMN     "costPerImage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "imageCount" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN     "qualityMode" TEXT NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "refundAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalCost" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProductTypePrompt" ADD COLUMN     "qualityMode" TEXT NOT NULL DEFAULT 'STANDARD';

-- CreateIndex
CREATE INDEX "ProductTypePrompt_platformId_productType_taskType_mode_qual_idx" ON "ProductTypePrompt"("platformId", "productType", "taskType", "mode", "qualityMode");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypePrompt_productType_taskType_mode_qualityMode_use_key" ON "ProductTypePrompt"("productType", "taskType", "mode", "qualityMode", "userId");
