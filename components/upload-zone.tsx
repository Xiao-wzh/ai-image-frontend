"use client"

import type React from "react"
import { useState, useCallback, useRef } from "react"
import { Sparkles, X, ZoomIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import {
  ProductType,
  ProductTypeLabel,
  ProductTypeKey,
} from "@/lib/constants"
import { toast } from "sonner"

export function UploadZone() {
  /* ──────────────── state ──────────────── */
  const [productName, setProductName] = useState("")
  const [productType, setProductType] = useState<ProductTypeKey | "">("")
  const [files, setFiles] = useState<File[]>([])
  const [previewUrls, setPreviewUrls] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  /* ──────────────── refs ──────────────── */
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /* ──────────────── file select ──────────────── */
  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : []
    if (list.length) {
      // 检查是否超过最大数量限制（8张）
      const remaining = 8 - files.length
      
      if (remaining <= 0) {
        toast.error("最多只能上传 8 张图片")
        e.target.value = ''
        return
      }
      
      // 确定实际要添加的文件
      let filesToAdd = list
      if (list.length > remaining) {
        toast.warning(`最多还能上传 ${remaining} 张图片，已自动截取前 ${remaining} 张`)
        filesToAdd = list.slice(0, remaining)
      }
      
      // 生成预览 URL
      const urls = filesToAdd.map(file => URL.createObjectURL(file))
      
      // 更新状态
      setFiles(prev => [...prev, ...filesToAdd])
      setPreviewUrls(prev => [...prev, ...urls])
    }
    
    // 重置 input value，允许重复选择同一文件
    e.target.value = ''
  }, [files.length])

  const onBrowseClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  // 删除图片
  const removeImage = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
    setPreviewUrls(prev => {
      URL.revokeObjectURL(prev[index]) // 释放内存
      return prev.filter((_, i) => i !== index)
    })
  }, [])

  /* ──────────────── submit ──────────────── */
  const onSubmit = useCallback(async () => {
    if (!productName.trim()) {
      toast.error("请填写商品名称")
      return
    }
    if (!productType) {
      toast.error("请选择商品类型")
      return
    }
    if (files.length === 0) {
      toast.error("请至少上传 1 张图片")
      return
    }

    try {
      setIsSubmitting(true)
      setGeneratedImage(null)

      const fd = new FormData()
      fd.append("productName", productName.trim())
      fd.append("productType", productType)

      // 支持多文件：images[]
      files.forEach((f) => fd.append("images", f))

      const res = await fetch("/api/generate", { method: "POST", body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error || `请求失败: ${res.status}`)
      }

      const data = await res.json()
      if (!data.generatedImage) {
        toast.warning("生成成功但未返回图片数据")
      } else {
        setGeneratedImage(data.generatedImage)
        toast.success("生成完成")
      }
    } catch (e: any) {
      toast.error(e?.message || "生成失败")
    } finally {
      setIsSubmitting(false)
    }
  }, [productName, productType, files])

  /* ──────────────── render ──────────────── */
  return (
    <>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">AI 智能绘图</h2>
            <p className="text-sm text-gray-500 mt-0.5">利用最先进的 Gemini 模型创造视觉奇迹</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 mb-1">剩余额度</div>
            <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              635
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* 商品名称 & 商品类型 - 横向布局 */}
          <div className="grid grid-cols-2 gap-4">
            {/* 商品名称 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                商品名称
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="例如：银河猫咪贴纸"
                className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-4 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
              />
            </div>

            {/* 商品类型 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                商品类型
              </label>
              <Select
                value={productType}
                onValueChange={(v) => setProductType(v as ProductTypeKey)}
              >
                <SelectTrigger className="w-full h-11 rounded-xl border-gray-200 bg-gray-50 hover:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all">
                  <SelectValue placeholder="选择类型" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ProductTypeLabel).map(([k, label]) => (
                    <SelectItem key={k} value={k}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 上传图片区域 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              上传商品图片
            </label>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onFileChange}
            />

            {/* 上传按钮 */}
            {files.length === 0 ? (
              <button
                onClick={onBrowseClick}
                className="w-full h-32 rounded-xl border-2 border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-gray-100 hover:from-blue-50 hover:to-purple-50 hover:border-blue-400 transition-all duration-300 flex flex-col items-center justify-center gap-3 group"
              >
                <div className="w-14 h-14 rounded-full bg-white shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-3xl">📸</span>
                </div>
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-700 group-hover:text-blue-600 transition-colors">
                    点击上传图片
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    支持 JPG、PNG 格式，可上传多张
                  </div>
                </div>
              </button>
            ) : (
              /* 图片预览网格 */
              <div className="space-y-3">
                <div className="grid grid-cols-4 gap-3">
                  {previewUrls.map((url, index) => (
                    <div
                      key={index}
                      className="relative aspect-square rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-100 group hover:border-blue-400 transition-all"
                    >
                      <img
                        src={url}
                        alt={`预览 ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* 悬停遮罩 */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {/* 放大预览 */}
                        <button
                          onClick={() => setPreviewImage(url)}
                          className="w-8 h-8 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors"
                        >
                          <ZoomIn className="w-4 h-4 text-gray-700" />
                        </button>
                        
                        {/* 删除 */}
                        <button
                          onClick={() => removeImage(index)}
                          className="w-8 h-8 rounded-lg bg-red-500/90 backdrop-blur-sm flex items-center justify-center hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* 添加更多按钮 - 最多8张 */}
                  {files.length < 8 && (
                    <button
                      onClick={onBrowseClick}
                      className="aspect-square rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center group"
                    >
                      <div className="text-center">
                        <div className="text-2xl mb-1 group-hover:scale-110 transition-transform">➕</div>
                        <div className="text-xs text-gray-500">添加</div>
                      </div>
                    </button>
                  )}
                </div>
                
                <div className="text-xs text-gray-500 text-center">
                  已选择 {files.length} / 8 张图片
                </div>
              </div>
            )}
          </div>

          {/* 生成按钮 */}
          <Button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium text-base shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-5 h-5 mr-2" />
            {isSubmitting ? "生成中..." : "生成图像（消耗 5 点）"}
          </Button>
        </div>

        {/* 生成结果预览 */}
        {generatedImage && (
          <div className="mt-8 pt-8 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
              生成结果
            </h3>
            <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <img
                src={generatedImage}
                alt="generated"
                className="w-full h-auto cursor-pointer"
                onClick={() => setPreviewImage(generatedImage)}
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = "none"
                  toast.error("图片加载失败")
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* 图片放大预览弹窗 */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] animate-in zoom-in-95 duration-200">
            <img
              src={previewImage}
              alt="预览"
              className="max-w-full max-h-[90vh] rounded-2xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-4 -right-4 w-10 h-10 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
