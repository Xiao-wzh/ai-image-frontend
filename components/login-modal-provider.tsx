"use client"

import { LoginModalProvider } from "@/hooks/use-login-modal"

export function LoginModalProviderClient({
  children,
}: {
  children: React.ReactNode
}) {
  return <LoginModalProvider>{children}</LoginModalProvider>
}



