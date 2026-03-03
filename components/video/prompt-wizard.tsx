"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Wand2, Sparkles, ArrowRight, ArrowLeft, CheckCircle2, Loader2, Play, Globe, Languages, FileVideo, Package, ChevronRight, Edit, Clapperboard, Clock, ImagePlus, X } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type StoryboardShot = {
  camera: string
  text: string
  audio: string
  duration: number
}

export type PromptWizardResult = {
  prompt: string
  storyboard: StoryboardShot[]
}

export type Scenario = {
  id: string
  subject: string
  scene: string
  lighting_and_mood: string
  camera: string
  action_flow: string
  voice_style?: string
  tone_and_style?: string
  cta_hint?: string
}

type WizardStep = 1 | 2 | 3 | 4

const STYLE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "clean_saas", label: "现代 SaaS（干净高级）" },
  { value: "cinematic", label: "电影感（质感与镜头语言）" },
  { value: "commercial", label: "广告片（强卖点、快节奏）" },
  { value: "lifestyle", label: "生活方式（自然、真实、轻松）" },
]

const REGION_PRESETS: Array<{ value: string; label: string }> = [
  { value: "cn", label: "中国大陆" },
  { value: "hk", label: "中国香港" },
  { value: "tw", label: "中国台湾" },
  { value: "us", label: "美国" },
  { value: "eu", label: "欧洲" },
  { value: "jp", label: "日本" },
  { value: "sea", label: "东南亚" },
  { value: "kr", label: "韩国" },
  { value: "me", label: "中东" },
  { value: "latam", label: "拉美" },
  { value: "global", label: "全球" },
]

const LANGUAGE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "中文", label: "中文" },
  { value: "英语", label: "英语" },
  { value: "日语", label: "日语" },
  { value: "韩语", label: "韩语" },
  { value: "西班牙语", label: "西班牙语" },
  { value: "法语", label: "法语" },
  { value: "阿拉伯语", label: "阿拉伯语" },
  { value: "泰语", label: "泰语" },
  { value: "越南语", label: "越南语" },
  { value: "马来语", label: "马来语" },
]

const VIDEO_TYPE_PRESETS: Array<{ value: string; label: string }> = [
  { value: "产品展示", label: "产品展示" },
  { value: "开箱测评", label: "开箱测评" },
  { value: "使用教程", label: "使用教程" },
  { value: "品牌宣传", label: "品牌宣传" },
  { value: "促销广告", label: "促销广告" },
  { value: "场景种草", label: "场景种草" },
  { value: "对比测评", label: "对比测评" },
]

const STEPS = [
  { num: 1, title: "产品信息", sub: "提取核心卖点" },
  { num: 2, title: "方案推荐", sub: "选择拍摄方案" },
  { num: 3, title: "提示词", sub: "查看并编辑" },
  { num: 4, title: "分镜板", sub: "生成分镜脚本" },
] as const

function buildPrompt(params: {
  productName: string
  targetUsers: string
  coreBenefits: string
  style: string
  region: string
  tone: string
  constraints: string
}) {
  const { productName, targetUsers, coreBenefits, style, region, tone, constraints } =
    params

  return [
    `你是一个资深广告导演与分镜脚本创作者。`,
    `请为产品"${productName}"生成一个可用于 AI 视频生成的分镜脚本（Storyboard）。`,
    `目标用户：${targetUsers || "未指定"}。`,
    `核心卖点：${coreBenefits || "未指定"}。`,
    `风格：${style}。地区偏好：${region}。`,
    `语气/节奏：${tone || "专业、简洁、有画面感"}。`,
    constraints ? `约束与注意事项：${constraints}` : "",
    `输出要求：`,
    `- 返回 JSON 数组，每个元素为一个镜头。`,
    `- 每个镜头字段：camera（镜头/机位/运动）、text（画面描述）、audio（旁白/音效/字幕建议）、duration（秒，整数或 1 位小数）。`,
    `- 总时长与镜头节奏合理，镜头之间转场自然。`,
  ]
    .filter(Boolean)
    .join("\n")
}

/**
 * 解析 N8N 返回的分镜 text 字段
 * 格式："镜头描述：...旁白：'...'。画面风格：..."
 * 分离为 camera（镜头描述）、audio（旁白）、text（画面风格）
 */
function parseShotText(raw: string): { camera: string; text: string; audio: string } {
  let camera = ""
  let audio = ""
  let text = ""

  // 提取旁白（支持单引号、中文引号或无引号）
  const audioMatch = raw.match(/旁白[：:]\s*['‘]?([^'’。]*)['’]?/)
  if (audioMatch) {
    audio = audioMatch[1]?.trim() || ""
  }

  // 提取画面风格
  const styleMatch = raw.match(/画面风格[：:]\s*(.+?)$/)
  if (styleMatch) {
    text = styleMatch[1]?.replace(/[。.]$/, "").trim() || ""
  }

  // 提取镜头描述（从"镜头描述："到"旁白："或"画面风格："之前的内容）
  const cameraMatch = raw.match(/镜头描述[：:]\s*([\s\S]*?)(?:旁白[：:]|画面风格[：:]|$)/)
  if (cameraMatch) {
    camera = cameraMatch[1]?.replace(/[。.]$/, "").trim() || ""
  }

  // 如果没有匹配到任何字段，将整个文本放入 camera
  if (!camera && !audio && !text) {
    camera = raw
  }

  return { camera, text, audio }
}

function generateMockStoryboard(totalDuration: number): StoryboardShot[] {
  const shots: StoryboardShot[] = [
    {
      camera: "开场特写，轻微推近",
      text: "产品外观与关键细节，背景干净柔光",
      audio: "旁白：一眼看懂它为何不同。",
      duration: 2,
    },
    {
      camera: "中景，手持轻微移动，展示使用场景",
      text: "用户在真实场景中使用产品，动作自然",
      audio: "旁白：为你的日常效率加速。",
      duration: 3,
    },
    {
      camera: "分屏/叠字，快速切换 2-3 个卖点画面",
      text: "三大核心卖点逐条出现，对应画面同步展示",
      audio: "字幕：更快 / 更稳 / 更省心",
      duration: 4,
    },
    {
      camera: "收尾定格，产品与品牌信息居中",
      text: "品牌 logo + 产品名 + 口号，背景渐变",
      audio: "旁白：现在就开始体验。",
      duration: 2,
    },
  ]

  const sum = shots.reduce((acc, s) => acc + s.duration, 0)
  const delta = Math.max(0, totalDuration - sum)
  if (delta > 0) {
    shots.splice(3, 0, {
      camera: "跟拍，轻微环绕",
      text: "强调功能点落地，展示结果对比",
      audio: "音效：轻快上扬",
      duration: Number(delta.toFixed(1)),
    })
  }

  return shots
}

/* ── Slide animation variants ── */
const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 60 : -60,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -60 : 60,
    opacity: 0,
  }),
}

export function PromptWizardDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  durationSeconds: number
  onApply: (result: PromptWizardResult) => void
}) {
  const { open, onOpenChange, durationSeconds, onApply } = props

  const [step, setStep] = React.useState<WizardStep>(1)
  const [direction, setDirection] = React.useState(1)
  const [productName, setProductName] = React.useState("")
  const [targetUsers, setTargetUsers] = React.useState("")
  const [coreBenefits, setCoreBenefits] = React.useState("")
  const [productCategory, setProductCategory] = React.useState("")
  const [videoLanguage, setVideoLanguage] = React.useState("")
  const [videoType, setVideoType] = React.useState("")
  const [isExtracting, setIsExtracting] = React.useState(false)
  const [extractError, setExtractError] = React.useState("")
  const [isSubmittingStep, setIsSubmittingStep] = React.useState(false)
  // 向导内部图片上传（最多3张）
  const [wizardImages, setWizardImages] = React.useState<File[]>([])
  const [wizardPreviews, setWizardPreviews] = React.useState<string[]>([])
  const wizardFileRef = React.useRef<HTMLInputElement>(null)
  const [scenarios, setScenarios] = React.useState<Scenario[]>([])
  const [selectedScenarioId, setSelectedScenarioId] = React.useState<string | null>(null)
  const [generatedPrompt, setGeneratedPrompt] = React.useState("")
  // 第4步：分镜板数据（已解析为 StoryboardShot）
  const [storyboardData, setStoryboardData] = React.useState<StoryboardShot[]>([])
  const [isGeneratingStoryboard, setIsGeneratingStoryboard] = React.useState(false)

  const [style, setStyle] = React.useState(STYLE_PRESETS[0]?.value ?? "clean_saas")
  const [region, setRegion] = React.useState(REGION_PRESETS[0]?.value ?? "cn")
  const [tone, setTone] = React.useState("专业、简洁、有画面感")
  const [constraints, setConstraints] = React.useState("")

  const canNext = React.useMemo(() => {
    if (step === 1) return productName.trim().length > 0
    return true
  }, [step, productName])

  const reset = React.useCallback(() => {
    setStep(1)
    setDirection(1)
    setProductName("")
    setTargetUsers("")
    setCoreBenefits("")
    setProductCategory("")
    setVideoLanguage("")
    setVideoType("")
    setIsExtracting(false)
    setExtractError("")
    setIsSubmittingStep(false)
    setWizardImages([])
    setWizardPreviews([])
    setScenarios([])
    setSelectedScenarioId(null)
    setGeneratedPrompt("")
    setStoryboardData([])
    setIsGeneratingStoryboard(false)
    setStyle(STYLE_PRESETS[0]?.value ?? "clean_saas")
    setRegion(REGION_PRESETS[0]?.value ?? "cn")
    setTone("专业、简洁、有画面感")
    setConstraints("")
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  // 生成向导图片预览 URL
  React.useEffect(() => {
    const urls = wizardImages.map((f) => URL.createObjectURL(f))
    setWizardPreviews(urls)
    return () => urls.forEach((u) => URL.revokeObjectURL(u))
  }, [wizardImages])

  // 处理文件选择
  const handleWizardFileChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setWizardImages((prev) => {
      const combined = [...prev, ...files]
      return combined.slice(0, 3) // 最多3张
    })
    if (e.target) e.target.value = "" // 重置 input
  }, [])

  // 删除单张图片
  const removeWizardImage = React.useCallback((idx: number) => {
    setWizardImages((prev) => prev.filter((_, i) => i !== idx))
  }, [])

  const handleNext = async () => {
    if (!canNext) return

    // When leaving step 1, send form data to N8N with step=2 (no image)
    if (step === 1) {
      setIsSubmittingStep(true)
      setExtractError("")
      try {
        const fd = new FormData()
        fd.append("productCategory", productCategory)
        fd.append("region", REGION_PRESETS.find(r => r.value === region)?.label || region)
        fd.append("language", videoLanguage)
        fd.append("videoType", videoType)
        fd.append("productName", productName)
        fd.append("step", "2")
        fd.append("targetUsers", targetUsers)
        fd.append("coreBenefits", coreBenefits)

        const res = await fetch("/api/video/extract", {
          method: "POST",
          body: fd,
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || "提交失败")
        }
        // N8N may return data for step 2 form pre-fill
        const rawData = json.data
        const item = Array.isArray(rawData) ? rawData[0] : rawData
        const sb = item?.storyboard || item
        // Store scenarios for step 2 display
        if (Array.isArray(sb)) {
          setScenarios(sb)
          if (sb.length > 0) setSelectedScenarioId(sb[0].id)
        }
      } catch (err: any) {
        setExtractError(err?.message || "提交失败，请重试")
        setIsSubmittingStep(false)
        return // Don't advance on error
      } finally {
        setIsSubmittingStep(false)
      }
    }

    // When leaving step 2, send form data + selected scenario to N8N with step=3
    if (step === 2) {
      const selected = scenarios.find(s => s.id === selectedScenarioId)
      if (!selected) return

      setIsSubmittingStep(true)
      setExtractError("")
      try {
        const fd = new FormData()
        fd.append("productCategory", productCategory)
        fd.append("region", REGION_PRESETS.find(r => r.value === region)?.label || region)
        fd.append("language", videoLanguage)
        fd.append("videoType", videoType)
        fd.append("productName", productName)
        fd.append("step", "3")
        fd.append("targetUsers", targetUsers)
        fd.append("coreBenefits", coreBenefits)
        fd.append("selectedScenario", JSON.stringify(selected))

        const res = await fetch("/api/video/extract", {
          method: "POST",
          body: fd,
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || "提交失败")
        }
        // N8N returns { success: true, prompt: rawString }
        const rawData = json.data
        const item = Array.isArray(rawData) ? rawData[0] : rawData
        if (item?.prompt) {
          setGeneratedPrompt(item.prompt)
        }
      } catch (err: any) {
        setExtractError(err?.message || "提交失败，请重试")
        setIsSubmittingStep(false)
        return
      } finally {
        setIsSubmittingStep(false)
      }
    }

    // 从步骤3进入步骤4时，调用 N8N 获取分镜板数据
    if (step === 3) {
      setIsGeneratingStoryboard(true)
      setIsSubmittingStep(true)
      setExtractError("")
      try {
        const fd = new FormData()
        fd.append("productCategory", productCategory)
        fd.append("region", REGION_PRESETS.find(r => r.value === region)?.label || region)
        fd.append("language", videoLanguage)
        fd.append("videoType", videoType)
        fd.append("productName", productName)
        fd.append("step", "4")
        fd.append("targetUsers", targetUsers)
        fd.append("coreBenefits", coreBenefits)
        fd.append("prompt", generatedPrompt)
        const selected = scenarios.find(s => s.id === selectedScenarioId)
        if (selected) fd.append("selectedScenario", JSON.stringify(selected))

        const res = await fetch("/api/video/extract", {
          method: "POST",
          body: fd,
        })
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error || "生成分镜板失败")
        }
        // 解析返回数据：[{ success, prompt: [{ text, duration }] }]
        const rawData = json.data
        const item = Array.isArray(rawData) ? rawData[0] : rawData
        const promptArr = item?.prompt || []
        if (Array.isArray(promptArr)) {
          // 解析每个分镜的 text 字段，分离出 camera/audio/text
          const parsed: StoryboardShot[] = promptArr.map((s: any) => {
            const { camera, text: styleText, audio } = parseShotText(s.text || "")
            return {
              camera,
              text: styleText,
              audio,
              duration: s.duration || 2,
            }
          })
          setStoryboardData(parsed)
        }
      } catch (err: any) {
        setExtractError(err?.message || "生成分镜板失败，请重试")
        setIsSubmittingStep(false)
        setIsGeneratingStoryboard(false)
        return
      } finally {
        setIsSubmittingStep(false)
        setIsGeneratingStoryboard(false)
      }
    }

    setDirection(1)
    setStep((s) => (Math.min(4, (s + 1) as WizardStep) as WizardStep))
  }

  const handlePrev = () => {
    setDirection(-1)
    setStep((s) => (Math.max(1, (s - 1)) as WizardStep))
  }

  const handleApply = () => {
    let storyboard: StoryboardShot[]
    let finalPrompt = generatedPrompt

    if (step === 4 && storyboardData.length > 0) {
      // 步骤4：使用已解析的分镜数据
      storyboard = storyboardData

      // 将分镜数据转为格式化提示词，时间为累计范围
      const lines: string[] = []
      let cumulative = 0
      storyboardData.forEach((shot, idx) => {
        const start = cumulative
        cumulative += shot.duration
        lines.push(`Shot ${idx + 1}`)
        lines.push(`Duration：${start}~${cumulative}`)
        lines.push(`Scene：${shot.camera}`)
        if (shot.audio) lines.push(`Voiceover：${shot.audio}`)
        if (shot.text) lines.push(`Style：${shot.text}`)
        lines.push("") // 空行分隔
      })
      finalPrompt = lines.join("\n").trim()
    } else {
      // 步骤3：直接应用，使用 mock 分镜
      storyboard = generateMockStoryboard(durationSeconds)
    }

    onApply({ prompt: finalPrompt, storyboard })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 12, -12, 0] }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              <Wand2 className="h-5 w-5 text-blue-400" />
            </motion.div>
            提示词向导
          </DialogTitle>
          <DialogDescription>
            通过 4 个步骤生成更稳定的提示词，并输出结构化分镜数据。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* ── Step indicator with connected progress ── */}
          <div className="relative">
            <div className="grid grid-cols-4 gap-2 relative z-10">
              {STEPS.map((s) => {
                const isActive = step === s.num
                const isDone = step > s.num
                return (
                  <motion.div
                    key={s.num}
                    layout
                    className={[
                      "relative rounded-xl px-3 py-2.5 border transition-all duration-300",
                      isActive
                        ? "border-blue-500/40 bg-blue-500/10 shadow-sm shadow-blue-500/10"
                        : isDone
                          ? "border-emerald-500/20 bg-emerald-500/5"
                          : "border-white/10 bg-white/[0.03]",
                    ].join(" ")}
                  >
                    {/* Active pulse ring */}
                    {isActive && (
                      <motion.div
                        className="absolute inset-0 rounded-xl border border-blue-500/30"
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                    )}
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-white">
                        {s.num}. {s.title}
                      </div>
                      {isDone ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 400, damping: 15 }}
                        >
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        </motion.div>
                      ) : isActive ? (
                        <motion.div
                          animate={{ rotate: [0, 360] }}
                          transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
                        >
                          <Sparkles className="h-4 w-4 text-blue-400" />
                        </motion.div>
                      ) : (
                        <Sparkles className="h-4 w-4 text-slate-600" />
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.sub}</div>
                  </motion.div>
                )
              })}
            </div>

            {/* Connected progress bar */}
            <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-0.5 bg-white/5 mx-4 z-0 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full"
                animate={{ width: `${((step - 1) / 3) * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* ── Step content with slide transitions ── */}
          <div className="relative min-h-[260px]">
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 && (
                <motion.div
                  key="step1"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Card className="border-white/10 bg-white/[0.03] p-5">
                    <div className="grid gap-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="grid gap-2">
                          <Label className="text-slate-200 font-medium">产品名称</Label>
                          <Input
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                            placeholder="例如：X1 智能护眼台灯"
                            className="bg-slate-950/40 border-white/10 h-11 rounded-xl focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Package className="h-3.5 w-3.5 text-blue-400" />
                            产品类目
                          </Label>
                          <Input
                            value={productCategory}
                            onChange={(e) => setProductCategory(e.target.value)}
                            placeholder="例如：智能家居、美妆护肤"
                            className="bg-slate-950/40 border-white/10 h-11 rounded-xl focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="grid gap-2">
                          <Label className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Globe className="h-3.5 w-3.5 text-emerald-400" />
                            销售/投放地区
                          </Label>
                          <Select value={region} onValueChange={setRegion}>
                            <SelectTrigger className="bg-slate-950/40 border-white/10 h-11 rounded-xl">
                              <SelectValue placeholder="选择地区" />
                            </SelectTrigger>
                            <SelectContent>
                              {REGION_PRESETS.map((r) => (
                                <SelectItem key={r.value} value={r.value}>
                                  {r.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <Languages className="h-3.5 w-3.5 text-amber-400" />
                            视频语言
                          </Label>
                          <Select value={videoLanguage} onValueChange={setVideoLanguage}>
                            <SelectTrigger className="bg-slate-950/40 border-white/10 h-11 rounded-xl">
                              <SelectValue placeholder="选择语言" />
                            </SelectTrigger>
                            <SelectContent>
                              {LANGUAGE_PRESETS.map((l) => (
                                <SelectItem key={l.value} value={l.value}>
                                  {l.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label className="flex items-center gap-1.5 text-slate-200 font-medium">
                            <FileVideo className="h-3.5 w-3.5 text-violet-400" />
                            视频类型
                          </Label>
                          <Select value={videoType} onValueChange={setVideoType}>
                            <SelectTrigger className="bg-slate-950/40 border-white/10 h-11 rounded-xl">
                              <SelectValue placeholder="选择类型" />
                            </SelectTrigger>
                            <SelectContent>
                              {VIDEO_TYPE_PRESETS.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-slate-200 font-medium">目标用户（可选）</Label>
                        <Input
                          value={targetUsers}
                          onChange={(e) => setTargetUsers(e.target.value)}
                          placeholder="例如：学生、居家办公人群"
                          className="bg-slate-950/40 border-white/10 h-11 rounded-xl focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-slate-200 font-medium">核心卖点（可选）</Label>
                        <Textarea
                          value={coreBenefits}
                          onChange={(e) => setCoreBenefits(e.target.value)}
                          placeholder="例如：无频闪、自动调光、AI 学习模式"
                          className="min-h-20 bg-slate-950/40 border-white/10 rounded-xl focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                        />
                      </div>

                      {/* 产品图上传区域 */}
                      <div className="grid gap-2">
                        <Label className="flex items-center gap-1.5 text-slate-200 font-medium">
                          <ImagePlus className="h-3.5 w-3.5 text-blue-400" />
                          产品图片（最多 3 张，可选）
                        </Label>
                        <div className="flex items-center gap-3">
                          {wizardPreviews.map((url, idx) => (
                            <div key={idx} className="group relative h-16 w-16 overflow-hidden rounded-xl border border-white/15 bg-white/5 shadow-inner">
                              <img src={url} alt={`产品图 ${idx + 1}`} className="h-full w-full object-cover" />
                              <button
                                type="button"
                                onClick={() => removeWizardImage(idx)}
                                className="absolute top-0.5 right-0.5 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="h-3 w-3 text-white" />
                              </button>
                            </div>
                          ))}
                          {wizardImages.length < 3 && (
                            <button
                              type="button"
                              onClick={() => wizardFileRef.current?.click()}
                              className="flex h-16 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 bg-white/[0.03] text-slate-500 hover:border-blue-500/30 hover:text-blue-400 transition-all"
                            >
                              <ImagePlus className="h-5 w-5" />
                            </button>
                          )}
                          <input
                            ref={wizardFileRef}
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={handleWizardFileChange}
                          />
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {scenarios.length === 0 ? (
                    <Card className="border-white/10 bg-white/[0.03] p-8 flex flex-col items-center justify-center gap-3 min-h-[260px]">
                      <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                      <p className="text-sm text-slate-400">正在生成方案推荐...</p>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[520px] overflow-y-auto custom-scrollbar pr-1">
                      {scenarios.map((sc, idx) => {
                        const isSelected = selectedScenarioId === sc.id
                        const tags = sc.tone_and_style ? sc.tone_and_style.split(",").map(t => t.trim()).filter(Boolean) : []
                        const actionLines = sc.action_flow ? sc.action_flow.trim().split("\n").filter(Boolean) : []
                        return (
                          <motion.div
                            key={sc.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1, duration: 0.3 }}
                          >
                            <Card
                              className={[
                                "relative border p-4 space-y-3 transition-all duration-300 cursor-pointer hover:border-blue-500/30",
                                isSelected
                                  ? "border-blue-500/40 bg-blue-500/5 shadow-lg shadow-blue-500/10"
                                  : "border-white/10 bg-white/[0.03]",
                              ].join(" ")}
                              onClick={() => setSelectedScenarioId(sc.id)}
                            >
                              {/* Selected badge */}
                              {isSelected && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="absolute -top-2 -right-2 rounded-full bg-blue-500 p-1"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                                </motion.div>
                              )}

                              {/* Scene description */}
                              <p className="text-sm text-slate-200 leading-relaxed">{sc.scene}</p>

                              {/* Metadata tags */}
                              <div className="space-y-2">
                                <div className="flex items-start gap-2">
                                  <span className="shrink-0 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">主体</span>
                                  <p className="text-xs text-slate-400 leading-relaxed">{sc.subject}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="shrink-0 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">光线</span>
                                  <p className="text-xs text-slate-400 leading-relaxed">{sc.lighting_and_mood}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="shrink-0 rounded bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400">镜头</span>
                                  <p className="text-xs text-slate-400 leading-relaxed">{sc.camera}</p>
                                </div>
                              </div>

                              {/* Action flow */}
                              {actionLines.length > 0 && (
                                <div className="space-y-1">
                                  <span className="rounded bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-blue-400">动作</span>
                                  <ol className="mt-1.5 space-y-1 pl-0">
                                    {actionLines.map((a: string, i: number) => (
                                      <li key={i} className="text-xs text-slate-400 leading-relaxed">
                                        {i + 1}. {a.trim()}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {/* Tone/style tags */}
                              {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                  {tags.map((tag, i) => (
                                    <span key={i} className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] text-slate-300">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Select button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setSelectedScenarioId(sc.id)
                                }}
                                className={[
                                  "mt-2 flex w-full items-center justify-center gap-2 rounded-xl border py-2 text-sm font-medium transition-all",
                                  isSelected
                                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                                    : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/5 hover:text-white",
                                ].join(" ")}
                              >
                                {isSelected ? "已选择此方案" : "选择此方案"}
                                <ChevronRight className="h-4 w-4" />
                                <Edit className="h-3.5 w-3.5 ml-auto opacity-50" />
                              </button>
                            </Card>
                          </motion.div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  <Card className="border-white/10 bg-white/[0.03] p-5">
                    <div className="grid gap-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <Label className="text-slate-200 font-medium">提示词内容</Label>
                        </div>
                        <span className="text-xs font-medium tabular-nums text-slate-500">
                          {generatedPrompt.length} 字
                        </span>
                      </div>
                      <Textarea
                        value={generatedPrompt}
                        onChange={(e) => setGeneratedPrompt(e.target.value)}
                        placeholder="N8N 返回的提示词将显示在这里，您可以自由编辑..."
                        className="min-h-[320px] bg-slate-950/40 border-white/10 rounded-xl text-sm leading-relaxed text-slate-200 placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-blue-500/20 transition-all custom-scrollbar"
                      />
                      <p className="text-xs text-slate-500">
                        ℹ️ 您可以直接编辑上方内容，点击「生成并应用」直接应用，或点击「下一步」生成分镜板。
                      </p>
                    </div>
                  </Card>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                  {storyboardData.length === 0 ? (
                    <Card className="border-white/10 bg-white/[0.03] p-8 flex flex-col items-center justify-center gap-3 min-h-[260px]">
                      <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
                      <p className="text-sm text-slate-400">正在生成分镜板...</p>
                    </Card>
                  ) : (
                    <div className="space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar pr-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Clapperboard className="h-4 w-4 text-blue-400" />
                          <span className="text-sm font-medium text-slate-200">分镜脚本 · {storyboardData.length} 个镜头</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          总时长 {storyboardData.reduce((acc, s) => acc + s.duration, 0)} 秒
                        </span>
                      </div>
                      {storyboardData.map((shot, idx) => (
                        <motion.div
                          key={idx}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.08, duration: 0.3 }}
                        >
                          <Card className="border-white/10 bg-white/[0.03] p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-blue-500/15 border border-blue-500/30 text-[11px] font-bold text-blue-400">
                                  {idx + 1}
                                </span>
                                <span className="text-sm font-medium text-slate-200">镜头 {idx + 1}</span>
                              </div>
                              <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5">
                                <Clock className="h-3 w-3 text-emerald-400" />
                                <span className="text-[11px] font-medium text-emerald-300">{shot.duration}s</span>
                              </div>
                            </div>

                            {/* 镜头描述 */}
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                <span className="shrink-0 rounded bg-violet-500/15 border border-violet-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-violet-400">镜头</span>
                              </div>
                              <Textarea
                                value={shot.camera}
                                onChange={(e) => {
                                  const d = [...storyboardData]
                                  d[idx] = { ...d[idx], camera: e.target.value }
                                  setStoryboardData(d)
                                }}
                                className="min-h-[60px] bg-slate-950/40 border-white/10 rounded-xl text-sm leading-relaxed text-slate-300 placeholder:text-slate-600 focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                              />
                            </div>

                            {/* 旁白 */}
                            {shot.audio && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="shrink-0 rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">旁白</span>
                                </div>
                                <Input
                                  value={shot.audio}
                                  onChange={(e) => {
                                    const d = [...storyboardData]
                                    d[idx] = { ...d[idx], audio: e.target.value }
                                    setStoryboardData(d)
                                  }}
                                  className="bg-slate-950/40 border-white/10 h-9 rounded-xl text-sm text-slate-300 focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                                />
                              </div>
                            )}

                            {/* 画面风格 */}
                            {shot.text && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="shrink-0 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">风格</span>
                                </div>
                                <Input
                                  value={shot.text}
                                  onChange={(e) => {
                                    const d = [...storyboardData]
                                    d[idx] = { ...d[idx], text: e.target.value }
                                    setStoryboardData(d)
                                  }}
                                  className="bg-slate-950/40 border-white/10 h-9 rounded-xl text-sm text-slate-300 focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                                />
                              </div>
                            )}
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex w-full items-center justify-between">
            <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}>
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={step === 1}
                className="text-slate-200 hover:bg-white/10 rounded-xl"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                上一步
              </Button>
            </motion.div>

            <div className="flex items-center gap-2">
              {/* Extract error */}
              <AnimatePresence>
                {extractError && (
                  <motion.span
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="text-xs text-red-400 mr-2"
                  >
                    {extractError}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* 开始提取 — 在步骤1且已上传图片时显示 */}
              {step === 1 && wizardImages.length > 0 && (
                <motion.div
                  whileHover={!isExtracting ? { scale: 1.03 } : {}}
                  whileTap={!isExtracting ? { scale: 0.97 } : {}}
                >
                  <Button
                    disabled={isExtracting}
                    onClick={async () => {
                      setIsExtracting(true)
                      setExtractError("")
                      try {
                        const fd = new FormData()
                        // 发送所有上传的产品图
                        wizardImages.forEach((file) => {
                          fd.append("image", file)
                        })
                        fd.append("productCategory", productCategory)
                        fd.append("region", REGION_PRESETS.find(r => r.value === region)?.label || region)
                        fd.append("language", videoLanguage)
                        fd.append("videoType", videoType)
                        fd.append("prompt", productName)
                        fd.append("step", String(step))

                        const res = await fetch("/api/video/extract", {
                          method: "POST",
                          body: fd,
                        })
                        const json = await res.json()
                        if (!res.ok || !json.success) {
                          throw new Error(json.error || "提取失败")
                        }
                        const rawData = json.data
                        const item = Array.isArray(rawData) ? rawData[0] : rawData
                        const sb = item?.storyboard || item
                        if (sb.product_name) setProductName(sb.product_name)
                        if (sb.product_category) setProductCategory(sb.product_category)
                        if (sb.core_selling_points) {
                          const points = Array.isArray(sb.core_selling_points)
                            ? sb.core_selling_points.join("\n")
                            : sb.core_selling_points
                          setCoreBenefits(points)
                        }
                        if (sb.target_audience) setTargetUsers(sb.target_audience)
                      } catch (err: any) {
                        setExtractError(err?.message || "提取失败，请重试")
                      } finally {
                        setIsExtracting(false)
                      }
                    }}
                    className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl px-5 shadow-lg shadow-emerald-500/20 gap-2"
                  >
                    {isExtracting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 fill-current stroke-[1.5px]" />
                    )}
                    <span>{isExtracting ? "提取中..." : "开始提取"}</span>
                  </Button>
                </motion.div>
              )}

              {step < 3 ? (
                <motion.div whileHover={!isSubmittingStep ? { x: 3 } : {}} whileTap={!isSubmittingStep ? { scale: 0.95 } : {}}>
                  <Button
                    onClick={handleNext}
                    disabled={!canNext || isSubmittingStep}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 gap-2"
                  >
                    {isSubmittingStep ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        加载中...
                      </>
                    ) : (
                      <>
                        下一步
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </motion.div>
              ) : step === 3 ? (
                /* 步骤3：同时显示「生成并应用」和「下一步：生成分镜板」 */
                <div className="flex items-center gap-2">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      onClick={handleApply}
                      className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl px-5 shadow-lg shadow-emerald-500/20"
                    >
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                        initial={{ x: "-100%" }}
                        animate={{ x: "200%" }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                      />
                      <span className="relative flex items-center gap-2">
                        生成并应用
                        <Wand2 className="h-4 w-4" />
                      </span>
                    </Button>
                  </motion.div>
                  <motion.div whileHover={!isSubmittingStep ? { x: 3 } : {}} whileTap={!isSubmittingStep ? { scale: 0.95 } : {}}>
                    <Button
                      onClick={handleNext}
                      disabled={isSubmittingStep}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-5 gap-2"
                    >
                      {isSubmittingStep ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          生成中...
                        </>
                      ) : (
                        <>
                          生成分镜板
                          <Clapperboard className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </motion.div>
                </div>
              ) : (
                /* 步骤4：分镜板确认并应用 */
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    onClick={handleApply}
                    disabled={storyboardData.length === 0}
                    className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl px-6 shadow-lg shadow-emerald-500/20"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                    />
                    <span className="relative flex items-center gap-2">
                      确认并应用
                      <Wand2 className="h-4 w-4" />
                    </span>
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
