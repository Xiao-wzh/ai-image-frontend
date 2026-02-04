"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { Sidebar } from "@/components/sidebar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Save, Loader2, RefreshCw, Check, Upload, Trash2, Headphones, Image as ImageIcon } from "lucide-react"
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

    // 客服配置状态
    const [customerServiceQr, setCustomerServiceQr] = useState("")
    const [afterSaleGroupQr, setAfterSaleGroupQr] = useState("")
    const [loadingCs, setLoadingCs] = useState(true)
    const [savingCs, setSavingCs] = useState(false)
    const [uploadingCs, setUploadingCs] = useState<string | null>(null)
    const csFileRef = useRef<HTMLInputElement>(null)
    const asFileRef = useRef<HTMLInputElement>(null)

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

    const fetchCustomerServiceConfig = async () => {
        setLoadingCs(true)
        try {
            const res = await fetch("/api/admin/config/customer-service")
            const data = await res.json()
            if (data.success) {
                setCustomerServiceQr(data.customerServiceQr || "")
                setAfterSaleGroupQr(data.afterSaleGroupQr || "")
            }
        } catch (e: any) {
            console.error("获取客服配置失败", e)
        } finally {
            setLoadingCs(false)
        }
    }

    useEffect(() => {
        fetchConfigs()
        fetchCustomerServiceConfig()
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

    // 上传图片到 TOS (使用管理员专用上传接口，支持 CDN)
    const handleUploadImage = async (file: File, type: 'cs' | 'as') => {
        setUploadingCs(type)
        try {
            // 获取预签名 URL（使用管理员上传接口，返回 CDN 加速 URL）
            const presignRes = await fetch("/api/admin/upload", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    filename: file.name,
                    contentType: file.type,
                }),
            })
            const presignData = await presignRes.json()
            if (!presignRes.ok) throw new Error(presignData.error || "获取上传地址失败")

            // 上传文件到 TOS
            const uploadRes = await fetch(presignData.uploadUrl, {
                method: "PUT",
                headers: { "Content-Type": file.type },
                body: file,
            })
            if (!uploadRes.ok) throw new Error("上传文件失败")

            // 更新状态
            if (type === 'cs') {
                setCustomerServiceQr(presignData.publicUrl)
            } else {
                setAfterSaleGroupQr(presignData.publicUrl)
            }
            toast.success("图片上传成功")
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setUploadingCs(null)
        }
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'cs' | 'as') => {
        const file = e.target.files?.[0]
        if (file) {
            handleUploadImage(file, type)
        }
        e.target.value = ""
    }

    const saveCustomerServiceConfig = async () => {
        setSavingCs(true)
        try {
            const res = await fetch("/api/admin/config/customer-service", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerServiceQr,
                    afterSaleGroupQr,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "保存失败")
            toast.success("客服配置已保存，刷新页面后生效")
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setSavingCs(false)
        }
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
                            <p className="text-slate-400 mt-1">管理积分消耗、客服配置等系统配置项</p>
                        </div>
                        <Button
                            onClick={() => { fetchConfigs(); fetchCustomerServiceConfig(); }}
                            disabled={loading || loadingCs}
                            variant="outline"
                            className="border-white/10 hover:bg-white/5"
                        >
                            <RefreshCw className={`w-4 h-4 mr-2 ${(loading || loadingCs) ? "animate-spin" : ""}`} />
                            刷新
                        </Button>
                    </div>

                    {/* Customer Service Config */}
                    <Card className="bg-slate-900/50 border-white/10">
                        <CardHeader>
                            <CardTitle className="text-white flex items-center gap-2">
                                <Headphones className="w-5 h-5 text-purple-400" />
                                客服配置
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {loadingCs ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <p className="text-sm text-slate-400">
                                        上传客服微信和售后群的二维码图片，用户可在页面右下角悬浮图标中查看
                                    </p>

                                    <div className="grid gap-6 md:grid-cols-2">
                                        {/* Customer Service QR */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-slate-300">
                                                客服微信二维码
                                            </label>
                                            <div className="border border-dashed border-white/20 rounded-xl p-4 bg-slate-800/30">
                                                {customerServiceQr ? (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-32 h-32 rounded-lg overflow-hidden bg-white p-1">
                                                            <img
                                                                src={customerServiceQr}
                                                                alt="客服二维码"
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => csFileRef.current?.click()}
                                                                disabled={uploadingCs === 'cs'}
                                                                className="border-white/10"
                                                            >
                                                                {uploadingCs === 'cs' ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <Upload className="w-3 h-3 mr-1" />
                                                                        更换
                                                                    </>
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setCustomerServiceQr("")}
                                                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                            >
                                                                <Trash2 className="w-3 h-3 mr-1" />
                                                                删除
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => csFileRef.current?.click()}
                                                        disabled={uploadingCs === 'cs'}
                                                        className="w-full py-8 flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
                                                    >
                                                        {uploadingCs === 'cs' ? (
                                                            <Loader2 className="w-8 h-8 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <ImageIcon className="w-8 h-8" />
                                                                <span className="text-sm">点击上传图片</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                ref={csFileRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileChange(e, 'cs')}
                                            />
                                        </div>

                                        {/* After Sale Group QR */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-medium text-slate-300">
                                                售后群二维码
                                            </label>
                                            <div className="border border-dashed border-white/20 rounded-xl p-4 bg-slate-800/30">
                                                {afterSaleGroupQr ? (
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="w-32 h-32 rounded-lg overflow-hidden bg-white p-1">
                                                            <img
                                                                src={afterSaleGroupQr}
                                                                alt="售后群二维码"
                                                                className="w-full h-full object-contain"
                                                            />
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => asFileRef.current?.click()}
                                                                disabled={uploadingCs === 'as'}
                                                                className="border-white/10"
                                                            >
                                                                {uploadingCs === 'as' ? (
                                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <Upload className="w-3 h-3 mr-1" />
                                                                        更换
                                                                    </>
                                                                )}
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => setAfterSaleGroupQr("")}
                                                                className="border-red-500/30 text-red-400 hover:bg-red-500/10"
                                                            >
                                                                <Trash2 className="w-3 h-3 mr-1" />
                                                                删除
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => asFileRef.current?.click()}
                                                        disabled={uploadingCs === 'as'}
                                                        className="w-full py-8 flex flex-col items-center gap-2 text-slate-400 hover:text-white transition-colors"
                                                    >
                                                        {uploadingCs === 'as' ? (
                                                            <Loader2 className="w-8 h-8 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <ImageIcon className="w-8 h-8" />
                                                                <span className="text-sm">点击上传图片</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                ref={asFileRef}
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileChange(e, 'as')}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex justify-end">
                                        <Button
                                            onClick={saveCustomerServiceConfig}
                                            disabled={savingCs}
                                            className="bg-purple-600 hover:bg-purple-700"
                                        >
                                            {savingCs ? (
                                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                            ) : (
                                                <Save className="w-4 h-4 mr-2" />
                                            )}
                                            保存客服配置
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

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
                                <li>• 客服配置保存后，刷新页面即可在右下角看到悬浮图标</li>
                                <li>• 如果两个二维码都为空，则不会显示客服图标</li>
                            </ul>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    )
}

