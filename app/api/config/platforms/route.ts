import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const taskType = searchParams.get("taskType") || "MAIN_IMAGE"
  const mode = searchParams.get("mode") || "CREATIVE"

  const platforms = await prisma.platform.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      prompts: {
        where: {
          isActive: true,
          userId: null,
          taskType,
          mode,
        },
        select: {
          productType: true,
          description: true,
        },
      },
    },
  })

  const tree = platforms
    .map((p: { id: string; key: string; label: string; prompts: { productType: string; description: string | null }[] }) => {
      const m = new Map<string, { label: string; value: string }>()
      for (const t of p.prompts) {
        const value = t.productType
        const label = t.description || t.productType
        if (!m.has(value)) m.set(value, { label, value })
      }

      return {
        id: p.id,
        label: p.label,
        value: p.key,
        types: Array.from(m.values()),
      }
    })
    .filter((p) => p.types.length > 0)

  return NextResponse.json(tree)
}


