import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// Dipanggil lewat navigator.sendBeacon (bukan fetch biasa) dari
// ActivityTracker — sendBeacon didesain buat SURVIVE pas tab ditutup/
// pindah halaman, beda dari fetch yang bisa ke-cancel kalau browser
// keburu nutup koneksi. Karena sendBeacon nggak bisa pasang header
// custom, body-nya cuma JSON polos & kita terima apa adanya di sini.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { logId, endedAt, durationSeconds } = body as { logId?: string; endedAt?: string; durationSeconds?: number }
    if (!logId) return NextResponse.json({ error: "logId wajib diisi" }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    await supabase.from("activity_logs").update({ ended_at: endedAt, duration_seconds: durationSeconds }).eq("id", logId)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
