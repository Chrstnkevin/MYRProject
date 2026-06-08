// PATH: src/app/api/aria/route.ts
// API route untuk Aria AI — Our System

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { system, messages } = await req.json()
  if (!messages || !system) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 })
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",  // Haiku: paling murah, cukup cepat
      max_tokens: 1024,
      system,
      messages,
    }),
  })

  const data = await res.json()
  return NextResponse.json(data)
}