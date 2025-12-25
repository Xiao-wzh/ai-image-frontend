"use client"

import { RegisterModal } from "@/components/register-modal"
import { useLoginModal } from "@/hooks/use-login-modal"

export function LoginModalRoot() {
  const { isOpen, close } = useLoginModal()

  return <RegisterModal isOpen={isOpen} onClose={close} />
}
