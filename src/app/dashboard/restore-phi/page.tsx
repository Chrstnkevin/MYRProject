"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { supabase } from "@/lib/supabase"
import {
  Database, CheckCircle2, Clock, AlertTriangle, X, Upload,
  ChevronRight, Bell, Calendar, Server, Search, Filter,
  Save, Image as ImageIcon, Trash2, Eye
} from "lucide-react"
import ModalOverlay from "@/components/layout/ModalOverlay"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ─── Types ────────────────────────────────────────────────────────────────────
interface RestoreEntry {
  id: string
  area: string
  server: string
  adp_code: string
  adp_name: string
  pic_phi: string
  month: number
  year: number
  restore_date: string | null
  trans_date: string | null
  backup_size: number | null
  backup_tools_version: string
  restore_status: string | null
  pic_restore: string | null
  done_restore: boolean
  screenshot_1: string | null
  screenshot_2: string | null
  screenshot_3: string | null
  created_at: string
}

// Master list dari Excel
const MASTER_DATA = [
  { area: "GMA", server: "138", adp_code: "100018", adp_name: "MAGIS I-RIZAL", pic_phi: "JC" },
  { area: "GMA", server: "138", adp_code: "100019", adp_name: "MAGIS II-PASIG", pic_phi: "JC" },
  { area: "GMA", server: "138", adp_code: "100020", adp_name: "MAGIS I-QUEZON CITY", pic_phi: "JC" },
  { area: "GMA", server: "138", adp_code: "100024", adp_name: "ARMATURE-MANILA", pic_phi: "Lindon" },
  { area: "GMA", server: "138", adp_code: "100025", adp_name: "ARMATURE-VALENZUELA", pic_phi: "Lindon" },
  { area: "NOL", server: "138", adp_code: "200012", adp_name: "BUY PINOY-ILOCOS NORTE", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200018", adp_name: "GIALOGO-AURORA", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200020", adp_name: "TRES MARIAS-LA UNION", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200025", adp_name: "TPCI-BATAAN", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200029", adp_name: "DRDI-NUEVA ECIJA", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200030", adp_name: "MEN2-PANGASINAN", pic_phi: "Van" },
  { area: "SOL", server: "138", adp_code: "300005", adp_name: "SPARK-UPPER LAGUNA", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300013", adp_name: "ACC-CATANDUANES", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300015", adp_name: "SOLIDCORE-MASBATE", pic_phi: "Lindon" },
  { area: "GMA", server: "138", adp_code: "300016", adp_name: "TOP PERFORMANCE-PALAWAN", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300018", adp_name: "KIMLEDA-OCCIDENTAL MINDORO", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300020", adp_name: "CASCALLA-ROMBLON", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300021", adp_name: "PEARL GAB-MARINDUQUE", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300022", adp_name: "SPARK-LOWER LAGUNA", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300023", adp_name: "TOP PERFORMANCE-ORIENTAL MINDORO", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300025", adp_name: "CHASE-SORSOGON", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300027", adp_name: "AIMRAM-EASTERN QUEZON", pic_phi: "Lindon" },
  { area: "VIS", server: "138", adp_code: "400016", adp_name: "BERTAHAN-CALBAYOG", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400017", adp_name: "BERTAHAN-BORONGAN", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400018", adp_name: "BERTAHAN-TACLOBAN", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400019", adp_name: "TRIPLE FIVE-ILOILO", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400025", adp_name: "APEX FOODS-SAN FERNANDO", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400027", adp_name: "TRIPLE FIVE-SAN JOSE", pic_phi: "Darren" },
  { area: "MIN", server: "138", adp_code: "500017", adp_name: "NS DISTRIBUTION-TANDAG", pic_phi: "JC" },
  { area: "NOL", server: "228", adp_code: "200003", adp_name: "TPCI-PAMPANGA", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200005", adp_name: "TPCI-ZAMBALES", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200006", adp_name: "TPCI-BULACAN", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200007", adp_name: "PRONTO-CENTRAL PANGASINAN", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200008", adp_name: "NL AZAP-CAR", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200009", adp_name: "NCT-ABRA", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200011", adp_name: "JEZREEL-WEST PANGASINAN", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200013", adp_name: "BUY PINOY-ILOCOS SUR", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200014", adp_name: "SOARINGHIGH-LAL-LO", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200015", adp_name: "STARCHIME-ISABELA", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200027", adp_name: "COMLAI-NUEVA VIZCAYA", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200028", adp_name: "DRDI-TARLAC", pic_phi: "Van" },
  { area: "SOL", server: "228", adp_code: "300007", adp_name: "STANCE-CAMSUR", pic_phi: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300008", adp_name: "STANCE-CAMNORTE", pic_phi: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300010", adp_name: "MSA-EAST BATANGAS", pic_phi: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300011", adp_name: "CHASE-ALBAY", pic_phi: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300012", adp_name: "MSA-UPPER QUEZON", pic_phi: "Lindon" },
  { area: "VIS", server: "228", adp_code: "400010", adp_name: "APEX FOODS-BOGO", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400014", adp_name: "BERTAHAN-SOGOD", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400015", adp_name: "BERTAHAN-ORMOC", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400021", adp_name: "XCEED GLOBAL-KALIBO", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400023", adp_name: "TRIPLE FIVE-GUIMARAS", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400026", adp_name: "XCEED GLOBAL-ESTANCIA", pic_phi: "Darren" },
  { area: "MIN", server: "228", adp_code: "500010", adp_name: "CIMEM-TAGUM", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500011", adp_name: "DAVAO REACH-KIDAPAWAN", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500013", adp_name: "GDMC-ZAMBOANGA", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500014", adp_name: "888 SOCSARGEN-DIGOS", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500015", adp_name: "GDMC-IPIL", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500028", adp_name: "KGD-OZAMIS", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500030", adp_name: "EIGHTCHAMS-SAN FRANCISCO", pic_phi: "JC" },
  { area: "GMA", server: "252", adp_code: "100021", adp_name: "MAGIS II-PARANAQUE", pic_phi: "JC" },
  { area: "NOL", server: "252", adp_code: "200024", adp_name: "COMLAI-TUGUEGARAO", pic_phi: "Van" },
  { area: "SOL", server: "252", adp_code: "300001", adp_name: "MSA-LOWER CAVITE", pic_phi: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300002", adp_name: "TOPTRADER-UPPER CAVITE", pic_phi: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300006", adp_name: "CONSUMERPLUS-WEST BATANGAS", pic_phi: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300009", adp_name: "PAKYAHDA-LOWER QUEZON", pic_phi: "Lindon" },
  { area: "VIS", server: "252", adp_code: "400001", adp_name: "APEX FOODS-CEBU", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400002", adp_name: "CGM-BACOLOD", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400003", adp_name: "BROLLEE-CEBU", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400005", adp_name: "SEMIGI-DUMAGUETE", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400006", adp_name: "CGM-CADIZ", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400007", adp_name: "CGM-KABANKALAN", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400020", adp_name: "XCEED GLOBAL-ROXAS", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400024", adp_name: "XCEED GLOBAL-BORACAY", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400028", adp_name: "NETMAN-TAGBILARAN", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400029", adp_name: "NETMAN-UBAY", pic_phi: "Darren" },
  { area: "MIN", server: "252", adp_code: "500007", adp_name: "CIMEM-MATI", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500008", adp_name: "DAVAO REACH-GENSAN", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500009", adp_name: "SOUTHMIN-DAVAO", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500020", adp_name: "JOSCHAM-CDO", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500021", adp_name: "JOSCHAM-ILIGAN", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500022", adp_name: "EIGHTCHAMS-SURIGAO", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500023", adp_name: "EIGHTCHAMS-BUTUAN", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500024", adp_name: "EIGHTCHAMS-BUKIDNON", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500025", adp_name: "JOSCHAM-PAGADIAN", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500027", adp_name: "KGD-DIPOLOG", pic_phi: "JC" },
]

const TOTAL_MASTER = MASTER_DATA.length
const MONTHLY_TARGET = 8
const WEEKLY_TARGET = 2
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
const PAGE_SIZE = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function ProgressRing({ value, max, size = 72, color = "var(--accent)" }: { value: number; max: number; size?: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.min(value / max, 1)
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RestorePhiPage() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const currentWeek = getWeekNumber(now)

  const [entries, setEntries] = useState<RestoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterArea, setFilterArea] = useState("all")
  const [filterServer, setFilterServer] = useState("all")
  const [filterDone, setFilterDone] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear] = useState(currentYear)
  const [page, setPage] = useState(1)

  // Paste screenshot handler
  const handlePaste = (idx: number, e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"))
    if (!item) return
    e.preventDefault()
    const file = item.getAsFile()
    if (file) fileToBase64(file).then(b64 => setScreenshots(prev => { const n = [...prev]; n[idx] = b64; return n }))
  }

  // Detail modal
  const [detailItem, setDetailItem] = useState<{ master: typeof MASTER_DATA[0]; entry: RestoreEntry | null } | null>(null)

  // Form state
  const [form, setForm] = useState({
    trans_date: "",
    backup_size: "",
    backup_tools_version: "24.05.00",
    restore_status: "Success",
    pic_restore: "Kevin",
  })
  const [screenshots, setScreenshots] = useState<(string | null)[]>([null, null, null])
  const [saving, setSaving] = useState(false)
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from("restore_phi")
      .select("*")
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
    if (data) setEntries(data as RestoreEntry[])
    setLoading(false)
  }

  const loadAll = async () => {
    const { data } = await supabase
      .from("restore_phi")
      .select("*")
      .eq("year", selectedYear)
    if (data) setEntries(data as RestoreEntry[])
  }

  useEffect(() => { load() }, [selectedMonth, selectedYear])

  // Build merged list: master + entry data
  const mergedList = useMemo(() => {
    return MASTER_DATA.map(m => {
      const entry = entries.find(e => e.adp_code === m.adp_code)
      return { master: m, entry: entry || null }
    })
  }, [entries])

  // Stats
  const doneThisMonth = entries.filter(e => e.done_restore && e.month === selectedMonth).length
  const doneThisWeek = entries.filter(e => {
    if (!e.done_restore || !e.restore_date) return false
    return getWeekNumber(new Date(e.restore_date)) === currentWeek && new Date(e.restore_date).getFullYear() === currentYear
  }).length

  // Annual: count by month
  const annualData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      return entries.filter(e => e.done_restore && e.month === m).length
    })
  }, [entries])
  const doneThisYear = annualData.reduce((a, b) => a + b, 0)

  // Reminder logic
  const monthlyOk = doneThisMonth >= MONTHLY_TARGET
  const weeklyOk = doneThisWeek >= WEEKLY_TARGET
  const showReminder = !monthlyOk || !weeklyOk

  // Filtered list
  const filtered = useMemo(() => {
    return mergedList.filter(({ master }) => {
      if (filterArea !== "all" && master.area !== filterArea) return false
      if (filterServer !== "all" && master.server !== filterServer) return false
      if (filterDone === "yes" && !entries.find(e => e.adp_code === master.adp_code)?.done_restore) return false
      if (filterDone === "no" && entries.find(e => e.adp_code === master.adp_code)?.done_restore) return false
      if (search && !master.adp_name.toLowerCase().includes(search.toLowerCase()) && !master.adp_code.includes(search)) return false
      return true
    })
  }, [mergedList, filterArea, filterServer, filterDone, search, entries])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [filterArea, filterServer, filterDone, search, selectedMonth])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Open detail
  const openDetail = (item: typeof mergedList[0]) => {
    setDetailItem(item)
    if (item.entry) {
      setForm({
        trans_date: item.entry.trans_date || "",
        backup_size: item.entry.backup_size?.toString() || "",
        backup_tools_version: item.entry.backup_tools_version || "24.05.00",
        restore_status: item.entry.restore_status || "Success",
        pic_restore: item.entry.pic_restore || "Kevin",
      })
      setScreenshots([item.entry.screenshot_1 || null, item.entry.screenshot_2 || null, item.entry.screenshot_3 || null])
    } else {
      setForm({ trans_date: "", backup_size: "", backup_tools_version: "24.05.00", restore_status: "Success", pic_restore: "Kevin" })
      setScreenshots([null, null, null])
    }
  }

  const handleScreenshot = async (idx: number, file: File) => {
    const b64 = await fileToBase64(file)
    setScreenshots(prev => { const n = [...prev]; n[idx] = b64; return n })
  }

  const handleSave = async () => {
    if (!detailItem) return
    setSaving(true)
    const today = new Date().toISOString().split("T")[0]
    const payload = {
      area: detailItem.master.area,
      server: detailItem.master.server,
      adp_code: detailItem.master.adp_code,
      adp_name: detailItem.master.adp_name,
      pic_phi: detailItem.master.pic_phi,
      month: selectedMonth,
      year: selectedYear,
      restore_date: today,
      trans_date: form.trans_date || null,
      backup_size: form.backup_size ? Number(form.backup_size) : null,
      backup_tools_version: form.backup_tools_version,
      restore_status: form.restore_status,
      pic_restore: form.pic_restore,
      done_restore: true,
      screenshot_1: screenshots[0] || null,
      screenshot_2: screenshots[1] || null,
      screenshot_3: screenshots[2] || null,
    }

    if (detailItem.entry) {
      await supabase.from("restore_phi").update(payload).eq("id", detailItem.entry.id)
    } else {
      await supabase.from("restore_phi").insert([payload])
    }
    setSaving(false)
    setDetailItem(null)
    load()
  }

  const areas = [...new Set(MASTER_DATA.map(m => m.area))].sort()
  const servers = [...new Set(MASTER_DATA.map(m => m.server))].sort()

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }} className="animate-fade">
      <MotivationBanner page="restore" />
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        </div>
      </div>

      {/* Reminder Banner */}
      {showReminder && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid #fcd34d", borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <Bell size={18} color="var(--warning)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warning)" }}>Reminder Restore</div>
            <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 2 }}>
              {!monthlyOk && `Bulan ini baru ${doneThisMonth}/${MONTHLY_TARGET} restore (target 8x/bulan). `}
              {!weeklyOk && `Minggu ini baru ${doneThisWeek}/${WEEKLY_TARGET} restore (target 2x/minggu).`}
            </div>
          </div>
        </div>
      )}

      {/* Progress Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }} className="stagger progress-cards">
        {/* Yearly */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Progress Tahunan</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ProgressRing value={doneThisYear} max={TOTAL_MASTER * 12} size={72} color="var(--accent)" />
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>{doneThisYear}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>dari {TOTAL_MASTER * 12} total</div>
              <div style={{ fontSize: 11, marginTop: 6, color: "var(--accent)", fontWeight: 600 }}>{Math.round(doneThisYear / (TOTAL_MASTER * 12) * 100)}% selesai</div>
            </div>
          </div>
          {/* Mini bar per bulan */}
          <div style={{ marginTop: 14, display: "flex", gap: 3, alignItems: "flex-end" }}>
            {annualData.map((v, i) => (
              <div key={i} title={`${MONTHS[i]}: ${v}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: "100%", background: i + 1 === selectedMonth ? "var(--accent)" : v > 0 ? "var(--accent3)" : "var(--surface3)", borderRadius: 3, height: Math.max(4, v * 3), transition: "height 0.3s" }} />
                <div style={{ fontSize: 8, color: "var(--text3)" }}>{MONTHS[i].slice(0,1)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly */}
        <div className="card" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Progress Bulanan</div>
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
              className="input" style={{ width: "auto", padding: "3px 8px", fontSize: 11 }}>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ProgressRing value={doneThisMonth} max={MONTHLY_TARGET} size={72} color={monthlyOk ? "var(--success)" : "var(--warning)"} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>{doneThisMonth}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>dari {MONTHLY_TARGET} target</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, background: monthlyOk ? "var(--success-bg)" : "var(--warning-bg)", color: monthlyOk ? "var(--success)" : "var(--warning)", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {monthlyOk ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                {monthlyOk ? "Target terpenuhi" : `Kurang ${MONTHLY_TARGET - doneThisMonth}x lagi`}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 5 }}>Sisa restore bulan ini</div>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: MONTHLY_TARGET }, (_, i) => (
                <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < doneThisMonth ? "var(--accent)" : "var(--surface3)", transition: "background 0.3s" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Weekly */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Progress Mingguan</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ProgressRing value={doneThisWeek} max={WEEKLY_TARGET} size={72} color={weeklyOk ? "var(--success)" : "var(--info)"} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>{doneThisWeek}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>dari {WEEKLY_TARGET} target/minggu</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, background: weeklyOk ? "var(--success-bg)" : "var(--info-bg)", color: weeklyOk ? "var(--success)" : "var(--info)", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {weeklyOk ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                Week {currentWeek}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <div style={{ background: "var(--surface3)", borderRadius: "var(--radius-xs)", padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--accent)" }}>{doneThisMonth}</div>
              <div style={{ fontSize: 10, color: "var(--text3)" }}>Done bulan ini</div>
            </div>
            <div style={{ background: "var(--surface3)", borderRadius: "var(--radius-xs)", padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text2)" }}>{TOTAL_MASTER - doneThisMonth}</div>
              <div style={{ fontSize: 10, color: "var(--text3)" }}>Belum done</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", pointerEvents: "none" }} />
            <input className="input" placeholder="Cari ADP Name / ADP Code..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>
          <div className="filter-toggles" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface)" }}>
              {["all",...areas].map((a, i) => (
                <button key={a} onClick={() => setFilterArea(a)}
                  style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: filterArea === a ? 700 : 500,
                    background: filterArea === a ? "var(--accent)" : "transparent",
                    color: filterArea === a ? "white" : "var(--text2)",
                    borderRight: i < areas.length ? "1px solid var(--border)" : "none",
                    transition: "all 0.15s" }}>
                  {a === "all" ? "Semua" : a}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface)" }}>
              {["all",...servers].map((s, i) => (
                <button key={s} onClick={() => setFilterServer(s)}
                  style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: filterServer === s ? 700 : 500,
                    background: filterServer === s ? "var(--accent)" : "transparent",
                    color: filterServer === s ? "white" : "var(--text2)",
                    borderRight: i < servers.length ? "1px solid var(--border)" : "none",
                    transition: "all 0.15s" }}>
                  {s === "all" ? "All Server" : `SRV ${s}`}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface)" }}>
              {[{v:"all",l:"Semua"},{v:"yes",l:"✓ Done"},{v:"no",l:"Belum"}].map(({v,l},i) => (
                <button key={v} onClick={() => setFilterDone(v)}
                  style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: filterDone === v ? 700 : 500,
                    background: filterDone === v ? (v === "yes" ? "var(--success)" : v === "no" ? "var(--danger)" : "var(--accent)") : "transparent",
                    color: filterDone === v ? "white" : "var(--text2)",
                    borderRight: i < 2 ? "1px solid var(--border)" : "none",
                    transition: "all 0.15s" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap", background: "var(--surface3)", padding: "6px 12px", borderRadius: "var(--radius-sm)" }}>
            {filtered.length} / {TOTAL_MASTER} entries
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                {["AREA","SERVER","ADP CODE","ADP NAME","MONTH","RESTORE DATE","DONE RESTORE",""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Tidak ada data</td></tr>
              ) : filtered.map(({ master, entry }) => {
                const done = entry?.done_restore || false
                return (
                  <tr key={master.adp_code} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    onClick={() => openDetail({ master, entry })}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "var(--accent-muted)", color: "var(--accent)", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{master.area}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--text2)", fontWeight: 500 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Server size={12} color="var(--text3)" />
                        {master.server}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono, monospace)", color: "var(--text2)" }}>{master.adp_code}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--text)", fontWeight: 500, maxWidth: 220 }}>{master.adp_name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text3)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Calendar size={12} />
                        {MONTHS[selectedMonth - 1]} {selectedYear}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>
                      {entry?.restore_date ? new Date(entry.restore_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : <span style={{ color: "var(--text3)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className={`badge ${done ? "badge-done" : "badge-todo"}`}>
                        {done ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {done ? "Yes" : "No"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ChevronRight size={16} color="var(--text3)" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "0 4px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            Halaman {page} dari {totalPages} · {filtered.length} entries
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost" onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 10px", fontSize: 12, opacity: page === 1 ? 0.4 : 1 }}>«</button>
            <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 12px", fontSize: 12, opacity: page === 1 ? 0.4 : 1 }}>‹ Prev</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6))
              const p = start + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ padding: "6px 11px", borderRadius: "var(--radius-xs)", fontSize: 12, fontWeight: p === page ? 700 : 500, border: "1.5px solid",
                    background: p === page ? "var(--accent)" : "transparent",
                    color: p === page ? "white" : "var(--text2)",
                    borderColor: p === page ? "var(--accent)" : "var(--border)", cursor: "pointer" }}>
                  {p}
                </button>
              )
            })}
            <button className="btn btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 12px", fontSize: 12, opacity: page === totalPages ? 0.4 : 1 }}>Next ›</button>
            <button className="btn btn-ghost" onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "6px 10px", fontSize: 12, opacity: page === totalPages ? 0.4 : 1 }}>»</button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <ModalOverlay onClose={() => setDetailItem(null)}>
          <div className="modal" style={{ maxWidth: 700, width: "100%", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>{detailItem.master.adp_name}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "var(--accent-muted)", color: "var(--accent)", padding: "1px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{detailItem.master.area}</span>
                  <span>Server {detailItem.master.server}</span>
                  <span style={{ fontFamily: "monospace" }}>{detailItem.master.adp_code}</span>
                  <span>· PIC PHI: <strong>{detailItem.master.pic_phi}</strong></span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`badge ${detailItem.entry?.done_restore ? "badge-done" : "badge-todo"}`}>
                  {detailItem.entry?.done_restore ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                  {detailItem.entry?.done_restore ? "Done" : "Belum"}
                </span>
                <button onClick={() => setDetailItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 6, borderRadius: "var(--radius-xs)" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body — 2 column layout */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Left column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="label">Detail Restore — {MONTHS[selectedMonth - 1]} {selectedYear}</div>
                  {detailItem.entry?.restore_date && (
                    <div style={{ background: "var(--success-bg)", border: "1px solid var(--accent-light)", borderRadius: "var(--radius-xs)", padding: "8px 12px", fontSize: 12, color: "var(--success)" }}>
                      ✓ Restore Date: <strong>{new Date(detailItem.entry.restore_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</strong>
                    </div>
                  )}
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>Trans Date</label>
                    <input type="date" className="input" value={form.trans_date} onChange={e => setForm(f => ({ ...f, trans_date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>Backup Size</label>
                    <input type="number" className="input" placeholder="e.g. 634739" value={form.backup_size} onChange={e => setForm(f => ({ ...f, backup_size: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>Backup Tools Version</label>
                    <input className="input" value={form.backup_tools_version} onChange={e => setForm(f => ({ ...f, backup_tools_version: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>Restore Status</label>
                    <select className="input" value={form.restore_status} onChange={e => setForm(f => ({ ...f, restore_status: e.target.value }))}>
                      <option value="Success">Success</option>
                      <option value="Failed">Failed</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>PIC Restore</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["Kevin", "Risky"].map(p => (
                        <button key={p} type="button" onClick={() => setForm(f => ({ ...f, pic_restore: p }))}
                          style={{ flex: 1, padding: "8px", borderRadius: "var(--radius-sm)", border: "1.5px solid", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                            background: form.pic_restore === p ? "var(--accent)" : "transparent",
                            color: form.pic_restore === p ? "white" : "var(--text2)",
                            borderColor: form.pic_restore === p ? "var(--accent)" : "var(--border2)" }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right column — Screenshots */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="label">Screenshot (Ctrl+V atau Upload)</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: -6, marginBottom: 4 }}>
                    Klik area screenshot lalu tekan <kbd style={{ background: "var(--surface3)", border: "1px solid var(--border2)", borderRadius: 4, padding: "1px 5px", fontFamily: "monospace", fontSize: 11 }}>Ctrl+V</kbd> untuk paste langsung dari snipping tool
                  </div>
                  {[0, 1, 2].map(idx => (
                    <div key={idx}>
                      <input type="file" accept="image/*" ref={fileRefs[idx]} style={{ display: "none" }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) handleScreenshot(idx, f) }} />
                      {screenshots[idx] ? (
                        <div style={{ position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
                          <img src={screenshots[idx]!} alt={`Screenshot ${idx + 1}`} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                          <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                            <button onClick={() => fileRefs[idx].current?.click()}
                              style={{ background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 5, padding: "4px 8px", color: "white", cursor: "pointer", fontSize: 11 }}>
                              <Upload size={11} />
                            </button>
                            <button onClick={() => setScreenshots(prev => { const n = [...prev]; n[idx] = null; return n })}
                              style={{ background: "rgba(192,57,43,0.8)", border: "none", borderRadius: 5, padding: "4px 8px", color: "white", cursor: "pointer" }}>
                              <Trash2 size={11} />
                            </button>
                          </div>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.45)", padding: "4px 8px", fontSize: 10, color: "white" }}>
                            Screenshot {idx + 1}
                          </div>
                        </div>
                      ) : (
                        <div
                          tabIndex={0}
                          onPaste={e => handlePaste(idx, e)}
                          onClick={() => fileRefs[idx].current?.click()}
                          style={{ width: "100%", height: 110, border: "2px dashed var(--border2)", borderRadius: "var(--radius-sm)", background: "var(--surface2)", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--text3)", transition: "all 0.15s", outline: "none" }}
                          onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent2)"; (e.currentTarget as HTMLElement).style.background = "var(--accent-muted)" }}
                          onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLElement).style.background = "var(--surface2)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent2)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)" }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)"; (e.currentTarget as HTMLElement).style.color = "var(--text3)" }}>
                          <ImageIcon size={18} />
                          <span style={{ fontSize: 11, fontWeight: 600 }}>Screenshot {idx + 1}</span>
                          <span style={{ fontSize: 10 }}>Klik upload · Ctrl+V paste</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info box */}
              <div style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-light)", borderRadius: "var(--radius-xs)", padding: "10px 14px", marginTop: 18, fontSize: 12, color: "var(--accent2)" }}>
                💾 Saat disimpan, <strong>Done Restore</strong> akan otomatis menjadi <strong>Yes</strong> dan tanggal restore dicatat sebagai hari ini.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setDetailItem(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={15} />
                {saving ? "Menyimpan..." : "Simpan & Mark Done"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <style>{`
        @media (max-width: 768px) {
          .progress-cards {
            grid-template-columns: 1fr !important;
          }
          .filter-toggles {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
          }
        }
        @media (max-width: 480px) {
          .progress-cards {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}