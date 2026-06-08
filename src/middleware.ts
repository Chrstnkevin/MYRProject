// PATH: src/middleware.ts
// Letakkan file ini di: src/middleware.ts (sejajar dengan folder app)

import { createServerClient } from "@supabase/ssr"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

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

  // Refresh session — penting supaya token tidak expire
  const session = request.cookies.get("sb-session-manual")?.value
  const pathname = request.nextUrl.pathname

  // ── Protected routes: /dashboard/* ────────────────────────
  if (pathname.startsWith("/dashboard")) {
    if (!session) {
      // Redirect ke login, simpan URL tujuan di ?next=
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("next", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  // ── Redirect jika sudah login tapi akses /login ────────────
  if (pathname === "/login" && session) {
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