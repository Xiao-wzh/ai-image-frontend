"use client"

import useSWR from "swr"
import type { ImageModelConfig } from "@/lib/types/config"

type ModelsResponse = {
    models: ImageModelConfig[]
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

/**
 * 获取当前可用的图片生成模型
 * @param qualityMode 画质模式筛选
 * @param taskType 任务类型筛选
 */
export function useImageModels(
    qualityMode?: "STANDARD" | "PRO",
    taskType?: "MAIN_IMAGE" | "DETAIL_PAGE",
) {
    const params = new URLSearchParams()
    if (qualityMode) params.set("qualityMode", qualityMode)
    if (taskType) params.set("taskType", taskType)
    const url = `/api/config/models?${params.toString()}`

    const { data, error, isLoading } = useSWR<ModelsResponse>(url, fetcher, {
        refreshInterval: 0,
        revalidateOnFocus: false,
        dedupingInterval: 30000,
    })

    return {
        models: data?.models || [],
        isLoading,
        isError: !!error,
    }
}
