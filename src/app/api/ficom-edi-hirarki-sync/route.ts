import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Sync "EDI HIRARKI SD - SALESMAN" (EDI260001) — snapshot lengkap hierarki
// SD → NSM → GRSM → RSM → SS → Salesman per distributor, dipakai tab
// "Hirarki SD - Salesman" di halaman EDI Ficom. Query-nya TIDAK punya
// params sama sekali (dikonfirmasi dari capture template user: "params":[]),
// jadi tiap ditarik selalu hasilkan snapshot nasional lengkap — sync-nya
// delete-all + insert (bukan delete-by-range kayak Visit).
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI260001"

interface EdiParam { var: string; label: string; placeholder: string; maxLength: number }
interface EdiTemplate { ediId: string; ediNm: string; query: string; params: EdiParam[] }

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

async function fetchEdiText(token: string): Promise<string> {
  const tplRes = await fetch(`${FICOM_BASE}/api/edi/${EDI_ID}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!tplRes.ok) throw new Error(`Gagal ambil template EDI (HTTP ${tplRes.status})`)
  const tpl = await tplRes.json() as EdiTemplate

  const extractRes = await fetch(`${FICOM_BASE}/api/edi/ekstrak/brt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `F1C0m ${token}` },
    body: JSON.stringify(tpl),
  })
  if (!extractRes.ok) throw new Error(`Gagal ekstrak EDI (HTTP ${extractRes.status})`)
  return extractRes.text()
}

// Dipanggil tombol "Tarik EDI" tab Hirarki SD - Salesman di halaman EDI Ficom.
export async function POST() {
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
    const text = await fetchEdiText(token)
    const rows = parseEdiText(text)

    if (!rows.length) {
      return NextResponse.json({
        error: "Ekstrak Ficom sukses tapi 0 baris data — staging lama tidak diubah",
        rawPreview: text.slice(0, 1500),
      }, { status: 502 })
    }

    const { error: delErr } = await supabase.from("edi_hirarki_staging").delete().not("id", "is", null)
    if (delErr) throw new Error(`Gagal hapus staging lama: ${delErr.message}`)

    const chunk = 100
    for (let i = 0; i < rows.length; i += chunk) {
      const { error: insErr } = await supabase.from("edi_hirarki_staging").insert(rows.slice(i, i + chunk))
      if (insErr) throw new Error(`Gagal insert staging: ${insErr.message}`)
    }

    return NextResponse.json({ success: true, rows: rows.length, syncedAt: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync EDI Hirarki: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}