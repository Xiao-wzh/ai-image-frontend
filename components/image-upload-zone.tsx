"use client"

import { useCallback } from "react"
import { useDropzone, FileRejection } from "react-dropzone"
import { motion, AnimatePresence } from "framer-motion"
import { Upload, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface ImageUploadZoneProps {
  files: File[]
  previewUrls: string[]
  onFilesChange: (files: File[]) => void
  maxFiles?: number
}

export function ImageUploadZone({
  files,
  previewUrls,
  onFilesChange,
  maxFiles = 8,
}: ImageUploadZoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const remaining = maxFiles - files.length
      if (remaining <= 0) return

      const filesToAdd = acceptedFiles.slice(0, remaining)
      onFilesChange([...files, ...filesToAdd])
    },
    [files, maxFiles, onFilesChange]
  )

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    if (fileRejections.length > 0) {
      toast.error("不支持该格式文件，请上传 JPG、PNG 格式图片")
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
    },
    maxFiles: maxFiles - files.length,
    disabled: files.length >= maxFiles,
  })

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    onFilesChange(newFiles)
  }

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <AnimatePresence mode="wait">
        {files.length === 0 ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div
              {...getRootProps()}
              className={cn(
                "relative h-48 rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer group",
                "flex flex-col items-center justify-center gap-4",
                "backdrop-blur-sm",
                isDragActive
                  ? "border-blue-500 bg-blue-500/10 ring-4 ring-blue-500/20 glow-blue"
                  : "border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30"
              )}
            >
              <input {...getInputProps()} />

              <motion.div
                animate={
                  isDragActive
                    ? { scale: 1.1, rotate: 5 }
                    : { scale: 1, rotate: 0 }
                }
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
                  isDragActive
                    ? "bg-blue-500/20"
                    : "bg-white/10 group-hover:bg-white/20"
                )}
              >
                <Upload
                  className={cn(
                    "w-8 h-8 transition-colors",
                    isDragActive ? "text-blue-400" : "text-slate-400"
                  )}
                />
              </motion.div>

              <div className="text-center">
                <p
                  className={cn(
                    "text-base font-medium transition-colors",
                    isDragActive ? "text-blue-400" : "text-slate-300"
                  )}
                >
                  {isDragActive
                    ? "松开以上传图片"
                    : "拖拽图片到此处或点击上传"}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  支持 JPG、PNG 格式，最多 {maxFiles} 张
                </p>
              </div>

              {/* Animated border gradient */}
              {isDragActive && (
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  initial={{ opacity: 0 }}
                  animate={{
                    opacity: 1,
                    backgroundPosition: ["0% 0%", "200% 0%"],
                  }}
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.3), transparent)",
                    backgroundSize: "200% 100%",
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              )}
            </div>
          </motion.div>
        ) : (
          /* Preview Grid */
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div className="grid grid-cols-4 gap-3">
              <AnimatePresence mode="popLayout">
                {previewUrls.map((url, index) => (
                  <motion.div
                    key={url}
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                    transition={{
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                      scale: { duration: 0.2 }
                    }}
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-white/20 bg-white/5 group hover:border-blue-500 transition-colors backdrop-blur-sm"
                  >
                    <img
                      src={url}
                      alt={`预览 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />

                    {/* Hover overlay */}
                    <motion.div
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                      className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
                    >
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeFile(index)}
                        className="w-10 h-10 rounded-full bg-red-500/90 backdrop-blur-sm flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
                      >
                        <X className="w-5 h-5 text-white" />
                      </motion.button>
                    </motion.div>
                  </motion.div>
                ))}

                {/* Add more button */}
                {files.length < maxFiles && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                      scale: { duration: 0.2 }
                    }}
                    {...(() => {
                      const {
                        onDrag,
                        onDragEnd,
                        onDragStart,
                        onAnimationStart,
                        onAnimationEnd,
                        onAnimationIteration,
                        ...rest
                      } = getRootProps()
                      return rest
                    })()}
                    className="aspect-square rounded-xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-blue-500/50 transition-colors flex items-center justify-center cursor-pointer group backdrop-blur-sm"
                  >
                    <input {...getInputProps()} />
                    <div className="text-center">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 90 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="text-3xl mb-1"
                      >
                        ➕
                      </motion.div>
                      <div className="text-xs text-slate-400">添加</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-slate-400 text-center"
            >
              已选择 {files.length} / {maxFiles} 张图片
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

