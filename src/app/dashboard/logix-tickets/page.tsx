"use client"
// PATH: src/app/dashboard/logix-tickets/page.tsx

import { useState, useEffect, useMemo, Fragment } from "react"
import {
  Ticket, RefreshCw, Search, AlertCircle, KeyRound, Settings,
  ChevronUp, ChevronDown, Eye, EyeOff, Save, ExternalLink,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
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

export default function LogixTicketsPage() {
  const [tickets, setTickets] = useState<LogixTicket[]>([])
  const [recordsTotal, setRecordsTotal] = useState("0")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [rawError, setRawError] = useState("")

  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [tipeFilter, setTipeFilter] = useState("ALL")
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

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

  const loadCredentials = async () => {
    const { data } = await supabase.from("logix_credentials").select("email,password").eq("id", 1).maybeSingle()
    if (data) { setCredEmail(data.email); setCredPassword(data.password) }
  }

  useEffect(() => { loadCredentials(); fetchTickets() }, [])

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
    return {
      total: tickets.length,
      open: count("OPEN"),
      appsR1: count("APPS R1"),
      openBr: count("OPEN BR"),
      solved: count("SOLVED"),
    }
  }, [tickets])

  const statusOptions = useMemo(() => Array.from(new Set(tickets.map(t => t.nm_status))).sort(), [tickets])
  const tipeOptions = useMemo(() => Array.from(new Set(tickets.map(t => t.tipe_ticket))).sort(), [tickets])

  // Tren tiket dibuat per hari, 14 hari terakhir
  const trendData = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today); d.setDate(d.getDate() - (13 - i))
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" }), count: 0 }
    })
    const byKey = new Map(days.map(d => [d.key, d]))
    for (const t of tickets) {
      const n = Number(t.date_created)
      if (!n) continue
      const row = byKey.get(new Date(n * 1000).toISOString().slice(0, 10))
      if (row) row.count++
    }
    return days
  }, [tickets])

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
        return matchQ && matchStatus && matchTipe
      })
      .sort((a, b) => Number(b.date_created) - Number(a.date_created))
  }, [tickets, search, statusFilter, tipeFilter])

  const th: React.CSSProperties = {
    padding: "10px 12px", fontSize: "10px", fontWeight: 700, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", background: "var(--surface2)",
  }
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: "12px", color: "var(--text)", borderBottom: "1px solid var(--border)", verticalAlign: "top" }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <MotivationBanner page="docreq" />

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
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setCredOpen(v => !v)}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text2)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <Settings size={14} /> Kelola Kredensial
            {credOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={fetchTickets} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "9px", border: "none", background: "#DC2626", color: "white", fontSize: "12px", fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
            <RefreshCw size={14} style={loading ? { animation: "spin 1s linear infinite" } : undefined} /> Refresh
          </button>
        </div>
      </div>

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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "14px" }}>
        {([
          ["Total Tiket", summary.total, "#0369A1"],
          ["Open", summary.open, "#991B1B"],
          ["APPS R1", summary.appsR1, "#92400E"],
          ["Open BR", summary.openBr, "#C2410C"],
          ["Solved", summary.solved, "#166534"],
        ] as const).map(([label, value, color]) => (
          <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>{label}</div>
            <div style={{ fontSize: "26px", fontWeight: 800, color, letterSpacing: "-0.03em" }}>{loading ? "—" : value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      {!loading && tickets.length > 0 && (
        <>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 20px" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "2px" }}>Tren</div>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)", marginBottom: "12px" }}>Tiket Dibuat — 14 Hari Terakhir</div>
            <ResponsiveContainer width="100%" height={180}>
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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
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
          </div>
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