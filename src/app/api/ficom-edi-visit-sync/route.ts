import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Sync "EDI FICOM LITE VISIT" (EDI2600008) — dipakai tab "Visit" di
// halaman EDI Ficom. BEDA dari EDI200001/EDI2600006: Date From (V01) dan
// Date To (V02) di-INPUT MANUAL sama user di halaman (dikonfirmasi user —
// "kalau saya yang ketik aja gimana? biar nantinya saya tau mau tanggal
// berapa"), BUKAN dihitung otomatis di server. Makanya sync-nya nerima
// dateFrom/dateTo dari POST body, dan cuma hapus staging di rentang
// tanggal itu sebelum insert (bukan delete-all) — supaya tarik ulang 1
// rentang tidak menghapus histori rentang tanggal lain yang sudah ditarik.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI2600008"

interface EdiParam { var: string; label: string; placeholder: string; maxLength: number }
interface EdiTemplate { ediId: string; ediNm: string; query: string; params: EdiParam[] }

// Kolom yang BUKAN text di edi_visit_staging — "" dari parseEdiText harus
// dijadiin null buat kolom ini, soalnya Postgres nolak "invalid input
// syntax" kalau string kosong di-cast ke date/numeric/integer/timestamptz.
const NON_TEXT_COLUMNS = new Set([
  "visit_date", "is_in_route", "visit_km", "is_scan",
  "longitude_outlet", "latitude_outlet", "longitude_real", "latitude_real",
  "date_integrated", "order_value", "target_value",
])

function cleanRow(row: Record<string, string>): Record<string, string | null> {
  const out: Record<string, string | null> = {}
  for (const [k, v] of Object.entries(row)) {
    out[k] = NON_TEXT_COLUMNS.has(k) && v === "" ? null : v
  }
  return out
}

// "2 SEP 2026" -> "2026-09-02", buat filter delete-by-range ke Supabase
// (kolom visit_date bertipe date).
function ficomDateToIso(s: string): string | null {
  const months: Record<string, string> = {
    JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
    JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
  }
  const m = s.trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/)
  if (!m) return null
  const [, day, mon, year] = m
  if (!months[mon]) return null
  return `${year}-${months[mon]}-${day.padStart(2, "0")}`
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

// Dipanggil tombol "Tarik EDI" tab Visit di halaman EDI Ficom. Body:
// { dateFrom, dateTo } — format "D MON YYYY" (mis. "2 SEP 2026"), sama
// persis format yang diketik user di form (lihat ficomDateNoPad).
export async function POST(req: NextRequest) {
  let dateFrom = "", dateTo = ""
  try {
    const body = await req.json()
    dateFrom = String(body?.dateFrom || "").trim()
    dateTo = String(body?.dateTo || "").trim()
  } catch {
    return NextResponse.json({ error: "Body request tidak valid" }, { status: 400 })
  }
  if (!dateFrom || !dateTo) {
    return NextResponse.json({ error: "Date From dan Date To wajib diisi" }, { status: 400 })
  }
  const isoFrom = ficomDateToIso(dateFrom)
  const isoTo = ficomDateToIso(dateTo)
  if (!isoFrom || !isoTo) {
    return NextResponse.json({ error: 'Format tanggal harus "D MON YYYY", mis. "2 SEP 2026"' }, { status: 400 })
  }

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

  try {
    const token = await ficomLogin(cred.user_login, cred.password)
    const text = await fetchEdiText(token, dateFrom, dateTo)
    const rows = parseEdiText(text).map(cleanRow)

    if (!rows.length) {
      return NextResponse.json({
        error: "Ekstrak Ficom sukses tapi 0 baris data — staging lama tidak diubah",
        dateFrom, dateTo,
        rawPreview: text.slice(0, 1500),
      }, { status: 502 })
    }

    const { error: delErr } = await supabase
      .from("edi_visit_staging")
      .delete()
      .gte("visit_date", isoFrom)
      .lte("visit_date", isoTo)
    if (delErr) throw new Error(`Gagal hapus staging rentang lama: ${delErr.message}`)

    const chunk = 100
    for (let i = 0; i < rows.length; i += chunk) {
      const { error: insErr } = await supabase.from("edi_visit_staging").insert(rows.slice(i, i + chunk))
      if (insErr) throw new Error(`Gagal insert staging: ${insErr.message}`)
    }

    return NextResponse.json({ success: true, rows: rows.length, dateFrom, dateTo, syncedAt: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync EDI Visit: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}