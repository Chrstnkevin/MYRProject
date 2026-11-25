// Helper login + fetch ke Logix (phi.logix.my.id) — dipakai bareng oleh
// /api/logix-tickets dan /api/logix-tickets-sla, keduanya butuh login
// pakai cookie session (ci_session) yang sama persis sebelum bisa narik
// data. Diekstrak ke sini (sebelumnya duplikat persis di 2 file) biar fix
// di bawah (retry + User-Agent) otomatis kena ke DUA endpoint sekaligus.
//
// Context: user lapor error "Gagal konek ke Logix: fetch failed (cause:
// ECONNRESET)" — koneksi diputus PAKSA di tengah request (beda dari
// ECONNREFUSED/timeout). Penyebab paling umum buat server internal yang
// diakses dari serverless function: (1) request tanpa User-Agent
// dianggap bot sama WAF/plugin keamanan terus di-reset, (2) connection
// pool Node reuse socket yang udah ditutup di sisi server. Fix:
// fetchWithRetry (coba ulang sekali-dua kali khusus buat error jaringan
// yang sifatnya sementara) + User-Agent browser yang wajar.
export const LOGIX_BASE = "https://phi.logix.my.id"

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
}

const TRANSIENT_ERROR_CODES = new Set(["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "EPIPE", "ENOTFOUND"])

export async function fetchWithRetry(url: string, init: RequestInit = {}, retries = 2): Promise<Response> {
  const headers = { ...BROWSER_HEADERS, ...(init.headers as Record<string, string> | undefined) }
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, { ...init, headers })
    } catch (e) {
      lastErr = e
      const code = e instanceof Error && e.cause ? (e.cause as { code?: string }).code : undefined
      // Cuma retry buat error JARINGAN yang sifatnya sementara — error
      // lain (mis. body invalid) nggak akan beda hasilnya diulang.
      if (attempt < retries && code && TRANSIENT_ERROR_CODES.has(code)) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
        continue
      }
      throw e
    }
  }
  throw lastErr
}

function readSetCookies(res: Response): string[] {
  const h = res.headers as unknown as { getSetCookie?: () => string[] }
  if (typeof h.getSetCookie === "function") return h.getSetCookie()
  const raw = res.headers.get("set-cookie")
  return raw ? [raw] : []
}

function mergeCookies(jar: Map<string, string>, setCookies: string[]) {
  for (const c of setCookies) {
    const pair = c.split(";")[0]
    const eq = pair.indexOf("=")
    if (eq === -1) continue
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
}

export function cookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ")
}

// GET halaman login dulu (jaga-jaga ada cookie CSRF dkk yang harus ada
// sebelum submit form, sama kayak browser beneran), baru POST kredensial.
export async function loginToLogix(email: string, password: string): Promise<Map<string, string>> {
  const jar = new Map<string, string>()

  const loginPageRes = await fetchWithRetry(`${LOGIX_BASE}/LogAuth`, { redirect: "manual" })
  mergeCookies(jar, readSetCookies(loginPageRes))

  const loginRes = await fetchWithRetry(`${LOGIX_BASE}/LogAuth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(jar.size ? { Cookie: cookieHeader(jar) } : {}),
    },
    body: new URLSearchParams({ email, password, token: "" }).toString(),
    redirect: "manual",
  })
  mergeCookies(jar, readSetCookies(loginRes))

  return jar
}

// "fetch failed" dari undici itu cuma pesan pembungkus — alasan aslinya
// (DNS gagal, koneksi direset, timeout, sertifikat SSL, dst) ada di
// e.cause. Tanpa ini cuma keliatan "fetch failed" doang.
export function describeFetchError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e)
  const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
  return `Gagal konek ke Logix: ${msg}${cause ? ` (cause: ${cause})` : ""}`
}
