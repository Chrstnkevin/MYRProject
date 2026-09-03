import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Sync "EDI FICOM LITE PRODUCTIVITY" (EDI2600006) — sumber data Target vs
// Realisasi per komponen (C1, C3, C4, C7, C12, C16, C17, C22, C25, C36, C37,
// dst.), breakdown hierarki SD→RDM→ADM→ADS→Salesman, dipakai halaman
// Productivity Compare. Query Ficom-nya BEDA dari EDI200001 (OMSET
// Dashboard) — cuma filter tanggal (V01 Date From, V02 Date To), TIDAK
// butuh kode SD (V01 di EDI200001), jadi satu tarikan langsung dapat semua
// SD/hierarki nasional sekaligus (dikonfirmasi dari capture template
// GET /api/edi/EDI2600006 user).
//
// Mapping field Ficom → level hierarki yang diminta user: nsm_id/nsm_nm →
// SD, grsm_id/grsm_nm → RDM, rsm_id/rsm_nm → ADM, ss_id/ss_nm → ADS,
// sls_id/sls_nm → Salesman. Field sd_id/sd_nm paling luar (isinya "CHIEF
// OPERATING OFFICER") disimpan tapi tidak dipakai sebagai level manapun.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI2600006" // "EDI FICOM LITE PRODUCTIVITY"

interface EdiParam { var: string; label: string; placeholder: string; maxLength: number }
interface EdiTemplate { ediId: string; ediNm: string; query: string; params: EdiParam[] }

// Format persis contoh placeholder Ficom buat V01/V02: "1 OCT 2025" — D(tanpa
// leading zero) MON(inggris,upper) YYYY. BEDA dari V06 di EDI200001 yang
// zero-padded ("26 AUG 2026") — dua template ini pakai konvensi placeholder
// yang berbeda, jadi formatter-nya sengaja dipisah, bukan reuse todayMaksDate.
function ficomDateNoPad(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
  return `${d.getDate()} ${month} ${d.getFullYear()}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function periodMonthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

// "1 OCT 2025" -> "2025-10" — dipakai buat turunin period_month dari
// dateFrom MANUAL yang diketik user (lihat POST override di bawah), biar
// bisa juga tarik ulang bulan lampau, bukan cuma bulan berjalan.
function periodMonthFromFicomDate(s: string): string | null {
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  }
  const m = s.trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/)
  if (!m) return null
  const [, , mon, year] = m
  if (!months[mon]) return null
  return `${year}-${months[mon]}`
}

async function ficomLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${FICOM_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`Login Ficom gagal (HTTP ${res.status}) — cek akun SD di Master Data → Ficom Password`)
  const data = await res.json()
  if (!data?.token) throw new Error("Login Ficom gagal: response tidak ada token")
  return data.token as string
}

async function fetchEdiText(token: string, dateFrom: string, dateTo: string): Promise<string> {
  const tplRes = await fetch(`${FICOM_BASE}/api/edi/${EDI_ID}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!tplRes.ok) throw new Error(`Gagal ambil template EDI (HTTP ${tplRes.status})`)
  const tpl = await tplRes.json() as EdiTemplate

  // V01 = Date From, V02 = Date To — dua-duanya wajib diisi, tidak ada slot
  // lain di template ini (dikonfirmasi dari capture template user).
  const filledParams = tpl.params.map(p => ({
    ...p,
    placeholder: p.var === "V01" ? dateFrom : p.var === "V02" ? dateTo : "-",
  }))

  const extractRes = await fetch(`${FICOM_BASE}/api/edi/ekstrak/brt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `F1C0m ${token}` },
    body: JSON.stringify({ ...tpl, params: filledParams }),
  })
  if (!extractRes.ok) throw new Error(`Gagal ekstrak EDI (HTTP ${extractRes.status})`)
  return extractRes.text()
}

// override: dateFrom/dateTo MANUAL dari body POST (lihat handler POST di
// bawah) — kalau diisi user di halaman EDI Ficom, dipakai apa adanya
// (termasuk buat tarik histori bulan lampau). Kalau tidak diisi (tombol
// "Tarik dari Ficom" lama, atau cron), fallback ke default lama: awal
// bulan berjalan s.d. hari ini.
async function runSync(override?: { dateFrom: string; dateTo: string }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: cred, error: credErr } = await supabase
    .from("ficom_passwords")
    .select("user_login,password")
    .eq("position", "EDI")
    .limit(1)
    .maybeSingle()

  if (credErr) return NextResponse.json({ error: `Gagal ambil kredensial: ${credErr.message}` }, { status: 500 })
  if (!cred?.user_login || !cred?.password) {
    return NextResponse.json({ error: 'Belum ada akun posisi "EDI" di Master Data → Ficom Password' }, { status: 400 })
  }

  const now = new Date()
  let dateFrom: string, dateTo: string, periodMonth: string
  if (override) {
    dateFrom = override.dateFrom
    dateTo = override.dateTo
    const pm = periodMonthFromFicomDate(dateFrom)
    if (!pm) {
      return NextResponse.json({ error: 'Format tanggal harus "D MON YYYY", mis. "1 OCT 2025"' }, { status: 400 })
    }
    periodMonth = pm
  } else {
    dateFrom = ficomDateNoPad(startOfMonth(now))
    dateTo = ficomDateNoPad(now)
    periodMonth = periodMonthOf(now)
  }

  try {
    const token = await ficomLogin(cred.user_login, cred.password)
    const text = await fetchEdiText(token, dateFrom, dateTo)
    const parsed = parseEdiText(text)

    if (!parsed.length) {
      return NextResponse.json({
        error: "Ekstrak Ficom sukses tapi 0 baris data — staging periode ini tidak diubah",
        dateFrom, dateTo,
        rawPreview: text.slice(0, 1500),
      }, { status: 502 })
    }

    const num = (v: string) => v === "" || v == null ? null : Number(v)

    interface AggRow {
      nsm_id: string | null; nsm_nm: string | null
      grsm_id: string | null; grsm_nm: string | null
      rsm_id: string | null; rsm_nm: string | null
      ss_id: string | null; ss_nm: string | null
      distributor_id: string | null
      sls_id: string | null; sls_nm: string | null
      tipe_id: string | null
      component_id: string | null
      component_target: number | null
      component_realisasi: number
    }
    const agg = new Map<string, AggRow>()
    for (const r of parsed) {
      const key = `${r.sls_id}|${r.component_id}|${r.tipe_id}`
      let a = agg.get(key)
      if (!a) {
        a = {
          nsm_id: r.nsm_id || null, nsm_nm: r.nsm_nm || null,
          grsm_id: r.grsm_id || null, grsm_nm: r.grsm_nm || null,
          rsm_id: r.rsm_id || null, rsm_nm: r.rsm_nm || null,
          ss_id: r.ss_id || null, ss_nm: r.ss_nm || null,
          distributor_id: r.distributor_id || null,
          sls_id: r.sls_id || null, sls_nm: r.sls_nm || null,
          tipe_id: r.tipe_id || null,
          component_id: r.component_id || null,
          component_target: num(r.component_target),
          component_realisasi: 0,
        }
        agg.set(key, a)
      }
      a.component_realisasi += num(r.component_realisasi) || 0
    }
    const rows = Array.from(agg.values()).map(a => ({ period_month: periodMonth, ...a }))

    const { error: delErr } = await supabase
      .from("ficom_productivity_staging")
      .delete()
      .eq("period_month", periodMonth)
    if (delErr) throw new Error(`Gagal hapus staging periode lama: ${delErr.message}`)

    const chunk = 1000
    const chunks: typeof rows[] = []
    for (let i = 0; i < rows.length; i += chunk) chunks.push(rows.slice(i, i + chunk))
    const insertResults = await Promise.all(
      chunks.map(c => supabase.from("ficom_productivity_staging").insert(c))
    )
    const insErr = insertResults.find(r => r.error)?.error
    if (insErr) throw new Error(`Gagal insert staging: ${insErr.message}`)

    return NextResponse.json({ success: true, rows: rows.length, rawRows: parsed.length, periodMonth, dateFrom, dateTo, syncedAt: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync Ficom Productivity: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}

// Dipanggil Vercel Cron (lihat vercel.json) — selalu bulan berjalan, tidak
// pernah pakai override manual.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return runSync()
}

// Dipanggil tombol "Tarik dari Ficom" di halaman Productivity Compare
// (body kosong → auto bulan berjalan, TIDAK berubah), atau tab
// "Productivity" di halaman EDI Ficom yang boleh isi dateFrom/dateTo
// manual (mis. buat tarik ulang bulan lampau).
export async function POST(req: NextRequest) {
  let override: { dateFrom: string; dateTo: string } | undefined
  try {
    const body = await req.json()
    const dateFrom = String(body?.dateFrom || "").trim()
    const dateTo = String(body?.dateTo || "").trim()
    if (dateFrom && dateTo) override = { dateFrom, dateTo }
  } catch {
    // body kosong/invalid — fallback ke auto (bulan berjalan)
  }
  return runSync(override)
}