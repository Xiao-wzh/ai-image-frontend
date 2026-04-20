"use client"

import type { ProductTypeKey, GenerationLanguage } from "@/lib/constants"
import type { CascaderPlatformItem } from "@/components/cascader-panel"
import type { SystemCostConfig, ImageModelConfig } from "@/lib/types/config"

/**
 * 驾驶舱子表单的共享 Props
 * 所有 state 和 callbacks 均由父组件 (UploadZone) 注入
 */
export interface CockpitFormProps {
    // ── 核心表单数据 ──
    taskType: "MAIN_IMAGE" | "DETAIL_PAGE"
    productName: string
    setProductName: (v: string) => void
    platformKey: string
    setPlatformKey: (v: string) => void
    productType: ProductTypeKey | ""
    setProductType: (v: ProductTypeKey | "") => void
    platforms: CascaderPlatformItem[] | null
    isCascaderOpen: boolean
    setIsCascaderOpen: (v: boolean) => void
    selectedPlatform: CascaderPlatformItem | null
    typeOptions: { value: string; label: string }[]
    typeSelectDisabled: boolean

    // ── 生成模式 (克隆/创意) ──
    generationMode: "CREATIVE" | "CLONE"
    setGenerationMode: (v: "CREATIVE" | "CLONE") => void
    features: string
    setFeatures: (v: string) => void

    // ── 语言 & 批次 ──
    outputLanguage: GenerationLanguage
    setOutputLanguage: (v: GenerationLanguage) => void
    detailBatch: "A" | "B"
    setDetailBatch: (v: "A" | "B") => void

    // ── 文件上传 ──
    files: File[]
    previewUrls: string[]
    onFilesChange: (files: File[]) => void
    refFiles: File[]
    refPreviewUrls: string[]
    onRefFilesChange: (files: File[]) => void

    // ── Combo 模式 (仅 Standard) ──
    isComboMode: boolean
    setIsComboMode: (v: boolean) => void

    // ── PRO 参数 (仅 ProForm) ──
    proImageCount: number
    setProImageCount: (v: number) => void
    proAspectRatio: string
    setProAspectRatio: (v: string) => void
    proFeatures?: string
    setProFeatures: (v: string) => void
    proStyle?: string
    setProStyle: (v: string) => void

    // ── 费用 ──
    costs: SystemCostConfig
    totalCost: number

    // ── 模型选择 ──
    selectedModel: string
    setSelectedModel: (v: string) => void
    availableModels: ImageModelConfig[]

    // ── 提交 ──
    isSubmitting: boolean
    onSubmit: () => void

    // ── 生成结果重置 ──
    generatedImages: string[]
    setGeneratedImages: (v: string[]) => void
    setFullImageUrl: (v: string | null) => void
    setCurrentGenerationId: (v: string | null) => void

    // ── 极简模式（克隆专用页面） ──
    isCloneOnlyPage?: boolean
    // ── 隐藏创意/克隆切换（首页创意专用） ──
    hideGenerationModeSwitch?: boolean
}
