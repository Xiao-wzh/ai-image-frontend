// 商品类型常量与映射 - 所有新增类型仅需在此维护
// 1. 数据库存储 / API 传输用英文 KEY
export const ProductType = {
  MENSWEAR: "MENSWEAR",
  BEDDING: "BEDDING",
  SEXY_SPECIES: "SEXY_SPECIES",
} as const;

export type ProductTypeKey = (typeof ProductType)[keyof typeof ProductType];

// 2. 前端下拉展示用中文
export const ProductTypeLabel: Record<ProductTypeKey, string> = {
  [ProductType.MENSWEAR]: "男装",
  [ProductType.BEDDING]: "寝具",
  [ProductType.SEXY_SPECIES]: "Sexyspecies",
};

// 3. 发送给 n8n / Prompt 查表时使用的中文关键字
export const ProductTypePromptKey: Record<ProductTypeKey, string> = {
  [ProductType.MENSWEAR]: "MENSWEAR",
  [ProductType.BEDDING]: "BEDDING",
  [ProductType.SEXY_SPECIES]: "SEXY_SPECIES",
};

