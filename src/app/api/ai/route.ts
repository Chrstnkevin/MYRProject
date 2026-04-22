import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { systemPrompt, userPrompt } = await req.json()

  if (!systemPrompt || !userPrompt) {
    return NextResponse.json({ error: "Missing prompts" }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return NextResponse.json(
      { error: data.error?.message || "Groq API error" },
      { status: response.status }
    )
  }

  const text = data.choices?.[0]?.message?.content?.trim() || ""
  return NextResponse.json({ text })
}