-- AlterTable
ALTER TABLE "ProductTypePrompt" ADD COLUMN     "referenceImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
