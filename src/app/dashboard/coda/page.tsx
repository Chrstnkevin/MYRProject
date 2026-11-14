"use client"
// PATH: src/app/dashboard/coda/page.tsx
//
// "CODA" — dashboard monitoring yang langsung nembak table spesifik di
// Superhuman Docs (eks-Coda), BIAR NGGAK PERLU pilih Doc/Table manual tiap
// buka (itu pain point aslinya: akses Coda lemot + harus nyari dokumennya
// manual tiap kali). 3 sub-tab, tiap tab dicari OTOMATIS berdasarkan NAMA
// table (bukan ID yang di-hardcode, soalnya nama kayak "List Monitoring 5"
// nambah angkanya tiap dibikin ulang) ke SEMUA Doc yang kebaca token API
// (lihat src/lib/superhumanDocs.ts). Read-only, sama kayak sebelumnya.
//
// CATATAN: ini BUTUH token SUPERHUMAN_DOCS_API_TOKEN yang bisa akses doc
// "Monitoring Pilot" — kalau token-nya cuma di-scope ke doc lain, ketiga
// tab di sini bakal nunjukin error "table nggak ketemu". Itu soal akses di
// akun Superhuman Docs, bukan kode.

import { Fragment, useEffect, useState, type ReactNode } from "react"
import { RefreshCw, AlertCircle, Loader2 } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

interface CodaDocItem { id: string; name: string }
interface CodaTableItem { id: string; name: string; tableType?: string; rowCount?: number; parentTable?: { id: string; name?: string } }
interface CodaRowItem { id: string; name?: string; values: Record<string, unknown> }
// tableRowCount = rowCount yang DILAPORKAN Coda sendiri buat table ini
// (metadata, bukan hasil fetch /rows kita) — dipakai buat diagnostik:
// kalau beda jauh dari rows.length yang kebaca, berarti ada masalah
// pagination/cache; kalau SAMA tapi user lihat lebih banyak di browser
// Coda, berarti table yang ketemu BUKAN yang dimaksud (salah match, atau
// yang dilihat user di Coda itu View lain/table lain).
// viaViewName: kalau keisi, berarti kita REDIRECT dari sebuah View ke
// base table aslinya (lewat parentTable) — soalnya View (mis. "ADOP
// BACKLOG") bisa punya filter kontrol "per-user" yang nggak pernah
// match versi token API kita walau user udah ubah di browser-nya
// sendiri; base table nggak kena filter apapun jadi aman dibaca apa
// adanya. tableName di sini jadi nama BASE TABLE-nya, bukan View-nya.
interface TableLocation { docId: string; docName: string; tableId: string; tableName: string; tableType?: string; tableRowCount?: number; viaViewName?: string }

// richValues: minta rows TANPA valueFormat=simple (lihat catatan di
// rows/route.ts) — dibutuhin ADOP biar kolom multi-value (Doc. Ref.,
// Status Dev) tetep array asli, nggak digabung jadi 1 string koma.
interface TabDef { key: string; label: string; matcher: (name: string) => boolean; richValues?: boolean }

// Nama table dicocokkan longgar (bukan exact match ketat) biar tetep
// jalan walau ada sedikit variasi penamaan di Coda-nya nanti.
const TABS: TabDef[] = [
  { key: "plan-pilot", label: "Plan Pilot", matcher: n => n.trim().toLowerCase() === "plan pilot" },
  // richValues DICABUT — ternyata Doc. Ref./Status Dev itu TEKS biasa
  // (bukan array terstruktur), rich vs simple nggak ngaruh buat kolom
  // ini (dikonfirmasi: tetep sama digabung koma walau udah dicoba
  // rich). Splitting-nya sekarang ditangani manual di AdopTable lewat
  // splitDocRefText/splitStatusText, jadi nggak perlu ambil resiko
  // ganti format buat kolom lain (PIC Apps dst) yang udah jalan bener.
  { key: "adop", label: "ADOP", matcher: n => /adop/i.test(n) && /backlog/i.test(n) },
  { key: "semua-dokumen", label: "Semua Dokumen", matcher: n => n.trim().toLowerCase().startsWith("list monitoring") },
]

// Grouping Plan Pilot by "User"/"User Request" DIBUANG — 1 batch
// "Plan Pilot" (mis. "Pilot Matrix 26.11.02") ternyata bisa nyampur
// beberapa User sekaligus (PHI + "ALL" dkk, ketauan dari screenshot
// user), jadi grouping per kategori bikin 1 batch kepecah nggak jelas
// ke beberapa tab. Sekarang Plan Pilot cuma 1 TABEL isi SEMUA baris,
// filter manual lewat dropdown "Plan Pilot" yang udah ada.
// "Plan Pilot" (nama batch pilot-nya, mis. "Pilot Matrix 26.11.02")
// ditambahin di preview sesuai request user — sebelumnya cuma
// Doc No/Doc Name/Status Dev, info batch pilot-nya nggak kelihatan.
const PREVIEW_COLS = ["Plan Pilot", "Doc. No.", "Doc. Name", "Status Dev"]

// Khusus tab "ADOP" — 4 TAB terpisah (beda dari Plan Pilot yang 4 panel
// sejajar) berdasarkan kolom "User" (bukan "User Request" — table ini
// nggak punya kolom itu). Nggak digabung kayak "HSJ/PGD" di Plan Pilot,
// user eksplisit minta 4 tab berdiri sendiri-sendiri.
const ADOP_CATEGORIES: { key: string; label: string; match: (v: string) => boolean; color: string }[] = [
  { key: "phi", label: "PHI", match: v => v.trim().toUpperCase() === "PHI", color: "#DC2626" },
  { key: "scp", label: "SCP", match: v => v.trim().toUpperCase() === "SCP", color: "#16A34A" },
  { key: "hsj", label: "HSJ", match: v => v.trim().toUpperCase() === "HSJ", color: "#7C3AED" },
  { key: "mt", label: "MT", match: v => v.trim().toUpperCase() === "MT", color: "#0891B2" },
]
// ADOP sekarang baca dari base table "Project Backlog" (lihat
// TableLocation.viaViewName) yang kolomnya JAUH lebih banyak/generic
// (dipakai bareng banyak page lain) — makanya dipersempit ke SET kolom
// yang eksplisit diminta user, bukan nampilin semua kolom yang kebaca.
// KPI & "Doc. Ref." di depan (diminta user) — "Doc. Ref." & "Status Dev"
// dirender MERGED jadi 1 kolom (lihat AdopTable) soalnya keduanya array
// PARALEL per baris (Doc. Ref. ke-i statusnya Status Dev ke-i), bukan 2
// daftar independen — makanya ditaruh berdampingan sejajar per baris,
// bukan 2 kolom terpisah yang kehilangan hubungannya.
const ADOP_PREVIEW_COLS = ["KPI", "Request", "Doc. Ref.", "Status Dev", "Deadline", "Submit Sprint", "Review Sprint", "Dev Sprint", "Test Sprint", "PIC Apps", "PIC BR"]

// Cocokin `desired` (nama kolom yang KITA mau, longgar lewat normKey) ke
// nama kolom ASLI yang beneran ada di `rows` — biar DynamicTable (yang
// butuh key PERSIS, bukan normalized) tetap dapet key yang valid. Kolom
// yang diminta tapi nggak ketemu di data balik lewat `missing` (buat
// ditampilin sebagai peringatan, bukan disembunyiin diam-diam).
function resolveColumns(rows: CodaRowItem[], desired: string[]): { found: string[]; missing: string[] } {
  const allCols = collectColumns(rows)
  const found: string[] = []
  const missing: string[] = []
  for (const d of desired) {
    const match = allCols.find(c => normKey(c) === normKey(d))
    if (match) found.push(match)
    else missing.push(d)
  }
  return { found, missing }
}

// Kolom multi-select/person-reference (mis. "Status Dev", "Plan Pilot",
// "PIC Apps") balik dari Coda bukan string biasa — bisa array (kosong
// kalau belum keisi) atau objek {name: ...} (kolom orang/row lain).
// SEBELUMNYA pakai JSON.stringify(v) polos, jadi array kosong muncul
// literal "[]" di tabel (ketauan dari screenshot user). Array
// digabung jadi teks biasa, objek diambil `.name`-nya kalau ada.
function cellItemText(x: unknown): string {
  if (x == null) return ""
  if (typeof x === "object" && "name" in x) return String((x as { name: unknown }).name)
  return String(x)
}
function fmtCell(v: unknown): string {
  if (v == null) return "—"
  if (Array.isArray(v)) {
    if (v.length === 0) return "—"
    return v.map(cellItemText).join(", ")
  }
  if (typeof v === "object") {
    if ("name" in (v as object)) return String((v as { name: unknown }).name)
    return JSON.stringify(v)
  }
  return String(v)
}
// "Doc. Ref." di Coda itu TEKS biasa isinya banyak referensi digabung
// koma MANUAL oleh orang yang nginput — koma di situ AMBIGU karena
// judul dokumennya sendiri sering ada koma (mis. "...Kanvas, Gudang
// Lain, R1, R2" itu SATU judul, bukan 4 item). Dipisah pakai pola KODE
// dokumen sebagai penanda AWAL tiap referensi baru lewat lookahead
// split — bukan split polos per koma. Formatnya ternyata beda-beda per
// tim: PHI diakhiri "_(TEAM)" (mis. "P26-XXX-MTX_(PHI)"), tapi
// SCP/MT cuma diakhiri "_" doang tanpa kurung (mis.
// "R26-DDD-AIX_Research Model Baseline") — makanya bagian
// "\([A-Z]+\)" di akhir dibikin OPSIONAL, bukan wajib.
const DOC_REF_SPLIT_RE = /(?=[A-Z]\d{2}-[\w]+-[A-Z]+_(?:\([A-Z]+\))?)/g
function splitDocRefText(s: string): string[] {
  const parts = s.split(DOC_REF_SPLIT_RE).map(p => p.replace(/^[,\s]+|[,\s]+$/g, "")).filter(Boolean)
  return parts.length > 0 ? parts : [s]
}
// Status Dev nilainya dari daftar tetap (OPEN, READY TO PILOT, dst)
// yang nggak pernah ada koma literal di dalamnya, jadi split polos per
// koma AMAN buat kolom ini (beda dari Doc. Ref. di atas).
function splitStatusText(s: string): string[] {
  return s.split(",").map(x => x.trim()).filter(Boolean)
}
function toDocRefArray(v: unknown): unknown[] {
  if (v == null) return []
  if (Array.isArray(v)) return v
  if (typeof v === "string" && v) return splitDocRefText(v)
  return [v]
}
function toStatusArray(v: unknown): unknown[] {
  if (v == null) return []
  if (Array.isArray(v)) return v
  if (typeof v === "string" && v) return splitStatusText(v)
  return [v]
}

// Badge warna buat kolom status (Status Dev, Status Project, dll) —
// sebelumnya semua kolom ditampilin plain text, kelihatan monoton
// dibanding tampilan asli Coda yang warna-warni per status.
function isStatusColumn(c: string): boolean { return /status/i.test(c) }
function statusColor(v: string): { bg: string; fg: string } {
  const s = v.trim().toUpperCase()
  // Diperluas pas ketemu kosakata status table "ADOP BACKLOG" (ON
  // PROGRESS/HOLD/OPG DR/OPG TEST/PILOT/DONE) yang beda dari table
  // "Plan Pilot" (OPEN DEV/READY TO PILOT/OPEN TEST) — urutan cek ini
  // PENTING (dari paling spesifik/final ke paling umum) karena beberapa
  // value bisa cocok ke lebih dari 1 aturan.
  if (s.includes("READY") || s.includes("DONE") || s.includes("RELEASE") || s.includes("PILOT")) return { bg: "#DCFCE7", fg: "#166534" }
  if (s.includes("HOLD")) return { bg: "#EDE9FE", fg: "#5B21B6" }
  if (s.includes("TEST")) return { bg: "#FEF3C7", fg: "#92400E" }
  if (s.includes("PROGRESS") || s.includes("OPEN") || s.includes("DEV") || s.includes("DR")) return { bg: "#E0F2FE", fg: "#075985" }
  return { bg: "var(--surface2)", fg: "var(--text3)" }
}

// Normalisasi nama kolom (buang spasi/titik, lowercase) biar pencarian
// field nggak kejebak beda format kecil ("Doc. No." vs "Doc No" vs "doc_no").
function normKey(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, "") }
// Pakai fmtCell (bukan String(v) polos) biar robust ke array/objek
// {name} yang muncul pas rows di-fetch tanpa valueFormat=simple (lihat
// TabDef.richValues) — String(v) buat array of objects bakal jadi
// "[object Object]" yang salah buat filter/sort.
function getFieldValue(values: Record<string, unknown>, fieldName: string): string {
  const target = normKey(fieldName)
  for (const [k, v] of Object.entries(values)) {
    if (normKey(k) === target) { const t = fmtCell(v); return t === "—" ? "" : t }
  }
  return ""
}

function collectColumns(rows: CodaRowItem[]): string[] {
  const columns: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    for (const k of Object.keys(r.values || {})) {
      if (!seen.has(k)) { seen.add(k); columns.push(k) }
    }
  }
  return columns
}

// Sort generik by nilai kolom (angka kalau keduanya numerik, teks
// kalau nggak) — dipakai DynamicTable & AdopTable, diminta user biar
// tiap kolom bisa diurutin naik/turun lewat klik header.
type SortDir = "asc" | "desc"
function sortByColumn(rows: CodaRowItem[], col: string | null, dir: SortDir): CodaRowItem[] {
  if (!col) return rows
  const copy = [...rows]
  copy.sort((a, b) => {
    const av = fmtCell(a.values?.[col]).trim(), bv = fmtCell(b.values?.[col]).trim()
    const an = Number(av), bn = Number(bv)
    const cmp = av !== "" && bv !== "" && !isNaN(an) && !isNaN(bn) ? an - bn : av.localeCompare(bv)
    return dir === "asc" ? cmp : -cmp
  })
  return copy
}
function SortableHeader({ label, col, sortCol, sortDir, onSort }: { label: string; col: string; sortCol: string | null; sortDir: SortDir; onSort: (col: string) => void }) {
  const active = sortCol === col
  return (
    <th onClick={() => onSort(col)} style={{ padding: "8px 10px", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", color: active ? "var(--text)" : "var(--text3)" }}>
      {label} <span style={{ opacity: active ? 1 : 0.35 }}>{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  )
}

function DynamicTable({ rows, columns }: { rows: CodaRowItem[]; columns: string[] }) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  if (rows.length === 0) return <p style={{ fontSize: 12, color: "var(--text3)", padding: 20 }}>Nggak ada data.</p>
  const sortedRows = sortByColumn(rows, sortCol, sortDir)
  const onSort = (c: string) => { if (sortCol === c) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(c); setSortDir("asc") } }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
            {columns.map(c => <SortableHeader key={c} label={c} col={c} sortCol={sortCol} sortDir={sortDir} onSort={onSort} />)}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map(r => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              {columns.map(c => {
                const raw = r.values?.[c]
                const rawText = fmtCell(raw)
                if (isStatusColumn(c) && rawText !== "—") {
                  const { bg, fg } = statusColor(rawText)
                  return (
                    <td key={c} style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color: fg }}>{rawText}</span>
                    </td>
                  )
                }
                return <td key={c} style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>{rawText}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Khusus tabel ADOP — "Doc. Ref." & "Status Dev" itu pasangan PARALEL
// per baris (doc ke-i -> status ke-i). SEBELUMNYA pakai <table> biasa
// dengan header 2x<th> terpisah tapi body 1x<td colSpan={2}> yang isinya
// grid sendiri — browser ngitung lebar kolom header vs body itu dengan
// ATURAN BEDA (header murni dari lebar teks "Doc. Ref."/"Status Dev",
// body dari grid internal 3fr/1fr), jadi header & body nggak pernah
// align sempurna, apalagi pas kolom lain (Deadline dst) ikut kegeser
// (ketauan dari screenshot user). FIX TOTAL: buang <table> sepenuhnya,
// pakai SATU CSS Grid gede yang nampung header DAN semua baris+pasangan
// sekaligus, dengan grid-column/grid-row di-set EKSPLISIT per sel lewat
// JS — jadi SEMUA sel (header ataupun body, row manapun) WAJIB nempel
// ke grid-line yang SAMA persis, nggak ada ambiguitas tabel HTML lagi.
// `columnOrder` = urutan SEMUA kolom (dari resolveColumns, termasuk
// docRefKey/statusKey) — dipakai nentuin DI POSISI MANA pasangan
// Doc.Ref/Status Dev nongol relatif ke kolom lain (mis. biar "Request"
// bisa ditaruh SEBELUM Doc.Ref, cukup urutin ADOP_PREVIEW_COLS).
function AdopTable({ rows, columnOrder, docRefKey, statusKey }: {
  rows: CodaRowItem[]; columnOrder: string[]; docRefKey?: string; statusKey?: string
}) {
  const [sortCol, setSortCol] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  if (rows.length === 0) return <p style={{ fontSize: 12, color: "var(--text3)", padding: 20 }}>Nggak ada data.</p>
  const sortedRows = sortByColumn(rows, sortCol, sortDir)
  const onSort = (c: string) => { if (sortCol === c) setSortDir(d => d === "asc" ? "desc" : "asc"); else { setSortCol(c); setSortDir("asc") } }

  const slots: ({ type: "plain"; col: string } | { type: "docstatus" })[] = []
  let docstatusInserted = false
  for (const c of columnOrder) {
    if (docRefKey && c === docRefKey) {
      if (!docstatusInserted) { slots.push({ type: "docstatus" }); docstatusInserted = true }
      continue
    }
    if (statusKey && c === statusKey) continue
    slots.push({ type: "plain", col: c })
  }
  // Posisi grid-column (1-based) tiap slot — docstatus makan 2 kolom
  // grid (doc + status), slot lain makan 1.
  const colStart: number[] = []
  let cc = 1
  for (const s of slots) { colStart.push(cc); cc += s.type === "docstatus" ? 2 : 1 }
  const totalCols = cc - 1
  const gridTemplateColumns = slots.map(s => s.type === "docstatus" ? "minmax(170px,3fr) minmax(90px,1fr)" : "max-content").join(" ")

  const records = sortedRows.map(r => {
    const docs = docRefKey ? toDocRefArray(r.values?.[docRefKey]) : []
    const statuses = statusKey ? toStatusArray(r.values?.[statusKey]) : []
    const n = Math.max(1, docs.length, statuses.length)
    const pairs = Array.from({ length: n }, (_, i) => ({ doc: cellItemText(docs[i]) || "—", status: cellItemText(statuses[i]) }))
    return { r, n, pairs }
  })

  const cellBase = { padding: "7px 10px", fontSize: 11, whiteSpace: "nowrap" as const }
  const headerCell = { ...cellBase, color: "var(--text3)", background: "var(--surface2)", fontWeight: 700, borderBottom: "1px solid var(--border)" }

  let rowCursor = 2 // baris grid 1 = header
  const bodyCells: ReactNode[] = []
  records.forEach((rec, recIdx) => {
    const rowStart = rowCursor
    // Selang-seling per BARIS CODA (bukan per pasangan) — biar kelihatan
    // jelas batas 1 "blok" (KPI/Request/dst itu 1 nilai buat 1 blok
    // penuh, bukan per pasangan Doc Ref/Status Dev).
    const rowBg = recIdx % 2 === 1 ? "var(--surface2)" : "var(--surface)"
    bodyCells.push(
      <div key={`bg-${recIdx}`} style={{ gridColumn: `1 / ${totalCols + 1}`, gridRow: `${rowStart} / span ${rec.n}`, background: rowBg, borderBottom: "2px solid var(--border)" }} />
    )
    slots.forEach((s, slotIdx) => {
      const col = colStart[slotIdx]
      if (s.type === "docstatus") {
        rec.pairs.forEach((p, j) => {
          const sc = p.status ? statusColor(p.status) : null
          const bb = j < rec.n - 1 ? "1px dashed var(--border)" : "none"
          bodyCells.push(
            <div key={`d-${recIdx}-${j}`} style={{ ...cellBase, whiteSpace: "normal", gridColumn: col, gridRow: rowStart + j, color: "var(--text2)", borderBottom: bb, borderRight: "1px solid var(--border)", overflowWrap: "break-word" }}>{p.doc}</div>
          )
          bodyCells.push(
            <div key={`s-${recIdx}-${j}`} style={{ ...cellBase, gridColumn: col + 1, gridRow: rowStart + j, borderBottom: bb }}>
              {sc ? <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: sc.bg, color: sc.fg }}>{p.status}</span> : "—"}
            </div>
          )
        })
      } else {
        const raw = rec.r.values?.[s.col]
        const rawText = fmtCell(raw)
        const content = isStatusColumn(s.col) && rawText !== "—" ? (() => {
          const { bg, fg } = statusColor(rawText)
          return <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color: fg }}>{rawText}</span>
        })() : rawText
        bodyCells.push(
          <div key={`p-${recIdx}-${slotIdx}`} style={{ ...cellBase, gridColumn: col, gridRow: `${rowStart} / span ${rec.n}`, color: "var(--text2)", display: "flex", alignItems: "center" }}>{content}</div>
        )
      }
    })
    rowCursor += rec.n
  })

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns }}>
        {slots.map((s, i) => {
          const col = colStart[i]
          if (s.type === "docstatus") {
            return (
              <Fragment key={`h${i}`}>
                <div style={{ ...headerCell, gridColumn: col, gridRow: 1 }}>Doc. Ref.</div>
                <div style={{ ...headerCell, gridColumn: col + 1, gridRow: 1 }}>Status Dev</div>
              </Fragment>
            )
          }
          const active = sortCol === s.col
          return (
            <div key={`h${i}`} onClick={() => onSort(s.col)}
              style={{ ...headerCell, gridColumn: col, gridRow: 1, cursor: "pointer", userSelect: "none", color: active ? "var(--text)" : "var(--text3)" }}>
              {s.col} <span style={{ opacity: active ? 1 : 0.35 }}>{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
            </div>
          )
        })}
        {bodyCells}
      </div>
    </div>
  )
}

// Dropdown multi-pilih (checkbox) — diminta user biar Timeline bisa
// pilih beberapa sekaligus (mis. 2026.Q4 + 2026.Q4.BE + 2026.X bareng),
// mirip widget filter Coda sendiri. selected=[] berarti "semua" (filter
// nggak aktif).
function MultiSelectDropdown({ label, options, selected, onChange }: { label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 11, fontFamily: "inherit", cursor: "pointer", whiteSpace: "nowrap" }}>
        {label}: {selected.length === 0 ? "Semua" : `${selected.length} dipilih`}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
          <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 8, minWidth: 190, maxHeight: 260, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
            {options.length === 0 && <p style={{ fontSize: 10, color: "var(--text3)", padding: 4 }}>Nggak ada opsi.</p>}
            {options.map(o => (
              <label key={o} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 6px", fontSize: 11, color: "var(--text2)", cursor: "pointer", borderRadius: 4 }}>
                <input type="checkbox" checked={selected.includes(o)}
                  onChange={() => onChange(selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o])} />
                {o}
              </label>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, paddingTop: 6, borderTop: "1px solid var(--border)" }}>
              <button onClick={() => onChange(options)} style={{ fontSize: 10, color: "#0891B2", background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Select all</button>
              <button onClick={() => onChange([])} style={{ fontSize: 10, color: "var(--text3)", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Doc ID diekstrak dari link yang user kasih:
// https://docs.superhuman.com/d/_dRt3S4eDoOn/Monitoring-Pilot_su3Vv_nP...
// — "_d" itu penanda path di URL Coda/Superhuman Docs, BUKAN bagian dari
// ID-nya sendiri, jadi ID aslinya "Rt3S4eDoOn" (10 karakter, format
// standar doc ID Coda). "Plan Pilot" & "List Monitoring" dikonfirmasi
// user SAMA-SAMA ada di doc ini. Dicoba DULUAN biar nggak ambigu kalau
// kebetulan ada table lain yang namanya sama persis di doc yang beda
// (ini beneran kejadian — "Plan Pilot" sempat ketemu duluan di doc
// "Global System Support..." yang bukan dimaksud user). Tetap ada
// fallback nyari ke semua doc kalau ID ini ternyata salah/doc-nya pindah.
const KNOWN_DOC_ID = "Rt3S4eDoOn"

// Kalau match-nya View dan punya parentTable, pakai base table-nya
// (lihat catatan viaViewName di TableLocation soal kenapa). parentTable
// CUMA kebaca lewat endpoint detail satuan (/table-detail), BUKAN lewat
// endpoint list (/tables) — ketauan dari raw response GET-single-table
// yang user kasih: field itu ada di sana, tapi di endpoint list semua
// field begini kosong ("—") buat SEMUA table, bukan cuma ADOP BACKLOG.
async function resolveLocation(docId: string, docName: string, match: CodaTableItem, fresh: boolean): Promise<TableLocation> {
  if (match.tableType === "view") {
    const detailRes = await fetch(`/api/superhuman-docs/table-detail?docId=${encodeURIComponent(docId)}&tableId=${encodeURIComponent(match.id)}${fresh ? "&fresh=1" : ""}`).then(r => r.json())
    const parentTable = detailRes?.parentTable as { id?: string; name?: string } | undefined
    if (parentTable?.id) {
      return {
        docId, docName,
        tableId: parentTable.id,
        tableName: parentTable.name || parentTable.id,
        viaViewName: match.name,
      }
    }
  }
  return { docId, docName, tableId: match.id, tableName: match.name, tableType: match.tableType, tableRowCount: match.rowCount }
}

async function findTable(matcher: (name: string) => boolean, fresh = false): Promise<TableLocation | null> {
  const f = fresh ? "&fresh=1" : ""
  const docsRes = await fetch(`/api/superhuman-docs/docs${fresh ? "?fresh=1" : ""}`).then(r => r.json())
  if (docsRes.error) throw new Error(docsRes.error)
  const allDocs = (docsRes.items || []) as CodaDocItem[]

  const knownDoc = allDocs.find(d => d.id === KNOWN_DOC_ID)
  if (knownDoc) {
    const tablesRes = await fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(knownDoc.id)}${f}`).then(r => r.json())
    if (!tablesRes.error) {
      const match = ((tablesRes.items || []) as CodaTableItem[]).find(t => matcher(t.name))
      if (match) return resolveLocation(knownDoc.id, knownDoc.name, match, fresh)
    }
  }

  for (const d of allDocs) {
    if (d.id === KNOWN_DOC_ID) continue
    const tablesRes = await fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(d.id)}${f}`).then(r => r.json())
    if (tablesRes.error) continue
    const match = ((tablesRes.items || []) as CodaTableItem[]).find(t => matcher(t.name))
    if (match) return resolveLocation(d.id, d.name, match, fresh)
  }
  return null
}

export default function CodaPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const [located, setLocated] = useState<Record<string, TableLocation | null>>({})
  const [rowsByTab, setRowsByTab] = useState<Record<string, CodaRowItem[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errorByTab, setErrorByTab] = useState<Record<string, string>>({})
  // Filter dropdown "Plan Pilot" — "" = semua, nggak difilter.
  const [planPilotFilter, setPlanPilotFilter] = useState("")
  const [adopSubTab, setAdopSubTab] = useState(ADOP_CATEGORIES[0].key)
  // Default difokusin ke periode yang lagi berjalan/mendatang (diminta
  // user) — array kosong = "semua" (nggak difilter). Perlu di-update
  // manual kalau periode "berjalan" ini udah lewat (mis. ganti ke
  // 2027.Q1 dkk pas waktunya).
  const [adopTimelineFilter, setAdopTimelineFilter] = useState<string[]>(["2026.Q4", "2026.Q4.BE", "2026.X"])
  const [adopSprintFilter, setAdopSprintFilter] = useState("")
  // Debug: daftar SEMUA table/view di doc yang lagi aktif — dipakai buat
  // ketauan kalau table yang ketemu itu "view" (filter permanen beda dari
  // base table-nya), biar bisa dicocokin mana yang punya baris lengkap.
  const [allTables, setAllTables] = useState<CodaTableItem[] | null>(null)
  const [allTablesLoading, setAllTablesLoading] = useState(false)
  // Debug: raw response dari endpoint GET-single-table (beda dari /tables
  // yang list semua) — dipakai buat cek field APA AJA yang beneran
  // dikasih Coda buat table yang lagi dipakai tab ini (filter,
  // parentTable, dll), soalnya endpoint list ternyata nggak ngasih
  // field-field itu sama sekali.
  const [tableDetailRaw, setTableDetailRaw] = useState<string | null>(null)
  const [tableDetailLoading, setTableDetailLoading] = useState(false)

  useEffect(() => { loadTab(activeTab) }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTab(tabKey: string, force = false) {
    if (!force && (rowsByTab[tabKey] || loading[tabKey])) return
    const tab = TABS.find(t => t.key === tabKey)!
    setLoading(l => ({ ...l, [tabKey]: true }))
    setErrorByTab(er => ({ ...er, [tabKey]: "" }))
    try {
      let loc = located[tabKey]
      if (!loc || force) {
        loc = await findTable(tab.matcher, force)
        if (!loc) throw new Error(`Table buat "${tab.label}" nggak ketemu di Doc manapun yang kebaca token ini — cek apakah token SUPERHUMAN_DOCS_API_TOKEN sudah bisa akses doc yang bersangkutan.`)
        setLocated(l => ({ ...l, [tabKey]: loc }))
      }
      const res = await fetch(`/api/superhuman-docs/rows?docId=${encodeURIComponent(loc.docId)}&tableId=${encodeURIComponent(loc.tableId)}${force ? "&fresh=1" : ""}${tab.richValues ? "&simple=0" : ""}`).then(r => r.json())
      if (res.error) throw new Error(res.error)
      setRowsByTab(r => ({ ...r, [tabKey]: res.items || [] }))
    } catch (e) {
      setErrorByTab(er => ({ ...er, [tabKey]: e instanceof Error ? e.message : String(e) }))
    }
    setLoading(l => ({ ...l, [tabKey]: false }))
  }

  async function loadAllTables() {
    if (!loc) return
    setAllTablesLoading(true)
    try {
      const res = await fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(loc.docId)}&fresh=1`).then(r => r.json())
      setAllTables(res.error ? [] : (res.items || []))
    } catch {
      setAllTables([])
    }
    setAllTablesLoading(false)
  }

  // Debug: ambil raw detail dari ID View "ADOP BACKLOG" yang ASLI (bukan
  // hasil redirect ke parentTable, karena parentTable-nya sendiri nggak
  // ketemu) — butuh ID View aslinya buat ini, jadi dicari ulang dari
  // allTables kalau ada, fallback ke loc.tableId.
  async function loadTableDetail(tableId: string) {
    if (!loc) return
    setTableDetailLoading(true)
    try {
      const res = await fetch(`/api/superhuman-docs/table-detail?docId=${encodeURIComponent(loc.docId)}&tableId=${encodeURIComponent(tableId)}&fresh=1`).then(r => r.json())
      setTableDetailRaw(JSON.stringify(res, null, 2))
    } catch (e) {
      setTableDetailRaw(`Error: ${e instanceof Error ? e.message : String(e)}`)
    }
    setTableDetailLoading(false)
  }

  const tab = TABS.find(t => t.key === activeTab)!
  const rows = rowsByTab[activeTab] || []
  const loc = located[activeTab]
  const isLoading = loading[activeTab]
  const error = errorByTab[activeTab]

  const columns = collectColumns(rows)

  // Khusus tab Plan Pilot: SATU tabel isi semua baris (grouping by
  // User/User Request DIBUANG, lihat catatan di PREVIEW_COLS), cuma
  // difilter dropdown "Plan Pilot" (opsinya dari SEMUA baris).
  const planPilotAllRows = activeTab === "plan-pilot" ? rows : []
  const planPilotOptions = Array.from(new Set(planPilotAllRows.map(r => getFieldValue(r.values, "Plan Pilot")).filter(Boolean))).sort()
  const planPilotRows = planPilotFilter ? planPilotAllRows.filter(r => getFieldValue(r.values, "Plan Pilot") === planPilotFilter) : planPilotAllRows

  // Chart persentase per "Status Dev" (diminta user) — warna bar-nya
  // dicocokin ke statusColor() yang SAMA dipakai buat badge status di
  // tabel, biar konsisten (bukan skema warna baru).
  const statusDevPercent = activeTab === "plan-pilot" ? (() => {
    const counts = new Map<string, number>()
    for (const r of planPilotRows) {
      const v = getFieldValue(r.values, "Status Dev").trim() || "(kosong)"
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    const total = planPilotRows.length || 1
    return Array.from(counts.entries())
      .map(([status, n]) => ({ status, n, pct: (n / total) * 100 }))
      .sort((a, b) => b.n - a.n)
  })() : []

  // Khusus tab ADOP: filter ke sub-tab (User) yang aktif dulu, baru dropdown
  // Timeline & ADOP Sprint (opsi dropdown dihitung dari baris sub-tab yang
  // aktif, SEBELUM difilter dropdown, biar opsinya nggak ngilang begitu
  // salah satu dropdown dipilih). Baris diurutin KPI dulu baru Request.
  const adopActive = ADOP_CATEGORIES.find(c => c.key === adopSubTab)!
  const adopCategoryRows = activeTab === "adop" ? rows.filter(r => adopActive.match(getFieldValue(r.values, "User"))) : []
  const adopTimelineOptions = Array.from(new Set(adopCategoryRows.map(r => getFieldValue(r.values, "Timeline")).filter(Boolean))).sort()
  // ADOP Sprint ngikutin pilihan Timeline (diminta user) — opsinya
  // dihitung dari baris yang UDAH kefilter Timeline duluan, biar nggak
  // nawarin value ADOP Sprint yang nggak relevan sama Timeline terpilih.
  const adopRowsAfterTimeline = adopCategoryRows.filter(r => adopTimelineFilter.length === 0 || adopTimelineFilter.includes(getFieldValue(r.values, "Timeline")))
  const adopSprintOptions = Array.from(new Set(adopRowsAfterTimeline.map(r => getFieldValue(r.values, "ADOP Sprint")).filter(Boolean))).sort()
  const adopRows = adopRowsAfterTimeline
    .filter(r => !adopSprintFilter || getFieldValue(r.values, "ADOP Sprint") === adopSprintFilter)
    .sort((a, b) => {
      const ka = getFieldValue(a.values, "KPI"), kb = getFieldValue(b.values, "KPI")
      if (ka !== kb) return ka.localeCompare(kb)
      return getFieldValue(a.values, "Request").localeCompare(getFieldValue(b.values, "Request"))
    })
  const { found: adopFoundCols, missing: adopMissingColumns } = activeTab === "adop" ? resolveColumns(adopRows, ADOP_PREVIEW_COLS) : { found: [], missing: [] }
  const adopAllColumns = activeTab === "adop" ? collectColumns(adopRows) : []
  // "Doc. Ref." & "Status Dev" dirender MERGED (lihat AdopTable), di
  // POSISI aslinya di adopFoundCols (ngikutin urutan ADOP_PREVIEW_COLS
  // yang udah di-resolve ke nama asli) — kolom lain (termasuk KPI &
  // Request) tetep kolom biasa, urutannya ngikutin posisi masing2.
  const adopDocRefKey = adopFoundCols.find(c => normKey(c) === normKey("Doc. Ref."))
  const adopStatusDevKey = adopFoundCols.find(c => normKey(c) === normKey("Status Dev"))

  // Chart "jumlah item per periode Deadline" (diminta user) — dihitung
  // dari adopRows yang UDAH kena semua filter (sub-tab + Timeline + ADOP
  // Sprint), biar chart-nya selalu sinkron sama tabel di bawahnya.
  // Diurutin BESAR KE KECIL (diminta user), bukan alfabetis.
  const deadlineCounts = activeTab === "adop" ? (() => {
    const counts = new Map<string, number>()
    for (const r of adopRows) {
      const v = getFieldValue(r.values, "Deadline").trim() || "(kosong)"
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  })() : []
  const deadlineMax = Math.max(1, ...deadlineCounts.map(([, n]) => n))

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>
      <MotivationBanner page="docreq" />

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{
              padding: "10px 16px", border: "none", borderBottom: activeTab === t.key ? "2px solid #0891B2" : "2px solid transparent",
              background: "transparent", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
              fontWeight: activeTab === t.key ? 800 : 600, color: activeTab === t.key ? "#0891B2" : "var(--text3)",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text3)" }}>
          {loc ? (
            <>
              Sumber: <strong>{loc.docName}</strong> → <strong>{loc.tableName}</strong>
              {loc.viaViewName ? (
                <span style={{ color: "#166534", fontWeight: 700 }}> (base table, ketemu lewat view &quot;{loc.viaViewName}&quot; — nembus filter per-user)</span>
              ) : loc.tableType ? <> ({loc.tableType})</> : null} · {rows.length} baris kebaca
              {typeof loc.tableRowCount === "number" && (
                <>
                  {" "}· Coda lapor <strong>{loc.tableRowCount}</strong> baris di table ini
                  {loc.tableRowCount !== rows.length && (
                    <span style={{ color: "#DC2626", fontWeight: 700 }}> — BEDA! kemungkinan salah table/view yang ketemu</span>
                  )}
                </>
              )}
              {" "}· cache 5 menit, Refresh buat paksa fetch ulang
            </>
          ) : isLoading ? "Mencari table..." : "—"}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {loc && (
            <button onClick={() => { setAllTables(allTables ? null : []); if (!allTables) loadAllTables() }}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 11, color: "var(--text2)", fontFamily: "inherit" }}>
              {allTables ? "Tutup daftar table" : "Lihat semua table"}
            </button>
          )}
          {loc && (
            <button onClick={() => { if (tableDetailRaw) { setTableDetailRaw(null) } else { loadTableDetail(loc.tableId) } }}
              style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 11, color: "var(--text2)", fontFamily: "inherit" }}>
              {tableDetailRaw ? "Tutup detail" : "Lihat detail table (raw)"}
            </button>
          )}
          <button onClick={() => loadTab(activeTab, true)} disabled={isLoading}
            style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 11, color: "var(--text2)", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
            {isLoading ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <RefreshCw size={12} />} Refresh
          </button>
        </div>
      </div>

      {tableDetailRaw !== null && (
        <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", marginBottom: 8 }}>
            Raw response dari GET /tables/{loc?.tableId} (endpoint detail satuan, bukan list):
          </div>
          {tableDetailLoading ? (
            <p style={{ fontSize: 11, color: "var(--text3)" }}>Memuat...</p>
          ) : (
            <pre style={{ fontSize: 10, color: "var(--text2)", overflowX: "auto", background: "var(--surface2)", padding: 10, borderRadius: 8, maxHeight: 400, overflowY: "auto" }}>{tableDetailRaw}</pre>
          )}
        </div>
      )}

      {allTables !== null && (
        <div style={{ background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12, padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", marginBottom: 8 }}>
            Semua table/view di doc <strong>{loc?.docName}</strong> — diurutin rowCount terbesar dulu. Yang dipakai tab ini: <strong>{loc?.tableName}</strong> (id: {loc?.tableId}).
          </div>
          {allTablesLoading ? (
            <p style={{ fontSize: 11, color: "var(--text3)" }}>Memuat...</p>
          ) : allTables.length === 0 ? (
            <p style={{ fontSize: 11, color: "var(--text3)" }}>Gagal ambil daftar table.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "5px 8px" }}>Nama</th>
                    <th style={{ padding: "5px 8px" }}>Tipe</th>
                    <th style={{ padding: "5px 8px" }}>rowCount (Coda)</th>
                    <th style={{ padding: "5px 8px" }}>Parent table (kalau view)</th>
                    <th style={{ padding: "5px 8px" }}>ID</th>
                  </tr>
                </thead>
                <tbody>
                  {[...allTables].sort((a, b) => (b.rowCount || 0) - (a.rowCount || 0)).map(t => (
                    <tr key={t.id} style={{ borderBottom: "1px solid var(--border)", background: t.id === loc?.tableId || t.parentTable?.id === loc?.tableId ? "#DBEAFE33" : undefined }}>
                      <td style={{ padding: "5px 8px", fontWeight: t.id === loc?.tableId ? 800 : 400 }}>{t.name}</td>
                      <td style={{ padding: "5px 8px" }}>{t.tableType || "—"}</td>
                      <td style={{ padding: "5px 8px" }}>{typeof t.rowCount === "number" ? t.rowCount : "—"}</td>
                      <td style={{ padding: "5px 8px" }}>{t.parentTable ? (t.parentTable.name || t.parentTable.id) : "—"}</td>
                      <td style={{ padding: "5px 8px", color: "var(--text3)", fontFamily: "monospace", fontSize: 10 }}>{t.id}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#991B1B", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: 12, color: "var(--text3)" }}>Memuat data {tab.label}...</p>
      ) : !error && activeTab === "plan-pilot" ? (
        // Tab Plan Pilot — 1 TABEL isi semua baris (grouping by User
        // dibuang, lihat catatan di PREVIEW_COLS), filter dropdown
        // "Plan Pilot" + chart persentase Status Dev.
        <>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            {planPilotOptions.length > 0 && (
              <select value={planPilotFilter} onChange={e => setPlanPilotFilter(e.target.value)}
                style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 11, fontFamily: "inherit" }}>
                <option value="">— Semua Plan Pilot ({planPilotAllRows.length}) —</option>
                {planPilotOptions.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>

          {statusDevPercent.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>Persentase Status Dev ({planPilotRows.length} baris{planPilotFilter ? ` · ${planPilotFilter}` : ""})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {statusDevPercent.map(({ status, n, pct }) => {
                  const sc = statusColor(status)
                  return (
                    <div key={status} style={{ display: "flex", alignItems: "center", gap: 8 }} title={`${status}: ${n} baris (${pct.toFixed(1)}%)`}>
                      <span style={{ width: 110, flexShrink: 0, fontSize: 10, color: "var(--text2)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{status}</span>
                      <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 4, height: 16, position: "relative" }}>
                        <div style={{ width: `${Math.max(2, pct)}%`, height: "100%", borderRadius: 4, background: sc.fg }} />
                      </div>
                      <span style={{ width: 66, flexShrink: 0, fontSize: 10, fontWeight: 700, color: "var(--text)" }}>{pct.toFixed(1)}% ({n})</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <DynamicTable rows={planPilotRows} columns={PREVIEW_COLS} />
          </div>
        </>
      ) : !error && activeTab === "adop" ? (
        // Tab ADOP — 4 TAB terpisah (User: PHI/SCP/HSJ/MT), beda dari
        // Plan Pilot yang 4 panel sejajar. Baris diurutin KPI->Request,
        // kolom dipersempit ke ADOP_PREVIEW_COLS, + filter Timeline &
        // ADOP Sprint, + chart jumlah item per periode Deadline.
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {ADOP_CATEGORIES.map(c => (
              <button key={c.key} onClick={() => { setAdopSubTab(c.key); setAdopTimelineFilter(["2026.Q4", "2026.Q4.BE", "2026.X"]); setAdopSprintFilter("") }}
                style={{
                  padding: "7px 14px", borderRadius: 999, border: `1px solid ${adopSubTab === c.key ? c.color : "var(--border)"}`,
                  background: adopSubTab === c.key ? c.color + "1A" : "var(--surface)", cursor: "pointer",
                  fontSize: 11, fontWeight: 700, color: adopSubTab === c.key ? c.color : "var(--text2)", fontFamily: "inherit",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                {c.label} <span style={{ opacity: 0.8 }}>({rows.filter(r => c.match(getFieldValue(r.values, "User"))).length})</span>
              </button>
            ))}
            <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              {adopTimelineOptions.length > 0 && (
                <MultiSelectDropdown label="Timeline" options={adopTimelineOptions} selected={adopTimelineFilter} onChange={setAdopTimelineFilter} />
              )}
              {adopSprintOptions.length > 0 && (
                <select value={adopSprintFilter} onChange={e => setAdopSprintFilter(e.target.value)}
                  style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 11, fontFamily: "inherit" }}>
                  <option value="">— Semua ADOP Sprint —</option>
                  {adopSprintOptions.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </div>
          </div>

          {adopMissingColumns.length > 0 && (
            <p style={{ fontSize: 10, color: "#92400E", background: "#FEF3C7", borderRadius: 8, padding: "6px 10px" }}>
              Kolom nggak ketemu di data: {adopMissingColumns.join(", ")} — kemungkinan nama aslinya beda di table &quot;{loc?.tableName}&quot;.
              <br />Kolom yang BENERAN ada di data ini: {adopAllColumns.join(", ") || "(nggak ada baris)"}
            </p>
          )}

          {deadlineCounts.length > 0 && (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", marginBottom: 10 }}>Jumlah item per Deadline ({adopActive.label}{adopTimelineFilter.length > 0 ? ` · ${adopTimelineFilter.join(", ")}` : ""}{adopSprintFilter ? ` · ${adopSprintFilter}` : ""})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {deadlineCounts.slice(0, 15).map(([period, n]) => (
                  <div key={period} style={{ display: "flex", alignItems: "center", gap: 8 }} title={`${period}: ${n} item`}>
                    <span style={{ width: 130, flexShrink: 0, fontSize: 10, color: "var(--text2)", textAlign: "right", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{period}</span>
                    <div style={{ flex: 1, background: "var(--surface2)", borderRadius: 4, height: 16, position: "relative" }}>
                      <div style={{ width: `${Math.max(4, (n / deadlineMax) * 100)}%`, height: "100%", borderRadius: 4, background: adopActive.color }} />
                    </div>
                    <span style={{ width: 28, flexShrink: 0, fontSize: 10, fontWeight: 700, color: "var(--text)" }}>{n}</span>
                  </div>
                ))}
                {deadlineCounts.length > 15 && <p style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>+{deadlineCounts.length - 15} periode lain (nilainya kecil, disembunyiin biar chart nggak kepanjangan)</p>}
              </div>
            </div>
          )}

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: `3px solid ${adopActive.color}`, borderRadius: 12, overflow: "hidden" }}>
            <AdopTable rows={adopRows} columnOrder={adopFoundCols} docRefKey={adopDocRefKey} statusKey={adopStatusDevKey} />
          </div>
        </>
      ) : !error && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <DynamicTable rows={rows} columns={columns} />
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
