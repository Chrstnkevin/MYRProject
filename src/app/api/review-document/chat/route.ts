import { NextRequest, NextResponse } from "next/server"
import type { DocSection } from "@/lib/docxSections"

interface ChatMessage { role: "user" | "assistant"; content: string }

export async function POST(req: NextRequest) {
  const { sections, messages } = (await req.json()) as { sections: DocSection[]; messages: ChatMessage[] }
  if (!Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json({ error: "Missing sections" }, { status: 400 })
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Missing messages" }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })
  }

  const docContext = sections.map(s => `=== ${s.label} ===\n${s.text || "(kosong)"}`).join("\n\n")
  const systemPrompt = `Kamu asisten tanya-jawab seputar SATU dokumen Business Requirement (BR) berikut — bukan asisten umum. Jawab singkat, jelas, dan HARUS berdasarkan isi dokumen yang dikasih, jangan ngarang. Kalau informasi yang ditanya nggak ada di dokumen ini, bilang terus terang "nggak ada informasi soal itu di dokumen ini" daripada ngasih jawaban asal. Jawab dalam Bahasa Indonesia yang natural (bukan kaku/robotik).

ISI DOKUMEN:
${docContext}`

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.4,
      max_tokens: 1536,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message || "Groq API error" }, { status: res.status })
  }

  const reply = data.choices?.[0]?.message?.content?.trim() || ""
  return NextResponse.json({ reply })
}
