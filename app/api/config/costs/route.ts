import { NextResponse } from "next/server"
import { getSystemCosts } from "@/lib/system-config"

export const dynamic = "force-dynamic"

/**
 * GET /api/config/costs
 * Returns all system cost configurations as a typed object
 */
export async function GET() {
    try {
        const costs = await getSystemCosts()
        return NextResponse.json(costs)
    } catch (error) {
        console.error("[API] Failed to load system costs:", error)
        return NextResponse.json(
            { error: "Failed to load system costs" },
            { status: 500 }
        )
    }
}
