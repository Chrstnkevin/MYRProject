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
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    if (res.status === 401) throw new SuperhumanDocsError("Token Superhuman Docs invalid/expired (HTTP 401) — cek lagi SUPERHUMAN_DOCS_API_TOKEN")
    if (res.status === 403) throw new SuperhumanDocsError("Token nggak punya akses ke resource ini (HTTP 403) — token kamu read-only, pastikan scope-nya cukup")
    if (res.status === 429) throw new SuperhumanDocsError("Kena rate limit Superhuman Docs (HTTP 429) — coba lagi sebentar")
    throw new SuperhumanDocsError(`Superhuman Docs API error (HTTP ${res.status}): ${body.slice(0, 300)}`)
  }
  return res.json() as Promise<T>
}