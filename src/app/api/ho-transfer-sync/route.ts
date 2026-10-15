import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { runHoTransferSync } from "@/lib/syncHoTransfer"

// Sync "Data Transfer HO" — DIPINDAH dari client-side (browser) ke sini.
// Alasan pindah: browser DISELALU blokir fetch() dari halaman kita yang
// HTTPS ke endpoint HO ini yang HTTP biasa ("mixed content" — aturan
// baku browser, bukan soal firewall/jaringan kantor), makanya tombol
// "Sync dari HO" selalu gagal dengan "Failed to fetch" walau user bisa
// buka 52.163.214.18 langsung di tab baru (navigasi top-level HTTP
// tetap boleh, cuma fetch() dari origin HTTPS yang diblokir). Request
// server-ke-server nggak kena aturan mixed-content itu.
//
// Dipanggil tombol "Sync dari HO" manual di halaman ho-transfer, dan/atau
// scheduler eksternal kalau di-setup cron job terpisah buat ini. Logic
// sync-nya sendiri ada di src/lib/syncHoTransfer.ts (shared).
//
// Dibungkus try/catch paling luar — kalau createClient() atau hal lain di
// luar runHoTransferSync (yang udah py try/catch sendiri) nge-throw,
// Vercel balikin 500 generik polos tanpa body JSON, bikin scheduler nggak
// bisa nunjukin error aslinya. Sekarang selalu balik JSON {error:...} yang
// jelas apapun penyebabnya.
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const result = await runHoTransferSync(supabase)
    if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Error tak terduga (nggak ketangkep try/catch biasa): ${msg}` }, { status: 500 })
  }
}
