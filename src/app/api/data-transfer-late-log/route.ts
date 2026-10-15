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
// SETIAP slot (pagi/siang/sore) SEKALIGUS auto-save "Save Snapshot"
// (persis logic handleSave di page.tsx) ke edi_transfer_snapshots +
// edi_transfer_detail — masing-masing slot dapet snapshot SENDIRI
// (created_by beda per slot), jadi riwayat harian lengkap (bukan cuma
// yang telat) tersimpan 3x sehari dan bisa kebandingin progresinya
// dalam 1 hari, bukan cuma status akhir hari. Di-skip kalau snapshot
// buat tanggal+slot itu udah pernah dibuat (hindari dobel kalau
// scheduler ke-trigger 2x).
//
// Contoh panggilan: GET /api/data-transfer-late-log?slot=pagi
const SLOTS = ["pagi", "siang", "sore"] as const
type Slot = typeof SLOTS[number]

const SLOT_LABELS: Record<Slot, string> = { pagi: "trigger pagi 06:00", siang: "trigger siang 12:00", sore: "trigger sore 17:00" }

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

// BUG YANG DIPERBAIKI (ketauan dari kasus serupa di ho-transfer-sync):
// new Date().getFullYear()/getMonth()/getDate() ngikutin timezone PROSES
// server (Vercel = UTC), bukan WIB. Trigger jam 06:00 WIB = 23:00 UTC
// HARI SEBELUMNYA, jadi tanggalnya kehitung mundur 1 hari — bukan cuma
// bikin log_date/snapshot_date salah, tapi baseline (dipakai hitung
// "lama"/telat-nggaknya tiap ADP) ikut salah juga buat SEMUA ADP yang
// diproses trigger pagi. Fix: geser +7 jam (offset WIB) dulu sebelum baca
// tanggal kalendernya via method UTC, biar nggak kepengaruh timezone
// proses server sama sekali.
function todayLocalIso(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-${String(wib.getUTCDate()).padStart(2, "0")}`
}

interface StagingRow { distributor_id: string; distributor_nm: string; tgl_gudang: string; spv: string; grsm: string; release: string }
interface MasterRow { adp_code: number; region_name: string; remarks: string; server: number; server_name: string; depot: string }

async function handle(slotParam: string | null) {
  if (!slotParam || !SLOTS.includes(slotParam as Slot)) {
    return NextResponse.json({ error: `Param "slot" wajib diisi salah satu dari: ${SLOTS.join(", ")}` }, { status: 400 })
  }
  const slot = slotParam as Slot

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const [{ data: staging, error: stagingErr }, { data: master, error: masterErr }, { data: overrides }] = await Promise.all([
    supabase.from("edi_transfer_staging").select("distributor_id,distributor_nm,tgl_gudang,spv,grsm,release"),
    supabase.from("master_data_adp").select("adp_code,region_name,remarks,server,server_name,depot"),
    supabase.from("edi_transfer_overrides").select("distributor_id,excluded"),
  ])
  if (stagingErr) return NextResponse.json({ error: `Gagal ambil staging: ${stagingErr.message}` }, { status: 500 })
  if (masterErr) return NextResponse.json({ error: `Gagal ambil master: ${masterErr.message}` }, { status: 500 })

  // GUARD: kalau staging balik 0 baris, JANGAN lanjut log/snapshot. Ini
  // kejadian nyata — "Tarik dari Ficom" (ficom-edi-sync) nge-truncate
  // edi_transfer_staging dulu baru insert ulang per-chunk (lihat route
  // itu), jadi ada jendela waktu singkat tabelnya kosong total. Kalau
  // trigger pagi/siang/sore kebetulan nembak PAS di jendela itu, bakal
  // kesimpen log 0-telat + snapshot 0 baris yang KELIATAN sukses padahal
  // datanya bukan cerminan hari itu — dan karena snapshot udah ke-insert,
  // dedup existingSnap bikin slot+tanggal itu nggak akan pernah retry.
  // Mending gagal eksplisit di sini (keliatan di cron-job.org, dan belum
  // bikin snapshot) daripada diam-diam nyimpen data kosong permanen.
  if (!staging || staging.length === 0) {
    return NextResponse.json({
      error: "edi_transfer_staging kosong pas trigger ini jalan (kemungkinan lagi ketimpa proses 'Tarik dari Ficom' yang truncate-lalu-isi-ulang) — dilewati, TIDAK nyimpen log/snapshot kosong. Coba trigger ulang manual (GET/POST endpoint ini dengan slot yang sama) setelah pastikan staging udah keisi lagi.",
    }, { status: 503 })
  }

  const masterMap = new Map<string, MasterRow>()
  ;(master as MasterRow[] || []).forEach(m => {
    const key = String(m.adp_code)
    const cur = masterMap.get(key)
    if (!cur || (m.remarks !== "Inactive" && cur.remarks === "Inactive")) masterMap.set(key, m)
  })
  const overrideMap = new Map((overrides || []).map((r: { distributor_id: string; excluded: boolean }) => [r.distributor_id, r.excluded]))

  const baseline = getBaseline(todayLocalIso())
  const dedup = new Map<string, StagingRow>()
  ;(staging as StagingRow[] || []).forEach(r => {
    const key = String(r.distributor_id)
    const cur = dedup.get(key)
    if (!cur || parseTglGudang(r.tgl_gudang) > parseTglGudang(cur.tgl_gudang)) dedup.set(key, r)
  })

  const isExcluded = (distId: string, m: MasterRow | undefined) =>
    overrideMap.has(distId) ? overrideMap.get(distId)! : (m ? m.remarks === "Inactive" : false)

  // ── 1) Log ADP yang telat (selalu jalan tiap slot) ──
  const lateRows: { log_date: string; time_slot: Slot; distributor_id: string; distributor_nm: string; aor: string; tas: string; lama: number }[] = []
  dedup.forEach((row, distId) => {
    const m = masterMap.get(distId)
    if (isExcluded(distId, m)) return
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

  // ── 2) Auto-save snapshot harian lengkap, SEMUA slot (pagi/siang/sore) —
  // masing-masing slot dapet snapshot sendiri (bukan nimpa satu sama
  // lain), jadi bisa kebandingin progresinya dalam 1 hari juga, bukan
  // cuma status akhir hari. Dedup key-nya tanggal+slot, bukan tanggal doang.
  const createdBy = `Auto (trigger ${slot})`
  let snapshotSaved = false
  let snapshotCount = 0
  const { data: existingSnap } = await supabase.from("edi_transfer_snapshots")
    .select("id").eq("snapshot_date", baseline).eq("created_by", createdBy).maybeSingle()

  if (!existingSnap) {
    const { data: snap, error: snapErr } = await supabase.from("edi_transfer_snapshots")
      .insert({ snapshot_date: baseline, note: `Auto snapshot ${baseline} (${SLOT_LABELS[slot]})`, created_by: createdBy })
      .select().single()
    if (snapErr || !snap) return NextResponse.json({ error: `Gagal buat snapshot: ${snapErr?.message}` }, { status: 500 })

    const details: Record<string, unknown>[] = []
    dedup.forEach((row, distId) => {
      const m = masterMap.get(distId)
      if (isExcluded(distId, m)) return
      const tglIso = parseTglGudang(row.tgl_gudang)
      const aor = m?.region_name || ""
      details.push({
        snapshot_id: snap.id, snapshot_date: baseline, distributor_id: distId,
        distributor_nm: row.distributor_nm || distId, tgl_gudang: tglIso,
        lama: calcLama(tglIso, baseline), excluded: false,
        server: m?.server, server_name: m?.server_name, depot: m?.depot,
        aor, tas: TAS_MAP[aor] || "", spv: row.spv, grsm: row.grsm, release: row.release,
      })
    })
    const chunk = 100
    for (let i = 0; i < details.length; i += chunk) {
      const { error: insErr } = await supabase.from("edi_transfer_detail").insert(details.slice(i, i + chunk))
      if (insErr) return NextResponse.json({ error: `Gagal simpan detail snapshot: ${insErr.message}` }, { status: 500 })
    }
    snapshotSaved = true
    snapshotCount = details.length
  }

  return NextResponse.json({
    success: true, slot, logDate: todayLocalIso(), lateCount: lateRows.length,
    snapshotSaved, snapshotCount,
  })
}

// Pembungkus try/catch PALING LUAR — sebelumnya nggak ada, jadi kalau ada
// exception yang nggak ketangkep (mis. Supabase network-level error yang
// nge-throw bukan balikin {error}, bukan Postgrest-level error biasa),
// Vercel balikin halaman 500 generik POLOS tanpa body JSON — bikin
// scheduler (cron-job.org) nggak bisa nunjukin pesan error aslinya sama
// sekali (cuma "500 Internal Server Error", RAW RESPONSE-nya kosong).
// Sekarang APAPUN yang gagal di handle(), selalu balik JSON {error:...}
// yang jelas, biar ketauan penyebab pastinya dari RAW RESPONSE.
async function safeHandle(slotParam: string | null) {
  try {
    return await handle(slotParam)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Error tak terduga (nggak ketangkep try/catch biasa): ${msg}` }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return safeHandle(req.nextUrl.searchParams.get("slot"))
}
export async function POST(req: NextRequest) {
  return safeHandle(req.nextUrl.searchParams.get("slot"))
}
