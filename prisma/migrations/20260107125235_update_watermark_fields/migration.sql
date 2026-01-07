/*
  Warnings:

  - You are about to drop the column `position` on the `WatermarkTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `xOffset` on the `WatermarkTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `yOffset` on the `WatermarkTemplate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WatermarkTemplate" DROP COLUMN "position",
DROP COLUMN "xOffset",
DROP COLUMN "yOffset",
ADD COLUMN     "isTiled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "posX" INTEGER NOT NULL DEFAULT 80,
ADD COLUMN     "posY" INTEGER NOT NULL DEFAULT 80;
