import { NextRequest, NextResponse } from "next/server"
import { addCommentsToDocx, type DocCommentInput } from "@/lib/docxComments"

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get("file")
  const commentsRaw = form.get("comments")
  if (!(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 })
  if (typeof commentsRaw !== "string") return NextResponse.json({ error: "Missing comments" }, { status: 400 })

  let comments: DocCommentInput[]
  try {
    comments = JSON.parse(commentsRaw)
  } catch {
    return NextResponse.json({ error: "Comments bukan JSON valid" }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())

  try {
    const { buffer, notFound } = await addCommentsToDocx(buf, comments)
    const fname = file.name.replace(/\.docx$/i, "") + "_reviewed.docx"
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "X-Not-Found": encodeURIComponent(JSON.stringify(notFound)),
        "Access-Control-Expose-Headers": "X-Not-Found",
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal nyuntik comment" }, { status: 500 })
  }
}
