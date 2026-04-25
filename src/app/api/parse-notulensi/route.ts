import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { fileBase64, fileType, fileName, rawText } = body

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY belum diset" }, { status: 500 })

  const SYSTEM_PROMPT = `Kamu adalah asisten yang membantu mengekstrak informasi dari catatan rapat/notulensi.
Baca konten yang diberikan dan extract ke format JSON berikut (isi semua field yang bisa ditemukan, kosongkan jika tidak ada):

{
  "title": "judul atau topik rapat",
  "date": "YYYY-MM-DD format, kosong jika tidak ada",
  "time": "HH:MM format, kosong jika tidak ada",
  "location": "lokasi rapat, kosong jika tidak ada",
  "attendees": ["nama peserta 1", "nama peserta 2"],
  "topic": "topik utama rapat dalam 1-2 kalimat",
  "background": "latar belakang atau konteks rapat",
  "tujuan": "tujuan rapat",
  "main_points": ["poin diskusi 1", "poin diskusi 2", "poin diskusi 3"],
  "kendala": ["kendala atau risiko 1", "kendala 2"],
  "action_items": [
    {"text": "deskripsi tindakan", "pic": "nama PIC", "deadline": "YYYY-MM-DD atau kosong", "done": false}
  ],
  "catatan_tambahan": "catatan lain yang relevan"
}

PENTING: Return HANYA JSON valid, tanpa markdown, tanpa penjelasan apapun.`

  try {
    // ── CASE 1: Paste teks langsung ─────────────────────────────
    if (rawText && rawText.trim()) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Ini catatan rapat:\n\n${rawText.trim().slice(0, 4000)}` }
          ]
        })
      })
      const data = await res.json()
      if (!res.ok) return NextResponse.json({ error: data.error?.message || "Groq error" }, { status: 500 })
      const raw    = data.choices?.[0]?.message?.content?.trim() || "{}"
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim())
      return NextResponse.json({ parsed })
    }

    // ── CASE 2: File gambar → vision model ──────────────────────
    if (fileBase64 && fileType?.startsWith("image/")) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "meta-llama/llama-4-scout-17b-16e-instruct",
          max_tokens: 1500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                { type: "image_url", image_url: { url: `data:${fileType};base64,${fileBase64}` } },
                { type: "text", text: "Foto/screenshot catatan rapat. Extract semua informasi sesuai format JSON." }
              ]
            }
          ]
        })
      })
      const data = await res.json()
      if (!res.ok) return NextResponse.json({ error: data.error?.message || "Vision error" }, { status: 500 })
      const raw    = data.choices?.[0]?.message?.content?.trim() || "{}"
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim())
      return NextResponse.json({ parsed })
    }

    // ── CASE 3: File teks (PDF/Word/TXT) ────────────────────────
    if (fileBase64) {
      let textContent = ""

      if (fileType === "application/pdf") {
        try {
          const m  = await import("pdf-parse")
          const fn = (m as { default?:(b:Buffer)=>Promise<{text:string}> }).default ?? (m as unknown as (b:Buffer)=>Promise<{text:string}>)
          textContent = (await fn(Buffer.from(fileBase64, "base64"))).text
        } catch { textContent = "" }
      } else if (fileType?.includes("wordprocessing") || fileType?.includes("msword")) {
        try {
          const JSZip = (await import("jszip")).default
          const zip   = await JSZip.loadAsync(Buffer.from(fileBase64, "base64"))
          const xml   = await zip.files["word/document.xml"]?.async("string") || ""
          textContent = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        } catch { textContent = "" }
      } else if (fileType?.includes("text")) {
        textContent = Buffer.from(fileBase64, "base64").toString("utf-8")
      }

      // PDF gagal extract teks (mungkin scan) → coba via vision model
      if (!textContent.trim() && fileType === "application/pdf") {
        const res2 = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            max_tokens: 1500,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: `data:application/pdf;base64,${fileBase64}` } },
                  { type: "text", text: "Ini file PDF catatan rapat. Extract semua informasi sesuai format JSON." }
                ]
              }
            ]
          })
        })
        const d2 = await res2.json()
        if (res2.ok && d2.choices?.[0]?.message?.content) {
          const raw2    = d2.choices[0].message.content.trim()
          const parsed2 = JSON.parse(raw2.replace(/```json|```/g, "").trim())
          return NextResponse.json({ parsed: parsed2 })
        }
        // Vision juga gagal → minta user paste teks
        return NextResponse.json({
          error: "PDF tidak bisa dibaca (mungkin hasil scan). Coba buka PDF → Ctrl+A → Ctrl+C → paste teks di kolom teks."
        }, { status: 400 })
      }

      if (!textContent.trim()) {
        return NextResponse.json({
          error: `File tidak bisa dibaca teksnya. Coba paste teks langsung.`
        }, { status: 400 })
      }

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1500,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Ini catatan rapat:\n\n${textContent.slice(0, 4000)}` }
          ]
        })
      })
      const data = await res.json()
      if (!res.ok) return NextResponse.json({ error: data.error?.message || "Groq error" }, { status: 500 })
      const raw    = data.choices?.[0]?.message?.content?.trim() || "{}"
      const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim())
      return NextResponse.json({ parsed })
    }

    return NextResponse.json({ error: "Tidak ada konten. Paste teks atau upload file." }, { status: 400 })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}