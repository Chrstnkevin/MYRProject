"use client"

import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import Sidebar from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"

// Context so child pages can render modals at root level
import { createContext, useContext } from "react"

export const SidebarContext = createContext({ sidebarOpen: false })
export function useSidebar() { return useContext(SidebarContext) }

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const isMobile = window.innerWidth < 768
    setSidebarOpen(!isMobile)
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <SidebarContext.Provider value={{ sidebarOpen }}>
      <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)" }}>
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div
          style={{
            flex: 1,
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

        <style>{`
          @media (max-width: 768px) {
            .main-content { padding-left: 0 !important; }
          }
        `}</style>
      </div>
    </SidebarContext.Provider>
  )
}