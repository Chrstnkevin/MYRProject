"use client"
// PATH: src/app/dashboard/ho-transfer/page.tsx
//
// Data Transfer HO — monitoring status transfer data per subdist (ADP)
// dari sistem HO (Head Office), TERPISAH dari Ficom (host beda:
// 52.163.214.18:8081, bukan ficom-phi.mayora.co.id). Dikonfirmasi user:
// endpoint ini TIDAK butuh login/token (akses network internal), jadi
// sync-nya SENGAJA client-side (browser yang fetch langsung), bukan
// lewat API route server kita — IP internal kayak gini kemungkinan
// besar cuma kejangkau dari jaringan kantor, bukan dari server hosting
// (Vercel dkk), jadi kalau dipanggil server-side kemungkinan gagal.
// Kalau ternyata CORS diblokir dari browser juga, baru perlu di-relay
// lewat API route server (belum divalidasi).

import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle, CheckCircle2, Clock, MapPin, Building2,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

const HO_BASE = "http://52.163.214.18:8081/api/ho/dashboard-subdist"

// Bentuk mentah response GET next-date-phi/OmsetDif — field flagTrf/
// text5/color/totalDiffRekonsil/hoVsConsol disimpan apa adanya, makna
// persisnya belum dikonfirmasi user.
interface HoApiRow {
  subdistId: string
  subdistNm: string
  sbdAdd1: string | null
  sbdAdd2: string | null
  regionId: string | null
  regionNm: string | null
  areaId: string | null
  areaNm: string | null
  extDate: string | null
  nextDate: string | null
  flagTrf: string | null
  text5: string | null
  terlambat: string | null
  totalDiff: number | null
  release: string | null
  omzetHo: number | null
  omzetPro: number | null
  color: string | null
  totalDiffRekonsil: number | null
  hoVsConsol: number | null
}
interface HoApiPercentage { totalNaik: number; total: number; percentage: number }

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

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}
function fmtPeso(n: number | null): string {
  if (n == null) return "-"
  return "₱" + Math.round(n).toLocaleString("en-PH")
}

export default function HoTransferPage() {
  const [rows, setRows] = useState<SnapshotRow[]>([])
  const [summaries, setSummaries] = useState<SummaryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")

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

  // Sync CLIENT-SIDE — browser fetch langsung ke HO API (lihat catatan
  // di atas soal kenapa bukan lewat API route server), lalu upsert
  // hasilnya ke Supabase pakai client yang sama dipakai halaman ini.
  async function handleSync() {
    setSyncing(true); setSyncMsg("")
    try {
      const [listRes, pctRes] = await Promise.all([
        fetch(`${HO_BASE}/next-date-phi/OmsetDif`),
        fetch(`${HO_BASE}/percentage`),
      ])
      if (!listRes.ok) throw new Error(`Gagal ambil data subdist (HTTP ${listRes.status})`)
      if (!pctRes.ok) throw new Error(`Gagal ambil ringkasan persentase (HTTP ${pctRes.status})`)
      const list = await listRes.json() as HoApiRow[]
      const pct = await pctRes.json() as HoApiPercentage

      const snapshotDate = todayIso()
      const now = new Date().toISOString()

      const dbRows = list.map(r => ({
        snapshot_date: snapshotDate,
        subdist_id: r.subdistId,
        subdist_nm: r.subdistNm || null,
        sbd_add1: r.sbdAdd1 || null,
        sbd_add2: r.sbdAdd2 || null,
        region_id: r.regionId || null,
        region_nm: r.regionNm || null,
        area_id: r.areaId || null,
        area_nm: r.areaNm || null,
        ext_date: r.extDate || null,
        next_date: r.nextDate || null,
        flag_trf: r.flagTrf || null,
        text5: r.text5 || null,
        terlambat: r.terlambat || null,
        total_diff: r.totalDiff,
        release: r.release || null,
        omzet_ho: r.omzetHo,
        omzet_pro: r.omzetPro,
        color: r.color || null,
        total_diff_rekonsil: r.totalDiffRekonsil,
        ho_vs_consol: r.hoVsConsol,
        synced_at: now,
      }))

      if (dbRows.length > 0) {
        const { error: upErr } = await supabase.from("ho_transfer_snapshot").upsert(dbRows, { onConflict: "snapshot_date,subdist_id" })
        if (upErr) throw upErr
      }
      const { error: sumErr } = await supabase
        .from("ho_transfer_summary")
        .upsert({ snapshot_date: snapshotDate, total_naik: pct.totalNaik, total: pct.total, percentage: pct.percentage, synced_at: now }, { onConflict: "snapshot_date" })
      if (sumErr) throw sumErr

      setSyncMsg(`✅ Sync selesai — ${dbRows.length} subdist ter-update untuk ${snapshotDate}`)
      await loadData()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setSyncMsg(`❌ ${msg}${msg.includes("Failed to fetch") ? " — kemungkinan browser kamu nggak di jaringan yang bisa akses IP HO (52.163.214.18), atau CORS diblokir" : ""}`)
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

  if (loading && rows.length === 0) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: 12 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #1E3A5F", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ fontSize: 13, color: "var(--text3)" }}>Memuat data...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: "20px 24px", fontFamily: "'Plus Jakarta Sans',sans-serif", background: "var(--bg)", minHeight: "100%", display: "flex", flexDirection: "column", gap: 14 }}>

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[
              { label: "Total Subdist", value: String(activeRows.length), color: "#0369A1", icon: Building2 },
              { label: "Terlambat", value: String(terlambatCount), color: "#DC2626", icon: Clock },
              { label: "Tepat Waktu", value: String(tepatCount), color: "#16A34A", icon: CheckCircle2 },
              { label: "% Naik (dari HO)", value: activeSummary ? `${activeSummary.percentage}% (${activeSummary.total_naik}/${activeSummary.total})` : "n/a", color: "#7C3AED", icon: AlertCircle },
            ].map((c, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ height: 2, background: c.color }} />
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "var(--text3)", fontWeight: 600, lineHeight: 1.3 }}>{c.label}</span>
                    <c.icon size={14} color={c.color} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: c.color, letterSpacing: "-0.02em" }}>{c.value}</div>
                </div>
              </div>
            ))}
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
  )
}
