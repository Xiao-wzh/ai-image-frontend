"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, ChevronDown, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CascaderPanel } from "@/components/cascader-panel"
import { ImageUploadZone } from "./image-upload-zone"
import { ProductTypeLabel, ProductTypeKey, GENERATION_LANGUAGES } from "@/lib/constants"
import type { CockpitFormProps } from "./cockpit-types"

/**
 * 标准极速驾驶舱 — 极简表单，傻瓜式操作
 * 不显示张数、比例等高级参数
 */
export function StandardForm(props: CockpitFormProps) {
    const {
        taskType,
        productName, setProductName,
        platformKey, setPlatformKey,
        productType, setProductType,
        platforms, isCascaderOpen, setIsCascaderOpen,
        selectedPlatform, typeOptions, typeSelectDisabled,
        generationMode, setGenerationMode,
        features, setFeatures,
        outputLanguage, setOutputLanguage,
        detailBatch, setDetailBatch,
        files, previewUrls, onFilesChange,
        refFiles, refPreviewUrls, onRefFilesChange,
        isComboMode, setIsComboMode,
        costs, totalCost,
        isSubmitting, onSubmit,
        generatedImages, setGeneratedImages,
        setFullImageUrl, setCurrentGenerationId,
        hideGenerationModeSwitch = false,
    } = props

    const [isLanguageOpen, setIsLanguageOpen] = React.useState(false)
    const [isDetailBatchOpen, setIsDetailBatchOpen] = React.useState(false)
    const comboAddOnCost = costs.DETAIL_PAGE_RETRY_COST

    return (
        <motion.div
            key="standard-cockpit"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
        >
            {/* 第三步：创意/克隆模式 — 首页隐藏此切换 */}
            {!hideGenerationModeSwitch && (
                <div>
                    <div className="flex items-center gap-3 mb-0">
                        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest shrink-0">
                            {taskType === "DETAIL_PAGE" ? "③ 详情页风格" : "② 生成风格"}
                        </p>
                    </div>
                    <div className="flex items-center gap-1 p-1 mt-2 rounded-xl bg-slate-800/50 border border-white/10 w-fit">
                        <button
                            type="button"
                            onClick={() => {
                                setGenerationMode("CREATIVE")
                                setProductType("")
                                if (generatedImages.length > 0) { setGeneratedImages([]); setFullImageUrl(null); setCurrentGenerationId(null) }
                            }}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${generationMode === "CREATIVE"
                                    ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            创意模式
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setGenerationMode("CLONE")
                                setProductType("")
                                if (generatedImages.length > 0) { setGeneratedImages([]); setFullImageUrl(null); setCurrentGenerationId(null) }
                            }}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${generationMode === "CLONE"
                                    ? "bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow-md shadow-amber-500/20"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            <Copy className="w-3.5 h-3.5" />
                            克隆模式
                        </button>
                    </div>
                    {generationMode === "CLONE" && (
                        <p className="text-xs text-amber-400/80 mt-2">
                            克隆模式将复制参考图的构图风格，适合快速生成相似风格的图片
                        </p>
                    )}
                </div>
            )}

            {/* 平台 / 风格 + 商品名称 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 平台选择 */}
                <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 }}
                    className="md:col-span-2"
                >
                    <label className="block text-sm font-medium text-slate-300 mb-2">平台 / 风格</label>
                    <DropdownMenu open={isCascaderOpen} onOpenChange={setIsCascaderOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="w-full h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all flex items-center justify-between"
                            >
                                <span className="truncate">
                                    {(() => {
                                        const p = selectedPlatform
                                        const t = typeOptions.find((x) => x.value === productType)
                                        const platformLabel = p?.label || platformKey
                                        const typeLabel = t?.label || (ProductTypeLabel as any)[productType] || productType || "请选择"
                                        return `${platformLabel} / ${typeLabel}`
                                    })()}
                                </span>
                                <ChevronDown className="w-4 h-4 text-slate-400" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent sideOffset={8} className="p-0">
                            <CascaderPanel
                                items={platforms || []}
                                value={{ platformKey, productType: productType || undefined }}
                                onChange={(next) => {
                                    setPlatformKey(next.platformKey)
                                    setProductType((next.productType as ProductTypeKey) || "")
                                    if (next.productType) setIsCascaderOpen(false)
                                }}
                            />
                        </DropdownMenuContent>
                    </DropdownMenu>
                    {typeSelectDisabled && (
                        <div className="mt-2 text-xs text-slate-500">当前平台暂无可用风格</div>
                    )}
                </motion.div>

                {/* 商品名称 */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="md:col-span-1"
                >
                    <label className="block text-sm font-medium text-slate-300 mb-2">商品名称</label>
                    <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="例如：银河猫咪贴纸"
                        className="w-full h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500 focus:bg-white/10 focus:ring-2 focus:ring-blue-500/20 transition-all backdrop-blur-sm"
                    />
                </motion.div>

                {/* 克隆模式卖点 */}
                {generationMode === "CLONE" && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 }}
                        className="md:col-span-3"
                    >
                        <label className="block text-sm font-medium text-amber-300 mb-2">
                            商品卖点 <span className="text-amber-400/60 font-normal">(可选，用于生成文案)</span>
                        </label>
                        <textarea
                            value={features}
                            onChange={(e) => setFeatures(e.target.value)}
                            placeholder="例如：防水、耐磨、轻便透气、100%纯棉..."
                            rows={2}
                            className="w-full rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-500 focus:bg-amber-500/10 focus:ring-2 focus:ring-amber-500/20 transition-all backdrop-blur-sm resize-none"
                        />
                    </motion.div>
                )}

                {/* 语言 */}
                <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 }}
                    className="md:col-span-2"
                >
                    <label className="block text-sm font-medium text-slate-300 mb-2">输出文字语言</label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                            className="w-full flex items-center justify-between h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white hover:bg-white/10 transition-all backdrop-blur-sm"
                        >
                            <span>{outputLanguage}</span>
                            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isLanguageOpen ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                            {isLanguageOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute z-50 mt-2 w-full bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl"
                                >
                                    {GENERATION_LANGUAGES.map(lang => (
                                        <button
                                            key={lang.label}
                                            type="button"
                                            onClick={() => { setOutputLanguage(lang.label); setIsLanguageOpen(false) }}
                                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors ${outputLanguage === lang.label ? "bg-blue-500/20 text-blue-400" : "text-white"}`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </motion.div>

                {/* 批次 — 仅详情页 */}
                {taskType === "DETAIL_PAGE" && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="md:col-span-1"
                    >
                        <label className="block text-sm font-medium text-slate-300 mb-2">生成批次</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setIsDetailBatchOpen(!isDetailBatchOpen)}
                                className="w-full flex items-center justify-between h-11 rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-white hover:bg-white/10 transition-all backdrop-blur-sm"
                            >
                                <span>{detailBatch === "A" ? "前六屏" : "后六屏"}</span>
                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDetailBatchOpen ? "rotate-180" : ""}`} />
                            </button>
                            <AnimatePresence>
                                {isDetailBatchOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="absolute z-50 mt-2 w-full bg-slate-800 border border-white/10 rounded-xl overflow-hidden shadow-xl"
                                    >
                                        <button type="button" onClick={() => { setDetailBatch("A"); setIsDetailBatchOpen(false) }}
                                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors ${detailBatch === "A" ? "bg-purple-500/20 text-purple-400" : "text-white"}`}>
                                            前六屏
                                        </button>
                                        <button type="button" onClick={() => { setDetailBatch("B"); setIsDetailBatchOpen(false) }}
                                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors ${detailBatch === "B" ? "bg-purple-500/20 text-purple-400" : "text-white"}`}>
                                            后六屏
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* 上传区 */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <div className="flex items-end justify-between gap-3 flex-wrap">
                    <label className="block text-sm font-medium text-slate-300">
                        {generationMode === "CLONE" ? "商品图片" : "上传商品图片"}
                    </label>
                    <div className="text-xs text-slate-500">
                        提示：图片越清晰、角度越完整，生成结果越贴近实物
                    </div>
                </div>
                <div className="mt-3">
                    <ImageUploadZone files={files} previewUrls={previewUrls} onFilesChange={onFilesChange} maxFiles={8} />
                </div>
            </motion.div>

            {/* 参考图上传 — 仅克隆模式 */}
            {generationMode === "CLONE" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                    <div className="flex items-end justify-between gap-3 flex-wrap">
                        <label className="block text-sm font-medium text-amber-300">
                            参考图片 <span className="text-amber-400/60 font-normal">(用于复制构图)</span>
                        </label>
                    </div>
                    <div className="mt-3">
                        <ImageUploadZone files={refFiles} previewUrls={refPreviewUrls} onFilesChange={onRefFilesChange} maxFiles={6} />
                    </div>
                </motion.div>
            )}

            {/* Combo 套餐卡 — 仅主图创意模式 */}
            {taskType === "MAIN_IMAGE" && generationMode === "CREATIVE" && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="relative rounded-xl border border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 p-4"
                >
                    <div className="absolute -top-2.5 left-4 px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 rounded-full text-white text-[10px] font-bold shadow-lg">
                        🔥 限时特惠
                    </div>
                    <div className="flex items-center justify-between gap-3 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={isComboMode}
                                onChange={(e) => setIsComboMode(e.target.checked)}
                                className="w-4 h-4 rounded border-amber-400/50 bg-amber-500/20 text-amber-500 focus:ring-amber-500/50 focus:ring-offset-0 cursor-pointer"
                            />
                            <span className="text-sm font-medium text-white">同时生成详情页（默认前六屏）</span>
                        </label>
                        <div className="hidden sm:block text-[11px] text-slate-400">
                            赠送水印解锁 <span className="text-emerald-400 font-medium">(立省 100 积分)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500 text-sm line-through">{costs.DETAIL_PAGE_STANDARD_COST}</span>
                            <span className="text-amber-400 text-lg font-bold">+{comboAddOnCost}</span>
                        </div>
                    </div>
                </motion.div>
            )}

            {/* 生成按钮 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative pt-4"
            >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-yellow-400 rounded-full text-slate-900 text-xs font-bold shadow-lg z-10">
                    🔥 2.5折特惠 <span className="line-through opacity-70 ml-1">原价 800</span>
                </div>
                <Button
                    onClick={onSubmit}
                    disabled={isSubmitting || typeSelectDisabled}
                    className="w-full h-16 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-purple relative overflow-hidden group flex flex-col items-center justify-center"
                >
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "100%" }}
                        transition={{ duration: 0.5 }}
                    />
                    <div className="relative flex items-center justify-center gap-2 text-base">
                        <Sparkles className="w-5 h-5" />
                        <span>{isComboMode && taskType === "MAIN_IMAGE" ? "立即生成双份" : "生成图像"}</span>
                    </div>
                    <div className="relative text-xs opacity-70 mt-1">消耗 {totalCost} 积分</div>
                </Button>
                <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    {isComboMode && taskType === "MAIN_IMAGE" ? "一次生成主图 + 详情页" : "一次生成即得 9 张精选图"}
                </p>
            </motion.div>
        </motion.div>
    )
}

// React import for local UI state (dropdown open/close)
import React from "react"
