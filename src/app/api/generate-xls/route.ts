import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const execAsync = promisify(exec)

const PYTHON_SCRIPT = `
import json, sys, base64, io
from openpyxl import load_workbook
from openpyxl.styles import Font, Alignment, Border, Side
from openpyxl.drawing.image import Image as XLImage
from PIL import Image as PILImage

template_file = sys.argv[1]
data_file     = sys.argv[2]
out_file      = sys.argv[3]

with open(data_file, encoding="utf-8") as f:
    d = json.load(f)

header  = d["header"]
entries = d["entries"]

wb = load_workbook(template_file)
ws = wb.active
ws.title = header.get("judulDokumen", "Scenario Testing")[:31]

ws["D4"] = header.get("keterangan", "")
ws["D5"] = header.get("aplikasi", "")
ws["D6"] = header.get("modul", "")
ws["D7"] = header.get("createdBy", "")
ws["D8"] = header.get("testedBy", "")
ws["D9"] = header.get("targetFinish", "")
ws["B12"] = header.get("judulDokumen", "")
ws["B12"].font      = Font(bold=True, size=13, name="Calibri")
ws["B12"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

ROW_H_PT  = 14.4
COL_D_PX  = 788
ROW_H_PX  = ROW_H_PT * 96 / 72   # ~19.2px

def f11(cell, bold=False, align="general", color="000000"):
    cell.font      = Font(bold=bold, size=11, name="Calibri", color=color)
    cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)

def lr_border(cell):
    cell.border = Border(
        left=Side(style="thin",  color="000000"),
        right=Side(style="thin", color="000000")
    )

def bottom_lr_border(cell):
    cell.border = Border(
        left=Side(style="thin",   color="000000"),
        right=Side(style="thin",  color="000000"),
        bottom=Side(style="thin", color="000000")
    )

current_row = 26

for entry in entries:
    status = entry.get("status", "")
    tgl    = entry.get("tanggalTest", "")
    images = entry.get("images", [])
    sub    = entry.get("subKeterangan", "")

    # ── Baris utama ────────────────────────────────────────
    ws.row_dimensions[current_row].height = ROW_H_PT
    ws[f"B{current_row}"] = entry.get("no", "")
    ws[f"C{current_row}"] = entry.get("object", "")
    ws[f"D{current_row}"] = entry.get("keterangan", "")
    ws[f"E{current_row}"] = tgl
    ws[f"F{current_row}"] = status

    f11(ws[f"B{current_row}"], align="center")
    f11(ws[f"C{current_row}"])
    ws[f"D{current_row}"].font      = Font(size=11, name="Calibri")
    ws[f"D{current_row}"].alignment = Alignment(wrap_text=True, vertical="center")
    f11(ws[f"E{current_row}"], align="center")

    if status == "NOT OK":
        ws[f"F{current_row}"].font = Font(bold=True, size=11, name="Calibri", color="FF0000")
    else:
        ws[f"F{current_row}"].font = Font(bold=(status == "OK"), size=11, name="Calibri", color="000000")
    ws[f"F{current_row}"].alignment = Alignment(horizontal="center", vertical="center")

    for col in ["B","C","D","E","F"]:
        lr_border(ws[f"{col}{current_row}"])

    current_row += 1

    # ── Gambar (simple anchor + resize rows) ───────────────
    for img_data in images:
        data_url = img_data.get("dataUrl", "")
        if data_url and "base64," in data_url:
            try:
                b64       = data_url.split("base64,")[1]
                img_bytes = base64.b64decode(b64)
                pil_img   = PILImage.open(io.BytesIO(img_bytes))

                orig_w, orig_h = pil_img.size
                target_w = COL_D_PX
                target_h = int(orig_h * target_w / orig_w)
                pil_img  = pil_img.resize((target_w, target_h), PILImage.LANCZOS)

                buf = io.BytesIO()
                pil_img.save(buf, format="PNG")
                buf.seek(0)

                xl_img        = XLImage(buf)
                xl_img.width  = target_w
                xl_img.height = target_h

                n_rows = max(1, int(target_h / ROW_H_PX) + 1)

                for r in range(current_row, current_row + n_rows):
                    ws.row_dimensions[r].height = ROW_H_PT
                    for col in ["B","C","E","F"]:
                        lr_border(ws[f"{col}{r}"])

                ws.add_image(xl_img, f"D{current_row}")
                current_row += n_rows

            except Exception as e:
                ws[f"D{current_row}"] = f"[Gambar gagal: {e}]"
                ws[f"D{current_row}"].font = Font(size=11, name="Calibri", color="888888")
                current_row += 1

    # ── Sub-keterangan ─────────────────────────────────────
    if sub:
        ws.row_dimensions[current_row].height = ROW_H_PT
        ws[f"D{current_row}"] = sub
        ws[f"E{current_row}"] = tgl
        ws[f"D{current_row}"].font      = Font(size=11, name="Calibri")
        ws[f"D{current_row}"].alignment = Alignment(vertical="center")
        f11(ws[f"E{current_row}"], align="center")
        for col in ["B","C","D","E","F"]:
            lr_border(ws[f"{col}{current_row}"])
        current_row += 1

    # ── Border bawah di baris terakhir entri ──────────────
    for col in ["B","C","D","E","F"]:
        bottom_lr_border(ws[f"{col}{current_row - 1}"])

wb.save(out_file)
`

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { header, entries } = body

  if (!header || !entries) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 })
  }

  const tmpDir      = os.tmpdir()
  const ts          = Date.now()
  const dataFile    = path.join(tmpDir, `scentest_data_${ts}.json`)
  const scriptFile  = path.join(tmpDir, `scentest_script_${ts}.py`)
  const outFile     = path.join(tmpDir, `scentest_out_${ts}.xlsx`)
  const templateFile = path.join(process.cwd(), "public", "templates", "scenario-test-template.xlsx")

  if (!fs.existsSync(templateFile)) {
    return NextResponse.json(
      { error: "Template tidak ditemukan di public/templates/scenario-test-template.xlsx" },
      { status: 500 }
    )
  }

  try {
    fs.writeFileSync(dataFile, JSON.stringify({ header, entries }), "utf-8")
    fs.writeFileSync(scriptFile, PYTHON_SCRIPT, "utf-8")

    const pythonCmd = process.platform === "win32" ? "python" : "python3"
    await execAsync(`"${pythonCmd}" "${scriptFile}" "${templateFile}" "${dataFile}" "${outFile}"`)

    const fileBuffer = fs.readFileSync(outFile)
    const fname = (header.judulDokumen || "scenario-test")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_")

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}.xlsx"`,
      },
    })
  } catch (err: unknown) {
    console.error("XLS generate error:", err)
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  } finally {
    try { fs.unlinkSync(dataFile)   } catch {}
    try { fs.unlinkSync(scriptFile) } catch {}
    try { fs.unlinkSync(outFile)    } catch {}
  }
}