import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { SYSTEM_COST_KEYS, SYSTEM_COST_DESCRIPTIONS } from "@/lib/types/config"
import type { SystemCostKey } from "@/lib/types/config"
import { DEFAULT_COSTS } from "@/lib/system-config"

export const dynamic = "force-dynamic"


type SystemConfigRow = {
    key: string
    value: string
    description: string | null
    updatedAt: Date
}

/**
 * GET /api/admin/config/costs
 * Returns all system cost configs with descriptions (for admin table)
 */
export async function GET(req: NextRequest) {
    const session = await auth()
    const role = (session?.user as any)?.role

    if (role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    try {
        const rows = await prisma.systemConfig.findMany({
            where: { key: { in: SYSTEM_COST_KEYS as string[] } },
        }) as SystemConfigRow[]

        // Create a map for easy lookup
        const rowMap = new Map(rows.map((r: SystemConfigRow) => [r.key, r]))

        // Return all keys with their values (or defaults if missing)
        const configs = SYSTEM_COST_KEYS.map((key) => {
            const row = rowMap.get(key)
            return {
                key,
                value: row?.value ?? String(DEFAULT_COSTS[key]),
                description: row?.description ?? SYSTEM_COST_DESCRIPTIONS[key],
                updatedAt: row?.updatedAt ?? null,
            }
        })

        return NextResponse.json({ configs })
    } catch (error) {
        console.error("[ADMIN_CONFIG] Failed to load configs:", error)
        return NextResponse.json({ error: "Failed to load configs" }, { status: 500 })
    }
}

/**
 * PUT /api/admin/config/costs
 * Update a system cost config
 * Body: { key: string, value: number }
 */
export async function PUT(req: NextRequest) {
    const session = await auth()
    const role = (session?.user as any)?.role

    if (role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    try {
        const body = await req.json()
        const { key, value } = body

        if (!key || !SYSTEM_COST_KEYS.includes(key as SystemCostKey)) {
            return NextResponse.json({ error: "Invalid config key" }, { status: 400 })
        }

        const numValue = parseInt(value, 10)
        if (isNaN(numValue) || numValue < 0) {
            return NextResponse.json({ error: "Value must be a non-negative number" }, { status: 400 })
        }

        await prisma.systemConfig.upsert({
            where: { key },
            create: {
                key,
                value: String(numValue),
                description: SYSTEM_COST_DESCRIPTIONS[key as SystemCostKey],
            },
            update: {
                value: String(numValue),
            },
        })

        // Note: Frontend SWR will pick up changes on next fetch
        // Cache invalidation happens automatically via TTL

        return NextResponse.json({ success: true, key, value: numValue })


    } catch (error) {
        console.error("[ADMIN_CONFIG] Failed to update config:", error)
        return NextResponse.json({ error: "Failed to update config" }, { status: 500 })
    }
}
