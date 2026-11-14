import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApiAllPages, SuperhumanDocsError, withSuperhumanDocsCache } from "@/lib/superhumanDocs"

interface DocItem { id: string; name: string; ownerName?: string; updatedAt?: string; browserLink?: string }

// Dipanggil halaman CODA buat nyari Doc (lihat src/app/dashboard/coda).
// Ambil SEMUA halaman (bukan cuma 1 halaman pertama) — lihat catatan di
// callSuperhumanDocsApiAllPages soal bug "doc nggak ketemu" sebelumnya.
// Di-cache 15 menit (daftar Doc jarang berubah) — `fresh=1` buat bypass.
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("query") || undefined
    const fresh = req.nextUrl.searchParams.get("fresh") === "1"
    const items = await withSuperhumanDocsCache(`docs:${query || ""}`, 15 * 60_000, fresh, () =>
      callSuperhumanDocsApiAllPages<DocItem>("/docs", { query, limit: 100 })
    )
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
