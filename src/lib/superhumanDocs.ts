// Integrasi Superhuman Docs (nama baru dari Coda, rebrand Juli 2026) — API
// REST-nya masih persis struktur Coda lama. Base URL & bentuk endpoint di
// bawah ini diambil dari file OpenAPI spec yang user kasih (dari dokumentasi
// resmi https://docs.superhuman.com/developers/apis/v1, yang nggak bisa
// diakses langsung dari sandbox ini karena domain-nya nggak di-allowlist
// proxy) — BUKAN hasil verifikasi langsung. Kalau ternyata base URL-nya
// udah pindah dari coda.io, tinggal ganti SUPERHUMAN_DOCS_BASE_URL di sini.
//
// Token WAJIB server-side (lewat SUPERHUMAN_DOCS_API_TOKEN di env var
// Vercel) — jangan pernah expose ke browser.
const SUPERHUMAN_DOCS_BASE_URL = "https://coda.io/apis/v1"

export class SuperhumanDocsError extends Error {}

function getToken(): string {
  const token = process.env.SUPERHUMAN_DOCS_API_TOKEN
  if (!token) throw new SuperhumanDocsError("SUPERHUMAN_DOCS_API_TOKEN belum di-set di environment variable")
  return token
}

export async function callSuperhumanDocsApi<T>(path: string, searchParams?: Record<string, string | number | boolean | undefined>): Promise<T> {
  const qs = new URLSearchParams()
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== "") qs.set(k, String(v))
    }
  }
  const url = `${SUPERHUMAN_DOCS_BASE_URL}${path}${qs.toString() ? `?${qs.toString()}` : ""}`
  return fetchSuperhumanDocsUrl<T>(url)
}

// Fetch pakai URL LENGKAP (dipakai juga buat ngikutin nextPageLink pas
// pagination — nextPageLink dari Coda itu udah URL jadi siap pakai,
// nggak perlu/boleh dibangun ulang dari path+query manual).
async function fetchSuperhumanDocsUrl<T>(url: string): Promise<T> {
  const token = getToken()

  // SEBELUMNYA: request bisa nyangkut 100+ detik sebelum akhirnya gagal
  // dengan pesan generik "fetch failed" doang (ketauan pas dites user di
  // local — di Vercel jalan lancar, tapi di jaringan lokal/kantor kena
  // timeout/block). Dua perbaikan: (1) timeout eksplisit 15 detik lewat
  // AbortController biar nggak nunggu lama banget, (2) bungkus fetch
  // dengan try/catch buat nangkep detail error jaringan (e.cause.code —
  // ETIMEDOUT/ENOTFOUND/dll) yang sebelumnya ketelen, cuma nyisain "fetch
  // failed" polos tanpa info apa-apa.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  let res: Response
  try {
    // cache: "no-store" WAJIB — tanpa ini Next.js nge-cache fetch() server
    // ini SENDIRI secara default (terpisah dari cache kita sendiri di
    // withSuperhumanDocsCache), nggak ada TTL otomatis. Ini kemungkinan
    // besar PENYEBAB ASLI kenapa tombol Refresh di tab ADOP sempat
    // kelihatan "nggak ngaruh" (data lama ke-serve dari cache Next.js,
    // bukan beneran nembus ke Coda). Sekarang satu-satunya lapisan cache
    // yang ada cuma withSuperhumanDocsCache, yang bisa di-bypass jelas
    // lewat fresh=1.
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: controller.signal, cache: "no-store" })
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new SuperhumanDocsError(`Request ke Superhuman Docs timeout (>15 detik) — kemungkinan jaringan lokal/kantor kamu lambat atau diblokir ke coda.io. Coba cek koneksi internet/VPN/firewall, atau tes lagi dari jaringan lain.`)
    }
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    throw new SuperhumanDocsError(`Gagal konek ke Superhuman Docs: ${e instanceof Error ? e.message : String(e)}${cause ? ` (cause: ${cause})` : ""} — kemungkinan jaringan lokal/kantor kamu nggak bisa jangkau coda.io (firewall/proxy/DNS), coba cek koneksi internet/VPN kamu.`)
  } finally {
    clearTimeout(timeout)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    if (res.status === 401) throw new SuperhumanDocsError("Token Superhuman Docs invalid/expired (HTTP 401) — cek lagi SUPERHUMAN_DOCS_API_TOKEN")
    if (res.status === 403) throw new SuperhumanDocsError("Token nggak punya akses ke resource ini (HTTP 403) — token kamu read-only, pastikan scope-nya cukup")
    if (res.status === 429) throw new SuperhumanDocsError("Kena rate limit Superhuman Docs (HTTP 429) — coba lagi sebentar")
    throw new SuperhumanDocsError(`Superhuman Docs API error (HTTP ${res.status}): ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}

// Cache in-memory sederhana per-instance server (TTL, bukan persistent —
// reset kalau cold start/instance baru) — dipakai buat ngurangin keluhan
// "lamaa" pas buka tab yang sama berkali-kali dalam rentang waktu deket
// (docs/tables jarang berubah, rows juga nggak realtime-critical buat
// dashboard monitoring ini). Lewat `fresh=true` buat BYPASS cache (dipakai
// tombol Refresh di UI).
const memCache = new Map<string, { data: unknown; expires: number }>()

export async function withSuperhumanDocsCache<T>(key: string, ttlMs: number, fresh: boolean, fn: () => Promise<T>): Promise<T> {
  const now = Date.now()
  if (!fresh) {
    const hit = memCache.get(key)
    if (hit && hit.expires > now) return hit.data as T
  }
  const data = await fn()
  memCache.set(key, { data, expires: now + ttlMs })
  return data
}

interface PagedList<T> { items: T[]; nextPageToken?: string; nextPageLink?: string }

// SEBELUMNYA: list Docs/Table/Row cuma ambil 1 halaman pertama, TIDAK
// ngikutin halaman berikutnya — ketauan jadi BUG NYATA 2x: (1) doc
// "Monitoring Pilot" nggak ketemu bukan soal izin akses, (2) table
// "Plan Pilot" yang aslinya 6000+ baris di Coda cuma kebaca 200 di app
// kita. Root cause pagination-nya: kode SEBELUMNYA cuma ngecek field
// `nextPageToken` buat nentuin ada halaman lagi atau nggak — ternyata
// Coda balikin `nextPageLink` (URL LENGKAP siap pakai), BUKAN token
// polos, jadi `nextPageToken` SELALU kosong dan loop berhenti di
// halaman pertama terus walau sebenernya masih ada ribuan baris lagi.
// Fix: prioritaskan ngikutin nextPageLink (fetch langsung ke URL itu,
// JANGAN dibangun ulang dari path+searchParams), fallback ke
// nextPageToken kalau nextPageLink nggak ada. Dibatasi 100 halaman
// (bukan 20 lagi, karena 1 table aja bisa 6000+ baris / limit 200 per
// halaman = perlu 30+ halaman) buat jaga-jaga loop aneh/respons rusak.
export async function callSuperhumanDocsApiAllPages<T>(path: string, searchParams?: Record<string, string | number | boolean | undefined>): Promise<T[]> {
  const allItems: T[] = []
  let data = await callSuperhumanDocsApi<PagedList<T>>(path, searchParams)
  allItems.push(...(data.items || []))
  for (let page = 1; page < 100 && (data.nextPageLink || data.nextPageToken); page++) {
    data = data.nextPageLink
      ? await fetchSuperhumanDocsUrl<PagedList<T>>(data.nextPageLink)
      : await callSuperhumanDocsApi<PagedList<T>>(path, { ...searchParams, pageToken: data.nextPageToken })
    allItems.push(...(data.items || []))
  }
  return allItems
}