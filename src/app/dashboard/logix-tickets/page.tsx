"use client"
// PATH: src/app/dashboard/logix-tickets/page.tsx

import { useState, useEffect, useMemo, Fragment } from "react"
import {
  Ticket, RefreshCw, Search, AlertCircle, KeyRound, Settings,
  ChevronUp, ChevronDown, Eye, EyeOff, Save, ExternalLink,
  Maximize2, Minimize2, X, Copy, Check, Info,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────
interface LogixTicket {
  no_ticket: string
  judul_ticket: string
  tipe_ticket: string
  description_ticket: string
  nm_user: string
  email_user: string
  nm_subdist: string
  nm_tas_cover: string
  nm_tas: string | null
  nm_br: string | null
  nm_dev: string | null
  nm_aplikasi: string | null
  nm_kategori: string | null
  nm_sub_kategori: string | null
  nm_status: string
  nm_severity: string
  date_created: string
  date_updated: string
}

// Dari /api/logix-tickets-sla (endpoint Logix /ticketing/json1) — skema
// beda total dari LogixTicket di atas, khusus data timing/SLA respon.
// "apps" di nama field = "TAS" di label UI Logix (beda istilah internal
// vs tampilan, dikonfirmasi dari capture user).
interface SlaTicket {
  nomor_ticket: string
  nm_user: string
  ticket_dibuat: string       // "YYYY-MM-DD HH:mm:ss"
  nm_tas_cover: string
  nm_tas: string | null
  ticket_direspon_apps: string
  respon_apps: string         // durasi teks, mis. "1 hours 38 minutes 25 seconds"
  nm_br: string | null
  ticket_direspon_br: string
  respon_br: string
  nm_dev: string | null
  ticket_direspon_dev: string
  respon_dev: string
  status: string
  user_close_ticket: string | null
  ticket_diselesaikan: string
  lama_ticket: string         // total waktu dari dibuat sampai solved
}

// Parse durasi teks Logix ("X hours Y minutes Z seconds", bagian mana pun
// boleh tidak ada) jadi total jam desimal. Return null kalau kosong/tidak
// ada durasi (tiket belum direspon/belum solved di tahap itu).
function parseDurationHours(s: string | null | undefined): number | null {
  if (!s || !s.trim()) return null
  const h = /(\d+)\s*hour/i.exec(s)
  const m = /(\d+)\s*minute/i.exec(s)
  const sec = /(\d+)\s*second/i.exec(s)
  if (!h && !m && !sec) return null
  return (h ? Number(h[1]) : 0) + (m ? Number(m[1]) : 0) / 60 + (sec ? Number(sec[1]) : 0) / 3600
}

// Konversi durasi jam → hari genap (dibulatkan ke bawah) — mis. 1 jam = 0
// hari, 30 jam = 1 hari. Dipakai di panel SLA, yang satuannya "hari" bukan "jam".
function hoursToDays(h: number | null): number | null {
  return h == null ? null : Math.floor(h / 24)
}

// ── Helpers ───────────────────────────────────────────────────
type Bucket = "open" | "progress" | "solved"
function statusBucket(status: string): Bucket {
  const s = (status || "").toUpperCase()
  if (s.includes("SOLVED") || s.includes("CLOSED")) return "solved"
  if (s === "OPEN") return "open"
  return "progress"
}
const BUCKET_COLOR: Record<Bucket, { bg: string; color: string }> = {
  open:     { bg: "#FEE2E2", color: "#991B1B" },
  progress: { bg: "#FEF3C7", color: "#92400E" },
  solved:   { bg: "#DCFCE7", color: "#166534" },
}
const BUCKET_LABEL: Record<Bucket, string> = { open: "Open", progress: "Diproses", solved: "Selesai" }

function severityColor(sev: string): { bg: string; color: string } {
  const s = (sev || "").toUpperCase()
  if (s.includes("HIGH")) return { bg: "#FEE2E2", color: "#991B1B" }
  if (s.includes("MEDIUM")) return { bg: "#FEF3C7", color: "#92400E" }
  if (s.includes("LOW")) return { bg: "#DBEAFE", color: "#1D4ED8" }
  return { bg: "#F1F5F9", color: "#475569" } // NEW TICKET / lainnya
}

function fmtDate(unixSec: string): string {
  const n = Number(unixSec)
  if (!unixSec || !n) return "—"
  return new Date(n * 1000).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function currentPic(t: LogixTicket): string {
  return t.nm_dev || t.nm_br || t.nm_tas || "—"
}

// ── Timeline internal per-tiket (khusus status Logix "OPEN BR") ────
// Data tiket sendiri tidak disimpan di Supabase (selalu live dari Logix),
// jadi tabel ini cuma anotasi lokal dikaitkan lewat no_ticket sebagai key.
// Satu tiket bisa punya beberapa baris (one-to-many) — satu per tahap.
interface TimelineEntry {
  id: string
  no_ticket: string
  status: string
  date_from: string | null
  date_to: string | null
  created_at: string
}
const TIMELINE_STAGES = [
  "OPEN TRACE", "OPEN DR PI", "OPEN REVIEW BR", "OPG DEV", "OPEN TEST",
  "READY TO PILOT", "PILOT", "RELEASE", "OK+NOTE", "NOT OK",
]
const STAGE_COLOR: Record<string, { bg: string; color: string }> = {
  "OPEN TRACE":     { bg: "#DBEAFE", color: "#1D4ED8" },
  "OPEN DR PI":     { bg: "#FEE2E2", color: "#B91C1C" },
  "OPEN REVIEW BR": { bg: "#EDE9FE", color: "#7C3AED" },
  "OPG DEV":        { bg: "#E0F2FE", color: "#0369A1" },
  "OPEN TEST":      { bg: "#FEF3C7", color: "#92400E" },
  "READY TO PILOT": { bg: "#D1FAE5", color: "#047857" },
  "PILOT":          { bg: "#ECFCCB", color: "#4D7C0F" },
  "RELEASE":        { bg: "#DCFCE7", color: "#166534" },
  "OK+NOTE":        { bg: "#1D4ED8", color: "#FFFFFF" },
  "NOT OK":         { bg: "#DC2626", color: "#FFFFFF" },
}

// Tab metrik di panel SLA — tiap tab nunjukin 1 garis aja, dan filter nama
// yang muncul di sebelahnya nyaring berdasarkan orang yang nanganin tahap
// itu (nm_tas buat Response TAS, nm_br buat Response BR, nm_dev buat Time
// Solved — sejalan sama tripletnya di data SLA logix).
const SLA_TABS = [
  { key: "responTas", label: "Response TAS", field: "respon_apps", nameField: "nm_tas", color: "#0369A1" },
  { key: "timeBr", label: "Response BR", field: "respon_br", nameField: "nm_br", color: "#7C3AED" },
  { key: "timeSolved", label: "Time Solved", field: "lama_ticket", nameField: "nm_dev", color: "#166534" },
] as const
// Tab ke-4 "Perbandingan" nampilin ketiga garis sekaligus (nggak ada filter
// nama sendiri, karena gabungan 3 penanggung jawab yang beda).
const SLA_COMPARE_TAB = { key: "compare", label: "Perbandingan" } as const
type SlaTabKey = typeof SLA_TABS[number]["key"] | typeof SLA_COMPARE_TAB.key

// Bucket "per hari" (Senin—Minggu) buat panel SLA — gabungin semua tanggal
// yang jatuh di hari itu (dalam rentang periode yang dipilih) jadi 1 titik
// rata-rata, alternatif dari bucket per-tanggal biasa.
const WEEKDAY_LABELS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
function weekdayIndex(d: Date): number {
  const js = d.getDay() // 0 = Minggu
  return js === 0 ? 6 : js - 1 // geser jadi 0 = Senin
}
function isInPeriod(d: Date, period: string): boolean {
  if (period === "ALL") {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const start = new Date(today); start.setDate(start.getDate() - 13)
    const dd = new Date(d); dd.setHours(0, 0, 0, 0)
    return dd >= start && dd <= today
  }
  const [y, m] = period.split("-").map(Number)
  return d.getFullYear() === y && d.getMonth() === m - 1
}
// PENTING: pakai tanggal kalender LOKAL (bukan toISOString(), yang
// konversi ke UTC) — kalau nggak, buat timezone lebih maju dari UTC
// (WIB/WITA/WIT/Manila dst.), tengah malam lokal ke-geser MUNDUR satu
// hari begitu dikonversi ke UTC. Ini bikin startOfWeek/addDaysIso salah
// hitung 1 hari — gejalanya label minggu kepotong 6 hari ("11-16 Sep")
// bukan 7 hari ("11-17 Sep"), dan tanggal yang baru diisi user bisa
// jatuh di luar rentang minggu yang ke-generate sehingga tidak muncul
// sebagai bar sama sekali.
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function startOfWeek(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Senin sebagai awal minggu
  d.setDate(d.getDate() + diff)
  return isoDate(d)
}
function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00")
  d.setDate(d.getDate() + days)
  return isoDate(d)
}
function fmtWeekLabel(weekStartIso: string): string {
  const start = new Date(weekStartIso + "T00:00:00")
  const end = new Date(addDaysIso(weekStartIso, 6) + "T00:00:00")
  const sameMonth = start.getMonth() === end.getMonth()
  const optsDay: Intl.DateTimeFormatOptions = { day: "2-digit" }
  const optsFull: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }
  const startLabel = start.toLocaleDateString("id-ID", sameMonth ? optsDay : optsFull)
  const endLabel = end.toLocaleDateString("id-ID", optsFull)
  return `${startLabel}–${endLabel}`
}

export default function LogixTicketsPage() {
  const [tickets, setTickets] = useState<LogixTicket[]>([])
  const [recordsTotal, setRecordsTotal] = useState("0")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [rawError, setRawError] = useState("")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [tipeFilter, setTipeFilter] = useState("ALL")
  const [userFilter, setUserFilter] = useState("ALL")
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  // ── Filter Periode (bulan) — KHUSUS buat grafik SLA di bawah (Response
  // TAS/Time BR/Time Solved), tidak menyaring summary cards/tabel/chart lain.
  const [periodFilter, setPeriodFilter] = useState("ALL")
  const monthKey = (unixSec: string) => {
    const n = Number(unixSec)
    if (!n) return ""
    const d = new Date(n * 1000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }
  const periodOptions = useMemo(() => {
    const keys = Array.from(new Set(tickets.map(t => monthKey(t.date_created)).filter(Boolean)))
    return keys.sort().reverse()
  }, [tickets])
  const periodLabel = (key: string) => {
    const [y, m] = key.split("-")
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" })
  }

  // ── Tab metrik + filter nama + mode grouping (tanggal/hari) di panel SLA ──
  const [slaTabKey, setSlaTabKey] = useState<SlaTabKey>("responTas")
  const [slaNameFilter, setSlaNameFilter] = useState("ALL")
  const [slaGroupBy, setSlaGroupBy] = useState<"date" | "weekday">("date")
  const activeSlaTab = SLA_TABS.find(t => t.key === slaTabKey) ?? null
  const handleSlaTabChange = (key: SlaTabKey) => { setSlaTabKey(key); setSlaNameFilter("ALL") }

  // ── Timeline internal (Open BR) — semua tahap tetap langsung ditampilkan per tiket,
  // tinggal isi rentang tanggalnya per tahap ──
  const [timelines, setTimelines] = useState<TimelineEntry[]>([])
  const [stageDraft, setStageDraft] = useState<Record<string, { from: string; to: string }>>({})
  const [timelineSaving, setTimelineSaving] = useState(false)
  const [timelineError, setTimelineError] = useState("")

  // ── Kelola Kredensial (collapsed by default) ──
  const [credOpen, setCredOpen] = useState(false)
  const [credEmail, setCredEmail] = useState("")
  const [credPassword, setCredPassword] = useState("")
  const [showCredPwd, setShowCredPwd] = useState(false)
  const [credSaving, setCredSaving] = useState(false)
  const [credError, setCredError] = useState("")
  const [credSuccess, setCredSuccess] = useState("")

  const fetchTickets = async () => {
    setLoading(true); setError(""); setRawError("")
    try {
      const res = await fetch("/api/logix-tickets")
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || `HTTP ${res.status}`)
        if (json.raw) setRawError(json.raw)
        setTickets([])
      } else {
        setTickets(json.data || [])
        setRecordsTotal(json.recordsTotal || String((json.data || []).length))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  // ── Data SLA/timing respon (Response TAS, Time BR, Time Solved) ──
  const [slaTickets, setSlaTickets] = useState<SlaTicket[]>([])
  const [slaLoading, setSlaLoading] = useState(false)
  const [slaError, setSlaError] = useState("")

  const fetchSlaTickets = async () => {
    setSlaLoading(true); setSlaError("")
    try {
      const res = await fetch("/api/logix-tickets-sla")
      const text = await res.text()
      let json: { data?: SlaTicket[]; error?: string }
      try { json = JSON.parse(text) } catch {
        setSlaError(`Respons bukan JSON (kemungkinan server error) — HTTP ${res.status}`)
        setSlaLoading(false)
        return
      }
      if (!res.ok) setSlaError(json.error || `HTTP ${res.status}`)
      else setSlaTickets(json.data || [])
    } catch (e) {
      setSlaError(e instanceof Error ? e.message : String(e))
    }
    setSlaLoading(false)
  }

  // WAJIB berurutan, BUKAN paralel — dua-duanya login ke Logix pakai akun
  // yang sama (masing-masing route server-side punya cookie jar sendiri).
  // Kalau ditembak bersamaan, dua login nyaris simultan ke server yang
  // sama bikin sesi Logix-nya saling tabrakan — gejalanya semua field
  // hasil JOIN (status/severity/kategori) balik null/kosong walau jumlah
  // baris tetap benar.
  const refreshAll = async () => { await fetchTickets(); await fetchSlaTickets() }

  const loadCredentials = async () => {
    const { data } = await supabase.from("logix_credentials").select("email,password").eq("id", 1).maybeSingle()
    if (data) { setCredEmail(data.email); setCredPassword(data.password) }
  }

  const loadTimelines = async () => {
    const { data } = await supabase.from("logix_ticket_timeline").select("*").order("date_from", { ascending: true })
    if (data) setTimelines(data as TimelineEntry[])
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadCredentials(); loadTimelines(); refreshAll() }, [])

  const timelineByTicket = useMemo(() => {
    const m = new Map<string, TimelineEntry[]>()
    for (const t of timelines) {
      if (!m.has(t.no_ticket)) m.set(t.no_ticket, [])
      m.get(t.no_ticket)!.push(t)
    }
    return m
  }, [timelines])

  // ── Timeline Mingguan: kelompokkan tiap entri timeline BR ke minggu (Senin-Minggu) yang dilaluinya ──
  const weeklyTimeline = useMemo(() => {
    if (timelines.length === 0) return { weeks: [] as string[], rows: [] as { no_ticket: string; judul: string; cells: Map<string, TimelineEntry>; isBrOpen: boolean }[] }

    const todayIso = isoDate(new Date())
    let minWeek = ""
    let maxWeek = ""
    for (const t of timelines) {
      if (!t.date_from) continue
      const wFrom = startOfWeek(t.date_from)
      const wTo = startOfWeek(t.date_to || todayIso)
      if (!minWeek || wFrom < minWeek) minWeek = wFrom
      if (!maxWeek || wTo > maxWeek) maxWeek = wTo
    }
    if (!minWeek) return { weeks: [], rows: [] }

    const weeks: string[] = []
    for (let c = minWeek; c <= maxWeek; c = addDaysIso(c, 7)) weeks.push(c)

    const ticketTitle = new Map(tickets.map(t => [t.no_ticket, t.judul_ticket]))
    const ticketStatus = new Map(tickets.map(t => [t.no_ticket, t.nm_status]))

    const rows = Array.from(timelineByTicket.entries()).map(([no_ticket, entries]) => {
      const cells = new Map<string, TimelineEntry>()
      for (const e of entries) {
        if (!e.date_from) continue
        const wFrom = startOfWeek(e.date_from)
        const wTo = startOfWeek(e.date_to || todayIso)
        for (let c = wFrom; c <= wTo; c = addDaysIso(c, 7)) cells.set(c, e)
      }
      const isBrOpen = (ticketStatus.get(no_ticket) || "").toUpperCase() === "OPEN BR"
      return { no_ticket, judul: ticketTitle.get(no_ticket) || "", cells, isBrOpen }
    }).sort((a, b) => {
      const aWeeks = Array.from(a.cells.keys())
      const bWeeks = Array.from(b.cells.keys())
      return (aWeeks[0] || "").localeCompare(bWeeks[0] || "")
    })

    return { weeks, rows }
  }, [timelines, timelineByTicket, tickets])

  const saveStageEntry = async (noTicket: string, stage: string, existingId: string | undefined, dateFrom: string, dateTo: string) => {
    if (!dateFrom) { setTimelineError("Tanggal mulai wajib diisi"); return }
    setTimelineSaving(true); setTimelineError("")
    if (existingId) {
      const { data, error: err } = await supabase.from("logix_ticket_timeline")
        .update({ date_from: dateFrom, date_to: dateTo || null })
        .eq("id", existingId).select().single()
      setTimelineSaving(false)
      if (err) { setTimelineError(err.message); return }
      if (data) setTimelines(prev => prev.map(t => t.id === existingId ? data as TimelineEntry : t))
    } else {
      const { data, error: err } = await supabase.from("logix_ticket_timeline")
        .insert({ no_ticket: noTicket, status: stage, date_from: dateFrom, date_to: dateTo || null })
        .select().single()
      setTimelineSaving(false)
      if (err) { setTimelineError(err.message); return }
      if (data) setTimelines(prev => [...prev, data as TimelineEntry])
    }
    setStageDraft(prev => {
      const n = { ...prev }
      delete n[`${noTicket}::${stage}`]
      return n
    })
  }

  const deleteTimelineEntry = async (id: string) => {
    setTimelines(prev => prev.filter(t => t.id !== id))
    const { error: err } = await supabase.from("logix_ticket_timeline").delete().eq("id", id)
    if (err) { setTimelineError(err.message); loadTimelines() }
  }

  const saveCredentials = async () => {
    if (!credEmail.trim() || !credPassword.trim()) { setCredError("Email dan password tidak boleh kosong"); return }
    setCredSaving(true); setCredError("")
    const { error: err } = await supabase.from("logix_credentials")
      .upsert({ id: 1, email: credEmail.trim(), password: credPassword.trim(), updated_at: new Date().toISOString() }, { onConflict: "id" })
    setCredSaving(false)
    if (err) { setCredError(err.message); return }
    setCredSuccess("Tersimpan!"); setTimeout(() => setCredSuccess(""), 2500)
    fetchTickets()
  }

  const summary = useMemo(() => {
    const count = (status: string) => tickets.filter(t => (t.nm_status || "").toUpperCase() === status).length
    const solved = count("SOLVED")
    return {
      total: tickets.length,
      open: count("OPEN"),
      appsR1: count("APPS R1"),
      openBr: count("OPEN BR"),
      brR1: count("BR R1"),
      appsR2: count("APPS R2"),
      solved,
      pctSolved: tickets.length > 0 ? (solved / tickets.length) * 100 : 0,
    }
  }, [tickets])

  // ── Info detail buat card "Open" — daftar nomor/nama tiket + tanggal dibuat ──
  const [openInfoOpen, setOpenInfoOpen] = useState(false)
  const openTickets = useMemo(() => tickets.filter(t => (t.nm_status || "").toUpperCase() === "OPEN"), [tickets])

  // ── Salin pesan update harian ke stakeholder ──
  const [copyOk, setCopyOk] = useState(false)
  const [copyError, setCopyError] = useState("")

  const buildStatusMessage = () => {
    const now = new Date()
    const hour = now.getHours()
    const greeting = hour < 11 ? "pagi" : hour < 15 ? "siang" : hour < 18 ? "sore" : "malam"
    const todayLabel = now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })
    const timeLabel = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    return `Selamat ${greeting} pak @Head SS Pak Rudy Haryanto , pak @BR APPG Pak Yonathan , dan pak @APPG Pak Risky

Berikut adalah status ticket logix cut off ${todayLabel} ${timeLabel} WIB
- Total Issue: ${summary.total}
- Total Done: ${summary.solved} (${summary.pctSolved.toFixed(0)}%)
- Total Open: ${summary.open}
- Total Open Confirm/Apps R1: ${summary.appsR1}
- Total Open BR: ${summary.openBr}

Terimakasih pak`
  }

  const copyStatusMessage = async () => {
    setCopyError("")
    try {
      await navigator.clipboard.writeText(buildStatusMessage())
      setCopyOk(true)
      setTimeout(() => setCopyOk(false), 2000)
    } catch {
      setCopyError("Gagal menyalin, coba lagi")
      setTimeout(() => setCopyError(""), 2500)
    }
  }

  const statusOptions = useMemo(() => Array.from(new Set(tickets.map(t => t.nm_status))).sort(), [tickets])
  const tipeOptions = useMemo(() => Array.from(new Set(tickets.map(t => t.tipe_ticket))).sort(), [tickets])
  const userOptions = useMemo(() => Array.from(new Set(tickets.map(t => t.nm_user))).sort(), [tickets])

  // Tren tiket dibuat per hari — 14 hari terakhir kalau periode "ALL",
  // atau semua hari di bulan itu kalau periode tertentu dipilih.
  // PENTING: pakai tanggal kalender LOKAL buat key-nya (bukan toISOString,
  // yang konversi ke UTC) — kalau nggak, buat timezone lebih maju dari UTC
  // (WIB/WITA/WIT/Manila dst.), tiket yang dibuat sore/malam bakal ke-hitung
  // masuk ke bucket HARI BERIKUTNYA, bukan hari tiket itu sendiri dibuat.
  const localDateKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  // Bucket harian dipakai bareng oleh chart Tren & chart SLA di bawah,
  // biar sumbu-X-nya selalu sinkron satu sama lain.
  const buildDayBuckets = (period: string): { key: string; label: string }[] => {
    if (period === "ALL") {
      const today = new Date(); today.setHours(0, 0, 0, 0)
      return Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today); d.setDate(d.getDate() - (13 - i))
        return { key: localDateKey(d), label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) }
      })
    }
    const [y, m] = period.split("-").map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    return Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(y, m - 1, i + 1)
      return { key: localDateKey(d), label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }) }
    })
  }

  const trendData = useMemo(() => {
    const days = buildDayBuckets("ALL").map(d => ({ ...d, count: 0 }))
    const byKey = new Map(days.map(d => [d.key, d]))
    for (const t of tickets) {
      const n = Number(t.date_created)
      if (!n) continue
      const row = byKey.get(localDateKey(new Date(n * 1000)))
      if (row) row.count++
    }
    return days
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickets])

  // Parse "YYYY-MM-DD HH:mm:ss" (format datetime Logix) sebagai waktu LOKAL
  // — bukan Date.parse biasa, yang di sebagian browser bisa nganggap string
  // tanpa timezone itu UTC dan geser tanggalnya.
  function parseLogixDateTime(s: string): Date | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(s || "")
    if (!m) return null
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))
  }

  // Daftar nama unik buat filter di panel SLA — sumbernya ganti sesuai tab
  // yang lagi aktif (nm_tas/nm_br/nm_dev). Nggak ada filter nama di tab
  // Perbandingan (gabungan 3 penanggung jawab yang beda).
  const slaNameOptions = useMemo(() => {
    if (!activeSlaTab) return []
    const set = new Set<string>()
    for (const t of slaTickets) {
      const v = (t[activeSlaTab.nameField] || "").trim()
      if (v) set.add(v)
    }
    return Array.from(set).sort()
  }, [slaTickets, activeSlaTab])

  // Bucket kosong buat chart SLA — per tanggal (sinkron sama trendData) atau
  // per hari-dalam-minggu (Senin—Minggu), tergantung slaGroupBy.
  const slaBuckets = useMemo(() => {
    if (slaGroupBy === "weekday") return WEEKDAY_LABELS.map(label => ({ label }))
    return buildDayBuckets(periodFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slaGroupBy, periodFilter])

  const slaBucketIndex = (created: Date): number | null => {
    if (slaGroupBy === "weekday") {
      if (!isInPeriod(created, periodFilter)) return null
      return weekdayIndex(created)
    }
    const key = localDateKey(created)
    return slaBuckets.findIndex(b => "key" in b && b.key === key)
  }

  // Grafik SLA (tab metrik tunggal): rata-rata durasi (hari) per bucket,
  // buat metrik + orang yang lagi dipilih di tab/filter. Durasi per tiket
  // dibulatkan ke hari genap dulu (hoursToDays) sebelum dirata-ratakan.
  const slaChartData = useMemo(() => {
    if (!activeSlaTab) return []
    const rows = slaBuckets.map(b => ({ label: b.label, sum: 0, n: 0 }))
    for (const t of slaTickets) {
      if (slaNameFilter !== "ALL" && (t[activeSlaTab.nameField] || "").trim() !== slaNameFilter) continue
      const created = parseLogixDateTime(t.ticket_dibuat)
      if (!created) continue
      const idx = slaBucketIndex(created)
      if (idx == null || idx < 0) continue
      const val = hoursToDays(parseDurationHours(t[activeSlaTab.field]))
      if (val != null) { rows[idx].sum += val; rows[idx].n++ }
    }
    return rows.map(d => ({ label: d.label, value: d.n ? Number((d.sum / d.n).toFixed(1)) : null }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slaTickets, slaBuckets, activeSlaTab, slaNameFilter])

  // Grafik SLA (tab Perbandingan): rata-rata ketiga metrik sekaligus (hari),
  // per bucket yang sama — tanpa filter nama karena gabungan 3 penanggung jawab.
  const slaCompareData = useMemo(() => {
    const rows = slaBuckets.map(b => ({ label: b.label, tasSum: 0, tasN: 0, brSum: 0, brN: 0, solvedSum: 0, solvedN: 0 }))
    for (const t of slaTickets) {
      const created = parseLogixDateTime(t.ticket_dibuat)
      if (!created) continue
      const idx = slaBucketIndex(created)
      if (idx == null || idx < 0) continue
      const tas = hoursToDays(parseDurationHours(t.respon_apps))
      if (tas != null) { rows[idx].tasSum += tas; rows[idx].tasN++ }
      const br = hoursToDays(parseDurationHours(t.respon_br))
      if (br != null) { rows[idx].brSum += br; rows[idx].brN++ }
      const solved = hoursToDays(parseDurationHours(t.lama_ticket))
      if (solved != null) { rows[idx].solvedSum += solved; rows[idx].solvedN++ }
    }
    return rows.map(d => ({
      label: d.label,
      responTas: d.tasN ? Number((d.tasSum / d.tasN).toFixed(1)) : null,
      timeBr: d.brN ? Number((d.brSum / d.brN).toFixed(1)) : null,
      timeSolved: d.solvedN ? Number((d.solvedSum / d.solvedN).toFixed(1)) : null,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slaTickets, slaBuckets])

  // Distribusi severity, urutan tetap HIGH → MEDIUM → LOW → NEW TICKET
  const severityData = useMemo(() => {
    const order = ["HIGH", "MEDIUM", "LOW", "NEW TICKET"]
    const counts = new Map<string, number>()
    for (const t of tickets) {
      const s = (t.nm_severity || "—").toUpperCase()
      counts.set(s, (counts.get(s) || 0) + 1)
    }
    const known = order.filter(s => counts.has(s))
    const rest = Array.from(counts.keys()).filter(s => !order.includes(s))
    return [...known, ...rest].map(name => ({ name, value: counts.get(name)!, fill: severityColor(name).color }))
  }, [tickets])

  // Top 5 aplikasi paling banyak tiket
  const aplikasiData = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tickets) {
      if (!t.nm_aplikasi) continue
      counts.set(t.nm_aplikasi, (counts.get(t.nm_aplikasi) || 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [tickets])

  // Semua kategori issue (nm_kategori), diurut dari yang paling banyak.
  // Tiket yang masih OPEN biasanya belum dikategorikan (nm_kategori null)
  // karena itu baru diisi PIC saat memproses tiket, jadi otomatis ke-exclude.
  const ticketsByKategori = useMemo(() => {
    const m = new Map<string, LogixTicket[]>()
    for (const t of tickets) {
      if (!t.nm_kategori) continue
      if (!m.has(t.nm_kategori)) m.set(t.nm_kategori, [])
      m.get(t.nm_kategori)!.push(t)
    }
    return m
  }, [tickets])

  const kategoriData = useMemo(() => {
    const total = Array.from(ticketsByKategori.values()).reduce((s, arr) => s + arr.length, 0)
    return Array.from(ticketsByKategori.entries())
      .map(([name, arr]) => ({ name, value: arr.length, pct: total ? (arr.length / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value)
  }, [ticketsByKategori])

  const RANK_COLOR = ["#DC2626", "#F97316", "#0369A1"]
  const [expandedKategori, setExpandedKategori] = useState<string | null>(null)
  const [kategoriMaximized, setKategoriMaximized] = useState(false)
  const KATEGORI_MIN_SHOW = 3
  const visibleKategoriData = kategoriMaximized ? kategoriData : kategoriData.slice(0, KATEGORI_MIN_SHOW)

  const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}>
        {label && <div style={{ fontWeight: 700, marginBottom: "4px" }}>{label}</div>}
        {payload.map(p => (
          <div key={p.name} style={{ display: "flex", gap: "10px", justifyContent: "space-between", color: "var(--text2)" }}>
            <span>{p.name}</span><span style={{ fontWeight: 700, color: "var(--text)" }}>{p.value}</span>
          </div>
        ))}
      </div>
    )
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets
      .filter(t => {
        const matchQ = !q ||
          t.no_ticket.toLowerCase().includes(q) ||
          t.judul_ticket.toLowerCase().includes(q) ||
          t.nm_user.toLowerCase().includes(q) ||
          (t.email_user || "").toLowerCase().includes(q)
        const matchStatus = statusFilter === "ALL" || t.nm_status === statusFilter
        const matchTipe = tipeFilter === "ALL" || t.tipe_ticket === tipeFilter
        const matchUser = userFilter === "ALL" || t.nm_user === userFilter
        return matchQ && matchStatus && matchTipe && matchUser
      })
      .sort((a, b) => Number(b.date_created) - Number(a.date_created))
  }, [tickets, search, statusFilter, tipeFilter, userFilter])

  const th: React.CSSProperties = {
    padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", background: "var(--surface2)",
  }
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: "12px", color: "var(--text)", borderBottom: "1px solid var(--border)", verticalAlign: "top" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <MotivationBanner page="logix-tickets" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg,#DC2626,#F97316)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Ticket size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", margin: 0 }}>Monitoring Ticket Logix</h1>
            <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>
              Log Support Excellent (PHI) · {loading ? "memuat..." : `${recordsTotal} tiket total`}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={copyStatusMessage} disabled={loading || tickets.length === 0}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "9px", border: "none", background: copyOk ? "#166534" : "#0369A1", color: "white", fontSize: "12px", fontWeight: 700, cursor: (loading || tickets.length === 0) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (loading || tickets.length === 0) ? 0.6 : 1 }}>
            {copyOk ? <Check size={14} /> : <Copy size={14} />} {copyOk ? "Tersalin!" : "Salin Pesan Update"}
          </button>
          <button onClick={() => setCredOpen(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text2)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <Settings size={14} /> Kelola Kredensial
            {credOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={refreshAll} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "9px", border: "none", background: "#DC2626", color: "white", fontSize: "12px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : undefined} /> Refresh
          </button>
        </div>
      </div>
      {copyError && <div style={{ fontSize: "11px", color: "#DC2626", textAlign: "right" }}>{copyError}</div>}

      {/* Kelola Kredensial panel */}
      {credOpen && (
        <div style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <KeyRound size={15} color="#DC2626" />
            <span style={{ fontSize: "13px", fontWeight: 800 }}>Kredensial Logix</span>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text3)", margin: "0 0 12px" }}>
            Akun Logix yang dipakai buat login otomatis di server (disimpan di Supabase, dipakai server-side — tidak dikirim ke browser lain).
          </p>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 600 }}>Email</label>
              <input value={credEmail} onChange={e => setCredEmail(e.target.value)} placeholder="kevin@myr.com"
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", width: "220px", fontFamily: "inherit" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 600 }}>Password</label>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <input type={showCredPwd ? "text" : "password"} value={credPassword} onChange={e => setCredPassword(e.target.value)} placeholder="Password"
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", width: "180px", fontFamily: "inherit" }} />
                <button onClick={() => setShowCredPwd(v => !v)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", color: "var(--text3)", display: "flex" }}>
                  {showCredPwd ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
            <button onClick={saveCredentials} disabled={credSaving}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "8px", border: "none", background: "#DC2626", color: "white", fontSize: "12px", fontWeight: 700, cursor: credSaving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              <Save size={13} /> {credSaving ? "Menyimpan..." : "Simpan"}
            </button>
            {credSuccess && <span style={{ fontSize: "12px", color: "#166534", fontWeight: 700 }}>{credSuccess}</span>}
          </div>
          {credError && <div style={{ marginTop: "10px", fontSize: "12px", color: "#991B1B" }}>{credError}</div>}
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", color: "#991B1B", fontSize: "13px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}><AlertCircle size={15} /> {error}</div>
          {rawError && (
            <pre style={{ marginTop: "8px", background: "rgba(255,255,255,0.5)", padding: "10px", borderRadius: "8px", fontSize: "10px", overflow: "auto", maxHeight: "320px", whiteSpace: "pre-wrap" }}>{rawError}</pre>
          )}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "14px" }}>
        {([
          ["Total Tiket", loading ? "—" : String(summary.total), "#0369A1", ""],
          ["Open", loading ? "—" : String(summary.open), "#991B1B", ""],
          ["APPS R1", loading ? "—" : String(summary.appsR1), "#92400E", ""],
          ["Open BR", loading ? "—" : String(summary.openBr), "#C2410C", ""],
          ["BR R1", loading ? "—" : String(summary.brR1), "#B45309", ""],
          ["APPS R2", loading ? "—" : String(summary.appsR2), "#A16207", ""],
          // Percentage jadi angka utama, jumlah tiket-nya jadi angka kecil pendamping
          ["Solved", loading ? "—" : `${summary.pctSolved.toFixed(0)}%`, "#166534", loading ? "" : `${summary.solved} tiket`],
        ] as const).map(([label, value, color, sub]) => (
          <div key={label} style={{ position: "relative", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px", minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
              {label === "Open" && (
                <button onClick={() => setOpenInfoOpen(v => !v)} title="Lihat daftar tiket Open"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "15px", height: "15px", borderRadius: "50%", border: "none", background: "#991B1B", color: "white", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                  <Info size={10} />
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "26px", fontWeight: 800, color, letterSpacing: "-0.03em" }}>{value}</div>
              {sub && <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text3)" }}>{sub}</div>}
            </div>

            {label === "Open" && openInfoOpen && (
              <div onClick={e => e.stopPropagation()}
                style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 20, width: "280px", maxHeight: "260px", overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", boxShadow: "0 8px 24px rgba(0,0,0,0.15)", padding: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Tiket Status Open</span>
                  <button onClick={() => setOpenInfoOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex" }}><X size={13} /></button>
                </div>
                {openTickets.length === 0 ? (
                  <div style={{ fontSize: "12px", color: "var(--text3)", padding: "8px 0" }}>Tidak ada tiket Open</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {openTickets.map(t => (
                      <div key={t.no_ticket} onClick={() => { setSearch(t.no_ticket); setExpandedRow(t.no_ticket); setOpenInfoOpen(false) }}
                        style={{ cursor: "pointer", padding: "6px 8px", borderRadius: "6px", background: "var(--surface2)" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: "#0369A1", fontFamily: "monospace" }}>{t.no_ticket}</div>
                        <div style={{ fontSize: "11px", color: "var(--text)", marginTop: "2px" }}>{t.judul_ticket}</div>
                        <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>Dibuat: {fmtDate(t.date_created)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts */}
      {!loading && tickets.length > 0 && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "14px", alignItems: "stretch" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>Tren</div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "12px" }}>Tiket Dibuat — 14 Hari Terakhir</div>
              <div style={{ flex: 1, minHeight: "180px" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="logixTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0369A1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0369A1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} interval={1} />
                    <YAxis allowDecimals={false} tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="count" stroke="#0369A1" strokeWidth={2} fill="url(#logixTrend)" name="Tiket dibuat" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>SLA</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  {slaLoading && <RefreshCw size={11} color="var(--text3)" style={{ animation: "spin 1s linear infinite" }} />}
                  <div style={{ display: "flex", gap: "2px", background: "var(--surface2)", padding: "2px", borderRadius: "6px" }}>
                    <button onClick={() => setSlaGroupBy("date")}
                      style={{
                        padding: "3px 8px", borderRadius: "5px", border: "none", cursor: "pointer",
                        fontSize: "10px", fontWeight: 700, fontFamily: "inherit",
                        background: slaGroupBy === "date" ? "var(--surface)" : "transparent",
                        color: slaGroupBy === "date" ? "var(--text)" : "var(--text3)",
                      }}>
                      Tanggal
                    </button>
                    <button onClick={() => setSlaGroupBy("weekday")}
                      style={{
                        padding: "3px 8px", borderRadius: "5px", border: "none", cursor: "pointer",
                        fontSize: "10px", fontWeight: 700, fontFamily: "inherit",
                        background: slaGroupBy === "weekday" ? "var(--surface)" : "transparent",
                        color: slaGroupBy === "weekday" ? "var(--text)" : "var(--text3)",
                      }}>
                      Per Hari
                    </button>
                  </div>
                  <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
                    style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "10px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                    <option value="ALL">14 Hari Terakhir</option>
                    {periodOptions.map(k => <option key={k} value={k}>{periodLabel(k)}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "4px", background: "var(--surface2)", padding: "3px", borderRadius: "8px", flexWrap: "wrap" }}>
                  {SLA_TABS.map(tab => (
                    <button key={tab.key} onClick={() => handleSlaTabChange(tab.key)}
                      style={{
                        padding: "5px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                        fontSize: "11px", fontWeight: 700, fontFamily: "inherit",
                        background: slaTabKey === tab.key ? tab.color : "transparent",
                        color: slaTabKey === tab.key ? "#FFFFFF" : "var(--text3)",
                      }}>
                      {tab.label}
                    </button>
                  ))}
                  <button key={SLA_COMPARE_TAB.key} onClick={() => handleSlaTabChange(SLA_COMPARE_TAB.key)}
                    style={{
                      padding: "5px 10px", borderRadius: "6px", border: "none", cursor: "pointer",
                      fontSize: "11px", fontWeight: 700, fontFamily: "inherit",
                      background: slaTabKey === SLA_COMPARE_TAB.key ? "var(--text)" : "transparent",
                      color: slaTabKey === SLA_COMPARE_TAB.key ? "var(--surface)" : "var(--text3)",
                    }}>
                    {SLA_COMPARE_TAB.label}
                  </button>
                </div>
                {activeSlaTab && (
                  <select value={slaNameFilter} onChange={e => setSlaNameFilter(e.target.value)}
                    style={{ padding: "3px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "10px", fontWeight: 700, fontFamily: "inherit", cursor: "pointer", maxWidth: "160px" }}>
                    <option value="ALL">Semua Nama</option>
                    {slaNameOptions.map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                )}
              </div>

              <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "12px" }}>
                {activeSlaTab ? activeSlaTab.label : "Response TAS / Response BR / Time Solved"} (hari)
              </div>
              {slaError ? (
                <div style={{ flex: 1, minHeight: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "#991B1B", fontSize: "11px", textAlign: "center", padding: "0 12px" }}>{slaError}</div>
              ) : (
                <div style={{ flex: 1, minHeight: "180px" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    {activeSlaTab ? (
                      <LineChart data={slaChartData}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} interval={slaGroupBy === "weekday" ? 0 : 1} />
                        <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Line type="monotone" dataKey="value" stroke={activeSlaTab.color} strokeWidth={2} dot={false} name={activeSlaTab.label} connectNulls />
                      </LineChart>
                    ) : (
                      <LineChart data={slaCompareData}>
                        <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                        <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} interval={slaGroupBy === "weekday" ? 0 : 1} />
                        <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                        <Tooltip content={<ChartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                        <Line type="monotone" dataKey="responTas" stroke="#0369A1" strokeWidth={2} dot={false} name="Response TAS" connectNulls />
                        <Line type="monotone" dataKey="timeBr" stroke="#7C3AED" strokeWidth={2} dot={false} name="Response BR" connectNulls />
                        <Line type="monotone" dataKey="timeSolved" stroke="#166534" strokeWidth={2} dot={false} name="Time Solved" connectNulls />
                      </LineChart>
                    )}
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "14px", alignItems: "start" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>Distribusi</div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "12px" }}>Severity</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={severityData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: "var(--text3)", fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface2)" }} />
                  <Bar dataKey="value" name="Tiket" radius={[4, 4, 0, 0]} maxBarSize={44}>
                    {severityData.map(d => <Cell key={d.name} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>Top 5</div>
              <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "12px" }}>Aplikasi Paling Banyak Tiket</div>
              {aplikasiData.length === 0 ? (
                <div style={{ height: "180px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px" }}>Belum ada data aplikasi</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={aplikasiData} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface2)" }} />
                    <Bar dataKey="value" name="Tiket" fill="#0369A1" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Semua Kategori Issue — klik buat lihat detail tiketnya */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>
                    {kategoriMaximized ? "Semua Kategori" : `Top ${KATEGORI_MIN_SHOW}`}
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)" }}>Issue Terbanyak</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text3)" }}>{kategoriData.length} kategori</span>
                  {kategoriData.length > KATEGORI_MIN_SHOW && (
                    <button onClick={() => setKategoriMaximized(v => !v)}
                      style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text2)", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {kategoriMaximized ? <><Minimize2 size={12} /> Tampilkan {KATEGORI_MIN_SHOW}</> : <><Maximize2 size={12} /> Lihat Semua</>}
                    </button>
                  )}
                </div>
              </div>
              {kategoriData.length === 0 ? (
                <div style={{ height: "120px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px", textAlign: "center" }}>Belum ada tiket yang dikategorikan</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: kategoriMaximized ? "480px" : "none", overflowY: kategoriMaximized ? "auto" : "visible", paddingRight: "4px" }}>
                  {visibleKategoriData.map((item, i) => {
                    const isOpenK = expandedKategori === item.name
                    const color = RANK_COLOR[i] || "#64748B"
                    const kTickets = ticketsByKategori.get(item.name) || []
                    return (
                      <div key={item.name}>
                        <div onClick={() => setExpandedKategori(isOpenK ? null : item.name)}
                          style={{ cursor: "pointer", background: isOpenK ? "var(--surface2)" : "transparent", borderRadius: "8px", padding: "6px 8px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                            <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: color, color: "white", fontSize: "10px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                            <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)", flex: 1 }}>{item.name}</span>
                            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", whiteSpace: "nowrap" }}>{item.value} tiket · {item.pct.toFixed(0)}%</span>
                            {isOpenK ? <ChevronUp size={13} color="var(--text3)" /> : <ChevronDown size={13} color="var(--text3)" />}
                          </div>
                          <div style={{ height: "6px", background: "var(--surface2)", borderRadius: "99px", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${item.pct}%`, background: color, borderRadius: "99px" }} />
                          </div>
                        </div>
                        {isOpenK && (
                          <div style={{ marginTop: "6px", marginLeft: "28px", border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden" }}>
                            {kTickets.map((t, ti) => {
                              const bucket = statusBucket(t.nm_status)
                              const bc = BUCKET_COLOR[bucket]
                              return (
                                <div key={t.no_ticket} onClick={() => { setSearch(t.no_ticket); setExpandedRow(t.no_ticket) }}
                                  style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", cursor: "pointer", borderBottom: ti < kTickets.length - 1 ? "1px solid var(--border)" : "none" }}>
                                  <span style={{ fontFamily: "monospace", fontSize: "10px", color: "#0369A1", fontWeight: 700, whiteSpace: "nowrap" }}>{t.no_ticket}</span>
                                  <span style={{ fontSize: "11px", color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.judul_ticket}>{t.judul_ticket}</span>
                                  <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 7px", borderRadius: "99px", whiteSpace: "nowrap", ...bc }}>{t.nm_status}</span>
                                  <span style={{ fontSize: "10px", color: "var(--text3)", whiteSpace: "nowrap" }}>{fmtDate(t.date_created)}</span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {weeklyTimeline.rows.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>Timeline</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)" }}>Timeline Mingguan — Tiket BR</div>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {TIMELINE_STAGES.map(s => (
                    <span key={s} style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "var(--text3)" }}>
                      <span style={{ width: "9px", height: "9px", borderRadius: "3px", background: STAGE_COLOR[s].bg, border: `1px solid ${STAGE_COLOR[s].color}` }} />
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ position: "sticky", left: 0, background: "var(--surface)", textAlign: "left", padding: "4px 10px 8px 0", fontSize: "10px", fontWeight: 700, color: "var(--text3)", whiteSpace: "nowrap" }}>Tiket</th>
                      {weeklyTimeline.weeks.map(w => (
                        <th key={w} style={{ padding: "4px 4px 8px", fontSize: "9px", fontWeight: 700, color: "var(--text3)", whiteSpace: "nowrap", textAlign: "center" }}>{fmtWeekLabel(w)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {weeklyTimeline.rows.map(row => (
                      <tr key={row.no_ticket} style={{ opacity: row.isBrOpen ? 1 : 0.55 }}>
                        <td onClick={() => { setSearch(row.no_ticket); setExpandedRow(row.no_ticket) }}
                          style={{ position: "sticky", left: 0, background: "var(--surface)", padding: "4px 10px 4px 0", fontSize: "11px", cursor: "pointer", whiteSpace: "nowrap" }}>
                          <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#0369A1" }}>{row.no_ticket}</span>
                          {!row.isBrOpen && (
                            <span style={{ marginLeft: "6px", fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: "99px", background: "#DCFCE7", color: "#166534" }}>Solved</span>
                          )}
                          {row.judul && (
                            <div style={{ fontSize: "10px", color: "var(--text3)", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis" }}>{row.judul}</div>
                          )}
                        </td>
                        {weeklyTimeline.weeks.map(w => {
                          const entry = row.cells.get(w)
                          const sc3 = entry ? (STAGE_COLOR[entry.status] || { bg: "#F1F5F9", color: "#475569" }) : null
                          return (
                            <td key={w} style={{ padding: "2px 4px" }}>
                              <div title={entry ? entry.status : ""} style={{ height: "18px", minWidth: "40px", borderRadius: "4px", background: sc3?.bg || "transparent" }} />
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Toolbar */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", flex: 1, minWidth: "220px" }}>
          <Search size={13} color="var(--text3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari no. tiket, judul, atau nama..."
            style={{ background: "none", border: "none", outline: "none", fontSize: "12px", color: "var(--text)", width: "100%", fontFamily: "inherit" }} />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
          <option value="ALL">Semua Status</option>
          {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={tipeFilter} onChange={e => setTipeFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
          <option value="ALL">Semua Tipe</option>
          {tipeOptions.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
          <option value="ALL">Semua Dibuat Oleh</option>
          {userOptions.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <span style={{ fontSize: "12px", color: "var(--text3)", marginLeft: "auto" }}>{filtered.length}/{tickets.length} tiket</span>
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center", color: "var(--text3)" }}>
            <RefreshCw size={24} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4, animation: "spin 1s linear infinite" }} /> Memuat tiket...
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>No. Tiket</th>
                  <th style={th}>Judul</th>
                  <th style={th}>Tipe</th>
                  <th style={th}>Status</th>
                  <th style={th}>Severity</th>
                  <th style={th}>Dibuat Oleh</th>
                  <th style={th}>Aplikasi</th>
                  <th style={th}>PIC</th>
                  <th style={th}>Dibuat</th>
                  <th style={th}>Update</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} style={{ ...td, textAlign: "center", padding: "48px", color: "var(--text3)" }}>Tidak ada tiket yang cocok</td></tr>
                ) : filtered.map(t => {
                  const bucket = statusBucket(t.nm_status)
                  const bc = BUCKET_COLOR[bucket]
                  const sc = severityColor(t.nm_severity)
                  const isOpen = expandedRow === t.no_ticket
                  const isBrOpen = (t.nm_status || "").toUpperCase() === "OPEN BR"
                  const ticketTimeline = timelineByTicket.get(t.no_ticket) || []
                  return (
                    <Fragment key={t.no_ticket}>
                      <tr onClick={() => setExpandedRow(isOpen ? null : t.no_ticket)} style={{ cursor: "pointer" }}>
                        <td style={{ ...td, fontFamily: "monospace", fontWeight: 700, color: "#0369A1", whiteSpace: "nowrap" }}>{t.no_ticket}</td>
                        <td style={{ ...td, maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={t.judul_ticket}>{t.judul_ticket}</td>
                        <td style={td}>
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: t.tipe_ticket === "REQUEST" ? "#EDE9FE" : "#F1F5F9", color: t.tipe_ticket === "REQUEST" ? "#7C3AED" : "#475569" }}>{t.tipe_ticket}</span>
                        </td>
                        <td style={td}>
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", ...bc }}>{BUCKET_LABEL[bucket]} · {t.nm_status}</span>
                        </td>
                        <td style={td}>
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", ...sc }}>{t.nm_severity}</span>
                        </td>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{t.nm_user}</div>
                          <div style={{ fontSize: "10px", color: "var(--text3)" }}>{t.nm_subdist}</div>
                        </td>
                        <td style={{ ...td, fontSize: "11px" }}>{t.nm_aplikasi || "—"}</td>
                        <td style={{ ...td, fontSize: "11px", fontWeight: 600 }}>{currentPic(t)}</td>
                        <td style={{ ...td, fontSize: "11px", whiteSpace: "nowrap" }}>{fmtDate(t.date_created)}</td>
                        <td style={{ ...td, fontSize: "11px", whiteSpace: "nowrap" }}>{fmtDate(t.date_updated)}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={10} style={{ ...td, background: "var(--surface2)" }}>
                            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.04em" }}>Deskripsi</div>
                            <div style={{ whiteSpace: "pre-wrap", fontSize: "12px", lineHeight: 1.6 }}>{t.description_ticket}</div>
                            {t.nm_kategori && (
                              <div style={{ marginTop: "8px", fontSize: "11px", color: "var(--text3)" }}>
                                Kategori: <strong style={{ color: "var(--text)" }}>{t.nm_kategori}</strong>
                                {t.nm_sub_kategori && <> · {t.nm_sub_kategori}</>}
                              </div>
                            )}

                            {(isBrOpen || ticketTimeline.length > 0) && (
                              <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px solid var(--border)" }} onClick={(e) => e.stopPropagation()}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                                  <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                                    Timeline Internal
                                  </div>
                                  {!isBrOpen && (
                                    <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: "#DCFCE7", color: "#166534" }}>
                                      Sudah solved di Logix (status: {t.nm_status})
                                    </span>
                                  )}
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                  {TIMELINE_STAGES.map((stage) => {
                                    const existing = ticketTimeline.find((e) => e.status === stage)
                                    const draftKey = `${t.no_ticket}::${stage}`
                                    const draft = stageDraft[draftKey]
                                    const fromVal = draft?.from ?? existing?.date_from ?? ""
                                    const toVal = draft?.to ?? existing?.date_to ?? ""
                                    const sc2 = STAGE_COLOR[stage] || { bg: "#F1F5F9", color: "#475569" }
                                    return (
                                      <div key={stage} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", fontSize: "12px", background: "var(--surface)", borderRadius: "6px", padding: "6px 10px" }}>
                                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "99px", background: sc2.bg, color: sc2.color, whiteSpace: "nowrap", minWidth: "108px", textAlign: "center" }}>
                                          {stage}
                                        </span>
                                        <input
                                          type="date"
                                          value={fromVal}
                                          onChange={(e) => setStageDraft(prev => ({ ...prev, [draftKey]: { from: e.target.value, to: toVal } }))}
                                          style={{ fontSize: "12px", padding: "4px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
                                        />
                                        <span style={{ fontSize: "12px", color: "var(--text3)" }}>s/d</span>
                                        <input
                                          type="date"
                                          value={toVal}
                                          onChange={(e) => setStageDraft(prev => ({ ...prev, [draftKey]: { from: fromVal, to: e.target.value } }))}
                                          style={{ fontSize: "12px", padding: "4px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
                                        />
                                        <button
                                          onClick={() => saveStageEntry(t.no_ticket, stage, existing?.id, fromVal, toVal)}
                                          disabled={timelineSaving}
                                          style={{ fontSize: "11px", fontWeight: 700, padding: "5px 10px", borderRadius: "6px", border: "none", background: "#0369A1", color: "#fff", cursor: timelineSaving ? "default" : "pointer", opacity: timelineSaving ? 0.6 : 1 }}
                                        >
                                          Simpan
                                        </button>
                                        {existing && (
                                          <button
                                            onClick={() => deleteTimelineEntry(existing.id)}
                                            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center", padding: "2px" }}
                                            title="Hapus"
                                          >
                                            <X size={14} />
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                                {timelineError && (
                                  <div style={{ marginTop: "6px", fontSize: "11px", color: "#DC2626" }}>{timelineError}</div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <a href="https://phi.logix.my.id/ticketing" target="_blank" rel="noopener noreferrer"
        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text3)", textDecoration: "none", width: "fit-content" }}>
        <ExternalLink size={12} /> Buka Logix langsung
      </a>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
