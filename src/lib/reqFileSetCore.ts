// Logic parsing & deteksi "stock minus" untuk fitur "Form Request File Set" —
// murni (tanpa exceljs) supaya bisa dipakai baik di client (scan otomatis di
// halaman /landing/req-fileset) maupun server (/api/req-fileset/generate).
export type GudangType = "MAIN" | "TAMBAHAN" | "KANVAS" | "UNKNOWN"

export interface MinusRow {
  gudang: string
  pcode: string
  minus: number
}

export interface ClassifiedRow extends MinusRow {
  type: GudangType
}

// Gudang "00"/kosong -> WH MAIN (tanpa lokasi, cuma PCODE)
// Gudang kode gudang pendek (1-2 digit, mis. 10/50/51/52/53) -> WH TAMBAHAN
// Gudang kode SLSNO (5-6 digit, mis. 215002) -> WH KANVAS
export function classifyGudang(raw: string): GudangType {
  const g = (raw || "").trim()
  if (!g || g === "00" || g === "0" || /^main$/i.test(g)) return "MAIN"
  if (/^\d{1,2}$/.test(g)) return "TAMBAHAN"
  if (/^\d{5,6}$/.test(g)) return "KANVAS"
  return "UNKNOWN"
}

function parseDelimited(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/)
  if (!lines.length) return []
  const delim = lines[0].includes("|") ? "|" : ","
  const headers = lines[0].split(delim).map(h => h.replace(/"/g, "").trim().toLowerCase())
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split(delim).map(c => c.replace(/"/g, "").trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cols[i] ?? "" })
    return row
  })
}

const num = (v: string | undefined) => {
  if (v === undefined || v === "") return 0
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export interface MainTxtRow { pcode: string; tipe: number; begdate: string; stock: number; stockbs: number; stockexp: number; unitcost: number }
export interface TambahanTxtRow { kg: string; pcode: string; tipe: number; begdate: string; stock: number; unitcost: number }
export interface VanTxtRow { pcode: string; slsno: string; tipe: number; begdate: string; stock: number; unitcost: number }

export function parseMainTxt(text: string): MainTxtRow[] {
  return parseDelimited(text).map(r => ({
    pcode: r.pcode || "", tipe: num(r.tipe), begdate: r.begdate || "",
    stock: num(r.stock), stockbs: num(r.stockbs), stockexp: num(r.stockexp), unitcost: num(r.unitcost),
  }))
}

export function parseTambahanTxt(text: string): TambahanTxtRow[] {
  return parseDelimited(text).map(r => ({
    kg: r["kode gudang"] || r.kg || "", pcode: r.pcode || "", tipe: num(r.tipe), begdate: r.begdate || "",
    stock: num(r.stock), unitcost: num(r.unitcost),
  }))
}

export function parseVanTxt(text: string): VanTxtRow[] {
  return parseDelimited(text).map(r => ({
    pcode: r.pcode || "", slsno: r.slsno || "", tipe: num(r.tipe), begdate: r.begdate || "",
    stock: num(r.stock), unitcost: num(r.unitcost),
  }))
}

const norm = (v: string) => (v || "").trim().replace(/^0+(?=\d)/, "")
const begdateKey = (d: string) => { const [dd, mm, yyyy] = d.split("/"); return `${yyyy}${mm}${dd}` }

// Cari pasangan TIPE1/TIPE2 pada tanggal yang sama — tanggal dipilih dari baris
// TIPE=2 paling baru yang ada (BEGDATE lain, mis. hari ini, cuma saldo carry-
// forward TIPE1 dan tidak relevan untuk koreksi stock minus).
function findPair<T extends { tipe: number; begdate: string }>(rows: T[]): { tipe1: T | null; tipe2: T | null } {
  const withT2 = rows.filter(r => r.tipe === 2)
  if (!withT2.length) return { tipe1: null, tipe2: null }
  const begdate = withT2.map(r => r.begdate).sort((a, b) => begdateKey(a).localeCompare(begdateKey(b))).slice(-1)[0]
  const tipe2 = withT2.find(r => r.begdate === begdate) || null
  const tipe1 = rows.find(r => r.tipe === 1 && r.begdate === begdate) || null
  return { tipe1, tipe2 }
}

function groupBy<T>(rows: T[], keyfn: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>()
  for (const r of rows) {
    const k = keyfn(r)
    const arr = m.get(k)
    if (arr) arr.push(r); else m.set(k, [r])
  }
  return m
}

// "Minus" = STOCK tipe 2 lebih kecil dari tipe 1 (di tanggal yang sama).
// Seharusnya tipe 2 selalu sama dengan tipe 1 — kalau lebih kecil, itu yang
// perlu dibenarkan (Excel-nya nanti menyamakan tipe 2 ke tipe 1).
export function scanMinusMain(data: MainTxtRow[]): ClassifiedRow[] {
  const out: ClassifiedRow[] = []
  for (const [, rows] of groupBy(data, r => norm(r.pcode))) {
    const { tipe1, tipe2 } = findPair(rows)
    if (tipe1 && tipe2 && tipe2.stock < tipe1.stock) {
      out.push({ gudang: "00", pcode: tipe1.pcode, minus: tipe2.stock - tipe1.stock, type: "MAIN" })
    }
  }
  return out
}

export function scanMinusTambahan(data: TambahanTxtRow[]): ClassifiedRow[] {
  const out: ClassifiedRow[] = []
  for (const [, rows] of groupBy(data, r => `${norm(r.kg)}|${norm(r.pcode)}`)) {
    const { tipe1, tipe2 } = findPair(rows)
    if (tipe1 && tipe2 && tipe2.stock < tipe1.stock) {
      out.push({ gudang: tipe1.kg, pcode: tipe1.pcode, minus: tipe2.stock - tipe1.stock, type: "TAMBAHAN" })
    }
  }
  return out
}

export function scanMinusKanvas(data: VanTxtRow[]): ClassifiedRow[] {
  const out: ClassifiedRow[] = []
  for (const [, rows] of groupBy(data, r => `${norm(r.pcode)}|${norm(r.slsno)}`)) {
    const { tipe1, tipe2 } = findPair(rows)
    if (tipe1 && tipe2 && tipe2.stock < tipe1.stock) {
      out.push({ gudang: tipe1.slsno, pcode: tipe1.pcode, minus: tipe2.stock - tipe1.stock, type: "KANVAS" })
    }
  }
  return out
}

export interface MatchResult<T> {
  row: ClassifiedRow
  tipe1: T | null
  tipe2: T | null
  status: "OK" | "NO_MATCH" | "NO_PAIR"
}

export function matchMain(rows: ClassifiedRow[], data: MainTxtRow[]): MatchResult<MainTxtRow>[] {
  return rows.filter(r => r.type === "MAIN").map(row => {
    const subset = data.filter(d => norm(d.pcode) === norm(row.pcode))
    if (!subset.length) return { row, tipe1: null, tipe2: null, status: "NO_MATCH" as const }
    const { tipe1, tipe2 } = findPair(subset)
    return { row, tipe1, tipe2, status: (tipe1 && tipe2 ? "OK" : "NO_PAIR") as MatchResult<MainTxtRow>["status"] }
  })
}

export function matchTambahan(rows: ClassifiedRow[], data: TambahanTxtRow[]): MatchResult<TambahanTxtRow>[] {
  return rows.filter(r => r.type === "TAMBAHAN").map(row => {
    const subset = data.filter(d => norm(d.kg) === norm(row.gudang) && norm(d.pcode) === norm(row.pcode))
    if (!subset.length) return { row, tipe1: null, tipe2: null, status: "NO_MATCH" as const }
    const { tipe1, tipe2 } = findPair(subset)
    return { row, tipe1, tipe2, status: (tipe1 && tipe2 ? "OK" : "NO_PAIR") as MatchResult<TambahanTxtRow>["status"] }
  })
}

export function matchKanvas(rows: ClassifiedRow[], data: VanTxtRow[]): MatchResult<VanTxtRow>[] {
  return rows.filter(r => r.type === "KANVAS").map(row => {
    const subset = data.filter(d => norm(d.slsno) === norm(row.gudang) && norm(d.pcode) === norm(row.pcode))
    if (!subset.length) return { row, tipe1: null, tipe2: null, status: "NO_MATCH" as const }
    const { tipe1, tipe2 } = findPair(subset)
    return { row, tipe1, tipe2, status: (tipe1 && tipe2 ? "OK" : "NO_PAIR") as MatchResult<VanTxtRow>["status"] }
  })
}
