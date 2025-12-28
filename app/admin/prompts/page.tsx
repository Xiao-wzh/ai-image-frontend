import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/check-admin"
import { PromptsAdminClient } from "@/components/admin/prompts-admin-client"

export const dynamic = "force-dynamic"

export default async function AdminPromptsPage() {
  const guard = await requireAdmin()
  if (!guard.ok) {
    redirect("/")
  }

  return <PromptsAdminClient />
}

