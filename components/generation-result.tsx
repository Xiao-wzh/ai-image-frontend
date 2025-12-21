"use client"

import { motion } from "framer-motion"
import { Download, RefreshCw, ZoomIn } from "lucide-react"
import { Button } from "@/components/ui/button"

interface GenerationResultProps {
  imageUrl: string
  onTryAnother: () => void
  onPreview: () => void
}

export function GenerationResult({
  imageUrl,
  onTryAnother,
  onPreview,
}: GenerationResultProps) {
  const handleDownload = () => {
    const link = document.createElement("a")
    link.href = imageUrl
    link.download = `ai-generated-${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="space-y-6"
    >
      {/* Success indicator */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex items-center gap-2 text-sm text-green-400"
      >
        <motion.span
          animate={{
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 1,
            repeat: 3,
          }}
          className="w-2 h-2 rounded-full bg-green-500"
        />
        生成完成
      </motion.div>

      {/* Image with hover effects */}
      <motion.div
        className="relative group rounded-2xl overflow-hidden border border-white/20 backdrop-blur-sm flex items-center justify-center bg-slate-900/50"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <motion.img
          src={imageUrl}
          alt="Generated"
          className="max-w-full max-h-[65vh] object-contain"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        />

        {/* Hover overlay with preview button */}
        <motion.div
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center cursor-pointer"
          onClick={onPreview}
        >
          <motion.div
            initial={{ scale: 0.8 }}
            whileHover={{ scale: 1 }}
            className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center"
          >
            <ZoomIn className="w-8 h-8 text-white" />
          </motion.div>
        </motion.div>

        {/* Glow effect */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              "0 0 20px rgba(59, 130, 246, 0.3)",
              "0 0 40px rgba(168, 85, 247, 0.4)",
              "0 0 20px rgba(59, 130, 246, 0.3)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3"
      >
        <Button
          onClick={handleDownload}
          variant="outline"
          className="h-12 rounded-xl border-white/20 bg-white/5 hover:bg-white/10 text-white backdrop-blur-sm transition-all group"
        >
          <motion.div
            whileHover={{ y: -2 }}
            transition={{ type: "spring", stiffness: 300 }}
          >
            <Download className="w-4 h-4 mr-2" />
          </motion.div>
          下载图片
        </Button>

        <Button
          onClick={onTryAnother}
          className="h-12 rounded-xl bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 hover:from-blue-700 hover:via-purple-700 hover:to-pink-700 text-white font-semibold shadow-lg shadow-purple-500/50 hover:shadow-xl hover:shadow-purple-500/60 transition-all group"
        >
          <motion.div
            whileHover={{ rotate: 180 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
          </motion.div>
          再生成一张
        </Button>
      </motion.div>
    </motion.div>
  )
}

