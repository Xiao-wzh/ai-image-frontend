import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAdmin } from "@/lib/check-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const guard = await requireAdmin()
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status })
  }

  const { searchParams } = new URL(req.url)
  const scope = String(searchParams.get("scope") ?? "all") // all | system | private

  const wherePrompts =
    scope === "system"
      ? { userId: null }
      : scope === "private"
        ? { userId: { not: null } }
        : {}

  const platforms = await prisma.platform.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      key: true,
      label: true,
      sortOrder: true,
      isActive: true,
      prompts: {
        where: {
          ...wherePrompts,
        },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          productType: true,
          taskType: true,
          description: true,
          promptTemplate: true,
          isActive: true,
          userId: true,
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              name: true,
            },
          },
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  return NextResponse.json({ success: true, platforms })
}
