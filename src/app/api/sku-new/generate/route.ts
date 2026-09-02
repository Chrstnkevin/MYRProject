import { NextRequest, NextResponse } from "next/server"
import { buildSkuNew } from "@/lib/skuNew"

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())
  try {
    const { buffer, totalRows, changedRows } = await buildSkuNew(buf)
    const fname = file.name.replace(/\.xlsx$/i, "") + "_SKU_NEW.xlsx"
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
