// PATH: src/middleware.ts
// Letakkan file ini di: src/middleware.ts (sejajar dengan folder app)

import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Cookie dari jalur login fallback admin lama (admin123/kevin123) — lihat
// catatan panjang di src/app/login/page.tsx. Jalur ini TIDAK lewat
// Supabase Auth sama sekali, jadi dicek duluan sebelum cek session asli.
const FALLBACK_COOKIE = "sb-session-manual"

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  const pathname = request.nextUrl.pathname
  const hasFallbackCookie = request.cookies.get(FALLBACK_COOKIE)?.value === "authenticated"

  // ── Tentukan status login: fallback admin dulu (gratis, nggak perlu
  // DB call), baru cek session Supabase Auth asli + status approved di
  // tabel profiles kalau fallback-nya nggak ada.
  let isAuthed = hasFallbackCookie
  if (!isAuthed) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).maybeSingle()
      isAuthed = profile?.status === "approved"
    }
  }

  // ── Protected routes: /dashboard/* ────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!isAuthed) {
      // Redirect ke login, simpan URL tujuan di ?next=
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Redirect kalau sudah login tapi akses /login atau /register ──
  if ((pathname === "/login" || pathname === "/register") && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

// Matcher: jalankan middleware di semua route kecuali static files
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}