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

GAYA REVIEW: jangan cuma kasih 1 kalimat ringkasan permukaan — gali SEDALAM review QA+Dev beneran yang bakal dipakai developer buat kerja. Tiap temuan yang substantif HARUS punya struktur ini (lewatin bagian yang nggak relevan buat temuan kecil/ringan):
1. Jelasin masalahnya + KENAPA itu bikin developer bingung atau nggak bisa mulai kerja.
2. Kalau relevan, kasih CONTOH SKENARIO KONKRET pakai data/kondisi dari domain dokumen itu sendiri (bukan contoh generik) buat nunjukin ambiguitasnya — misal kalau dokumennya soal kalkulasi salfo bulanan, kasih contoh angka bulan/periode yang konkret.
3. Daftar PERTANYAAN KLARIFIKASI spesifik yang perlu dijawab business requirement team (bullet list, boleh lebih dari satu kalau memang ada beberapa pertanyaan berbeda).
4. Tutup dengan 1 baris rekomendasi konkret, mulai dengan "**Rekomendasi:**".
Boleh pakai **teks tebal** buat istilah penting/label, dan bullet "- " buat list — pisahkan tiap bagian pakai newline (\n).

ATURAN JAWAB:
- Balas HANYA JSON array valid, TANPA markdown code fence, TANPA teks lain di luar JSON. "comment" adalah STRING JSON biasa (newline di-escape \\n sesuai standar JSON, bukan markdown code fence).
- Format tiap item: {"sectionKey": "...", "severity": "low"|"medium"|"high", "comment": "..."}
- "sectionKey" WAJIB salah satu dari: ${VALID_KEYS.join(", ")}. Kalau temuan soal inkonsistensi ANTAR section (termasuk sama header), pakai sectionKey dari section narasi yang paling relevan buat jadi tempat nempel comment-nya, dan sebutkan section lain yang dibandingkan di teks comment-nya.
- "comment" ditulis dalam Bahasa Indonesia yang natural (bukan kaku/robotik), ikuti struktur GAYA REVIEW di atas buat temuan yang substantif.
- Kalau suatu section nggak ada masalah berarti, JANGAN masukin section itu ke hasil sama sekali.
- Boleh lebih dari 1 temuan untuk 1 section kalau memang ada beberapa masalah berbeda — tiap temuan harus tentang masalah yang BEDA, jangan dipecah-pecah kalau sebenarnya 1 masalah yang sama.
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

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 })
  }

  // Pakai Groq (model open-source gpt-oss-120b) — key yang sama dipakai
  // fitur lain (/api/ai), nggak nambah biaya. Lihat catatan di route itu
  // soal kenapa gpt-oss-120b (bukan llama-3.3 yang sekarang Enterprise-only).
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8192,
    }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data.error?.message || "Groq API error" }, { status: res.status })
  }

  const text = data.choices?.[0]?.message?.content?.trim() || "[]"
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
