// Fitur "SKU NEW" — user upload file "Form Request File Set" (REQ File
// Set / SKU / [TO BE]), sistem copy semua baris di sheet "SKU" ke
// sheet "TO BE" (dibuat baru, atau diganti kalau sudah ada — supaya
// idempotent kalau file yang sama diproses ulang), samakan STOCK2
// dengan STOCK, dan highlight sel STOCK2 yang berubah. Sheet lain di
// file asli (REQ File Set/SKU) tetap dipertahankan apa adanya.
// Bisa proses 1 file .xlsx langsung, atau bulk lewat 1 file .zip berisi
// banyak .xlsx (lihat buildSkuNewZip).
import ExcelJS from "exceljs"
import JSZip from "jszip"

const TARGET_SHEET = "TO BE"
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

  // Sheet sumbernya bernama "SKU" di file asli — "AS IS" cuma dipakai di
  // satu file contoh (user rename manual buat ilustrasi), makanya dicek
  // juga sebagai fallback.
  const srcWs = wb.worksheets.find(ws => ws.name.trim().toUpperCase() === "SKU")
    || wb.worksheets.find(ws => ws.name.trim().toUpperCase() === "AS IS")
  if (!srcWs) {
    const names = wb.worksheets.map(ws => ws.name).join(", ")
    throw new Error(`Sheet "SKU" tidak ditemukan di file ini. Sheet yang ada: ${names}`)
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

  // Kalau sheet TO BE sudah ada (mis. file contoh yang sudah terisi, atau
  // hasil proses ulang), ganti dengan yang baru supaya tetap idempotent.
  const existing = wb.worksheets.find(ws => ws.name.trim().toUpperCase() === TARGET_SHEET)
  if (existing) wb.removeWorksheet(existing.id)

  const newWs = wb.addWorksheet(TARGET_SHEET)
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

export interface ZipFileResult {
  filename: string
  status: "ok" | "error"
  totalRows?: number
  changedRows?: number
  error?: string
}

export interface SkuNewZipResult {
  buffer: Buffer
  files: ZipFileResult[]
}

// Bulk mode: baca .zip berisi banyak file .xlsx, proses satu-satu, lalu
// susun ulang jadi .zip baru (nama & struktur folder sama persis) berisi
// file-file yang sudah punya sheet TO BE. File yang gagal diproses (mis.
// tidak ada sheet AS IS) di-skip dari zip hasil tapi tetap dilaporkan.
export async function buildSkuNewZip(zipBuffer: Buffer): Promise<SkuNewZipResult> {
  const inZip = await JSZip.loadAsync(zipBuffer)
  const outZip = new JSZip()
  const files: ZipFileResult[] = []

  const entries = Object.values(inZip.files).filter(f => !f.dir && /\.xlsx$/i.test(f.name))
  if (!entries.length) throw new Error("Tidak ada file .xlsx di dalam .zip ini")

  for (const entry of entries) {
    const filename = entry.name
    try {
      const buf = Buffer.from(await entry.async("nodebuffer"))
      const { buffer, totalRows, changedRows } = await buildSkuNew(buf)
      outZip.file(filename, buffer)
      files.push({ filename, status: "ok", totalRows, changedRows })
    } catch (e) {
      files.push({ filename, status: "error", error: e instanceof Error ? e.message : String(e) })
    }
  }

  const outBuffer = await outZip.generateAsync({ type: "nodebuffer" })
  return { buffer: outBuffer, files }
}
