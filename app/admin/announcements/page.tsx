import { redirect } from "next/navigation"
import { requireAdmin } from "@/lib/check-admin"
import { AnnouncementsAdminClient } from "@/components/admin/announcements-admin-client"
import { Sidebar } from "@/components/sidebar"

export const dynamic = "force-dynamic"

export default async function AdminAnnouncementsPage() {
    const guard = await requireAdmin()
    if (!guard.ok) {
        redirect("/")
    }

    return (
        <div className="flex min-h-screen bg-slate-950">
            <Sidebar />
            <main className="flex-1 overflow-y-auto">
                <AnnouncementsAdminClient />
            </main>
        </div>
    )
}
