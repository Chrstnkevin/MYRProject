"use client"

import { useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  Home, FileText, LayoutGrid, GitBranch, ScrollText,
  X, Sparkles, LogOut, Database, ClipboardList, FolderOpen,
  ChevronDown, ChevronRight, ImageIcon, UploadCloud, Globe,
  BarChart3, TrendingUp, Users, Server, HardDrive, RefreshCcw,
    Cloud, KeyRound, Radio, Pencil, BookOpen, Monitor, HeartHandshake, Activity, Ticket
} from "lucide-react"

const NAV_TOP = [
  { icon: Home, label: "Home", path: "/dashboard", desc: "Overview harian" },
]

const NAV_PRODUCTIVITY = [
  { icon: LayoutGrid, label: "Kanban",      path: "/dashboard/kanban",       desc: "Task board",               badge: undefined as string | undefined, badgeColor: undefined as string | undefined },
  { icon: FileText,   label: "Notulensi",   path: "/dashboard/notulensi",    desc: "Catatan rapat",            badge: undefined, badgeColor: undefined },
  { icon: BookOpen,   label: "Our System",  path: "/dashboard/our-system",   desc: "Knowledge base sistem PHI", badge: undefined, badgeColor: "#534AB7" },
]

const NAV_SUPPORT_LOKAL = [
  { icon: Server, label: "VM DB",         path: "/dashboard/vm-db",          desc: "Disk usage monitoring",  badge: "VM",  badgeColor: "#0369A1" },
  { icon: Cloud,  label: "OwnCloud Logs", path: "/dashboard/owncloud-admin", desc: "Log aktivitas OwnCloud", badge: "Log", badgeColor: "#0891B2" },
]

const NAV_SUPPORT_PHI = [
  { icon: BarChart3,  label: "Compare Target",     path: "/dashboard/target-compare",    desc: "Excel vs Ficom sampai Pcode", badge: "Target", badgeColor: "#0369A1" },
  { icon: TrendingUp, label: "Productivity Compare", path: "/dashboard/productivity-compare", desc: "Target vs Realisasi per komponen", badge: "Prod", badgeColor: "#16A34A" },
  { icon: Ticket,     label: "Ticket Logix",       path: "/dashboard/logix-tickets",     desc: "Monitoring tiket Log Support Excellent", badge: "Logix", badgeColor: "#DC2626" },
  { icon: ClipboardList, label: "Backlog PHI",         path: "/dashboard/backlog-phi",    desc: "Concern & request PHI",       badge: "PHI",    badgeColor: "#DC2626" },
  { icon: Globe,         label: "Sharing Knowledge",   path: "/dashboard/landing-admin",  desc: "Tutorial, Infografis & Zoom", badge: undefined, badgeColor: undefined },
  { icon: Radio,         label: "Data Transfer Ficom", path: "/dashboard/data-transfer",  desc: "Monitor EDI & transfer",      badge: "EDI",    badgeColor: "#0891B2" },
  { icon: Activity,      label: "MPP Health",          path: "/dashboard/mpp-health",     desc: "SFA Hierarchy Monitoring",    badge: "MPP",    badgeColor: "#1E3A5F" },
]

const NAV_BACKUP_RESTORE = [
  { icon: Database,  label: "Restore DB PHI", path: "/dashboard/restore-phi", desc: "Monitoring DRP Restore",   badge: "Restore", badgeColor: "#6d28d9" },
  { icon: HardDrive, label: "Backup DB PHI",  path: "/dashboard/backup-phi",  desc: "Checklist backup tim PHI", badge: "Backup",  badgeColor: "#1d4ed8" },
]

const NAV_UTILISASI = [
  { icon: BarChart3,  label: "SFA Upload",        path: "/dashboard/sfa-upload",        desc: "Update data SFA",        badge: "SFA",   badgeColor: "#E8381A" },
  { icon: TrendingUp, label: "Ficom Upload",       path: "/dashboard/ficom-upload",      desc: "Update data Ficom",      badge: "Ficom", badgeColor: "#FB8C00" },
  { icon: TrendingUp, label: "Ficom Lite Upload",  path: "/dashboard/ficom-lite-upload", desc: "Update data Ficom Lite", badge: "Lite",  badgeColor: "#22C55E" },
]

const NAV_MASTER = [
  { icon: Users,    label: "Master Utilisasi", path: "/dashboard/master-utilisasi", desc: "Kelola MASTERDATAPHI",    badge: "Utilisasi", badgeColor: "#7C3AED" },
  { icon: Database, label: "Master Data",      path: "/dashboard/master-data",      desc: "ADP Depot & Distributor", badge: "ADP",       badgeColor: "#0369A1" },
  { icon: KeyRound, label: "Ficom Password",   path: "/dashboard/ficom-password",   desc: "User Login & Password",   badge: "Pwd",       badgeColor: "#7C3AED" },
]

const NAV_DOKUMEN = [
  { icon: BookOpen,      label: "Knowledge Base",   path: "/dashboard/knowledge-base", desc: "Mind map app & fitur",    ai: false },
  { icon: ScrollText,    label: "Doc Req",          path: "/dashboard/docreq",         desc: "AI Doc Generator",        ai: true  },
  { icon: GitBranch,     label: "User Flow",        path: "/dashboard/userflow",       desc: "AI Flowchart Generator",  ai: true  },
  { icon: ClipboardList, label: "Scenario Test",    path: "/dashboard/scenario-test",  desc: "Form Scenario Testing",   ai: false },
  { icon: ImageIcon,     label: "Poster Generator", path: "/dashboard/poster-gen",     desc: "AI Poster dari Dokumen",  ai: true  },
]

const FlagIndonesia = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size * 0.667} viewBox="0 0 30 20" style={{ borderRadius: "2px", display: "block" }}>
    <rect width="30" height="10" fill="#CE1126"/>
    <rect y="10" width="30" height="10" fill="#FFFFFF"/>
  </svg>
)

const FlagPhilippines = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size * 0.5} viewBox="0 0 60 30" style={{ borderRadius: "2px", display: "block" }}>
    <rect width="60" height="15" fill="#0038A8"/>
    <rect y="15" width="60" height="15" fill="#CE1126"/>
    <polygon points="0,0 30,15 0,30" fill="#FFFFFF"/>
    <polygon points="10,15 7,11 11,13 8,9 10,13 14,11 11,13 14,17 10,15 13,19 11,15 7,17" fill="#FCD116" transform="translate(3, 0)"/>
    <circle cx="9" cy="15" r="3" fill="#FCD116"/>
  </svg>
)

const IconFlagID = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
    <FlagIndonesia size={20} />
  </div>
)
const IconFlagPH = () => (
  <div style={{ display:"flex", alignItems:"center", justifyContent:"center" }}>
    <FlagPhilippines size={20} />
  </div>
)

interface Props { isOpen: boolean; onClose: () => void }

export default function Sidebar({ isOpen, onClose }: Props) {
  const router   = useRouter()
  const pathname = usePathname()

  const isProductivityActive  = NAV_PRODUCTIVITY.some(n => pathname.startsWith(n.path))
  const isSupportLokalActive  = NAV_SUPPORT_LOKAL.some(n => pathname.startsWith(n.path))
  const isSupportPhiActive    = NAV_SUPPORT_PHI.some(n => pathname.startsWith(n.path))
  const isBackupRestoreActive = NAV_BACKUP_RESTORE.some(n => pathname.startsWith(n.path))
  const isUtilisasiActive     = NAV_UTILISASI.some(n => pathname.startsWith(n.path))
  const isMasterActive        = NAV_MASTER.some(n => pathname.startsWith(n.path))
  const isDokumenActive       = NAV_DOKUMEN.some(n => pathname.startsWith(n.path))

  const [productivityOpen,  setProductivityOpen]  = useState(isProductivityActive)
  const [supportLokalOpen,  setSupportLokalOpen]  = useState(isSupportLokalActive)
  const [supportPhiOpen,    setSupportPhiOpen]    = useState(isSupportPhiActive)
  const [backupRestoreOpen, setBackupRestoreOpen] = useState(isBackupRestoreActive)
  const [utilisasiOpen,     setUtilisasiOpen]     = useState(isUtilisasiActive)
  const [masterOpen,        setMasterOpen]        = useState(isMasterActive)
  const [dokumenOpen,       setDokumenOpen]       = useState(isDokumenActive)

  const today   = new Date()
  const dayName = today.toLocaleDateString("id-ID", { weekday: "long" })
  const dateStr = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })

  const handleLogout = () => {
    document.cookie = "sb-session-manual=; path=/; max-age=0"
    router.push("/login")
  }

  const closeIfMobile = () => { if (window.innerWidth < 768) onClose() }
  const isActive = (path: string) =>
    pathname === path || (path !== "/dashboard" && pathname.startsWith(path))

  const NestedBtn = ({
    icon: Icon, label, path, desc, ai, badge, badgeColor
  }: {
    icon: React.ElementType; label: string; path: string; desc: string
    ai?: boolean; badge?: string; badgeColor?: string
  }) => {
    const active = isActive(path)
    return (
      <button onClick={() => { router.push(path); closeIfMobile() }}
        style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "8px 10px 8px 34px", borderRadius: "var(--radius-sm)",
          border: "none", cursor: "pointer", width: "100%", textAlign: "left",
          transition: "all 0.15s",
          background: active ? "var(--accent-muted)" : "transparent",
          fontFamily: "'Plus Jakarta Sans', sans-serif",
        }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "8px", flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: active ? (badgeColor || "var(--accent)") : "var(--surface3)",
          transition: "all 0.15s",
        }}>
          <Icon size={14} color={active ? "white" : "var(--text3)"} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "12px", fontWeight: active ? 700 : 500,
            color: active ? (badgeColor || "var(--accent)") : "var(--text)",
            display: "flex", alignItems: "center", gap: "5px",
          }}>
            {label}
            {badge && (
              <span style={{ fontSize: "8px", background: badgeColor || "var(--accent)", color: "white", padding: "1px 5px", borderRadius: "99px", fontWeight: 700 }}>{badge}</span>
            )}
            {ai && (
              <span style={{ fontSize: "8px", background: "var(--accent)", color: "white", padding: "1px 4px", borderRadius: "99px", fontWeight: 700 }}>AI</span>
            )}
          </div>
          <div style={{ fontSize: "10px", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc}</div>
        </div>
        {active && <div style={{ width: "4px", height: "4px", borderRadius: "50%", background: badgeColor || "var(--accent)", flexShrink: 0 }} />}
      </button>
    )
  }

  const GroupHeader = ({
    label, desc, icon: Icon, isActive: active, isOpen: open, onToggle, accentColor
  }: {
    label: string; desc: string; icon: React.ElementType
    isActive: boolean; isOpen: boolean; onToggle: () => void; accentColor?: string
  }) => (
    <button onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
        borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer",
        width: "100%", textAlign: "left", transition: "all 0.15s",
        background: active && !open ? "var(--accent-muted)" : "transparent",
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
      <div style={{
        width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: active ? (accentColor || "var(--accent)") : "var(--surface3)",
        transition: "all 0.15s",
      }}>
        <Icon size={16} color={active ? "white" : "var(--text3)"} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "13px", fontWeight: active ? 700 : 500, color: active ? (accentColor || "var(--accent)") : "var(--text)" }}>{label}</div>
        <div style={{ fontSize: "11px", color: "var(--text3)" }}>{desc}</div>
      </div>
      {open ? <ChevronDown size={14} color="var(--text3)" /> : <ChevronRight size={14} color="var(--text3)" />}
    </button>
  )

  const NestedContainer = ({ open, children, lineColor }: { open: boolean; children: React.ReactNode; lineColor?: string }) => (
    <div style={{ overflow: "hidden", maxHeight: open ? "500px" : "0px", transition: "max-height 0.28s cubic-bezier(0.22,1,0.36,1)" }}>
      <div style={{ paddingLeft: "14px", paddingTop: "2px", display: "flex", flexDirection: "column", gap: "2px" }}>
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: "16px", top: 0, bottom: 0, width: "1.5px", background: lineColor || "var(--border2)", borderRadius: "99px" }} />
          {children}
        </div>
      </div>
    </div>
  )

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

        {/* Date */}
        <div style={{ padding: "14px 16px 0" }}>
          <div style={{ background: "var(--accent-muted)", borderRadius: "var(--radius-sm)", padding: "10px 14px", border: "1px solid var(--accent-light)" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>{dayName}</div>
            <div style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600, marginTop: "1px" }}>{dateStr}</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "14px 12px", display: "flex", flexDirection: "column", gap: "2px", overflowY: "auto" }}>
          <div className="label" style={{ padding: "4px 8px 8px" }}>Menu</div>

          {/* Home */}
          {NAV_TOP.map(({ icon: Icon, label, path, desc }) => {
            const active = isActive(path)
            return (
              <button key={path} onClick={() => { router.push(path); closeIfMobile() }}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "none", cursor: "pointer", width: "100%", textAlign: "left", transition: "all 0.15s", background: active ? "var(--accent-muted)" : "transparent", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                <div style={{ width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: active ? "var(--accent)" : "var(--surface3)", transition: "all 0.15s" }}>
                  <Icon size={16} color={active ? "white" : "var(--text3)"} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text)" }}>{label}</div>
                  <div style={{ fontSize: "11px", color: "var(--text3)" }}>{desc}</div>
                </div>
              </button>
            )
          })}

          {/* ── Productivity ── */}
          <div style={{ marginTop: "4px" }}>
            <GroupHeader
              icon={Pencil}
              label="Productivity"
              desc="Kanban & Notulensi"
              isActive={isProductivityActive}
              isOpen={productivityOpen}
              onToggle={() => setProductivityOpen(v => !v)}
              accentColor="#0891B2"
            />
            <NestedContainer open={productivityOpen} lineColor="rgba(8,145,178,0.3)">
              {NAV_PRODUCTIVITY.map(item => <NestedBtn key={item.path} {...item} />)}
            </NestedContainer>
          </div>

          {/* ── Support Lokal ── */}
          <div style={{ marginTop: "4px" }}>
            <GroupHeader
              icon={IconFlagID}
              label="Support Lokal"
              desc="VM DB & OwnCloud"
              isActive={isSupportLokalActive}
              isOpen={supportLokalOpen}
              onToggle={() => setSupportLokalOpen(v => !v)}
              accentColor="#0369A1"
            />
            <NestedContainer open={supportLokalOpen} lineColor="rgba(3,105,161,0.3)">
              {NAV_SUPPORT_LOKAL.map(item => <NestedBtn key={item.path} {...item} />)}
            </NestedContainer>
          </div>

          {/* ── Support PHI ── */}
          <div style={{ marginTop: "4px" }}>
            <GroupHeader
              icon={IconFlagPH}
              label="Support PHI"
              desc="Backlog, Knowledge & Transfer"
              isActive={isSupportPhiActive}
              isOpen={supportPhiOpen}
              onToggle={() => setSupportPhiOpen(v => !v)}
              accentColor="#DC2626"
            />
            <NestedContainer open={supportPhiOpen} lineColor="rgba(220,38,38,0.3)">
              {NAV_SUPPORT_PHI.map(item => <NestedBtn key={item.path} {...item} />)}
            </NestedContainer>
          </div>

          {/* ── Backup & Restore DB PHI ── */}
          <div style={{ marginTop: "4px" }}>
            <GroupHeader
              icon={RefreshCcw}
              label="Backup & Restore PHI"
              desc="DRP Backup & Restore monitoring"
              isActive={isBackupRestoreActive}
              isOpen={backupRestoreOpen}
              onToggle={() => setBackupRestoreOpen(v => !v)}
              accentColor="#6d28d9"
            />
            <NestedContainer open={backupRestoreOpen} lineColor="rgba(109,40,217,0.3)">
              {NAV_BACKUP_RESTORE.map(item => <NestedBtn key={item.path} {...item} />)}
            </NestedContainer>
          </div>

          {/* ── Data Utilisasi ── */}
          <div style={{ marginTop: "4px" }}>
            <GroupHeader
              icon={UploadCloud}
              label="Data Utilisasi"
              desc="SFA & Ficom upload"
              isActive={isUtilisasiActive}
              isOpen={utilisasiOpen}
              onToggle={() => setUtilisasiOpen(v => !v)}
              accentColor="#1E88E5"
            />
            <NestedContainer open={utilisasiOpen} lineColor="rgba(30,136,229,0.3)">
              {NAV_UTILISASI.map(item => <NestedBtn key={item.path} {...item} />)}
            </NestedContainer>
          </div>

          {/* ── Master Data ── */}
          <div style={{ marginTop: "4px" }}>
            <GroupHeader
              icon={Database}
              label="Master Data"
              desc="Utilisasi, ADP & Ficom Password"
              isActive={isMasterActive}
              isOpen={masterOpen}
              onToggle={() => setMasterOpen(v => !v)}
              accentColor="#7C3AED"
            />
            <NestedContainer open={masterOpen} lineColor="rgba(124,58,237,0.3)">
              {NAV_MASTER.map(item => <NestedBtn key={item.path} {...item} />)}
            </NestedContainer>
          </div>

          {/* ── Dokumen ── */}
          <div style={{ marginTop: "4px" }}>
            <GroupHeader
              icon={FolderOpen}
              label="Dokumen"
              desc="Doc Req, User Flow, Scenario"
              isActive={isDokumenActive}
              isOpen={dokumenOpen}
              onToggle={() => setDokumenOpen(v => !v)}
            />
            <NestedContainer open={dokumenOpen}>
              {NAV_DOKUMEN.map(item => <NestedBtn key={item.path} {...item} />)}
            </NestedContainer>
          </div>
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