"use client"
// PATH: src/app/dashboard/omzet-phi/page.tsx

import { useEffect, useState } from "react"
import {
  ComposedChart, Bar, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { supabase } from "@/lib/supabase"

interface SnapshotRow {
  id: string
  period_month: string // 'YYYY-MM'
  distributor_id: string
  distributor_nm: string | null
  kota: string | null
  rsm_name: string | null  // ADM
  grsm_name: string | null // RDM
  nilai_omset: number | null
  target_omset: number | null
  perc_omset: number | null
  synced_at: string
}
interface MasterRow { adp_code: number; region_name: string }
interface FicomLiteRef { period_month: string; target: number; value: number }

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

function monthLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split("-")
  return `${MONTH_ID[Number(m) - 1]} ${y}`
}
function fmtRp(n: number): string {
  return "Rp " + Math.round(n).toLocaleString("id-ID")
}
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}

export default function OmzetPhiPage() {
  const [rows, setRows] = useState<SnapshotRow[]>([])
  const [master, setMaster] = useState<MasterRow[]>([])
  const [ficomLiteRefs, setFicomLiteRefs] = useState<FicomLiteRef[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState("")

  // Periode yang lagi ditampilkan di Pareto/Top10/Top3 — default ke bulan
  // terakhir, tapi user bisa pilih bulan lain (mis. bulan lalu yang udah
  // full sebulan, bukan bulan berjalan yang baru jalan beberapa hari jadi
  // omset-nya masih kecil/kosong).
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setLoadError("")
    const [snapRes, masterRes, ficomLiteRes] = await Promise.all([
      supabase.from("omzet_phi_snapshot").select("*").order("period_month", { ascending: true }),
      supabase.from("master_data_adp").select("adp_code,region_name"),
      supabase.from("omzet_phi_ficomlite_ref").select("*"),
    ])
    if (snapRes.error) setLoadError(snapRes.error.message)
    else setRows((snapRes.data || []) as SnapshotRow[])
    if (masterRes.data) setMaster(masterRes.data as MasterRow[])
    if (ficomLiteRes.data) setFicomLiteRefs(ficomLiteRes.data as FicomLiteRef[])
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg("")
    try {
      const res = await fetch("/api/omzet-phi-sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Sync gagal")
      const rowsCount = (data.results || []).reduce((s: number, r: { rows: number }) => s + r.rows, 0)
      setSyncMsg(`✅ Sync selesai — ${rowsCount} ADP ter-update untuk periode berjalan`)
      await loadData()
    } catch (e) {
      setSyncMsg("❌ " + (e instanceof Error ? e.message : String(e)))
    }
    setSyncing(false)
  }

  async function handleBackfill() {
    setBackfilling(true); setBackfillMsg("")
    try {
      const res = await fetch("/api/omzet-phi-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backfill: true }),
      })
      // Tarik histori Januari s/d bulan ini sekuensial ke Ficom — bisa makan
      // waktu lama, jadi baca respons sebagai teks dulu baru parse JSON (biar
      // nggak crash kalau dev server sempat balikin HTML di tengah jalan).
      // Bulan yang sudah berhasil tetap kesimpen di DB (diupsert per bulan).
      const text = await res.text()
      let data: { error?: string; results?: { periodMonth: string; rows: number }[] }
      try { data = JSON.parse(text) } catch {
        throw new Error(`Respons bukan JSON (kemungkinan koneksi putus di tengah tarik data) — HTTP ${res.status}. Bulan yang sudah berhasil tetap kesimpen, coba klik lagi buat lanjutin.`)
      }
      if (!res.ok) throw new Error(data.error || "Tarik histori gagal")
      setBackfillMsg(`✅ Tarik histori selesai — ${data.results?.length || 0} bulan ter-update`)
      await loadData()
    } catch (e) {
      setBackfillMsg("❌ " + (e instanceof Error ? e.message : String(e)))
    }
    setBackfilling(false)
  }

  const periods = Array.from(new Set(rows.map(r => r.period_month))).sort()
  const latestPeriod = periods[periods.length - 1] || null
  // Fallback ke bulan terakhir kalau belum pilih apa-apa, atau pilihan lama
  // sudah tidak ada lagi di data (mis. abis refresh).
  const activePeriod = (selectedPeriod && periods.includes(selectedPeriod)) ? selectedPeriod : latestPeriod
  const activeRows = activePeriod ? rows.filter(r => r.period_month === activePeriod) : []

  const totalOmsetActive = activeRows.reduce((s, r) => s + (r.nilai_omset || 0), 0)
  const totalTargetActive = activeRows.reduce((s, r) => s + (r.target_omset || 0), 0)
  const pctAchievement = totalTargetActive > 0 ? (totalOmsetActive / totalTargetActive) * 100 : 0
  const ficomRef = activePeriod ? (ficomLiteRefs.find(f => f.period_month === activePeriod) || null) : null
  const selisihFicomLite = ficomRef ? totalOmsetActive - ficomRef.value : null

  // Pareto nasional (ADP di-sort desc by omset) + garis kumulatif % —
  // dihitung dari periode yang lagi dipilih (dropdown), bukan rata-rata.
  const paretoData = (() => {
    const sorted = [...activeRows].sort((a, b) => (b.nilai_omset || 0) - (a.nilai_omset || 0))
    let cum = 0
    return sorted.map(r => {
      cum += r.nilai_omset || 0
      return {
        name: r.distributor_nm || r.distributor_id,
        omset: r.nilai_omset || 0,
        cumPct: totalOmsetActive > 0 ? Math.round((cum / totalOmsetActive) * 1000) / 10 : 0,
      }
    })
  })()
  const top10Nasional = paretoData.slice(0, 10)

  // Top 3 per wilayah — join distributor_id ke master_data_adp.adp_code
  // (dikonfirmasi pola yang sama kayak Data Transfer: dibandingkan sebagai
  // string, adp_code numeric tapi distributor_id di EDI string).
  const masterMap = new Map(master.map(m => [String(m.adp_code), m.region_name]))
  const top3PerWilayah = (() => {
    const byWilayah = new Map<string, SnapshotRow[]>()
    for (const r of activeRows) {
      const wilayah = masterMap.get(String(r.distributor_id)) || "Lainnya"
      if (!byWilayah.has(wilayah)) byWilayah.set(wilayah, [])
      byWilayah.get(wilayah)!.push(r)
    }
    return Array.from(byWilayah.entries())
      .map(([wilayah, list]) => ({
        wilayah,
        total: list.reduce((s, r) => s + (r.nilai_omset || 0), 0),
        top3: [...list].sort((a, b) => (b.nilai_omset || 0) - (a.nilai_omset || 0)).slice(0, 3),
      }))
      .sort((a, b) => b.total - a.total)
  })()

  // Trend bulanan Jan s/d bulan ini (SELALU semua bulan, terlepas dari
  // dropdown di atas) — PENTING: angka bulan lampau didapat dari V06
  // "Maks Date" diisi tanggal akhir bulan itu, TEKNIK INI BELUM
  // TERVALIDASI. Kalau tiap bulan keliatan SAMA PERSIS (flat), berarti
  // Ficom tidak beneran ngitung ulang berdasarkan V06 historis.
  const trendData = periods.map(pm => {
    const list = rows.filter(r => r.period_month === pm)
    return {
      label: monthLabel(pm),
      omset: list.reduce((s, r) => s + (r.nilai_omset || 0), 0),
      target: list.reduce((s, r) => s + (r.target_omset || 0), 0),
    }
  })

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
      <div style={{ background: "linear-gradient(135deg,#166534,#16A34A)", borderRadius: 14, padding: "18px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>💰</div>
            <div>
              <h1 style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 3 }}>Omzet PHI</h1>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Pareto ADP: omset vs target — {activePeriod ? `periode ${monthLabel(activePeriod)}` : "belum ada data"}</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {periods.length > 0 && (
              <select value={activePeriod || ""} onChange={e => setSelectedPeriod(e.target.value)}
                title="Pilih bulan buat Pareto/Top10/Top3 di bawah"
                style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.12)", cursor: "pointer", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit" }}>
                {periods.slice().reverse().map(pm => (
                  <option key={pm} value={pm} style={{ color: "#111" }}>{monthLabel(pm)}</option>
                ))}
              </select>
            )}
            <button onClick={handleSync} disabled={syncing}
              title="Login Ficom & tarik ulang omset bulan berjalan dari EDI200001"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: syncing ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.18)", cursor: syncing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ animation: syncing ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>⚡</span> {syncing ? "Sync..." : "Sync Hari Ini"}
            </button>
            <button onClick={handleBackfill} disabled={backfilling}
              title="Tarik histori Januari s/d bulan ini dari Ficom (sekuensial, bisa lama)"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: backfilling ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.18)", cursor: backfilling ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ animation: backfilling ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>📜</span> {backfilling ? "Tarik histori..." : "Tarik Histori dari Ficom"}
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
      {backfillMsg && (
        <div style={{ background: backfillMsg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2", border: `1px solid ${backfillMsg.startsWith("✅") ? "#BBF7D0" : "#FECACA"}`, borderRadius: 8, padding: "10px 14px", fontSize: 12, color: backfillMsg.startsWith("✅") ? "#166534" : "#991B1B" }}>
          {backfillMsg}
        </div>
      )}
      {loadError && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B" }}>
          ❌ Gagal memuat data: {loadError}
        </div>
      )}

      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#92400E" }}>
        ⚠️ Data bulan lampau (hasil &quot;Tarik Histori&quot;) didapat dengan trik set tanggal cutoff ke akhir bulan tsb — <strong>belum tervalidasi</strong> apakah Ficom beneran menghitung ulang berdasarkan tanggal itu. Kalau di grafik tren bulanan angkanya terlihat flat/sama persis tiap bulan, kemungkinan histori ini tidak akurat — cek manual dulu.
      </div>

      {!activePeriod && !loading && (
        <div style={{ textAlign: "center", padding: "48px", background: "var(--surface)", borderRadius: 16, border: "1.5px solid var(--border)" }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Belum ada data</p>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>Klik &quot;Sync Hari Ini&quot; buat narik data pertama kali</p>
        </div>
      )}

      {activePeriod && (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
            {[
              { label: "Total Omset (EDI)", value: fmtRp(totalOmsetActive), color: "#16A34A", icon: "💰" },
              { label: "Total Target (EDI)", value: fmtRp(totalTargetActive), color: "#1E3A5F", icon: "🎯" },
              { label: "% Achievement", value: fmtPct(pctAchievement), color: pctAchievement >= 100 ? "#16A34A" : "#DC2626", icon: pctAchievement >= 100 ? "✅" : "⚠️" },
              { label: "Ficom Lite Monthly", value: ficomRef ? `${fmtRp(ficomRef.value)} (selisih ${fmtRp(selisihFicomLite || 0)})` : "n/a", color: "#0369A1", icon: "📱" },
            ].map((c, i) => (
              <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
                <div style={{ height: 2, background: c.color }} />
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: "var(--text3)", fontWeight: 600, lineHeight: 1.3 }}>{c.label}</span>
                    <span style={{ fontSize: 14 }}>{c.icon}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: c.color, letterSpacing: "-0.02em" }}>{c.value}</div>
                </div>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, color: "var(--text3)" }}>
            {activeRows.length} ADP di periode {monthLabel(activePeriod)} · terakhir sync {activeRows[0] ? new Date(activeRows[0].synced_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
          </p>

          {/* Pareto chart nasional */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Pareto Omset per ADP — Nasional ({monthLabel(activePeriod)})</h3>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={paretoData} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" height={70} />
                <YAxis yAxisId="left" tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(value: number, name: string) => name === "cumPct" ? [`${value}%`, "Kumulatif %"] : [fmtRp(value), "Omset"]} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar yAxisId="left" dataKey="omset" name="Omset" fill="#16A34A" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="cumPct" name="Kumulatif %" stroke="#DC2626" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 Nasional */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Top 10 Penyumbang Omset — Nasional ({monthLabel(activePeriod)})</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "6px 8px" }}>#</th>
                  <th style={{ padding: "6px 8px" }}>ADP</th>
                  <th style={{ padding: "6px 8px" }}>RDM</th>
                  <th style={{ padding: "6px 8px" }}>ADM</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Omset</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Target</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {top10Nasional.map((r, i) => {
                  const full = activeRows.find(x => (x.distributor_nm || x.distributor_id) === r.name)
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px", color: "var(--text3)" }}>{i + 1}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: "var(--text)" }}>{r.name}</td>
                      <td style={{ padding: "6px 8px", color: "var(--text3)" }}>{full?.grsm_name || "-"}</td>
                      <td style={{ padding: "6px 8px", color: "var(--text3)" }}>{full?.rsm_name || "-"}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#16A34A" }}>{fmtRp(r.omset)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text3)" }}>{fmtRp(full?.target_omset || 0)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: (full?.perc_omset || 0) >= 100 ? "#16A34A" : "#DC2626" }}>{full?.perc_omset != null ? fmtPct(full.perc_omset) : "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Top 3 per Wilayah */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Top 3 Penyumbang Omset per Wilayah ({monthLabel(activePeriod)})</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
              {top3PerWilayah.map((w) => (
                <div key={w.wilayah} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", background: "var(--surface2)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)" }}>{w.wilayah}</span>
                    <span style={{ fontSize: 10, color: "var(--text3)" }}>{fmtRp(w.total)}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {w.top3.map((r, i) => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                        <span style={{ color: "var(--text2)" }}>{i + 1}. {r.distributor_nm || r.distributor_id}</span>
                        <span style={{ fontWeight: 700, color: "#16A34A" }}>{fmtRp(r.nilai_omset || 0)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Trend bulanan */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Trend Bulanan — Omset vs Target (Jan s/d {monthLabel(activePeriod)})</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
                <Tooltip formatter={(value: number) => fmtRp(value)} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="omset" name="Omset" stroke="#16A34A" fill="#16A34A" fillOpacity={0.15} strokeWidth={2} />
                <Area type="monotone" dataKey="target" name="Target" stroke="#1E3A5F" fill="#1E3A5F" fillOpacity={0.08} strokeWidth={2} strokeDasharray="4 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}
