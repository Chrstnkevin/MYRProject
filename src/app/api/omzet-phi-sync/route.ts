import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Sync "Omzet PHI" — tarik nilai_omset/target_omset per ADP (distributor)
// dari Ficom EDI200001 "EDI OMSET DASHBOARD". BEDA dari ficom-edi-sync.ts
// (yang nyimpen ke edi_transfer_staging, cuma dipakai buat tgl_gudang/
// hka_hke/release di halaman Data Transfer) — field nilai_omset/
// target_omset itu TERNYATA sudah ada di response EDI ini juga, cuma
// belum pernah disimpan/dipakai sebelumnya (dikonfirmasi dari capture
// user langsung). Jadi sync ini pakai EDI yang SAMA tapi nyimpen semua
// field (termasuk cbcover/hhtkpl/hht/ipt/sbpt/ec_std_mtd) ke tabel
// terpisah (omzet_phi_snapshot), per bulan.
//
// Field spv/rsm/grsm/nsm/sd itu formatnya "WFCODE-Nama" 1 string gabungan
// — di-split code/name di sini. Pemetaan level (pola sama kayak
// EDI260001/EDI240136 yang sudah dikonfirmasi): spv=ADS, rsm=ADM,
// grsm=RDM, nsm=SD (scope akun posisi "SD" kita), sd=akar perusahaan
// (WF7001, di ATAS level SD kita — BUKAN scope kita).
//
// PENTING soal histori bulan lalu: param V06 "Maks Date" itu awalnya cuma
// dipakai buat TANGGAL HARI INI (lihat ficom-edi-sync.ts, todayMaksDate()).
// Di sini saya COBA isi V06 pakai tanggal AKHIR BULAN lalu (mis. "31 JAN
// 2026") buat dapet angka omset MTD per akhir bulan itu — TAPI INI BELUM
// TERVALIDASI apakah Ficom beneran ngitung ulang berdasarkan tanggal itu,
// atau diam-diam selalu balikin data HARI INI apapun V06-nya. Cek manual
// dulu di halaman: kalau angka tiap bulan keliatan SAMA PERSIS (flat),
// berarti V06 historis nggak kepake beneran.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI200001"
const SD_CODE_TOP = "WF7001" // sama kode yang dipakai ficom-edi-sync.ts

interface EdiParam { var: string; label: string; placeholder: string; maxLength: number }
interface EdiTemplate { ediId: string; ediNm: string; query: string; params: EdiParam[] }

function splitCodeName(s: string | undefined): { code: string; name: string } {
  const v = (s || "").trim()
  const idx = v.indexOf("-")
  if (idx === -1) return { code: v, name: v }
  return { code: v.slice(0, idx).trim(), name: v.slice(idx + 1).trim() }
}

function num(v: string | undefined): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

async function ficomLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${FICOM_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`Login Ficom gagal (HTTP ${res.status}) — cek akun di Master Data → Ficom Password`)
  const data = await res.json()
  if (!data?.token) throw new Error("Login Ficom gagal: response tidak ada token")
  return data.token as string
}

// "DD MON YYYY" zero-padded, format persis sama kayak todayMaksDate() di
// ficom-edi-sync.ts.
function toMaksDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0")
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
  return `${day} ${month} ${d.getFullYear()}`
}
function endOfMonth(tahun: number, periode1to12: number): Date {
  return new Date(tahun, periode1to12, 0) // hari ke-0 bulan depan = akhir bulan ini
}

// Ficom Lite Monthly (componentId "C12") — angka nasional pembanding,
// pola sama persis kayak fetchFicomLiteMissions/pickSttCard di
// target-compare/page.tsx: cuma endpoint "missions" level SD yang
// balikin angka milik SD itu sendiri (bukan hasil jumlah turunannya).
// Token-nya LOGIN TERPISAH pakai akun posisi "SD" (ediCred yang dipakai
// buat ekstrak EDI200001 itu akun posisi "EDI", beda akun/beda scope).
const FICOM_LITE_STT_COMPONENT = "C12"
const FICOM_LITE_SCALE = 1000 // komponen STT/omset di Ficom Lite satuannya ribuan

interface FicomLiteCard { componentId: string; target: number | null; value: number | null }
interface FicomLiteMissions { monthly: { missions: FicomLiteCard[] } }

async function fetchFicomLiteMonthlyStt(token: string, userId: string): Promise<{ target: number; value: number } | undefined> {
  const res = await fetch(`${FICOM_BASE}/api/ficom-lite-dashboard/missions?user-id=${userId}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!res.ok) throw new Error(`Gagal ambil Ficom Lite Monthly (HTTP ${res.status})`)
  const data = await res.json() as FicomLiteMissions
  const c = (data.monthly?.missions || []).find(c => c.componentId === FICOM_LITE_STT_COMPONENT)
  if (!c || c.value == null || c.target == null) return undefined
  return { target: c.target * FICOM_LITE_SCALE, value: c.value * FICOM_LITE_SCALE }
}

async function fetchOmzet(token: string, tpl: EdiTemplate, maksDate: string): Promise<string> {
  const filledParams = tpl.params.map(p => ({
    ...p,
    placeholder: p.var === "V01" ? SD_CODE_TOP : p.var === "V06" ? maksDate : p.placeholder,
  }))
  const res = await fetch(`${FICOM_BASE}/api/edi/ekstrak/brt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `F1C0m ${token}` },
    body: JSON.stringify({ ...tpl, params: filledParams }),
  })
  if (!res.ok) throw new Error(`Gagal ekstrak EDI OMSET DASHBOARD (HTTP ${res.status})`)
  return res.text()
}

async function runSync(backfill: boolean) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const [{ data: sdCred, error: sdErr }, { data: ediCred, error: ediErr }] = await Promise.all([
    supabase.from("ficom_passwords").select("user_login,password").eq("position", "SD").limit(1).maybeSingle(),
    supabase.from("ficom_passwords").select("user_login,password").eq("position", "EDI").limit(1).maybeSingle(),
  ])
  if (sdErr) return NextResponse.json({ error: `Gagal ambil kredensial SD: ${sdErr.message}` }, { status: 500 })
  if (!sdCred?.user_login || !sdCred?.password) {
    return NextResponse.json({ error: 'Belum ada akun posisi "SD" di Master Data → Ficom Password' }, { status: 400 })
  }
  if (ediErr) return NextResponse.json({ error: `Gagal ambil kredensial EDI: ${ediErr.message}` }, { status: 500 })
  if (!ediCred?.user_login || !ediCred?.password) {
    return NextResponse.json({ error: 'Belum ada akun posisi "EDI" di Master Data → Ficom Password' }, { status: 400 })
  }

  try {
    const now = new Date()
    const curYear = now.getFullYear()
    const curMonth = now.getMonth() + 1

    const token = await ficomLogin(ediCred.user_login, ediCred.password)
    const tplRes = await fetch(`${FICOM_BASE}/api/edi/${EDI_ID}`, { headers: { Authorization: `F1C0m ${token}` } })
    if (!tplRes.ok) throw new Error(`Gagal ambil template EDI OMSET DASHBOARD (HTTP ${tplRes.status})`)
    const tpl = await tplRes.json() as EdiTemplate

    // backfill=false (tombol "Sync Hari Ini") → cuma bulan berjalan.
    // backfill=true (tombol "Tarik Histori") → Januari s/d bulan ini,
    // SEKUENSIAL (bukan Promise.all — pelajaran dari Compare MPP, ekstrak
    // paralel pakai token sama bikin HTTP 409 di server Ficom).
    const months = backfill
      ? Array.from({ length: curMonth }, (_, i) => i + 1)
      : [curMonth]

    const results: { periodMonth: string; rows: number }[] = []
    for (const m of months) {
      const isCurrentMonth = m === curMonth
      const cutoff = isCurrentMonth ? now : endOfMonth(curYear, m)
      const maksDate = toMaksDate(cutoff)
      const periodMonth = `${curYear}-${String(m).padStart(2, "0")}`

      const text = await fetchOmzet(token, tpl, maksDate)
      const parsed = parseEdiText(text)
      // Scope ke SD yang sama dengan Ficom Lite — EDI200001 narik semua
      // nsm (SD) di bawah SD_CODE_TOP kalau tidak difilter.
      const rows = parsed.filter(r => splitCodeName(r.nsm).code === sdCred.user_login)

      const dbRows = rows.map(r => {
        const spv = splitCodeName(r.spv)
        const rsm = splitCodeName(r.rsm)
        const grsm = splitCodeName(r.grsm)
        const nsm = splitCodeName(r.nsm)
        const sd = splitCodeName(r.sd)
        return {
          period_month: periodMonth,
          distributor_id: r.distributor_id,
          distributor_nm: r.distributor_nm || null,
          kota: r.kota || null,
          spv_code: spv.code || null, spv_name: spv.name || null,
          rsm_code: rsm.code || null, rsm_name: rsm.name || null,
          grsm_code: grsm.code || null, grsm_name: grsm.name || null,
          nsm_code: nsm.code || null, nsm_name: nsm.name || null,
          sd_code: sd.code || null, sd_name: sd.name || null,
          nilai_omset: num(r.nilai_omset), target_omset: num(r.target_omset), perc_omset: num(r.perc),
          nilai_cbcover: num(r.nilai_cbcover), target_cbcover: num(r.target_cbcover), perc_cbcover: num(r.perc_cbcover),
          nilai_hhtkpl: num(r.nilai_hhtkpl), target_hhtkpl: num(r.target_hhtkpl), perc_hhtkpl: num(r.perc_hhtkpl),
          nilai_hht: num(r.nilai_hht), target_hht: num(r.target_hht),
          nilai_ipt: num(r.nilai_ipt), target_ipt: num(r.target_ipt),
          nilai_sbpt: num(r.nilai_sbpt), target_sbpt: num(r.target_sbpt),
          nilai_ec_std_mtd: num(r.nilai_ec_std_mtd), target_ec_std_mtd: num(r.target_ec_std_mtd),
          release: r.release || null,
          cutoff_date: maksDate,
          synced_at: now.toISOString(),
        }
      })

      // EDI200001 ternyata bisa balikin >1 baris utk distributor_id yang
      // sama dalam 1 periode (beda "release") — kalau dikirim apa adanya,
      // Postgres nolak upsert-nya ("ON CONFLICT DO UPDATE command cannot
      // affect row a second time", karena constraint-nya per
      // period_month+distributor_id). Dedupe dulu di sini, ambil baris
      // TERAKHIR per distributor_id (bukan dijumlah — nilai_omset/
      // target_omset itu snapshot MTD, bukan transaksi, jadi menjumlah
      // baris duplikat malah bikin dobel hitung).
      const dedupMap = new Map<string, typeof dbRows[number]>()
      for (const row of dbRows) dedupMap.set(row.distributor_id, row)
      const dedupedRows = Array.from(dedupMap.values())

      if (dedupedRows.length > 0) {
        const { error: upErr } = await supabase.from("omzet_phi_snapshot").upsert(dedupedRows, { onConflict: "period_month,distributor_id" })
        if (upErr) throw new Error(`Gagal simpan periode ${periodMonth}: ${upErr.message}`)
      }
      results.push({ periodMonth, rows: dedupedRows.length })

      // Ficom Lite Monthly cuma punya angka bulan berjalan (endpoint ini
      // tidak punya histori) — jadi cuma ditarik/disimpan sekali, pas
      // iterasi sampai di bulan sekarang.
      if (isCurrentMonth) {
        const sdToken = await ficomLogin(sdCred.user_login, sdCred.password)
        const stt = await fetchFicomLiteMonthlyStt(sdToken, sdCred.user_login)
        if (stt) {
          const { error: refErr } = await supabase
            .from("omzet_phi_ficomlite_ref")
            .upsert({ period_month: periodMonth, target: stt.target, value: stt.value, synced_at: now.toISOString() }, { onConflict: "period_month" })
          if (refErr) throw new Error(`Gagal simpan Ficom Lite Monthly: ${refErr.message}`)
        }
      }
    }

    return NextResponse.json({ success: true, results, syncedAt: now.toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync Omzet PHI: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}

// Belum ada cron otomatis (sesuai permintaan, hindari biaya) — manual aja.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return runSync(false)
}

// body { backfill: true } → tombol "Tarik Histori dari Ficom" (Jan s/d
// bulan ini). Tanpa body / backfill:false → tombol "Sync Hari Ini".
export async function POST(req: NextRequest) {
  let backfill = false
  try {
    const body = await req.json()
    backfill = !!body?.backfill
  } catch {
    // body kosong — default backfill=false
  }
  return runSync(backfill)
}
