import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const platforms = await prisma.platform.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      prompts: {
        where: { isActive: true, userId: null },
        select: {
          productType: true,
          description: true,
        },
      },
    },
  })

  // distinct productType
  const tree = platforms.map((p) => {
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

  return NextResponse.json(tree)
}

