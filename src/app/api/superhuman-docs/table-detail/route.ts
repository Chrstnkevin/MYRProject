import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApi, SuperhumanDocsError, withSuperhumanDocsCache } from "@/lib/superhumanDocs"

// Endpoint GET-single-table (beda dari /tables yang list SEMUA table).
// Dipakai buat ngecek apakah endpoint detail ngasih field lebih lengkap
// (parentTable, filter, filterFormula) yang nggak muncul di endpoint
// list — soalnya di /tables, field itu semua "—" (nggak ada) buat
// SEMUA table, bukan cuma ADOP BACKLOG doang. Balikin RAW response apa
// adanya (bukan di-filter ke interface tertentu) biar kelihatan semua
// field yang beneran dikasih Coda, buat diagnostik.
export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("docId")
    const tableId = req.nextUrl.searchParams.get("tableId")
    if (!docId || !tableId) return NextResponse.json({ error: "Param docId & tableId wajib diisi" }, { status: 400 })
    const fresh = req.nextUrl.searchParams.get("fresh") === "1"
    const data = await withSuperhumanDocsCache(`table-detail:${docId}:${tableId}`, 15 * 60_000, fresh, () =>
      callSuperhumanDocsApi<Record<string, unknown>>(`/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}`)
    )
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
