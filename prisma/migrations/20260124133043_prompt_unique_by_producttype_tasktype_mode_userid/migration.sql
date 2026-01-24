-- Drop old index if exists (name from previous migrations)
DROP INDEX IF EXISTS "ProductTypePrompt_platformId_productType_taskType_mode_idx";

-- Add uniqueness by (productType, taskType, mode, userId)
CREATE UNIQUE INDEX IF NOT EXISTS "ProductTypePrompt_productType_taskType_mode_userId_key"
ON "ProductTypePrompt" ("productType", "taskType", "mode", "userId");

-- Keep a non-unique index for common lookups including platformId (optional, but preserves prior performance patterns)
CREATE INDEX IF NOT EXISTS "ProductTypePrompt_platformId_productType_taskType_mode_idx"
ON "ProductTypePrompt" ("platformId", "productType", "taskType", "mode");