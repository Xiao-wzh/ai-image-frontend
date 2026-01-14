import { unstable_cache } from "next/cache"
import prisma from "@/lib/prisma"
import {
    type SystemCostConfig,
    type SystemCostKey,
    SYSTEM_COST_KEYS,
    SYSTEM_COST_DESCRIPTIONS,
} from "@/lib/types/config"

/**
 * Default cost values (fallback when DB value is missing)
 * These should match the original hardcoded values from lib/constants.ts
 */
export const DEFAULT_COSTS: SystemCostConfig = {
    WATERMARK_UNLOCK_COST: 100,
    WATERMARK_ADD_COST: 0,
    WATERMARK_REMOVE_COST: 100,
    MAIN_IMAGE_STANDARD_COST: 199,
    MAIN_IMAGE_RETRY_COST: 99,
    DETAIL_PAGE_STANDARD_COST: 199,
    DETAIL_PAGE_RETRY_COST: 99,
    IMAGE_EDIT_COST: 199,
}

/**
 * Fetch all system costs from database
 * Transforms array of key-value rows into typed object
 * Uses fallback values for missing keys
 */
async function fetchSystemCostsFromDB(): Promise<SystemCostConfig> {
    const rows = await prisma.systemConfig.findMany({
        where: {
            key: { in: SYSTEM_COST_KEYS },
        },
    })

    // Transform array to object with defaults
    const result: SystemCostConfig = { ...DEFAULT_COSTS }

    for (const row of rows) {
        const key = row.key as SystemCostKey
        if (SYSTEM_COST_KEYS.includes(key)) {
            const numValue = parseInt(row.value, 10)
            if (!isNaN(numValue)) {
                result[key] = numValue
            }
        }
    }

    return result
}

/**
 * Cached version of getSystemCosts
 * Uses Next.js unstable_cache with tag 'system-costs'
 * Cache is automatically revalidated when revalidateTag('system-costs') is called
 */
export const getSystemCosts = unstable_cache(
    fetchSystemCostsFromDB,
    ["system-costs"],
    {
        tags: ["system-costs"],
        revalidate: 60, // Revalidate every 60 seconds as backup
    }
)

/**
 * Get a single cost value by key
 * Useful for server-side operations
 */
export async function getSystemCost(key: SystemCostKey): Promise<number> {
    const costs = await getSystemCosts()
    return costs[key]
}

/**
 * Update a system cost value
 * This also revalidates the cache
 */
export async function updateSystemCost(
    key: SystemCostKey,
    value: number,
    description?: string
): Promise<void> {
    await prisma.systemConfig.upsert({
        where: { key },
        create: {
            key,
            value: String(value),
            description: description || SYSTEM_COST_DESCRIPTIONS[key],
        },
        update: {
            value: String(value),
            ...(description && { description }),
        },
    })

    // Revalidate cache - import at top level with conditional check
    try {
        const { revalidateTag } = require("next/cache")
        revalidateTag("system-costs")
    } catch {
        // Ignore if not in a server context where revalidateTag is available
    }
}


/**
 * Initialize all system costs with default values
 * Should be called during database seeding
 */
export async function seedSystemCosts(): Promise<void> {
    for (const key of SYSTEM_COST_KEYS) {
        await prisma.systemConfig.upsert({
            where: { key },
            create: {
                key,
                value: String(DEFAULT_COSTS[key]),
                description: SYSTEM_COST_DESCRIPTIONS[key],
            },
            update: {}, // Don't overwrite existing values
        })
    }
    console.log("[SystemConfig] Seeded default cost values")
}
