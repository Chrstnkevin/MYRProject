"use client"
// PATH: src/app/dashboard/ho-transfer/page.tsx
//
// Data Transfer HO — monitoring status transfer data per subdist (ADP)
// dari sistem HO (Head Office), TERPISAH dari Ficom (host beda:
// 52.163.214.18:8081, bukan ficom-phi.mayora.co.id). Endpoint ini TIDAK
// butuh login/token (akses network internal).
//
// Sync-nya lewat /api/ho-transfer-sync (server-side) — SEBELUMNYA fetch
// langsung dari browser, tapi SELALU gagal "Failed to fetch" karena
// diblokir sebagai mixed content (halaman kita HTTPS, HO API-nya HTTP
// biasa — aturan baku browser, bukan soal jaringan kantor/CORS seperti
// dugaan awal). Lihat src/app/api/ho-transfer-sync/route.ts buat detail
// request ke HO-nya.

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle, CheckCircle2, Clock, MapPin, Building2, Copy, Check,
} from "lucide-react"
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList, Cell,
} from "recharts"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"

// Palet wilayah — SAMA kayak REGION_CLR di master-data/page.tsx, biar
// warna wilayah konsisten di seluruh app.
const WILAYAH_ORDER = ["GMA", "NOL", "SOL", "VIS", "MIN"]
const WILAYAH_CLR: Record<string, string> = {
  GMA: "#7C3AED", NOL: "#1D4ED8", SOL: "#DB2777", VIS: "#0891B2", MIN: "#DC2626",
}

// PIC TAS per subdist — dikonfirmasi user langsung: GMA+MIN pegang JC,
// NOL + khusus subdist "ARMATURE" di GMA pegang Van, SOL pegang
// Jonathan, VIS pegang Darren. SAMA orangnya kayak PIC TAS di
// master-data/page.tsx (TAS_MAP), cuma di sini GMA dipecah lagi jadi
// 2 PIC (Armature vs sisanya) sesuai yang diminta user.
type PicName = "JC" | "Van" | "Jonathan" | "Darren"
const PIC_SCOPE: Record<PicName, string> = {
  JC: "GMA + MIN", Van: "GMA (Armature) + NOL", Jonathan: "SOL", Darren: "VIS",
}
const PIC_CLR: Record<PicName, string> = {
  JC: "#0369A1", Van: "#7C3AED", Jonathan: "#DB2777", Darren: "#0891B2",
}
function picFor(r: { region_nm: string | null; subdist_nm: string | null }): PicName | null {
  const wilayah = r.region_nm
  const nama = (r.subdist_nm || "").toUpperCase()
  if (wilayah === "MIN") return "JC"
  if (wilayah === "GMA") return nama.includes("ARMATURE") ? "Van" : "JC"
  if (wilayah === "NOL") return "Van"
  if (wilayah === "SOL") return "Jonathan"
  if (wilayah === "VIS") return "Darren"
  return null
}
function tierColor(pct: number): string {
  return pct >= 90 ? "#16A34A" : pct >= 70 ? "#D97706" : "#DC2626"
}

interface SnapshotRow {
  id: string
  snapshot_date: string
  subdist_id: string
  subdist_nm: string | null
  sbd_add1: string | null
  sbd_add2: string | null
  region_id: string | null
  region_nm: string | null
  area_id: string | null
  area_nm: string | null
  ext_date: string | null
  next_date: string | null
  terlambat: string | null
  total_diff: number | null
  release: string | null
  omzet_ho: number | null
  omzet_pro: number | null
  total_diff_rekonsil: number | null
  ho_vs_consol: number | null
  synced_at: string
}
interface SummaryRow { snapshot_date: string; total_naik: number; total: number; percentage: number }

function fmtPeso(n: number | null): string {
  if (n == null) return "-"
  return "₱" + Math.round(n).toLocaleString("en-PH")
}
// Sapaan otomatis sesuai jam saat tombol "Salin Pesan Update" diklik,
// biar pesannya nggak basi kalau di-copy di luar sore hari.
function greetingNow(): string {
  const h = new Date().getHours()
  if (h < 10) return "Selamat pagi"
  if (h < 15) return "Selamat siang"
  if (h < 18) return "Selamat sore"
  return "Selamat malam"
}
// "08 Oktober 2026 15.23 WIB" — format persis kayak contoh template user.
function fmtCutoff(iso: string): string {
  const d = new Date(iso)
  const day = String(d.getDate()).padStart(2, "0")
  const month = d.toLocaleDateString("id-ID", { month: "long" })
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  return `${day} ${month} ${d.getFullYear()} ${hh}.${mm} WIB`
}

export default function HoTransferPage() {
  const [rows, setRows] = useState<SnapshotRow[]>([])
  const [summaries, setSummaries] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")
  const [copied, setCopied] = useState(false)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [wilayahFilter, setWilayahFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "TERLAMBAT" | "TEPAT">("ALL")

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setLoadError("")
    const [snapRes, summaryRes] = await Promise.all([
      supabase.from("ho_transfer_snapshot").select("*").order("snapshot_date", { ascending: true }),
      supabase.from("ho_transfer_summary").select("*").order("snapshot_date", { ascending: true }),
    ])
    if (snapRes.error) setLoadError(snapRes.error.message)
    else setRows((snapRes.data || []) as SnapshotRow[])
    if (summaryRes.data) setSummaries(summaryRes.data as SummaryRow[])
    setLoading(false)
  }

  // Sync SERVER-SIDE lewat /api/ho-transfer-sync. SEBELUMNYA ini fetch
  // langsung dari browser ke HO API — ternyata SELALU diblokir browser
  // sebagai "mixed content" (halaman kita HTTPS, HO API-nya HTTP biasa),
  // bukan soal jaringan/CORS seperti dugaan awal. Request server-ke-server
  // nggak kena aturan itu, makanya dipindah ke API route.
  async function handleSync() {
    setSyncing(true); setSyncMsg("")
    try {
      const res = await fetch("/api/ho-transfer-sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setSyncMsg(`✅ Sync selesai — ${data.rows} subdist ter-update untuk ${data.snapshotDate}`)
      await loadData()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSyncMsg(`❌ ${msg}`)
    }
    setSyncing(false)
  }

  const dates = Array.from(new Set(rows.map(r => r.snapshot_date))).sort()
  const latestDate = dates[dates.length - 1] || null
  const activeDate = (selectedDate && dates.includes(selectedDate)) ? selectedDate : latestDate
  const activeRows = activeDate ? rows.filter(r => r.snapshot_date === activeDate) : []
  const activeSummary = activeDate ? (summaries.find(s => s.snapshot_date === activeDate) || null) : null

  const wilayahOptions = Array.from(new Set(activeRows.map(r => r.region_nm).filter(Boolean))) as string[]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activeRows.filter(r => {
      if (q && !r.subdist_nm?.toLowerCase().includes(q) && !r.subdist_id.includes(q)) return false
      if (wilayahFilter !== "ALL" && r.region_nm !== wilayahFilter) return false
      if (statusFilter === "TERLAMBAT" && r.terlambat !== "T") return false
      if (statusFilter === "TEPAT" && r.terlambat === "T") return false
      return true
    })
  }, [activeRows, search, wilayahFilter, statusFilter])

  const terlambatCount = activeRows.filter(r => r.terlambat === "T").length
  const tepatCount = activeRows.length - terlambatCount

  // Tren jumlah Terlambat per tanggal sync — semua tanggal yang pernah
  // ke-sync, dipakai apa adanya (bukan cuma 14 hari terakhir, soalnya
  // histori kita belum tentu sepanjang itu).
  const trendData = dates.map(d => {
    const list = rows.filter(r => r.snapshot_date === d)
    return {
      date: d.slice(5), // "MM-DD" biar ringkas di sumbu-X
      terlambat: list.filter(r => r.terlambat === "T").length,
      total: list.length,
    }
  })

  // Breakdown per wilayah (GMA/NOL/SOL/VIS/MIN) — jumlah subdist +
  // berapa yang terlambat, buat chart & ranking "wilayah bermasalah".
  const wilayahStats = WILAYAH_ORDER.map(w => {
    const list = activeRows.filter(r => r.region_nm === w)
    const terlambat = list.filter(r => r.terlambat === "T").length
    const diffSum = list.reduce((s, r) => s + Math.abs(r.total_diff || 0), 0)
    return {
      wilayah: w,
      total: list.length,
      terlambat,
      tepat: list.length - terlambat,
      pctTerlambat: list.length > 0 ? Math.round((terlambat / list.length) * 100) : 0,
      diffSum,
    }
  }).filter(w => w.total > 0)
  const wilayahRanked = [...wilayahStats].sort((a, b) => b.pctTerlambat - a.pctTerlambat)
  const maxPctTerlambat = Math.max(1, ...wilayahRanked.map(w => w.pctTerlambat))

  // Performa per PIC TAS (JC/Van/Jonathan/Darren) — lihat picFor() di atas
  // buat aturan pembagian wilayahnya.
  const picStats = (["JC", "Van", "Jonathan", "Darren"] as PicName[]).map(pic => {
    const list = activeRows.filter(r => picFor(r) === pic)
    const terlambat = list.filter(r => r.terlambat === "T").length
    const tepat = list.length - terlambat
    return {
      pic, scope: PIC_SCOPE[pic],
      total: list.length, tepat, terlambat,
      perfPct: list.length > 0 ? Math.round((tepat / list.length) * 1000) / 10 : 0,
    }
  }).sort((a, b) => b.perfPct - a.perfPct)

  const pctTepatOverall = activeRows.length > 0 ? Math.round((tepatCount / activeRows.length) * 100) : 0

  // Pesan update siap-kirim — "Naik"/"Belum Naik" pakai angka LANGSUNG
  // dari endpoint /percentage HO (totalNaik/total, tersimpan di
  // ho_transfer_summary), bukan hitungan terlambat/tepat kita sendiri,
  // biar konsisten sama istilah yang dipakai sistem HO-nya ("naik").
  async function handleCopyUpdate() {
    const cutoffSrc = activeRows[0]?.synced_at || new Date().toISOString()
    const total = activeSummary?.total ?? activeRows.length
    const naik = activeSummary?.total_naik ?? tepatCount
    const belumNaik = total - naik
    const msg = `${greetingNow()} pak\nBerikut adalah status Data Transfer HO cut off ${fmtCutoff(cutoffSrc)}\n\n* Total ADP: ${total} ADP\n* Total ADP Telah Naik: ${naik} ADP\n* Total ADP Belum Naik: ${belumNaik} ADP\n\nTerimakasih pak`
    try {
      await navigator.clipboard.writeText(msg)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setSyncMsg("❌ Gagal menyalin ke clipboard — browser mungkin memblokir akses clipboard")
    }
  }

  if (loading && rows.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #1E3A5F", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ fontSize: 13, color: "var(--text3)" }}>Memuat data...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ minHeight: "100%", background: "var(--bg)" }}>
      <MotivationBanner page="data-transfer" />
      <div style={{ padding: "20px 24px", fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Banner */}
      <div style={{ background: "linear-gradient(135deg,#0E4D64,#0891B2)", borderRadius: 14, padding: "18px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🔁</div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 3 }}>Data Transfer HO</h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Status transfer data per subdist (HO) — {activeDate ? `tanggal ${activeDate}` : "belum ada data"}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {dates.length > 0 && (
              <select value={activeDate || ""} onChange={e => setSelectedDate(e.target.value)}
                title="Pilih tanggal sync"
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit" }}>
                {dates.slice().reverse().map(d => (
                  <option key={d} value={d} style={{ color: "#111" }}>{d}</option>
                ))}
              </select>
            )}
            <button onClick={handleSync} disabled={syncing}
              title="Tarik data terbaru langsung dari HO (perlu akses jaringan yang bisa jangkau 52.163.214.18)"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: syncing ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.18)", cursor: syncing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ animation: syncing ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>⚡</span> {syncing ? "Sync..." : "Sync dari HO"}
            </button>
            <button onClick={handleCopyUpdate} disabled={!activeDate}
              title="Salin pesan status update siap-kirim (WhatsApp/email)"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: copied ? "#16A34A" : "rgba(255,255,255,0.18)", cursor: activeDate ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, opacity: activeDate ? 1 : 0.5 }}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? "Tersalin!" : "Salin Pesan Update"}
            </button>
            <button onClick={loadData} disabled={loading} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", cursor: "pointer", fontSize: 11, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ animation: loading ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>↻</span> Refresh
            </button>
          </div>
        </div>
      </div>

      {syncMsg && (
        <div style={{ background: syncMsg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2", border: `1px solid ${syncMsg.startsWith("✅") ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: syncMsg.startsWith("✅") ? "#166534" : "#991B1B" }}>
          {syncMsg}
        </div>
      )}
      {loadError && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B" }}>
          ❌ Gagal memuat data: {loadError}
        </div>
      )}

      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#92400E" }}>
        ⚠️ Sumber data ini (host 52.163.214.18, bukan Ficom) sync-nya jalan di BROWSER kamu langsung, jadi tombol &quot;Sync dari HO&quot; cuma berhasil kalau perangkat kamu ada di jaringan yang bisa akses IP itu (mis. jaringan kantor/VPN). Beberapa kolom dari API ini (flagTrf, text5, color, dll) maknanya belum dikonfirmasi, jadi belum ditampilkan di tabel.
      </div>

      {!activeDate && !loading && (
        <div style={{ textAlign: "center", padding: "48px", background: "var(--surface)", borderRadius: 16, border: "1.5px solid var(--border)" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔁</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Belum ada data</p>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>Klik &quot;Sync dari HO&quot; buat narik data pertama kali (dari jaringan yang bisa akses HO)</p>
        </div>
      )}

      {activeDate && (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
            {[
              { label: "TOTAL SUBDIST", value: String(activeRows.length), color: "#0369A1", icon: Building2 },
              { label: "TERLAMBAT", value: String(terlambatCount), color: "#DC2626", icon: Clock },
              { label: "TEPAT WAKTU", value: String(tepatCount), color: "#16A34A", icon: CheckCircle2 },
              { label: "% NAIK (DARI HO)", value: activeSummary ? `${activeSummary.percentage}%` : "n/a", sub: activeSummary ? `${activeSummary.total_naik}/${activeSummary.total} subdist` : undefined, color: "#7C3AED", icon: AlertCircle },
            ].map((c, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 11px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: 9, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.02em" }}>{c.label}</span>
                  <div style={{ width: 19, height: 19, borderRadius: "50%", background: c.color + "1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <c.icon size={10} color={c.color} />
                  </div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: c.color, letterSpacing: "-0.02em" }}>{c.value}</div>
                {c.sub && <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 1 }}>{c.sub}</div>}
              </div>
            ))}
          </div>

          {/* Current Progress (donut + wilayah chips) + PIC Performance —
              model layout ikutin referensi dashboard yang dikasih user. */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 10 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
              <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.03em", marginBottom: 2 }}>CURRENT PROGRESS</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 14 }}>Status Transfer Hari Ini</div>

              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ position: "relative", width: 128, height: 128, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ name: "Tepat Waktu", value: tepatCount }, { name: "Terlambat", value: terlambatCount }]}
                        dataKey="value" cx="50%" cy="50%" innerRadius={44} outerRadius={60} startAngle={90} endAngle={-270} stroke="none">
                        <Cell fill="#16A34A" />
                        <Cell fill="#DC2626" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{pctTepatOverall}%</div>
                    <div style={{ fontSize: 8, color: "var(--text3)", fontWeight: 700 }}>TEPAT WAKTU</div>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 150 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "var(--surface2)" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#16A34A1A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <CheckCircle2 size={13} color="#16A34A" />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.02em" }}>TEPAT WAKTU</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{tepatCount} <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)" }}>/ {activeRows.length}</span></div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 10, background: "var(--surface2)" }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#DC26261A", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <AlertCircle size={13} color="#DC2626" />
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.02em" }}>PERLU TINDAKAN</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{terlambatCount} <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text3)" }}>terlambat</span></div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 9, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.03em", marginBottom: 6 }}>WILAYAH STATUS</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {wilayahStats.map(w => {
                  const pct = w.total > 0 ? Math.round((w.tepat / w.total) * 100) : 0
                  const clr = tierColor(pct)
                  return (
                    <div key={w.wilayah} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface2)" }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)" }}>{w.wilayah}</span>
                      <span style={{ fontSize: 10, color: "var(--text3)" }}>{w.tepat}/{w.total}</span>
                      <span style={{ padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 800, background: clr + "22", color: clr }}>{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.03em", marginBottom: 2 }}>PIC PERFORMANCE</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Kinerja PIC TAS per Wilayah</div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>{picStats.length} PIC</span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "6px 8px" }}>#</th>
                    <th style={{ padding: "6px 8px" }}>PIC</th>
                    <th style={{ padding: "6px 8px" }}>Cakupan</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Total</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Tepat</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Terlambat</th>
                    <th style={{ padding: "6px 8px", textAlign: "right" }}>Perf %</th>
                  </tr>
                </thead>
                <tbody>
                  {picStats.map((p, i) => {
                    const clr = tierColor(p.perfPct)
                    return (
                      <tr key={p.pic} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "8px", color: "var(--text3)" }}>{i + 1}</td>
                        <td style={{ padding: "8px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, color: "var(--text)" }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: PIC_CLR[p.pic], flexShrink: 0 }} />
                            {p.pic}
                          </span>
                        </td>
                        <td style={{ padding: "8px", color: "var(--text3)" }}>{p.scope}</td>
                        <td style={{ padding: "8px", textAlign: "right", color: "var(--text2)" }}>{p.total}</td>
                        <td style={{ padding: "8px", textAlign: "right", color: "#16A34A", fontWeight: 700 }}>{p.tepat}</td>
                        <td style={{ padding: "8px", textAlign: "right", color: p.terlambat > 0 ? "#DC2626" : "var(--text3)", fontWeight: 700 }}>{p.terlambat}</td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: clr + "1A", color: clr }}>{p.perfPct}%</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Tren Terlambat + Top Wilayah Bermasalah */}
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 10 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.03em", marginBottom: 2 }}>TREN</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>Subdist Terlambat — {dates.length} Hari Tersimpan</div>
              {dates.length < 2 && (
                <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 8 }}>Baru {dates.length} hari data ke-sync — tren bakal lebih keliatan setelah sync jalan beberapa hari.</p>
              )}
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                  <defs>
                    <linearGradient id="terlambatGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#DC2626" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(value: number, name: string) => [value, name === "terlambat" ? "Terlambat" : "Total Subdist"]} labelFormatter={l => `Tanggal ${l}`} />
                  <Area type="monotone" dataKey="terlambat" name="Terlambat" stroke="#DC2626" strokeWidth={2} dot={{ r: 3, fill: "#DC2626" }} fill="url(#terlambatGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.03em", marginBottom: 2 }}>TOP WILAYAH</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Wilayah Paling Bermasalah</div>
                </div>
                <span style={{ fontSize: 10, color: "var(--text3)" }}>{wilayahRanked.length} wilayah</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {wilayahRanked.map((w, i) => (
                  <div key={w.wilayah}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 18, height: 18, borderRadius: "50%", background: (WILAYAH_CLR[w.wilayah] || "#64748B") + "22", color: WILAYAH_CLR[w.wilayah] || "#64748B", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{w.wilayah}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text3)" }}>{w.terlambat} terlambat · {w.pctTerlambat}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--surface2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.max(2, (w.pctTerlambat / maxPctTerlambat) * 100)}%`, background: WILAYAH_CLR[w.wilayah] || "#64748B", borderRadius: 999 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Selisih Omset per Wilayah */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "var(--text3)", fontWeight: 700, letterSpacing: "0.03em", marginBottom: 2 }}>SELISIH OMSET</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>|Omset HO − Pro| per Wilayah</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={wilayahStats} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="wilayah" tick={{ fontSize: 11, fontWeight: 700 }} width={40} />
                <Tooltip formatter={(value: number) => value.toLocaleString("en-PH")} />
                <Bar dataKey="diffSum" name="Selisih" radius={[0, 4, 4, 0]}>
                  <LabelList dataKey="diffSum" position="right" style={{ fontSize: 10, fill: "var(--text3)" }} formatter={(v: number) => v.toLocaleString("en-PH")} />
                  {wilayahStats.map(w => <Cell key={w.wilayah} fill={WILAYAH_CLR[w.wilayah] || "#64748B"} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Search + filter */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari subdist ID / nama..."
              style={{ flex: "1 1 240px", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }} />
            <select value={wilayahFilter} onChange={e => setWilayahFilter(e.target.value)}
              style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }}>
              <option value="ALL">Semua Wilayah</option>
              {wilayahOptions.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
              style={{ padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }}>
              <option value="ALL">Semua Status</option>
              <option value="TERLAMBAT">Terlambat</option>
              <option value="TEPAT">Tepat Waktu</option>
            </select>
            <span style={{ alignSelf: "center", fontSize: 11, color: "var(--text3)" }}>{filtered.length}/{activeRows.length} subdist</span>
          </div>

          {/* Table */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                    <th style={{ padding: "8px 10px" }}>Subdist</th>
                    <th style={{ padding: "8px 10px" }}>Wilayah</th>
                    <th style={{ padding: "8px 10px" }}>Area</th>
                    <th style={{ padding: "8px 10px" }}>Ext Date</th>
                    <th style={{ padding: "8px 10px" }}>Next Date</th>
                    <th style={{ padding: "8px 10px" }}>Status</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Omset HO</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Omset Pro</th>
                    <th style={{ padding: "8px 10px", textAlign: "right" }}>Diff</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>Tidak ada data yang cocok</td></tr>
                  ) : filtered.map(r => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "7px 10px" }}>
                        <div style={{ fontWeight: 700, color: "var(--text)" }}>{r.subdist_nm || r.subdist_id}</div>
                        <div style={{ fontSize: 9, color: "var(--text3)", fontFamily: "monospace" }}>{r.subdist_id}</div>
                      </td>
                      <td style={{ padding: "7px 10px", color: "var(--text2)" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={10} />{r.region_nm || "-"}</span>
                      </td>
                      <td style={{ padding: "7px 10px", color: "var(--text3)" }}>{r.area_nm || "-"}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text3)" }}>{r.ext_date || "-"}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text3)" }}>{r.next_date || "-"}</td>
                      <td style={{ padding: "7px 10px" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: r.terlambat === "T" ? "#FEE2E2" : "#DCFCE7", color: r.terlambat === "T" ? "#991B1B" : "#166534" }}>
                          {r.terlambat === "T" ? "Terlambat" : "Tepat Waktu"}
                        </span>
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text2)" }}>{fmtPeso(r.omzet_ho)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text2)" }}>{fmtPeso(r.omzet_pro)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontWeight: 700, color: (r.total_diff || 0) === 0 ? "var(--text3)" : "#DC2626" }}>{r.total_diff != null ? r.total_diff.toLocaleString("en-PH") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  )
}
