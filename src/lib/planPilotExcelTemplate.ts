// Generator Excel "Form Detail RELEASE" — replika template
// Form_Request_Pilot_SFA_For_MD yang user kasih. Struktur/warna/border
// di sini hasil bongkar-pasang file aslinya pakai exceljs (font
// Calibri, fill indexed 42/46/47/9, border thin/medium kombinasi khas
// Excel buat bikin tabel). Dipanggil dari API route
// /api/coda/plan-pilot-report, bukan dari browser langsung (exceljs
// dengan styling lengkap lebih pas dijalankan di server).
import ExcelJS from "exceljs"

export interface SubdistRow { no: number; kodeSubdist: string; namaSubdist: string; keterangan: string; pilotBy: string }
export interface DocRow { no: number; modul: string; docName: string; keterangan: string; onVersion: string; reqBy: string; testBy: string; status: string }
export interface PlanPilotReportData {
  releaseName: string
  subdist: SubdistRow[]
  docs: DocRow[]
  signatures: { mengajukan: string; mengCompile: string; mengetahui: string; menyetujui: string }
}

const FONT = { name: "Calibri", size: 10 }
const FONT11 = { name: "Calibri", size: 11 }
// exceljs TYPE-nya cuma support argb/theme buat Color (nggak ada
// "indexed" di definisi), jadi warna palet lama (indexed 42/46/47/9/
// 10/8) dikonversi ke ARGB hex yang visualnya setara: ijo muda
// (header), oranye/gold (section "Pilot Implementation"), ijo pucat
// ("List"), kuning (highlight No/Req By/Test By), merah (teks
// "Confidential"), hitam (teks biasa di atas fill kuning).
const CLR = {
  green: "FF92D050", orange: "FFFFC000", paleGreen: "FFC6E0B4",
  yellow: "FFFFFF00", red: "FFFF0000", black: "FF000000", statusBlue: "FF00B0F0",
}
const FILL = (hex: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb: hex } })
const NOFILL: ExcelJS.Fill = { type: "pattern", pattern: "none" }
const THIN = { style: "thin" as const }
const MED = { style: "medium" as const }

export function buildPlanPilotReportWorkbook(data: PlanPilotReportData): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Form Release")
  ws.columns = [
    { width: 4.22 }, { width: 4.78 }, { width: 17.89 }, { width: 78.22 },
    { width: 88 }, { width: 35.78 }, { width: 15.22 }, { width: 22.22 }, { width: 9.22 },
  ]

  type StyleOpts = Partial<{ font: Partial<ExcelJS.Font>; fill: ExcelJS.Fill; align: Partial<ExcelJS.Alignment>; border: Partial<ExcelJS.Borders> }>
  // Buat sel BUKAN-anchor di dalam merge (mis. F6/G6 dari merge E6:G6) -
  // SENGAJA nggak nyentuh .value sama sekali. exceljs nge-redirect
  // tulis .value ke sel ANCHOR merge-nya kalau kita assign value ke sel
  // non-anchor - assign "" ke situ bakal NGEHAPUS value si anchor
  // (ketauan dari test run: "Keterangan"/"Pilot By" ilang).
  const styleOnly = (r: number, c: number, opts: StyleOpts = {}) => {
    const cell = ws.getCell(r, c)
    cell.font = { ...FONT, ...opts.font }
    cell.fill = opts.fill || NOFILL
    if (opts.align) cell.alignment = opts.align
    if (opts.border) cell.border = opts.border
    return cell
  }
  const set = (r: number, c: number, v: unknown, opts: StyleOpts = {}) => {
    const cell = styleOnly(r, c, opts)
    cell.value = v as ExcelJS.CellValue
    return cell
  }

  // ── Header dokumen ──────────────────────────────────────────
  set(1, 2, "Form Detail RELEASE", { font: { bold: true } })
  ws.getRow(2).height = 6.75
  set(3, 2, `Release ${data.releaseName}`, { font: { bold: true, italic: true, size: 14 } })
  set(3, 9, "Confidential Knowledge untuk Kalangan Terbatas", { font: { italic: true, size: 8, color: { argb: CLR.red } }, align: { horizontal: "right" } })
  set(4, 9, "Application Support Global - 2025", { font: { italic: true, size: 8 }, align: { horizontal: "right" } })
  set(5, 2, "Pilot Implementation", { font: { bold: true, italic: true }, fill: FILL(CLR.orange) })

  // ── Tabel Subdist ───────────────────────────────────────────
  const subHeaderBorder = { top: MED, bottom: THIN }
  set(6, 2, "No", { font: { bold: true, italic: true }, fill: FILL(CLR.green), border: { left: MED, right: THIN, ...subHeaderBorder } })
  set(6, 3, "Kode Subdist", { font: { bold: true, italic: true }, fill: FILL(CLR.green), border: { left: THIN, right: THIN, ...subHeaderBorder } })
  set(6, 4, "Nama Subdist", { font: { bold: true, italic: true }, fill: FILL(CLR.green), border: subHeaderBorder })
  set(6, 5, "Keterangan", { font: { bold: true, italic: true }, fill: FILL(CLR.green), align: { horizontal: "left" }, border: { left: THIN, ...subHeaderBorder } })
  ws.mergeCells(6, 5, 6, 7)
  styleOnly(6, 6, { fill: FILL(CLR.green), border: subHeaderBorder })
  styleOnly(6, 7, { fill: FILL(CLR.green), border: { right: THIN, ...subHeaderBorder } })
  set(6, 8, "Pilot By", { font: { bold: true, italic: true }, fill: FILL(CLR.green), align: { horizontal: "center" }, border: { left: THIN, ...subHeaderBorder } })
  ws.mergeCells(6, 8, 6, 9)
  styleOnly(6, 9, { fill: FILL(CLR.green), border: { right: MED, ...subHeaderBorder } })

  const subRows = data.subdist.length > 0 ? data.subdist : [{ no: 1, kodeSubdist: "", namaSubdist: "", keterangan: "", pilotBy: "" }]
  subRows.forEach((s, i) => {
    const r = 7 + i
    const isLast = i === subRows.length - 1
    const bb = isLast ? MED : THIN
    set(r, 2, s.no, { align: { horizontal: "center" }, border: { left: MED, right: THIN, top: THIN, bottom: bb } })
    set(r, 3, s.kodeSubdist, { align: { horizontal: "center" }, border: { left: THIN, right: THIN, top: THIN, bottom: bb } })
    set(r, 4, s.namaSubdist, { border: { top: THIN, bottom: bb } })
    set(r, 5, s.keterangan, { border: { left: THIN, top: THIN, bottom: bb } })
    ws.mergeCells(r, 5, r, 7)
    styleOnly(r, 6, { border: { top: THIN, bottom: bb } })
    styleOnly(r, 7, { border: { right: THIN, top: THIN, bottom: bb } })
    set(r, 8, s.pilotBy, { align: { horizontal: "center" }, border: { left: THIN, top: THIN, bottom: bb } })
    ws.mergeCells(r, 8, r, 9)
    styleOnly(r, 9, { border: { right: MED, top: THIN, bottom: bb } })
  })

  // ── Section "List" + tabel dokumen ──────────────────────────
  const listRow = 7 + subRows.length + 2
  set(listRow, 2, "List", { font: { bold: true, italic: true }, fill: FILL(CLR.paleGreen), border: { left: MED, top: MED } })

  const docHeaderRow = listRow + 1
  const docHeaders: [number, string, Partial<ExcelJS.Alignment> | undefined][] = [
    [2, "No", { horizontal: "center" }], [3, "Modul", undefined],
    [4, "No. DR/ST Nama Dokumen", { wrapText: true }], [5, "Keterangan", { wrapText: true }],
    [6, "On Version", { horizontal: "center", wrapText: true }], [7, "Req By", { horizontal: "center", wrapText: true }],
    [8, "Test By", { horizontal: "center", wrapText: true }], [9, "Status", { horizontal: "center" }],
  ]
  docHeaders.forEach(([c, label, align]) => {
    const border = { left: c === 2 ? MED : THIN, right: c === 9 ? MED : THIN, top: MED, bottom: THIN }
    set(docHeaderRow, c, label, { font: { bold: true, italic: true, size: 11 }, fill: FILL(CLR.green), align, border })
  })

  data.docs.forEach((d, i) => {
    const r = docHeaderRow + 1 + i
    const base = { top: THIN, bottom: THIN }
    set(r, 2, d.no, { font: FONT11, fill: FILL(CLR.yellow), align: { horizontal: "center", vertical: "middle" }, border: { left: THIN, right: THIN, ...base } })
    set(r, 3, d.modul, { font: FONT11, align: { horizontal: "left", vertical: "middle", wrapText: true }, border: { left: THIN, right: THIN, ...base } })
    set(r, 4, d.docName, { font: FONT11, align: { wrapText: true }, border: { left: THIN, right: THIN, ...base } })
    set(r, 5, d.keterangan, { font: FONT11, align: { wrapText: true }, border: { left: THIN, right: THIN, ...base } })
    set(r, 6, d.onVersion, { font: FONT11, align: { vertical: "top" }, border: { left: THIN, right: THIN, ...base } })
    set(r, 7, d.reqBy, { font: { ...FONT11, color: { argb: CLR.black } }, fill: FILL(CLR.yellow), align: { vertical: "top" }, border: { left: THIN, right: THIN, ...base } })
    set(r, 8, d.testBy, { font: { ...FONT11, color: { argb: CLR.black } }, fill: FILL(CLR.yellow), align: { vertical: "top" }, border: { left: THIN, right: THIN, ...base } })
    set(r, 9, d.status, { font: { ...FONT11, color: { argb: CLR.statusBlue } }, align: { vertical: "top" }, border: { left: THIN, right: MED, ...base } })
  })

  // ── Tanda tangan ─────────────────────────────────────────────
  const docsEndRow = docHeaderRow + Math.max(1, data.docs.length)
  const sigLabelRow = docsEndRow + 2
  set(sigLabelRow, 2, "       Mengajukan,", { align: { horizontal: "left" } })
  set(sigLabelRow, 4, "                         Meng-compile,", { align: { horizontal: "center" } })
  set(sigLabelRow, 5, "                                               Mengetahui,", { font: { italic: true } })
  set(sigLabelRow, 7, "Menyetujui,", { font: { italic: true } })

  const sigLineRow = sigLabelRow + 4
  set(sigLineRow, 2, `(${data.signatures.mengajukan.padEnd(26, " ")})`, { align: { horizontal: "left" } })
  set(sigLineRow, 4, `(${data.signatures.mengCompile.padEnd(35, " ")})`, { align: { horizontal: "center" } })
  set(sigLineRow, 5, `(${data.signatures.mengetahui.padEnd(42, " ")})`, { align: { horizontal: "left" } })
  set(sigLineRow, 7, `(${data.signatures.menyetujui.padEnd(34, " ")})`, { align: { horizontal: "left" } })

  return wb
}
