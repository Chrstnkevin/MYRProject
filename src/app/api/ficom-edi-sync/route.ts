import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Gantiin job "Dashboard" n8n (refresh tiap jam) buat Data Transfer Web
// Ficom. Ficom (ficom-phi.mayora.co.id) pakai token custom di header
// "Authorization: F1C0m <token>" dan CORS-nya terbuka — makanya di
// target-compare/page.tsx dipanggil langsung dari browser. Tapi route ini
// sengaja dibuat SERVER-SIDE (bukan reuse dari browser) supaya bisa dipicu
// Vercel Cron tanpa ada yang harus buka halamannya — persis kayak n8n.
//
// Alur (dikonfirmasi dari capture manual Network tab user):
//   1) GET  /api/edi/EDI200001      → template query + daftar param V01-V08
//   2) POST /api/edi/ekstrak/brt    → kirim balik template yang sama, tapi
//      field "placeholder" tiap param sudah diisi nilai asli → responsnya
//      teks pipe-delimited (BUKAN JSON), formatnya sama persis dengan CSV
//      manual "EDI_OMSET_DASHBOARD_brt.csv" yang sudah ada parser-nya.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI200001" // "EDI OMSET DASHBOARD" — sumber data tab Dashboard

// Kode SD (WF-code) buat param V01 "SD 1" — INI BUKAN akun login, ini kode
// org level SD yang jadi akar hierarki SD→NSM→GRSM→RSM→SPV di query EDI
// (dikonfirmasi dari capture manual user, nilai yang dipakai & sukses
// narik ~100+ baris data nasional). Tetap sama walau akun login (posisi
// "EDI" di ficom_passwords) beda dari kode SD ini.
const SD_CODE = "WF7001"

interface EdiParam { var: string; label: string; placeholder: string; maxLength: number }
interface EdiTemplate { ediId: string; ediNm: string; query: string; params: EdiParam[] }

// Format persis yang diminta param "Maks Date" (V06), dikonfirmasi dari
// placeholder capture: "26 AUG 2026" — DD MON(inggris,upper) YYYY.
function todayMaksDate(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, "0")
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
  return `${day} ${month} ${d.getFullYear()}`
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

async function fetchEdiText(token: string, sdCode: string): Promise<string> {
  const tplRes = await fetch(`${FICOM_BASE}/api/edi/${EDI_ID}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!tplRes.ok) throw new Error(`Gagal ambil template EDI (HTTP ${tplRes.status})`)
  const tpl = await tplRes.json() as EdiTemplate

  // V01 = kode SD (WF-code akun SD yang dipakai login), sisa slot SD
  // (V02-V05, V07, V08) diisi "-" — cuma 1 SD yang dipakai, dikonfirmasi
  // dari capture manual user. V06 = tanggal hari ini.
  const filledParams = tpl.params.map(p => ({
    ...p,
    placeholder: p.var === "V01" ? sdCode : p.var === "V06" ? todayMaksDate() : "-",
  }))

  const extractRes = await fetch(`${FICOM_BASE}/api/edi/ekstrak/brt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `F1C0m ${token}` },
    body: JSON.stringify({ ...tpl, params: filledParams }),
  })
  if (!extractRes.ok) throw new Error(`Gagal ekstrak EDI (HTTP ${extractRes.status})`)
  return extractRes.text()
}

async function runSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Akun login buat ekstraksi EDI itu akun SISTEM/FUNGSIONAL terpisah
  // (posisi "EDI" di Master Data → Ficom Password, mis. login "brt") —
  // BUKAN akun SD personal manapun. Kode SD buat param V01 (SD_CODE di
  // atas) independen dari akun ini.
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
    const text = await fetchEdiText(token, SD_CODE)
    const rows = parseEdiText(text)

    // Kalau hasil ekstrak kosong, JANGAN truncate data staging yang sudah
    // ada — lebih baik gagal & tetap simpan data lama daripada kosongin
    // dashboard karena Ficom lagi ngaco.
    if (!rows.length) {
      return NextResponse.json({
        error: "Ekstrak Ficom sukses tapi 0 baris data — staging lama tidak diubah",
        sdCode: cred.user_login,
        maksDate: todayMaksDate(),
        rawPreview: text.slice(0, 1500),
      }, { status: 502 })
    }

    const { error: truncErr } = await supabase.rpc("truncate_edi_transfer_staging")
    if (truncErr) throw new Error(`Gagal truncate staging: ${truncErr.message}`)

    const chunk = 100
    for (let i = 0; i < rows.length; i += chunk) {
      const { error: insErr } = await supabase.from("edi_transfer_staging").insert(rows.slice(i, i + chunk))
      if (insErr) throw new Error(`Gagal insert staging: ${insErr.message}`)
    }

    return NextResponse.json({ success: true, rows: rows.length, syncedAt: new Date().toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync Ficom: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}

// Dipanggil Vercel Cron (lihat vercel.json). Kalau env var CRON_SECRET
// diisi di project settings, Vercel otomatis kirim header
// "Authorization: Bearer <CRON_SECRET>" — kalau tidak diisi, endpoint tetap
// jalan tanpa proteksi tambahan (opsional, tidak wajib disetel).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return runSync()
}

// Dipanggil tombol "Tarik dari Ficom" di halaman Data Transfer.
export async function POST() {
  return runSync()
}