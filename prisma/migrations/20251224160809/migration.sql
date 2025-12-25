-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "generatedImages" TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "credits" INTEGER NOT NULL DEFAULT 500;
