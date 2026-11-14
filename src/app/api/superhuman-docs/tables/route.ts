import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApiAllPages, SuperhumanDocsError } from "@/lib/superhumanDocs"

interface TableItem { id: string; name: string; tableType?: string; rowCount?: number }

// Dipanggil halaman CODA buat nyari Table dalam sebuah Doc. Ambil SEMUA
// halaman (bukan cuma 1 halaman pertama) — sama alasannya kayak /docs.
export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("docId")
    if (!docId) return NextResponse.json({ error: "Param docId wajib diisi" }, { status: 400 })
    const items = await callSuperhumanDocsApiAllPages<TableItem>(`/docs/${encodeURIComponent(docId)}/tables`, { limit: 100 })
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
