// Util PURE (aman dipanggil dari client component) buat nyocokin dokumen
// Coda (ADOP "Doc. Ref." / Plan Pilot "Doc. No.") ke file di Google Drive
// — dipakai bareng src/lib/googleDrive.ts (yang server-only, manggil Drive
// API beneran) buat fitur tombol "Lihat Dokumen" di CODA.
export interface DriveFile { name: string; webViewLink: string; modifiedTime?: string }

// Kode dokumen BR formatnya: 1 huruf + 2 digit tahun + "-" + nomor/"XXX" +
// "-" + kode modul, mis. "I26-438-MTX", "D26-129-SFA", "T26-XXX-MTX" —
// dikonfirmasi dari nama file asli di folder Drive user. Ekstrak kode ini
// dari teks apapun (nama file Drive ATAUPUN "Doc. Ref."/"Doc. No." Coda)
// biar bisa dibandingin apple-to-apple.
const DOC_CODE_REGEX = /\b[A-Za-z]\d{2}-[A-Za-z0-9]+-[A-Za-z0-9]+/

export function extractDocCode(text: string): string | null {
  const m = DOC_CODE_REGEX.exec(text)
  return m ? m[0].toUpperCase() : null
}

// Cari file Drive yang nama-nya MENGANDUNG kode dokumen yang sama persis
// kayak yang di-extract dari teks Coda-nya. null kalau kodenya nggak
// ke-extract atau nggak ada file yang cocok. Kalau ada LEBIH DARI 1 file
// yang cocok (mis. draft lama + final-nya kebetulan nama-nya mirip),
// dipilih yang `modifiedTime`-nya PALING BARU — asumsinya versi terbaru
// yang paling relevan, bukan asal ambil urutan pertama dari Drive API
// (urutan itu nggak dijamin berarti apa-apa).
export function findDriveFileForDoc(files: DriveFile[], docText: string): DriveFile | null {
  const code = extractDocCode(docText)
  if (!code) return null
  const matches = files.filter(f => f.name.toUpperCase().includes(code))
  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0]
  return matches.reduce((latest, f) => {
    const a = f.modifiedTime ? Date.parse(f.modifiedTime) : 0
    const b = latest.modifiedTime ? Date.parse(latest.modifiedTime) : 0
    return a > b ? f : latest
  })
}

// Plan Pilot nggak di-split per-perusahaan kayak ADOP (1 batch "Plan
// Pilot" bisa nyampur beberapa User sekaligus, mis. "PHI + ALL") — jadi
// field "User Request"-nya perlu di-scan buat SEMUA kode perusahaan yang
// disebut, bukan exact-match 1 nilai kayak ADOP.
export const COMPANY_CODES = ["PHI", "HSJ", "SCP", "MT"] as const
export function detectCompanies(text: string): string[] {
  const upper = text.toUpperCase()
  return COMPANY_CODES.filter(c => new RegExp(`\\b${c}\\b`).test(upper))
}
