import { NextRequest, NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

const execAsync = promisify(exec)

// URL Python API — set di Vercel environment variable PYTHON_API_URL
// Contoh: https://myr-python-api.vercel.app/api/generate-xls
const PYTHON_API_URL = process.env.PYTHON_API_URL || ""

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
ws.title = (header.get("judulDokumen") or "Sheet1").strip()[:31]

ws["D4"]=header.get("keterangan",""); ws["D5"]=header.get("aplikasi","")
ws["D6"]=header.get("modul","");      ws["D7"]=header.get("createdBy","")
ws["D8"]=header.get("testedBy","");   ws["D9"]=header.get("targetFinish","")
ws["B12"]=header.get("judulDokumen","")
ws["B12"].font=Font(bold=True,size=13,name="Calibri")
ws["B12"].alignment=Alignment(horizontal="left",vertical="center",wrap_text=True)

ROW_H_PT=14.4; COL_D_PX=788; ROW_H_PX=ROW_H_PT*96/72
thin=Side(style="thin",color="000000")
def lr(c): c.border=Border(left=thin,right=thin)
def lr_b(c): c.border=Border(left=thin,right=thin,bottom=thin)
def f11(c,bold=False,align="general",color="000000"):
    c.font=Font(bold=bold,size=11,name="Calibri",color=color)
    c.alignment=Alignment(horizontal=align,vertical="center",wrap_text=True)
def sfont(s):
    if s=="NOT OK": return Font(bold=True,size=11,name="Calibri",color="FF0000")
    return Font(bold=(s=="OK"),size=11,name="Calibri",color="000000")
def emb(url,row):
    if not url or "base64," not in url: return row
    try:
        b64=url.split("base64,")[1]; pil=PILImage.open(io.BytesIO(base64.b64decode(b64)))
        ow,oh=pil.size; dh=int(oh*COL_D_PX/ow); nr=max(1,int(dh/ROW_H_PX)+1)
        for r in range(row,row+nr): ws.row_dimensions[r].height=ROW_H_PT
        buf=io.BytesIO(); pil.save(buf,format="PNG"); buf.seek(0)
        xl=XLImage(buf); xl.width=COL_D_PX; xl.height=dh
        ws.add_image(xl,f"D{row}"); return row+nr
    except: return row+1

cur=26
for ent in entries:
    st=ent.get("status",""); tgl=ent.get("tanggalTest","")
    ws.row_dimensions[cur].height=ROW_H_PT
    ws[f"B{cur}"]=ent.get("no",""); ws[f"C{cur}"]=ent.get("object","")
    ws[f"D{cur}"]=ent.get("keterangan",""); ws[f"E{cur}"]=tgl; ws[f"F{cur}"]=st
    f11(ws[f"B{cur}"],align="center"); f11(ws[f"C{cur}"],bold=True)
    ws[f"D{cur}"].font=Font(size=11,name="Calibri")
    ws[f"D{cur}"].alignment=Alignment(wrap_text=True,vertical="center")
    f11(ws[f"E{cur}"],align="center")
    ws[f"F{cur}"].font=sfont(st); ws[f"F{cur}"].alignment=Alignment(horizontal="center",vertical="center")
    for col in ["B","C","D","E","F"]: lr(ws[f"{col}{cur}"])
    cur+=1
    for img in ent.get("images",[]): cur=emb(img.get("dataUrl",""),cur)
    for ss in ent.get("subSections",[]):
        if ss.get("deskripsi"):
            ss_tgl=ss.get("tanggal",""); ss_st=ss.get("status","")
            ws.row_dimensions[cur].height=ROW_H_PT
            ws[f"D{cur}"]=ss["deskripsi"]
            ws[f"D{cur}"].font=Font(size=11,name="Calibri")
            ws[f"D{cur}"].alignment=Alignment(wrap_text=True,vertical="center")
            ws[f"E{cur}"]=ss_tgl
            f11(ws[f"E{cur}"],align="center")
            ws[f"F{cur}"]=ss_st
            ws[f"F{cur}"].font=sfont(ss_st)
            ws[f"F{cur}"].alignment=Alignment(horizontal="center",vertical="center")
            for col in ["B","C","D","E","F"]: lr(ws[f"{col}{cur}"])
            cur+=1
        for img in ss.get("images",[]): cur=emb(img.get("dataUrl",""),cur)
    if ent.get("subKeterangan"):
        ws.row_dimensions[cur].height=ROW_H_PT
        ws[f"D{cur}"]=ent["subKeterangan"]; ws[f"E{cur}"]=tgl
        ws[f"D{cur}"].font=Font(size=11,name="Calibri")
        ws[f"D{cur}"].alignment=Alignment(vertical="center")
        ws[f"E{cur}"].font=Font(size=11,name="Calibri")
        ws[f"E{cur}"].alignment=Alignment(horizontal="center",vertical="center")
        for col in ["B","C","D","E","F"]: lr(ws[f"{col}{cur}"])
        cur+=1
    for col in ["B","C","D","E","F"]: lr_b(ws[f"{col}{cur-1}"])

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

  const templateFile = path.join(process.cwd(), "public", "templates", "scenario-test-template.xlsx")
  const pythonCmd    = await findPython()

  if (pythonCmd) {
    // ── LOCAL: Python langsung ───────────────────────────────
    if (!fs.existsSync(templateFile)) {
      return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 500 })
    }
    const tmpDir     = os.tmpdir()
    const ts         = Date.now()
    const dataFile   = path.join(tmpDir, `scentest_data_${ts}.json`)
    const scriptFile = path.join(tmpDir, `scentest_script_${ts}.py`)
    const outFile    = path.join(tmpDir, `scentest_out_${ts}.xlsx`)
    try {
      fs.writeFileSync(dataFile,   JSON.stringify({ header, entries }), "utf-8")
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
      try { fs.unlinkSync(dataFile) }   catch {}
      try { fs.unlinkSync(scriptFile) } catch {}
      try { fs.unlinkSync(outFile) }    catch {}
    }

  } else if (PYTHON_API_URL) {
    // ── PRODUCTION: kirim ke Python API terpisah ─────────────
    // Kirim template sebagai base64 agar Python API tidak butuh akses file system
    const templateBuf = fs.readFileSync(templateFile)
    const templateB64 = templateBuf.toString("base64")

    const res = await fetch(PYTHON_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ header, entries, template_b64: templateB64 }),
    })

    if (!res.ok) {
      const txt = await res.text()
      let errMsg = `Python API error (${res.status})`
      try { errMsg = JSON.parse(txt).error || errMsg } catch {}
      return NextResponse.json({ error: errMsg }, { status: 500 })
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

  } else {
    return NextResponse.json({
      error: "PYTHON_API_URL environment variable belum diset. Tambahkan di Vercel → Settings → Environment Variables."
    }, { status: 500 })
  }
}