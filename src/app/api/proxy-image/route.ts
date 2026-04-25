import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url")
  if (!url || !url.startsWith("https://image.pollinations.ai/")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Pollinations error: ${res.status}` }, { status: res.status })
    }

    const buf         = await res.arrayBuffer()
    const contentType = res.headers.get("content-type") || "image/png"

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Fetch failed"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}