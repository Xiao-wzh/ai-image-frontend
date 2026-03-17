-- 统一所有图片 URL 为源站格式
-- 将 CDN 域名 (img.wzhdjy.xin) 替换为源站域名 (sexyspecies-ai-image.tos-cn-beijing.volces.com)

-- 更新 Generation 表的 originalImage 字段（text[] 数组）
UPDATE "Generation"
SET "originalImage" = ARRAY(
    SELECT REPLACE(u, 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
    FROM unnest("originalImage") AS u
)
WHERE EXISTS (
    SELECT 1 FROM unnest("originalImage") AS u WHERE u LIKE '%img.wzhdjy.xin%'
);

-- 更新 Generation 表的 generatedImages 字段（text[] 数组）
UPDATE "Generation"
SET "generatedImages" = ARRAY(
    SELECT REPLACE(u, 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
    FROM unnest("generatedImages") AS u
)
WHERE EXISTS (
    SELECT 1 FROM unnest("generatedImages") AS u WHERE u LIKE '%img.wzhdjy.xin%'
);

-- 更新 Generation 表的 refImages 字段（text[] 数组）
UPDATE "Generation"
SET "refImages" = ARRAY(
    SELECT REPLACE(u, 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
    FROM unnest("refImages") AS u
)
WHERE EXISTS (
    SELECT 1 FROM unnest("refImages") AS u WHERE u LIKE '%img.wzhdjy.xin%'
);

-- 更新 Generation 表的 generatedImage 字段（text 单值）
UPDATE "Generation"
SET "generatedImage" = REPLACE("generatedImage", 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
WHERE "generatedImage" LIKE '%img.wzhdjy.xin%';

-- 更新 Appeal 表的 appealedImages 字段（text[] 数组）
UPDATE "Appeal"
SET "appealedImages" = ARRAY(
    SELECT REPLACE(u, 'https://img.wzhdjy.xin', 'https://sexyspecies-ai-image.tos-cn-beijing.volces.com')
    FROM unnest("appealedImages") AS u
)
WHERE EXISTS (
    SELECT 1 FROM unnest("appealedImages") AS u WHERE u LIKE '%img.wzhdjy.xin%'
);
