import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Sync "Data Transfer HO" — DIPINDAH dari client-side (browser) ke sini.
// Alasan pindah: browser DISELALU blokir fetch() dari halaman kita yang
// HTTPS ke endpoint HO ini yang HTTP biasa ("mixed content" — aturan
// baku browser, bukan soal firewall/jaringan kantor), makanya tombol
// "Sync dari HO" selalu gagal dengan "Failed to fetch" walau user bisa
// buka 52.163.214.18 langsung di tab baru (navigasi top-level HTTP
// tetap boleh, cuma fetch() dari origin HTTPS yang diblokir). Request
// server-ke-server nggak kena aturan mixed-content itu.
const HO_BASE = "http://52.163.214.18:8081/api/ho/dashboard-subdist"

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

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

    return NextResponse.json({ success: true, rows: dbRows.length, snapshotDate })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isNetworkErr = msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("ENETUNREACH")
    return NextResponse.json({
      error: `Gagal sync dari HO: ${msg}${isNetworkErr ? " — server hosting kemungkinan tidak bisa menjangkau IP HO (52.163.214.18), mungkin di-allowlist cuma buat jaringan kantor" : ""}`,
    }, { status: 500 })
  }
}
