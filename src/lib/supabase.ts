// PENTING: pakai createBrowserClient dari @supabase/ssr (BUKAN createClient
// biasa dari @supabase/supabase-js) — createClient biasa nyimpen session
// auth di localStorage doang, nggak kebaca sama middleware.ts (yang baca
// session dari COOKIES via createServerClient). Kalau pakai createClient
// biasa, abis login sukses bakal langsung keredirect balik ke /login
// karena middleware nganggep belum login. createBrowserClient otomatis
// sinkronisasi session ke cookies juga, jadi middleware bisa baca.
import { createBrowserClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
