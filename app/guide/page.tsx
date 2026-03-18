"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
    Sparkles,
    User,
    Wallet,
    Images,
    ListTodo,
    ShieldCheck,
    Gift,
    Droplets,
    Eraser,
    FileText,
    Crown,
    Zap,
    ChevronRight,
    ChevronLeft,
    Search,
    BookOpen,
    Home,
    Menu,
    X,
    ArrowLeft,
    Check,
    AlertCircle,
    HelpCircle,
    Star
} from "lucide-react"

// 教程数据结构
interface GuideSection {
    id: string
    title: string
    icon: any
    color: string
    description: string
    subsections: {
        id: string
        title: string
        content: React.ReactNode
    }[]
}

// 教程内容数据
const guideData: GuideSection[] = [
    {
        id: "getting-started",
        title: "新手入门",
        icon: User,
        color: "from-blue-500 to-cyan-500",
        description: "注册账号、了解积分系统",
        subsections: [
            {
                id: "register",
                title: "账号注册与登录",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-blue-400" />
                                邮箱登录方式
                            </h3>
                            <p className="text-slate-300 mb-4">本平台使用邮箱登录，无需记忆密码，简单安全。</p>
                            <div className="space-y-3">
                                {[
                                    "点击页面右上角的「登录/注册」按钮",
                                    "在弹出的对话框中输入你的邮箱地址",
                                    "点击「发送验证邮件」",
                                    "前往邮箱，找到验证邮件并点击链接",
                                    "自动登录成功！"
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-3 text-slate-300">
                                        <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400">
                                            {i + 1}
                                        </div>
                                        {step}
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <div className="flex items-center gap-2 text-amber-400 font-medium mb-1">
                                    <AlertCircle className="w-4 h-4" />
                                    注意
                                </div>
                                <p className="text-sm text-slate-400">验证链接有效期为 24 小时，过期后需要重新发送。</p>
                            </div>
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Gift className="w-5 h-5 text-purple-400" />
                                使用邀请码注册
                            </h3>
                            <p className="text-slate-300 mb-4">使用朋友分享的邀请码注册，可以获得额外积分奖励！</p>
                            <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                                <div className="flex items-center gap-2 text-purple-400 font-medium mb-1">
                                    <Star className="w-4 h-4" />
                                    提示
                                </div>
                                <p className="text-sm text-slate-400">使用邀请码注册，你将获得额外的积分奖励！</p>
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "credits",
                title: "积分系统介绍",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">什么是积分？</h3>
                            <p className="text-slate-300">积分是平台的使用货币，每次使用 AI 功能都会消耗一定数量的积分。</p>
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">积分类型</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                    <div className="text-blue-400 font-bold mb-2">付费积分</div>
                                    <p className="text-sm text-slate-400">通过充值购买的积分，优先消耗</p>
                                </div>
                                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                                    <div className="text-purple-400 font-bold mb-2">赠送积分</div>
                                    <p className="text-sm text-slate-400">活动赠送、邀请奖励等，其次消耗</p>
                                </div>
                            </div>
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">充值积分</h3>
                            <div className="space-y-3">
                                {[
                                    "点击积分余额旁边的「+」按钮",
                                    "选择你想购买的积分套餐",
                                    "使用微信扫码支付",
                                    "支付成功后积分立即到账"
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-3 text-slate-300">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">
                                            {i + 1}
                                        </div>
                                        {step}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }
        ]
    },
    {
        id: "ai-generation",
        title: "AI 生图",
        icon: Sparkles,
        color: "from-purple-500 to-pink-500",
        description: "主图生成、详情页、PRO 模式",
        subsections: [
            {
                id: "overview",
                title: "生图概述",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">选择生成模式</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                <div className="p-5 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Zap className="w-5 h-5 text-blue-400" />
                                        <span className="font-bold text-white">标准极速</span>
                                    </div>
                                    <ul className="space-y-2 text-sm text-slate-300">
                                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 快速出图，适合批量操作</li>
                                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 固定价格（199 积分起）</li>
                                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 固定 9 张输出</li>
                                    </ul>
                                </div>
                                <div className="p-5 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Crown className="w-5 h-5 text-amber-400" />
                                        <span className="font-bold text-white">PRO 增强</span>
                                    </div>
                                    <ul className="space-y-2 text-sm text-slate-300">
                                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 高画质精品，精细控制</li>
                                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 按张计费（100 积分/张）</li>
                                        <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> 可选张数和比例</li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">选择生成内容</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
                                    <div className="font-bold text-purple-400 mb-2">主图生成</div>
                                    <p className="text-sm text-slate-400">商品主图，用于商品列表、搜索结果，输出 9 张精选主图</p>
                                </div>
                                <div className="p-4 bg-pink-500/10 border border-pink-500/30 rounded-xl">
                                    <div className="font-bold text-pink-400 mb-2">详情页</div>
                                    <p className="text-sm text-slate-400">商品详情图，用于详情页展示，输出 6 张（可分批）</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "standard-mode",
                title: "标准极速模式",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Zap className="w-5 h-5 text-blue-400" />
                                主图生成流程
                            </h3>

                            <div className="space-y-6">
                                <div className="p-4 bg-slate-800/50 rounded-xl">
                                    <h4 className="font-bold text-white mb-3">第一步：选择平台和风格</h4>
                                    <div className="space-y-3 text-slate-300">
                                        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                            <strong className="text-blue-400">国外平台</strong>：统一使用「亚马逊」风格
                                        </div>
                                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                                            <strong className="text-emerald-400">国内平台</strong>：根据实际平台选择（淘宝、京东、拼多多等）
                                        </div>
                                    </div>
                                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                                        <p className="text-sm text-amber-300">
                                            <strong>关于风格括号说明：</strong>「无字」表示生成的图片不包含任何文字。没有说明的默认会生成卖点文字。
                                        </p>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-800/50 rounded-xl">
                                    <h4 className="font-bold text-white mb-3">第二步：填写商品名称</h4>
                                    <p className="text-slate-300 mb-3">尽可能填写完整的商品名称，建议直接复制电商平台上的商品标题。</p>
                                    <div className="space-y-2">
                                        <div className="p-2 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
                                            ❌ 不推荐：浴室地垫
                                        </div>
                                        <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm text-emerald-300">
                                            ✅ 推荐：浴室防滑地垫 卫生间吸水脚垫 硅藻泥垫子 厕所门口地毯 家用脚踏垫
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-800/50 rounded-xl">
                                    <h4 className="font-bold text-white mb-3">第三步：选择输出语言</h4>
                                    <p className="text-slate-300">选择图片上文字（标题、卖点）的语言，根据目标市场选择。</p>
                                </div>

                                <div className="p-4 bg-slate-800/50 rounded-xl">
                                    <h4 className="font-bold text-white mb-3">第四步：上传商品图片</h4>
                                    <p className="text-slate-300">建议上传白底三视图（正面+侧面+背面），不超过 5 张。</p>
                                </div>

                                <div className="p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl">
                                    <h4 className="font-bold text-amber-400 mb-3 flex items-center gap-2">
                                        <Gift className="w-5 h-5" />
                                        套餐优惠
                                    </h4>
                                    <p className="text-slate-300 mb-3">勾选「同时生成详情页」可享受超值套餐价！</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 bg-emerald-500/20 rounded-lg text-center">
                                            <div className="text-2xl font-bold text-emerald-400">298</div>
                                            <div className="text-xs text-slate-400">套餐价（主图+详情+水印）</div>
                                        </div>
                                        <div className="p-3 bg-slate-700/50 rounded-lg text-center">
                                            <div className="text-2xl font-bold text-slate-400 line-through">398</div>
                                            <div className="text-xs text-slate-400">分开购买</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "pro-mode",
                title: "PRO 增强模式",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Crown className="w-5 h-5 text-amber-400" />
                                PRO 模式专属功能
                            </h3>

                            <div className="space-y-6">
                                <div className="p-4 bg-slate-800/50 rounded-xl">
                                    <h4 className="font-bold text-white mb-3">选择生成张数</h4>
                                    <div className="grid grid-cols-4 gap-3">
                                        {[{ n: 1, p: 100 }, { n: 3, p: 300 }, { n: 5, p: 500 }, { n: 9, p: 500, special: true }].map((item) => (
                                            <div key={item.n} className={`p-3 rounded-xl text-center ${item.special ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/50' : 'bg-slate-700/50'}`}>
                                                <div className="text-lg font-bold text-white">{item.n} 张</div>
                                                <div className={`text-sm ${item.special ? 'text-emerald-400' : 'text-slate-400'}`}>{item.p} 积分</div>
                                                {item.special && <div className="text-xs text-amber-400 mt-1">特惠！省400</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-800/50 rounded-xl">
                                    <h4 className="font-bold text-white mb-3">选择画幅比例</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { r: "1:1", desc: "正方形主图" },
                                            { r: "3:4", desc: "竖版" },
                                            { r: "4:3", desc: "横版" },
                                            { r: "16:9", desc: "宽屏" },
                                            { r: "9:16", desc: "竖屏" }
                                        ].map((item) => (
                                            <div key={item.r} className="px-3 py-2 bg-slate-700/50 rounded-lg">
                                                <span className="font-mono text-white">{item.r}</span>
                                                <span className="text-xs text-slate-400 ml-2">{item.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-800/50 rounded-xl">
                                    <h4 className="font-bold text-white mb-3">产品功能（可选,最好填写）</h4>
                                    <p className="text-slate-300 mb-3">告诉 AI 你的产品有什么特点，如果不知道填什么的话可以直接复制商品名称填写进去。
                                        <br/>详情页可以填写每屏文案：</p>
                                    <div className="p-3 bg-slate-900/50 rounded-lg font-mono text-sm text-slate-300">
                                        第一屏文案：至臻精选，性价比之王<br/>
                                        第二屏文案：香糯可口，好吃解腻
                                    </div>
                                </div>

                                <div className="p-4 bg-slate-800/50 rounded-xl">
                                    <h4 className="font-bold text-white mb-3">画面风格（可选）</h4>
                                    <p className="text-slate-300">指定图片的整体风格，如：赛博朋克、极简高级灰、清新自然等</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "clone-mode",
                title: "克隆模式",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">克隆模式（仅详情页）</h3>
                            <p className="text-slate-300 mb-4">克隆模式可以复制参考图的构图风格，快速生成相似风格的图片。</p>

                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl mb-6">
                                <p className="text-amber-300">克隆模式目前仅支持详情页生成，主图暂不支持。</p>
                            </div>

                            <div className="p-4 bg-slate-800/50 rounded-xl">
                                <h4 className="font-bold text-white mb-3">克隆规则</h4>
                                <p className="text-slate-300 mb-3">上传几张参考图，就会克隆几张：</p>
                                <div className="space-y-2">
                                    <div className="p-3 bg-slate-700/50 rounded-lg">
                                        <strong className="text-white">4 张参考图：</strong>
                                        <span className="text-slate-300"> 总共 6 张，图 1-4 克隆，图 5-6 自动生成</span>
                                    </div>
                                    <div className="p-3 bg-slate-700/50 rounded-lg">
                                        <strong className="text-white">6 张参考图：</strong>
                                        <span className="text-slate-300"> 全部 6 张克隆参考图</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "upload-tips",
                title: "上传图片技巧",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">图片要求</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: "格式", value: "PNG/JPG/JPEG/WebP" },
                                    { label: "数量", value: "建议 ≤ 5 张" },
                                    { label: "质量", value: "越清晰越好" },
                                    { label: "背景", value: "白底图最佳" }
                                ].map((item) => (
                                    <div key={item.label} className="p-3 bg-slate-800/50 rounded-xl text-center">
                                        <div className="text-xs text-slate-400 mb-1">{item.label}</div>
                                        <div className="text-sm text-white font-medium">{item.value}</div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">最佳实践：白底三视图</h3>
                            <p className="text-slate-300 mb-4">三视图指商品的正面、侧面、背面三个角度的图片。</p>

                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-4">
                                <p className="text-emerald-300 font-medium">核心原则：上传的图片越完整，AI 生成越准确！</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                                    <div className="font-bold text-red-400 mb-2">❌ 只上传 1 张正面照</div>
                                    <p className="text-sm text-slate-300">AI 不知道背面是什么样子 → 只能「猜测」→ 可能不一致</p>
                                </div>
                                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                                    <div className="font-bold text-emerald-400 mb-2">✅ 上传白底三视图</div>
                                    <p className="text-sm text-slate-300">AI 完整了解商品 → 生成结果与实物高度一致</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        ]
    },
    {
        id: "my-works",
        title: "作品管理",
        icon: Images,
        color: "from-pink-500 to-rose-500",
        description: "我的作品、任务队列",
        subsections: [
            {
                id: "history",
                title: "我的作品",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">查看作品</h3>
                            <p className="text-slate-300 mb-4">点击左侧导航栏的「我的作品」查看所有已完成的 AI 生成作品。</p>

                            <div className="space-y-3">
                                <div className="p-3 bg-slate-800/50 rounded-lg flex items-center gap-3">
                                    <Images className="w-5 h-5 text-pink-400" />
                                    <span className="text-slate-300">精品展馆式布局，网格展示</span>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg flex items-center gap-3">
                                    <Crown className="w-5 h-5 text-amber-400" />
                                    <span className="text-slate-300">PRO 模式作品显示金色皇冠徽章</span>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg flex items-center gap-3">
                                    <Sparkles className="w-5 h-5 text-purple-400" />
                                    <span className="text-slate-300">支持搜索、分页浏览</span>
                                </div>
                            </div>
                        </div>

                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">作品详情</h3>
                            <p className="text-slate-300 mb-4">点击任意作品卡片可以：</p>
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { icon: "🖼️", text: "查看高清大图" },
                                    { icon: "📥", text: "下载原图" },
                                    { icon: "🔄", text: "重新生成（重绘）" },
                                    { icon: "📋", text: "查看生成参数" }
                                ].map((item) => (
                                    <div key={item.text} className="p-3 bg-slate-800/50 rounded-lg flex items-center gap-3">
                                        <span className="text-xl">{item.icon}</span>
                                        <span className="text-slate-300">{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "tasks",
                title: "任务队列",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">实时任务状态</h3>
                            <p className="text-slate-300 mb-4">点击左侧导航栏的「任务队列」查看 AI 任务处理状态。</p>

                            <div className="space-y-3">
                                {[
                                    { color: "yellow", status: "等待中", desc: "任务已提交，等待处理" },
                                    { color: "blue", status: "处理中", desc: "AI 正在生成图片" },
                                    { color: "green", status: "已完成", desc: "生成完成，可查看作品" },
                                    { color: "red", status: "失败", desc: "生成失败，积分已退还" }
                                ].map((item) => (
                                    <div key={item.status} className={`p-3 bg-${item.color}-500/10 border border-${item.color}-500/30 rounded-lg flex items-center justify-between`}>
                                        <span className={`text-${item.color}-400 font-medium`}>{item.status}</span>
                                        <span className="text-slate-300 text-sm">{item.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                            <p className="text-blue-300">页面会自动刷新更新任务状态，无需手动刷新。</p>
                        </div>
                    </div>
                )
            }
        ]
    },
    {
        id: "tools",
        title: "辅助工具",
        icon: FileText,
        color: "from-emerald-500 to-teal-500",
        description: "商品描述、去水印、水印模板",
        subsections: [
            {
                id: "copywriting",
                title: "智能商品描述",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">AI 文案生成</h3>
                            <p className="text-slate-300 mb-4">使用 AI 自动生成商品文案描述，适用于 Shopee 等电商平台。</p>

                            <div className="space-y-3">
                                {[
                                    "选择平台（目前支持 Shopee）",
                                    "输入商品名称或描述",
                                    "系统自动生成文案",
                                    "点击复制使用"
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-3 text-slate-300">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400">
                                            {i + 1}
                                        </div>
                                        {step}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "watermark-remove",
                title: "智能去水印",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">AI 去水印</h3>
                            <p className="text-slate-300 mb-4">使用 AI 智能去除图片上的水印、文字、Logo 等。</p>

                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl mb-4">
                                <p className="text-emerald-300 font-medium">限时免费活动进行中！</p>
                            </div>

                            <div className="space-y-3">
                                <div className="p-3 bg-slate-800/50 rounded-lg">
                                    <strong className="text-white">支持格式：</strong>
                                    <span className="text-slate-300"> PNG、JPG、JPEG、BMP</span>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg">
                                    <strong className="text-white">批量处理：</strong>
                                    <span className="text-slate-300"> 可一次上传多张图片</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                            <div className="flex items-center gap-2 text-amber-400 font-medium mb-1">
                                <AlertCircle className="w-4 h-4" />
                                重要提示
                            </div>
                            <p className="text-sm text-slate-400">处理结果仅保留 1 小时，请及时下载！</p>
                        </div>
                    </div>
                )
            },
            {
                id: "watermark-template",
                title: "水印模板管理",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">创建水印模板</h3>
                            <p className="text-slate-300 mb-4">创建和管理自己的水印模板，最多保存 10 个。</p>

                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    "位置（9 宫格）",
                                    "大小",
                                    "旋转角度",
                                    "透明度",
                                    "字体",
                                    "颜色"
                                ].map((param) => (
                                    <div key={param} className="p-2 bg-slate-800/50 rounded-lg text-center text-slate-300 text-sm">
                                        {param}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }
        ]
    },
    {
        id: "account",
        title: "账户管理",
        icon: Wallet,
        color: "from-cyan-500 to-blue-500",
        description: "积分流水、充值、售后、邀请",
        subsections: [
            {
                id: "credits-history",
                title: "积分流水",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">查看积分记录</h3>
                            <p className="text-slate-300 mb-4">点击左侧导航栏的「积分流水」查看消费和充值记录。</p>

                            <div className="space-y-3">
                                <div className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                                    <span className="text-slate-300">日期范围筛选</span>
                                    <span className="text-cyan-400 text-sm">✓</span>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                                    <span className="text-slate-300">类型筛选（消耗/充值/退款）</span>
                                    <span className="text-cyan-400 text-sm">✓</span>
                                </div>
                                <div className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                                    <span className="text-slate-300">分页浏览</span>
                                    <span className="text-cyan-400 text-sm">✓</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "orders",
                title: "充值记录",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">订单管理</h3>
                            <div className="space-y-3">
                                {[
                                    { status: "待支付", desc: "订单已创建，可继续支付" },
                                    { status: "已支付", desc: "付款成功，积分已到账" },
                                    { status: "已关闭", desc: "订单超时关闭或取消" }
                                ].map((item) => (
                                    <div key={item.status} className="p-3 bg-slate-800/50 rounded-lg flex items-center justify-between">
                                        <span className="text-white font-medium">{item.status}</span>
                                        <span className="text-slate-400 text-sm">{item.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "appeals",
                title: "售后记录",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4">申诉管理</h3>
                            <p className="text-slate-300 mb-4">如果对生成的图片不满意，可以在作品详情页发起申诉。</p>

                            <div className="space-y-3">
                                {[
                                    { status: "审核中", color: "yellow", desc: "申诉已提交，等待审核" },
                                    { status: "已退款", color: "green", desc: "申诉通过，积分已退还" },
                                    { status: "已驳回", color: "red", desc: "申诉未通过，显示驳回原因" }
                                ].map((item) => (
                                    <div key={item.status} className={`p-3 bg-${item.color}-500/10 border border-${item.color}-500/30 rounded-lg flex items-center justify-between`}>
                                        <span className={`text-${item.color}-400 font-medium`}>{item.status}</span>
                                        <span className="text-slate-400 text-sm">{item.desc}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            },
            {
                id: "referral",
                title: "邀请赚积分",
                content: (
                    <div className="space-y-6">
                        <div className="glass rounded-2xl p-6">
                            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                                <Gift className="w-5 h-5 text-purple-400" />
                                邀请好友送积分
                            </h3>
                            <p className="text-slate-300 mb-4">邀请好友注册，双方都可以获得积分奖励！</p>

                            <div className="space-y-3">
                                {[
                                    { step: "复制邀请码", icon: "📋" },
                                    { step: "分享给好友", icon: "📤" },
                                    { step: "好友注册时填写邀请码", icon: "✍️" },
                                    { step: "双方都获得奖励！", icon: "🎉" }
                                ].map((item) => (
                                    <div key={item.step} className="flex items-center gap-3 text-slate-300">
                                        <span className="text-xl">{item.icon}</span>
                                        {item.step}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }
        ]
    },
    {
        id: "faq",
        title: "常见问题",
        icon: HelpCircle,
        color: "from-orange-500 to-amber-500",
        description: "快速解答你的疑问",
        subsections: [
            {
                id: "faq-list",
                title: "FAQ",
                content: (
                    <div className="space-y-4">
                        {[
                            {
                                q: "积分用完了怎么办？",
                                a: "点击积分余额旁的「+」按钮进行充值，支持微信支付。"
                            },
                            {
                                q: "生成的图片不满意可以退款吗？",
                                a: "可以在作品详情页发起申诉，管理员审核通过后会退还积分。"
                            },
                            {
                                q: "任务一直显示「等待中」怎么办？",
                                a: "高峰期可能需要排队，请耐心等待。如果长时间未处理，可以刷新页面或联系客服。"
                            },
                            {
                                q: "去水印的结果过期了怎么办？",
                                a: "结果仅保留 1 小时，过期后无法恢复。请及时下载处理结果。"
                            },
                            {
                                q: "标准模式和 PRO 模式该怎么选？",
                                a: "需要快速批量生成选标准模式；需要高画质、特定比例、自定义文案选 PRO 模式。"
                            },
                            {
                                q: "风格后面的（无字）是什么意思？",
                                a: "（无字）表示生成的图片不包含任何文字，是纯净的图片。"
                            },
                            {
                                q: "为什么生成的图片和商品不一致？",
                                a: "通常是因为上传的图片不够完整。建议上传白底三视图。"
                            },
                            {
                                q: "PRO 模式 9 张为什么只要 500 积分？",
                                a: "这是限时特惠活动！原价 900 积分，现在只需 500 积分。"
                            },
                            {
                                q: "生成失败会扣积分吗？",
                                a: "不会。生成失败后积分会自动退回到你的账户。"
                            }
                        ].map((item, i) => (
                            <div key={i} className="glass rounded-xl p-5">
                                <div className="flex items-start gap-3 mb-3">
                                    <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-bold text-orange-400 shrink-0">
                                        Q
                                    </div>
                                    <h4 className="font-bold text-white">{item.q}</h4>
                                </div>
                                <div className="flex items-start gap-3">
                                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
                                        A
                                    </div>
                                    <p className="text-slate-300">{item.a}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            }
        ]
    }
]

export default function GuidePage() {
    const [activeSection, setActiveSection] = useState<string | null>(null)
    const [activeSubsection, setActiveSubsection] = useState<string | null>(null)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

    // 获取当前选中的内容
    const getCurrentContent = () => {
        if (!activeSection) return null
        const section = guideData.find(s => s.id === activeSection)
        if (!section) return null
        if (!activeSubsection) return section
        const subsection = section.subsections.find(ss => ss.id === activeSubsection)
        return subsection ? { ...section, currentSubsection: subsection } : section
    }

    // 过滤搜索结果
    const filteredSections = searchQuery
        ? guideData.filter(s =>
            s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.subsections.some(ss => ss.title.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : guideData

    // 重置到首页
    const goHome = () => {
        setActiveSection(null)
        setActiveSubsection(null)
    }

    return (
        <div className="h-screen bg-slate-950 flex overflow-hidden">
            {/* 背景装饰 */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-10 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
                <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
            </div>

            {/* 移动端菜单按钮 */}
            <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 glass rounded-xl"
            >
                {isMobileMenuOpen ? <X className="w-5 h-5 text-white" /> : <Menu className="w-5 h-5 text-white" />}
            </button>

            {/* 左侧导航栏 */}
            <aside className={`
                fixed lg:static inset-y-0 left-0 z-40
                w-72 bg-slate-900/80 backdrop-blur-xl border-r border-white/5
                transform transition-transform duration-300
                ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <div className="h-full flex flex-col">
                    {/* Logo */}
                    <div className="p-6 border-b border-white/5">
                        <button
                            onClick={goHome}
                            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                        >
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <BookOpen className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <span className="font-bold text-lg bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                                    使用指南
                                </span>
                                <p className="text-xs text-slate-500">AI Species</p>
                            </div>
                        </button>
                    </div>

                    {/* 搜索框 */}
                    <div className="p-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="搜索教程..."
                                className="w-full h-10 pl-10 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors text-sm"
                            />
                        </div>
                    </div>

                    {/* 导航列表 */}
                    <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                        {filteredSections.map((section) => {
                            const isActive = activeSection === section.id
                            const Icon = section.icon
                            return (
                                <div key={section.id}>
                                    <button
                                        onClick={() => {
                                            setActiveSection(section.id)
                                            setActiveSubsection(section.subsections[0]?.id || null)
                                            setIsMobileMenuOpen(false)
                                        }}
                                        className={`
                                            w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left
                                            ${isActive
                                                ? `bg-gradient-to-r ${section.color} text-white shadow-lg`
                                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                                            }
                                        `}
                                    >
                                        <Icon className="w-5 h-5 shrink-0" />
                                        <span className="font-medium truncate">{section.title}</span>
                                        {isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                                    </button>

                                    {/* 子菜单 */}
                                    {isActive && section.subsections.length > 1 && (
                                        <div className="ml-4 mt-1 space-y-1">
                                            {section.subsections.map((sub) => (
                                                <button
                                                    key={sub.id}
                                                    onClick={() => {
                                                        setActiveSubsection(sub.id)
                                                        setIsMobileMenuOpen(false)
                                                    }}
                                                    className={`
                                                        w-full text-left px-4 py-2 rounded-lg text-sm transition-all
                                                        ${activeSubsection === sub.id
                                                            ? 'text-white bg-white/10'
                                                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                                                        }
                                                    `}
                                                >
                                                    {sub.title}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </nav>

                    {/* 底部 */}
                    <div className="p-4 border-t border-white/5">
                        <a
                            href="/"
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            返回主页
                        </a>
                    </div>
                </div>
            </aside>

            {/* 主内容区 */}
            <main className="flex-1 relative overflow-y-auto" style={{ height: '100vh' }}>
                {/* 首页 - 分类选择 */}
                <AnimatePresence mode="wait">
                    {!activeSection ? (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="min-h-screen p-6 md:p-10"
                        >
                            {/* Hero */}
                            <div className="text-center mb-12 pt-8">
                                <motion.h1
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-4xl md:text-5xl font-bold mb-4"
                                >
                                    <span className="gradient-text">欢迎使用 AI Species</span>
                                </motion.h1>
                                <motion.p
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 }}
                                    className="text-slate-400 text-lg max-w-2xl mx-auto"
                                >
                                    选择你想了解的功能，开始你的 AI 创作之旅
                                </motion.p>
                            </div>

                            {/* 快速入口 */}
                            <div className="max-w-4xl mx-auto mb-12">
                                <div className="p-4 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center">
                                                <Sparkles className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white">AI 生图教程</h3>
                                                <p className="text-sm text-slate-400">核心功能，快速上手</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setActiveSection("ai-generation")
                                                setActiveSubsection("overview")
                                            }}
                                            className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-purple-500/25"
                                        >
                                            立即查看
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 功能分类卡片 */}
                            <div className="max-w-6xl mx-auto">
                                <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                    <Home className="w-5 h-5 text-slate-400" />
                                    全部教程
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {guideData.map((section, index) => {
                                        const Icon = section.icon
                                        return (
                                            <motion.button
                                                key={section.id}
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                onClick={() => {
                                                    setActiveSection(section.id)
                                                    setActiveSubsection(section.subsections[0]?.id || null)
                                                }}
                                                className="group glass rounded-2xl p-6 text-left transition-all duration-300 hover:border-white/20 hover:bg-white/10 cursor-pointer"
                                            >
                                                <div className={`w-12 h-12 rounded-xl bg-gradient-to-r ${section.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                                                    <Icon className="w-6 h-6 text-white" />
                                                </div>
                                                <h3 className="font-bold text-white mb-2 group-hover:text-blue-300 transition-colors">
                                                    {section.title}
                                                </h3>
                                                <p className="text-sm text-slate-400 mb-4">
                                                    {section.description}
                                                </p>
                                                <div className="flex items-center gap-2 text-sm text-slate-500 group-hover:text-blue-400 transition-colors">
                                                    <span>{section.subsections.length} 篇教程</span>
                                                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                                </div>
                                            </motion.button>
                                        )
                                    })}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        /* 内容页 */
                        <motion.div
                            key="content"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="pb-20"
                        >
                            {/* 顶部面包屑 */}
                            <div className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-xl border-b border-white/5 px-6 py-4">
                                <div className="max-w-4xl mx-auto flex items-center gap-2 text-sm">
                                    <button
                                        onClick={goHome}
                                        className="text-slate-400 hover:text-white transition-colors flex items-center gap-1"
                                    >
                                        <Home className="w-4 h-4" />
                                        首页
                                    </button>
                                    <ChevronRight className="w-4 h-4 text-slate-600" />
                                    <span className="text-white font-medium">
                                        {guideData.find(s => s.id === activeSection)?.title}
                                    </span>
                                    {activeSubsection && (
                                        <>
                                            <ChevronRight className="w-4 h-4 text-slate-600" />
                                            <span className="text-slate-300">
                                                {guideData.find(s => s.id === activeSection)?.subsections.find(ss => ss.id === activeSubsection)?.title}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* 内容 */}
                            <div className="max-w-4xl mx-auto p-6 md:p-10">
                                {(() => {
                                    const content = getCurrentContent()
                                    if (!content) return null

                                    if ('currentSubsection' in content) {
                                        return (
                                            <div>
                                                <h1 className="text-3xl font-bold text-white mb-8">
                                                    {content.currentSubsection.title}
                                                </h1>
                                                {content.currentSubsection.content}
                                            </div>
                                        )
                                    }

                                    return (
                                        <div>
                                            <h1 className="text-3xl font-bold text-white mb-8 flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${content.color} flex items-center justify-center`}>
                                                    <content.icon className="w-5 h-5 text-white" />
                                                </div>
                                                {content.title}
                                            </h1>
                                            {content.subsections[0]?.content}
                                        </div>
                                    )
                                })()}

                                {/* 底部导航 */}
                                <div className="mt-12 pt-8 border-t border-white/10 flex items-center justify-between">
                                    <button
                                        onClick={goHome}
                                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        返回目录
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    )
}
