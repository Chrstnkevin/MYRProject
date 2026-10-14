import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Dipanggil scheduler EKSTERNAL (cron-job.org/dsb — bukan Vercel Cron
// bawaan, nggak ada vercel.json di project ini) 3x sehari: 06:00 (pagi),
// 12:00 (siang), 17:00 (sore). Tiap panggilan, hitung ulang ADP mana
// yang "telat" persis sama logic di data-transfer/page.tsx (dedup
// staging per distributor_id ambil tgl_gudang terbaru, exclude kalau
// di-override/remarks="Inactive", baseline default h-1/h-3 Senin/h-2
// Minggu), lalu simpen 1 baris per ADP telat ke data_transfer_late_log.
//
// Contoh panggilan: GET /api/data-transfer-late-log?slot=pagi
const SLOTS = ["pagi", "siang", "sore"] as const
type Slot = typeof SLOTS[number]

function parseTglGudang(raw: string | null | undefined): string {
  if (!raw) return ""
  const s = String(raw)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  }
  const parts = s.trim().toUpperCase().split(/\s+/)
  if (parts.length === 3) {
    const [d, m, y] = parts
    return `${y}-${months[m] || "01"}-${d.padStart(2, "0")}`
  }
  return ""
}

function getBaseline(fromDateISO: string): string {
  const d = new Date(fromDateISO)
  const day = d.getDay()
  const sub = day === 1 ? 3 : day === 0 ? 2 : 1
  d.setDate(d.getDate() - sub)
  return d.toISOString().slice(0, 10)
}

function calcLama(tglISO: string, baselineISO: string): number {
  if (!tglISO || !baselineISO) return 99
  const t = new Date(tglISO + "T12:00:00").setHours(0, 0, 0, 0)
  const b = new Date(baselineISO + "T12:00:00").setHours(0, 0, 0, 0)
  return Math.round((b - t) / 86400000)
}

const TAS_MAP: Record<string, string> = { GMA: "JC", NOL: "Van", SOL: "Jonathan", VIS: "Darren", MIN: "JC" }

function todayLocalIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

async function handle(slotParam: string | null) {
  if (!slotParam || !SLOTS.includes(slotParam as Slot)) {
    return NextResponse.json({ error: `Param "slot" wajib diisi salah satu dari: ${SLOTS.join(", ")}` }, { status: 400 })
  }
  const slot = slotParam as Slot

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const [{ data: staging, error: stagingErr }, { data: master, error: masterErr }, { data: overrides }] = await Promise.all([
    supabase.from("edi_transfer_staging").select("distributor_id,distributor_nm,tgl_gudang"),
    supabase.from("master_data_adp").select("adp_code,region_name,remarks"),
    supabase.from("edi_transfer_overrides").select("distributor_id,excluded"),
  ])
  if (stagingErr) return NextResponse.json({ error: `Gagal ambil staging: ${stagingErr.message}` }, { status: 500 })
  if (masterErr) return NextResponse.json({ error: `Gagal ambil master: ${masterErr.message}` }, { status: 500 })

  const masterMap = new Map<string, { region_name: string; remarks: string }>()
  ;(master || []).forEach((m: { adp_code: number; region_name: string; remarks: string }) => {
    const key = String(m.adp_code)
    const cur = masterMap.get(key)
    if (!cur || (m.remarks !== "Inactive" && cur.remarks === "Inactive")) masterMap.set(key, m)
  })
  const overrideMap = new Map((overrides || []).map((r: { distributor_id: string; excluded: boolean }) => [r.distributor_id, r.excluded]))

  const baseline = getBaseline(todayLocalIso())
  const dedup = new Map<string, { distributor_nm: string; tgl_gudang: string }>()
  ;(staging || []).forEach((r: { distributor_id: string; distributor_nm: string; tgl_gudang: string }) => {
    const key = String(r.distributor_id)
    const cur = dedup.get(key)
    if (!cur || parseTglGudang(r.tgl_gudang) > parseTglGudang(cur.tgl_gudang)) dedup.set(key, r)
  })

  const lateRows: { log_date: string; time_slot: Slot; distributor_id: string; distributor_nm: string; aor: string; tas: string; lama: number }[] = []
  dedup.forEach((row, distId) => {
    const m = masterMap.get(distId)
    const excluded = overrideMap.has(distId) ? overrideMap.get(distId)! : (m ? m.remarks === "Inactive" : false)
    if (excluded) return
    const lama = calcLama(parseTglGudang(row.tgl_gudang), baseline)
    if (lama <= 0) return
    const aor = m?.region_name || ""
    lateRows.push({
      log_date: todayLocalIso(), time_slot: slot, distributor_id: distId,
      distributor_nm: row.distributor_nm || distId, aor, tas: TAS_MAP[aor] || "", lama,
    })
  })

  if (lateRows.length > 0) {
    const { error: upErr } = await supabase.from("data_transfer_late_log").upsert(lateRows, { onConflict: "log_date,time_slot,distributor_id" })
    if (upErr) return NextResponse.json({ error: `Gagal simpan log: ${upErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ success: true, slot, logDate: todayLocalIso(), lateCount: lateRows.length })
}

export async function GET(req: NextRequest) {
  return handle(req.nextUrl.searchParams.get("slot"))
}
export async function POST(req: NextRequest) {
  return handle(req.nextUrl.searchParams.get("slot"))
}
