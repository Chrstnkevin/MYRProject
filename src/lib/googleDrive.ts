// Akses READ-ONLY ke Google Drive via Service Account — dipakai buat nyari
// file dokumen BR per perusahaan (PHI/HSJ/SCP/MT) di CODA, biar tombol
// "Lihat Dokumen" cuma muncul kalau filenya beneran ketemu. Autentikasi
// pakai JWT RS256 manual (bukan SDK googleapis) biar nggak nambah
// dependency baru — cukup fetch + crypto bawaan Node.
//
// SERVER-ONLY: butuh env var GOOGLE_SERVICE_ACCOUNT_KEY (isi FULL JSON key
// service account, di-paste apa adanya sebagai 1 baris env var). Jangan
// pernah import file ini dari client component — pakai src/lib/docMatch.ts
// (pure functions) buat logic matching yang aman dipanggil di browser.
import crypto from "crypto"
import type { DriveFile } from "./docMatch"

// Folder Drive "BR TEAM" user, per sub-folder perusahaan — SCP foldernya
// Drive aslinya dikasih nama "SNOPIX" (dikonfirmasi user), bukan "SCP".
const COMPANY_FOLDER_IDS: Record<string, string> = {
  PHI: "1zSL4PCA2JlbI9K61Dstbj1kogVNyJbp7",
  HSJ: "1Bn3TzZ1fYEFlDV_qlGECtVj5qpII0Pny",
  SCP: "1-30lAq-7CBSdXe1-EVF3PpgejJvNcvno",
  MT: "122jf3Yf-5Ryf7-vrC6O36vf48iol7I4w",
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function getAccessToken(): Promise<string> {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY belum di-set")
  const sa = JSON.parse(keyJson) as { client_email: string; private_key: string }
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: "RS256", typ: "JWT" }
  const claim = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`
  const signer = crypto.createSign("RSA-SHA256")
  signer.update(unsigned)
  const jwt = `${unsigned}.${base64url(signer.sign(sa.private_key))}`

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error("Gagal auth Google Drive: " + (data.error_description || data.error || res.status))
  return data.access_token as string
}

async function listFolderFiles(token: string, folderId: string): Promise<DriveFile[]> {
  const files: DriveFile[] = []
  let pageToken: string | undefined
  do {
    const q = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`)
    const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=nextPageToken,files(name,webViewLink)&pageSize=200${pageToken ? `&pageToken=${pageToken}` : ""}`
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const data = await res.json()
    if (!res.ok) throw new Error("Gagal list folder Drive: " + (data.error?.message || res.status))
    files.push(...((data.files || []) as DriveFile[]))
    pageToken = data.nextPageToken
  } while (pageToken)
  return files
}

// Cache in-memory per server instance — folder dokumen BR nggak sesering
// itu berubah, jadi nggak perlu nembak Drive API tiap render tabel.
let cache: { data: Record<string, DriveFile[]>; expiresAt: number } | null = null
const CACHE_TTL_MS = 10 * 60 * 1000

export async function getCompanyDriveFiles(): Promise<Record<string, DriveFile[]>> {
  if (cache && cache.expiresAt > Date.now()) return cache.data
  const token = await getAccessToken()
  const result: Record<string, DriveFile[]> = {}
  for (const [company, folderId] of Object.entries(COMPANY_FOLDER_IDS)) {
    result[company] = await listFolderFiles(token, folderId)
  }
  cache = { data: result, expiresAt: Date.now() + CACHE_TTL_MS }
  return result
}
