import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 将 UTC 时间字符串格式化为本地时间 (YYYY-MM-DD HH:mm:ss)
 * @param date - ISO 8601 格式的 UTC 时间字符串
 */
export function formatLocaleTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'yyyy-MM-dd HH:mm:ss')
}

/**
 * 将 UTC 时间字符串格式化为相对时间 (例如 "5分钟前")
 * @param date - ISO 8601 格式的 UTC 时间字符串
 */
export function formatTimeToNow(date: string | Date): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(dateObj, { addSuffix: true, locale: zhCN })
}

/**
 * 清理文件名，移除非法字符
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "-")
}

/**
 * 下载单张图片
 * @param imgUrl - 图片URL
 * @param filename - 文件名（不含扩展名）
 * @param extension - 文件扩展名，默认 "png"
 */
export function downloadImage(imgUrl: string, filename: string, extension: string = "png"): void {
  const sanitized = sanitizeFilename(`${filename}.${extension}`)
  const href = `/api/download-images?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(sanitized)}`

  const a = document.createElement("a")
  a.href = href
  a.download = sanitized
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
