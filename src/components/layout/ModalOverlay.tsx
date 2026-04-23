"use client"

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { useSidebar } from "@/app/dashboard/layout"

interface Props {
  onClose: () => void
  children: React.ReactNode
}

export default function ModalOverlay({ onClose, children }: Props) {
  const [mounted, setMounted] = useState(false)
  const { sidebarOpen } = useSidebar()

  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  // sidebar width on desktop: 260px. We shift the centering area to exclude sidebar.
  const sidebarW = typeof window !== "undefined" && window.innerWidth >= 768 && sidebarOpen ? 260 : 0

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(26,26,24,0.45)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        paddingLeft: sidebarW + 16,
        animation: "fadeOverlay 0.2s ease",
      }}
    >
      {children}
    </div>,
    document.body
  )
}