"use client"
// PATH: src/app/dashboard/mpp-compare/page.tsx

import { useEffect, useState } from "react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts"
import { supabase } from "@/lib/supabase"

interface NameCount { name: string; active: number; total?: number }
interface SnapshotRow {
  id: string
  snapshot_date: string
  tahun: number
  periode: number
  ficom_lite_active: number
  ficom_lite_total: number
  edi_active_salesman: number
  ficom_lite_by_rdm: NameCount[]
  edi_by_nsm: NameCount[]
  synced_at: string
}

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

export default function MppComparePage() {
  const [rows, setRows] = useState<SnapshotRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")

  useEffect(() => { loadData() }, [])

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

  async function handleSync() {
    setSyncing(true); setSyncMsg("")
    try {
      const res = await fetch("/api/mpp-compare-sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Sync gagal")
      setSyncMsg(`✅ Sync selesai — Ficom Lite ${data.ficomLiteActive} aktif, EDI ${data.ediActiveSalesman} salesman aktif (selisih ${data.selisih})`)
      await loadData()
    } catch (e) {
      setSyncMsg("❌ " + (e instanceof Error ? e.message : String(e)))
    }
    setSyncing(false)
  }

  const today = rows[rows.length - 1] || null
  const chartData = rows.map(r => ({
    label: new Date(r.snapshot_date + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short" }),
    ficomLite: r.ficom_lite_active,
    edi: r.edi_active_salesman,
  }))
  const selisih = today ? today.ficom_lite_active - today.edi_active_salesman : 0
  const pctMatch = today && today.ficom_lite_active > 0
    ? Math.round((Math.min(today.ficom_lite_active, today.edi_active_salesman) / Math.max(today.ficom_lite_active, today.edi_active_salesman)) * 100)
    : 0

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
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Ficom Lite (SFA) vs EDI Salesman Aktif — {today ? `periode ${MONTH_ID[today.periode - 1]} ${today.tahun}` : "belum ada data"}</p>
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
              { label: "EDI — Salesman Aktif", value: today.edi_active_salesman, color: "#16A34A", icon: "🧾" },
              { label: "Selisih (Ficom Lite − EDI)", value: selisih, color: selisih === 0 ? "#16A34A" : "#DC2626", icon: selisih === 0 ? "✅" : "⚠️" },
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
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>Ficom Lite Active vs EDI Salesman Aktif</div>
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
                <Area type="monotone" dataKey="ficomLite" stroke="#0369A1" strokeWidth={2} fill="url(#mppFicomLite)" name="Ficom Lite Active" />
                <Area type="monotone" dataKey="edi" stroke="#16A34A" strokeWidth={2} fill="url(#mppEdi)" name="EDI Salesman Aktif" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>Ficom Lite</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 12 }}>Active MPP per RDM</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                {[...today.ficom_lite_by_rdm].sort((a, b) => b.active - a.active).map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0369A1" }}>{r.active}{r.total != null ? ` / ${r.total}` : ""}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 }}>EDI Salesman Aktif</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>Salesman Aktif per NSM</div>
              <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 8 }}>
                Nama level &quot;NSM&quot; (Ficom EDI) belum otomatis di-match ke nama &quot;RDM&quot; (Ficom Lite) — beda sistem, beda label jabatan. Bandingin manual dulu pakai nama orangnya.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 280, overflowY: "auto" }}>
                {today.edi_by_nsm.map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, color: "var(--text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#16A34A" }}>{r.active}</span>
                  </div>
                ))}
              </div>
            </div>
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
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>EDI Aktif</th>
                  <th style={{ textAlign: "right", padding: "6px 8px", color: "var(--text3)", fontWeight: 600 }}>Selisih</th>
                </tr>
              </thead>
              <tbody>
                {[...rows].reverse().map(r => {
                  const diff = r.ficom_lite_active - r.edi_active_salesman
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px" }}>{new Date(r.snapshot_date + "T00:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "#0369A1", fontWeight: 700 }}>{r.ficom_lite_active}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right" }}>{r.ficom_lite_total}</td>
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
