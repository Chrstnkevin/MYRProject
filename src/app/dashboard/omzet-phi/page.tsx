"use client"
// PATH: src/app/dashboard/omzet-phi/page.tsx

import { useEffect, useState } from "react"
import {
  ComposedChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts"
import { supabase } from "@/lib/supabase"

// REWRITE TOTAL (Okt 2026) — sebelumnya pakai EDI200001 per-ADP/distributor,
// sekarang pakai endpoint "Main" Ficom detilChange (SD -> RDM -> ADS ->
// Salesman) atas permintaan user, karena EDI200001 butuh trik tanggal yang
// nggak pernah tervalidasi + sempat ada bug dedupe. detilChange nggak expose
// kode ADP sama sekali, jadi level "ADS" dipakai sbg proxy "ADP" di Pareto
// (kesepakatan user). Wilayah diturunkan langsung dari nama RDM (sub-AOR),
// bukan join ke master_data_adp lagi — lihat komentar di route.ts sync.
interface AdsRow {
  id: string
  period_month: string // 'YYYY-MM'
  emp_id: string
  emp_name: string
  rdm_emp_id: string | null
  rdm_name: string | null
  sub_aor: string | null
  wilayah: string | null
  target: number | null
  nilai: number | null
  persen: number | null
  period_date: string | null
  synced_at: string
}
interface FicomLiteRef { period_month: string; target: number; value: number }

const MONTH_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

function monthLabel(periodMonth: string): string {
  const [y, m] = periodMonth.split("-")
  return `${MONTH_ID[Number(m) - 1]} ${y}`
}
// Data ini Filipina (ADP/EDI PHI), satuannya Peso bukan Rupiah.
function fmtPeso(n: number): string {
  return "₱" + Math.round(n).toLocaleString("en-PH")
}
function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`
}
// Format ringkas buat label sumbu chart — pilih satuan (rb/jt/M) sesuai
// besar angkanya sendiri.
function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(Math.round(n))
}

// Export CSV — dibuka langsung di Excel (BOM di depan biar Excel baca ₱
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
  const [rows, setRows] = useState<AdsRow[]>([])
  const [ficomLiteRefs, setFicomLiteRefs] = useState<FicomLiteRef[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")
  const [backfilling, setBackfilling] = useState(false)
  const [resyncingMonth, setResyncingMonth] = useState<string | null>(null)
  const [backfillMsg, setBackfillMsg] = useState("")

  // Periode yang lagi ditampilkan di Pareto/Top10/Top3 — default ke bulan
  // terakhir, tapi user bisa pilih bulan lain (mis. bulan lalu yang udah
  // full sebulan, bukan bulan berjalan yang baru jalan beberapa hari).
  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    setLoadError("")
    const [snapRes, ficomLiteRes] = await Promise.all([
      supabase.from("omzet_phi_snapshot").select("*").order("period_month", { ascending: true }),
      supabase.from("omzet_phi_ficomlite_ref").select("*"),
    ])
    if (snapRes.error) setLoadError(snapRes.error.message)
    else setRows((snapRes.data || []) as AdsRow[])
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
      setSyncMsg(`✅ Sync selesai — ${rowsCount} ADS ter-update untuk periode berjalan`)
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
      // Tarik histori Januari s/d bulan ini sekuensial antar-bulan — tiap
      // bulan sendiri nge-crawl SD->RDM->ADS->Salesman (puluhan-ratusan
      // request ke Ficom), jadi backfill bisa makan waktu CUKUP LAMA.
      // Baca respons sbg teks dulu baru parse JSON biar nggak crash kalau
      // dev server sempat balikin HTML di tengah jalan. Bulan yang sudah
      // berhasil tetap kesimpen (diupsert per bulan di server).
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

  // Sync ulang SATU bulan tertentu — dipakai tombol kecil di tabel
  // Ringkasan Bulanan, buat kasus kayak Sep yang sebagian wilayahnya
  // ilang pas backfill panjang (retry 1 bulan doang, nggak perlu ulang
  // backfill 10 bulan).
  async function handleResyncMonth(periodMonth: string) {
    setResyncingMonth(periodMonth); setBackfillMsg("")
    try {
      const res = await fetch("/api/omzet-phi-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: periodMonth }),
      })
      const text = await res.text()
      let data: { error?: string; results?: { periodMonth: string; rows: number }[] }
      try { data = JSON.parse(text) } catch {
        throw new Error(`Respons bukan JSON — HTTP ${res.status}. Coba klik lagi.`)
      }
      if (!res.ok) throw new Error(data.error || "Sync ulang gagal")
      const rowsCount = data.results?.[0]?.rows ?? 0
      setBackfillMsg(`✅ ${monthLabel(periodMonth)} di-sync ulang — ${rowsCount} ADS`)
      await loadData()
    } catch (e) {
      setBackfillMsg(`❌ Gagal sync ulang ${monthLabel(periodMonth)} — ` + (e instanceof Error ? e.message : String(e)))
    }
    setResyncingMonth(null)
  }

  function handleExport() {
    if (!activePeriod) return
    const headers = ["ADS", "RDM", "Wilayah", "Omset", "Target", "% Achievement"]
    const rowsData = activeRows
      .slice()
      .sort((a, b) => (b.nilai || 0) - (a.nilai || 0))
      .map(r => [
        r.emp_name,
        r.rdm_name || "",
        r.wilayah || "",
        r.nilai || 0,
        r.target || 0,
        r.persen != null ? r.persen : "",
      ])
    downloadCSV(`omzet-phi-${activePeriod}.csv`, toCSV(headers, rowsData))
  }

  const periods = Array.from(new Set(rows.map(r => r.period_month))).sort()
  const latestPeriod = periods[periods.length - 1] || null
  // Fallback ke bulan terakhir kalau belum pilih apa-apa, atau pilihan lama
  // sudah tidak ada lagi di data (mis. abis refresh).
  const activePeriod = (selectedPeriod && periods.includes(selectedPeriod)) ? selectedPeriod : latestPeriod
  const activeRows = activePeriod ? rows.filter(r => r.period_month === activePeriod) : []

  const totalOmsetActive = activeRows.reduce((s, r) => s + (r.nilai || 0), 0)
  const totalTargetActive = activeRows.reduce((s, r) => s + (r.target || 0), 0)
  const pctAchievement = totalTargetActive > 0 ? (totalOmsetActive / totalTargetActive) * 100 : 0
  const ficomRef = activePeriod ? (ficomLiteRefs.find(f => f.period_month === activePeriod) || null) : null
  const selisihOmsetFicomLite = ficomRef ? totalOmsetActive - ficomRef.value : null
  const selisihTargetFicomLite = ficomRef ? totalTargetActive - ficomRef.target : null

  // Pareto nasional (ADS di-sort desc by omset) — dihitung dari periode
  // yang lagi dipilih (dropdown), bukan rata-rata.
  const paretoData = (() => {
    const sorted = [...activeRows].sort((a, b) => (b.nilai || 0) - (a.nilai || 0))
    return sorted.map(r => ({ name: r.emp_name, omset: r.nilai || 0 }))
  })()
  const top10Nasional = paretoData.slice(0, 10)
  // Insight Pareto versi kalimat — jumlah ADS teratas yang kumulatif
  // omset-nya udah nembus 80%, lebih gampang dipahami daripada kurva
  // kumulatif (user sempat ngira garis kumulatif itu "rata-rata").
  const pareto80Count = (() => {
    let cum = 0
    for (let i = 0; i < paretoData.length; i++) {
      cum += paretoData[i].omset
      if (totalOmsetActive > 0 && cum / totalOmsetActive >= 0.8) return i + 1
    }
    return paretoData.length
  })()

  // Breakdown per wilayah — wilayah SEKARANG LANGSUNG dari kolom `wilayah`
  // (turunan nama RDM via sync, lihat route.ts), BUKAN join ke
  // master_data_adp lagi. Jadi nggak ada lagi bucket "Lainnya" yang
  // kehilangan ADP yang belum ke-maintain di Master Data.
  const wilayahBreakdown = (() => {
    const byWilayah = new Map<string, AdsRow[]>()
    for (const r of activeRows) {
      const wilayah = r.wilayah || "Lainnya"
      if (!byWilayah.has(wilayah)) byWilayah.set(wilayah, [])
      byWilayah.get(wilayah)!.push(r)
    }
    return Array.from(byWilayah.entries())
      .map(([wilayah, list]) => ({
        wilayah,
        total: list.reduce((s, r) => s + (r.nilai || 0), 0),
        all: [...list].sort((a, b) => (b.nilai || 0) - (a.nilai || 0)),
      }))
      .sort((a, b) => b.total - a.total)
  })()

  // Trend bulanan Jan s/d bulan ini (SELALU semua bulan, terlepas dari
  // dropdown di atas).
  const trendData = periods.map(pm => {
    const list = rows.filter(r => r.period_month === pm)
    const omset = list.reduce((s, r) => s + (r.nilai || 0), 0)
    const target = list.reduce((s, r) => s + (r.target || 0), 0)
    return {
      periodMonth: pm,
      label: monthLabel(pm),
      omset,
      target,
      pct: target > 0 ? (omset / target) * 100 : 0,
      adsCount: list.length,
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
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Pareto ADS: omset vs target — {activePeriod ? `periode ${monthLabel(activePeriod)}` : "belum ada data"}</p>
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
              title="Login Ficom & tarik ulang omset bulan berjalan dari detilChange"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: syncing ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.18)", cursor: syncing ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ animation: syncing ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>⚡</span> {syncing ? "Sync..." : "Sync Hari Ini"}
            </button>
            <button onClick={handleBackfill} disabled={backfilling}
              title="Tarik histori Januari s/d bulan ini dari Ficom (sekuensial, BISA CUKUP LAMA — tiap bulan crawl seluruh hirarki RDM/ADS)"
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.25)", background: backfilling ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.18)", cursor: backfilling ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ animation: backfilling ? "spin 0.8s linear infinite" : "none", display: "inline-block" }}>📜</span> {backfilling ? "Tarik histori..." : "Tarik Histori dari Ficom"}
            </button>
            <button onClick={handleExport} disabled={!activePeriod}
              title="Download data ADS periode yang lagi ditampilkan sebagai CSV (buka langsung di Excel)"
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

      <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#1E3A5F" }}>
        ℹ️ Data ini sekarang dari endpoint &quot;Main&quot; Ficom (<code>detilChange</code>, sama yang dipakai Target Compare) dengan parameter tanggal (<code>updDate</code>) yang genuinely didukung Ficom buat histori — bukan trik lagi seperti sebelumnya. Breakdown &quot;ADP&quot; di halaman ini sebenarnya level <strong>ADS</strong> (proxy terdekat buat per-ADP, karena detilChange nggak expose kode ADP sama sekali, cuma sampai Salesman).
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
              { label: "Total Omset (Ficom Main)", value: fmtPeso(totalOmsetActive), color: "#16A34A", icon: "💰" },
              { label: "Total Target (Ficom Main)", value: fmtPeso(totalTargetActive), color: "#1E3A5F", icon: "🎯" },
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
                label: "Selisih Omset (Main − Ficom Lite)",
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
            {activeRows.length} ADS di periode {monthLabel(activePeriod)} · terakhir sync {activeRows[0] ? new Date(activeRows[0].synced_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
            {ficomRef && (
              <> · selisih target {fmtPeso(selisihTargetFicomLite || 0)}</>
            )}
          </p>
          {ficomRef && (selisihOmsetFicomLite || 0) !== 0 && (
            <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#1E3A5F" }}>
              ℹ️ Total Omset (Ficom Main/detilChange) vs Ficom Lite (&quot;Monthly STT&quot;, komponen C12) itu <strong>dua sumber/metrik yang beda</strong> di sistem Ficom — bukan hasil hitung yang sama persis, jadi selisih sedikit itu wajar (mirip kasus Ficom Lite vs EDI di halaman Compare MPP). Kalau selisihnya konsisten kecil (di bawah ~5-10%) tiap bulan, wajar dianggap &quot;cocok&quot;; kalau melebar jauh di bulan tertentu, baru perlu dicurigai ada masalah data.
            </div>
          )}

          {/* Pareto chart nasional — tanpa garis kumulatif (user sempat ngira
              itu "rata-rata"), insight 80% ditulis sebagai kalimat. Nama ADS
              di sumbu-X disembunyikan kalau banyak, arahkan kursor ke bar. */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>Omset per ADS — Nasional ({monthLabel(activePeriod)})</h3>
            <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 4 }}>
              {paretoData.length} ADS, diurut dari omset tertinggi ke terkecil — arahkan kursor ke bar buat lihat nama & angkanya
            </p>
            <p style={{ fontSize: 12, color: "var(--text)", marginBottom: 10, background: "var(--surface2)", borderRadius: 6, padding: "6px 10px", display: "inline-block" }}>
              📌 <strong>{pareto80Count} dari {paretoData.length} ADS teratas</strong> ({fmtPct((pareto80Count / Math.max(paretoData.length, 1)) * 100)} dari semua ADS) udah nyumbang <strong>80%</strong> dari total omset nasional ({fmtPeso(totalOmsetActive)}) — sisanya ({paretoData.length - pareto80Count} ADS) cuma nyumbang 20%.
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
                  <th style={{ padding: "6px 8px" }}>ADS</th>
                  <th style={{ padding: "6px 8px" }}>RDM</th>
                  <th style={{ padding: "6px 8px" }}>Wilayah</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Omset</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Target</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {top10Nasional.map((r, i) => {
                  const full = activeRows.find(x => x.emp_name === r.name)
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "6px 8px", color: "var(--text3)" }}>{i + 1}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: "var(--text)" }}>{r.name}</td>
                      <td style={{ padding: "6px 8px", color: "var(--text3)" }}>{full?.rdm_name || "-"}</td>
                      <td style={{ padding: "6px 8px", color: "var(--text3)" }}>{full?.wilayah || "-"}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#16A34A" }}>{fmtPeso(r.omset)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text3)" }}>{fmtPeso(full?.target || 0)}</td>
                      <td style={{ padding: "6px 8px", textAlign: "right", color: (full?.persen || 0) >= 100 ? "#16A34A" : "#DC2626" }}>{full?.persen != null ? fmtPct(full.persen) : "-"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Breakdown per Wilayah — SEMUA ADS (bukan cuma top 3), tiap kartu
              wilayah scroll sendiri. Wilayah native dari Ficom (sub-AOR RDM),
              nggak ada lagi bucket "Lainnya" karena nggak join master_data_adp. */}
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>Breakdown Omset per Wilayah ({monthLabel(activePeriod)})</h3>
            <p style={{ fontSize: 10, color: "var(--text3)", marginBottom: 10 }}>
              Semua ADS per wilayah, diurut dari omset tertinggi (scroll di tiap kotak buat lihat semua) — wilayah diturunkan langsung dari kode sub-AOR RDM di Ficom
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
              {wilayahBreakdown.map((w) => (
                <div key={w.wilayah} style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--surface2)", overflow: "hidden" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)" }}>{w.wilayah}</span>
                    <span style={{ fontSize: 9, color: "var(--text3)" }}>{w.all.length} ADS · {fmtPeso(w.total)}</span>
                  </div>
                  <div style={{ maxHeight: 220, overflowY: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
                      <tbody>
                        {w.all.map((r, i) => (
                          <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "4px 8px", color: "var(--text3)", width: 18 }}>{i + 1}</td>
                            <td style={{ padding: "4px 8px", color: "var(--text2)" }}>{r.emp_name}</td>
                            <td style={{ padding: "4px 8px", textAlign: "right", fontWeight: 700, color: "#16A34A", whiteSpace: "nowrap" }}>{fmtPeso(r.nilai || 0)}</td>
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
                  <th style={{ padding: "6px 8px" }}>ADS</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Total Omset</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>Total Target</th>
                  <th style={{ padding: "6px 8px", textAlign: "right" }}>%</th>
                  <th style={{ padding: "6px 8px" }}></th>
                </tr>
              </thead>
              <tbody>
                {trendData.map(t => (
                  <tr key={t.periodMonth}
                    style={{ borderBottom: "1px solid var(--border)", background: t.periodMonth === activePeriod ? "var(--surface2)" : "transparent" }}>
                    <td onClick={() => setSelectedPeriod(t.periodMonth)} style={{ padding: "6px 8px", fontWeight: t.periodMonth === activePeriod ? 800 : 600, color: "var(--text)", cursor: "pointer" }}>{t.label}</td>
                    <td onClick={() => setSelectedPeriod(t.periodMonth)} style={{ padding: "6px 8px", color: "var(--text3)", cursor: "pointer" }}>{t.adsCount}</td>
                    <td onClick={() => setSelectedPeriod(t.periodMonth)} style={{ padding: "6px 8px", textAlign: "right", fontWeight: 700, color: "#16A34A", cursor: "pointer" }}>{fmtPeso(t.omset)}</td>
                    <td onClick={() => setSelectedPeriod(t.periodMonth)} style={{ padding: "6px 8px", textAlign: "right", color: "var(--text3)", cursor: "pointer" }}>{fmtPeso(t.target)}</td>
                    <td onClick={() => setSelectedPeriod(t.periodMonth)} style={{ padding: "6px 8px", textAlign: "right", color: t.pct >= 100 ? "#16A34A" : "#DC2626", cursor: "pointer" }}>{fmtPct(t.pct)}</td>
                    <td style={{ padding: "6px 8px" }}>
                      <button onClick={e => { e.stopPropagation(); handleResyncMonth(t.periodMonth) }} disabled={resyncingMonth === t.periodMonth}
                        title="Sync ulang bulan ini aja dari Ficom (buat kasus ada wilayah/ADS yang keliatan ilang/janggal)"
                        style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: 10, fontWeight: 700, cursor: resyncingMonth === t.periodMonth ? "not-allowed" : "pointer" }}>
                        {resyncingMonth === t.periodMonth ? "..." : "🔄 Sync ulang"}
                      </button>
                    </td>
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
