"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

type AnnouncementModalContextType = {
    isOpen: boolean
    open: () => void
    close: () => void
}

const AnnouncementModalContext = createContext<AnnouncementModalContextType | null>(null)

export function useAnnouncementModal() {
    const context = useContext(AnnouncementModalContext)
    if (!context) {
        throw new Error("useAnnouncementModal must be used within AnnouncementModalProvider")
    }
    return context
}

export function AnnouncementModalProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])

    return (
        <AnnouncementModalContext.Provider value={{ isOpen, open, close }}>
            {children}
        </AnnouncementModalContext.Provider>
    )
}
