-- DropIndex
DROP INDEX "ProductTypePrompt_platformId_productType_idx";

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "taskType" TEXT NOT NULL DEFAULT 'MAIN_IMAGE';

-- AlterTable
ALTER TABLE "ProductTypePrompt" ADD COLUMN     "taskType" TEXT NOT NULL DEFAULT 'MAIN_IMAGE';

-- CreateIndex
CREATE INDEX "ProductTypePrompt_platformId_productType_taskType_idx" ON "ProductTypePrompt"("platformId", "productType", "taskType");
