"use client"
// PATH: src/app/dashboard/target-compare/page.tsx

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import {
  Upload, CheckCircle, RefreshCw, FileSpreadsheet,
  Search, TriangleAlert, TrendingUp, Trash2, Settings, ChevronUp, ChevronDown
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Types ─────────────────────────────────────────────────────
interface ExcelRow {
  aor: string
  sub_aor: string
  adp_code: string
  depot: string
  sp: string
  salesman_code: string
  salesman_name: string
  route: string
  skugroup: string
  division: string
  sku_code: string
  sku_description: string
  target_amount: number
  target_cases: number
}

interface DepotLite {
  adp_code: string
  depot: string
  adm_name: string
  ads_name: string
  rdm_name: string
  region_name: string
}

interface RollupRow {
  key: string
  label: string
  sub?: string
  targetAmount: number
  targetCases: number
  count: number
  adpCodes: Set<string>
}

interface FicomAgg { target: number; actual: number }

interface FicomChildData {
  empId: string | null
  empName: string
  keterangan: string
  target: number
  nilai: number
  persen: number
  empType: number
  flag: string | null
}
interface FicomChild { data: FicomChildData; children: unknown[]; leaf: boolean }
interface FicomCategoryItem { id: string; name: string; target: number; omset: number; ach: number }

interface FicomOrgNode {
  period_date: string
  level: "SD" | "RDM" | "ADM_ADS" | "SALESMAN"
  emp_id: string | null
  emp_name: string
  parent_emp_id: string | null
  emp_type: number | null
  keterangan: string
  target: number
  actual: number
  persen: number
  raw: unknown
}
interface FicomCatNode {
  period_date: string
  superior_emp_id: string
  level: "DIVISION" | "SUBBRAND" | "PRODUCT"
  category_id: string
  category_name: string
  parent_category_id: string | null
  target: number
  omset: number
  ach_pct: number
  raw: unknown
}
// Breakdown per Salesman INDIVIDUAL di bawah satu ADP/distributor (endpoint
// team/sls) — beda dari node level SALESMAN di ficom_target_nodes yang
// cuma bisa dicocokkan ke ADP lewat regex nama (nggak reliable). Di sini
// distributorId dikasih eksplisit sebagai parameter, jadi exact-match
// ke ADP CODE Excel, dan salesman_id-nya berdiri sendiri per orang.
interface FicomSalesmanRow {
  period_date: string
  spv_emp_id: string | null
  adp_code: string
  salesman_id: string
  salesman_name: string
  target: number
  omset: number
  raw: unknown
}
const MONTH_ID: Record<string, string> = {
  januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06",
  juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12",
}

function guessPeriod(filename: string): string {
  const now = new Date()
  const lower = filename.toLowerCase()
  const yearMatch = lower.match(/20\d{2}/)
  const year = yearMatch ? yearMatch[0] : String(now.getFullYear())
  for (const [name, num] of Object.entries(MONTH_ID)) {
    if (lower.includes(name)) return `${year}-${num}`
  }
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

const fmt = (n: number) => Math.round(n).toLocaleString("id-ID")

// Format tanggal buat query param updDate di endpoint team/sls, mis. "22 AUG 2026"
// (dari ficomDate yang formatnya ISO "YYYY-MM-DD" dari <input type="date">).
const FICOM_MONTH_EN = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
function formatFicomDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return `${String(d.getDate()).padStart(2, "0")} ${FICOM_MONTH_EN[d.getMonth()]} ${d.getFullYear()}`
}

// Prefix Sub AOR di emp_name level RDM, mis. "EGMA - RDM E. Bongosia" → "EGMA"
function extractSubAor(name: string): string | null {
  const m = name.match(/^([A-Z]{3,6})\s*-\s*(RDM|ADM|ADS)/)
  return m ? m[1] : null
}
// Sama, tapi buat rdm_name dari master_data_adp yang formatnya
// "WF5002-SMIN - RDM A. Garillos" (kode Sub AOR di tengah, bukan di awal)
function extractSubAorFromMasterName(name: string): string | null {
  const m = name.match(/-([A-Z]{3,6})\s*-\s*RDM/)
  return m ? m[1] : null
}
// Normalisasi emp_name ADM/ADS Ficom (mis. "MSA-CAVITE - ADM J. Briones")
// buat dipakai sebagai key pencocokan ANTAR DUA TREE FICOM SENDIRI (Main
// via detilChange vs Dashboard Category via group-div) — BUKAN ke Excel.
// Kedua tree ini sama-sama pakai format lengkap "LOKASI - ADM/ADS Nama"
// (dikonfirmasi dari screenshot Ficom user), jadi full-name matching aman
// dipakai di sini, TIDAK boleh dipotong jadi nama orang saja: satu orang
// ADM/ADS bisa pegang lebih dari satu ADP/lokasi sekaligus (mis. "J.
// Briones" pegang MSA-CAVITE DAN MSA-IMUS) — kalau di-strip ke nama orang
// doang, dua node beda lokasi itu akan TABRAKAN di satu key Map yang sama
// dan saling menimpa (yang belakangan menang buat SEMUA node orang itu),
// persis bug yang bikin "Ficom Dash. Category" MSA-CAVITE ADM J. Briones
// nyasar keluar angka MSA-IMUS.
function normalizeEmpName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase()
}
// salesman_id Ficom (team/sls) BEDA sistem penomoran dengan SALESMAN CODE
// Excel — jadi dicocokkan lewat nama, bukan ID. Nama Ficom formatnya
// "LASTNAME , FIRSTNAME - V1 SALESMAN - ROUTE - KATEGORI"; nama Excel
// "LASTNAME, FIRSTNAME" (tanpa embel-embel). Ambil bagian sebelum penanda
// "- V.. SALESMAN", lalu buang semua spasi + uppercase biar toleran beda
// spasi/kapital antar dua sumber.
function normalizeSalesmanName(raw: string): string {
  const namePart = raw.split(/\s*-\s*V\d*\s*SALESMAN/i)[0] || raw
  return namePart.replace(/\s+/g, "").toUpperCase()
}

// Level "SALESMAN" hasil crawlOrgTree (detilChange depth 3) TERNYATA bukan
// individual orang — itu breakdown ADS PER-DISTRIBUTOR, formatnya "PREFIX-
// LOKASI - ADS Nama Orang - ADPCODE - Nama Distributor - Lokasi" (mis.
// "MAGIS-PASIG - ADS R. Alejandro - 100019 - MAGIS II DISTRIBUTION INC. -
// PASIG"). emp_id di level ini (mis. "WF0073") PERSIS sama dengan spvId
// yang dibutuhkan endpoint team/sls (dikonfirmasi cocok dengan capture
// manual: spvId=WF0073&distributorId=100019) — jadi spvId & distributorId
// diambil LANGSUNG dari sini, tidak perlu lagi cocokkan ke Master Data
// (yang gagal karena beda ID namespace sama sekali dari emp_id ADM/ADS).
function extractAdpCodeFromDistName(name: string): string | null {
  const m = name.match(/-\s*(\d{5,7})\s*-/)
  return m ? m[1] : null
}

// ── Ficom API (dipanggil langsung dari browser — endpoint-nya kirim
//    Access-Control-Allow-Origin: * jadi tidak perlu proxy server) ──
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"

// Batas concurrency buat semua request paralel ke Ficom selama satu sync —
// dulu SEMUA crawl (SD→RDM→ADM/ADS→Salesman, breakdown per-ADP, Division→
// Subbrand) jalan SATU-SATU (sequential await di dalam for-loop) + jeda
// 150ms tiap node, bikin sync hierarki nasional (ratusan ADP/distributor)
// bisa makan waktu berMENIT-menit. limiter di bawah bikin request jalan
// PARALEL tapi tetap dibatasi (BUKAN unbounded Promise.all) — biar cepat
// tanpa dianggap serangan/di-block server Ficom.
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

async function ficomLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${FICOM_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`Login Ficom gagal (HTTP ${res.status}) — cek username/password`)
  const data = await res.json()
  if (!data?.token) throw new Error("Login Ficom gagal: response tidak ada token")
  return data.token as string
}

async function ficomGet<T>(path: string, token: string): Promise<T> {
  // Ficom pakai custom auth scheme, BUKAN "Bearer <token>" standar
  const res = await fetch(`${FICOM_BASE}${path}`, { headers: { Authorization: `F1C0m ${token}` } })
  if (!res.ok) throw new Error(`GET ${path} gagal (HTTP ${res.status})`)
  return res.json() as Promise<T>
}

// Dimensi ORGANISASI: SD → RDM → ADM/ADS → Salesman (endpoint detilChange, rekursif)
// Metric = OMSET — "STT" di Main tab cuma label UI, drill-nya sendiri tetap
// pakai keterangan=OMSET (dikonfirmasi dari capture request user).
// detilChange balikin angka dalam ribuan (mis. 290.263 = 290.263.000),
// jadi dikali 1000 di sini.
// Level SD TIDAK dari group-div (skalanya beda / tidak konsisten) —
// dihitung bottom-up dari jumlah seluruh RDM biar konsisten satu metric.
async function crawlOrgTree(token: string, rootEmpId: string, periodDate: string, log: (m: string) => void): Promise<FicomOrgNode[]> {
  const nodes: FicomOrgNode[] = []
  // "STT" di label UI Main tab ternyata cuma tampilan — klik drill-nya tetap
  // manggil detilChange dengan keterangan="OMSET" di baliknya (dikonfirmasi
  // dari capture request user). Jadi keyword URL yang valid tetap OMSET.
  const METRIC = "OMSET"
  const SCALE = 1000

  const levelForDepth = (d: number): FicomOrgNode["level"] => d === 1 ? "RDM" : d === 2 ? "ADM_ADS" : "SALESMAN"
  const limiter = createLimiter(CRAWL_CONCURRENCY)

  async function crawl(empId: string, depth: number) {
    if (depth > 3) return
    const children = await limiter(() => ficomGet<FicomChild[]>(`/api/dashboard/detilChange/${empId}/${METRIC}/${periodDate}`, token))
    const level = levelForDepth(depth)
    for (const c of children) {
      const d = c.data
      nodes.push({
        period_date: periodDate, level, emp_id: d.empId, emp_name: d.empName,
        parent_emp_id: empId, emp_type: d.empType, keterangan: d.keterangan,
        target: (Number(d.target) || 0) * SCALE, actual: (Number(d.nilai) || 0) * SCALE, persen: Number(d.persen) || 0, raw: d,
      })
    }
    log(`✅ ${level}: ${children.length} node dari ${empId}`)
    const toRecurse = children.filter(c => !c.leaf && c.data.empId)
    await Promise.all(toRecurse.map(c => crawl(c.data.empId!, depth + 1)))
  }
  await crawl(rootEmpId, 1)

  // Ficom cuma isi target STT yang akurat di level Salesman (leaf) — level
  // RDM/ADM-ADS di atasnya sering 0 di response asli. Jadi dihitung ulang
  // bottom-up dari jumlah descendant Salesman-nya, bukan percaya field
  // "target" bawaan di level non-leaf.
  const childrenOf = new Map<string, FicomOrgNode[]>()
  for (const n of nodes) {
    if (!n.parent_emp_id) continue
    if (!childrenOf.has(n.parent_emp_id)) childrenOf.set(n.parent_emp_id, [])
    childrenOf.get(n.parent_emp_id)!.push(n)
  }
  function sumLeaves(empId: string): FicomAgg {
    const kids = childrenOf.get(empId) || []
    let target = 0, actual = 0
    for (const k of kids) {
      if (k.level === "SALESMAN") { target += k.target; actual += k.actual }
      else if (k.emp_id) { const s = sumLeaves(k.emp_id); target += s.target; actual += s.actual }
    }
    return { target, actual }
  }
  for (const n of nodes) {
    if ((n.level === "RDM" || n.level === "ADM_ADS") && n.emp_id) {
      const s = sumLeaves(n.emp_id)
      n.target = s.target
      n.actual = s.actual
    }
  }

  const rdmNodes = nodes.filter(n => n.level === "RDM")
  const sdTarget = rdmNodes.reduce((s, n) => s + n.target, 0)
  const sdActual = rdmNodes.reduce((s, n) => s + n.actual, 0)
  nodes.unshift({
    period_date: periodDate, level: "SD", emp_id: rootEmpId, emp_name: `${rootEmpId} — Total ${METRIC} (jumlah semua RDM)`,
    parent_emp_id: null, emp_type: null, keterangan: METRIC,
    target: sdTarget, actual: sdActual, persen: sdTarget ? sdActual / sdTarget * 100 : 0, raw: null,
  })
  log(`✅ SD (jumlah ${rdmNodes.length} RDM): target ${fmt(sdTarget)}`)

  return nodes
}

// Dimensi ORGANISASI KEDUA — SD → RDM → ADM/ADS → Salesman, tapi lewat jalur
// "Dashboard Category" Ficom (group-div), bukan Main (detilChange). Beda
// penting: angkanya SUDAH full-scale (TIDAK dikali 1000), dan target di tiap
// node sendiri sudah akurat (tidak perlu bottom-up recompute kayak Main —
// dikonfirmasi dari capture: RDM level di sini sudah cocok langsung ke Excel).
// gdivId dari SD ("002" = grup "PHI Sales Team") dipakai konstan buat semua
// panggilan rekursif user/group-div di bawahnya.
async function crawlDashCategoryTree(token: string, rootEmpId: string, periodDate: string, log: (m: string) => void): Promise<{ nodes: FicomOrgNode[]; gdivId: string }> {
  const nodes: FicomOrgNode[] = []
  const root = await ficomGet<FicomCategoryItem[]>(`/api/dashboard/new/group-div?superiorId=${rootEmpId}`, token)
  const sdItem = root[0]
  if (!sdItem) throw new Error("Dashboard Category: group-div tidak mengembalikan data")
  const gdivId = sdItem.id
  nodes.push({
    period_date: periodDate, level: "SD", emp_id: rootEmpId, emp_name: sdItem.name,
    parent_emp_id: null, emp_type: null, keterangan: "OMSET",
    target: Number(sdItem.target) || 0, actual: Number(sdItem.omset) || 0, persen: Number(sdItem.ach) || 0, raw: sdItem,
  })
  log(`✅ SD (Dashboard Category): ${sdItem.name} — target ${fmt(Number(sdItem.target) || 0)}`)

  const levelForDepth = (d: number): FicomOrgNode["level"] => d === 1 ? "RDM" : d === 2 ? "ADM_ADS" : "SALESMAN"
  const limiter = createLimiter(CRAWL_CONCURRENCY)

  async function crawl(empId: string, depth: number) {
    if (depth > 3) return
    const children = await limiter(() => ficomGet<FicomCategoryItem[]>(`/api/dashboard/new/user/group-div?userId=${empId}&gdivId=${gdivId}`, token))
    const level = levelForDepth(depth)
    for (const c of children) {
      nodes.push({
        period_date: periodDate, level, emp_id: c.id, emp_name: c.name,
        parent_emp_id: empId, emp_type: null, keterangan: "OMSET",
        target: Number(c.target) || 0, actual: Number(c.omset) || 0, persen: Number(c.ach) || 0, raw: c,
      })
    }
    log(`✅ ${level} (Dashboard Category): ${children.length} node dari ${empId}`)
    await Promise.all(children.map(c => crawl(c.id, depth + 1)))
  }
  await crawl(rootEmpId, 1)
  return { nodes, gdivId }
}

// Dimensi PRODUK: Division → Subbrand → Product (SKU individual).
// Ficom TERNYATA punya data sampai produk individual (dikonfirmasi dari
// capture manual user, endpoint /api/dashboard/new/product/subbrand) —
// sebelumnya diasumsikan mentok di Subbrand, itu salah, cuma endpoint-nya
// belum ditemukan. Field pcode di response-nya SELALU null, jadi TIDAK
// ada ID resmi yang cocok ke SKU CODE Excel — pencocokan ke Excel harus
// lewat NAMA produk (category_name Ficom ↔ sku_description Excel),
// bukan ID, konsisten dengan pola project ini tiap kali sistem ID Ficom
// beda dari sistem ID Excel (lihat normalizeSalesmanName, normalizeEmpName).
async function crawlProductTree(token: string, superiorEmpId: string, periodDate: string, log: (m: string) => void): Promise<FicomCatNode[]> {
  const nodes: FicomCatNode[] = []
  // teamId wajib diisi server (400 kalau kosong) — "002" adalah nilai yang terbukti jalan
  const divisions = await ficomGet<FicomCategoryItem[]>(`/api/dashboard/new/class-team/team?superiorId=${superiorEmpId}&teamId=002`, token)
  for (const d of divisions) {
    nodes.push({ period_date: periodDate, superior_emp_id: superiorEmpId, level: "DIVISION", category_id: d.id, category_name: d.name, parent_category_id: null, target: Number(d.target) || 0, omset: Number(d.omset) || 0, ach_pct: Number(d.ach) || 0, raw: d })
  }
  log(`✅ Division: ${divisions.length}`)

  const subbrandNodes: FicomCatNode[] = []
  const limiter = createLimiter(CRAWL_CONCURRENCY)
  await Promise.all(divisions.map(async d => {
    const subbrands = await limiter(() => ficomGet<FicomCategoryItem[]>(`/api/dashboard/new/subbrand/class-team?superiorId=${superiorEmpId}&classTeamId=${d.id}`, token))
    for (const s of subbrands) {
      const node: FicomCatNode = { period_date: periodDate, superior_emp_id: superiorEmpId, level: "SUBBRAND", category_id: s.id, category_name: s.name, parent_category_id: d.id, target: Number(s.target) || 0, omset: Number(s.omset) || 0, ach_pct: Number(s.ach) || 0, raw: s }
      nodes.push(node)
      subbrandNodes.push(node)
    }
    log(`✅ Subbrand di ${d.name}: ${subbrands.length}`)
  }))

  // Produk per Subbrand — bisa banyak (satu request per subbrand, jumlah
  // subbrand nasional bisa puluhan), jadi tetap lewat limiter yang sama.
  // Per-subbrand DIISOLASI try/catch — satu gagal (mis. HTTP 400/timeout,
  // atau subbrand yang memang tidak punya produk terdaftar) TIDAK boleh
  // menggagalkan seluruh Promise.all dan bikin SEMUA node (termasuk
  // Divisi/Subbrand yang sudah berhasil) ikut hilang.
  const productLimiter = createLimiter(CRAWL_CONCURRENCY)
  let productFailed = 0
  await Promise.all(subbrandNodes.map(async sb => {
    try {
      const products = await productLimiter(() => ficomGet<FicomCategoryItem[]>(`/api/dashboard/new/product/subbrand?superiorId=${superiorEmpId}&subbrandId=${sb.category_id}`, token))
      for (const p of products) {
        nodes.push({ period_date: periodDate, superior_emp_id: superiorEmpId, level: "PRODUCT", category_id: String(p.id), category_name: p.name, parent_category_id: sb.category_id, target: Number(p.target) || 0, omset: Number(p.omset) || 0, ach_pct: Number(p.ach) || 0, raw: p })
      }
      log(`✅ Produk di ${sb.category_name}: ${products.length}`)
    } catch (e) {
      productFailed++
      log(`⚠ Produk di ${sb.category_name} gagal: ${e instanceof Error ? e.message : String(e)}`)
    }
  }))
  if (productFailed) log(`ℹ️ ${productFailed} dari ${subbrandNodes.length} subbrand gagal ditarik produknya (lihat log di atas)`)
  return nodes
}

// Breakdown Salesman per ADP — dipanggil sekali per node ADM/ADS hasil
// crawlOrgTree (spvId = emp_id ADS itu sendiri, distributorId = kode ADP
// yang di-extract dari nama ADS-nya). Ini sumber yang BENAR buat cocokkan
// target ke level Salesman/ADP Excel — beda dari node SALESMAN di
// detilChange yang cuma bisa dicocokkan lewat regex nama (nggak reliable,
// karena banyak salesman per ADP bisa saling menimpa).
async function crawlSalesmanForDistributor(token: string, spvId: string, adpCode: string, periodDate: string, dateStr: string, log: (m: string) => void): Promise<FicomSalesmanRow[]> {
  const items = await ficomGet<FicomCategoryItem[]>(`/api/dashboard/new/team/sls?spvId=${spvId}&distributorId=${adpCode}&updDate=${encodeURIComponent(dateStr)}&teamId=002`, token)
  const rows = items.map(it => ({
    period_date: periodDate, spv_emp_id: spvId, adp_code: adpCode,
    salesman_id: it.id, salesman_name: it.name,
    target: Number(it.target) || 0, omset: Number(it.omset) || 0, raw: it,
  }))
  log(`✅ Salesman ADP ${adpCode}: ${rows.length} orang`)
  return rows
}

async function crawlAllSalesmen(token: string, distNodes: FicomOrgNode[], periodDate: string, dateStr: string, log: (m: string) => void): Promise<FicomSalesmanRow[]> {
  const all: FicomSalesmanRow[] = []
  let skippedNoCode = 0
  let failed = 0
  const limiter = createLimiter(CRAWL_CONCURRENCY)
  // distNodes bisa ratusan (satu per ADP/distributor) — dulu ini bagian
  // TERLAMA di seluruh sync karena sequential satu-satu. Sekarang paralel
  // (dibatasi limiter), tapi tiap distributor tetap diisolasi try/catch —
  // satu gagal (mis. HTTP 400/401) TIDAK boleh menggagalkan yang lain.
  await Promise.all(distNodes.map(async n => {
    if (!n.emp_id) return
    const adpCode = extractAdpCodeFromDistName(n.emp_name)
    if (!adpCode) { skippedNoCode++; return }
    try {
      const rows = await limiter(() => crawlSalesmanForDistributor(token, n.emp_id!, adpCode, periodDate, dateStr, log))
      all.push(...rows)
    } catch (e) {
      failed++
      log(`⚠ Salesman ADP ${adpCode} (spv ${n.emp_id}, "${n.emp_name}") gagal: ${e instanceof Error ? e.message : String(e)}`)
    }
  }))
  log(`ℹ️ Ringkasan crawl Salesman: ${all.length} orang dari ${distNodes.length - skippedNoCode - failed} spv-distributor berhasil, ${skippedNoCode} nama tidak ada kode ADP, ${failed} gagal request`)
  return all
}

// Breakdown Salesman per ADP jalur DASHBOARD CATEGORY — endpoint paralel
// dari team/sls (dikonfirmasi dari capture manual user), formatnya SAMA
// PERSIS (id/name/target/omset, nama "LASTNAME, FIRSTNAME - V.. SALESMAN -
// ROUTE - KATEGORI") jadi normalizeSalesmanName yang sudah ada bisa dipakai
// ulang tanpa perlu parser baru. spvId+adpCode SENGAJA diambil dari sumber
// yang SAMA dengan team/sls (breakdown ADS-per-distributor di Main tree,
// via distNodes+extractAdpCodeFromDistName) — BUKAN dari node ADM/ADS
// Dashboard Category (yang namanya beda format, tidak mengandung kode ADP)
// — biar tidak perlu asumsi baru soal cross-tree emp_id matching yang
// belum terverifikasi.
async function crawlDashSalesmanForDistributor(token: string, spvId: string, adpCode: string, divId: string, periodDate: string, dateStr: string, log: (m: string) => void): Promise<FicomSalesmanRow[]> {
  const items = await ficomGet<FicomCategoryItem[]>(`/api/dashboard/new/div/sls?spvId=${spvId}&distributorId=${adpCode}&updDate=${encodeURIComponent(dateStr)}&divId=${divId}`, token)
  const rows = items.map(it => ({
    period_date: periodDate, spv_emp_id: spvId, adp_code: adpCode,
    salesman_id: it.id, salesman_name: it.name,
    target: Number(it.target) || 0, omset: Number(it.omset) || 0, raw: it,
  }))
  log(`✅ Salesman (Dash. Category) ADP ${adpCode}: ${rows.length} orang`)
  return rows
}

async function crawlAllDashSalesmen(token: string, distNodes: FicomOrgNode[], divId: string, periodDate: string, dateStr: string, log: (m: string) => void): Promise<FicomSalesmanRow[]> {
  const all: FicomSalesmanRow[] = []
  let skippedNoCode = 0
  let failed = 0
  const limiter = createLimiter(CRAWL_CONCURRENCY)
  await Promise.all(distNodes.map(async n => {
    if (!n.emp_id) return
    const adpCode = extractAdpCodeFromDistName(n.emp_name)
    if (!adpCode) { skippedNoCode++; return }
    try {
      const rows = await limiter(() => crawlDashSalesmanForDistributor(token, n.emp_id!, adpCode, divId, periodDate, dateStr, log))
      all.push(...rows)
    } catch (e) {
      failed++
      log(`⚠ Salesman (Dash. Category) ADP ${adpCode} (spv ${n.emp_id}, "${n.emp_name}") gagal: ${e instanceof Error ? e.message : String(e)}`)
    }
  }))
  log(`ℹ️ Ringkasan crawl Salesman Dash. Category: ${all.length} orang dari ${distNodes.length - skippedNoCode - failed} spv-distributor berhasil, ${skippedNoCode} nama tidak ada kode ADP, ${failed} gagal request`)
  return all
}

async function fetchFicomOrgNodes(periodDate: string): Promise<FicomOrgNode[]> {
  const { data, error } = await supabase
    .from("ficom_target_nodes")
    .select("period_date,level,emp_id,emp_name,parent_emp_id,emp_type,keterangan,target,actual,persen")
    .eq("period_date", periodDate)
  if (error) throw new Error(error.message)
  return (data || []) as FicomOrgNode[]
}

async function uploadOrgNodes(rows: FicomOrgNode[], periodDate: string) {
  const { error: eDel } = await supabase.from("ficom_target_nodes").delete().eq("period_date", periodDate)
  if (eDel) throw new Error(eDel.message)
  const chunk = 300
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from("ficom_target_nodes").insert(rows.slice(i, i + chunk))
    if (error) throw new Error(error.message)
  }
}

async function fetchDashCategoryOrgNodes(periodDate: string): Promise<FicomOrgNode[]> {
  const { data, error } = await supabase
    .from("ficom_target_nodes_category")
    .select("period_date,level,emp_id,emp_name,parent_emp_id,emp_type,keterangan,target,actual,persen")
    .eq("period_date", periodDate)
  if (error) throw new Error(error.message)
  return (data || []) as FicomOrgNode[]
}

async function uploadDashCategoryOrgNodes(rows: FicomOrgNode[], periodDate: string) {
  const { error: eDel } = await supabase.from("ficom_target_nodes_category").delete().eq("period_date", periodDate)
  if (eDel) throw new Error(eDel.message)
  const chunk = 300
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from("ficom_target_nodes_category").insert(rows.slice(i, i + chunk))
    if (error) throw new Error(error.message)
  }
}

async function fetchSalesmanRows(periodDate: string): Promise<FicomSalesmanRow[]> {
  const { data, error } = await supabase
    .from("ficom_target_salesman")
    .select("period_date,spv_emp_id,adp_code,salesman_id,salesman_name,target,omset")
    .eq("period_date", periodDate)
  if (error) throw new Error(error.message)
  return (data || []) as FicomSalesmanRow[]
}

async function uploadSalesmanRows(rows: FicomSalesmanRow[], periodDate: string) {
  const { error: eDel } = await supabase.from("ficom_target_salesman").delete().eq("period_date", periodDate)
  if (eDel) throw new Error(eDel.message)
  const chunk = 300
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from("ficom_target_salesman").insert(rows.slice(i, i + chunk))
    if (error) throw new Error(error.message)
  }
}

async function fetchDashSalesmanRows(periodDate: string): Promise<FicomSalesmanRow[]> {
  const { data, error } = await supabase
    .from("ficom_target_salesman_dash")
    .select("period_date,spv_emp_id,adp_code,salesman_id,salesman_name,target,omset")
    .eq("period_date", periodDate)
  if (error) throw new Error(error.message)
  return (data || []) as FicomSalesmanRow[]
}

async function uploadDashSalesmanRows(rows: FicomSalesmanRow[], periodDate: string) {
  const { error: eDel } = await supabase.from("ficom_target_salesman_dash").delete().eq("period_date", periodDate)
  if (eDel) throw new Error(eDel.message)
  const chunk = 300
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from("ficom_target_salesman_dash").insert(rows.slice(i, i + chunk))
    if (error) throw new Error(error.message)
  }
}

async function uploadCatNodes(rows: FicomCatNode[], periodDate: string, superiorEmpId: string) {
  const { error: eDel } = await supabase.from("ficom_target_category").delete().eq("period_date", periodDate).eq("superior_emp_id", superiorEmpId)
  if (eDel) throw new Error(eDel.message)
  const chunk = 300
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await supabase.from("ficom_target_category").insert(rows.slice(i, i + chunk))
    if (error) throw new Error(error.message)
  }
}

async function fetchFicomCatNodes(periodDate: string, superiorEmpId: string): Promise<FicomCatNode[]> {
  const { data, error } = await supabase
    .from("ficom_target_category")
    .select("period_date,superior_emp_id,level,category_id,category_name,parent_category_id,target,omset,ach_pct")
    .eq("period_date", periodDate).eq("superior_emp_id", superiorEmpId)
  if (error) throw new Error(error.message)
  return (data || []) as FicomCatNode[]
}

function sumByAdp(row: RollupRow, byAdp: Map<string, FicomAgg>): FicomAgg | undefined {
  let target = 0, actual = 0, found = false
  for (const code of row.adpCodes) {
    const m = byAdp.get(code)
    if (m) { target += m.target; actual += m.actual; found = true }
  }
  return found ? { target, actual } : undefined
}

// RollupRow.label buat level Salesman formatnya "${salesman_code} · ${salesman_name}"
// — ambil bagian namanya aja buat dicocokkan ke Ficom lewat normalizeSalesmanName.
function nameFromLabel(label: string): string {
  const idx = label.indexOf(" · ")
  return idx === -1 ? label : label.slice(idx + 3)
}

// Exact-match lookup EDI: key rollup Excel & EDI sama persis (adp_code/salesman_code/sku_code),
// jadi tinggal Map by .key — beda dengan Ficom yang butuh best-effort matching.
function ediLookupFor(ediRollup: RollupRow[] | undefined) {
  if (!ediRollup) return undefined
  const m = new Map(ediRollup.map(r => [r.key, { target: r.targetAmount, actual: 0 }]))
  return (row: RollupRow) => m.get(row.key)
}

// ── Parse Excel ──────────────────────────────────────────────
async function parseExcelFile(file: File): Promise<ExcelRow[]> {
  const XLSX = await import("xlsx")
  const buf  = await file.arrayBuffer()
  const wb   = XLSX.read(buf, { type: "array" })
  const ws   = wb.Sheets[wb.SheetNames[0]]
  // Baris 1 di file sumber berisi grand-total nyasar, header sebenarnya di baris 2
  const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", range: 1 })

  return raw
    .filter(r => String(r["ADP CODE"] ?? "").trim() !== "" && String(r["SKU CODE"] ?? "").trim() !== "")
    .map(r => ({
      aor:             String(r["AOR"] ?? "").trim().toUpperCase(),
      sub_aor:         String(r["SUB AOR"] ?? "").trim().toUpperCase(),
      adp_code:        String(r["ADP CODE"] ?? "").trim(),
      depot:           String(r["DEPOT"] ?? "").trim(),
      sp:              String(r["SP"] ?? "").trim(),
      salesman_code:   String(r["SALESMAN CODE"] ?? "").trim(),
      salesman_name:   String(r["SALESMAN NAME"] ?? "").trim(),
      route:           String(r["ROUTE"] ?? "").trim(),
      skugroup:        String(r["SKUGROUP"] ?? "").trim(),
      division:        String(r["DIVISION"] ?? "").trim(),
      sku_code:        String(r["SKU CODE"] ?? "").trim(),
      sku_description: String(r["SKU DESCRIPTION"] ?? "").trim(),
      target_amount:   Number(r["TARGET AMOUNT"]) || 0,
      target_cases:    Number(r["TARGET IN CASES"]) || 0,
    }))
}

// ── Upload to Supabase ───────────────────────────────────────
async function uploadRows(rows: ExcelRow[], periodMonth: string, onProgress: (m: string) => void) {
  onProgress("⏳ Menghapus data periode lama (kalau ada)...")
  const { error: eDel } = await supabase.from("target_excel_detail").delete().eq("period_month", periodMonth)
  if (eDel) throw new Error(eDel.message)

  const chunk = 500
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk).map(r => ({ period_month: periodMonth, ...r }))
    const { error } = await supabase.from("target_excel_detail").insert(slice)
    if (error) throw new Error(error.message)
    onProgress(`⏳ Upload ${Math.min(i + chunk, rows.length)}/${rows.length} baris...`)
  }
  onProgress(`🎉 Selesai! ${rows.length} baris tersimpan untuk periode ${periodMonth}`)
}

// ── Fetch a stored period back (paginated, table bisa >70k baris) ──
async function fetchPeriodRows(periodMonth: string, onProgress?: (m: string) => void): Promise<ExcelRow[]> {
  const pageSize = 1000
  let from = 0
  let all: ExcelRow[] = []
  for (;;) {
    const { data, error } = await supabase
      .from("target_excel_detail")
      .select("aor,sub_aor,adp_code,depot,sp,salesman_code,salesman_name,route,skugroup,division,sku_code,sku_description,target_amount,target_cases")
      .eq("period_month", periodMonth)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data as ExcelRow[])
    onProgress?.(`⏳ Memuat data tersimpan... ${all.length} baris`)
    if (data.length < pageSize) break
    from += pageSize
  }
  if (all.length === 0) throw new Error(`Tidak ada data untuk periode ${periodMonth}`)
  return all
}

// ── Parse EDI Matrix (sheet "COMBINE") ─────────────────────────
// Key-nya (DIST_CODE/SLSNO/PCODE) sama persis dengan Excel PHI, jadi
// hasil parse-nya dipetakan ke bentuk ExcelRow yang sama supaya bisa
// dipakai ulang langsung oleh aggregate() dan exact-match dengan Excel.
async function parseEdiFile(file: File): Promise<ExcelRow[]> {
  const XLSX = await import("xlsx")
  const buf  = await file.arrayBuffer()
  const wb   = XLSX.read(buf, { type: "array" })
  const sheetName = wb.SheetNames.includes("COMBINE") ? "COMBINE" : wb.SheetNames[0]
  const ws   = wb.Sheets[sheetName]
  const raw  = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })

  return raw
    .filter(r => String(r["DIST_CODE"] ?? "").trim() !== "" && String(r["PCODE"] ?? "").trim() !== "")
    .map(r => ({
      aor: "", sub_aor: "",
      adp_code:        String(r["DIST_CODE"] ?? "").trim(),
      depot:           String(r["DIST_NAME"] ?? "").trim(),
      sp: "",
      salesman_code:   String(r["SLSNO"] ?? "").trim(),
      salesman_name:   String(r["SLSNAME"] ?? "").trim(),
      route: "", skugroup: "", division: "",
      sku_code:        String(r["PCODE"] ?? "").trim(),
      sku_description: String(r["PCODENAME"] ?? "").trim(),
      target_amount:   Number(r["TRGRP1"]) || 0,
      target_cases:    Number(r["TRGQTY1"]) || 0,
    }))
}

async function uploadEdiRows(rows: ExcelRow[], periodMonth: string, onProgress: (m: string) => void) {
  onProgress("⏳ Menghapus data EDI periode lama (kalau ada)...")
  const { error: eDel } = await supabase.from("target_edi_detail").delete().eq("period_month", periodMonth)
  if (eDel) throw new Error(eDel.message)

  const chunk = 500
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk).map(r => ({
      period_month: periodMonth, adp_code: r.adp_code, depot: r.depot,
      salesman_code: r.salesman_code, salesman_name: r.salesman_name,
      sku_code: r.sku_code, sku_description: r.sku_description,
      target_amount: r.target_amount, target_cases: r.target_cases,
    }))
    const { error } = await supabase.from("target_edi_detail").insert(slice)
    if (error) throw new Error(error.message)
    onProgress(`⏳ Upload EDI ${Math.min(i + chunk, rows.length)}/${rows.length} baris...`)
  }
  onProgress(`🎉 EDI selesai! ${rows.length} baris tersimpan untuk periode ${periodMonth}`)
}

async function fetchEdiPeriodRows(periodMonth: string, onProgress?: (m: string) => void): Promise<ExcelRow[]> {
  const pageSize = 1000
  let from = 0
  let all: ExcelRow[] = []
  for (;;) {
    const { data, error } = await supabase
      .from("target_edi_detail")
      .select("adp_code,depot,salesman_code,salesman_name,sku_code,sku_description,target_amount,target_cases")
      .eq("period_month", periodMonth)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data.map(d => ({ ...d, aor: "", sub_aor: "", sp: "", route: "", skugroup: "", division: "" })) as ExcelRow[])
    onProgress?.(`⏳ Memuat data EDI tersimpan... ${all.length} baris`)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

// ── Aggregator generik ───────────────────────────────────────
function aggregate(
  rows: ExcelRow[],
  keyFn: (r: ExcelRow) => string,
  labelFn: (r: ExcelRow) => string,
  subFn?: (r: ExcelRow) => string
): RollupRow[] {
  const m = new Map<string, RollupRow>()
  for (const r of rows) {
    const key = keyFn(r) || "—"
    if (!m.has(key)) m.set(key, { key, label: labelFn(r) || key, sub: subFn?.(r), targetAmount: 0, targetCases: 0, count: 0, adpCodes: new Set() })
    const e = m.get(key)!
    e.targetAmount += r.target_amount
    e.targetCases  += r.target_cases
    e.count++
    e.adpCodes.add(r.adp_code)
  }
  return Array.from(m.values()).sort((a, b) => b.targetAmount - a.targetAmount)
}

// ─────────────────────────────────────────────────────────────
// ── ROLLUP TABLE COMPONENT ────────────────────────────────────
// ─────────────────────────────────────────────────────────────
function RollupTable({
  data, subLabel, baseline,
  ficomLookup, ficomNote = "Belum sinkron — klik \"Sync dari Ficom\" di atas",
  categoryLookup, categoryNote = "Belum sinkron — klik \"Sync dari Ficom\" di atas",
  ediLookup, ediNote = "Belum ada data EDI untuk periode ini — upload di atas",
}: {
  data: RollupRow[]; subLabel?: string; baseline: BaselineKey
  ficomLookup?: (row: RollupRow) => FicomAgg | undefined; ficomNote?: string
  categoryLookup?: (row: RollupRow) => FicomAgg | undefined; categoryNote?: string
  ediLookup?: (row: RollupRow) => FicomAgg | undefined; ediNote?: string
}) {
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(d => !q || d.label.toLowerCase().includes(q) || (d.sub || "").toLowerCase().includes(q))
  }, [data, search])

  const colLabel = (key: BaselineKey) => key === baseline ? `★ ${BASELINE_LABELS[key]}` : BASELINE_LABELS[key]

  // Urutan kolom: Label/Area → Ficom Main → Ficom Dash. Category → Excel Target PHI → Matrix Target PHI
  const headers = ["", ...(subLabel ? [subLabel] : []),
    ...(ficomLookup ? [colLabel("ficom_main")] : []),
    ...(categoryLookup ? [colLabel("ficom_dash")] : []),
    colLabel("excel"),
    ...(ediLookup ? [colLabel("matrix_edi")] : [])]
  const numericFrom = headers.length - ((ficomLookup ? 1 : 0) + (categoryLookup ? 1 : 0) + 1 + (ediLookup ? 1 : 0))

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 11px", flex: 1, maxWidth: "320px" }}>
          <Search size={13} color="var(--text3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..."
            style={{ background: "none", border: "none", outline: "none", fontSize: "12px", color: "var(--text)", width: "100%", fontFamily: "inherit" }} />
        </div>
        <span style={{ fontSize: "12px", color: "var(--text3)" }}>{filtered.length}/{data.length} baris</span>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "auto", maxHeight: "560px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--surface2)", zIndex: 1 }}>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: "9px 12px", fontSize: "10px", fontWeight: 700, color: "var(--text3)", textAlign: i >= numericFrom ? "right" : "left", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(row => {
              const values: BaselineValues = {
                excel: row.targetAmount,
                ficom_main: ficomLookup?.(row)?.target,
                ficom_dash: categoryLookup?.(row)?.target,
                matrix_edi: ediLookup?.(row)?.target,
              }
              return (
                <tr key={row.key} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "9px 12px", fontWeight: 700, color: "var(--text)", maxWidth: "320px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</td>
                  {subLabel && <td style={{ padding: "9px 12px", fontSize: "11px", color: "var(--text3)" }}>{row.sub || "—"}</td>}
                  {ficomLookup && <td style={{ padding: "9px 12px", textAlign: "right" }}><ValueCell value={values.ficom_main} colKey="ficom_main" baseline={baseline} values={values} note={ficomNote} /></td>}
                  {categoryLookup && <td style={{ padding: "9px 12px", textAlign: "right" }}><ValueCell value={values.ficom_dash} colKey="ficom_dash" baseline={baseline} values={values} note={categoryNote} /></td>}
                  <td style={{ padding: "9px 12px", textAlign: "right" }}><ValueCell value={values.excel} colKey="excel" baseline={baseline} values={values} /></td>
                  {ediLookup && <td style={{ padding: "9px 12px", textAlign: "right" }}><ValueCell value={values.matrix_edi} colKey="matrix_edi" baseline={baseline} values={values} note={ediNote} /></td>}
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={headers.length} style={{ padding: "24px", textAlign: "center", color: "var(--text3)", fontSize: "12px" }}>Tidak ada data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ── RAW DATA TABLE — tampilkan baris mentah Excel Target PHI /
// Matrix Target PHI (EDI) apa adanya (bukan rollup) — dua-duanya
// TIDAK perlu "Sync dari Ficom", sudah tersimpan otomatis sejak
// upload pertama. Bisa sampai puluhan ribu baris, jadi dipaginasi
// client-side (bukan render semua sekaligus) biar browser tidak nge-lag.
// ─────────────────────────────────────────────────────────────
function RawDataTable({ rows, emptyHint }: { rows: ExcelRow[]; emptyHint: string }) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(0)
  const pageSize = 50

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return rows
    return rows.filter(r =>
      r.adp_code.toLowerCase().includes(q) ||
      r.depot.toLowerCase().includes(q) ||
      r.salesman_code.toLowerCase().includes(q) ||
      r.salesman_name.toLowerCase().includes(q) ||
      r.sku_code.toLowerCase().includes(q) ||
      r.sku_description.toLowerCase().includes(q) ||
      r.sub_aor.toLowerCase().includes(q) ||
      r.route.toLowerCase().includes(q)
    )
  }, [rows, search])

  useEffect(() => { setPage(0) }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize)
  const totalTargetAmount = useMemo(() => filtered.reduce((s, r) => s + r.target_amount, 0), [filtered])
  const totalTargetCases = useMemo(() => filtered.reduce((s, r) => s + r.target_cases, 0), [filtered])

  const cols: { key: keyof ExcelRow; label: string; numeric?: boolean }[] = [
    { key: "aor", label: "AOR" }, { key: "sub_aor", label: "Sub AOR" },
    { key: "adp_code", label: "ADP Code" }, { key: "depot", label: "Depot" }, { key: "sp", label: "SP" },
    { key: "salesman_code", label: "Salesman Code" }, { key: "salesman_name", label: "Salesman Name" },
    { key: "route", label: "Route" }, { key: "skugroup", label: "SKU Group" }, { key: "division", label: "Divisi" },
    { key: "sku_code", label: "SKU Code" }, { key: "sku_description", label: "SKU Description" },
    { key: "target_amount", label: "Target Amount", numeric: true },
    { key: "target_cases", label: "Target Cases", numeric: true },
  ]

  if (rows.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", color: "var(--text3)", fontSize: "13px" }}>
        {emptyHint}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 11px", flex: 1, maxWidth: "320px" }}>
          <Search size={13} color="var(--text3)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari ADP, salesman, SKU, route..."
            style={{ background: "none", border: "none", outline: "none", fontSize: "12px", color: "var(--text)", width: "100%", fontFamily: "inherit" }} />
        </div>
        <span style={{ fontSize: "12px", color: "var(--text3)" }}>{filtered.length.toLocaleString("id-ID")}/{rows.length.toLocaleString("id-ID")} baris</span>
        <span style={{ fontSize: "12px", color: "var(--text3)", marginLeft: "auto" }}>
          Total: <strong style={{ color: "var(--text)" }}>{fmt(totalTargetAmount)}</strong> · {fmt(totalTargetCases)} cases
        </span>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "auto", maxHeight: "560px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--surface2)", zIndex: 1 }}>
            <tr>
              {cols.map(c => (
                <th key={c.key} style={{ padding: "9px 12px", fontSize: "10px", fontWeight: 700, color: "var(--text3)", textAlign: c.numeric ? "right" : "left", borderBottom: "1px solid var(--border)", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={`${r.adp_code}-${r.salesman_code}-${r.sku_code}-${i}`} style={{ borderBottom: "1px solid var(--border)" }}>
                {cols.map(c => (
                  <td key={c.key} style={{ padding: "8px 12px", textAlign: c.numeric ? "right" : "left", fontFamily: c.numeric ? "monospace" : "inherit", fontWeight: c.numeric ? 700 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: c.numeric ? undefined : "220px" }}>
                    {c.numeric ? fmt(r[c.key] as number) : (String(r[c.key]) || "—")}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td colSpan={cols.length} style={{ padding: "24px", textAlign: "center", color: "var(--text3)", fontSize: "12px" }}>Tidak ada baris cocok pencarian</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginTop: "10px" }}>
        <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
          style={{ padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: page === 0 ? "var(--text3)" : "var(--text)", cursor: page === 0 ? "not-allowed" : "pointer", fontSize: "12px", fontFamily: "inherit" }}>‹ Prev</button>
        <span style={{ fontSize: "12px", color: "var(--text3)" }}>Halaman {page + 1} dari {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
          style={{ padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: page >= totalPages - 1 ? "var(--text3)" : "var(--text)", cursor: page >= totalPages - 1 ? "not-allowed" : "pointer", fontSize: "12px", fontFamily: "inherit" }}>Next ›</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ── PCODE CATEGORY TREE — Divisi → Subbrand → SKU, drill-down ──
// "Ficom Dash. Category" ditaruh langsung di sini (bukan section
// terpisah) supaya cross-check-nya nggak perlu pilih dropdown manual —
// tinggal klik buat expand. Divisi/Subbrand dicocokkan ke Excel lewat
// nama (kolom DIVISION/SKUGROUP), SKU di dalamnya lewat aggregate biasa.
// ─────────────────────────────────────────────────────────────
// Field "pcode" di response Ficom product/subbrand SELALU null — tidak ada
// ID resmi yang cocok ke SKU CODE Excel, jadi dicocokkan lewat NAMA produk
// (category_name Ficom ↔ sku_description Excel). HAPUS SEMUA spasi (bukan
// cuma dirapikan jadi satu spasi) — dikonfirmasi dari kasus nyata: Ficom
// nulis ukuran kemasan tanpa spasi ("24X175G"), Excel PHI pakai spasi
// ("24 X 175G") — beda persis di situ doang, sisanya sama. Sama seperti
// normalizeSalesmanName yang juga hapus semua spasi karena masalah serupa.
// Ficom JUGA sering nambah akhiran kata " PH" di ujung category_name
// (mis. "CALCHEESE CHEESE WAFER 20X10X20G PH", "MALKIST BARBECUE
// 12X10X28G PH") yang TIDAK ada di sku_description Excel (dikonfirmasi
// user: SKU 330053 "CAL CHEESE CHEESE WAFER 20X10X20G" di Excel, tanpa
// "PH") — dibuang di sini SEBELUM whitespace dirapatkan, jadi cuma kena
// kalau "PH" berdiri sendiri sebagai kata terakhir (dipisah spasi), bukan
// akhiran nama produk lain yang kebetulan diakhiri huruf P dan H.
// Selain itu Ficom KADANG (tidak selalu) lupa nulis satuan "G" (gram) di
// ujung ukuran kemasan — dikonfirmasi user: SKU 330071 "CAL CHEESE
// CHEESE WAFER 20X20X8.5G PH" di Excel, tapi di Ficom cuma "CALCHEESE
// CHEESE WAFER 20X20X8.5 PH" (tanpa G) — padahal SKU lain di produk yang
// sama (330052, 330053) konsisten sama-sama pakai "G" di kedua sisi, jadi
// ini murni typo penulisan Ficom, bukan beda produk. "G" dibuang kalau
// nempel langsung setelah angka di ujung string (satuan berat), setelah
// whitespace & "PH" dibuang — supaya "...8.5G" dan "...8.5" dianggap sama.
// Titik di singkatan JUGA kadang beda: Ficom nulis "KOPIKO LA COFFEE
// POUCH 24X10X25G" (tanpa titik), Excel nulis "KOPIKO L.A. COFFEE POUCH
// 24X10X25G" (pakai titik) — dikonfirmasi dari SKU 325667/325666 (yang
// HANGER sudah cocok karena Ficom-nya tetap nulis "L.A." lengkap, cuma
// yang POUCH yang beda). Titik dibuang HANYA kalau tidak nempel angka di
// kedua sisinya (regex lookbehind/lookahead \d), supaya titik desimal di
// angka berat kayak "20.5G" TIDAK ikut kebuang (kalau kebuang jadi
// "205G" — beda produk beneran).
function normalizeProductName(s: string): string {
  return s.trim().replace(/\s+PH$/i, "").replace(/(?<!\d)\.(?!\d)/g, "").replace(/\s+/g, "").toUpperCase().replace(/(\d)G$/, "$1")
}

// Excel PHI kadang pecah kategori produk lebih granular dari Divisi resmi
// Ficom (mis. "CHOCOLATE" & "NOODLE" itu sub-kategori marketing di Excel,
// BUKAN nama Divisi yang dikenal Ficom sama sekali) — dikonfirmasi user:
// CHOCOLATE sebenarnya bagian dari Divisi WAFER, NOODLE bagian dari Divisi
// INSTANT FOOD di sisi Ficom. Tanpa peta ini baris-baris itu nyasar ke
// grup "Lainnya (tidak match Divisi Ficom)" — bukan karena beda ejaan/
// spasi (itu bisa dinormalisasi), tapi karena taksonominya memang beda.
// ── PCODE CATEGORY TREE ──────────────────────────────────────
// Tree-nya SEKARANG murni struktur FICOM (Divisi → Subbrand → Produk),
// BUKAN lagi dikelompokkan dari nama Divisi/SKU Group Excel. Sebelumnya
// (grouping by Excel + cari padanan Ficom per level) terus-menerus kena
// masalah taksonomi: Excel kadang lebih detail dari Ficom (CHOCOLATE/
// NOODLE itu sub-kategori Excel, bukan Divisi Ficom — masuk WAFER/INSTANT
// FOOD di Ficom), kadang malah SEBALIKNYA (BENG BENG SHARE IT itu
// Subbrand TERPISAH di Ficom, tapi di Excel digabung ke SKU Group "BENG
// BENG") — dan baris Excel yang skugroup-nya beda dari nama Subbrand
// Ficom TIDAK PERNAH sampai ke pencocokan produk sama sekali (nyasar
// duluan sebelum sempat dicocokkan by nama), walau nama SKU-nya sendiri
// jelas ada di Ficom (dikonfirmasi user: kasus MALKIST BARBECUE/SWEET
// GLAZED — SKU-nya ada di Excel, tapi skugroup-nya beda dari Subbrand
// Ficom, jadi tidak pernah ketemu).
//
// Sekarang: Divisi/Subbrand/Produk SELALU dari Ficom (konsisten dengan
// dirinya sendiri, tidak butuh dicocokkan namanya ke Excel buat NENTUKAN
// struktur). Excel dicari SEBAGAI PEMBANDING cuma di level Produk (SKU),
// lewat nama (sku_description), TERLEPAS dari skugroup/division row itu
// ditulis apa di Excel — lalu dijumlah bottom-up buat total Subbrand &
// Divisi. Baris Excel yang nama produknya tidak ketemu padanan Ficom
// manapun dikumpulkan di grup terpisah di bagian akhir.
function PcodeCategoryTree({
  rows, divisionNodes, subbrandsByDivision, productsBySubbrand, ediLookup, ediNote, baseline,
}: {
  rows: ExcelRow[]
  divisionNodes: FicomCatNode[]
  subbrandsByDivision: Map<string, FicomCatNode[]>
  productsBySubbrand: Map<string, FicomCatNode[]>
  ediLookup?: (row: RollupRow) => FicomAgg | undefined
  ediNote?: string
  baseline: BaselineKey
}) {
  const [openDiv, setOpenDiv] = useState<Set<string>>(new Set())
  const [openSub, setOpenSub] = useState<Set<string>>(new Set())

  const toggleDiv = (id: string) => setOpenDiv(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const toggleSub = (id: string) => setOpenSub(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  // Lookup Excel GLOBAL by nama produk (sku_description) — dibangun dari
  // SELURUH baris Excel, TIDAK di-filter by skugroup/division dulu.
  const excelBySkuName = useMemo(() => {
    const m = new Map<string, RollupRow>()
    for (const r of rows) {
      if (!r.sku_description) continue
      const key = normalizeProductName(r.sku_description)
      const existing = m.get(key)
      if (existing) {
        existing.targetAmount += r.target_amount
        existing.targetCases += r.target_cases
        existing.count++
        existing.adpCodes.add(r.adp_code)
      } else {
        m.set(key, { key: r.sku_code, label: `${r.sku_code} · ${r.sku_description}`, targetAmount: r.target_amount, targetCases: r.target_cases, count: 1, adpCodes: new Set([r.adp_code]) })
      }
    }
    return m
  }, [rows])

  // Total Excel per Subbrand & Divisi, dihitung bottom-up dari pencocokan
  // produk individual (satu-satunya pencocokan yang reliable) — bukan lagi
  // dari pencocokan nama Divisi/Subbrand yang taksonominya sering beda.
  const { subbrandExcelTotal, divisionExcelTotal, matchedSkuKeys } = useMemo(() => {
    const subTotal = new Map<string, number>()
    const divTotal = new Map<string, number>()
    const matched = new Set<string>()
    for (const div of divisionNodes) {
      const subbrands = subbrandsByDivision.get(div.category_id) || []
      let dSum = 0
      for (const sb of subbrands) {
        const products = productsBySubbrand.get(sb.category_id) || []
        let sSum = 0
        for (const p of products) {
          const key = normalizeProductName(p.category_name)
          const match = excelBySkuName.get(key)
          if (match) { sSum += match.targetAmount; matched.add(key) }
        }
        subTotal.set(sb.category_id, sSum)
        dSum += sSum
      }
      divTotal.set(div.category_id, dSum)
    }
    return { subbrandExcelTotal: subTotal, divisionExcelTotal: divTotal, matchedSkuKeys: matched }
  }, [divisionNodes, subbrandsByDivision, productsBySubbrand, excelBySkuName])

  // Baris Excel yang nama produknya tidak pernah ketemu padanan Produk
  // Ficom manapun — ditampilkan terpisah, bukan hilang diam-diam.
  const unmatchedExcelSkus = useMemo(() => {
    return Array.from(excelBySkuName.entries())
      .filter(([key]) => !matchedSkuKeys.has(key))
      .map(([, row]) => row)
      .sort((a, b) => b.targetAmount - a.targetAmount)
  }, [excelBySkuName, matchedSkuKeys])

  const gridCols = "1fr 160px 160px 160px"
  const colLabel = (key: BaselineKey, label: string) => key === baseline ? `★ ${label}` : label

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "9px 12px", background: "var(--surface2)", fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
        <div>Divisi / Subbrand / SKU (struktur Ficom)</div>
        <div style={{ textAlign: "right" }}>{colLabel("ficom_dash", "Ficom Dash. Category")}</div>
        <div style={{ textAlign: "right" }}>{colLabel("excel", "Excel Target PHI")}</div>
        <div style={{ textAlign: "right" }}>Matrix Target PHI</div>
      </div>

      {divisionNodes.map(div => {
        const subbrands = subbrandsByDivision.get(div.category_id) || []
        const divExcelTotal = divisionExcelTotal.get(div.category_id) || 0
        const isOpen = openDiv.has(div.category_id)
        const divValues: BaselineValues = { ficom_dash: div.target, excel: divExcelTotal }
        return (
          <div key={div.category_id} style={{ borderBottom: "1px solid var(--border)" }}>
            <div onClick={() => toggleDiv(div.category_id)}
              style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: "10px 12px", cursor: "pointer", background: "var(--surface2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "12px" }}>
                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {div.category_name}
                <span style={{ fontWeight: 400, fontSize: "11px", color: "var(--text3)" }}>({subbrands.length} subbrand)</span>
              </div>
              <div style={{ textAlign: "right" }}><ValueCell value={div.target} colKey="ficom_dash" baseline={baseline} values={divValues} /></div>
              <div style={{ textAlign: "right" }}><ValueCell value={divExcelTotal} colKey="excel" baseline={baseline} values={divValues} /></div>
              <div style={{ textAlign: "right", fontSize: "11px", color: "var(--text3)" }}>—</div>
            </div>

            {isOpen && subbrands.map(sb => {
              const products = productsBySubbrand.get(sb.category_id) || []
              const sbExcelTotal = subbrandExcelTotal.get(sb.category_id) || 0
              const subOpen = openSub.has(sb.category_id)
              const sbValues: BaselineValues = { ficom_dash: sb.target, excel: sbExcelTotal }
              return (
                <div key={sb.category_id}>
                  <div onClick={() => toggleSub(sb.category_id)}
                    style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: "9px 12px", cursor: "pointer", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", paddingLeft: "20px" }}>
                      {subOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {sb.category_name}
                      <span style={{ fontSize: "11px", color: "var(--text3)" }}>({products.length} produk)</span>
                    </div>
                    <div style={{ textAlign: "right" }}><ValueCell value={sb.target} colKey="ficom_dash" baseline={baseline} values={sbValues} /></div>
                    <div style={{ textAlign: "right" }}><ValueCell value={sbExcelTotal} colKey="excel" baseline={baseline} values={sbValues} /></div>
                    <div style={{ textAlign: "right", fontSize: "11px", color: "var(--text3)" }}>—</div>
                  </div>
                  {subOpen && (() => {
                    // Baris tabel = PRODUK FICOM (bukan lagi baris Excel) —
                    // Excel dicocokkan per produk lewat nama, row.key dipakai
                    // SKU_CODE Excel kalau match (biar ediLookup, yang key-nya
                    // SKU_CODE, tetap jalan), fallback id Ficom kalau tidak
                    // ada padanan Excel sama sekali.
                    const productRows: RollupRow[] = []
                    const productAggByKey = new Map<string, FicomAgg>()
                    for (const p of products) {
                      const match = excelBySkuName.get(normalizeProductName(p.category_name))
                      const rowKey = match ? match.key : `ficom-${p.category_id}`
                      productRows.push({
                        key: rowKey,
                        label: match ? match.label : p.category_name,
                        targetAmount: match?.targetAmount || 0,
                        targetCases: match?.targetCases || 0,
                        count: 1,
                        adpCodes: match ? match.adpCodes : new Set(),
                      })
                      productAggByKey.set(rowKey, { target: p.target, actual: p.omset })
                    }
                    return (
                      <div style={{ padding: "8px 12px 12px 40px" }}>
                        <RollupTable data={productRows} subLabel="SKU" baseline={baseline}
                          categoryLookup={row => productAggByKey.get(row.key)}
                          ediLookup={ediLookup} ediNote={ediNote} />
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )
      })}

      {unmatchedExcelSkus.length > 0 && (() => {
        const excelTotal = unmatchedExcelSkus.reduce((s, r) => s + r.targetAmount, 0)
        const isOpen = openDiv.has("__unmatched__")
        return (
          <div>
            <div onClick={() => toggleDiv("__unmatched__")}
              style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: "10px 12px", cursor: "pointer", background: "var(--surface2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "12px" }}>
                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} SKU Excel tidak ketemu padanan Produk Ficom
                <span style={{ fontWeight: 400, fontSize: "11px", color: "var(--text3)" }}>({unmatchedExcelSkus.length} SKU)</span>
              </div>
              <div style={{ textAlign: "right", fontSize: "11px", color: "var(--text3)" }} title="Nama produk di Excel tidak ketemu padanan di Produk Ficom manapun (bisa beda ejaan, atau memang belum terdaftar di Ficom)">—</div>
              <div style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700 }}>{fmt(excelTotal)}</div>
              <div style={{ textAlign: "right", fontSize: "11px", color: "var(--text3)" }}>—</div>
            </div>
            {isOpen && (
              <div style={{ padding: "8px 12px 12px 20px" }}>
                <RollupTable data={unmatchedExcelSkus} subLabel="SKU" baseline={baseline} ediLookup={ediLookup} ediNote={ediNote} />
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}

// ── Patokan (baseline) compare yang bisa dipilih user ──────────
// Dulu SEMUA hitungan beda % hardcode ke Excel Target PHI sebagai acuan
// tetap. Sekarang user bisa pilih sumber mana pun jadi acuan (mis. "Ficom
// Main"), sumber lain (termasuk Excel) dibandingkan TERHADAP acuan itu.
type BaselineKey = "excel" | "ficom_main" | "ficom_dash" | "matrix_edi"
const BASELINE_LABELS: Record<BaselineKey, string> = {
  excel: "Excel Target PHI",
  ficom_main: "Ficom Main",
  ficom_dash: "Ficom Dash. Category",
  matrix_edi: "Matrix Target PHI",
}
type BaselineValues = Partial<Record<BaselineKey, number | undefined>>

// Patokan efektif per baris/tabel: ikut pilihan user KALAU sumber itu
// tersedia di situ (mis. tab Salesman tidak punya data Ficom Dash.
// Category sama sekali) — kalau tidak, fallback ke "excel" karena hampir
// selalu ada di semua level.
function pickBaseline(selected: BaselineKey, values: BaselineValues): BaselineKey {
  return values[selected] !== undefined ? selected : "excel"
}

function diffLabel(value: number, base: number): { match: boolean; text: string } {
  const diffPct = base ? Math.abs(value - base) / base * 100 : (value ? 100 : 0)
  return { match: diffPct <= 1, text: diffPct.toFixed(1) }
}

// Isi satu sel pembanding — dipakai versi <td> (RollupTable) maupun versi
// <div> (OrgHierarchyTree/PcodeCategoryTree), makanya return Fragment
// (bukan elemen pembungkus sendiri) biar pemanggil bebas bungkus <td>/<div>.
// Kolom yang jadi patokan ditandai "★ patokan" (dibandingkan ke diri
// sendiri = trivial, jadi tidak perlu badge beda %); kolom lain dibanding
// terhadap patokan efektif.
function ValueCell({ value, colKey, baseline, values, note }: {
  value: number | undefined; colKey: BaselineKey; baseline: BaselineKey; values: BaselineValues; note?: string
}) {
  if (value === undefined) return <span style={{ fontSize: "11px", color: "var(--text3)" }} title={note}>—</span>
  const effective = pickBaseline(baseline, values)
  if (colKey === effective) {
    return (
      <>
        <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt(value)}</div>
        <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--accent)" }}>★ patokan</div>
      </>
    )
  }
  const base = values[effective]
  if (base === undefined) return <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt(value)}</div>
  const { match, text } = diffLabel(value, base)
  return (
    <>
      <div style={{ fontFamily: "monospace", fontWeight: 700 }}>{fmt(value)}</div>
      <div style={{ fontSize: "10px", fontWeight: 700, color: match ? "#166534" : "#991B1B" }}>{match ? "✓ cocok" : `⚠ beda ${text}%`}</div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────
// ── ORG HIERARCHY TREE — RDM → ADM/ADS → Salesman → SKU ──────
// Drill-down penuh biar bisa lihat target sampai per SKU per Salesman
// tanpa loncat tab. Ficom cuma reliable sampai level Salesman (RDM dari
// bySubAor/Dash Category, ADM/ADS & Salesman dari team/sls) — level SKU
// di bawah Salesman murni Excel vs EDI, karena Ficom tidak sampai situ.
// ─────────────────────────────────────────────────────────────
function OrgHierarchyTree({
  rows, ediRows, masterByAdp, ficomOrgNodes, admAdsAdpCodes, ficomMaps, ficomDashMaps, salesmanMaps, baseline,
}: {
  rows: ExcelRow[]
  ediRows: ExcelRow[]
  masterByAdp: Map<string, DepotLite>
  ficomOrgNodes: FicomOrgNode[]
  admAdsAdpCodes: Map<string, Set<string>>
  ficomMaps: { bySubAor: Map<string, FicomAgg> }
  ficomDashMaps: { bySubAor: Map<string, FicomAgg>; byEmpName: Map<string, FicomAgg>; bySalesmanName: Map<string, FicomAgg> }
  salesmanMaps: { byAdp: Map<string, FicomAgg>; byName: Map<string, FicomAgg> }
  baseline: BaselineKey
}) {
  const [openRdm, setOpenRdm] = useState<Set<string>>(new Set())
  const [openAdm, setOpenAdm] = useState<Set<string>>(new Set())
  const [openSls, setOpenSls] = useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const n = new Set(set); if (n.has(id)) n.delete(id); else n.add(id); setFn(n)
  }

  const ediRdmKey = (r: ExcelRow) => extractSubAorFromMasterName(masterByAdp.get(r.adp_code)?.rdm_name || "") || ""

  const rdmRows = useMemo(() => aggregate(rows, r => r.sub_aor, r => r.sub_aor), [rows])

  // RDM Ficom dicari lewat kode Sub AOR (extractSubAor) biar dapet emp_id-nya —
  // dari situ, ADM/ADS di bawahnya diambil LANGSUNG dari org tree Ficom sendiri
  // (bukan dikelompokkan dari Master Data), supaya jumlah barisnya persis sama
  // dengan yang beneran ada di Ficom (mis. RDM SGMA beneran 6 ADM/ADS, bukan 2
  // kayak hasil pengelompokan Master Data yang granularitasnya lebih kasar).
  const ficomRdmByCode = useMemo(() => {
    const m = new Map<string, FicomOrgNode>()
    for (const n of ficomOrgNodes) {
      if (n.level !== "RDM") continue
      const code = extractSubAor(n.emp_name)
      if (code) m.set(code, n)
    }
    return m
  }, [ficomOrgNodes])

  const gridCols = "1fr 140px 140px 140px 140px"
  const colLabel = (key: BaselineKey, label: string) => key === baseline ? `★ ${label}` : label

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: gridCols, padding: "9px 12px", background: "var(--surface2)", fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
        <div>RDM / ADM-ADS / Salesman / SKU</div>
        <div style={{ textAlign: "right" }}>{colLabel("ficom_main", "Ficom Main")}</div>
        <div style={{ textAlign: "right" }}>{colLabel("ficom_dash", "Ficom Dash. Category")}</div>
        <div style={{ textAlign: "right" }}>{colLabel("excel", "Excel Target PHI")}</div>
        <div style={{ textAlign: "right" }}>{colLabel("matrix_edi", "Matrix Target PHI")}</div>
      </div>

      {rdmRows.map(rdm => {
        const rdmOpen = openRdm.has(rdm.key)
        const rdmExcelRows = rows.filter(r => r.sub_aor === rdm.key)
        const rdmEdiRows = ediRows.filter(r => ediRdmKey(r) === rdm.key)
        const rdmEdiTotal = rdmEdiRows.reduce((s, r) => s + r.target_amount, 0)
        const rdmFicomNode = ficomRdmByCode.get(rdm.key)
        const admNodes = rdmFicomNode?.emp_id
          ? ficomOrgNodes.filter(n => n.level === "ADM_ADS" && n.parent_emp_id === rdmFicomNode.emp_id && n.emp_id)
          : []
        const rdmValues: BaselineValues = {
          ficom_main: ficomMaps.bySubAor.get(rdm.key)?.target,
          ficom_dash: ficomDashMaps.bySubAor.get(rdm.key)?.target,
          excel: rdm.targetAmount,
          matrix_edi: rdmEdiRows.length ? rdmEdiTotal : undefined,
        }
        return (
          <div key={rdm.key} style={{ borderBottom: "1px solid var(--border)" }}>
            <div onClick={() => toggle(openRdm, setOpenRdm, rdm.key)}
              style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: "10px 12px", cursor: "pointer", background: "var(--surface2)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 800, fontSize: "12px" }}>
                {rdmOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />} {rdm.label}
                <span style={{ fontWeight: 400, fontSize: "11px", color: "var(--text3)" }}>({admNodes.length} ADM/ADS)</span>
              </div>
              <div style={{ textAlign: "right" }}><ValueCell value={rdmValues.ficom_main} colKey="ficom_main" baseline={baseline} values={rdmValues} /></div>
              <div style={{ textAlign: "right" }}><ValueCell value={rdmValues.ficom_dash} colKey="ficom_dash" baseline={baseline} values={rdmValues} /></div>
              <div style={{ textAlign: "right" }}><ValueCell value={rdmValues.excel} colKey="excel" baseline={baseline} values={rdmValues} /></div>
              <div style={{ textAlign: "right" }}><ValueCell value={rdmValues.matrix_edi} colKey="matrix_edi" baseline={baseline} values={rdmValues} note="Belum ada data EDI" /></div>
            </div>

            {rdmOpen && admNodes.map(admNode => {
              const admEmpId = admNode.emp_id!
              const admKey = `${rdm.key}|${admEmpId}`
              const admOpen = openAdm.has(admKey)
              const adpCodes = admAdsAdpCodes.get(admEmpId) || new Set<string>()
              const admExcelRows = rdmExcelRows.filter(r => adpCodes.has(r.adp_code))
              const admEdiRows = ediRows.filter(r => adpCodes.has(r.adp_code))
              const admExcelTotal = admExcelRows.reduce((s, r) => s + r.target_amount, 0)
              const admEdiTotal = admEdiRows.reduce((s, r) => s + r.target_amount, 0)
              const slsRows = aggregate(admExcelRows, r => r.salesman_code, r => `${r.salesman_code} · ${r.salesman_name}`, r => r.route)
              const ficomDashAdm = ficomDashMaps.byEmpName.get(normalizeEmpName(admNode.emp_name))
              const admValues: BaselineValues = {
                ficom_main: admNode.target,
                ficom_dash: ficomDashAdm?.target,
                excel: admExcelTotal,
                matrix_edi: admEdiRows.length ? admEdiTotal : undefined,
              }
              return (
                <div key={admKey}>
                  <div onClick={() => toggle(openAdm, setOpenAdm, admKey)}
                    style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: "9px 12px", cursor: "pointer", borderTop: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", paddingLeft: "20px" }}>
                      {admOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {admNode.emp_name}
                      {adpCodes.size > 0 && <span style={{ fontSize: "11px", color: "var(--text3)" }}>· ADP {Array.from(adpCodes).join(", ")}</span>}
                      <span style={{ fontSize: "11px", color: "var(--text3)" }}>({slsRows.length} salesman)</span>
                    </div>
                    <div style={{ textAlign: "right" }}><ValueCell value={admValues.ficom_main} colKey="ficom_main" baseline={baseline} values={admValues} /></div>
                    <div style={{ textAlign: "right" }}><ValueCell value={admValues.ficom_dash} colKey="ficom_dash" baseline={baseline} values={admValues} note="Nama ADM/ADS tidak ketemu padanan di Ficom Dashboard Category" /></div>
                    <div style={{ textAlign: "right" }}><ValueCell value={admValues.excel} colKey="excel" baseline={baseline} values={admValues} /></div>
                    <div style={{ textAlign: "right" }}><ValueCell value={admValues.matrix_edi} colKey="matrix_edi" baseline={baseline} values={admValues} note="Belum ada data EDI" /></div>
                  </div>

                  {admOpen && slsRows.map(sls => {
                    const slsKey = `${admKey}|${sls.key}`
                    const slsOpen = openSls.has(slsKey)
                    const slsExcelRows = admExcelRows.filter(r => r.salesman_code === sls.key)
                    const slsEdiRows = ediRows.filter(r => r.salesman_code === sls.key)
                    const skuRows = aggregate(slsExcelRows, r => r.sku_code, r => `${r.sku_code} · ${r.sku_description}`)
                    const slsEdiSkuRows = aggregate(slsEdiRows, r => r.sku_code, r => `${r.sku_code} · ${r.sku_description}`)
                    const ficomSls = salesmanMaps.byName.get(normalizeSalesmanName(nameFromLabel(sls.label)))
                    const ficomDashSls = ficomDashMaps.bySalesmanName.get(normalizeSalesmanName(nameFromLabel(sls.label)))
                    const slsValues: BaselineValues = {
                      ficom_main: ficomSls?.target,
                      ficom_dash: ficomDashSls?.target,
                      excel: sls.targetAmount,
                      matrix_edi: slsEdiRows.length ? slsEdiRows.reduce((s, r) => s + r.target_amount, 0) : undefined,
                    }
                    return (
                      <div key={slsKey}>
                        <div onClick={() => toggle(openSls, setOpenSls, slsKey)}
                          style={{ display: "grid", gridTemplateColumns: gridCols, alignItems: "center", padding: "8px 12px", cursor: "pointer", borderTop: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", paddingLeft: "40px" }}>
                            {slsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />} {sls.label}
                            {sls.sub && <span style={{ fontSize: "11px", color: "var(--text3)" }}>· {sls.sub}</span>}
                            <span style={{ fontSize: "11px", color: "var(--text3)" }}>({skuRows.length} SKU)</span>
                          </div>
                          <div style={{ textAlign: "right" }}><ValueCell value={slsValues.ficom_main} colKey="ficom_main" baseline={baseline} values={slsValues} note="Nama tidak ketemu padanan di Ficom" /></div>
                          <div style={{ textAlign: "right" }}><ValueCell value={slsValues.ficom_dash} colKey="ficom_dash" baseline={baseline} values={slsValues} note="Nama tidak ketemu padanan di Ficom Dashboard Category" /></div>
                          <div style={{ textAlign: "right" }}><ValueCell value={slsValues.excel} colKey="excel" baseline={baseline} values={slsValues} /></div>
                          <div style={{ textAlign: "right" }}><ValueCell value={slsValues.matrix_edi} colKey="matrix_edi" baseline={baseline} values={slsValues} note="Belum ada data EDI" /></div>
                        </div>
                        {slsOpen && (
                          <div style={{ padding: "8px 12px 12px 60px" }}>
                            <RollupTable data={skuRows} subLabel="SKU" baseline={baseline} ediLookup={ediLookupFor(slsEdiSkuRows)} ediNote="Belum ada data EDI buat salesman ini" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ── MAIN PAGE ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
export default function TargetComparePage() {
  const fileRef = useRef<HTMLInputElement>(null)

  const [master, setMaster] = useState<DepotLite[]>([])
  const [file, setFile]       = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ExcelRow[] | null>(null)
  const [periodMonth, setPeriodMonth] = useState("")
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)

  const [rows, setRows] = useState<ExcelRow[]>([])
  const [activePeriod, setActivePeriod] = useState("")
  const [loadPeriodInput, setLoadPeriodInput] = useState("")
  const [loadingPeriod, setLoadingPeriod] = useState(false)

  const [activeLevel, setActiveLevel] = useState<"hierarchy" | "rdm" | "admads" | "adp" | "salesman" | "pcode">("hierarchy")
  // Patokan compare bisa dipilih user — default "excel" (perilaku lama).
  // Kalau sumber yang dipilih tidak tersedia di suatu baris/tab (mis. pilih
  // Ficom Main tapi lagi di tab Pcode yang cuma ada Dashboard Category),
  // fallback otomatis ke "excel" (lihat pickBaseline).
  const [baseline, setBaseline] = useState<BaselineKey>("excel")
  // Panel upload/sync disembunyikan by default — fokus utama halaman ini
  // adalah tabel compare, bukan mekanisme di baliknya.
  const [dataPanelOpen, setDataPanelOpen] = useState(false)

  // ── EDI Matrix (pembanding exact-match, termasuk sampai Pcode) ──
  const ediFileRef = useRef<HTMLInputElement>(null)
  const [ediFile, setEdiFile] = useState<File | null>(null)
  const [ediParsedRows, setEdiParsedRows] = useState<ExcelRow[] | null>(null)
  const [ediParsing, setEdiParsing] = useState(false)
  const [ediUploading, setEdiUploading] = useState(false)
  const [ediProgress, setEdiProgress] = useState<string[]>([])
  const [ediError, setEdiError] = useState("")
  const [ediDone, setEdiDone] = useState(false)
  const [ediUploadOpen, setEdiUploadOpen] = useState(false)
  const [ediRows, setEdiRows] = useState<ExcelRow[]>([])

  const addEdiLog = (m: string) => setEdiProgress(p => [...p, m])

  // Parse LANGSUNG lanjut upload — tidak perlu klik konfirmasi lagi. Simpan
  // pakai activePeriod (periode yang lagi aktif di halaman), bukan periodMonth
  // (itu cuma keisi kalau baru saja upload Excel, jadi bisa kosong kalau
  // periode dimuat lewat "Muat"). uploadEdiRows sendiri sudah delete-lalu-insert,
  // jadi otomatis replace kalau periode itu sudah pernah ada datanya.
  const handleEdiFile = useCallback(async (f: File) => {
    setEdiError(""); setEdiParsedRows(null); setEdiDone(false); setEdiProgress([])
    if (!activePeriod) { setEdiError("Upload/muat Excel dulu buat menentukan periode — EDI disimpan pakai periode yang sama"); return }
    setEdiParsing(true)
    try {
      const parsed = await parseEdiFile(f)
      if (!parsed.length) throw new Error("Tidak ada baris valid ditemukan (cek sheet COMBINE, kolom DIST_CODE/PCODE)")
      setEdiParsedRows(parsed)
      setEdiParsing(false)
      setEdiUploading(true)
      await uploadEdiRows(parsed, activePeriod, addEdiLog)
      setEdiRows(parsed)
      setEdiDone(true)
      setEdiUploading(false)
    } catch (e) {
      setEdiError(e instanceof Error ? e.message : String(e))
      setEdiParsing(false); setEdiUploading(false)
    }
  }, [activePeriod])

  const resetEdi = () => { setEdiFile(null); setEdiParsedRows(null); setEdiProgress([]); setEdiError(""); setEdiDone(false) }

  // Muat EDI otomatis begitu ada periode aktif (dari upload/load Excel)
  useEffect(() => {
    if (!activePeriod) return
    fetchEdiPeriodRows(activePeriod).then(setEdiRows).catch(() => setEdiRows([]))
  }, [activePeriod])

  // ── Sync Ficom ──────────────────────────────────────────────
  // Kredensial TIDAK diketik manual di sini — diambil otomatis dari
  // Master Data → Ficom Password (tabel ficom_passwords, position = "SD").
  const [ficomCred, setFicomCred] = useState<{ user_login: string; password: string } | null | undefined>(undefined) // undefined = belum dicek
  const [ficomDate, setFicomDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [syncing, setSyncing] = useState(false)
  const [ficomLog, setFicomLog] = useState<string[]>([])
  const [ficomError, setFicomError] = useState("")
  const [ficomOrgNodes, setFicomOrgNodes] = useState<FicomOrgNode[]>([])
  const [ficomSyncedAt, setFicomSyncedAt] = useState("")
  const [ficomCatNodes, setFicomCatNodes] = useState<FicomCatNode[]>([])
  const [ficomDashOrgNodes, setFicomDashOrgNodes] = useState<FicomOrgNode[]>([])
  const [ficomSalesmanRows, setFicomSalesmanRows] = useState<FicomSalesmanRow[]>([])
  const [ficomDashSalesmanRows, setFicomDashSalesmanRows] = useState<FicomSalesmanRow[]>([])

  useEffect(() => {
    supabase.from("ficom_passwords").select("user_login,password").eq("position", "SD").limit(1).maybeSingle()
      .then(({ data }) => setFicomCred(data || null))
  }, [])

  const handleSync = async () => {
    if (!ficomCred) { setFicomError("Belum ada akun SD di Master Data → Ficom Password"); return }
    setSyncing(true); setFicomError(""); setFicomLog([])
    const log = (m: string) => setFicomLog(p => [...p, m])
    try {
      const token = await ficomLogin(ficomCred.user_login, ficomCred.password)
      log("✅ Login Ficom berhasil")

      // Simpan org tree SEGERA setelah berhasil crawl — biar kalau bagian
      // produk di bawah gagal, hasil yang sudah didapat tidak hangus.
      const orgNodes = await crawlOrgTree(token, ficomCred.user_login, ficomDate, log)
      log("⏳ Menyimpan data organisasi ke Supabase...")
      await uploadOrgNodes(orgNodes, ficomDate)
      setFicomOrgNodes(orgNodes)
      setFicomSyncedAt(ficomDate)
      log(`✅ ${orgNodes.length} node organisasi tersimpan`)

      // Dashboard Category (group-div) — sumber independen kedua buat SD/RDM,
      // gagal di sini tidak boleh menggagalkan hasil Main yang sudah tersimpan.
      try {
        const { nodes: dashNodes } = await crawlDashCategoryTree(token, ficomCred.user_login, ficomDate, log)
        log("⏳ Menyimpan data Dashboard Category ke Supabase...")
        await uploadDashCategoryOrgNodes(dashNodes, ficomDate)
        setFicomDashOrgNodes(dashNodes)
        log(`✅ ${dashNodes.length} node Dashboard Category tersimpan`)

        // Breakdown Salesman per ADP jalur Dashboard Category (div/sls) —
        // spvId/adpCode diambil dari breakdown ADS-per-distributor Main tree
        // yang sama dipakai team/sls (lihat komentar crawlDashSalesmanForDistributor),
        // gagal di sini TIDAK boleh menggagalkan node Dashboard Category yang sudah tersimpan.
        //
        // divId SENGAJA hardcode "02", BUKAN pakai gdivId ("002", hasil
        // group-div?superiorId=... yang dipakai user/group-div) — dikonfirmasi
        // dari capture manual user endpoint div/sls literal pakai "divId=02".
        // Dua endpoint ini ternyata pakai representasi ID beda format buat
        // grup yang sama ("002" vs "02", beda string persis) — gdivId dipakai
        // sempat bikin SEMUA request div/sls balik 0 baris (bukan galat
        // jaringan, query-nya nyasar).
        try {
          const DIV_ID = "02"
          const distNodesForDash = orgNodes.filter(n => n.level === "SALESMAN")
          const dashSalesmanRows = await crawlAllDashSalesmen(token, distNodesForDash, DIV_ID, ficomDate, formatFicomDate(ficomDate), log)
          log("⏳ Menyimpan data Salesman Dashboard Category ke Supabase...")
          await uploadDashSalesmanRows(dashSalesmanRows, ficomDate)
          setFicomDashSalesmanRows(dashSalesmanRows)
          log(`✅ ${dashSalesmanRows.length} baris Salesman Dashboard Category tersimpan`)
        } catch (eDashSls) {
          log(`⚠ Node Dashboard Category tersimpan, tapi breakdown Salesman-nya gagal: ${eDashSls instanceof Error ? eDashSls.message : String(eDashSls)}`)
        }
      } catch (eDash) {
        log(`⚠ Data Main tersimpan, tapi Dashboard Category (group-div) gagal: ${eDash instanceof Error ? eDash.message : String(eDash)}`)
      }

      // Breakdown Salesman per ADP (team/sls) — sumber akurat buat tab
      // ADM/ADS, ADP, dan Salesman (exact-match by distributorId, bukan
      // regex nama). Dipanggil per node ADM/ADS hasil crawl Main di atas.
      try {
        const distNodes = orgNodes.filter(n => n.level === "SALESMAN")
        const salesmanRows = await crawlAllSalesmen(token, distNodes, ficomDate, formatFicomDate(ficomDate), log)
        log("⏳ Menyimpan data Salesman per ADP ke Supabase...")
        await uploadSalesmanRows(salesmanRows, ficomDate)
        setFicomSalesmanRows(salesmanRows)
        log(`✅ ${salesmanRows.length} baris Salesman tersimpan`)
      } catch (eSls) {
        log(`⚠ Data Main tersimpan, tapi breakdown Salesman per ADP gagal: ${eSls instanceof Error ? eSls.message : String(eSls)}`)
      }

      try {
        const catNodes = await crawlProductTree(token, ficomCred.user_login, ficomDate, log)
        log("⏳ Menyimpan data produk ke Supabase...")
        await uploadCatNodes(catNodes, ficomDate, ficomCred.user_login)
        setFicomCatNodes(catNodes)
        log(`🎉 Sync selesai! ${orgNodes.length} node organisasi · ${catNodes.length} node produk`)
      } catch (e2) {
        log(`⚠ Data organisasi sudah tersimpan, tapi data produk (Division/Subbrand) gagal: ${e2 instanceof Error ? e2.message : String(e2)}`)
      }
    } catch (e) {
      setFicomError(`${e instanceof Error ? e.message : String(e)} — kalau ini error network/CORS, kabari saya biar dicek ulang jalur aksesnya.`)
    }
    setSyncing(false)
  }

  // Kalau data Ficom untuk tanggal ini sudah pernah disync sebelumnya, muat langsung
  // tanpa perlu login ulang.
  useEffect(() => {
    if (!ficomDate || !ficomCred) return
    fetchFicomOrgNodes(ficomDate)
      .then(nodes => { if (nodes.length) { setFicomOrgNodes(nodes); setFicomSyncedAt(ficomDate) } })
      .catch(() => { /* belum pernah disync untuk tanggal ini, biarkan kosong */ })
    fetchFicomCatNodes(ficomDate, ficomCred.user_login)
      .then(nodes => { if (nodes.length) setFicomCatNodes(nodes) })
      .catch(() => { /* belum pernah disync, biarkan kosong */ })
    fetchDashCategoryOrgNodes(ficomDate)
      .then(nodes => { if (nodes.length) setFicomDashOrgNodes(nodes) })
      .catch(() => { /* belum pernah disync, biarkan kosong */ })
    fetchSalesmanRows(ficomDate)
      .then(rows => { if (rows.length) setFicomSalesmanRows(rows) })
      .catch(() => { /* belum pernah disync, biarkan kosong */ })
    fetchDashSalesmanRows(ficomDate)
      .then(rows => { if (rows.length) setFicomDashSalesmanRows(rows) })
      .catch(() => { /* belum pernah disync, biarkan kosong */ })
  }, [ficomDate, ficomCred])

  const ficomMaps = useMemo(() => {
    const sd = ficomOrgNodes.find(n => n.level === "SD")
    const bySubAor = new Map<string, FicomAgg>()
    for (const n of ficomOrgNodes) {
      if (n.level === "RDM") {
        const code = extractSubAor(n.emp_name)
        if (code) bySubAor.set(code, { target: n.target, actual: n.actual })
      }
    }
    return { sd, bySubAor }
  }, [ficomOrgNodes])

  // Sama seperti ficomMaps, tapi dari sumber Dashboard Category (group-div) —
  // dipakai buat kolom/kartu "Ficom Dash. Category".
  const ficomDashMaps = useMemo(() => {
    const sd = ficomDashOrgNodes.find(n => n.level === "SD")
    const bySubAor = new Map<string, FicomAgg>()
    const byEmpName = new Map<string, FicomAgg>()
    for (const n of ficomDashOrgNodes) {
      if (n.level === "RDM") {
        const code = extractSubAor(n.emp_name)
        if (code) bySubAor.set(code, { target: n.target, actual: n.actual })
      }
      if (n.level === "ADM_ADS") {
        byEmpName.set(normalizeEmpName(n.emp_name), { target: n.target, actual: n.actual })
      }
    }
    // Breakdown Salesman jalur Dashboard Category (endpoint div/sls, lihat
    // crawlDashSalesmanForDistributor) — formatnya sama dengan team/sls,
    // jadi dicocokkan dengan normalizeSalesmanName yang sama.
    const bySalesmanName = new Map<string, FicomAgg>()
    for (const r of ficomDashSalesmanRows) {
      bySalesmanName.set(normalizeSalesmanName(r.salesman_name), { target: r.target, actual: r.omset })
    }
    return { sd, bySubAor, byEmpName, bySalesmanName }
  }, [ficomDashOrgNodes, ficomDashSalesmanRows])

  // Sumber akurat buat tab ADM/ADS, ADP, dan Salesman — dari team/sls
  // (exact-match by distributorId, bukan regex nama seperti ficomMaps.byAdp).
  // byAdp = total semua salesman di satu ADP (buat tab ADM/ADS & ADP);
  // byId = target per-salesman individual (buat tab Salesman, dicocokkan
  // ke Excel via row.key == SALESMAN CODE — kalau formatnya beda dari
  // salesman_id Ficom, lookup-nya cuma nggak ketemu (tampil "—"), aman).
  const salesmanMaps = useMemo(() => {
    const byAdp = new Map<string, FicomAgg>()
    const byName = new Map<string, FicomAgg>()
    for (const r of ficomSalesmanRows) {
      byName.set(normalizeSalesmanName(r.salesman_name), { target: r.target, actual: r.omset })
      const existing = byAdp.get(r.adp_code) || { target: 0, actual: 0 }
      byAdp.set(r.adp_code, { target: existing.target + r.target, actual: existing.actual + r.omset })
    }
    return { byAdp, byName }
  }, [ficomSalesmanRows])

  // ADP code per node ADM_ADS di org tree Main — didapat dari child-nya di
  // level "SALESMAN" (breakdown per-distributor, lihat extractAdpCodeFromDistName).
  // Biasanya 1:1 (satu ADM/ADS cuma pegang 1 distributor), tapi disimpan
  // sebagai Set jaga-jaga kalau ada yang pegang lebih dari satu.
  const admAdsAdpCodes = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const n of ficomOrgNodes) {
      if (n.level !== "SALESMAN" || !n.parent_emp_id) continue
      const code = extractAdpCodeFromDistName(n.emp_name)
      if (!code) continue
      if (!m.has(n.parent_emp_id)) m.set(n.parent_emp_id, new Set())
      m.get(n.parent_emp_id)!.add(code)
    }
    return m
  }, [ficomOrgNodes])

  // Baris ADM/ADS buat tab flat "ADM / ADS" — DI-DRIVE dari org tree Ficom
  // sendiri (bukan dikelompokkan dari Master Data), supaya jumlah barisnya
  // persis sama dengan yang beneran ada di Ficom (mis. RDM SGMA beneran 6
  // ADM/ADS, bukan 2 kayak hasil pengelompokan adm_name Master Data yang
  // granularitasnya lebih kasar — satu ADP code Excel bisa mencakup beberapa
  // node route/cabang Ficom sekaligus). Excel/Matrix Target PHI dicocokkan
  // lewat ADP code (dari admAdsAdpCodes di atas), TIDAK lewat Master Data —
  // jadi kalau beberapa ADM/ADS Ficom berbagi 1 ADP code yang sama, angka
  // Excel/Matrix-nya otomatis SAMA di baris-baris itu (memang begitu adanya,
  // Excel cuma nyatat di level distributor, bukan di level route Ficom).
  const ficomAdmAdsRows = useMemo(() => {
    const rollup: RollupRow[] = []
    const ficomByKey = new Map<string, FicomAgg>()
    const dashByKey = new Map<string, FicomAgg>()
    const ediByKey = new Map<string, FicomAgg>()
    for (const n of ficomOrgNodes) {
      if (n.level !== "ADM_ADS" || !n.emp_id) continue
      const empId = n.emp_id
      const adpCodes = admAdsAdpCodes.get(empId) || new Set<string>()
      const excelRowsForNode = rows.filter(r => adpCodes.has(r.adp_code))
      const targetAmount = excelRowsForNode.reduce((s, r) => s + r.target_amount, 0)
      const targetCases = excelRowsForNode.reduce((s, r) => s + r.target_cases, 0)
      rollup.push({
        key: empId, label: n.emp_name, sub: adpCodes.size ? `ADP ${Array.from(adpCodes).join(", ")}` : undefined,
        targetAmount, targetCases, count: excelRowsForNode.length, adpCodes,
      })
      ficomByKey.set(empId, { target: n.target, actual: n.actual })
      const dash = ficomDashMaps.byEmpName.get(normalizeEmpName(n.emp_name))
      if (dash) dashByKey.set(empId, dash)
      const ediRowsForNode = ediRows.filter(r => adpCodes.has(r.adp_code))
      if (ediRowsForNode.length) ediByKey.set(empId, { target: ediRowsForNode.reduce((s, r) => s + r.target_amount, 0), actual: 0 })
    }
    rollup.sort((a, b) => b.targetAmount - a.targetAmount)
    return { rollup, ficomByKey, dashByKey, ediByKey }
  }, [ficomOrgNodes, admAdsAdpCodes, rows, ediRows, ficomDashMaps])

  // ── Ficom Dashboard Category — dipakai buat drill-down Divisi→Subbrand
  // langsung di tab Pcode, bukan section terpisah. Datanya sudah ada dari
  // crawlProductTree (level DIVISION/SUBBRAND), tidak perlu crawl tambahan.
  const divisionNodes = useMemo(() => ficomCatNodes.filter(n => n.level === "DIVISION"), [ficomCatNodes])
  const subbrandsByDivision = useMemo(() => {
    const m = new Map<string, FicomCatNode[]>()
    for (const n of ficomCatNodes) {
      if (n.level !== "SUBBRAND" || !n.parent_category_id) continue
      if (!m.has(n.parent_category_id)) m.set(n.parent_category_id, [])
      m.get(n.parent_category_id)!.push(n)
    }
    return m
  }, [ficomCatNodes])
  const productsBySubbrand = useMemo(() => {
    const m = new Map<string, FicomCatNode[]>()
    for (const n of ficomCatNodes) {
      if (n.level !== "PRODUCT" || !n.parent_category_id) continue
      if (!m.has(n.parent_category_id)) m.set(n.parent_category_id, [])
      m.get(n.parent_category_id)!.push(n)
    }
    return m
  }, [ficomCatNodes])

  useEffect(() => {
    supabase.from("master_data_adp")
      .select("adp_code,depot,adm_name,ads_name,rdm_name,region_name")
      .then(({ data }) => {
        if (data) setMaster(data.map(d => ({ ...d, adp_code: String(d.adp_code) })) as DepotLite[])
      })
  }, [])

  const addLog = (m: string) => setProgress(p => [...p, m])

  const handleFile = useCallback(async (f: File) => {
    setError(""); setParsedRows(null); setDone(false); setProgress([])
    setParsing(true)
    try {
      const parsed = await parseExcelFile(f)
      if (!parsed.length) throw new Error("Tidak ada baris valid ditemukan (cek kolom ADP CODE / SKU CODE)")
      setParsedRows(parsed)
      setPeriodMonth(guessPeriod(f.name))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setParsing(false)
  }, [])

  const handleUpload = async () => {
    if (!parsedRows || !periodMonth) return
    setUploading(true); setProgress([]); setError(""); setDone(false)
    try {
      await uploadRows(parsedRows, periodMonth, addLog)
      setRows(parsedRows)
      setActivePeriod(periodMonth)
      setDone(true)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setUploading(false)
  }

  const handleLoadPeriod = async () => {
    if (!loadPeriodInput) return
    setLoadingPeriod(true); setError(""); setProgress([])
    try {
      const data = await fetchPeriodRows(loadPeriodInput, addLog)
      setRows(data)
      setActivePeriod(loadPeriodInput)
      setProgress([])
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setLoadingPeriod(false)
  }

  const reset = () => { setFile(null); setParsedRows(null); setProgress([]); setError(""); setDone(false) }

  // Auto-load periode Excel terakhir yang pernah diupload, biar begitu buka
  // halaman langsung ada tampilan compare tanpa harus klik "Muat" manual.
  useEffect(() => {
    supabase.from("target_excel_detail")
      .select("period_month")
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.period_month) {
          setLoadPeriodInput(data.period_month)
          fetchPeriodRows(data.period_month)
            .then(rows => { setRows(rows); setActivePeriod(data.period_month) })
            .catch(() => { /* diamkan, biarkan user muat manual */ })
        }
      })
  }, [])

  // ── Rollups ─────────────────────────────────────────────────
  const masterByAdp = useMemo(() => new Map(master.map(m => [m.adp_code, m])), [master])

  const levels = useMemo(() => {
    if (!rows.length) return null
    const withMaster = (r: ExcelRow) => masterByAdp.get(r.adp_code)
    return {
      adp: aggregate(rows, r => r.adp_code, r => `${r.adp_code} · ${r.depot}`, r => r.aor),
      rdm: aggregate(rows, r => r.sub_aor, r => r.sub_aor, r => withMaster(r)?.rdm_name || ""),
      salesman: aggregate(rows, r => r.salesman_code, r => `${r.salesman_code} · ${r.salesman_name}`, r => r.route),
      pcode: aggregate(rows, r => r.sku_code, r => `${r.sku_code} · ${r.sku_description}`, r => r.skugroup),
    }
  }, [rows, masterByAdp])

  const ediLevels = useMemo(() => {
    if (!ediRows.length) return null
    return {
      rdm: aggregate(ediRows, r => {
        const rdmName = masterByAdp.get(r.adp_code)?.rdm_name || ""
        return extractSubAorFromMasterName(rdmName) || ""
      }, r => {
        const rdmName = masterByAdp.get(r.adp_code)?.rdm_name || ""
        return extractSubAorFromMasterName(rdmName) || ""
      }),
      adp: aggregate(ediRows, r => r.adp_code, r => `${r.adp_code} · ${r.depot}`),
      salesman: aggregate(ediRows, r => r.salesman_code, r => `${r.salesman_code} · ${r.salesman_name}`),
      pcode: aggregate(ediRows, r => r.sku_code, r => `${r.sku_code} · ${r.sku_description}`),
    }
  }, [ediRows, masterByAdp])

  const summary = useMemo(() => {
    const grandAmount = rows.reduce((s, r) => s + r.target_amount, 0)
    const grandCases  = rows.reduce((s, r) => s + r.target_cases, 0)
    return {
      grandAmount, grandCases,
      adp: new Set(rows.map(r => r.adp_code)).size,
      salesman: new Set(rows.map(r => r.salesman_code)).size,
      sku: new Set(rows.map(r => r.sku_code)).size,
    }
  }, [rows])

  const ediSummary = useMemo(() => ({
    grandAmount: ediRows.reduce((s, r) => s + r.target_amount, 0),
  }), [ediRows])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "0" }}>
      <MotivationBanner page="docreq" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg,#0369A1,#38BDF8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", margin: 0 }}>Target Compare</h1>
            <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>Excel Target PHI vs Matrix Target PHI vs Ficom — sampai level Pcode (SKU)</p>
          </div>
        </div>
        <button onClick={() => setDataPanelOpen(v => !v)}
          style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text2)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <Settings size={14} /> Kelola Sumber Data
          {dataPanelOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* ── Rollup view — konten utama halaman ── */}
      {rows.length > 0 && levels && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
            <div style={{ fontSize: "14px", fontWeight: 800 }}>Rollup Target — Periode {activePeriod}</div>
            <span style={{ fontSize: "11px", background: "var(--surface2)", padding: "3px 10px", borderRadius: "99px", color: "var(--text3)" }}>
              {summary.adp} ADP · {summary.salesman} Salesman · {summary.sku} SKU
            </span>
          </div>

          {/* SD-level hero card */}
          <div style={{ background: "linear-gradient(135deg,#0369A1,#0891B2)", borderRadius: "12px", padding: "18px 22px", marginBottom: "16px", color: "white", display: "flex", gap: "24px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>Excel Target PHI (Level SD)</div>
              <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em", marginTop: "4px" }}>{fmt(summary.grandAmount)}</div>
              <div style={{ fontSize: "12px", opacity: 0.85, marginTop: "2px" }}>{fmt(summary.grandCases)} cases</div>
            </div>
            {ficomMaps.sd ? (
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "24px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ficom Main — {ficomSyncedAt}</div>
                <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em", marginTop: "4px" }}>{fmt(ficomMaps.sd.target)}</div>
                <div style={{ fontSize: "12px", fontWeight: 700, marginTop: "2px" }}>
                  {Math.abs(ficomMaps.sd.target - summary.grandAmount) / (summary.grandAmount || 1) * 100 <= 1
                    ? "✓ cocok dengan Excel"
                    : `⚠ beda ${(Math.abs(ficomMaps.sd.target - summary.grandAmount) / (summary.grandAmount || 1) * 100).toFixed(1)}% dari Excel`}
                </div>
              </div>
            ) : (
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "24px", display: "flex", alignItems: "center", fontSize: "12px", opacity: 0.85 }}>
                Belum sync dari Ficom — klik &quot;Kelola Sumber Data&quot; di atas
              </div>
            )}
            {ficomDashMaps.sd ? (
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "24px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>Ficom Dash. Category — {ficomSyncedAt}</div>
                <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em", marginTop: "4px" }}>{fmt(ficomDashMaps.sd.target)}</div>
                <div style={{ fontSize: "12px", fontWeight: 700, marginTop: "2px" }}>
                  {Math.abs(ficomDashMaps.sd.target - summary.grandAmount) / (summary.grandAmount || 1) * 100 <= 1
                    ? "✓ cocok dengan Excel"
                    : `⚠ beda ${(Math.abs(ficomDashMaps.sd.target - summary.grandAmount) / (summary.grandAmount || 1) * 100).toFixed(1)}% dari Excel`}
                </div>
              </div>
            ) : (
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "24px", display: "flex", alignItems: "center", fontSize: "12px", opacity: 0.85 }}>
                Belum sync Dashboard Category — klik &quot;Kelola Sumber Data&quot; di atas
              </div>
            )}
            {ediRows.length > 0 ? (
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "24px" }}>
                <div style={{ fontSize: "10px", fontWeight: 700, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em" }}>Matrix Target PHI (EDI)</div>
                <div style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em", marginTop: "4px" }}>{fmt(ediSummary.grandAmount)}</div>
                <div style={{ fontSize: "12px", fontWeight: 700, marginTop: "2px" }}>
                  {Math.abs(ediSummary.grandAmount - summary.grandAmount) / (summary.grandAmount || 1) * 100 <= 1
                    ? "✓ cocok dengan Excel"
                    : `⚠ beda ${(Math.abs(ediSummary.grandAmount - summary.grandAmount) / (summary.grandAmount || 1) * 100).toFixed(1)}% dari Excel`}
                </div>
              </div>
            ) : (
              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.3)", paddingLeft: "24px", display: "flex", alignItems: "center", fontSize: "12px", opacity: 0.85 }}>
                Belum ada data EDI — upload di &quot;Kelola Sumber Data&quot;
              </div>
            )}
          </div>

          {/* Tabs + Patokan */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: "4px", background: "var(--surface2)", borderRadius: "8px", padding: "3px", width: "fit-content", border: "1px solid var(--border)", flexWrap: "wrap" }}>
              {([
                ["hierarchy", "Hierarki (RDM→ADM→Salesman→SKU)"],
                ["rdm", "RDM (Sub AOR)"],
                ["admads", "ADM / ADS"],
                ["adp", "ADP"],
                ["salesman", "Salesman"],
                ["pcode", "Pcode (SKU)"],
              ] as const).map(([key, label]) => (
                <button key={key} onClick={() => setActiveLevel(key)}
                  style={{ padding: "6px 16px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, fontFamily: "inherit", background: activeLevel === key ? "white" : "transparent", color: activeLevel === key ? "var(--text)" : "var(--text3)", boxShadow: activeLevel === key ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px" }}>
              <span style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 600 }}>★ Patokan:</span>
              <select value={baseline} onChange={e => setBaseline(e.target.value as BaselineKey)}
                style={{ border: "none", outline: "none", fontSize: "12px", fontWeight: 700, color: "var(--accent)", background: "transparent", fontFamily: "inherit", cursor: "pointer" }}>
                {(Object.keys(BASELINE_LABELS) as BaselineKey[]).map(k => (
                  <option key={k} value={k}>{BASELINE_LABELS[k]}</option>
                ))}
              </select>
            </div>
          </div>

          {activeLevel === "hierarchy" && <OrgHierarchyTree rows={rows} ediRows={ediRows} masterByAdp={masterByAdp} ficomOrgNodes={ficomOrgNodes} admAdsAdpCodes={admAdsAdpCodes} ficomMaps={ficomMaps} ficomDashMaps={ficomDashMaps} salesmanMaps={salesmanMaps} baseline={baseline} />}
          {activeLevel === "rdm"      && <RollupTable data={levels.rdm} subLabel="RDM" baseline={baseline} ficomLookup={row => ficomMaps.bySubAor.get(row.key)} categoryLookup={row => ficomDashMaps.bySubAor.get(row.key)} ediLookup={ediLookupFor(ediLevels?.rdm)} ediNote="Belum ada data EDI — upload di Kelola Sumber Data" />}
          {activeLevel === "admads"   && <RollupTable data={ficomAdmAdsRows.rollup} subLabel="ADP Code" baseline={baseline} ficomLookup={row => ficomAdmAdsRows.ficomByKey.get(row.key)} ficomNote="Belum sync dari Ficom — klik &quot;Kelola Sumber Data&quot; di atas" categoryLookup={row => ficomAdmAdsRows.dashByKey.get(row.key)} categoryNote="Nama ADM/ADS tidak ketemu padanan di Ficom Dashboard Category" ediLookup={row => ficomAdmAdsRows.ediByKey.get(row.key)} ediNote="Belum ada data EDI untuk ADP ini" />}
          {activeLevel === "adp"      && <RollupTable data={levels.adp} subLabel="AOR" baseline={baseline} ficomLookup={row => sumByAdp(row, salesmanMaps.byAdp)} ficomNote="Belum sinkron breakdown Salesman per ADP — klik &quot;Sync dari Ficom&quot; di atas" ediLookup={ediLookupFor(ediLevels?.adp)} ediNote="Belum ada data EDI — upload di Kelola Sumber Data" />}
          {activeLevel === "salesman" && <RollupTable data={levels.salesman} subLabel="Route" baseline={baseline} ficomLookup={row => salesmanMaps.byName.get(normalizeSalesmanName(nameFromLabel(row.label)))} ficomNote="Nama Salesman tidak ketemu padanan di Ficom — belum tentu sama persis penulisannya, atau belum sync" categoryLookup={row => ficomDashMaps.bySalesmanName.get(normalizeSalesmanName(nameFromLabel(row.label)))} categoryNote="Nama Salesman tidak ketemu padanan di Ficom Dashboard Category" ediLookup={ediLookupFor(ediLevels?.salesman)} ediNote="Belum ada data EDI — upload di Kelola Sumber Data" />}
          {activeLevel === "pcode"    && (
            divisionNodes.length > 0
              ? <PcodeCategoryTree rows={rows} divisionNodes={divisionNodes} subbrandsByDivision={subbrandsByDivision} productsBySubbrand={productsBySubbrand} baseline={baseline} ediLookup={ediLookupFor(ediLevels?.pcode)} ediNote="Belum ada data EDI — upload di Kelola Sumber Data" />
              : <RollupTable data={levels.pcode} subLabel="SKU Group" baseline={baseline} ficomNote="Belum sync data produk dari Ficom — klik &quot;Sync dari Ficom&quot; di atas" ediLookup={ediLookupFor(ediLevels?.pcode)} ediNote="Belum ada data EDI — upload di Kelola Sumber Data" />
          )}
        </div>
      )}

      {rows.length === 0 && !parsedRows && !dataPanelOpen && (
        <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: "12px", padding: "40px 20px", textAlign: "center" }}>
          <TriangleAlert size={28} color="var(--text3)" style={{ margin: "0 auto 10px" }} />
          <div style={{ fontSize: "13px", color: "var(--text3)", marginBottom: "14px" }}>Belum ada data. Buka &quot;Kelola Sumber Data&quot; buat upload Excel/EDI atau sync Ficom.</div>
          <button onClick={() => setDataPanelOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "9px", border: "none", background: "#0369A1", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            <Settings size={13} /> Kelola Sumber Data
          </button>
        </div>
      )}

      {/* ── Panel Kelola Sumber Data (collapsed by default) ── */}
      {dataPanelOpen && (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "14px", padding: "16px" }}>
        {/* Info banner — status integrasi Ficom */}
        <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: "10px", padding: "12px 16px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#0369A1", marginBottom: "4px" }}>ℹ️ Status integrasi</div>
          <div style={{ fontSize: "11px", color: "#0C4A6E", lineHeight: 1.7 }}>
            Ada 3 sumber: <strong>Excel</strong> (target asli tim PHI) → di-upload ke <strong>Matrix</strong> → Matrix diekspos lewat 2 jalur: <strong>EDI</strong> (raw export, key sama persis dengan Excel → exact-match sampai Pcode) dan <strong>Ficom</strong> (dashboard live, ke-agregat per WF).
            Upload Excel dulu, lalu EDI buat pembanding exact-match sampai <strong>Pcode</strong>, dan/atau klik &quot;Sync dari Ficom&quot; (otomatis pakai akun SD tersimpan) buat pembanding level organisasi.
          </div>
        </div>

        {/* Sync dari Ficom */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "4px" }}>🔄 Sync dari Ficom</div>
          <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "12px" }}>
            {ficomCred === undefined && "Mengecek akun tersimpan..."}
            {ficomCred === null && (
              <span style={{ color: "#991B1B" }}>
                ⚠ Belum ada akun Ficom level SD tersimpan. Tambahkan dulu di{" "}
                <a href="/dashboard/ficom-password" style={{ color: "#991B1B", textDecoration: "underline" }}>Master Data → Ficom Password</a>{" "}
                (isi Position = &quot;SD&quot;), lalu klik Sync lagi.
              </span>
            )}
            {ficomCred && <>Pakai akun tersimpan: <strong style={{ color: "var(--text)" }}>{ficomCred.user_login}</strong> — otomatis, tidak perlu login manual.</>}
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <input value={ficomDate} onChange={e => setFicomDate(e.target.value)} type="date"
              style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit" }} />
            <button onClick={handleSync} disabled={syncing || !ficomCred}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 18px", borderRadius: "8px", border: "none", background: syncing || !ficomCred ? "#94A3B8" : "#0369A1", color: "white", fontSize: "12px", fontWeight: 700, cursor: syncing || !ficomCred ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {syncing ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Sync...</> : "Sync dari Ficom"}
            </button>
          </div>
          {ficomError && (
            <div style={{ marginTop: "10px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "#991B1B" }}>{ficomError}</div>
          )}
          {ficomLog.length > 0 && (
            <div style={{ marginTop: "10px", maxHeight: "140px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "3px" }}>
              {ficomLog.map((l, i) => <div key={i} style={{ fontSize: "11px", color: l.startsWith("✅") || l.startsWith("🎉") ? "#166534" : "var(--text3)" }}>{l}</div>)}
            </div>
          )}
        </div>

        {/* ═══ EXCEL TARGET PHI — upload + preview tabel data tersimpan ═══ */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "2px" }}>📊 Excel Target PHI{activePeriod ? ` — periode ${activePeriod}` : ""}</div>
              <div style={{ fontSize: "11px", color: "var(--text3)" }}>
                Target asli tim PHI, sumber utama compare.
                {rows.length > 0 && <span style={{ color: "#166534", fontWeight: 700 }}> · {rows.length.toLocaleString("id-ID")} baris tersimpan</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={() => setUploadOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", border: "none", background: "#0369A1", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Upload size={13} /> Upload Excel Target
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px" }}>
                <span style={{ fontSize: "11px", color: "var(--text3)" }}>Lihat periode:</span>
                <input type="month" value={loadPeriodInput} onChange={e => setLoadPeriodInput(e.target.value)}
                  style={{ border: "none", outline: "none", background: "transparent", fontSize: "12px", color: "var(--text)", fontFamily: "inherit" }} />
                <button onClick={handleLoadPeriod} disabled={loadingPeriod || !loadPeriodInput}
                  style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: "var(--accent)", color: "white", fontSize: "11px", fontWeight: 700, cursor: loadingPeriod ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loadingPeriod || !loadPeriodInput ? 0.6 : 1 }}>
                  {loadingPeriod ? "..." : "Muat"}
                </button>
              </div>
            </div>
          </div>

          {file && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 12px", width: "fit-content" }}>
              <FileSpreadsheet size={14} color="#0369A1" />
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
              <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: "0 0 0 4px", fontSize: "16px", lineHeight: 1 }}>×</button>
            </div>
          )}

          {parsing && (
            <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
              <RefreshCw size={14} color="var(--accent)" style={{ animation: "spin 1s linear infinite" }} /> Memproses Excel...
            </div>
          )}

          {error && (
            <div style={{ marginTop: "10px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "#991B1B" }}>{error}</div>
          )}

          {/* Preview + confirm upload */}
          {parsedRows && !done && (
            <div style={{ marginTop: "12px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px", flexWrap: "wrap" }}>
                <div style={{ fontSize: "14px", fontWeight: 800 }}>📊 Preview: {parsedRows.length.toLocaleString("id-ID")} baris</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text3)" }}>Periode:</span>
                  <input type="month" value={periodMonth} onChange={e => setPeriodMonth(e.target.value)}
                    style={{ border: "none", outline: "none", background: "transparent", fontSize: "12px", fontWeight: 700, color: "#0369A1", fontFamily: "inherit" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "16px" }}>
                {[
                  { l: "Total Target Amount", v: fmt(parsedRows.reduce((s, r) => s + r.target_amount, 0)) },
                  { l: "Distinct ADP", v: new Set(parsedRows.map(r => r.adp_code)).size },
                  { l: "Distinct Salesman", v: new Set(parsedRows.map(r => r.salesman_code)).size },
                  { l: "Distinct SKU", v: new Set(parsedRows.map(r => r.sku_code)).size },
                ].map(s => (
                  <div key={s.l} style={{ background: "var(--surface)", borderRadius: "10px", padding: "10px 14px", flex: 1, minWidth: "140px" }}>
                    <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase" }}>{s.l}</div>
                    <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--text)" }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleUpload} disabled={uploading}
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 22px", borderRadius: "9px", border: "none", background: uploading ? "#94A3B8" : "#166534", color: "white", fontSize: "13px", fontWeight: 700, cursor: uploading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {uploading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading...</> : <><Upload size={14} /> Upload ke Supabase</>}
                </button>
                <button onClick={reset} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "10px 16px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text3)", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  <Trash2 size={14} /> Reset
                </button>
              </div>
            </div>
          )}

          {progress.length > 0 && (
            <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
              {progress.slice(-5).map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: p.startsWith("✅") || p.startsWith("🎉") ? "#166534" : "var(--text2)" }}>
                  {p.startsWith("✅") || p.startsWith("🎉") ? <CheckCircle size={12} color="#166534" /> : <RefreshCw size={12} style={{ animation: "spin 1s linear infinite" }} />}{p}
                </div>
              ))}
            </div>
          )}

          {done && (
            <div style={{ marginTop: "10px", background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: "12px", padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
              <CheckCircle size={22} color="#166534" />
              <div style={{ fontWeight: 800, fontSize: "14px", color: "#166534" }}>Upload berhasil! Data periode {periodMonth} siap dibandingkan di atas.</div>
            </div>
          )}

          {/* Preview tabel data Excel yang sudah tersimpan */}
          {rows.length > 0 && (
            <div style={{ marginTop: "14px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <RawDataTable rows={rows} emptyHint="Belum ada data Excel Target PHI" />
            </div>
          )}
        </div>

        {/* Upload Modal Excel */}
        {uploadOpen && (
          <div onClick={e => { if (e.target === e.currentTarget) setUploadOpen(false) }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)" }}>
            <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "28px", width: "440px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--text)" }}>Upload Excel Target</div>
                  <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>Format: AOR, SUB AOR, ADP CODE, ... SKU CODE, TARGET AMOUNT, TARGET IN CASES</div>
                </div>
                <button onClick={() => setUploadOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "22px", lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); handleFile(f); setUploadOpen(false) }; e.target.value = "" }} />
              <div onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed var(--border)", borderRadius: "12px", padding: "36px 20px", textAlign: "center", cursor: "pointer", background: "var(--surface2)", marginBottom: "14px" }}>
                <Upload size={32} color="#0369A1" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>Klik untuk pilih file</div>
                <div style={{ fontSize: "11px", color: "var(--text3)" }}>Target_Periode_Agustus.xlsx</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ DATA EDI (MATRIX) — upload + preview tabel data tersimpan ═══ */}
        {activePeriod && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 800, marginBottom: "2px" }}>📥 Data EDI (Matrix) — periode {activePeriod}</div>
                <div style={{ fontSize: "11px", color: "var(--text3)" }}>
                  Sheet <strong>COMBINE</strong> dari export EDI. Key-nya sama persis dengan Excel, jadi exact-match sampai level Pcode.
                  {ediRows.length > 0 && <span style={{ color: "#166534", fontWeight: 700 }}> · {ediRows.length.toLocaleString("id-ID")} baris EDI tersimpan</span>}
                </div>
              </div>
              <button onClick={() => setEdiUploadOpen(true)}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", border: "none", background: "#7C3AED", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <Upload size={13} /> Upload EDI
              </button>
            </div>

            {ediFile && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "10px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 12px", width: "fit-content" }}>
                <FileSpreadsheet size={14} color="#7C3AED" />
                <span style={{ fontSize: "12px", fontWeight: 600 }}>{ediFile.name}</span>
                <button onClick={resetEdi} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: "0 0 0 4px", fontSize: "16px", lineHeight: 1 }}>×</button>
              </div>
            )}

            {ediParsing && (
              <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
                <RefreshCw size={14} color="#7C3AED" style={{ animation: "spin 1s linear infinite" }} /> Memproses EDI...
              </div>
            )}
            {ediError && (
              <div style={{ marginTop: "10px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "8px", padding: "8px 12px", fontSize: "11px", color: "#991B1B" }}>{ediError}</div>
            )}

            {ediParsedRows && ediUploading && (
              <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--text3)" }}>
                📊 <strong>{ediParsedRows.length.toLocaleString("id-ID")}</strong> baris terdeteksi · Total Target: <strong>{fmt(ediParsedRows.reduce((s, r) => s + r.target_amount, 0))}</strong> — otomatis diupload...
              </div>
            )}

            {ediProgress.length > 0 && (
              <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "3px" }}>
                {ediProgress.slice(-4).map((p, i) => (
                  <div key={i} style={{ fontSize: "11px", color: p.startsWith("✅") || p.startsWith("🎉") ? "#166534" : "var(--text3)" }}>{p}</div>
                ))}
              </div>
            )}
            {ediDone && (
              <div style={{ marginTop: "10px", fontSize: "12px", fontWeight: 700, color: "#166534" }}>✅ EDI tersimpan otomatis — kolom &quot;Matrix Target PHI&quot; di tabel atas sudah aktif.</div>
            )}

            {/* Preview tabel data EDI yang sudah tersimpan */}
            {ediRows.length > 0 && (
              <div style={{ marginTop: "14px", borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
                <RawDataTable rows={ediRows} emptyHint="Belum ada data Matrix Target PHI (EDI)" />
              </div>
            )}
          </div>
        )}

        {/* Upload Modal EDI */}
        {ediUploadOpen && (
          <div onClick={e => { if (e.target === e.currentTarget) setEdiUploadOpen(false) }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)" }}>
            <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "28px", width: "440px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <div>
                  <div style={{ fontSize: "17px", fontWeight: 800 }}>Upload EDI Target</div>
                  <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>File dengan sheet &quot;COMBINE&quot; (DIST_CODE, SLSNO, PCODE, TRGRP1, ...)</div>
                </div>
                <button onClick={() => setEdiUploadOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "22px", lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
              <input ref={ediFileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { setEdiFile(f); handleEdiFile(f); setEdiUploadOpen(false) }; e.target.value = "" }} />
              <div onClick={() => ediFileRef.current?.click()}
                style={{ border: "2px dashed var(--border)", borderRadius: "12px", padding: "36px 20px", textAlign: "center", cursor: "pointer", background: "var(--surface2)" }}>
                <Upload size={32} color="#7C3AED" style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: "13px", fontWeight: 700, marginBottom: "4px" }}>Klik untuk pilih file</div>
                <div style={{ fontSize: "11px", color: "var(--text3)" }}>EDI_Target_Salesman.xlsx</div>
              </div>
            </div>
          </div>
        )}
      </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
