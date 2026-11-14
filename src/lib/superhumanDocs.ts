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
  const token = getToken()
  const qs = new URLSearchParams()
  if (searchParams) {
    for (const [k, v] of Object.entries(searchParams)) {
      if (v !== undefined && v !== "") qs.set(k, String(v))
    }
  }
  const url = `${SUPERHUMAN_DOCS_BASE_URL}${path}${qs.toString() ? `?${qs.toString()}` : ""}`

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
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: controller.signal })
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

interface PagedList<T> { items: T[]; nextPageToken?: string }

// SEBELUMNYA: list Docs/Table/Row cuma ambil 1 halaman pertama (limit
// 50-200), TIDAK ngikutin nextPageToken — ketauan jadi BUG NYATA: akun
// user bisa buka doc "Monitoring Pilot" normal di browser, tapi nggak
// pernah muncul di hasil GET /docs kita karena doc itu kebetulan nggak
// masuk 50 doc pertama yang kebalik, BUKAN soal izin akses. Fix: ambil
// SEMUA halaman sampai nextPageToken abis (dibatasi 20 halaman buat
// jaga-jaga kalau ada loop aneh/respons rusak).
export async function callSuperhumanDocsApiAllPages<T>(path: string, searchParams?: Record<string, string | number | boolean | undefined>): Promise<T[]> {
  const allItems: T[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 20; page++) {
    const data = await callSuperhumanDocsApi<PagedList<T>>(path, { ...searchParams, pageToken })
    allItems.push(...(data.items || []))
    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }
  return allItems
}