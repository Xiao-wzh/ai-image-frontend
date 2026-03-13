import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/check-admin"
import { ActivityAdminClient } from "@/components/admin/activity-admin-client"
import { Sidebar } from "@/components/sidebar"

export const dynamic = "force-dynamic"

export default async function AdminActivityPage() {
  const guard = await requireAdmin()
  if (!guard.ok) {
    redirect("/")
  }

  return (
    <div className="flex h-screen bg-slate-950">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <ActivityAdminClient />
        </div>
      </main>
    </div>
  )
}
