import { NextRequest, NextResponse } from "next/server"
import mammoth from "mammoth"
import { parseDocSections } from "@/lib/docxSections"

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 })
  if (!/\.docx$/i.test(file.name)) return NextResponse.json({ error: "Harus file .docx" }, { status: 400 })

  const buf = Buffer.from(await file.arrayBuffer())

  try {
    const [html, raw] = await Promise.all([
      mammoth.convertToHtml({ buffer: buf }),
      mammoth.extractRawText({ buffer: buf }),
    ])
    const sections = parseDocSections(raw.value)
    return NextResponse.json({ html: html.value, sections })
  } catch {
    return NextResponse.json({ error: "Gagal baca file .docx — pastikan file nggak corrupt" }, { status: 400 })
  }
}
