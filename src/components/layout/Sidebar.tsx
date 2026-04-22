"use client"

import { usePathname, useRouter } from "next/navigation"
import { Home, FileText, DollarSign, LayoutGrid, GitBranch, X, Sparkles, LogOut, ScrollText } from "lucide-react"

const NAV = [
  { icon: Home,       label: "Home",        path: "/dashboard",            desc: "Overview harian" },
  { icon: FileText,   label: "Notulensi",   path: "/dashboard/notulensi",  desc: "Catatan rapat" },
  { icon: DollarSign, label: "Finance",     path: "/dashboard/finance",    desc: "Keuangan" },
  { icon: LayoutGrid, label: "Kanban",      path: "/dashboard/kanban",     desc: "Task board" },
  { icon: GitBranch,  label: "User Flow",   path: "/dashboard/userflow",   desc: "Diagram" },
  { icon: ScrollText, label: "Doc Req",     path: "/dashboard/docreq",     desc: "AI Doc Generator" },
]

interface Props { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const today   = new Date()
  const dayName = today.toLocaleDateString("id-ID", { weekday: "long" })
  const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

  const handleLogout = () => {
    document.cookie = "sb-session-manual=; path=/; max-age=0"
    router.push("/login")
  }

  const closeIfMobile = () => {
    if (window.innerWidth < 768) onClose()
  }

  return (
    <>
      <aside style={{
        position: "fixed", top: 0, left: 0, height: "100vh", width: "260px",
        background: "var(--surface)", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", zIndex: 50,
        transform: isOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
      }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={18} color="white" />
              </div>
              <div>
                <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Elite Global</div>
                <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 500 }}>Productivity OS</div>
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "6px", borderRadius: "7px", display: "none" }} className="sidebar-close-btn">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Date pill */}
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ background: "var(--accent-muted)", borderRadius: "var(--radius-sm)", padding: "10px 14px", border: "1px solid var(--accent-light)" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{dayName}</div>
            <div style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600, marginTop: "1px" }}>{dateStr}</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
          <div className="label" style={{ padding: "4px 8px 8px" }}>Menu</div>
          {NAV.map(({ icon: Icon, label, path, desc }) => {
            const active = pathname === path || (path !== "/dashboard" && pathname.startsWith(path))
            const isNew = path === "/dashboard/docreq"
            return (
              <button key={path} onClick={() => { router.push(path); closeIfMobile() }}
                style={{
                  display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
                  borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
                  width: "100%", textAlign: "left", transition: "all 0.15s",
                  background: active ? "var(--accent-muted)" : "transparent",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--accent)" : "var(--surface3)", transition: "all 0.15s" }}>
                  <Icon size={16} color={active ? "white" : "var(--text3)"} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text)", display: "flex", alignItems: "center", gap: "6px" }}>
                    {label}
                    {isNew && <span style={{ fontSize: "9px", background: "var(--accent)", color: "white", padding: "1px 5px", borderRadius: "99px", fontWeight: 700 }}>AI</span>}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--text3)" }}>{desc}</div>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Bottom */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", fontWeight: 700, color: "white", flexShrink: 0 }}>EG</div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>System Support</div>
              <div style={{ fontSize: "11px", color: "var(--text3)" }}>Elite Global</div>
            </div>
            <button onClick={handleLogout} title="Logout"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: "6px", borderRadius: "7px", transition: "all 0.15s", flexShrink: 0 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--danger-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--danger)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = "var(--text3)" }}>
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {isOpen && (
        <div onClick={onClose} className="sidebar-backdrop" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 49, backdropFilter: "blur(2px)", display: "none" }} />
      )}

      <style>{`
        @media (max-width: 768px) {
          .sidebar-close-btn { display: flex !important; }
          .sidebar-backdrop  { display: block !important; }
        }
      `}</style>
    </>
  )
}