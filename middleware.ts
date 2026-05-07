import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Satu-satunya cookie yang kita percaya = sb-session-manual
// Di-set eksplisit di login/page.tsx saat username+password benar
const SESSION_COOKIE = "sb-session-manual"
const SESSION_VALUE  = "authenticated"

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get(SESSION_COOKIE)
  // Harus ada DAN valuenya = "authenticated"
  return cookie?.value === SESSION_VALUE
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/landing")   // protect landing pages too

  const loggedIn = isAuthenticated(request)

  // Belum login → redirect ke /login
  if (isProtected && !loggedIn) {
    const loginUrl = new URL("/login", request.url)
    // Simpan halaman yang dituju agar bisa redirect balik setelah login
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Sudah login tapi akses /login → redirect ke dashboard
  if (pathname === "/login" && loggedIn) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/superadmin/:path*",
    "/superadmin",
    "/landing/:path*",
    "/login",
  ],
}