"use client"

import * as React from "react"
import { format, isSameDay, startOfDay, endOfDay } from "date-fns"
import { zhCN } from "date-fns/locale"
import { DayPicker, DateRange } from "react-day-picker"
import { Calendar, X, ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

import "react-day-picker/style.css"

type DateRangeValue = {
    startDate: string
    endDate: string
}

interface DateRangePickerProps {
    value: DateRangeValue
    onChange: (value: DateRangeValue) => void
    placeholder?: string
    className?: string
    align?: "start" | "center" | "end"
    showPresets?: boolean
}

// 预设日期范围 - 分组以便更好组织
const presetGroups = [
    {
        title: "快捷选择",
        items: [
            { label: "今天", getValue: () => ({ start: startOfDay(new Date()), end: endOfDay(new Date()) }) },
            { label: "昨天", getValue: () => {
                const yesterday = new Date()
                yesterday.setDate(yesterday.getDate() - 1)
                return { start: startOfDay(yesterday), end: endOfDay(yesterday) }
            }},
            { label: "近7天", getValue: () => {
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - 6)
                return { start: startOfDay(start), end: endOfDay(end) }
            }},
        ]
    },
    {
        title: "时间范围",
        items: [
            { label: "近30天", getValue: () => {
                const end = new Date()
                const start = new Date()
                start.setDate(start.getDate() - 29)
                return { start: startOfDay(start), end: endOfDay(end) }
            }},
            { label: "本月", getValue: () => {
                const now = new Date()
                return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: endOfDay(now) }
            }},
            { label: "上月", getValue: () => {
                const now = new Date()
                const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
                const end = new Date(now.getFullYear(), now.getMonth(), 0)
                return { start, end: endOfDay(end) }
            }},
        ]
    }
]

export function DateRangePicker({
    value,
    onChange,
    placeholder = "选择日期范围",
    className,
    align = "start",
    showPresets = true,
}: DateRangePickerProps) {
    const [open, setOpen] = React.useState(false)
    const [selectedRange, setSelectedRange] = React.useState<DateRange | undefined>(() => {
        if (value.startDate && value.endDate) {
            return {
                from: new Date(value.startDate),
                to: new Date(value.endDate),
            }
        }
        return undefined
    })
    const [month, setMonth] = React.useState<Date>(new Date())

    // 同步外部值变化
    React.useEffect(() => {
        if (value.startDate && value.endDate) {
            setSelectedRange({
                from: new Date(value.startDate),
                to: new Date(value.endDate),
            })
        } else {
            setSelectedRange(undefined)
        }
    }, [value.startDate, value.endDate])

    const handleSelect = (range: DateRange | undefined) => {
        setSelectedRange(range)
        if (range?.from && range?.to) {
            onChange({
                startDate: format(range.from, "yyyy-MM-dd"),
                endDate: format(range.to, "yyyy-MM-dd"),
            })
        }
    }

    const handlePresetClick = (preset: { label: string; getValue: () => { start: Date; end: Date } }) => {
        const { start, end } = preset.getValue()
        const range: DateRange = { from: start, to: end }
        setSelectedRange(range)
        onChange({
            startDate: format(start, "yyyy-MM-dd"),
            endDate: format(end, "yyyy-MM-dd"),
        })
        setOpen(false) // 选择后自动关闭
    }

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedRange(undefined)
        onChange({ startDate: "", endDate: "" })
    }

    const displayValue = React.useMemo(() => {
        if (selectedRange?.from && selectedRange?.to) {
            if (isSameDay(selectedRange.from, selectedRange.to)) {
                return format(selectedRange.from, "MM月dd日", { locale: zhCN })
            }
            return `${format(selectedRange.from, "MM/dd")}-${format(selectedRange.to, "MM/dd")}`
        }
        return null
    }, [selectedRange])

    // 检查预设是否被选中
    const isPresetActive = (preset: { label: string; getValue: () => { start: Date; end: Date } }) => {
        if (!selectedRange?.from || !selectedRange?.to) return false
        const { start, end } = preset.getValue()
        return isSameDay(selectedRange.from, start) && isSameDay(selectedRange.to, end)
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    className={cn(
                        "h-9 justify-between bg-white/5 border-white/10 text-white hover:bg-white/10 font-normal text-sm transition-all duration-200",
                        !displayValue && "text-slate-500",
                        open && "ring-2 ring-blue-500/30 border-blue-500/50",
                        className
                    )}
                >
                    <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{displayValue || placeholder}</span>
                    </div>
                    {displayValue ? (
                        <X
                            className="w-3.5 h-3.5 text-slate-400 hover:text-white shrink-0 transition-colors"
                            onClick={handleClear}
                        />
                    ) : (
                        <div className="w-3.5" />
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className={cn(
                    "w-auto p-0 bg-slate-900/95 backdrop-blur-xl border-white/10 shadow-2xl shadow-black/50 rounded-xl overflow-hidden",
                    showPresets && "flex"
                )}
                align={align}
                sideOffset={8}
            >
                {/* 预设快捷选项 - 带滚动 */}
                {showPresets && (
                    <div className="flex flex-col border-r border-white/10 min-w-[88px] max-h-[280px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {presetGroups.map((group, groupIdx) => (
                            <div key={group.title}>
                                {/* 分组标题 */}
                                <div className="px-3 py-1.5 text-[10px] text-slate-500 font-medium uppercase tracking-wider sticky top-0 bg-slate-900/95 backdrop-blur-sm">
                                    {group.title}
                                </div>
                                {group.items.map((preset) => {
                                    const isActive = isPresetActive(preset)
                                    return (
                                        <button
                                            key={preset.label}
                                            onClick={() => handlePresetClick(preset)}
                                            className={cn(
                                                "w-full px-3 py-2 text-sm text-left transition-all duration-150",
                                                "hover:bg-white/8 active:scale-[0.98]",
                                                "cursor-pointer",
                                                isActive
                                                    ? "text-blue-400 bg-blue-500/15 border-r-2 border-blue-500"
                                                    : "text-slate-300 hover:text-white"
                                            )}
                                        >
                                            {preset.label}
                                        </button>
                                    )
                                })}
                                {/* 分组分隔线 */}
                                {groupIdx < presetGroups.length - 1 && (
                                    <div className="mx-3 my-1 border-t border-white/5" />
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* 日历选择器 */}
                <div className="flex-shrink-0">
                    <DayPicker
                        mode="range"
                        selected={selectedRange}
                        onSelect={handleSelect}
                        month={month}
                        onMonthChange={setMonth}
                        numberOfMonths={1}
                        locale={zhCN}
                        showOutsideDays={false}
                        fixedWeeks
                        classNames={{
                            month: "p-4",
                            month_caption: "flex items-center justify-between mb-3",
                            caption_label: "text-sm font-medium text-white",
                            nav: "flex items-center gap-1",
                            button_previous: cn(
                                "inline-flex items-center justify-center w-8 h-8 rounded-lg",
                                "text-slate-400 hover:text-white hover:bg-white/10",
                                "transition-all duration-150 active:scale-95",
                                "cursor-pointer"
                            ),
                            button_next: cn(
                                "inline-flex items-center justify-center w-8 h-8 rounded-lg",
                                "text-slate-400 hover:text-white hover:bg-white/10",
                                "transition-all duration-150 active:scale-95",
                                "cursor-pointer"
                            ),
                            chevron: "w-4 h-4",
                            weekdays: "flex mb-2",
                            weekday: "w-9 text-center text-[11px] text-slate-500 font-medium",
                            week: "flex mt-1",
                            day: cn(
                                "relative p-0 text-sm focus-within:relative focus-within:z-20",
                                "text-white"
                            ),
                            day_button: cn(
                                "w-9 h-9 rounded-lg text-sm font-normal",
                                "hover:bg-white/10 transition-all duration-150",
                                "focus:outline-none focus:ring-2 focus:ring-blue-500/50",
                                "active:scale-95 cursor-pointer"
                            ),
                            range_start: "day-range-start",
                            range_end: "day-range-end",
                            selected: cn(
                                "bg-blue-500/20 text-blue-400",
                                "range-start:bg-blue-500 range-start:text-white range-start:shadow-lg range-start:shadow-blue-500/25",
                                "range-end:bg-blue-500 range-end:text-white range-end:shadow-lg range-end:shadow-blue-500/25",
                                "range-start:rounded-l-lg range-end:rounded-r-lg",
                                "range-start:rounded-r-none range-end:rounded-l-none"
                            ),
                            today: "text-blue-400 font-semibold",
                            outside: "text-slate-600 opacity-40",
                            disabled: "text-slate-600 opacity-40 cursor-not-allowed",
                            range_middle: cn(
                                "bg-gradient-to-r from-blue-500/15 to-blue-500/10 rounded-none"
                            ),
                            hidden: "invisible",
                        }}
                        components={{
                            Chevron: ({ orientation }) => {
                                return orientation === "left" ? (
                                    <ChevronLeft className="w-4 h-4" />
                                ) : (
                                    <ChevronRight className="w-4 h-4" />
                                )
                            },
                        }}
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
}
