-- CreateTable
CREATE TABLE "Copywriting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Copywriting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Copywriting_userId_idx" ON "Copywriting"("userId");

-- CreateIndex
CREATE INDEX "Copywriting_createdAt_idx" ON "Copywriting"("createdAt");

-- AddForeignKey
ALTER TABLE "Copywriting" ADD CONSTRAINT "Copywriting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
