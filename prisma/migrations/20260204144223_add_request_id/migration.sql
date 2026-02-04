/*
  Warnings:

  - A unique constraint covering the columns `[requestId]` on the table `Generation` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Generation" ADD COLUMN     "requestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Generation_requestId_key" ON "Generation"("requestId");
