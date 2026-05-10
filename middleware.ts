import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const SESSION_COOKIE = "sb-session-manual"
const SESSION_VALUE  = "authenticated"

// Routes yang boleh diakses tanpa login (secret public pages)
const PUBLIC_EXCEPTIONS = [
  "/dashboard/backup-phi",
]

function isAuthenticated(request: NextRequest): boolean {
  const cookie = request.cookies.get(SESSION_COOKIE)
  return cookie?.value === SESSION_VALUE
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Cek apakah ini public exception (secret page tanpa auth)
  const isPublicException = PUBLIC_EXCEPTIONS.some(p => pathname.startsWith(p))
  if (isPublicException) return NextResponse.next()

  const isProtected =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/superadmin") ||
    pathname.startsWith("/landing")

  const loggedIn = isAuthenticated(request)

  if (isProtected && !loggedIn) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

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