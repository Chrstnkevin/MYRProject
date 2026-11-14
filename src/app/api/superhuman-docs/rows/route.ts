import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApiAllPages, SuperhumanDocsError, withSuperhumanDocsCache } from "@/lib/superhumanDocs"

interface RowItem { id: string; name?: string; values: Record<string, unknown> }

// Dipanggil halaman CODA buat nampilin isi Table. useColumnNames=true +
// valueFormat=simple biar key di "values" itu NAMA kolom asli (bukan ID
// kolom "c-xxxxx"), jadi langsung kebaca tanpa perlu mapping tambahan.
// Ambil SEMUA halaman — SEBELUMNYA limit=200 doang (kebetulan pas sama
// jumlah baris "Plan Pilot", 200, jadi keliatan lengkap padahal cuma
// untung-untungan; table lain yang lebih dari 200 baris bakal kepotong).
// limit dinaikin 200->500 biar round-trip ke Coda lebih sedikit buat
// table besar (mis. Plan Pilot 9919 baris: ~50 request jadi ~20) — ini
// yang bikin loading kerasa lama. Ditambah cache 5 menit per docId+
// tableId biar buka tab yang sama berkali-kali nggak fetch ulang dari
// nol; `fresh=1` (dipakai tombol Refresh) buat bypass cache ini.
export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("docId")
    const tableId = req.nextUrl.searchParams.get("tableId")
    if (!docId || !tableId) return NextResponse.json({ error: "Param docId & tableId wajib diisi" }, { status: 400 })
    const fresh = req.nextUrl.searchParams.get("fresh") === "1"
    const items = await withSuperhumanDocsCache(`rows:${docId}:${tableId}`, 5 * 60_000, fresh, () =>
      callSuperhumanDocsApiAllPages<RowItem>(
        `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows`,
        { limit: 500, useColumnNames: true, valueFormat: "simple" }
      )
    )
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
