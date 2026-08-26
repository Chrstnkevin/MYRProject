import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { systemPrompt, userPrompt, imageBase64, imageType } = body

  if (!systemPrompt || !userPrompt) {
    return NextResponse.json({ error: "Missing prompts" }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })
  }

  // Pilih model: vision jika ada gambar, text-only jika tidak.
  // llama-3.3-70b-versatile sekarang Enterprise-only di Groq (butuh Contact
  // Sales) — nggak bisa diakses API key tier Developer biasa, makanya diganti
  // ke openai/gpt-oss-120b (masih di harga per-token normal, context window
  // sama besar 131k).
  const model = imageBase64
    ? "meta-llama/llama-4-scout-17b-16e-instruct"
    : "openai/gpt-oss-120b"

  // Build user message content
  const userContent = imageBase64
    ? [
        {
          type: "image_url",
          image_url: {
            url: `data:${imageType || "image/png"};base64,${imageBase64}`,
          },
        },
        { type: "text", text: userPrompt },
      ]
    : userPrompt

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userContent },
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