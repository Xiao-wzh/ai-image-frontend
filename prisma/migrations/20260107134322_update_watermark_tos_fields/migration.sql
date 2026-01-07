/*
  Warnings:

  - You are about to drop the column `posX` on the `WatermarkTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `posY` on the `WatermarkTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WatermarkTemplate" DROP COLUMN "posX",
DROP COLUMN "posY",
ADD COLUMN     "fontName" TEXT,
ADD COLUMN     "position" TEXT NOT NULL DEFAULT 'se',
ADD COLUMN     "xOffset" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "yOffset" INTEGER NOT NULL DEFAULT 10;
