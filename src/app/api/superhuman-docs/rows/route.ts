import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApiAllPages, SuperhumanDocsError, withSuperhumanDocsCache } from "@/lib/superhumanDocs"

interface RowItem { id: string; name?: string; values: Record<string, unknown> }

// Dipanggil halaman CODA buat nampilin isi Table. useColumnNames=true
// biar key di "values" itu NAMA kolom asli (bukan ID kolom "c-xxxxx"),
// jadi langsung kebaca tanpa perlu mapping tambahan.
// Ambil SEMUA halaman — SEBELUMNYA limit=200 doang (kebetulan pas sama
// jumlah baris "Plan Pilot", 200, jadi keliatan lengkap padahal cuma
// untung-untungan; table lain yang lebih dari 200 baris bakal kepotong).
// limit dinaikin lagi 500->1000 (Plan Pilot 9919 baris: ~20 request
// jadi ~10) — paginasinya SEQUENTIAL (nextPageLink butuh respons
// halaman sebelumnya dulu, nggak bisa diparalel), jadi ngurangin
// JUMLAH round-trip itu satu-satunya cara ngurangin total waktu
// tunggu buat table besar. Cache diperpanjang 5->20 menit biar
// kunjungan ulang dalam sesi yang sama kerasa instan (Refresh/`fresh=1`
// tetep bisa bypass kalau emang butuh data paling baru).
//
// `simple=0`: SKIP valueFormat=simple (defaultnya "1"/simple tetep
// jalan, Plan Pilot & Semua Dokumen nggak kepengaruh). Ketauan dari
// kasus ADOP: kolom multi-value (Doc. Ref., Status Dev - row yang
// punya BEBERAPA doc sekaligus) di-GABUNG jadi 1 STRING koma sama Coda
// kalau valueFormat=simple, jadi ARRAY aslinya ilang sebelum sampai ke
// kita — nggak bisa di-zip per pasangan lagi. Tanpa "simple", Coda
// balikin struktur array/objek apa adanya (kolom lain yang udah jalan
// bener kayak PIC Apps/PIC BR tetep aman karena fmtCell() di frontend
// udah bisa handle objek {name} & array).
export async function GET(req: NextRequest) {
  try {
    const docId = req.nextUrl.searchParams.get("docId")
    const tableId = req.nextUrl.searchParams.get("tableId")
    if (!docId || !tableId) return NextResponse.json({ error: "Param docId & tableId wajib diisi" }, { status: 400 })
    const fresh = req.nextUrl.searchParams.get("fresh") === "1"
    const simple = req.nextUrl.searchParams.get("simple") !== "0"
    const items = await withSuperhumanDocsCache(`rows:${docId}:${tableId}:${simple ? "s" : "r"}`, 20 * 60_000, fresh, () =>
      callSuperhumanDocsApiAllPages<RowItem>(
        `/docs/${encodeURIComponent(docId)}/tables/${encodeURIComponent(tableId)}/rows`,
        { limit: 1000, useColumnNames: true, valueFormat: simple ? "simple" : undefined }
      )
    )
    return NextResponse.json({ items })
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
