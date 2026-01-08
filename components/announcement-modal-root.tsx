"use client"

import { useEffect } from "react"
import { useAnnouncementModal } from "@/hooks/use-announcement-modal"
import { SystemAnnouncementModal, shouldAutoOpenAnnouncement } from "@/components/system-announcement-modal"

export function AnnouncementModalRoot() {
    const { isOpen, open, close } = useAnnouncementModal()

    useEffect(() => {
        // Auto-open on first visit if not dismissed today
        if (shouldAutoOpenAnnouncement()) {
            // Delay slightly to allow page to render first
            const timer = setTimeout(() => {
                open()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [open])

    return (
        <SystemAnnouncementModal
            open={isOpen}
            onOpenChange={(value) => {
                if (!value) close()
            }}
        />
    )
}
