"use client"
// PATH: src/app/dashboard/mpp-compare/page.tsx

import { useEffect, useState } from "react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts"
import { supabase } from "@/lib/supabase"

interface RdmCount { empId: string; name: string; active: number; total?: number }
interface SnapshotRow {
  id: string
  snapshot_date: string
  tahun: number
  periode: number
  ficom_lite_active: number
  ficom_lite_total: number
  edi_active_salesman: number
  ficom_lite_by_rdm: RdmCount[]
  edi_by_rdm: RdmCount[]
  synced_at: string
}
interface PeriodRow {
  id: string
  tahun: number
  periode: number
  edi_active_salesman: number
  edi_by_rdm: RdmCount[]
  synced_at: string
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

  useEffect(() => { loadData(); loadPeriodData() }, [])

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

  async function handleSync() {
    setSyncing(true); setSyncMsg("")
    try {
      const res = await fetch("/api/mpp-compare-sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Sync gagal")
      setSyncMsg(`✅ Sync selesai — Ficom Lite Total ${data.ficomLiteTotal}, EDI Hirarki ${data.ediActiveSalesman} salesman (selisih ${data.selisih}) · ${data.houseAccountExcluded || 0} House Account di-exclude`)
      await loadData()
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

  const periodChartData = periodRows.map(r => ({
    label: `${MONTH_ID[r.periode - 1]} ${r.tahun}`,
    edi: r.edi_active_salesman,
  }))
  const latestPeriod = periodRows[periodRows.length - 1] || null

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
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
                  Breakdown {MONTH_ID[latestPeriod.periode - 1]} {latestPeriod.tahun} per RDM
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                  {(latestPeriod.edi_by_rdm || []).map((r, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: "var(--text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>{r.active}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Breakdown per RDM — di-match pakai empId (grsm_id EDI == empId RDM Ficom Lite) */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px", overflowX: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Breakdown</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>Per RDM — Ficom Lite vs EDI Hirarki</div>
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
                  return (
                    <tr key={r.empId} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px" }}>{r.name}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#0369A1" }}>{r.ficomLite}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700 }}>{r.ficomLiteTotal}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#16A34A", fontWeight: 700 }}>{r.edi}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: diff === 0 ? "#16A34A" : "#DC2626", fontWeight: 700 }}>{diff}</td>
                    </tr>
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
        </>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
