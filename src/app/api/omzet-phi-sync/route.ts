import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Sync "Omzet PHI" — REWRITE TOTAL (sebelumnya pakai EDI200001, dibuang
// sepenuhnya atas permintaan user: EDI200001 butuh trik V06 "Maks Date"
// yang nggak pernah tervalidasi penuh buat histori, plus ada bug dedupe
// duplikat "release" yang baru kebukti kemarin). Sekarang pakai endpoint
// "Main" Ficom yang SAMA dipakai Target Compare (detilChange) —
// dikonfirmasi user via capture:
//   GET /api/dashboard/detilChange/{empId}/OMSET/{YYYY-MM-DD}
// balikin breakdown turunan 1 level di bawah empId, dengan target/nilai/
// persen yang SUDAH dihitung Ficom sendiri per tanggal itu (updDate genuin,
// bukan trik) — hirarki: SD -> RDM -> ADS -> Salesman (leaf).
//
// User minta Pareto/Top10/Top3-wilayah tetap per "ADP", tapi endpoint ini
// CUMA sampai level Salesman (orang), nggak ada kode ADP/distributor sama
// sekali di response-nya. Solusi yang disepakati: pakai level ADS sebagai
// proxy "ADP" (1 ADS = 1 supervisor yang biasanya mengepalai 1 wilayah
// kerja/depot) — lihat jawaban user "pareto nya tetap pakai ADP, bisa
// kamu jadikan level ADS itu".
//
// Wilayah (buat Top3 per wilayah) sekarang diturunkan LANGSUNG dari nama
// RDM (mis. "SGMA - RDM E. Bongosia" -> sub-AOR "SGMA" -> wilayah "GMA",
// ambil 3 huruf terakhir) — dikonfirmasi dari capture user, kode sub-AOR
// ini PERSIS sama kayak kolom "Sub AOR" di file "2026 ADP List - Baji"
// yang pernah dibandingkan. Jadi TIDAK PERLU lagi join ke master_data_adp
// (yang sebelumnya punya masalah ADP ke-skip jadi "Lainnya").
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const METRIC = "OMSET"

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

async function ficomGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${FICOM_BASE}${path}`, { headers: { Authorization: `F1C0m ${token}` } })
  if (!res.ok) throw new Error(`GET ${path} gagal (HTTP ${res.status})`)
  return res.json() as Promise<T>
}

function endOfMonth(tahun: number, periode1to12: number): Date {
  return new Date(tahun, periode1to12, 0) // hari ke-0 bulan depan = akhir bulan ini
}
// "YYYY-MM-DD" — format updDate di detilChange & Ficom Lite missions.
function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Ficom Lite Monthly (componentId "C12") — angka nasional pembanding,
// endpoint TERPISAH dari detilChange (beda sistem di Ficom), dikonfirmasi
// user support param ?date= buat histori juga. Target mentahnya seorder
// sama target_omset EDI200001 dulu (~2,3-2,4jt Peso), jadi TIDAK dikali
// 1000 di sini (beda dari asumsi SCALE=1000 punya target-compare.tsx yang
// buat konteks metrik STT, bukan OMSET).
const FICOM_LITE_STT_COMPONENT = "C12"
interface FicomLiteCard { componentId: string; target: number | null; value: number | null }
interface FicomLiteMissions { monthly: { missions: FicomLiteCard[] } }

async function fetchFicomLiteMonthlyStt(token: string, userId: string, isoDate: string): Promise<{ target: number; value: number } | undefined> {
  const data = await ficomGet<FicomLiteMissions>(`/api/ficom-lite-dashboard/missions?user-id=${userId}&date=${isoDate}`, token)
  const c = (data.monthly?.missions || []).find(c => c.componentId === FICOM_LITE_STT_COMPONENT)
  if (!c || c.value == null || c.target == null) return undefined
  return { target: c.target, value: c.value }
}

// ── Crawl detilChange: SD -> RDM -> ADS -> Salesman ─────────────────
interface DetilNodeData { empId: string | null; empName: string; keterangan: string; target: number; nilai: number; persen: number; empType: number }
interface DetilChild { data: DetilNodeData; children: unknown[]; leaf: boolean }

type CrawlLevel = "RDM" | "ADS" | "SALESMAN"
interface CrawlNode {
  level: CrawlLevel
  emp_id: string
  emp_name: string
  parent_emp_id: string | null
  target: number
  actual: number
}

const CRAWL_CONCURRENCY = 6
function createLimiter(limit: number) {
  let active = 0
  const queue: (() => void)[] = []
  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const attempt = () => {
        active++
        fn().then(resolve, reject).finally(() => {
          active--
          const next = queue.shift()
          if (next) next()
        })
      }
      if (active < limit) attempt()
      else queue.push(attempt)
    })
  }
}

// Sub-AOR dari nama RDM, mis. "SGMA - RDM E. Bongosia" -> "SGMA". Pola &
// konfirmasi SAMA kayak crawlOrgTree di target-compare/page.tsx.
function subAorOf(rdmName: string): string {
  const m = rdmName.match(/^([A-Z]+)\s*-/)
  return m ? m[1] : ""
}
// Wilayah makro (GMA/NOL/SOL/VIS/MIN) = 3 huruf terakhir sub-AOR — semua
// kode sub-AOR yang dicapture user (SGMA/EGMA/NGMA/CNOL/ENOL/WNOL/USOL/
// MSOL/LSOL/NMIN/SMIN/WMIN/CVIS/EVIS/WVIS) selalu diawali 1 huruf arah
// mata angin + 3 huruf wilayah, jadi aman diambil dari belakang.
function wilayahOf(subAor: string): string {
  return subAor.slice(-3)
}

async function crawlAdsTree(token: string, rootEmpId: string, periodDate: string): Promise<CrawlNode[]> {
  const nodes: CrawlNode[] = []
  const limiter = createLimiter(CRAWL_CONCURRENCY)
  const levelForDepth = (d: number): CrawlLevel => d === 1 ? "RDM" : d === 2 ? "ADS" : "SALESMAN"

  async function crawl(empId: string, depth: number) {
    if (depth > 3) return
    const children = await limiter(() => ficomGet<DetilChild[]>(`/api/dashboard/detilChange/${empId}/${METRIC}/${periodDate}`, token))
    const level = levelForDepth(depth)
    for (const c of children) {
      const d = c.data
      if (!d.empId) continue
      nodes.push({ level, emp_id: d.empId, emp_name: d.empName, parent_emp_id: empId, target: Number(d.target) || 0, actual: Number(d.nilai) || 0 })
    }
    const toRecurse = children.filter(c => !c.leaf && c.data.empId)
    await Promise.all(toRecurse.map(c => crawl(c.data.empId!, depth + 1)))
  }
  await crawl(rootEmpId, 1)

  // Ficom cuma isi target/nilai yang akurat di level Salesman (leaf) —
  // level RDM/ADS di atasnya sering 0 di response asli (pelajaran yang
  // sama persis kayak crawlOrgTree di target-compare/page.tsx). Dihitung
  // ulang bottom-up dari jumlah descendant Salesman-nya, bukan percaya
  // field target/nilai bawaan di level non-leaf.
  const childrenOf = new Map<string, CrawlNode[]>()
  for (const n of nodes) {
    if (!n.parent_emp_id) continue
    if (!childrenOf.has(n.parent_emp_id)) childrenOf.set(n.parent_emp_id, [])
    childrenOf.get(n.parent_emp_id)!.push(n)
  }
  function sumLeaves(empId: string): { target: number; actual: number } {
    const kids = childrenOf.get(empId) || []
    let target = 0, actual = 0
    for (const k of kids) {
      if (k.level === "SALESMAN") { target += k.target; actual += k.actual }
      else { const s = sumLeaves(k.emp_id); target += s.target; actual += s.actual }
    }
    return { target, actual }
  }
  for (const n of nodes) {
    if (n.level === "RDM" || n.level === "ADS") {
      const s = sumLeaves(n.emp_id)
      n.target = s.target
      n.actual = s.actual
    }
  }
  return nodes
}

async function runSync(backfill: boolean) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  const { data: sdCred, error: sdErr } = await supabase
    .from("ficom_passwords").select("user_login,password").eq("position", "SD").limit(1).maybeSingle()
  if (sdErr) return NextResponse.json({ error: `Gagal ambil kredensial SD: ${sdErr.message}` }, { status: 500 })
  if (!sdCred?.user_login || !sdCred?.password) {
    return NextResponse.json({ error: 'Belum ada akun posisi "SD" di Master Data → Ficom Password' }, { status: 400 })
  }

  try {
    const now = new Date()
    const curYear = now.getFullYear()
    const curMonth = now.getMonth() + 1
    const token = await ficomLogin(sdCred.user_login, sdCred.password)

    // backfill=false (tombol "Sync Hari Ini") → cuma bulan berjalan.
    // backfill=true (tombol "Tarik Histori") → Januari s/d bulan ini,
    // SEKUENSIAL antar-bulan (pelajaran dari EDI200001 dulu — walau
    // detilChange sendiri toleran dipanggil paralel pakai limiter(6)
    // DALAM 1 bulan, antar-bulan tetap sekuensial buat jaga-jaga).
    const months = backfill
      ? Array.from({ length: curMonth }, (_, i) => i + 1)
      : [curMonth]

    const results: { periodMonth: string; rows: number }[] = []
    for (const m of months) {
      const isCurrentMonth = m === curMonth
      const cutoff = isCurrentMonth ? now : endOfMonth(curYear, m)
      const periodDate = toIsoDate(cutoff)
      const periodMonth = `${curYear}-${String(m).padStart(2, "0")}`

      const nodes = await crawlAdsTree(token, sdCred.user_login, periodDate)
      const rdmByEmpId = new Map(nodes.filter(n => n.level === "RDM").map(n => [n.emp_id, n]))
      const adsNodes = nodes.filter(n => n.level === "ADS")

      const dbRows = adsNodes.map(n => {
        const rdm = n.parent_emp_id ? rdmByEmpId.get(n.parent_emp_id) : undefined
        const subAor = subAorOf(rdm?.emp_name || "")
        return {
          period_month: periodMonth,
          emp_id: n.emp_id,
          emp_name: n.emp_name,
          rdm_emp_id: n.parent_emp_id,
          rdm_name: rdm?.emp_name || null,
          sub_aor: subAor || null,
          wilayah: subAor ? wilayahOf(subAor) : null,
          target: n.target,
          nilai: n.actual,
          persen: n.target > 0 ? Math.round((n.actual / n.target) * 1000) / 10 : 0,
          period_date: periodDate,
          synced_at: now.toISOString(),
        }
      })

      if (dbRows.length > 0) {
        const { error: upErr } = await supabase.from("omzet_phi_snapshot").upsert(dbRows, { onConflict: "period_month,emp_id" })
        if (upErr) throw new Error(`Gagal simpan periode ${periodMonth}: ${upErr.message}`)
      }
      results.push({ periodMonth, rows: dbRows.length })

      const stt = await fetchFicomLiteMonthlyStt(token, sdCred.user_login, periodDate)
      if (stt) {
        const { error: refErr } = await supabase
          .from("omzet_phi_ficomlite_ref")
          .upsert({ period_month: periodMonth, target: stt.target, value: stt.value, synced_at: now.toISOString() }, { onConflict: "period_month" })
        if (refErr) throw new Error(`Gagal simpan Ficom Lite Monthly: ${refErr.message}`)
      }
    }

    return NextResponse.json({ success: true, results, syncedAt: now.toISOString() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync Omzet PHI: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}

// Belum ada cron otomatis (sesuai permintaan, hindari biaya) — manual aja.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return runSync(false)
}

// body { backfill: true } → tombol "Tarik Histori dari Ficom" (Jan s/d
// bulan ini). Tanpa body / backfill:false → tombol "Sync Hari Ini".
export async function POST(req: NextRequest) {
  let backfill = false
  try {
    const body = await req.json()
    backfill = !!body?.backfill
  } catch {
    // body kosong — default backfill=false
  }
  return runSync(backfill)
}
