"use client"

import { Sidebar } from "@/components/sidebar"
import { UploadZone } from "@/components/upload-zone"
import { ImageGrid } from "@/components/image-grid"

export default function DashboardPage() {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <UploadZone />
            <ImageGrid />
          </div>
        </main>
      </div>
    </div>
  )
}
