"use client"
// PATH: src/app/dashboard/mpp-compare/page.tsx

import { Fragment, useEffect, useState } from "react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts"
import { supabase } from "@/lib/supabase"

interface RdmCount { empId: string; name: string; active: number; total?: number }
interface AdmCount { empId: string; name: string; active: number; total?: number; rdmId: string; rdmName: string }
interface SalesmanEntry { key: string; slsId: string; distributorId: string; name: string; rdmId: string; rdmName: string }
interface SnapshotRow {
  id: string
  snapshot_date: string
  tahun: number
  periode: number
  ficom_lite_active: number
  ficom_lite_total: number
  edi_active_salesman: number
  ficom_lite_by_rdm: RdmCount[]
  ficom_lite_by_adm: AdmCount[]
  edi_by_rdm: RdmCount[]
  edi_by_adm: AdmCount[]
  edi_salesman_list: SalesmanEntry[]
  synced_at: string
}
interface PeriodRow {
  id: string
  tahun: number
  periode: number
  edi_active_salesman: number
  edi_by_rdm: RdmCount[]
  edi_by_adm: AdmCount[]
  edi_salesman_list: SalesmanEntry[]
  synced_at: string
}
interface ChangeLogEntry {
  id: string
  changed_at: string
  change_type: "added" | "removed"
  sls_id: string
  distributor_id: string | null
  name: string | null
  rdm_id: string | null
  rdm_name: string | null
  prev_total: number | null
  new_total: number | null
}

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

export default function MppComparePage() {
  const [rows, setRows] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")

  const [periodRows, setPeriodRows] = useState<PeriodRow[]>([])
  const [periodSyncing, setPeriodSyncing] = useState(false)
  const [periodSyncMsg, setPeriodSyncMsg] = useState("")

  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([])

  const [expandedRdmDaily, setExpandedRdmDaily] = useState<Set<string>>(new Set())
  const [expandedRdmPeriod, setExpandedRdmPeriod] = useState<Set<string>>(new Set())
  const toggleRdmDaily = (empId: string) => setExpandedRdmDaily(prev => {
    const n = new Set(prev)
    if (n.has(empId)) n.delete(empId); else n.add(empId)
    return n
  })
  const toggleRdmPeriod = (empId: string) => setExpandedRdmPeriod(prev => {
    const n = new Set(prev)
    if (n.has(empId)) n.delete(empId); else n.add(empId)
    return n
  })

  useEffect(() => { loadData(); loadPeriodData(); loadChangeLog() }, [])

  async function loadData() {
    setLoading(true)
    setLoadError("")
    const { data, error } = await supabase
      .from("mpp_compare_snapshot")
      .select("*")
      .order("snapshot_date", { ascending: true })
      .limit(60)
    if (error) setLoadError(error.message)
    else setRows((data || []) as SnapshotRow[])
    setLoading(false)
  }

  async function loadPeriodData() {
    const { data, error } = await supabase
      .from("mpp_period_snapshot")
      .select("*")
      .order("tahun", { ascending: true })
      .order("periode", { ascending: true })
    if (!error) setPeriodRows((data || []) as PeriodRow[])
  }

  async function loadChangeLog() {
    const { data, error } = await supabase
      .from("mpp_salesman_change_log")
      .select("*")
      .order("changed_at", { ascending: false })
      .limit(100)
    if (!error) setChangeLog((data || []) as ChangeLogEntry[])
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg("")
    try {
      const res = await fetch("/api/mpp-compare-sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Sync gagal")
      const changeNote = (data.addedCount || data.removedCount) ? ` · ${data.addedCount || 0} nambah, ${data.removedCount || 0} ilang vs sync sebelumnya` : ""
      setSyncMsg(`✅ Sync selesai — Ficom Lite Total ${data.ficomLiteTotal}, EDI Hirarki ${data.ediActiveSalesman} salesman (selisih ${data.selisih}) · ${data.houseAccountExcluded || 0} House Account di-exclude${changeNote}`)
      await loadData()
      await loadChangeLog()
    } catch (e) {
      setSyncMsg("❌ " + (e instanceof Error ? e.message : String(e)))
    }
    setSyncing(false)
  }

  async function handlePeriodSync() {
    setPeriodSyncing(true); setPeriodSyncMsg("")
    try {
      const res = await fetch("/api/mpp-period-sync", { method: "POST" })
      // 9 bulan ditarik sekuensial ke Ficom bisa makan waktu lumayan lama —
      // kalau request ke-interrupt di tengah jalan (mis. dev server reload),
      // responsnya bisa jadi halaman HTML bukan JSON. Baca sebagai teks dulu
      // baru coba parse, biar errornya jelas (bukan crash parse mentah) —
      // dan bulan yang udah kepross tetap kesimpen di DB (diupsert per bulan
      // di server), jadi tinggal klik lagi buat lanjutin yang belum.
      const text = await res.text()
      let data: { error?: string; periods?: unknown[] }
      try { data = JSON.parse(text) } catch {
        throw new Error(`Respons bukan JSON (kemungkinan koneksi putus di tengah tarik data) — HTTP ${res.status}. Bulan yang sudah berhasil tetap kesimpen, coba klik lagi buat lanjutin.`)
      }
      if (!res.ok) throw new Error(data.error || "Sync gagal")
      setPeriodSyncMsg(`✅ Tarik histori selesai — ${data.periods?.length || 0} bulan ter-update`)
      await loadPeriodData()
    } catch (e) {
      setPeriodSyncMsg("❌ " + (e instanceof Error ? e.message : String(e)))
    }
    setPeriodSyncing(false)
  }

  const today = rows[rows.length - 1] || null
  const chartData = rows.map(r => ({
    label: new Date(r.snapshot_date + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    ficomLite: r.ficom_lite_total,
    edi: r.edi_active_salesman,
  }))
  // Selisih dibandingkan ke Ficom Lite TOTAL (bukan Active) — EDI260001
  // itu daftar mentah seluruh salesman di hirarki (tanpa filter aktivitas),
  // jadi pembandingnya yang apple-to-apple itu "total MPP", bukan "MPP aktif".
  const selisih = today ? today.ficom_lite_total - today.edi_active_salesman : 0
  const pctMatch = today && today.ficom_lite_total > 0
    ? Math.round((Math.min(today.ficom_lite_total, today.edi_active_salesman) / Math.max(today.ficom_lite_total, today.edi_active_salesman)) * 100)
    : 0

  // Gabungin breakdown 2 sumber jadi 1 tabel, di-match pakai empId RDM
  // (grsm_id di EDI260001 == empId RDM di Ficom Lite, dikonfirmasi 1:1 dari
  // capture user) — bukan nama, jadi pasti nyambung walau label jabatan
  // antar sistem beda.
  const mergedRdm = today ? (() => {
    const map = new Map<string, { empId: string; name: string; ficomLite: number; ficomLiteTotal: number; edi: number }>()
    // Guard array kosong — snapshot lama (sebelum kolom edi_by_rdm ada/keisi)
    // bisa nyimpen null, bukan [], dan bikin for...of meledak kalau nggak dijaga.
    for (const r of today.ficom_lite_by_rdm || []) {
      map.set(r.empId, { empId: r.empId, name: r.name, ficomLite: r.active, ficomLiteTotal: r.total ?? 0, edi: 0 })
    }
    for (const r of today.edi_by_rdm || []) {
      const existing = map.get(r.empId)
      if (existing) existing.edi = r.active
      else map.set(r.empId, { empId: r.empId, name: r.name, ficomLite: 0, ficomLiteTotal: 0, edi: r.active })
    }
    return Array.from(map.values()).sort((a, b) => b.ficomLiteTotal - a.ficomLiteTotal)
  })() : []

  // ADM di bawah 1 RDM tertentu (daily) — di-match pakai empId ADM
  // (rsm_id EDI260001 == empId ADM Ficom Lite), sama logic kayak mergedRdm.
  function mergedAdmForRdmDaily(rdmEmpId: string) {
    if (!today) return []
    const map = new Map<string, { empId: string; name: string; ficomLite: number; ficomLiteTotal: number; edi: number }>()
    for (const r of (today.ficom_lite_by_adm || []).filter(a => a.rdmId === rdmEmpId)) {
      map.set(r.empId, { empId: r.empId, name: r.name, ficomLite: r.active, ficomLiteTotal: r.total ?? 0, edi: 0 })
    }
    for (const r of (today.edi_by_adm || []).filter(a => a.rdmId === rdmEmpId)) {
      const existing = map.get(r.empId)
      if (existing) existing.edi = r.active
      else map.set(r.empId, { empId: r.empId, name: r.name, ficomLite: 0, ficomLiteTotal: 0, edi: r.active })
    }
    return Array.from(map.values()).sort((a, b) => b.ficomLiteTotal - a.ficomLiteTotal)
  }

  const periodChartData = periodRows.map(r => ({
    label: `${MONTH_ID[r.periode - 1]} ${r.tahun}`,
    edi: r.edi_active_salesman,
  }))
  const latestPeriod = periodRows[periodRows.length - 1] || null

  // Selisih SIAPA aja (bukan cuma angka) antara salesman aktif di bulan
  // terakhir (EDI240136) vs hirarki HARI INI (EDI260001) — di-match pakai
  // key (sls_id+distributor_id).
  const salesmanDiff = (latestPeriod && today) ? (() => {
    const periodList = latestPeriod.edi_salesman_list || []
    const todayList = today.edi_salesman_list || []
    const todayKeys = new Set(todayList.map(s => s.key))
    const periodKeys = new Set(periodList.map(s => s.key))
    const onlyInPeriod = periodList.filter(s => !todayKeys.has(s.key)).sort((a, b) => a.rdmName.localeCompare(b.rdmName) || a.name.localeCompare(b.name))
    const onlyInHirarki = todayList.filter(s => !periodKeys.has(s.key)).sort((a, b) => a.rdmName.localeCompare(b.rdmName) || a.name.localeCompare(b.name))
    return { onlyInPeriod, onlyInHirarki }
  })() : null

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
      <div style={{ background: "linear-gradient(135deg,#1E3A5F,#0369A1)", borderRadius: 14, padding: "18px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>⚖️</div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 3 }}>Compare MPP</h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Ficom Lite (SFA) vs EDI Hirarki SD-Salesman — {today ? `periode ${MONTH_ID[today.periode - 1]} ${today.tahun}` : "belum ada data"}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={handleSync} disabled={syncing}
              title="Login Ficom & hitung ulang MPP hari ini langsung dari API"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: syncing ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.18)", cursor: syncing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ animation: syncing ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>⚡</span> {syncing ? "Sync..." : "Sync dari Ficom"}
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

      {!today && !loading && (
        <div style={{ textAlign: "center", padding: "48px", background: "var(--surface)", borderRadius: 16, border: "1.5px solid var(--border)" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>⚖️</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Belum ada data</p>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>Klik &quot;Sync dari Ficom&quot; buat narik data pertama kali</p>
        </div>
      )}

      {today && (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[
              { label: "Ficom Lite — Active", value: today.ficom_lite_active, color: "#0369A1", icon: "📱" },
              { label: "Ficom Lite — Total MPP", value: today.ficom_lite_total, color: "#1E3A5F", icon: "📋" },
              { label: "EDI Hirarki — Jumlah Salesman", value: today.edi_active_salesman, color: "#16A34A", icon: "🧾" },
              { label: "Selisih (Ficom Lite Total − EDI)", value: selisih, color: selisih === 0 ? "#16A34A" : "#DC2626", icon: selisih === 0 ? "✅" : "⚠️" },
            ].map((c, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ height: 2, background: c.color }} />
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "var(--text3)", fontWeight: 600, lineHeight: 1.3 }}>{c.label}</span>
                    <span style={{ fontSize: 14 }}>{c.icon}</span>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color, letterSpacing: "-0.03em" }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: "var(--text3)" }}>
            Kecocokan hari ini: <strong style={{ color: "var(--text)" }}>{pctMatch}%</strong> · terakhir sync {new Date(today.synced_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>

          {/* Trend chart */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Trend</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>Ficom Lite Total MPP vs EDI Hirarki</div>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="mppFicomLite" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0369A1" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0369A1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="mppEdi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16A34A" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#16A34A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(chartData.length / 12))} />
                <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                <Area type="monotone" dataKey="ficomLite" stroke="#0369A1" strokeWidth={2} fill="url(#mppFicomLite)" name="Ficom Lite Total" />
                <Area type="monotone" dataKey="edi" stroke="#16A34A" strokeWidth={2} fill="url(#mppEdi)" name="EDI Hirarki" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Trend bulanan — EDI Salesman Aktif (omzet≠0), dari Januari. Beda
              sumber & konsep dari trend harian di atas: ini pakai EDI240136
              yang punya param tahun/periode jadi bisa histori mundur, Ficom
              Lite & EDI260001 (hirarki) TIDAK bisa — makanya cuma garis EDI
              di sini, Ficom Lite cuma ada sebagai garis referensi "hari ini". */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 2 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Trend Bulanan</div>
              <button onClick={handlePeriodSync} disabled={periodSyncing}
                title="Tarik ulang EDI Salesman Aktif (omzet≠0) dari Januari s/d bulan ini"
                style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--border)", background: periodSyncing ? "var(--surface2)" : "var(--surface2)", cursor: periodSyncing ? "not-allowed" : "pointer", fontSize: 10, fontWeight: 700, color: "var(--text)", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ animation: periodSyncing ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>⚡</span> {periodSyncing ? "Menarik histori..." : "Tarik Histori dari Ficom"}
              </button>
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>EDI Salesman Aktif (Omzet ≠ 0) — Januari s/d Sekarang</div>
            <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 12 }}>
              Ficom Lite &amp; EDI Hirarki nggak punya histori (selalu kondisi hari ini) — garis putus-putus di bawah cuma referensi angka Ficom Lite Total HARI INI, bukan trend bulanan beneran.
            </p>
            {periodSyncMsg && (
              <div style={{ background: periodSyncMsg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2", border: `1px solid ${periodSyncMsg.startsWith("✅") ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8, padding: "8px 12px", fontSize: 11, color: periodSyncMsg.startsWith("✅") ? "#166534" : "#991B1B", marginBottom: 10 }}>
                {periodSyncMsg}
              </div>
            )}
            {periodChartData.length === 0 ? (
              <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12 }}>
                Belum ada data — klik &quot;Tarik Histori dari Ficom&quot;
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={periodChartData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} width={32} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                  <Bar dataKey="edi" fill="#16A34A" radius={[4, 4, 0, 0]} name="EDI Salesman Aktif" />
                  {today && (
                    <ReferenceLine y={today.ficom_lite_total} stroke="#0369A1" strokeDasharray="4 4"
                      label={{ value: `Ficom Lite Total hari ini: ${today.ficom_lite_total}`, position: "insideTopRight", fill: "#0369A1", fontSize: 10 }} />
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}

            {latestPeriod && (latestPeriod.edi_by_rdm || []).length > 0 && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                  Breakdown {MONTH_ID[latestPeriod.periode - 1]} {latestPeriod.tahun} per RDM
                </div>
                <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 6 }}>Klik buat lihat sampai ADM.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 260, overflowY: "auto" }}>
                  {(latestPeriod.edi_by_rdm || []).map((r, i) => {
                    const isExpanded = expandedRdmPeriod.has(r.empId)
                    const adms = (latestPeriod.edi_by_adm || []).filter(a => a.rdmId === r.empId)
                    return (
                      <div key={i}>
                        <div onClick={() => toggleRdmPeriod(r.empId)} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "3px 0" }}>
                          <span style={{ display: "inline-block", width: 12, color: "var(--text3)", fontSize: 10, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▸</span>
                          <span style={{ fontSize: 11, color: "var(--text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>{r.active}</span>
                        </div>
                        {isExpanded && adms.map(a => (
                          <div key={a.empId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0 2px 20px" }}>
                            <span style={{ fontSize: 10, color: "var(--text3)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 600, color: "#16A34A" }}>{a.active}</span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Selisih siapa aja — jawab "kenapa angkanya beda jauh" dengan
                nunjukin daftar nama, bukan cuma angka. */}
            {salesmanDiff && (
              <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
                  Selisih {MONTH_ID[latestPeriod!.periode - 1]} {latestPeriod!.tahun} vs Hirarki Hari Ini
                </div>
                <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 10 }}>
                  Di-match pakai kode salesman (sls_id + distributor), bukan nama — biar nggak ketuker orang beda yang namanya mirip.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", marginBottom: 6 }}>
                      ⚠️ Ada di {MONTH_ID[latestPeriod!.periode - 1]}, sudah tidak ada di hirarki sekarang ({salesmanDiff.onlyInPeriod.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                      {salesmanDiff.onlyInPeriod.length === 0 ? (
                        <span style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>Tidak ada</span>
                      ) : salesmanDiff.onlyInPeriod.map(s => (
                        <div key={s.key} style={{ fontSize: 11, padding: "4px 8px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6 }}>
                          <span style={{ color: "#7F1D1D", fontWeight: 600 }}>{s.name || s.slsId}</span>
                          <span style={{ color: "var(--text3)" }}> · {s.rdmName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0369A1", marginBottom: 6 }}>
                      🆕 Ada di hirarki sekarang, tidak tercatat aktif di {MONTH_ID[latestPeriod!.periode - 1]} ({salesmanDiff.onlyInHirarki.length})
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 220, overflowY: "auto" }}>
                      {salesmanDiff.onlyInHirarki.length === 0 ? (
                        <span style={{ fontSize: 11, color: "var(--text3)", fontStyle: "italic" }}>Tidak ada</span>
                      ) : salesmanDiff.onlyInHirarki.map(s => (
                        <div key={s.key} style={{ fontSize: 11, padding: "4px 8px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6 }}>
                          <span style={{ color: "#1E3A5F", fontWeight: 600 }}>{s.name || s.slsId}</span>
                          <span style={{ color: "var(--text3)" }}> · {s.rdmName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Breakdown per RDM — di-match pakai empId (grsm_id EDI == empId RDM Ficom Lite).
              Klik baris buat expand sampai level ADM (rsm_id EDI == empId ADM Ficom Lite). */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", overflowX: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Breakdown</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Per RDM — Ficom Lite vs EDI Hirarki</div>
            <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 12 }}>Klik baris buat lihat breakdown sampai ADM.</p>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: "520px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>RDM</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>Ficom Lite Active</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>Ficom Lite Total</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>EDI Hirarki</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {mergedRdm.map(r => {
                  const diff = r.ficomLiteTotal - r.edi
                  const isExpanded = expandedRdmDaily.has(r.empId)
                  const adms = isExpanded ? mergedAdmForRdmDaily(r.empId) : []
                  return (
                    <Fragment key={r.empId}>
                    <tr onClick={() => toggleRdmDaily(r.empId)} style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                      <td style={{ padding: "6px 8px" }}>
                        <span style={{ display: "inline-block", width: 12, color: "var(--text3)", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▸</span>
                        {" "}{r.name}
                      </td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#0369A1" }}>{r.ficomLite}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{r.ficomLiteTotal}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#16A34A", fontWeight: 700 }}>{r.edi}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: diff === 0 ? "#16A34A" : "#DC2626", fontWeight: 700 }}>{diff}</td>
                    </tr>
                    {isExpanded && adms.map(a => {
                      const adiff = a.ficomLiteTotal - a.edi
                      return (
                        <tr key={a.empId} style={{ borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                          <td style={{ padding: "5px 8px 5px 28px", color: "var(--text2)", fontSize: 11 }}>{a.name}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "#0369A1", fontSize: 11 }}>{a.ficomLite}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 600, fontSize: 11 }}>{a.ficomLiteTotal}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: "#16A34A", fontWeight: 600, fontSize: 11 }}>{a.edi}</td>
                          <td style={{ padding: "5px 8px", textAlign: "right", color: adiff === 0 ? "#16A34A" : "#DC2626", fontWeight: 600, fontSize: 11 }}>{adiff}</td>
                        </tr>
                      )
                    })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Table harian */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", overflowX: "auto" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>Histori Harian</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: "480px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <th style={{ textAlign: "left", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>Tanggal</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>Ficom Lite Active</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>Ficom Lite Total</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>EDI Hirarki</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map(r => {
                  const diff = r.ficom_lite_total - r.edi_active_salesman
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px" }}>{new Date(r.snapshot_date + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#0369A1" }}>{r.ficom_lite_active}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{r.ficom_lite_total}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#16A34A", fontWeight: 700 }}>{r.edi_active_salesman}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: diff === 0 ? "#16A34A" : "#DC2626", fontWeight: 700 }}>{diff}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Log perubahan — dibandingin ke sync SEBELUMNYA (bukan cuma
              per-hari), jadi perubahan DALAM hari yang sama (mis. pagi 985,
              siang 989) ikut kecatat siapa yang nambah/ilang. Cuma kecatat
              kalau sync-nya beneran dijalanin — belum ada cron otomatis. */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", overflowX: "auto" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Log Perubahan Salesman</div>
            <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 12 }}>
              Dicatat tiap kali &quot;Sync dari Ficom&quot; dijalankan, dibandingkan ke sync sebelumnya — belum otomatis sepanjang hari, cuma kecatat pas tombol diklik.
            </p>
            {changeLog.length === 0 ? (
              <div style={{ padding: "12px 0", color: "var(--text3)", fontSize: 12, textAlign: "center" }}>Belum ada perubahan tercatat</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 320, overflowY: "auto" }}>
                {changeLog.map(c => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, padding: "5px 8px", background: c.change_type === "added" ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${c.change_type === "added" ? "#BBF7D0" : "#FECACA"}`, borderRadius: 6 }}>
                    <span style={{ fontWeight: 700, color: c.change_type === "added" ? "#16A34A" : "#DC2626", flexShrink: 0 }}>
                      {c.change_type === "added" ? "➕ Nambah" : "➖ Ilang"}
                    </span>
                    <span style={{ color: "var(--text)", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name || c.sls_id}
                    </span>
                    <span style={{ color: "var(--text3)", flexShrink: 0 }}>{c.rdm_name || ""}</span>
                    <span style={{ color: "var(--text3)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                      {c.prev_total ?? "—"}→{c.new_total ?? "—"}
                    </span>
                    <span style={{ color: "var(--text3)", flexShrink: 0 }}>
                      {new Date(c.changed_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
