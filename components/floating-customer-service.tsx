"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Headphones, X } from "lucide-react"

interface FloatingCustomerServiceProps {
    customerServiceQr?: string
    afterSaleGroupQr?: string
}

export function FloatingCustomerService({
    customerServiceQr,
    afterSaleGroupQr,
}: FloatingCustomerServiceProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const [previewImage, setPreviewImage] = useState<string | null>(null)

    // 如果两个都为空，不显示组件
    if (!customerServiceQr && !afterSaleGroupQr) {
        return null
    }

    const hasMultiple = customerServiceQr && afterSaleGroupQr

    return (
        <>
            <div className="fixed bottom-6 right-6 z-40">
                {/* QR Code Card */}
                <AnimatePresence>
                    {(isOpen || isHovered) && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="absolute bottom-16 right-0 mb-2"
                        >
                            <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-4 min-w-[280px]">
                                {/* Header */}
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-white font-semibold text-sm">
                                        联系我们
                                    </h3>
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors md:hidden"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* QR Codes */}
                                <div className={`flex gap-4 ${hasMultiple ? 'flex-row' : 'flex-col items-center'}`}>
                                    {customerServiceQr && (
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={() => setPreviewImage(customerServiceQr)}
                                                className="w-28 h-28 rounded-xl overflow-hidden bg-white p-1.5 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                                            >
                                                <img
                                                    src={customerServiceQr}
                                                    alt="客服微信"
                                                    className="w-full h-full object-contain"
                                                />
                                            </button>
                                            <span className="text-xs text-slate-400 mt-2">
                                                客服微信
                                            </span>
                                        </div>
                                    )}
                                    {afterSaleGroupQr && (
                                        <div className="flex flex-col items-center">
                                            <button
                                                onClick={() => setPreviewImage(afterSaleGroupQr)}
                                                className="w-28 h-28 rounded-xl overflow-hidden bg-white p-1.5 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                                            >
                                                <img
                                                    src={afterSaleGroupQr}
                                                    alt="交流群"
                                                    className="w-full h-full object-contain"
                                                />
                                            </button>
                                            <span className="text-xs text-slate-400 mt-2">
                                                交流群
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Tip */}
                                <p className="text-xs text-slate-500 mt-3 text-center">
                                    点击图片可放大查看
                                </p>
                            </div>

                            {/* Arrow */}
                            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-slate-900/90 border-r border-b border-white/10 transform rotate-45" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Floating Button */}
                <motion.button
                    onClick={() => setIsOpen(!isOpen)}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 ${isOpen
                        ? "bg-slate-700 text-white"
                        : "bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-500 hover:to-blue-500"
                        }`}
                >
                    <Headphones className="w-6 h-6" />
                </motion.button>

                {/* Pulse Animation Ring */}
                {!isOpen && !isHovered && (
                    <motion.div
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeOut",
                        }}
                        className="absolute inset-0 w-14 h-14 rounded-full bg-purple-500/30 pointer-events-none"
                    />
                )}
            </div>

            {/* Image Preview Modal */}
            <AnimatePresence>
                {previewImage && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setPreviewImage(null)}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
                    >
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="relative bg-white rounded-2xl p-3 shadow-2xl max-w-[320px] max-h-[80vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={previewImage}
                                alt="二维码"
                                className="w-72 h-72 object-contain"
                            />
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white hover:bg-slate-700 transition-colors shadow-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
