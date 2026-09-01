// Penyusun Excel "Form Request File Set" (REQ File Set / WH MAIN / WH
// TAMBAHAN / WH KANVAS) — pakai exceljs, jadi cuma boleh dipanggil dari
// server (lihat /api/req-fileset/generate). Logic parsing txt & deteksi
// stock minus ada di ./reqFileSetCore (client-safe, tanpa exceljs).
import ExcelJS from "exceljs"
import type { MainTxtRow, TambahanTxtRow, VanTxtRow, MatchResult } from "./reqFileSetCore"

export * from "./reqFileSetCore"

export interface ReqHeader {
  tanggalRequest: string // ISO yyyy-mm-dd
  picRequest: string
  kodeSubdist: string
  tanggalGudang: string // ISO yyyy-mm-dd
  keterangan: string
}

const FOOTER_TEXT = "TOLONG SAMAKAN STOCK YANG ADA DI TIPE 2 MENJADI SAMA DENGAN TIPE 1"
const asNum = (v: string) => { const n = Number(v); return Number.isFinite(n) && v.trim() !== "" ? n : v }
const dateCell = (ws: ExcelJS.Worksheet, addr: string, iso: string) => {
  const c = ws.getCell(addr)
  if (iso) { c.value = new Date(`${iso}T00:00:00`); c.numFmt = "dd/mm/yyyy" }
}

function buildReqSheet(wb: ExcelJS.Workbook, h: ReqHeader) {
  const ws = wb.addWorksheet("REQ File Set")
  ws.mergeCells("C1:E2")
  ws.getCell("C1").value = "FORM REQUEST FILESET (FS)"
  ws.getCell("C1").font = { bold: true, size: 14 }
  ws.getCell("C1").alignment = { horizontal: "center", vertical: "middle" }

  const labels = ["Tanggal Request", "PIC Request", "Kode Subdist", "Tanggal Gudang", "Keterangan"]
  ;["A4", "B4", "C4", "D4", "E4"].forEach((addr, i) => {
    ws.getCell(addr).value = labels[i]
    ws.getCell(addr).font = { bold: true }
  })
  ws.mergeCells("E4:F4")
  ws.mergeCells("A5:A22"); ws.mergeCells("B5:B22"); ws.mergeCells("C5:C22"); ws.mergeCells("D5:D22")
  ws.mergeCells("E5:F5"); ws.mergeCells("E9:F22")

  dateCell(ws, "A5", h.tanggalRequest)
  ws.getCell("B5").value = h.picRequest
  ws.getCell("C5").value = asNum(h.kodeSubdist)
  dateCell(ws, "D5", h.tanggalGudang)
  ws.getCell("E5").value = h.keterangan
  ws.getCell("E5").alignment = { wrapText: true, vertical: "top" }

  ws.getCell("E6").value = "ADP"
  ws.getCell("F6").value = asNum(h.kodeSubdist)
  ws.getCell("E7").value = "WH  Date"
  dateCell(ws, "F7", h.tanggalGudang)

  ws.columns = [{ width: 16 }, { width: 14 }, { width: 14 }, { width: 16 }, { width: 44 }, { width: 16 }]
}

function buildMainSheet(wb: ExcelJS.Workbook, matches: MatchResult<MainTxtRow>[]) {
  const ws = wb.addWorksheet("WH MAIN")
  const ok = matches.filter(m => m.status === "OK") as (MatchResult<MainTxtRow> & { tipe1: MainTxtRow; tipe2: MainTxtRow })[]
  const headers = ["PCODE", "TIPE", "BEGDATE", "STOCK", "STOCKBS", "STOCKEXP", "UNITCOST"]

  const writeHeaderRow = (r: number) => headers.forEach((hd, i) => { const c = ws.getCell(r, i + 1); c.value = hd; c.font = { bold: true } })
  const writeDataRows = (r: number, wantedStockOverride: boolean) => {
    for (const m of ok) {
      ws.getRow(r).values = [asNum(m.tipe1.pcode), 1, m.tipe1.begdate, m.tipe1.stock, m.tipe1.stockbs, m.tipe1.stockexp, m.tipe1.unitcost]
      r++
      ws.getRow(r).values = [asNum(m.tipe2.pcode), 2, m.tipe2.begdate, wantedStockOverride ? m.tipe1.stock : m.tipe2.stock, m.tipe2.stockbs, m.tipe2.stockexp, m.tipe2.unitcost]
      r++
    }
    return r
  }

  ws.getCell("A1").value = "KONDISI SAAT INI"; ws.getCell("A1").font = { bold: true }
  writeHeaderRow(2)
  let r = writeDataRows(3, false)
  r += 1
  ws.getCell(r, 1).value = "KONDISI DIHARAPKAN"; ws.getCell(r, 1).font = { bold: true }
  r += 1
  writeHeaderRow(r)
  r += 1
  r = writeDataRows(r, true)
  r += 1
  ws.getCell(r, 1).value = FOOTER_TEXT
  ws.columns.forEach(c => { c.width = 14 })
}

function buildTambahanSheet(wb: ExcelJS.Workbook, matches: MatchResult<TambahanTxtRow>[]) {
  const ws = wb.addWorksheet("WH TAMBAHAN")
  const ok = matches.filter(m => m.status === "OK") as (MatchResult<TambahanTxtRow> & { tipe1: TambahanTxtRow; tipe2: TambahanTxtRow })[]
  const headers = ["KG", "PCODE", "TIPE", "BEGDATE", "STOCK", "UNITCOST"]

  const writeHeaderRow = (r: number) => headers.forEach((hd, i) => { const c = ws.getCell(r, i + 1); c.value = hd; c.font = { bold: true } })
  const writeDataRows = (r: number, wantedStockOverride: boolean) => {
    for (const m of ok) {
      ws.getRow(r).values = [asNum(m.tipe2.kg), asNum(m.tipe2.pcode), 2, m.tipe2.begdate, wantedStockOverride ? m.tipe1.stock : m.tipe2.stock, m.tipe2.unitcost]
      r++
      ws.getRow(r).values = [asNum(m.tipe1.kg), asNum(m.tipe1.pcode), 1, m.tipe1.begdate, m.tipe1.stock, m.tipe1.unitcost]
      r++
    }
    return r
  }

  ws.getCell("A1").value = "KONDISI SAAT INI"; ws.getCell("A1").font = { bold: true }
  writeHeaderRow(2)
  let r = writeDataRows(3, false)
  r += 1
  ws.getCell(r, 1).value = "KONDISI YANG DIHARAPKAN"; ws.getCell(r, 1).font = { bold: true }
  r += 1
  writeHeaderRow(r)
  r += 1
  r = writeDataRows(r, true)
  r += 1
  ws.getCell(r, 1).value = FOOTER_TEXT
  ws.columns.forEach(c => { c.width = 13 })
}

function buildKanvasSheet(wb: ExcelJS.Workbook, matches: MatchResult<VanTxtRow>[]) {
  const ws = wb.addWorksheet("WH KANVAS")
  const ok = matches.filter(m => m.status === "OK") as (MatchResult<VanTxtRow> & { tipe1: VanTxtRow; tipe2: VanTxtRow })[]
  const headers = ["PCODE", "SLSNO", "TIPE", "BEGDATE", "STOCK", "UNITCOST"]

  ws.getCell("A1").value = "KONDISI SAAT INI"; ws.getCell("A1").font = { bold: true }
  ws.getCell("H1").value = "KONDISI YANG DIHARAPKAN"; ws.getCell("H1").font = { bold: true }
  headers.forEach((hd, i) => {
    const left = ws.getCell(2, i + 1); left.value = hd; left.font = { bold: true }
    const right = ws.getCell(2, i + 8); right.value = hd; right.font = { bold: true }
  })
  ws.getCell(2, 15).value = FOOTER_TEXT // O2

  let r = 3
  for (const m of ok) {
    ws.getRow(r).values = [
      asNum(m.tipe2.pcode), asNum(m.tipe2.slsno), 2, m.tipe2.begdate, m.tipe2.stock, m.tipe2.unitcost,
      undefined,
      asNum(m.tipe2.pcode), asNum(m.tipe2.slsno), 2, m.tipe2.begdate, m.tipe1.stock, m.tipe2.unitcost,
    ]
    r++
    ws.getRow(r).values = [
      asNum(m.tipe1.pcode), asNum(m.tipe1.slsno), 1, m.tipe1.begdate, m.tipe1.stock, m.tipe1.unitcost,
      undefined,
      asNum(m.tipe1.pcode), asNum(m.tipe1.slsno), 1, m.tipe1.begdate, m.tipe1.stock, m.tipe1.unitcost,
    ]
    r++
  }
  ws.columns.forEach(c => { c.width = 12 })
}

export async function buildWorkbook(
  header: ReqHeader,
  mainMatches: MatchResult<MainTxtRow>[],
  tambahanMatches: MatchResult<TambahanTxtRow>[],
  kanvasMatches: MatchResult<VanTxtRow>[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  buildReqSheet(wb, header)
  buildMainSheet(wb, mainMatches)
  buildTambahanSheet(wb, tambahanMatches)
  buildKanvasSheet(wb, kanvasMatches)
  const arrBuf = await wb.xlsx.writeBuffer()
  return Buffer.from(arrBuf)
}
