// Penyusun Excel "Form Detail PILOT" — pakai exceljs, jadi cuma boleh
// dipanggil dari server (lihat /api/pilot-plan/generate). Layout-nya
// disalin dari template asli user (Form_Request_Pilot_SFA_For_MD_*.xlsx):
// judul + section "Pilot Implementation" (No/Kode Subdist/Nama Subdist/
// Keterangan/Pilot By) + section "List" (No/Modul/No. DR-ST Nama
// Dokumen/Keterangan/On Version/Req By/Test By/Status) + blok tanda
// tangan Mengajukan/Meng-compile/Mengetahui/Menyetujui di bawah.
import ExcelJS from "exceljs"

export interface PilotPlanSubdistRow {
  kode_subdist: string
  nama_subdist: string
  keterangan: string
  pilot_by: string
}
export interface PilotPlanDocRow {
  modul: string
  doc_no_nama: string
  keterangan: string
  on_version: string
  req_by: string
  test_by: string
  status: string
}

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" },
}

function headerCell(ws: ExcelJS.Worksheet, addr: string, text: string) {
  const c = ws.getCell(addr)
  c.value = text
  c.font = { bold: true }
  c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
  c.border = thinBorder
  c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EEF2" } }
}

function dataCell(ws: ExcelJS.Worksheet, addr: string, value: string | number, opts?: { center?: boolean }) {
  const c = ws.getCell(addr)
  c.value = value
  c.border = thinBorder
  c.alignment = { vertical: "middle", wrapText: true, horizontal: opts?.center ? "center" : "left" }
}

export async function buildPilotPlanWorkbook(
  planName: string,
  subdist: PilotPlanSubdistRow[],
  docs: PilotPlanDocRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet("Plan Pilot")
  ws.columns = [
    { width: 4.2 }, { width: 4.8 }, { width: 17.9 }, { width: 45.2 },
    { width: 44 }, { width: 35.8 }, { width: 15.2 }, { width: 22.2 }, { width: 9.2 },
  ]

  ws.getCell("B1").value = "Form Detail PILOT"
  ws.getCell("B1").font = { bold: true, size: 13 }

  ws.getCell("B3").value = `Pilot Mobile ${planName}`
  ws.getCell("B3").font = { bold: true, size: 12 }
  ws.getCell("H3").value = "Confidential Knowledge untuk Kalangan Terbatas"
  ws.getCell("H3").font = { italic: true, size: 9 }
  ws.getCell("H4").value = `Application Support Global - ${new Date().getFullYear()}`
  ws.getCell("H4").font = { italic: true, size: 9 }

  // ── Pilot Implementation ──
  let row = 5
  ws.getCell(`B${row}`).value = "Pilot Implementation"
  ws.getCell(`B${row}`).font = { bold: true, size: 11 }
  row++
  const implHeaderRow = row
  headerCell(ws, `B${implHeaderRow}`, "No")
  headerCell(ws, `C${implHeaderRow}`, "Kode Subdist")
  headerCell(ws, `D${implHeaderRow}`, "Nama Subdist")
  ws.mergeCells(`E${implHeaderRow}:G${implHeaderRow}`)
  headerCell(ws, `E${implHeaderRow}`, "Keterangan")
  ws.mergeCells(`H${implHeaderRow}:I${implHeaderRow}`)
  headerCell(ws, `H${implHeaderRow}`, "Pilot By")
  row++

  const subdistList = subdist.length > 0 ? subdist : [{ kode_subdist: "", nama_subdist: "", keterangan: "", pilot_by: "" }]
  subdistList.forEach((s, i) => {
    dataCell(ws, `B${row}`, i + 1, { center: true })
    dataCell(ws, `C${row}`, s.kode_subdist || "")
    dataCell(ws, `D${row}`, s.nama_subdist || "")
    ws.mergeCells(`E${row}:G${row}`)
    dataCell(ws, `E${row}`, s.keterangan || "")
    ws.mergeCells(`H${row}:I${row}`)
    dataCell(ws, `H${row}`, s.pilot_by || "")
    row++
  })

  row += 2

  // ── List dokumen ──
  ws.getCell(`B${row}`).value = "List"
  ws.getCell(`B${row}`).font = { bold: true, size: 11 }
  row++
  const listHeaderRow = row
  headerCell(ws, `B${listHeaderRow}`, "No")
  headerCell(ws, `C${listHeaderRow}`, "Modul")
  headerCell(ws, `D${listHeaderRow}`, "No. DR/ST Nama Dokumen")
  headerCell(ws, `E${listHeaderRow}`, "Keterangan")
  headerCell(ws, `F${listHeaderRow}`, "On Version")
  headerCell(ws, `G${listHeaderRow}`, "Req By")
  headerCell(ws, `H${listHeaderRow}`, "Test By")
  headerCell(ws, `I${listHeaderRow}`, "Status")
  row++

  const docList = docs.length > 0 ? docs : [{ modul: "", doc_no_nama: "", keterangan: "", on_version: "", req_by: "", test_by: "", status: "" }]
  docList.forEach((d, i) => {
    dataCell(ws, `B${row}`, i + 1, { center: true })
    dataCell(ws, `C${row}`, d.modul || "")
    dataCell(ws, `D${row}`, d.doc_no_nama || "")
    dataCell(ws, `E${row}`, d.keterangan || "")
    dataCell(ws, `F${row}`, d.on_version || "")
    dataCell(ws, `G${row}`, d.req_by || "")
    dataCell(ws, `H${row}`, d.test_by || "")
    dataCell(ws, `I${row}`, d.status || "", { center: true })
    row++
  })

  row += 3

  // ── Blok tanda tangan ──
  const sigLabels = [["B", "Mengajukan,"], ["D", "Meng-compile,"], ["E", "Mengetahui,"], ["G", "Menyetujui,"]] as const
  sigLabels.forEach(([col, label]) => {
    const c = ws.getCell(`${col}${row}`)
    c.value = label
    c.alignment = { horizontal: "center" }
  })
  const blankRow = row + 4
  sigLabels.forEach(([col]) => {
    const c = ws.getCell(`${col}${blankRow}`)
    c.value = "(                              )"
    c.alignment = { horizontal: "center" }
  })

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf)
}
