"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Wand2, Sparkles, ArrowRight, ArrowLeft, CheckCircle2 } from "lucide-react"
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

type WizardStep = 1 | 2 | 3

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
]

const STEPS = [
  { num: 1, title: "产品信息", sub: "提取核心卖点" },
  { num: 2, title: "风格/地区", sub: "决定表现形式" },
  { num: 3, title: "脚本大纲", sub: "生成分镜 JSON" },
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
    setStyle(STYLE_PRESETS[0]?.value ?? "clean_saas")
    setRegion(REGION_PRESETS[0]?.value ?? "cn")
    setTone("专业、简洁、有画面感")
    setConstraints("")
  }, [])

  React.useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  const handleNext = () => {
    if (!canNext) return
    setDirection(1)
    setStep((s) => (Math.min(3, (s + 1) as WizardStep) as WizardStep))
  }

  const handlePrev = () => {
    setDirection(-1)
    setStep((s) => (Math.max(1, (s - 1) as WizardStep) as WizardStep))
  }

  const handleApply = () => {
    const prompt = buildPrompt({
      productName: productName.trim(),
      targetUsers: targetUsers.trim(),
      coreBenefits: coreBenefits.trim(),
      style,
      region,
      tone: tone.trim(),
      constraints: constraints.trim(),
    })

    const storyboard = generateMockStoryboard(durationSeconds)

    onApply({ prompt, storyboard })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden">
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
            通过 3 个步骤生成更稳定的提示词，并输出结构化分镜数据。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* ── Step indicator with connected progress ── */}
          <div className="relative">
            <div className="grid grid-cols-3 gap-2 relative z-10">
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
                animate={{ width: `${((step - 1) / 2) * 100}%` }}
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
                          className="min-h-24 bg-slate-950/40 border-white/10 rounded-xl focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                        />
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
                  <Card className="border-white/10 bg-white/[0.03] p-5">
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label className="text-slate-200 font-medium">风格</Label>
                        <Select value={style} onValueChange={setStyle}>
                          <SelectTrigger className="bg-slate-950/40 border-white/10 h-11 rounded-xl">
                            <SelectValue placeholder="选择风格" />
                          </SelectTrigger>
                          <SelectContent>
                            {STYLE_PRESETS.map((s) => (
                              <SelectItem key={s.value} value={s.value}>
                                {s.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-slate-200 font-medium">地区偏好</Label>
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
                        <Label className="text-slate-200 font-medium">语气/节奏（可选）</Label>
                        <Input
                          value={tone}
                          onChange={(e) => setTone(e.target.value)}
                          placeholder="例如：克制高级、节奏偏快"
                          className="bg-slate-950/40 border-white/10 h-11 rounded-xl focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                        />
                      </div>
                    </div>
                  </Card>
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
                      <div className="grid gap-2">
                        <Label className="text-slate-200 font-medium">约束与注意事项（可选）</Label>
                        <Textarea
                          value={constraints}
                          onChange={(e) => setConstraints(e.target.value)}
                          placeholder="例如：避免夸张承诺；字幕用简体中文；画面保持干净背景"
                          className="min-h-28 bg-slate-950/40 border-white/10 rounded-xl focus:border-blue-500/40 focus:ring-blue-500/20 transition-all"
                        />
                      </div>

                      <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4 overflow-hidden">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-xs font-medium text-slate-400">预览（将写入手动提示词框）</span>
                        </div>
                        <motion.pre
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.5 }}
                          className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300 max-h-40 overflow-y-auto custom-scrollbar"
                        >
                          {buildPrompt({
                            productName: productName.trim() || "（请填写产品名称）",
                            targetUsers: targetUsers.trim(),
                            coreBenefits: coreBenefits.trim(),
                            style,
                            region,
                            tone: tone.trim(),
                            constraints: constraints.trim(),
                          })}
                        </motion.pre>
                      </div>
                    </div>
                  </Card>
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
              {step < 3 ? (
                <motion.div whileHover={{ x: 3 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    onClick={handleNext}
                    disabled={!canNext}
                    className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6"
                  >
                    下一步
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button
                    onClick={handleApply}
                    className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl px-6 shadow-lg shadow-emerald-500/20"
                  >
                    {/* Shimmer sweep */}
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
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
