"use client"

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react"

type Announcement = {
    id: string
    title: string
    content: string
    type: "PINNED" | "NORMAL"
    createdAt: string
}

type AnnouncementModalContextType = {
    isOpen: boolean
    open: () => void
    close: () => void
    pinnedBanner: Announcement | null
    dismissBanner: () => void
}

const AnnouncementModalContext = createContext<AnnouncementModalContextType | null>(null)

const BANNER_STORAGE_KEY = "top_banner_dismissed_id"

export function useAnnouncementModal() {
    const context = useContext(AnnouncementModalContext)
    if (!context) {
        throw new Error("useAnnouncementModal must be used within AnnouncementModalProvider")
    }
    return context
}

export function AnnouncementModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)
    const [pinnedBanner, setPinnedBanner] = useState<Announcement | null>(null)

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])

    // Dismiss banner and save to localStorage
    const dismissBanner = useCallback(() => {
        if (pinnedBanner) {
            localStorage.setItem(BANNER_STORAGE_KEY, pinnedBanner.id)
        }
        setPinnedBanner(null)
    }, [pinnedBanner])

    // Fetch announcements on mount
    useEffect(() => {
        async function fetchAnnouncements() {
            try {
                const res = await fetch("/api/announcements/active")
                if (!res.ok) return
                const data = await res.json()
                const announcements: Announcement[] = data.announcements || []

                // Find the latest PINNED announcement for banner
                const pinned = announcements.find(a => a.type === "PINNED")
                if (pinned) {
                    // Check if already dismissed
                    const dismissedId = localStorage.getItem(BANNER_STORAGE_KEY)
                    if (dismissedId !== pinned.id) {
                        setPinnedBanner(pinned)
                    }
                }
            } catch (error) {
                console.error("Failed to fetch announcements for banner:", error)
            }
        }

        fetchAnnouncements()
    }, [])

    return (
        <AnnouncementModalContext.Provider value={{ isOpen, open, close, pinnedBanner, dismissBanner }}>
            {children}
        </AnnouncementModalContext.Provider>
    )
}
