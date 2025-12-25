"use client"

import type { ReactNode } from "react"
import React, { createContext, useCallback, useContext, useMemo, useState } from "react"

type LoginModalContextValue = {
  isOpen: boolean
  open: () => void
  close: () => void
}

const LoginModalContext = createContext<LoginModalContextValue | null>(null)

export function LoginModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])

  return React.createElement(LoginModalContext.Provider, { value }, children)
}

export function useLoginModal() {
  const ctx = useContext(LoginModalContext)
  if (!ctx) {
    throw new Error("useLoginModal 必须在 <LoginModalProvider> 内使用")
  }
  return ctx
}

