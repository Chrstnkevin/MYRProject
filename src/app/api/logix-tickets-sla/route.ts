import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookieHeader, describeFetchError, fetchWithRetry, loginToLogix, LOGIX_BASE } from "@/lib/logixAuth"

// Sumber data SLA/timing respon tiket (Response TAS, Time BR, Time Solved,
// dst) — endpoint TERPISAH dari /api/logix-tickets (yang pakai
// /ticketing/json), skema kolomnya beda total. URL & nama field di bawah
// dikonfirmasi dari capture DevTools user langsung (Network tab pas buka
// halaman "Log Respons" di Logix), BUKAN tebakan.

// Urutan field ini SAMA PERSIS dengan urutan key di object data yang
// dibalikin /ticketing/json1 (dikonfirmasi dari capture response JSON user).
const SLA_FIELDS = [
  "nomor_ticket", "nm_user", "ticket_dibuat", "id_superior",
  "nm_tas_cover", "nm_tas", "ticket_direspon_apps", "respon_apps",
  "nm_br", "ticket_direspon_br", "respon_br",
  "nm_dev", "ticket_direspon_dev", "respon_dev",
  "status", "user_close_ticket", "ticket_diselesaikan", "lama_ticket",
]

function dataTablesBody(): string {
  const params = new URLSearchParams()
  params.set("draw", "1")
  params.set("start", "0")
  params.set("length", "5000")
  params.set("search[value]", "")
  params.set("search[regex]", "false")
  SLA_FIELDS.forEach((field, i) => {
    params.set(`columns[${i}][data]`, field)
    params.set(`columns[${i}][name]`, "")
    params.set(`columns[${i}][searchable]`, "true")
    params.set(`columns[${i}][orderable]`, "true")
    params.set(`columns[${i}][search][value]`, "")
    params.set(`columns[${i}][search][regex]`, "false")
  })
  return params.toString()
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: cred, error: credErr } = await supabase
    .from("logix_credentials")
    .select("email,password")
    .eq("id", 1)
    .maybeSingle()

  if (credErr) return NextResponse.json({ error: `Gagal ambil kredensial: ${credErr.message}` }, { status: 500 })
  if (!cred?.email || !cred?.password) {
    return NextResponse.json({ error: 'Kredensial Logix belum diisi — buka "Kelola Kredensial" di halaman Ticket Logix dulu.' }, { status: 400 })
  }

  try {
    const jar = await loginToLogix(cred.email, cred.password)

    if (!jar.has("ci_session")) {
      return NextResponse.json({ error: 'Login Logix gagal — cek email/password di "Kelola Kredensial".' }, { status: 401 })
    }

    const slaRes = await fetchWithRetry(`${LOGIX_BASE}/ticketing/json1`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader(jar),
      },
      body: dataTablesBody(),
    })

    const text = await slaRes.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      const jsonStart = text.indexOf('{"draw"')
      if (jsonStart !== -1) {
        try { json = JSON.parse(text.slice(jsonStart)) } catch { /* tetap gagal, lanjut ke error di bawah */ }
      }
      if (json === undefined) {
        return NextResponse.json({
          error: "Respons SLA bukan JSON — sesi Logix mungkin tidak valid atau format request perlu disesuaikan.",
          raw: text.slice(0, 3000),
          httpStatus: slaRes.status,
        }, { status: 502 })
      }
    }

    return NextResponse.json(json)
  } catch (e) {
    return NextResponse.json({ error: describeFetchError(e) }, { status: 500 })
  }
}
