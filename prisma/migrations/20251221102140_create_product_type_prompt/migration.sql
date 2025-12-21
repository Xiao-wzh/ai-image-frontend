-- CreateTable
CREATE TABLE "Generation" (
    "id" UUID NOT NULL,
    "productName" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "originalImage" TEXT NOT NULL,
    "generatedImage" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTypePrompt" (
    "id" UUID NOT NULL,
    "productType" TEXT NOT NULL,
    "promptTemplate" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductTypePrompt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypePrompt_productType_key" ON "ProductTypePrompt"("productType");
