-- DropIndex
DROP INDEX "ProductTypePrompt_platformId_productType_taskType_idx";

-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "features" TEXT,
ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'CREATIVE',
ADD COLUMN     "refImages" TEXT[];

-- AlterTable
ALTER TABLE "ProductTypePrompt" ADD COLUMN     "mode" TEXT NOT NULL DEFAULT 'CREATIVE';

-- CreateIndex
CREATE INDEX "ProductTypePrompt_platformId_productType_taskType_mode_idx" ON "ProductTypePrompt"("platformId", "productType", "taskType", "mode");
