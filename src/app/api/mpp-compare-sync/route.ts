import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Sync "Compare MPP" — bandingkan jumlah salesman per hari antara dua sumber:
//  1) Ficom Lite (api/ficom-lite-dashboard/mpp) — countMppActive/countMpp,
//     sama persis logic-nya dengan api/mpp-health-sync (login akun posisi
//     "SD" di Master Data → Ficom Password, tarik seluruh tree RDM→ADM→
//     ADS→Salesman sekali call).
//  2) Ficom EDI260001 "EDI Hirarki SD - Salesman" — daftar MENTAH seluruh
//     salesman di hirarki (TANPA filter omzet/aktivitas, params-nya kosong
//     — beda dari EDI240136 "Salesman Aktif" yang kefilter omzet!=0, itu
//     kepakai salah sebelumnya). Jadi ini pembanding buat "jumlah salesman
//     versi master data Ficom (EDI)" vs "jumlah MPP versi Ficom Lite".
//
// PENTING — pemetaan level hirarki EDI260001 ke Ficom Lite (dikonfirmasi
// dari capture user, dicocokkan by WF-code, BUKAN tebakan nama):
//   sd_id/sd_nm     = root perusahaan (mis. WF7001 "CHIEF OPERATING OFFICER")
//   nsm_id/nsm_nm   = SD (akun posisi "SD" kita, mis. WF6001 "SD Don Lara")
//                     ↔ ini scope yang sama dengan "user-id" di Ficom Lite
//   grsm_id/grsm_nm = RDM di Ficom Lite (empType 3, top-level node tree)
//   rsm_id/rsm_nm   = ADM di Ficom Lite (empType 2)
//   ss_id/ss_nm     = ADS di Ficom Lite (empType 1)
//   sls_id/sls_nm   = Salesman di Ficom Lite (empType 0, leaf)
// Karena EDI260001 TIDAK ada param SD (ekstrak semua SD nasional), WAJIB
// difilter manual di sini pakai nsm_id === sdCred.user_login, biar scope-nya
// sama persis dengan tree Ficom Lite yang dibandingkan.
//
// Login buat ekstrak EDI260001 pakai akun posisi "EDI" (akun fungsional,
// sama kayak ficom-edi-sync) — BUKAN akun SD.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI260001"

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

async function fetchEdiHirarki(token: string): Promise<string> {
  const tplRes = await fetch(`${FICOM_BASE}/api/edi/${EDI_ID}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!tplRes.ok) throw new Error(`Gagal ambil template EDI Hirarki SD-Salesman (HTTP ${tplRes.status})`)
  const tpl = await tplRes.json() as EdiTemplate

  // EDI260001 tidak punya param (params: []) — kirim balik apa adanya.
  const extractRes = await fetch(`${FICOM_BASE}/api/edi/ekstrak/brt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `F1C0m ${token}` },
    body: JSON.stringify(tpl),
  })
  if (!extractRes.ok) throw new Error(`Gagal ekstrak EDI Hirarki SD-Salesman (HTTP ${extractRes.status})`)
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
      fetchEdiHirarki(ediToken),
    ])
    const allRows = parseEdiText(ediText)
    // Scope ke SD yang sama dengan Ficom Lite — EDI260001 narik SEMUA SD
    // nasional kalau tidak difilter.
    const rows = allRows.filter(r => r.nsm_id === sdCred.user_login)

    // Top-level array dari fetchMppTree itu node RDM (empType 3) — angka
    // countMppActive/countMpp di level RDM sudah AKUMULASI seluruh
    // descendant-nya (dikonfirmasi manual: sum ADM anak = countMppActive RDM),
    // jadi total nasional = jumlahin semua node top-level, tidak perlu
    // rekursif ke bawah.
    const ficomLiteActive = tree.reduce((s, n) => s + (n.data.countMppActive ?? 0), 0)
    const ficomLiteTotal = tree.reduce((s, n) => s + (n.data.countMpp ?? 0), 0)
    const ficomLiteByRdm = tree.map(n => ({
      empId: n.data.empId, name: n.data.empNm, active: n.data.countMppActive ?? 0, total: n.data.countMpp ?? 0,
    }))
    // 1 level ke bawah RDM — children langsung tiap node RDM itu ADM
    // (empType 2), angkanya juga udah akumulasi descendant-nya sendiri.
    const ficomLiteByAdm = tree.flatMap(rdm => (rdm.children || []).map(adm => ({
      empId: adm.data.empId, name: adm.data.empNm,
      active: adm.data.countMppActive ?? 0, total: adm.data.countMpp ?? 0,
      rdmId: rdm.data.empId, rdmName: rdm.data.empNm,
    })))

    // Jumlah salesman versi EDI = salesman UNIK (sls_id + distributor_id,
    // jaga-jaga 1 sls_id kepakai di >1 distributor) di hirarki — EXCLUDE
    // baris "HOUSE ACCOUNT" (bukan salesman beneran, kode generik buat
    // transaksi yang nggak diatribusikan ke salesman tertentu).
    const activeRows = rows.filter(r => !(r.sls_nm || "").toUpperCase().includes("HOUSE ACCOUNT"))
    const uniqueSalesman = new Set<string>()
    // Grup per RDM pakai grsm_id (match 1:1 ke empId RDM Ficom Lite di
    // atas) — BUKAN nama, biar matching-nya pasti, bukan tebak-tebakan nama.
    // rsm_id/rsm_nm itu 1 level di bawah RDM = ADM (dikonfirmasi sama
    // urutan join EDI260001: nsm>grsm>rsm>ss>sls = SD>RDM>ADM>ADS>Salesman).
    const rdmMap = new Map<string, { name: string; set: Set<string> }>()
    const admMap = new Map<string, { name: string; rdmId: string; rdmName: string; set: Set<string> }>()
    // Daftar mentah salesman (bukan cuma angka) — dipakai fitur "selisih"
    // buat nunjukin SIAPA aja bedanya pas dibandingin sama snapshot lain.
    const salesmanMap = new Map<string, { key: string; slsId: string; distributorId: string; name: string; rdmId: string; rdmName: string }>()
    for (const r of activeRows) {
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
    const ediActiveSalesman = uniqueSalesman.size
    const ediByRdm = Array.from(rdmMap.entries())
      .map(([empId, v]) => ({ empId, name: v.name, active: v.set.size }))
      .sort((a, b) => b.active - a.active)
    const ediByAdm = Array.from(admMap.entries())
      .map(([empId, v]) => ({ empId, name: v.name, active: v.set.size, rdmId: v.rdmId, rdmName: v.rdmName }))
      .sort((a, b) => b.active - a.active)
    const ediSalesmanList = Array.from(salesmanMap.values())

    // Log perubahan — bandingin ke sync SEBELUMNYA (apapun tanggalnya, bukan
    // cuma hari ini), biar perubahan DALAM hari yang sama (mis. pagi 985,
    // siang 989) ikut kecatat siapa aja yang nambah/ilang, bukan cuma angka
    // akhir hari doang yang nimpa baris snapshot_date yang sama.
    const { data: prevSnapshot } = await supabase
      .from("mpp_compare_snapshot")
      .select("edi_salesman_list")
      .order("synced_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    const prevList = (prevSnapshot?.edi_salesman_list || []) as { key: string; slsId: string; distributorId: string; name: string; rdmId: string; rdmName: string }[]
    let addedCount = 0
    let removedCount = 0

    if (prevList.length > 0) {
      const prevKeys = new Set(prevList.map(s => s.key))
      const newKeys = new Set(ediSalesmanList.map(s => s.key))
      const added = ediSalesmanList.filter(s => !prevKeys.has(s.key))
      const removed = prevList.filter(s => !newKeys.has(s.key))
      addedCount = added.length
      removedCount = removed.length
      if (added.length > 0 || removed.length > 0) {
        const changeRows = [
          ...added.map(s => ({
            changed_at: now.toISOString(), change_type: "added", sls_id: s.slsId, distributor_id: s.distributorId,
            name: s.name, rdm_id: s.rdmId, rdm_name: s.rdmName, prev_total: prevList.length, new_total: ediSalesmanList.length,
          })),
          ...removed.map(s => ({
            changed_at: now.toISOString(), change_type: "removed", sls_id: s.slsId, distributor_id: s.distributorId,
            name: s.name, rdm_id: s.rdmId, rdm_name: s.rdmName, prev_total: prevList.length, new_total: ediSalesmanList.length,
          })),
        ]
        const { error: logErr } = await supabase.from("mpp_salesman_change_log").insert(changeRows)
        if (logErr) throw new Error(`Gagal simpan log perubahan: ${logErr.message}`)
      }
    }

    const snapshotDate = wibDateKey(now)
    const { error: upErr } = await supabase.from("mpp_compare_snapshot").upsert({
      snapshot_date: snapshotDate,
      tahun, periode,
      ficom_lite_active: ficomLiteActive,
      ficom_lite_total: ficomLiteTotal,
      edi_active_salesman: ediActiveSalesman,
      ficom_lite_by_rdm: ficomLiteByRdm,
      ficom_lite_by_adm: ficomLiteByAdm,
      edi_by_rdm: ediByRdm,
      edi_by_adm: ediByAdm,
      edi_salesman_list: ediSalesmanList,
      synced_at: now.toISOString(),
    }, { onConflict: "snapshot_date" })
    if (upErr) throw new Error(`Gagal simpan snapshot: ${upErr.message}`)

    return NextResponse.json({
      success: true, snapshotDate, tahun, periode,
      ficomLiteActive, ficomLiteTotal, ediActiveSalesman,
      houseAccountExcluded: rows.length - activeRows.length,
      selisih: ficomLiteTotal - ediActiveSalesman,
      addedCount, removedCount,
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
