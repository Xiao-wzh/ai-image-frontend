"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Rocket, BrainCircuit, Palette, Wand2 } from "lucide-react"

const loadingSteps = [
  { Icon: Rocket, text: "上传到安全云端" },
  { Icon: BrainCircuit, text: "AI 分析图像构图" },
  { Icon: Palette, text: "渲染高清细节" },
  { Icon: Wand2, text: "最后润色中" },
]

export function GenerationLoading() {
  const [currentStep, setCurrentStep] = useState(0)
  const [showCursor, setShowCursor] = useState(true)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev + 1) % loadingSteps.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  // Smooth blinking cursor
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 530)

    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-2xl mx-auto space-y-4"
    >
      {/* Cyberpunk Scanning Box */}
      <div className="relative aspect-[3/4] max-h-[60vh] mx-auto rounded-2xl overflow-hidden border border-white/10 bg-slate-900/50 backdrop-blur-sm">
        {/* Grid Pattern Background */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59, 130, 246, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Primary Scan Line */}
        <motion.div
          className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_20px_rgba(168,85,247,0.8)]"
          animate={{
            top: ["0%", "100%", "0%"],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Secondary Scan Line */}
        <motion.div
          className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-40"
          animate={{
            top: ["100%", "0%", "100%"],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Corner Brackets */}
        <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-purple-500/50" />
        <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-purple-500/50" />
        <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-purple-500/50" />
        <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-purple-500/50" />

        {/* Pulsing Rings */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={{
            scale: [1, 1.3, 1],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <div className="w-40 h-40 rounded-full border-2 border-purple-500/30" />
        </motion.div>

        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={{
            scale: [1, 1.5, 1],
            opacity: [0.1, 0.3, 0.1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 0.5,
          }}
        >
          <div className="w-56 h-56 rounded-full border border-blue-500/20" />
        </motion.div>

        {/* Center Icon - Animated Sparkles */}
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          animate={{
            opacity: [0.5, 1, 0.5],
            scale: [0.95, 1.05, 0.95],
            rotate: [0, 5, -5, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Sparkles className="w-16 h-16 text-purple-400" strokeWidth={1.5} />
        </motion.div>

        {/* Glowing Edges */}
        <motion.div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              "inset 0 0 30px rgba(59, 130, 246, 0.1)",
              "inset 0 0 50px rgba(168, 85, 247, 0.2)",
              "inset 0 0 30px rgba(59, 130, 246, 0.1)",
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      {/* Indeterminate Loading Bar */}
      <div className="relative h-1 bg-slate-800/50 rounded-full overflow-hidden">
        {/* Moving gradient scanner */}
        <motion.div
          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-purple-500 to-transparent shadow-[0_0_10px_rgba(168,85,247,0.8)]"
          animate={{
            x: ["-100%", "300%"],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      {/* Cycling Status Text with Cursor */}
      <div className="relative h-10 flex items-center justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.4 }}
            className="absolute flex items-center gap-2"
          >
            {/* Lucide Icon instead of Emoji */}
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {(() => {
                const { Icon } = loadingSteps[currentStep]
                return <Icon className="w-5 h-5 text-purple-400" />
              })()}
            </motion.div>
            
            <span className="text-base font-medium text-slate-300 flex items-center">
              {loadingSteps[currentStep].text}
              <motion.span
                animate={{ opacity: showCursor ? 1 : 0 }}
                transition={{ duration: 0.1 }}
                className="inline-block w-0.5 h-5 bg-purple-400 ml-1"
              />
            </span>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
