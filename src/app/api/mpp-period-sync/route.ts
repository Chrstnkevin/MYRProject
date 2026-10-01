import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Sync "Compare MPP — Trend Bulanan" — BEDA dari mpp-compare-sync (yang
// harian, dari EDI260001 Hirarki). Ini pakai EDI240136 "EDI Salesman
// Aktif" (filter omzet != 0 di tahun+periode tertentu) KARENA cuma EDI ini
// yang punya param tahun/periode, jadi satu-satunya cara dapet angka MASA
// LALU (Ficom Lite & EDI260001 selalu kondisi sekarang, no histori).
// Backfill dari Januari tahun berjalan s/d bulan ini, sekali jalan.
//
// PENTING soal param V03 "SD Id": filter SQL-nya `where sd.emp_id in
// (V03)` itu NGECEK LEVEL PALING ATAS (sd_id), BUKAN level SD kita yang
// dipakai Ficom Lite (itu levelnya "nsm" di hirarki EDI — dikonfirmasi
// dari capture EDI260001 user: sd_id=WF7001 "CHIEF OPERATING OFFICER",
// nsm_id=WF6001 "SD Don Lara"). Jadi V03 WAJIB diisi WF7001 (kode SD paling
// atas, sama kayak dipakai ficom-edi-sync.ts buat EDI200001), BUKAN akun
// posisi "SD" kita — lalu hasilnya di-filter manual lagi pakai
// nsm_id === akun SD kita, biar scope-nya sama persis kayak mpp-compare-sync.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI240136"
const SD_CODE_TOP = "WF7001"

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

async function fetchPeriod(token: string, tpl: EdiTemplate, tahun: number, periode: number): Promise<string> {
  const filledParams = tpl.params.map(p => ({
    ...p,
    placeholder: p.var === "V01" ? String(tahun) : p.var === "V02" ? String(periode) : p.var === "V03" ? SD_CODE_TOP : p.placeholder,
  }))
  const res = await fetch(`${FICOM_BASE}/api/edi/ekstrak/brt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `F1C0m ${token}` },
    body: JSON.stringify({ ...tpl, params: filledParams }),
  })
  if (!res.ok) throw new Error(`Gagal ekstrak periode ${tahun}-${periode} (HTTP ${res.status})`)
  return res.text()
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
    const curYear = now.getFullYear()
    const curMonth = now.getMonth() + 1

    const token = await ficomLogin(ediCred.user_login, ediCred.password)
    const tplRes = await fetch(`${FICOM_BASE}/api/edi/${EDI_ID}`, { headers: { Authorization: `F1C0m ${token}` } })
    if (!tplRes.ok) throw new Error(`Gagal ambil template EDI Salesman Aktif (HTTP ${tplRes.status})`)
    const tpl = await tplRes.json() as EdiTemplate

    // Backfill Januari tahun berjalan s/d bulan ini — WAJIB sekuensial,
    // BUKAN Promise.all. Ekstrak paralel pakai token yang sama ke endpoint
    // ekstrak/brt bikin konflik di server Ficom (HTTP 409), persis kayak
    // kasus parallel-session Logix — server-nya kayaknya kunci per-token,
    // nggak terima >1 ekstrak jalan bersamaan.
    const periods = Array.from({ length: curMonth }, (_, i) => ({ tahun: curYear, periode: i + 1 }))

    // Upsert LANGSUNG per bulan di dalam loop (bukan dikumpulin dulu baru
    // disimpan sekali di akhir) — 9 request berurutan ke Ficom itu lumayan
    // lama, kalau koneksi putus/request ke-interrupt di tengah jalan
    // (misal dev server Next.js reload pas lagi nunggu), bulan-bulan yang
    // UDAH kelar tetap kesimpen, bukan hilang semua gara-gara gagal di
    // satu bulan terakhir.
    const results: {
      tahun: number; periode: number; edi_active_salesman: number
      edi_by_rdm: { empId: string; name: string; active: number }[]
      edi_by_adm: { empId: string; name: string; active: number; rdmId: string; rdmName: string }[]
      edi_salesman_list: { key: string; slsId: string; distributorId: string; name: string; rdmId: string; rdmName: string }[]
      synced_at: string
    }[] = []
    for (const { tahun, periode } of periods) {
      const text = await fetchPeriod(token, tpl, tahun, periode)
      const allRows = parseEdiText(text)
      // Scope ke SD yang sama dengan Ficom Lite (level "nsm" di hirarki EDI)
      // + exclude House Account, sama persis kayak mpp-compare-sync.
      const rows = allRows.filter(r =>
        r.nsm_id === sdCred.user_login && !(r.sls_nm || "").toUpperCase().includes("HOUSE ACCOUNT")
      )
      const uniqueSalesman = new Set<string>()
      const rdmMap = new Map<string, { name: string; set: Set<string> }>()
      // rsm_id/rsm_nm = 1 level di bawah RDM (grsm) = ADM, sama persis
      // pemetaan kayak di mpp-compare-sync.
      const admMap = new Map<string, { name: string; rdmId: string; rdmName: string; set: Set<string> }>()
      // Daftar mentah salesman (bukan cuma angka) — dipakai fitur "selisih"
      // buat nunjukin SIAPA aja bedanya pas dibandingin ke hirarki sekarang.
      const salesmanMap = new Map<string, { key: string; slsId: string; distributorId: string; name: string; rdmId: string; rdmName: string }>()
      for (const r of rows) {
        const key = `${r.sls_id}|${r.distributor_id}`
        uniqueSalesman.add(key)
        const rdmId = r.grsm_id || "—"
        const rdmName = r.grsm_nm || rdmId
        const admId = r.rsm_id || "—"
        const admName = r.rsm_nm || admId
        if (!rdmMap.has(rdmId)) rdmMap.set(rdmId, { name: rdmName, set: new Set() })
        rdmMap.get(rdmId)!.set.add(key)
        if (!admMap.has(admId)) admMap.set(admId, { name: admName, rdmId, rdmName, set: new Set() })
        admMap.get(admId)!.set.add(key)
        if (!salesmanMap.has(key)) {
          salesmanMap.set(key, { key, slsId: r.sls_id, distributorId: r.distributor_id, name: r.sls_nm || "", rdmId, rdmName })
        }
      }
      const ediByRdm = Array.from(rdmMap.entries())
        .map(([empId, v]) => ({ empId, name: v.name, active: v.set.size }))
        .sort((a, b) => b.active - a.active)
      const ediByAdm = Array.from(admMap.entries())
        .map(([empId, v]) => ({ empId, name: v.name, active: v.set.size, rdmId: v.rdmId, rdmName: v.rdmName }))
        .sort((a, b) => b.active - a.active)
      const ediSalesmanList = Array.from(salesmanMap.values())
      const row = {
        tahun, periode,
        edi_active_salesman: uniqueSalesman.size,
        edi_by_rdm: ediByRdm,
        edi_by_adm: ediByAdm,
        edi_salesman_list: ediSalesmanList,
        synced_at: now.toISOString(),
      }
      const { error: upErr } = await supabase.from("mpp_period_snapshot").upsert(row, { onConflict: "tahun,periode" })
      if (upErr) throw new Error(`Gagal simpan periode ${tahun}-${periode}: ${upErr.message}`)
      results.push(row)
    }

    return NextResponse.json({
      success: true,
      periods: results.map(r => ({ tahun: r.tahun, periode: r.periode, count: r.edi_active_salesman })),
      syncedAt: now.toISOString(),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync trend bulanan MPP: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}

// Belum ada entry cron otomatis — tambahkan manual di Vercel dashboard
// kalau mau refresh bulanan otomatis (mis. tanggal 1 tiap bulan).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return runSync()
}

// Dipanggil tombol "Tarik Histori dari Ficom" di panel Trend Bulanan.
export async function POST() {
  return runSync()
}
