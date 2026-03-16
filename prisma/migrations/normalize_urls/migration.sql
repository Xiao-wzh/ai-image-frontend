-- 统一所有图片 URL 为源站格式
-- 将 CDN 域名 (img.wzhdjy.xin) 替换为源站域名 (sexyspecies-ai-image.tos-cn-beijing.volces.com)

-- 更新 Generation 表的 originalImage 字段
UPDATE "Generation"
SET "originalImage" = REPLACE("originalImage", 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
WHERE "originalImage" LIKE '%img.wzhdjy.xin%';

-- 更新 Generation 表的 generatedImage 字段
UPDATE "Generation"
SET "generatedImage" = REPLACE("generatedImage", 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
WHERE "generatedImage" LIKE '%img.wzhdjy.xin%';

-- 更新 Generation 表的 generatedImages 字段（JSON 数组）
UPDATE "Generation"
SET "generatedImages" = REPLACE("generatedImages", 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
WHERE "generatedImages" LIKE '%img.wzhdjy.xin%';

-- 更新 Generation 表的 refImages 字段（JSON 数组）
UPDATE "Generation"
SET "refImages" = REPLACE("refImages", 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
WHERE "refImages" LIKE '%img.wzhdjy.xin%';

-- 更新 Appeal 表的 appealedImages 字段（JSON 数组）
UPDATE "Appeal"
SET "appealedImages" = REPLACE("appealedImages", 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
WHERE "appealedImages" LIKE '%img.wzhdjy.xin%';
