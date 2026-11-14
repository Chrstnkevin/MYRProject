import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApiAllPages, SuperhumanDocsError } from "@/lib/superhumanDocs"

interface RowItem { id: string; name?: string; values: Record<string, unknown> }

// Dipanggil halaman CODA buat nampilin isi Table. useColumnNames=true +
// valueFormat=simple biar key di "values" itu NAMA kolom asli (bukan ID
// kolom "c-xxxxx"), jadi langsung kebaca tanpa perlu mapping tambahan.
// Ambil SEMUA halaman — SEBELUMNYA limit=200 doang (kebetulan pas sama
// jumlah baris "Plan Pilot", 200, jadi keliatan lengkap padahal cuma
// untung-untungan; table lain yang lebih dari 200 baris bakal kepotong).
export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("docId")
    const tableId = req.nextUrl.searchParams.get("tableId")
    if (!docId || !tableId) return NextResponse.json({ error: "Param docId & tableId wajib diisi" }, { status: 400 })
    const items = await callSuperhumanDocsApiAllPages<RowItem>(
      `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows`,
      { limit: 200, useColumnNames: true, valueFormat: "simple" }
    )
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
