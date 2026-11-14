// Mecah raw text hasil extract docx (mammoth.extractRawText) jadi
// per-section standar template BR (Background/Current Conditions/dst)
// — dipakai buat (1) kasih konteks terstruktur ke AI reviewer, dan
// (2) anchor comment Word per-section (lihat docxComments.ts).
export interface DocSection { key: string; label: string; text: string }

// "heading" = teks baris PERSIS yang dicari buat deteksi awal section itu
// DAN jadi anchorText comment Word-nya; "label" = nama yang ditampilkan di
// UI. Beda khusus buat "specificRequirement": dari 2 contoh dokumen BR
// asli, section ini TIDAK PERNAH punya heading tertulis "Specific
// Requirement" — section-nya langsung berupa tabel Epic|User Stories|
// Acceptance Criteria, jadi heading-nya dideteksi dari baris "Epic" (sel
// header tabel), satu-satunya baris yang isinya persis itu di kedua contoh.
export const SECTION_HEADINGS: { key: string; label: string; heading: string }[] = [
  { key: "background", label: "Background", heading: "Background" },
  { key: "currentConditions", label: "Current Conditions", heading: "Current Conditions" },
  { key: "productPerspective", label: "Product Perspective", heading: "Product Perspective" },
  { key: "productScope", label: "Product Scope", heading: "Product Scope" },
  { key: "globalFlowProcess", label: "Global Flow Process", heading: "Global Flow Process" },
  { key: "specificRequirement", label: "Specific Requirement", heading: "Epic" },
]

export function parseDocSections(rawText: string): DocSection[] {
  const lines = rawText.split("\n")
  const positions: { key: string; label: string; lineIdx: number }[] = []
  lines.forEach((line, i) => {
    const trimmed = line.trim().toLowerCase()
    const hit = SECTION_HEADINGS.find(h => trimmed === h.heading.toLowerCase())
    if (hit && !positions.some(p => p.key === hit.key)) positions.push({ key: hit.key, label: hit.label, lineIdx: i })
  })
  positions.sort((a, b) => a.lineIdx - b.lineIdx)

  const sections: DocSection[] = []
  // "header": semua teks SEBELUM heading standar pertama (tabel
  // Project/Modul/Type/Request By/dst) — konteks buat AI ngecek
  // konsistensi (mis. judul vs "No Requirement" beda), bukan target
  // comment utama tapi bisa di-anchor ke "Project" kalau perlu.
  const firstIdx = positions.length > 0 ? positions[0].lineIdx : lines.length
  const headerText = lines.slice(0, firstIdx).join("\n").trim()
  if (headerText) sections.push({ key: "header", label: "Header / Metadata Dokumen", text: headerText })

  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].lineIdx + 1
    const end = i + 1 < positions.length ? positions[i + 1].lineIdx : lines.length
    const text = lines.slice(start, end).join("\n").trim()
    sections.push({ key: positions[i].key, label: positions[i].label, text })
  }
  return sections
}
