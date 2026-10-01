"use client"
// PATH: src/app/dashboard/omzet-phi/page.tsx

import { useEffect, useState } from "react"
import {
  ComposedChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
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
// Data ini Filipina (ADP/EDI PHI), satuannya Peso bukan Rupiah — walau
// kodenya masih nyebut "Rp" di beberapa nama variabel lama, simbol yang
// ditampilkan ke user di sini sudah Peso (₱).
function fmtPeso(n: number): string {
  return "₱" + Math.round(n).toLocaleString("en-PH")
}
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}
// Format ringkas buat label sumbu chart — pilih satuan (rb/jt/M) sesuai
// besar angkanya sendiri, soalnya omset per ADP vs total nasional bisa
// beda jauh ordernya (sebelumnya dipaksa /1 juta semua, jadi kebaca "0jt"
// kalau angkanya di bawah situ).
function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(Math.round(n))
}

// Export CSV — dibuka langsung di Excel (koma pemisah kolom standar,
// dikasih BOM ﻿ di depan biar Excel baca karakter ₱/non-ASCII
// dengan benar, nggak perlu library tambahan).
function toCSV(headers: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(esc).join(","), ...rows.map(r => r.map(esc).join(","))]
  return "﻿" + lines.join("\n")
}
function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
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

  function handleExport() {
    if (!activePeriod) return
    const headers = ["ADP", "Kota", "Wilayah", "RDM", "ADM", "Omset", "Target", "% Achievement"]
    const rowsData = activeRows
      .slice()
      .sort((a, b) => (b.nilai_omset || 0) - (a.nilai_omset || 0))
      .map(r => [
        r.distributor_nm || r.distributor_id,
        r.kota || "",
        masterMap.get(String(r.distributor_id)) || "Lainnya",
        r.grsm_name || "",
        r.rsm_name || "",
        r.nilai_omset || 0,
        r.target_omset || 0,
        r.perc_omset != null ? r.perc_omset : "",
      ])
    downloadCSV(`omzet-phi-${activePeriod}.csv`, toCSV(headers, rowsData))
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
  const selisihOmsetFicomLite = ficomRef ? totalOmsetActive - ficomRef.value : null
  const selisihTargetFicomLite = ficomRef ? totalTargetActive - ficomRef.target : null

  // Pareto nasional (ADP di-sort desc by omset) + garis kumulatif % —
  // dihitung dari periode yang lagi dipilih (dropdown), bukan rata-rata.
  const paretoData = (() => {
    const sorted = [...activeRows].sort((a, b) => (b.nilai_omset || 0) - (a.nilai_omset || 0))
    return sorted.map(r => ({
      name: r.distributor_nm || r.distributor_id,
      omset: r.nilai_omset || 0,
    }))
  })()
  const top10Nasional = paretoData.slice(0, 10)
  // Insight Pareto versi kalimat (bukan grafik) — jumlah ADP teratas yang
  // kumulatif omset-nya udah nembus 80%, ini jauh lebih gampang dipahami
  // daripada baca garis kumulatif di chart (user masih bingung itu garis
  // "kumulatif" dikira "rata-rata").
  const pareto80Count = (() => {
    let cum = 0
    for (let i = 0; i < paretoData.length; i++) {
      cum += paretoData[i].omset
      if (totalOmsetActive > 0 && cum / totalOmsetActive >= 0.8) return i + 1
    }
    return paretoData.length
  })()

  // Breakdown per wilayah — join distributor_id ke master_data_adp.adp_code
  // (dikonfirmasi pola yang sama kayak Data Transfer: dibandingkan sebagai
  // string, adp_code numeric tapi distributor_id di EDI string). "Lainnya"
  // = ADP yang distributor_id-nya TIDAK ketemu di master_data_adp (belum
  // ke-maintain region_name-nya di Master Data) — bukan wilayah asli,
  // melainkan bucket "nggak ke-mapping".
  const masterMap = new Map(master.map(m => [String(m.adp_code), m.region_name]))
  const wilayahBreakdown = (() => {
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
        all: [...list].sort((a, b) => (b.nilai_omset || 0) - (a.nilai_omset || 0)),
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
    const omset = list.reduce((s, r) => s + (r.nilai_omset || 0), 0)
    const target = list.reduce((s, r) => s + (r.target_omset || 0), 0)
    return {
      periodMonth: pm,
      label: monthLabel(pm),
      omset,
      target,
      pct: target > 0 ? (omset / target) * 100 : 0,
      adpCount: list.length,
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
            <button onClick={handleExport} disabled={!activePeriod}
              title="Download data ADP periode yang lagi ditampilkan sebagai CSV (buka langsung di Excel)"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(255,255,255,0.18)", cursor: activePeriod ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              📊 Export Excel
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 8 }}>
            {[
              { label: "Total Omset (EDI)", value: fmtPeso(totalOmsetActive), color: "#16A34A", icon: "💰" },
              { label: "Total Target (EDI)", value: fmtPeso(totalTargetActive), color: "#1E3A5F", icon: "🎯" },
              { label: "% Achievement", value: fmtPct(pctAchievement), color: pctAchievement >= 100 ? "#16A34A" : "#DC2626", icon: pctAchievement >= 100 ? "✅" : "⚠️" },
              {
                label: "Ficom Lite — Omset",
                value: ficomRef ? fmtPeso(ficomRef.value) : "n/a — belum sync",
                color: "#0369A1", icon: "📱",
              },
              {
                label: "Ficom Lite — Target",
                value: ficomRef ? fmtPeso(ficomRef.target) : "n/a — belum sync",
                color: "#0369A1", icon: "📱",
              },
              {
                label: "Selisih Omset (EDI − Ficom Lite)",
                value: ficomRef ? fmtPeso(selisihOmsetFicomLite || 0) : "n/a",
                color: selisihOmsetFicomLite != null && Math.abs(selisihOmsetFicomLite) < 1 ? "#16A34A" : "#DC2626",
                icon: "⚖️",
              },
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
            {ficomRef && (
              <> · selisih target {fmtPeso(selisihTargetFicomLite || 0)}</>
            )}
          </p>
          {ficomRef && (selisihOmsetFicomLite || 0) !== 0 && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#1E3A5F" }}>
              ℹ️ EDI (nilai_omset dari EDI200001) vs Ficom Lite (&quot;Monthly STT&quot;, komponen C12) itu <strong>dua sumber/metrik yang beda</strong> di sistem Ficom — bukan hasil hitung yang sama, jadi selisih sedikit itu wajar (mirip kasus Ficom Lite vs EDI di halaman Compare MPP). Kemungkinan penyebabnya: (1) &quot;STT&quot; mungkin definisinya nggak 100% sama dengan &quot;nilai_omset&quot; (beda kategori transaksi yang dihitung), (2) histori EDI (trik V06) masih belum tervalidasi penuh — meski sudah dicek lebih akurat dari sebelumnya. Kalau selisihnya konsisten kecil (di bawah ~5-10%) tiap bulan, wajar dianggap &quot;cocok&quot;; kalau melebar jauh di bulan tertentu, baru perlu dicurigai ada masalah data.
            </div>
          )}

          {/* Pareto chart nasional — DISEDERHANAKAN: sebelumnya ada garis merah
              "kumulatif %" di sumbu kanan, tapi user tetap bingung ngiranya
              itu "rata-rata" (padahal kumulatif, konsep beda) walau sudah
              dikasih caption penjelasan. Daripada terus dijelasin ulang,
              garisnya dibuang — insight Pareto-nya (berapa ADP nyumbang 80%
              omset) langsung ditulis sebagai kalimat di bawah, jauh lebih
              gampang dipahami daripada baca kurva. Nama ADP di sumbu-X tetap
              disembunyikan (85 ADP ditulis semua numpuk nggak kebaca),
              diganti arahkan kursor ke bar buat lihat nama & angkanya. */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>Omset per ADP — Nasional ({monthLabel(activePeriod)})</h3>
            <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>
              {paretoData.length} ADP, diurut dari omset tertinggi ke terkecil — arahkan kursor ke bar buat lihat nama & angkanya
            </p>
            <p style={{ fontSize: 12, color: "var(--text)", marginBottom: 10, background: "var(--surface2)", borderRadius: 6, padding: "6px 10px", display: "inline-block" }}>
              📌 <strong>{pareto80Count} dari {paretoData.length} ADP teratas</strong> ({fmtPct((pareto80Count / Math.max(paretoData.length, 1)) * 100)} dari semua ADP) udah nyumbang <strong>80%</strong> dari total omset nasional ({fmtPeso(totalOmsetActive)}) — sisanya ({paretoData.length - pareto80Count} ADP) cuma nyumbang 20%.
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={paretoData} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={false} tickLine={false} axisLine={{ stroke: "var(--border)" }} height={10} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtCompact} />
                <Tooltip formatter={(value: number) => [fmtPeso(value), "Omset"]} />
                <Bar dataKey="omset" name="Omset" fill="#16A34A" radius={[2, 2, 0, 0]} />
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
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#16A34A" }}>{fmtPeso(r.omset)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text3)" }}>{fmtPeso(full?.target_omset || 0)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: (full?.perc_omset || 0) >= 100 ? "#16A34A" : "#DC2626" }}>{full?.perc_omset != null ? fmtPct(full.perc_omset) : "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Breakdown per Wilayah — SEMUA ADP (bukan cuma top 3 lagi), tiap
              kartu wilayah scroll sendiri (max-height) biar halaman nggak
              kepanjangan tapi datanya tetap lengkap bisa di-scroll. */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>Breakdown Omset per Wilayah ({monthLabel(activePeriod)})</h3>
            <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 10 }}>
              Semua ADP per wilayah, diurut dari omset tertinggi (scroll di tiap kotak buat lihat semua) · <strong>&quot;Lainnya&quot;</strong> = ADP yang distributor_id-nya belum ke-mapping ke wilayah manapun di Master Data ADP (region_name-nya kosong/nggak ketemu di tabel master_data_adp) — bukan wilayah asli
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
              {wilayahBreakdown.map((w) => (
                <div key={w.wilayah} style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface2)", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)" }}>{w.wilayah}</span>
                    <span style={{ fontSize: 9, color: "var(--text3)" }}>{w.all.length} ADP · {fmtPeso(w.total)}</span>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <tbody>
                        {w.all.map((r, i) => (
                          <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "4px 8px", color: "var(--text3)", width: 18 }}>{i + 1}</td>
                            <td style={{ padding: "4px 8px", color: "var(--text2)" }}>{r.distributor_nm || r.distributor_id}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, color: "#16A34A", whiteSpace: "nowrap" }}>{fmtPeso(r.nilai_omset || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ringkasan Bulanan — semua bulan Jan s/d sekarang dalam 1 layar,
              klik barisnya buat langsung pindah dropdown di banner ke bulan itu. */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Ringkasan Bulanan — Jan s/d {monthLabel(activePeriod)}</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
                  <th style={{ padding: "6px 8px" }}>Bulan</th>
                  <th style={{ padding: "6px 8px" }}>ADP</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Total Omset</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Total Target</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map(t => (
                  <tr key={t.periodMonth} onClick={() => setSelectedPeriod(t.periodMonth)}
                    style={{ borderBottom: "1px solid var(--border)", cursor: "pointer", background: t.periodMonth === activePeriod ? "var(--surface2)" : "transparent" }}>
                    <td style={{ padding: "6px 8px", fontWeight: t.periodMonth === activePeriod ? 800 : 600, color: "var(--text)" }}>{t.label}</td>
                    <td style={{ padding: "6px 8px", color: "var(--text3)" }}>{t.adpCount}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#16A34A" }}>{fmtPeso(t.omset)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text3)" }}>{fmtPeso(t.target)}</td>
                    <td style={{ padding: "6px 8px", textAlign: "right", color: t.pct >= 100 ? "#16A34A" : "#DC2626" }}>{fmtPct(t.pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Trend bulanan */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>Trend Bulanan — Omset vs Target (Jan s/d {monthLabel(activePeriod)})</h3>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trendData} margin={{ top: 4, right: 8, left: -8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={fmtCompact} />
                <Tooltip formatter={(value: number) => fmtPeso(value)} />
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