import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Sync "Compare MPP" — bandingkan MPP aktif per hari antara dua sumber:
//  1) Ficom Lite (api/ficom-lite-dashboard/mpp) — countMppActive/countMpp,
//     sama persis logic-nya dengan api/mpp-health-sync (login akun posisi
//     "SD" di Master Data → Ficom Password, tarik seluruh tree RDM→ADM→
//     ADS→Salesman sekali call).
//  2) Ficom EDI240136 "EDI Salesman Aktif" — salesman yang punya omzet != 0
//     di tahun+periode (bulan) berjalan, dikonfirmasi dari capture user
//     (query: m_epr_d where tahun=V01 and periode=V02 and omzet<>0, join
//     naik sampai SD lewat spv→rsm→grsm→nsm→sd). MPP EDI per tanggal =
//     COUNT DISTINCT (sls_id, distributor_id) dari hasil ekstrak hari itu.
//
// PENTING: kedua sumber di-scope ke SD YANG SAMA (akun posisi "SD") biar
// apples-to-apples — bukan SD_CODE hardcode terpisah kayak di
// ficom-edi-sync (itu buat EDI200001 yang scope-nya beda/independen).
//
// Login buat ekstrak EDI240136 pakai akun posisi "EDI" (akun fungsional,
// sama kayak ficom-edi-sync) — BUKAN akun SD, walau parameter V03 (SD Id)
// tetap diisi emp_id akun SD di atas.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI240136"

interface MppNodeData {
  empId: string; empNm: string; superiorId: string | null
  salesforce: string | null; empType: number
  countMppActive: number | null; countMpp: number | null
  hka: number; hke: number; lastDate: string; isUpdate: boolean
}
interface MppNode { data: MppNodeData; children: MppNode[]; leaf: boolean }

interface EdiParam { var: string; label: string; placeholder: string; maxLength: number }
interface EdiTemplate { ediId: string; ediNm: string; query: string; params: EdiParam[] }

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

async function fetchMppTree(token: string, sdEmpId: string): Promise<MppNode[]> {
  const res = await fetch(`${FICOM_BASE}/api/ficom-lite-dashboard/mpp?user-id=${sdEmpId}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!res.ok) throw new Error(`GET mpp gagal (HTTP ${res.status})`)
  return res.json()
}

async function fetchEdiSalesmanAktif(token: string, sdCode: string, tahun: number, periode: number): Promise<string> {
  const tplRes = await fetch(`${FICOM_BASE}/api/edi/${EDI_ID}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!tplRes.ok) throw new Error(`Gagal ambil template EDI Salesman Aktif (HTTP ${tplRes.status})`)
  const tpl = await tplRes.json() as EdiTemplate

  const filledParams = tpl.params.map(p => ({
    ...p,
    placeholder: p.var === "V01" ? String(tahun) : p.var === "V02" ? String(periode) : p.var === "V03" ? sdCode : p.placeholder,
  }))

  const extractRes = await fetch(`${FICOM_BASE}/api/edi/ekstrak/brt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `F1C0m ${token}` },
    body: JSON.stringify({ ...tpl, params: filledParams }),
  })
  if (!extractRes.ok) throw new Error(`Gagal ekstrak EDI Salesman Aktif (HTTP ${extractRes.status})`)
  return extractRes.text()
}

// Tanggal kalender WIB (UTC+7) — server Vercel jalan di UTC, kalau pakai
// tanggal UTC langsung, sync yang jalan dini hari WIB (00:00-06:59) bisa
// kecatat sebagai tanggal KEMARIN (UTC-nya masih 17:00-23:59 hari
// sebelumnya), padahal snapshot ini per-hari (1 baris = 1 tanggal).
function wibDateKey(d: Date): string {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

async function runSync() {
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
    const tahun = now.getFullYear()
    const periode = now.getMonth() + 1

    const [sdToken, ediToken] = await Promise.all([
      ficomLogin(sdCred.user_login, sdCred.password),
      ficomLogin(ediCred.user_login, ediCred.password),
    ])

    const [tree, ediText] = await Promise.all([
      fetchMppTree(sdToken, sdCred.user_login),
      fetchEdiSalesmanAktif(ediToken, sdCred.user_login, tahun, periode),
    ])
    const rows = parseEdiText(ediText)

    // Top-level array dari fetchMppTree itu node RDM (empType 3) — angka
    // countMppActive/countMpp di level RDM sudah AKUMULASI seluruh
    // descendant-nya (dikonfirmasi manual: sum ADM anak = countMppActive RDM),
    // jadi total nasional = jumlahin semua node top-level, tidak perlu
    // rekursif ke bawah.
    const ficomLiteActive = tree.reduce((s, n) => s + (n.data.countMppActive ?? 0), 0)
    const ficomLiteTotal = tree.reduce((s, n) => s + (n.data.countMpp ?? 0), 0)
    const ficomLiteByRdm = tree.map(n => ({
      name: n.data.empNm, active: n.data.countMppActive ?? 0, total: n.data.countMpp ?? 0,
    }))

    // MPP EDI = jumlah salesman UNIK (sls_id + distributor_id, jaga-jaga
    // 1 sls_id kepakai di >1 distributor) yang omzet != 0 bulan ini —
    // EXCLUDE baris "HOUSE ACCOUNT" (bukan salesman beneran, kode generik
    // buat omzet yang nggak diatribusikan ke salesman tertentu), dicek dari
    // nama-nya (sls_nm), case-insensitive.
    const activeRows = rows.filter(r => !(r.sls_nm || "").toUpperCase().includes("HOUSE ACCOUNT"))
    const uniqueSalesman = new Set<string>()
    const nsmMap = new Map<string, Set<string>>()
    for (const r of activeRows) {
      const key = `${r.sls_id}|${r.distributor_id}`
      uniqueSalesman.add(key)
      const nsmName = r.nsm_nm || "—"
      if (!nsmMap.has(nsmName)) nsmMap.set(nsmName, new Set())
      nsmMap.get(nsmName)!.add(key)
    }
    const ediActiveSalesman = uniqueSalesman.size
    // nsm_nm di EDI itu level "manajer nasional" di bawah SD — belum ada
    // pemetaan otomatis yang dikonfirmasi ke nama RDM Ficom Lite (beda
    // sistem, beda label jabatan), jadi disimpan APA ADANYA buat
    // dibandingkan manual dulu di halaman, bukan dipaksa di-match di sini.
    const ediByNsm = Array.from(nsmMap.entries())
      .map(([name, set]) => ({ name, active: set.size }))
      .sort((a, b) => b.active - a.active)

    const snapshotDate = wibDateKey(now)
    const { error: upErr } = await supabase.from("mpp_compare_snapshot").upsert({
      snapshot_date: snapshotDate,
      tahun, periode,
      ficom_lite_active: ficomLiteActive,
      ficom_lite_total: ficomLiteTotal,
      edi_active_salesman: ediActiveSalesman,
      ficom_lite_by_rdm: ficomLiteByRdm,
      edi_by_nsm: ediByNsm,
      synced_at: now.toISOString(),
    }, { onConflict: "snapshot_date" })
    if (upErr) throw new Error(`Gagal simpan snapshot: ${upErr.message}`)

    return NextResponse.json({
      success: true, snapshotDate, tahun, periode,
      ficomLiteActive, ficomLiteTotal, ediActiveSalesman,
      houseAccountExcluded: rows.length - activeRows.length,
      selisih: ficomLiteActive - ediActiveSalesman,
      syncedAt: now.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync Compare MPP: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}

// Dipanggil Vercel Cron kalau nanti dijadwalkan (belum ada entry cron
// otomatis di project ini — tambahkan manual di Vercel dashboard kalau mau
// jalan otomatis tiap hari, contoh jam yang sama dengan mpp-health-sync).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return runSync()
}

// Dipanggil tombol "Sync dari Ficom" di halaman Compare MPP.
export async function POST() {
  return runSync()
}
