-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "isWatermarkUnlocked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WatermarkTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "opacity" INTEGER NOT NULL DEFAULT 100,
    "rotate" INTEGER NOT NULL DEFAULT 0,
    "scale" INTEGER NOT NULL DEFAULT 100,
    "position" TEXT NOT NULL DEFAULT 'se',
    "xOffset" INTEGER NOT NULL DEFAULT 20,
    "yOffset" INTEGER NOT NULL DEFAULT 20,
    "fontSize" INTEGER,
    "fontColor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatermarkTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WatermarkTemplate_userId_idx" ON "WatermarkTemplate"("userId");

-- AddForeignKey
ALTER TABLE "WatermarkTemplate" ADD CONSTRAINT "WatermarkTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
