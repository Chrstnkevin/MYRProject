import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isProtected = pathname.startsWith("/dashboard") || pathname.startsWith("/superadmin")

  if (isProtected) {
    const cookies = request.cookies.getAll()

    const hasSession = cookies.some(
      (cookie) =>
        cookie.name === "sb-session-manual" ||        // login manual (admin123/kevin123)
        cookie.name.includes("sb-") ||                // supabase auth
        cookie.name.includes("supabase") ||
        cookie.name.includes("access-token") ||
        cookie.name.includes("auth-token")
    )

    if (!hasSession) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // Kalau sudah login dan akses /login, redirect ke dashboard
  if (pathname === "/login") {
    const cookies = request.cookies.getAll()
    const hasSession = cookies.some(
      c => c.name === "sb-session-manual" || c.name.includes("sb-") || c.name.includes("supabase")
    )
    if (hasSession) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/superadmin/:path*", "/superadmin", "/login"],
}