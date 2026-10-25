import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApi, SuperhumanDocsError } from "@/lib/superhumanDocs"

interface RowItem { id: string; name?: string; values: Record<string, unknown> }
interface RowList { items: RowItem[] }

// Dipanggil halaman /dashboard/superhuman-docs buat nampilin isi Table
// setelah Doc + Table dipilih. useColumnNames=true + valueFormat=simple
// biar key di "values" itu NAMA kolom asli (bukan ID kolom "c-xxxxx"),
// jadi langsung kebaca tanpa perlu mapping tambahan.
export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("docId")
    const tableId = req.nextUrl.searchParams.get("tableId")
    if (!docId || !tableId) return NextResponse.json({ error: "Param docId & tableId wajib diisi" }, { status: 400 })
    const data = await callSuperhumanDocsApi<RowList>(
      `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows`,
      { limit: 200, useColumnNames: true, valueFormat: "simple" }
    )
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}