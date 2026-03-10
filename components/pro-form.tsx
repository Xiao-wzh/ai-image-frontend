"use client"

import React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Crown, ChevronDown, Sparkles, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { CascaderPanel } from "@/components/cascader-panel"
import { ImageUploadZone } from "./image-upload-zone"
import { ProductTypeLabel, ProductTypeKey, GENERATION_LANGUAGES } from "@/lib/constants"
import type { CockpitFormProps } from "./cockpit-types"

/**
 * PRO 增强驾驶舱 — 高级控制台，科技感布局
 * 展示全部自定义参数 (张数、比例)
 * amber 发光边框 + 呼吸脉冲动画
 */
export function ProForm(props: CockpitFormProps) {
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
        files, previewUrls, onFilesChange,
        refFiles, refPreviewUrls, onRefFilesChange,
        proImageCount, setProImageCount,
        proAspectRatio, setProAspectRatio,
        proFeatures, setProFeatures,
        proStyle, setProStyle,
        costs, totalCost,
        isSubmitting, onSubmit,
        generatedImages, setGeneratedImages,
        setFullImageUrl, setCurrentGenerationId,
    } = props

    const [isLanguageOpen, setIsLanguageOpen] = React.useState(false)

    return (
        <motion.div
            key="pro-cockpit"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
        >
            {/* ═══ PRO 控制台 — 仅含 PRO 专属参数 ═══ */}
            <div className="relative rounded-2xl border border-amber-500/25 bg-gradient-to-br from-amber-950/30 via-slate-900/60 to-orange-950/30 p-[1px]">
                {/* 呼吸发光背景 */}
                <motion.div
                    className="absolute inset-0 rounded-2xl pointer-events-none"
                    animate={{
                        boxShadow: [
                            "0 0 20px 0px rgba(245,158,11,0.08)",
                            "0 0 40px 4px rgba(245,158,11,0.15)",
                            "0 0 20px 0px rgba(245,158,11,0.08)",
                        ],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />

                <div className="relative rounded-2xl bg-slate-900/80 backdrop-blur-xl p-6 space-y-5">
                    {/* 控制台标题条 */}
                    <div className="flex items-center gap-3 pb-3 border-b border-amber-500/15">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <Crown className="w-4 h-4 text-amber-400" />
                            <span className="text-xs font-bold text-amber-300 tracking-wider">PRO 控制台</span>
                        </div>
                        <div className="flex-1 h-[1px] bg-gradient-to-r from-amber-500/20 to-transparent" />
                        <span className="text-[10px] text-amber-500/40 font-mono">ENHANCED MODE</span>
                    </div>

                    {/* ── 张数 & 比例 选择器 ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 生成张数 */}
                        <div>
                            <label className="block text-xs font-medium text-amber-300 mb-2">生成张数</label>
                            <div className="flex gap-2 flex-wrap">
                                {(taskType === "DETAIL_PAGE" ? [3, 5, 9, 14] : [1, 3, 5, 7, 9]).map((count) => (
                                    <button
                                        key={count}
                                        type="button"
                                        onClick={() => setProImageCount(count)}
                                        className={`flex-1 min-w-[60px] h-10 rounded-lg text-sm font-medium transition-all cursor-pointer border ${proImageCount === count
                                            ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20"
                                            : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                            }`}
                                    >
                                        {count} 张
                                        <span className="ml-1 text-[10px] opacity-60">({costs.PRO_COST_PER_IMAGE * count}积分)</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 画幅比例 */}
                        <div>
                            <label className="block text-xs font-medium text-amber-300 mb-2">画幅比例</label>
                            <div className="flex gap-2">
                                {["1:1", "3:4", "4:3", "16:9", "9:16"].map((ratio) => {
                                    const [w, h] = ratio.split(":").map(Number)
                                    const maxSize = 18
                                    const scale = maxSize / Math.max(w, h)
                                    const thumbW = Math.round(w * scale)
                                    const thumbH = Math.round(h * scale)
                                    return (
                                        <button
                                            key={ratio}
                                            type="button"
                                            onClick={() => setProAspectRatio(ratio)}
                                            className={`flex-1 h-10 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${proAspectRatio === ratio
                                                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/20"
                                                : "border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                                                }`}
                                        >
                                            <div
                                                className={`border rounded-[2px] ${proAspectRatio === ratio ? "border-amber-400" : "border-slate-500"}`}
                                                style={{ width: thumbW, height: thumbH }}
                                            />
                                            {ratio}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── 产品功能 & 画面风格 (PRO 专属) ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-medium text-amber-300 mb-2">
                                产品功能 <span className="text-amber-500/40 font-normal">(可选)</span>
                            </label>
                            <input
                                type="text"
                                value={proFeatures || ""}
                                onChange={(e) => setProFeatures(e.target.value)}
                                placeholder="例如：防水防汗、轻薄透气。不填则AI自动生成"
                                className="w-full h-10 rounded-lg border border-amber-500/15 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-500 focus:bg-white/10 focus:ring-2 focus:ring-amber-500/20 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-amber-300 mb-2">
                                画面风格 <span className="text-amber-500/40 font-normal">(可选)</span>
                            </label>
                            <input
                                type="text"
                                value={proStyle || ""}
                                onChange={(e) => setProStyle(e.target.value)}
                                placeholder="例如：赛博朋克、极简高级灰。不填则AI自动生成"
                                className="w-full h-10 rounded-lg border border-amber-500/15 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-500 focus:bg-white/10 focus:ring-2 focus:ring-amber-500/20 transition-all"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ 创意/克隆 — 仅详情页 (放在控制台外，避免 z-index 问题) ═══ */}
            {taskType === "DETAIL_PAGE" && (
                <div>
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/50 border border-white/10 w-fit">
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
                </div>
            )}

            {/* ═══ 表单字段 — 放在控制台外，下拉菜单可正常溢出 ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 平台 / 风格 */}
                <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-amber-300/80 mb-2">平台 / 风格</label>
                    <DropdownMenu open={isCascaderOpen} onOpenChange={setIsCascaderOpen}>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="w-full h-11 rounded-xl border border-amber-500/15 bg-white/5 hover:bg-white/10 px-4 text-sm text-white outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all flex items-center justify-between"
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
                                <ChevronDown className="w-4 h-4 text-amber-400/60" />
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
                    {typeSelectDisabled && <div className="mt-2 text-xs text-slate-500">当前平台暂无可用风格</div>}
                </div>

                {/* 商品名称 */}
                <div className="md:col-span-1">
                    <label className="block text-xs font-medium text-amber-300/80 mb-2">商品名称</label>
                    <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="例如：银河猫咪贴纸"
                        className="w-full h-11 rounded-xl border border-amber-500/15 bg-white/5 px-4 text-sm text-white placeholder:text-slate-500 outline-none focus:border-amber-500 focus:bg-white/10 focus:ring-2 focus:ring-amber-500/20 transition-all backdrop-blur-sm"
                    />
                </div>


                {/* 语言 */}
                <div className="md:col-span-1 relative z-20">
                    <label className="block text-xs font-medium text-amber-300/80 mb-2">输出文字语言</label>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                            className="w-full flex items-center justify-between h-11 rounded-xl border border-amber-500/15 bg-white/5 px-4 text-sm text-white hover:bg-white/10 transition-all"
                        >
                            <span>{outputLanguage}</span>
                            <ChevronDown className={`w-4 h-4 text-amber-400/60 transition-transform ${isLanguageOpen ? "rotate-180" : ""}`} />
                        </button>
                        <AnimatePresence>
                            {isLanguageOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="absolute z-50 mt-2 w-full bg-slate-800 border border-amber-500/20 rounded-xl overflow-hidden shadow-2xl"
                                >
                                    {GENERATION_LANGUAGES.map(lang => (
                                        <button
                                            key={lang.label}
                                            type="button"
                                            onClick={() => { setOutputLanguage(lang.label); setIsLanguageOpen(false) }}
                                            className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/10 transition-colors ${outputLanguage === lang.label ? "bg-amber-500/20 text-amber-400" : "text-white"}`}
                                        >
                                            {lang.label}
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>


            </div>

            {/* ═══ 上传区 ═══ */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                <div className="flex items-end justify-between gap-3 flex-wrap">
                    <label className="block text-sm font-medium text-slate-300">
                        {generationMode === "CLONE" ? "商品图片" : "上传商品图片"}
                    </label>
                    <div className="text-xs text-slate-500">图片越清晰、角度越完整，效果越好</div>
                </div>
                <div className="mt-3">
                    <ImageUploadZone files={files} previewUrls={previewUrls} onFilesChange={onFilesChange} maxFiles={8} />
                </div>
            </motion.div>

            {/* 参考图上传 — 仅克隆 */}
            {taskType === "DETAIL_PAGE" && generationMode === "CLONE" && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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

            {/* ═══ 生成按钮 ═══ */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="relative pt-4"
            >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 py-1 bg-gradient-to-r from-amber-400 to-orange-400 rounded-full text-slate-900 text-xs font-bold shadow-lg z-10 flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    PRO 增强模式
                </div>
                <Button
                    onClick={onSubmit}
                    disabled={isSubmitting || typeSelectDisabled}
                    className="w-full h-16 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700 text-white font-semibold shadow-lg shadow-amber-500/50 hover:shadow-xl hover:shadow-amber-500/60 transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group flex flex-col items-center justify-center"
                >
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "100%" }}
                        transition={{ duration: 0.5 }}
                    />
                    <div className="relative flex items-center justify-center gap-2 text-base">
                        <Crown className="w-5 h-5" />
                        <span>生成 {proImageCount} 张</span>
                    </div>
                    <div className="relative text-xs opacity-70 mt-1">消耗 {totalCost} 积分</div>
                </Button>
                <p className="text-xs text-slate-500 text-center mt-3 flex items-center justify-center gap-1">
                    <Crown className="w-3 h-3" /> PRO 专属提示词 · 按张计费 · 失败自动退币
                </p>
            </motion.div>
        </motion.div>
    )
}
