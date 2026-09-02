// Fitur "SKU NEW" — user upload file "Form Request File Set" (REQ File
// Set / AS IS / TO BE), sistem copy semua baris di sheet "AS IS" ke sheet
// baru "SKU NEW", samakan STOCK2 dengan STOCK, dan highlight sel STOCK2
// yang berubah. File asli (semua sheet lain) tetap dipertahankan apa
// adanya — cuma nambah 1 sheet baru.
import ExcelJS from "exceljs"

const HIGHLIGHT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF59D" }, // kuning lembut
}

export interface SkuNewResult {
  buffer: Buffer
  totalRows: number
  changedRows: number
}

export async function buildSkuNew(fileBuffer: Buffer): Promise<SkuNewResult> {
  const wb = new ExcelJS.Workbook()
  // exceljs men-declare tipe Buffer lokalnya sendiri ("extends ArrayBuffer"),
  // beda dari Buffer Node beneran — di runtime tetap terima Node Buffer,
  // ini cuma ketidakcocokan definisi tipe pihak ketiga.
  await wb.xlsx.load(fileBuffer as unknown as ArrayBuffer)

  const srcWs = wb.worksheets.find(ws => ws.name.trim().toUpperCase() === "AS IS")
  if (!srcWs) {
    const names = wb.worksheets.map(ws => ws.name).join(", ")
    throw new Error(`Sheet "AS IS" tidak ditemukan di file ini. Sheet yang ada: ${names}`)
  }

  const headers: string[] = []
  srcWs.getRow(1).eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value ?? "").trim().toUpperCase()
  })
  const stockCol = headers.findIndex(h => h === "STOCK")
  const stock2Col = headers.findIndex(h => h === "STOCK2")
  if (stockCol === -1 || stock2Col === -1) {
    throw new Error(`Kolom STOCK/STOCK2 tidak ditemukan di sheet "AS IS". Header yang ada: ${headers.filter(Boolean).join(", ")}`)
  }

  // Kalau file ini pernah diproses sebelumnya, ganti sheet SKU NEW lama
  const existing = wb.worksheets.find(ws => ws.name.trim().toUpperCase() === "SKU NEW")
  if (existing) wb.removeWorksheet(existing.id)

  const newWs = wb.addWorksheet("SKU NEW")
  const colCount = srcWs.columnCount

  let totalRows = 0
  let changedRows = 0

  srcWs.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const newRow = newWs.getRow(rowNumber)
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      newRow.getCell(colNumber).value = cell.value
    })

    if (rowNumber === 1) {
      for (let c = 1; c <= colCount; c++) newRow.getCell(c).font = { bold: true }
    } else {
      totalRows++
      const stockVal = newRow.getCell(stockCol).value
      const oldStock2 = newRow.getCell(stock2Col).value
      newRow.getCell(stock2Col).value = stockVal ?? null
      if (String(oldStock2 ?? "") !== String(stockVal ?? "")) {
        changedRows++
        newRow.getCell(stock2Col).fill = HIGHLIGHT_FILL
      }
    }
    newRow.commit()
  })

  newWs.columns = srcWs.columns.map(c => ({ width: (c && c.width) || 14 }))

  const arrBuf = await wb.xlsx.writeBuffer()
  return { buffer: Buffer.from(arrBuf), totalRows, changedRows }
}
