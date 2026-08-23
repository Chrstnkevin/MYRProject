import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Logix (phi.logix.my.id) pakai sesi cookie HttpOnly (ci_session) — beda
// dari Ficom yang pakai token di header Authorization dan bisa dipanggil
// langsung dari browser. Cookie HttpOnly tidak bisa dibaca/dibawa lintas
// origin oleh JS browser, jadi login & pegang sesinya HARUS di sini
// (server Next.js kita), bukan di client. Browser cuma manggil route ini.

const LOGIX_BASE = "https://phi.logix.my.id"

function readSetCookies(res: Response): string[] {
  const h = res.headers as unknown as { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === "function") return h.getSetCookie()
  const raw = res.headers.get("set-cookie")
  return raw ? [raw] : []
}

function mergeCookies(jar: Map<string, string>, setCookies: string[]) {
  for (const c of setCookies) {
    const pair = c.split(";")[0]
    const eq = pair.indexOf("=")
    if (eq === -1) continue
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ")
}

// Urutan field ini SAMA PERSIS dengan urutan key di object data yang
// dibalikin /ticketing/json1. Dua percobaan sebelumnya:
//  1) columns[] penuh + order[0][column] tebakan → "Database Error" (library
//     Datatables.php kemungkinan pakai columns[order.column].data buat
//     ORDER BY, dan nama field yang kita tebak nggak match kolom SQL asli).
//  2) TANPA columns[] sama sekali → PHP Notice "array offset on null" di
//     Datatables.php:515 — library-nya baca $_POST['columns'][i][...]
//     LANGSUNG tanpa cek null, jadi columns[] itu WAJIB ada.
// Jadi sekarang: columns[] penuh tetap dikirim (wajib), TAPI order[] TIDAK
// dikirim sama sekali — biar library pakai default order bawaan dari
// Ticketing_model.php sendiri, bukan coba resolve dari nama field tebakan kita.
const TICKET_FIELDS = [
  "no_ticket", "judul_ticket", "tipe_ticket", "description_ticket",
  "id_user", "nm_user", "email_user", "nm_subdist",
  "id_tas_cover", "nm_tas_cover", "id_tas", "nm_tas",
  "id_br", "nm_br", "id_dev", "nm_dev",
  "id_aplikasi", "nm_aplikasi", "id_kategori", "nm_kategori",
  "id_sub_kategori", "nm_sub_kategori", "id_status", "nm_status",
  "id_severity", "nm_severity", "date_created", "date_updated",
  "user_created", "user_updated", "action",
]

function dataTablesBody(): string {
  const params = new URLSearchParams()
  params.set("draw", "1")
  params.set("start", "0")
  params.set("length", "5000") // cukup besar buat ambil semua tiket sekali jalan
  params.set("search[value]", "")
  params.set("search[regex]", "false")
  TICKET_FIELDS.forEach((field, i) => {
    params.set(`columns[${i}][data]`, field)
    params.set(`columns[${i}][name]`, "")
    params.set(`columns[${i}][searchable]`, "true")
    params.set(`columns[${i}][orderable]`, field === "action" ? "false" : "true")
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
    return NextResponse.json({ error: 'Kredensial Logix belum diisi — buka "Kelola Kredensial" di halaman ini dulu.' }, { status: 400 })
  }

  try {
    const jar = new Map<string, string>()

    // GET halaman login dulu, jaga-jaga kalau ada cookie (mis. CSRF) yang
    // harus sudah ada sebelum submit form — sama seperti browser beneran.
    const loginPageRes = await fetch(`${LOGIX_BASE}/LogAuth`, { redirect: "manual" })
    mergeCookies(jar, readSetCookies(loginPageRes))

    const loginRes = await fetch(`${LOGIX_BASE}/LogAuth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
      },
      body: new URLSearchParams({ email: cred.email, password: cred.password, token: "" }).toString(),
      redirect: "manual",
    })
    mergeCookies(jar, readSetCookies(loginRes))

    if (!jar.has("ci_session")) {
      return NextResponse.json({ error: 'Login Logix gagal — cek email/password di "Kelola Kredensial".' }, { status: 401 })
    }

    const ticketRes = await fetch(`${LOGIX_BASE}/ticketing/json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: cookieHeader(jar),
      },
      body: dataTablesBody(),
    })

        const text = await ticketRes.text()
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      // Server ini (CodeIgniter, display_errors on) kadang nyelipin HTML
      // PHP notice/warning SEBELUM JSON asli yang tetap dikirim di
      // belakangnya. Coba cari titik mulai JSON DataTables-nya ('{"draw"')
      // dan parse dari situ, sebelum benar-benar nyerah.
      const jsonStart = text.indexOf('{"draw"')
      if (jsonStart !== -1) {
        try { json = JSON.parse(text.slice(jsonStart)) } catch { /* tetap gagal, lanjut ke error di bawah */ }
      }
      if (json === undefined) {
        return NextResponse.json({
          error: "Respons tiket bukan JSON — sesi Logix mungkin tidak valid atau format request perlu disesuaikan.",
          raw: text.slice(0, 3000),
          httpStatus: ticketRes.status,
        }, { status: 502 })
      }
    }

    return NextResponse.json(json)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Gagal konek ke Logix: ${msg}` }, { status: 500 })
  }
}