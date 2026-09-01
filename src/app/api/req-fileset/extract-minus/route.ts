import { NextRequest, NextResponse } from "next/server"
import { classifyGudang, type ClassifiedRow } from "@/lib/reqFileSet"

// Model "thinking" (qwen3.6-27b) kadang membungkus jawaban dalam blok
// <think>...</think> dan/atau code fence ```json ... ``` sebelum JSON
// asli-nya. Buang reasoning block dulu, lalu ambil isi fence kalau ada,
// baru scan kurung siku secara bertingkat (bukan regex greedy) supaya
// tidak ke-tarik teks lain yang kebetulan mengandung "]".
function extractJsonArray(text: string): string | null {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/gi, "")
  const fence = stripped.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fence ? fence[1] : stripped
  const start = candidate.indexOf("[")
  if (start === -1) return null
  let depth = 0
  for (let i = start; i < candidate.length; i++) {
    if (candidate[i] === "[") depth++
    else if (candidate[i] === "]") {
      depth--
      if (depth === 0) return candidate.slice(start, i + 1)
    }
  }
  return null
}

// Baca screenshot "Matrix Information — Ada Stock Minus" (baris format
// "Gudang : X, Pcode : Y : Z") pakai model vision Groq — pola sama seperti
// /api/ai, cuma system prompt-nya dikunci supaya output JSON murni.
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { imageBase64, imageType } = body
  if (!imageBase64) return NextResponse.json({ error: "Missing imageBase64" }, { status: 400 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })

  const systemPrompt = `Kamu membaca screenshot popup "Ada Stock Minus" dari sistem Matrix. Setiap baris di popup berformat "Gudang : X, Pcode : Y : Z" dimana X = kode gudang, Y = kode PCODE, Z = angka stock minus (negatif).
Ekstrak SEMUA baris jadi JSON array murni (tanpa markdown, tanpa penjelasan), format:
[{"gudang":"<kode gudang apa adanya>","pcode":"<kode pcode apa adanya>","minus":<angka minus, boleh negatif>}]
Kalau ada baris yang tidak jelas/terpotong, tetap masukkan sebisa mungkin. Jangan mengarang baris yang tidak ada di gambar.`

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "qwen/qwen3.6-27b",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${imageType || "image/png"};base64,${imageBase64}` } },
            { type: "text", text: "Ekstrak daftar stock minus dari screenshot ini." },
          ],
        },
      ],
      temperature: 0,
      max_tokens: 2000,
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    return NextResponse.json({ error: data.error?.message || "Groq API error" }, { status: response.status })
  }

  const text = (data.choices?.[0]?.message?.content || "").trim()
  const jsonStr = extractJsonArray(text)
  if (!jsonStr) return NextResponse.json({ error: "Model tidak mengembalikan JSON valid", raw: text }, { status: 502 })

  let parsed: { gudang: string; pcode: string; minus: number }[]
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return NextResponse.json({ error: "Gagal parse JSON dari model", raw: text }, { status: 502 })
  }

  const rows: ClassifiedRow[] = parsed
    .filter(r => r && r.gudang !== undefined && r.pcode !== undefined)
    .map(r => ({
      gudang: String(r.gudang).trim(),
      pcode: String(r.pcode).trim(),
      minus: Number(r.minus) || 0,
      type: classifyGudang(String(r.gudang)),
    }))

  return NextResponse.json({ rows })
}
