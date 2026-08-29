import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Sync "MPP Health" — GANTI logic n8n yang lama (baca subdist_list dari
// tabel yang ditulis n8n) dengan tarik LANGSUNG dari API Ficom Lite.
//
// Endpoint api/ficom-lite-dashboard/mpp?user-id=<SD> BEDA dari
// api/ficom-lite-dashboard/team yang dipakai productivity-compare — di
// sini SATU call langsung balikin SELURUH hierarki (RDM→ADM→ADS→
// Salesman) sebagai tree bersarang (field "children"), TIDAK perlu
// rekursif banyak call kayak "team". Makanya sync ini aman jalan di
// server (API route + Vercel Cron), tidak perlu client-side kayak
// crawlFicomLiteTeam di productivity-compare.
//
// Definisi (dikonfirmasi user):
//   - "subdist" = node ber-empType ADM (bukan RDM/ADS).
//   - MPP HEALTH bermasalah kalau: (a) SEMUA salesman (leaf) di bawah
//     ADM itu isUpdate:false, ATAU (b) ADM itu sama sekali tidak punya
//     leaf salesman (kemungkinan error/data tidak tampil di Ficom) —
//     BUKAN cuma menghitung yang tidak aktif satu-satu (itu tugas tab
//     SFA Activity yang terpisah).
//   - SFA ACTIVITY = daftar tiap leaf salesman individual yang
//     isUpdate:false, dikelompokkan per RDM/ADM/ADS.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"

interface MppNodeData {
  empId: string; empNm: string; superiorId: string | null
  salesforce: string | null; empType: number
  countMppActive: number | null; countMpp: number | null
  hka: number; hke: number; lastDate: string; isUpdate: boolean
}
interface MppNode { data: MppNodeData; children: MppNode[]; leaf: boolean }

// empType: 3=RDM, 2=ADM ("subdist"), 1=ADS, 0=Salesman (leaf) —
// dikonfirmasi dari capture user (WF1002 RDM=3, WF1105 ADM=2, WF0066 ADS=1,
// leaf salesman=0).
const EMP_TYPE = { RDM: 3, ADM: 2, ADS: 1, SALESMAN: 0 } as const

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

async function fetchMppTree(token: string, sdEmpId: string): Promise<MppNode[]> {
  const res = await fetch(`${FICOM_BASE}/api/ficom-lite-dashboard/mpp?user-id=${sdEmpId}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!res.ok) throw new Error(`GET mpp gagal (HTTP ${res.status})`)
  return res.json()
}

interface LeafInfo { salesman_name: string; last_date: string; isUpdate: boolean }

// Kumpulkan SEMUA leaf salesman di bawah satu node, TERLEPAS berapa
// level dalamnya (ADS bisa langsung punya leaf, atau ada level lain di
// antaranya) — dicek by leaf:true / empType SALESMAN, bukan asumsi depth tetap.
function collectLeaves(node: MppNode): LeafInfo[] {
  if (node.leaf || node.data.empType === EMP_TYPE.SALESMAN) {
    return [{ salesman_name: node.data.empNm, last_date: node.data.lastDate, isUpdate: node.data.isUpdate }]
  }
  return node.children.flatMap(collectLeaves)
}

async function runSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Akun SD sama dengan yang dipakai target-compare/productivity-compare
  // (Master Data → Ficom Password, posisi "SD") — user_login-nya = emp_id
  // SD yang dipakai sebagai user-id di URL (mis. "WF6001").
  const { data: sdCred, error: credErr } = await supabase
    .from("ficom_passwords")
    .select("user_login,password")
    .eq("position", "SD")
    .limit(1)
    .maybeSingle()
  if (credErr) return NextResponse.json({ error: `Gagal ambil kredensial: ${credErr.message}` }, { status: 500 })
  if (!sdCred?.user_login || !sdCred?.password) {
    return NextResponse.json({ error: 'Belum ada akun posisi "SD" di Master Data → Ficom Password' }, { status: 400 })
  }

  try {
    const token = await ficomLogin(sdCred.user_login, sdCred.password)
    const tree = await fetchMppTree(token, sdCred.user_login)

    const subdistList: { wf: string; name: string; impacted_salesman: number; reason: string }[] = []
    const rdmZero = new Set<string>(), admZero = new Set<string>(), adsZero = new Set<string>()
    const alertDetail: { rdm_name: string; adm_name: string; ads_name: string; salesman_name: string; last_date: string }[] = []

    function walkAdm(admNode: MppNode, rdmName: string) {
      const leaves = collectLeaves(admNode)
      const noData = leaves.length === 0
      const allInactive = !noData && leaves.every(l => !l.isUpdate)
      if (noData || allInactive) {
        subdistList.push({
          wf: admNode.data.empId, name: admNode.data.empNm,
          impacted_salesman: leaves.length,
          reason: noData ? "Tidak ada data salesman (kemungkinan error Ficom)" : "Semua salesman tidak aktif",
        })
        rdmZero.add(rdmName); admZero.add(admNode.data.empId)
      }
      // SFA Activity: per leaf individual, LEPAS dari status subdist di
      // atas (subdist yang cuma SEBAGIAN tidak aktif tidak masuk MPP
      // Health, tapi tiap salesman-nya yang tidak aktif tetap dicatat di sini).
      for (const ads of admNode.children) {
        for (const leaf of collectLeaves(ads)) {
          if (!leaf.isUpdate) {
            alertDetail.push({
              rdm_name: rdmName, adm_name: admNode.data.empNm, ads_name: ads.data.empNm,
              salesman_name: leaf.salesman_name, last_date: leaf.last_date,
            })
            adsZero.add(ads.data.empId)
          }
        }
      }
    }

    // Rekursif & depth-agnostic — cari node ADM di mana pun dia muncul,
    // bukan asumsi RDM selalu persis di top-level.
    function walkTree(nodes: MppNode[], rdmName: string | null) {
      for (const node of nodes) {
        const currentRdmName = node.data.empType === EMP_TYPE.RDM ? node.data.empNm : rdmName
        if (node.data.empType === EMP_TYPE.ADM) walkAdm(node, currentRdmName || node.data.empNm)
        walkTree(node.children, currentRdmName)
      }
    }
    walkTree(tree, null)

    const subdistIssue = subdistList.length
    const impactedSalesman = subdistList.reduce((s, x) => s + x.impacted_salesman, 0)
    const now = new Date().toISOString()

    const { error: e1 } = await supabase.from("m_dashboard_health").insert([{
      snapshot_time: now,
      status: subdistIssue === 0 ? "HEALTHY" : "WARNING",
      subdist_issue: subdistIssue,
      impacted_salesman: impactedSalesman,
      rdm_active_zero: rdmZero.size, adm_active_zero: admZero.size, ads_active_zero: adsZero.size,
      subdist_list: subdistList,
      message: subdistIssue === 0 ? "Semua subdist healthy" : `${subdistIssue} subdist bermasalah`,
    }])
    if (e1) throw new Error(`Insert m_dashboard_health: ${e1.message}`)

    // total_rdm/total_adm/total_ads di sini itu utk tab SFA ACTIVITY —
    // "ADM/RDM/ADS manapun yang punya MINIMAL 1 salesman tidak update
    // hari ini", BEDA dari rdmZero/admZero/adsZero di atas (itu utk tab
    // MPP HEALTH — subdist yang SELURUHNYA mati/tanpa data). Ketiganya
    // dibangun konsisten dari alertDetail yang sama.
    const rdmCounts = new Map<string, number>(), admCounts = new Map<string, number>(), adsCounts = new Map<string, number>()
    for (const d of alertDetail) {
      rdmCounts.set(d.rdm_name, (rdmCounts.get(d.rdm_name) || 0) + 1)
      admCounts.set(d.adm_name, (admCounts.get(d.adm_name) || 0) + 1)
      adsCounts.set(d.ads_name, (adsCounts.get(d.ads_name) || 0) + 1)
    }
    const topRdm = [...rdmCounts.entries()].sort((a, b) => b[1] - a[1])[0]
    const topAds = [...adsCounts.entries()].sort((a, b) => b[1] - a[1])[0]

    const { error: e2 } = await supabase.from("mpp_alert_snapshot").insert([{
      snapshot_time: now,
      total_not_update: alertDetail.length,
      total_rdm: rdmCounts.size, total_adm: admCounts.size, total_ads: adsCounts.size,
      top_rdm: topRdm?.[0] || null, top_rdm_count: topRdm?.[1] || 0,
      top_ads: topAds?.[0] || null, top_ads_count: topAds?.[1] || 0,
    }])
    if (e2) throw new Error(`Insert mpp_alert_snapshot: ${e2.message}`)

    // mpp_alert_detail: REPLACE (bukan accumulate) — halaman cuma pernah
    // baca 500 baris terbaru sbg "daftar alert saat ini", bukan histori,
    // jadi baris snapshot lama dibuang biar tabel tidak membengkak terus.
    await supabase.from("mpp_alert_detail").delete().lt("snapshot_time", now)
    const rows = alertDetail.map(d => ({ ...d, snapshot_time: now }))
    const chunk = 500
    for (let i = 0; i < rows.length; i += chunk) {
      const { error: e3 } = await supabase.from("mpp_alert_detail").insert(rows.slice(i, i + chunk))
      if (e3) throw new Error(`Insert mpp_alert_detail: ${e3.message}`)
    }

    return NextResponse.json({
      success: true, subdistIssue, impactedSalesman, totalNotUpdate: alertDetail.length, syncedAt: now,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync MPP Health: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}

// Dipanggil Vercel Cron (lihat vercel.json) — GANTI jadwal n8n yang lama.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return runSync()
}

// Dipanggil tombol "Sync dari Ficom" di halaman MPP Health.
export async function POST() {
  return runSync()
}
