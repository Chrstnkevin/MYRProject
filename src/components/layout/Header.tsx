"use client"

import { useEffect, useState } from "react"
import { Menu, Bell, CalendarDays } from "lucide-react"
import { usePathname } from "next/navigation"
import { isoWeekInfo } from "@/lib/isoWeek"

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/dashboard":           { title: "Dashboard",        sub: "Selamat datang kembali 👋" },
  "/dashboard/notulensi": { title: "Notulensi",        sub: "Catatan rapat & action items" },
  "/dashboard/finance":   { title: "Finance Tracker",  sub: "Pantau pemasukan & pengeluaran" },
  "/dashboard/kanban":    { title: "Kanban Board",     sub: "Kelola tugas harian kamu" },
  "/dashboard/docreq":    { title: "Doc Requirement",  sub: "AI-powered requirement generator ✨" },
}

interface Props { onToggleSidebar: () => void; sidebarOpen: boolean }

// Widget "hari ini tanggal berapa, week berapa" — diminta user biar
// muncul di SEMUA halaman (ditaruh di Header yang emang dipakai bareng
// di dashboard/layout.tsx). Dihitung client-side di useEffect (bukan
// langsung render pas SSR) biar nggak mismatch hydration antara jam
// server vs browser user.
function DayWeekBadge() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  if (!now) return null
  const { week } = isoWeekInfo(now)
  const dayName = now.toLocaleDateString("id-ID", { weekday: "long" })
  const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 10px", borderRadius: 999,
      background: "linear-gradient(135deg,#0E4D64,#0891B2)", flexShrink: 0,
    }}>
      <CalendarDays size={13} color="white" style={{ flexShrink: 0 }} />
      <div className="day-week-text" style={{ lineHeight: 1.15 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "white", whiteSpace: "nowrap" }}>{dayName}, {dateStr}</div>
      </div>
      <span style={{ fontSize: 9, fontWeight: 800, color: "#0891B2", background: "white", padding: "2px 7px", borderRadius: 999, flexShrink: 0 }}>W{week}</span>
      <style>{`@media (max-width: 640px) { .day-week-text { display: none; } }`}</style>
    </div>
  )
}

export default function Header({ onToggleSidebar }: Props) {
  const pathname = usePathname()
  const base = Object.keys(PAGE_TITLES).find(k => k === pathname || (k !== "/dashboard" && pathname.startsWith(k))) || "/dashboard"
  const { title, sub } = PAGE_TITLES[base]

  return (
    <header style={{ height: "64px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", padding: "0 24px", gap: "16px", position: "sticky", top: 0, zIndex: 30 }}>
      <button onClick={onToggleSidebar} className="btn btn-ghost" style={{ padding: "8px", border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)" }}>
        <Menu size={18} />
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.2 }}>{title}</div>
        <div style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 500 }}>{sub}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <DayWeekBadge />
        <button className="btn btn-ghost" style={{ padding: "8px", borderRadius: "var(--radius-sm)", position: "relative" }}>
          <Bell size={17} />
          <span style={{ position: "absolute", top: "6px", right: "6px", width: "6px", height: "6px", borderRadius: "50%", background: "var(--danger)", border: "1.5px solid var(--surface)" }} />
        </button>
        <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, color: "white" }}>EG</div>
      </div>
    </header>
  )
}