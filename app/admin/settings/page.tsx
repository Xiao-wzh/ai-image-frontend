"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Save, Loader2, RefreshCw, Check } from "lucide-react"
import { toast } from "sonner"

type ConfigItem = {
    key: string
    value: string
    description: string | null
    updatedAt: string | null
}

export default function AdminSettingsPage() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [configs, setConfigs] = useState<ConfigItem[]>([])
    const [editedValues, setEditedValues] = useState<Record<string, string>>({})

    const fetchConfigs = async () => {
        setLoading(true)
        try {
            const res = await fetch("/api/admin/config/costs")
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "获取配置失败")
            setConfigs(data.configs)
            // Initialize edited values
            const values: Record<string, string> = {}
            data.configs.forEach((c: ConfigItem) => {
                values[c.key] = c.value
            })
            setEditedValues(values)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchConfigs()
    }, [])

    const handleSave = async (key: string) => {
        const value = editedValues[key]
        if (value === undefined) return

        setSaving(key)
        try {
            const res = await fetch("/api/admin/config/costs", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "保存失败")

            // Update local state
            setConfigs(prev =>
                prev.map(c => c.key === key ? { ...c, value: String(data.value) } : c)
            )
            toast.success(`${key} 已更新为 ${data.value}`)
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSaving(null)
        }
    }

    const hasChanged = (key: string) => {
        const original = configs.find(c => c.key === key)?.value
        return original !== editedValues[key]
    }

    return (
        <div className="flex h-screen bg-slate-950">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto space-y-8">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                                <Settings className="w-8 h-8 text-purple-400" />
                                系统配置
                            </h1>
                            <p className="text-slate-400 mt-1">管理积分消耗等系统配置项</p>
                        </div>
                        <Button
                            onClick={fetchConfigs}
                            disabled={loading}
                            variant="outline"
                            className="border-white/10 hover:bg-white/5"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                            刷新
                        </Button>
                    </div>

                    {/* Config Table */}
                    <Card className="bg-slate-900/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white">积分消耗配置</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                                </div>
                            ) : configs.length === 0 ? (
                                <p className="text-slate-400 text-center py-8">
                                    暂无配置数据，请运行数据库迁移和种子脚本
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {configs.map((config, index) => (
                                        <motion.div
                                            key={config.key}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: index * 0.05 }}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/50 border border-white/5"
                                        >
                                            {/* Key & Description */}
                                            <div className="flex-1 min-w-0">
                                                <code className="text-sm text-purple-300 font-mono">
                                                    {config.key}
                                                </code>
                                                <p className="text-xs text-slate-400 mt-0.5 truncate">
                                                    {config.description}
                                                </p>
                                            </div>

                                            {/* Value Input */}
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={editedValues[config.key] ?? config.value}
                                                    onChange={(e) => setEditedValues(prev => ({
                                                        ...prev,
                                                        [config.key]: e.target.value
                                                    }))}
                                                    className="w-32 bg-slate-700 border-slate-600 text-white text-right"
                                                />
                                                <span className="text-slate-400 text-sm">积分</span>
                                            </div>

                                            {/* Save Button */}
                                            <Button
                                                size="sm"
                                                onClick={() => handleSave(config.key)}
                                                disabled={saving === config.key || !hasChanged(config.key)}
                                                className={`w-20 ${hasChanged(config.key)
                                                    ? "bg-purple-600 hover:bg-purple-700"
                                                    : "bg-slate-700 text-slate-500"
                                                    }`}
                                            >
                                                {saving === config.key ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : hasChanged(config.key) ? (
                                                    <>
                                                        <Save className="w-3 h-3 mr-1" />
                                                        保存
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check className="w-3 h-3 mr-1" />
                                                        已保存
                                                    </>
                                                )}
                                            </Button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Help */}
                    <Card className="bg-blue-500/5 border-blue-500/20">
                        <CardContent className="pt-6">
                            <h3 className="text-blue-300 font-semibold mb-2">💡 使用说明</h3>
                            <ul className="text-sm text-slate-400 space-y-1">
                                <li>• 修改配置值后点击"保存"按钮，配置会立即生效</li>
                                <li>• 前端页面会自动使用最新配置值（可能有 1 分钟缓存）</li>
                                <li>• 如果数据库中没有配置项，系统会使用默认值</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}
