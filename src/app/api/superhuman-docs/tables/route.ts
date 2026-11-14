import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApiAllPages, SuperhumanDocsError, withSuperhumanDocsCache } from "@/lib/superhumanDocs"

// `rowCount`/`tableType` dipakai di halaman CODA buat diagnostik ADOP
// (bandingin rowCount yang Coda sendiri lapor vs jumlah baris yang
// kebaca lewat /rows — kalau beda jauh, berarti salah table/view yang
// ketemu, bukan soal pagination/filter).
interface TableItem { id: string; name: string; tableType?: string; rowCount?: number }

// Dipanggil halaman CODA buat nyari Table dalam sebuah Doc. Ambil SEMUA
// halaman (bukan cuma 1 halaman pertama) — sama alasannya kayak /docs.
// Di-cache 15 menit (daftar Table jarang berubah) — `fresh=1` buat bypass.
export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("docId")
    if (!docId) return NextResponse.json({ error: "Param docId wajib diisi" }, { status: 400 })
    const fresh = req.nextUrl.searchParams.get("fresh") === "1"
    const items = await withSuperhumanDocsCache(`tables:${docId}`, 15 * 60_000, fresh, () =>
      callSuperhumanDocsApiAllPages<TableItem>(`/docs/${encodeURIComponent(docId)}/tables`, { limit: 100 })
    )
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
