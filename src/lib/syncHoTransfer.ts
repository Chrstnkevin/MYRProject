import { SupabaseClient } from "@supabase/supabase-js"

// Logic sync "Data Transfer HO" — diekstrak dari api/ho-transfer-sync/route.ts
// biar bisa dipanggil bareng dari 2 tempat: (1) tombol "Sync dari HO" manual
// di halaman ho-transfer (lewat route itu sendiri), dan (2) endpoint
// data-transfer-late-log, biar scheduler eksternal cuma perlu 3 cron job
// (pagi/siang/sore) buat SEMUA sync — EDI Web Ficom + HO sekaligus — bukan
// 6 job terpisah.
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

// Tanggal kalender WIB — DIHITUNG EKSPLISIT (geser +7 jam lalu baca lewat
// method UTC), BUKAN new Date().getDate() dkk yang ngikutin timezone
// proses server (Vercel = UTC). Bug ini sebelumnya bikin trigger jam
// 06:00 WIB (=23:00 UTC hari sebelumnya) ke-upsert nimpa tanggal kemarin.
function todayIsoWIB(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-${String(wib.getUTCDate()).padStart(2, "0")}`
}

export interface HoSyncResult { success: true; rows: number; snapshotDate: string }
export interface HoSyncError { success: false; error: string }

export async function runHoTransferSync(supabase: SupabaseClient): Promise<HoSyncResult | HoSyncError> {
  try {
    const [listRes, pctRes] = await Promise.all([
      fetch(`${HO_BASE}/next-date-phi/OmsetDif`),
      fetch(`${HO_BASE}/percentage`),
    ])
    if (!listRes.ok) throw new Error(`Gagal ambil data subdist (HTTP ${listRes.status})`)
    if (!pctRes.ok) throw new Error(`Gagal ambil ringkasan persentase (HTTP ${pctRes.status})`)
    const list = await listRes.json() as HoApiRow[]
    const pct = await pctRes.json() as HoApiPercentage

    const snapshotDate = todayIsoWIB()
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

    return { success: true, rows: dbRows.length, snapshotDate }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isNetworkErr = msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("ETIMEDOUT") || msg.includes("ENETUNREACH")
    return {
      success: false,
      error: `Gagal sync dari HO: ${msg}${isNetworkErr ? " — server hosting kemungkinan tidak bisa menjangkau IP HO (52.163.214.18), mungkin di-allowlist cuma buat jaringan kantor" : ""}`,
    }
  }
}
