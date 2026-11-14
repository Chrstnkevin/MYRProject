// Util nomor minggu ISO 8601 (Senin-Minggu, minggu 1 = minggu yang
// punya Kamis pertama tahun itu) — dikonfirmasi SAMA PERSIS sama
// "Operation Calendar" Mayora Group yang user kasih (week 1 2026 =
// 29 Des 2025 - 4 Jan 2026, dst), jadi aman dipakai tanpa perlu
// hardcode kalender taun-per-tahun — otomatis bener buat tahun
// manapun. Dipakai buat: (1) widget "hari ini week berapa" di Header
// (semua halaman), (2) nge-cocokin value "2026.45" dkk di kolom
// Submit/Review/Dev/Test Sprint ADOP ke tanggal asli buat deteksi
// telat (lihat src/app/dashboard/coda/page.tsx).
export function isoWeekInfo(date: Date = new Date()): { year: number; week: number } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Senin=0 ... Minggu=6
  d.setDate(d.getDate() - day + 3) // geser ke Kamis minggu yang sama
  const year = d.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const jan4Day = (jan4.getDay() + 6) % 7
  jan4.setDate(jan4.getDate() - jan4Day + 3) // Kamis minggu 1
  const week = 1 + Math.round((d.getTime() - jan4.getTime()) / (7 * 86400000))
  return { year, week }
}

// Tanggal Senin dari {year, week} tertentu — kebalikan dari isoWeekInfo,
// dipakai buat nentuin kapan "deadline" suatu minggu kerja berakhir.
export function isoWeekStart(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = (jan4.getDay() + 6) % 7
  const week1Monday = new Date(jan4)
  week1Monday.setDate(jan4.getDate() - jan4Day)
  const d = new Date(week1Monday)
  d.setDate(week1Monday.getDate() + (week - 1) * 7)
  return d
}

// Parse value kayak "2026.45" / "2026.45.BE" (format Submit/Review/Dev/
// Test Sprint ADOP) jadi {year, week}. null kalau formatnya bukan itu
// (mis. kosong, atau teks lain).
export function parseYearWeek(v: string): { year: number; week: number } | null {
  const m = /^(\d{4})\.(\d{1,2})\b/.exec(v.trim())
  if (!m) return null
  const year = parseInt(m[1], 10)
  const week = parseInt(m[2], 10)
  if (week < 1 || week > 53) return null
  return { year, week }
}
