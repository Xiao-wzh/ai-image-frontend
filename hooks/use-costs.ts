"use client"

import useSWR from "swr"
import type { SystemCostConfig } from "@/lib/types/config"

// Default costs (fallback when API fails)
const DEFAULT_COSTS: SystemCostConfig = {
    WATERMARK_UNLOCK_COST: 100,
    WATERMARK_ADD_COST: 0,
    WATERMARK_REMOVE_COST: 100,
    MAIN_IMAGE_STANDARD_COST: 199,
    MAIN_IMAGE_RETRY_COST: 99,
    DETAIL_PAGE_STANDARD_COST: 199,
    DETAIL_PAGE_RETRY_COST: 99,
    IMAGE_EDIT_COST: 199,
    COPYWRITING_COST: 99,
}


const fetcher = async (url: string): Promise<SystemCostConfig> => {
    const res = await fetch(url)
    if (!res.ok) throw new Error("Failed to fetch costs")
    return res.json()
}

/**
 * Hook to fetch system costs with SWR caching
 * Returns typed costs object with full IntelliSense support
 * 
 * Usage:
 * ```tsx
 * const { costs, isLoading } = useCosts()
 * console.log(costs.MAIN_IMAGE_STANDARD_COST) // TypeScript knows this is a number
 * ```
 */
export function useCosts() {
    const { data, error, isLoading, mutate } = useSWR<SystemCostConfig>(
        "/api/config/costs",
        fetcher,
        {
            revalidateOnFocus: false,
            dedupingInterval: 60000, // Cache for 1 minute
            fallbackData: DEFAULT_COSTS,
        }
    )

    return {
        costs: data ?? DEFAULT_COSTS,
        isLoading,
        isError: !!error,
        mutate,
    }
}

/**
 * Get a specific cost value
 * Wrapper for convenience
 */
export function useCost(key: keyof SystemCostConfig): number {
    const { costs } = useCosts()
    return costs[key]
}
