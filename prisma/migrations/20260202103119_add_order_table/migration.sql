-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "outTradeNo" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'wechat',
    "merchantKey" TEXT NOT NULL,
    "mchid" TEXT NOT NULL,
    "userId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "payPlatformTradeNo" TEXT,
    "paidAt" TIMESTAMP(3),
    "rawNotify" JSONB,
    "notifyProcessedAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_outTradeNo_key" ON "Order"("outTradeNo");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_merchantKey_idx" ON "Order"("merchantKey");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
