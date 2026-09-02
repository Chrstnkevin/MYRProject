import { NextRequest, NextResponse } from "next/server"
import { buildSkuNew, buildSkuNewZip } from "@/lib/skuNew"

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  const isZip = /\.zip$/i.test(file.name)

  try {
    if (isZip) {
      const { buffer, files } = await buildSkuNewZip(buf)
      const ok = files.filter(f => f.status === "ok")
      const errors = files.filter(f => f.status === "error")
      const totalRows = ok.reduce((s, f) => s + (f.totalRows || 0), 0)
      const changedRows = ok.reduce((s, f) => s + (f.changedRows || 0), 0)
      const fname = file.name.replace(/\.zip$/i, "") + "_TO_BE.zip"
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${fname}"`,
          "X-File-Count": String(files.length),
          "X-Success-Count": String(ok.length),
          "X-Error-Count": String(errors.length),
          "X-Total-Rows": String(totalRows),
          "X-Changed-Rows": String(changedRows),
          "X-Errors": encodeURIComponent(errors.map(e => `${e.filename}: ${e.error}`).join(" | ")),
          "Access-Control-Expose-Headers": "X-File-Count, X-Success-Count, X-Error-Count, X-Total-Rows, X-Changed-Rows, X-Errors",
        },
      })
    }

    const { buffer, totalRows, changedRows } = await buildSkuNew(buf)
    const fname = file.name.replace(/\.xlsx$/i, "") + "_TO_BE.xlsx"
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "X-Total-Rows": String(totalRows),
        "X-Changed-Rows": String(changedRows),
        "Access-Control-Expose-Headers": "X-Total-Rows, X-Changed-Rows",
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal memproses file" }, { status: 400 })
  }
}
