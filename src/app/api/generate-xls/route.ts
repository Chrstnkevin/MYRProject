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
safe = (header.get("judulDokumen") or "Sheet1").strip()[:31]
ws.title = safe

ws["D4"] = header.get("keterangan","")
ws["D5"] = header.get("aplikasi","")
ws["D6"] = header.get("modul","")
ws["D7"] = header.get("createdBy","")
ws["D8"] = header.get("testedBy","")
ws["D9"] = header.get("targetFinish","")
ws["B12"] = header.get("judulDokumen","")
ws["B12"].font = Font(bold=True, size=13, name="Calibri")
ws["B12"].alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)

ROW_H_PT = 14.4
COL_D_PX = 788
ROW_H_PX = ROW_H_PT * 96 / 72

thin = Side(style="thin", color="000000")
def lr(cell): cell.border = Border(left=thin, right=thin)
def lr_bottom(cell): cell.border = Border(left=thin, right=thin, bottom=thin)
def f11(cell, bold=False, align="general", color="000000"):
    cell.font = Font(bold=bold, size=11, name="Calibri", color=color)
    cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
def status_font(s):
    if s == "NOT OK": return Font(bold=True, size=11, name="Calibri", color="FF0000")
    return Font(bold=(s=="OK"), size=11, name="Calibri", color="000000")

def embed_image(data_url, row):
    if not data_url or "base64," not in data_url: return row
    try:
        b64 = data_url.split("base64,")[1]
        pil = PILImage.open(io.BytesIO(base64.b64decode(b64)))
        ow, oh = pil.size
        dh = int(oh * COL_D_PX / ow)
        nr = max(1, int(dh / ROW_H_PX) + 1)
        for r in range(row, row + nr): ws.row_dimensions[r].height = ROW_H_PT
        buf = io.BytesIO(); pil.save(buf, format="PNG"); buf.seek(0)
        xl = XLImage(buf); xl.width = COL_D_PX; xl.height = dh
        ws.add_image(xl, f"D{row}")
        return row + nr
    except: return row + 1

current_row = 26
for entry in entries:
    status = entry.get("status",""); tgl = entry.get("tanggalTest","")
    ws.row_dimensions[current_row].height = ROW_H_PT
    ws[f"B{current_row}"] = entry.get("no","")
    ws[f"C{current_row}"] = entry.get("object","")
    ws[f"D{current_row}"] = entry.get("keterangan","")
    ws[f"E{current_row}"] = tgl
    ws[f"F{current_row}"] = status
    f11(ws[f"B{current_row}"], align="center")
    f11(ws[f"C{current_row}"], bold=True)
    ws[f"D{current_row}"].font = Font(size=11, name="Calibri")
    ws[f"D{current_row}"].alignment = Alignment(wrap_text=True, vertical="center")
    f11(ws[f"E{current_row}"], align="center")
    ws[f"F{current_row}"].font = status_font(status)
    ws[f"F{current_row}"].alignment = Alignment(horizontal="center", vertical="center")
    for col in ["B","C","D","E","F"]: lr(ws[f"{col}{current_row}"])
    current_row += 1

    for img in entry.get("images",[]): current_row = embed_image(img.get("dataUrl",""), current_row)

    for ss in entry.get("subSections",[]):
        if ss.get("deskripsi"):
            ws.row_dimensions[current_row].height = ROW_H_PT
            ws[f"D{current_row}"] = ss["deskripsi"]
            ws[f"D{current_row}"].font = Font(size=11, name="Calibri")
            ws[f"D{current_row}"].alignment = Alignment(wrap_text=True, vertical="center")
            for col in ["B","C","D","E","F"]: lr(ws[f"{col}{current_row}"])
            current_row += 1
        for img in ss.get("images",[]): current_row = embed_image(img.get("dataUrl",""), current_row)

    if entry.get("subKeterangan"):
        ws.row_dimensions[current_row].height = ROW_H_PT
        ws[f"D{current_row}"] = entry["subKeterangan"]
        ws[f"E{current_row}"] = tgl
        ws[f"D{current_row}"].font = Font(size=11, name="Calibri")
        ws[f"D{current_row}"].alignment = Alignment(vertical="center")
        ws[f"E{current_row}"].font = Font(size=11, name="Calibri")
        ws[f"E{current_row}"].alignment = Alignment(horizontal="center", vertical="center")
        for col in ["B","C","D","E","F"]: lr(ws[f"{col}{current_row}"])
        current_row += 1

    for col in ["B","C","D","E","F"]: lr_bottom(ws[f"{col}{current_row-1}"])

wb.save(out_file)
`

async function findPython(): Promise<string | null> {
  for (const cmd of ["python3", "python", "py"]) {
    try { await execAsync(`${cmd} --version`); return cmd } catch {}
  }
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { header, entries } = body
  if (!header || !entries) return NextResponse.json({ error: "Missing data" }, { status: 400 })

  // Cek apakah Python tersedia (local dev)
  const pythonCmd = await findPython()

  if (pythonCmd) {
    // ── LOCAL: jalankan Python langsung ──────────────────────
    const tmpDir      = os.tmpdir()
    const ts          = Date.now()
    const dataFile    = path.join(tmpDir, `scentest_data_${ts}.json`)
    const scriptFile  = path.join(tmpDir, `scentest_script_${ts}.py`)
    const outFile     = path.join(tmpDir, `scentest_out_${ts}.xlsx`)
    const templateFile = path.join(process.cwd(), "public", "templates", "scenario-test-template.xlsx")

    if (!fs.existsSync(templateFile)) {
      return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 500 })
    }

    try {
      fs.writeFileSync(dataFile,  JSON.stringify({ header, entries }), "utf-8")
      fs.writeFileSync(scriptFile, PYTHON_SCRIPT, "utf-8")
      await execAsync(`"${pythonCmd}" "${scriptFile}" "${templateFile}" "${dataFile}" "${outFile}"`)

      const buf   = fs.readFileSync(outFile)
      const fname = (header.judulDokumen || "scenario-test").trim().replace(/[\\/:*?"<>|]/g, "_")
      return new NextResponse(buf, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${fname}.xlsx"`,
        },
      })
    } finally {
      try { fs.unlinkSync(dataFile)   } catch {}
      try { fs.unlinkSync(scriptFile) } catch {}
      try { fs.unlinkSync(outFile)    } catch {}
    }

  } else {
    // ── NETLIFY: forward ke Python function ──────────────────
    // Di Netlify, function Python ada di /.netlify/functions/generate-xls
    const netlifyFnUrl = `${req.nextUrl.origin}/.netlify/functions/generate-xls`

    const res = await fetch(netlifyFnUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ header, entries }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Netlify function error" }))
      return NextResponse.json(err, { status: 500 })
    }

    const buf   = await res.arrayBuffer()
    const fname = (header.judulDokumen || "scenario-test").trim().replace(/[\\/:*?"<>|]/g, "_")
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}.xlsx"`,
      },
    })
  }
}