"use client"

import { useState, useEffect } from "react"
import Sidebar from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Desktop: default open. Mobile: default closed.
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // Set initial state based on screen width setelah mount
    const isMobile = window.innerWidth < 768
    setSidebarOpen(!isMobile)
    setMounted(true)
  }, [])

  if (!mounted) return null // hindari hydration mismatch

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div
        style={{
          flex: 1,
          // Desktop: geser konten sesuai lebar sidebar
          // Mobile: konten full width, sidebar overlay di atas
          paddingLeft: sidebarOpen ? "260px" : "0",
          transition: "padding-left 0.3s cubic-bezier(0.22,1,0.36,1)",
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          width: "100%",
        }}
        className="main-content"
      >
        <Header
          onToggleSidebar={() => setSidebarOpen(v => !v)}
          sidebarOpen={sidebarOpen}
        />
        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          {children}
        </main>
      </div>

      {/* Mobile: padding-left 0 selalu karena sidebar overlay */}
      <style>{`
        @media (max-width: 768px) {
          .main-content {
            padding-left: 0 !important;
          }
        }
      `}</style>
    </div>
  )
}