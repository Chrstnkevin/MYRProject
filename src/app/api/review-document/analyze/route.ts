import { NextRequest, NextResponse } from "next/server"
import { SECTION_HEADINGS, type DocSection } from "@/lib/docxSections"

const VALID_KEYS = [...SECTION_HEADINGS.map(h => h.key), "header", "general"]

interface Finding { sectionKey: string; severity: "low" | "medium" | "high"; comment: string }

const SYSTEM_PROMPT = `Kamu adalah layer 1 QC + Developer yang me-review dokumen Business Requirement (BR) sebelum masuk ke proses development. Dokumen ini ditulis tim Business Requirement untuk tim Development, jadi tugasmu adalah ngecek apakah improvement yang ditulis bisa DIPAHAMI dan DIKERJAKAN dengan jelas.

Yang harus dicek per section:
- Ambiguitas: kalimat yang bisa ditafsirkan lebih dari satu cara oleh developer.
- Inkonsistensi ANTAR section — termasuk antar section narasi DAN metadata header (contoh nyata: judul project nyebut "M+1 sampai M+5" tapi field "No Requirement" atau section lain nyebut "M+2 sampai M+5" — ini harus ketangkep).
- Informasi yang hilang/kurang buat developer mulai kerja (data yang dibutuhkan, kondisi edge case, dependency ke modul lain).
- Acceptance Criteria yang nggak measurable/testable (nggak jelas gimana ngukur "selesai"-nya).
- Potensi kesulitan teknis atau resiko implementasi yang kelihatan dari requirement-nya.

ATURAN JAWAB:
- Balas HANYA JSON array valid, TANPA markdown code fence, TANPA teks lain di luar JSON.
- Format tiap item: {"sectionKey": "...", "severity": "low"|"medium"|"high", "comment": "..."}
- "sectionKey" WAJIB salah satu dari: ${VALID_KEYS.join(", ")}. Kalau temuan soal inkonsistensi ANTAR section (termasuk sama header), pakai sectionKey dari section narasi yang paling relevan buat jadi tempat nempel comment-nya, dan sebutkan section lain yang dibandingkan di teks comment-nya.
- "comment" ditulis dalam Bahasa Indonesia yang natural (bukan kaku/robotik), singkat tapi jelas kenapa itu masalah dan apa yang perlu diperjelas/diperbaiki.
- Kalau suatu section nggak ada masalah berarti, JANGAN masukin section itu ke hasil sama sekali.
- Boleh lebih dari 1 temuan untuk 1 section kalau memang ada beberapa masalah berbeda.
- Jangan muji-muji bagian yang udah bagus kecuali itu relevan buat ngejelasin kontras sama bagian yang bermasalah.`

function extractJsonArray(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/)
    if (match) return JSON.parse(match[0])
    throw new Error("AI nggak balas JSON yang valid")
  }
}

export async function POST(req: NextRequest) {
  const { sections } = (await req.json()) as { sections: DocSection[] }
  if (!Array.isArray(sections) || sections.length === 0) {
    return NextResponse.json({ error: "Missing sections" }, { status: 400 })
  }

  const userPrompt = `Review dokumen BR berikut, section per section. Ini isinya:\n\n${sections
    .map(s => `=== ${s.label} (key: ${s.key}) ===\n${s.text || "(kosong)"}`)
    .join("\n\n")}`

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message || "Anthropic API error" }, { status: res.status })
  }

  const text = data.content?.[0]?.text || "[]"
  try {
    const parsed = extractJsonArray(text)
    const findings: Finding[] = (Array.isArray(parsed) ? parsed : [])
      .filter((f): f is Finding => f && typeof f.comment === "string" && VALID_KEYS.includes(f.sectionKey))
      .map(f => ({
        sectionKey: f.sectionKey,
        severity: (["low", "medium", "high"] as const).includes(f.severity) ? f.severity : "medium",
        comment: f.comment,
      }))
    return NextResponse.json({ findings })
  } catch {
    return NextResponse.json({ error: "Gagal parse hasil AI", raw: text }, { status: 500 })
  }
}
