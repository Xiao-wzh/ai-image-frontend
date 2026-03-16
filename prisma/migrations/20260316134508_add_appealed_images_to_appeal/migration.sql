-- AlterTable
ALTER TABLE "Appeal" ADD COLUMN     "appealedImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
