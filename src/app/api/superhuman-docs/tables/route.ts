import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApi, SuperhumanDocsError } from "@/lib/superhumanDocs"

interface TableItem { id: string; name: string; tableType?: string; rowCount?: number }
interface TableList { items: TableItem[] }

// Dipanggil halaman /dashboard/superhuman-docs buat isi dropdown "pilih
// Table" setelah Doc dipilih.
export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("docId")
    if (!docId) return NextResponse.json({ error: "Param docId wajib diisi" }, { status: 400 })
    const data = await callSuperhumanDocsApi<TableList>(`/docs/${encodeURIComponent(docId)}/tables`, { limit: 50 })
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}