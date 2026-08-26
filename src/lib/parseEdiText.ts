// Parser CSV pipe/comma-delimited-nya EDI OMSET DASHBOARD (Ficom) — dipakai
// baik dari upload manual (browser, data-transfer/page.tsx) maupun dari sync
// otomatis (server, api/ficom-edi-sync/route.ts) supaya dua jalur itu selalu
// menghasilkan baris yang identik. Auto-detect delimiter dari baris header.
export function parseEdiText(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n")
  if (!lines.length) return []
  const delim = lines[0].includes("|") ? "|" : ","
  const headers = lines[0].split(delim).map(h => h.replace(/"/g, "").trim().toLowerCase())
  return lines.slice(1).map(line => {
    const cols = line.split(delim).map(c => c.replace(/"/g, "").trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = cols[i] || "" })
    return row
  }).filter(r => r.distributor_id)
}