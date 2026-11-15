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

import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react"
import { RefreshCw, AlertCircle, Loader2, ExternalLink } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { isoWeekInfo, isoWeekStart, parseYearWeek } from "@/lib/isoWeek"
import { detectCompanies, findDriveFileForDoc, type DriveFile } from "@/lib/docMatch"
import type { DocRow as ReportDocRow, SubdistRow as ReportSubdistRow, PlanPilotReportData } from "@/lib/planPilotExcelTemplate"

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
// pageNameHint: dipakai kalau `matcher` bisa cocok ke LEBIH DARI 1
// table (mis. "semua-dokumen" cocok ke "List Monitoring 2/4/5/6/7/10/
// dst") — disambiguasi dengan ngecek page INDUK tiap table kandidat
// (field `parent.name` dari Coda, cuma kebaca lewat endpoint detail
// satuan) dan ambil yang page-nya mengandung teks ini (case-insensitive).
interface TabDef { key: string; label: string; matcher: (name: string) => boolean; richValues?: boolean; pageNameHint?: string }

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
  // "List Monitoring" cocok ke BELASAN table (2/4/5/6/7/10/Afif/APPS/
  // dst) — pageNameHint "yona" buat disambiguasi, dikonfirmasi user
  // page-nya namanya "Yona Monitoring Doc".
  { key: "semua-dokumen", label: "Semua Dokumen", matcher: n => n.trim().toLowerCase().startsWith("list monitoring"), pageNameHint: "yona" },
]

// Grouping Plan Pilot by "User"/"User Request" DIBUANG — 1 batch
// "Plan Pilot" (mis. "Pilot Matrix 26.11.02") ternyata bisa nyampur
// beberapa User sekaligus (PHI + "ALL" dkk, ketauan dari screenshot
// user), jadi grouping per kategori bikin 1 batch kepecah nggak jelas
// ke beberapa tab. Sekarang Plan Pilot cuma 1 TABEL isi SEMUA baris,
// filter manual lewat dropdown "Plan Pilot" yang udah ada.
// Kolom yang ditampilin buat Plan Pilot — dicocokin lewat
// resolveColumns() (normKey-match, bukan exact) kayak ADOP, biar aman
// kalau nama kolom aslinya beda dikit format-nya.
const PLAN_PILOT_PREVIEW_COLS = ["Plan Pilot", "Doc. No.", "Doc. Name", "Release", "Task PIC 2", "DEV PIC", "BR PIC", "Status Dev", "Status Project"]

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

// Generate teks ringkasan siap-paste (diminta user, formatnya persis
// contoh yang dikasih) — Doc. Name di-group per Status Dev. Doc. Name
// di data udah termasuk kode dokumennya sendiri (mis. "S26-132-WMD_..."),
// jadi nggak perlu digabung manual sama Doc. No. lagi.
function buildReportText(batchName: string, rows: CodaRowItem[]): string {
  const order: string[] = []
  const groups = new Map<string, string[]>()
  for (const r of rows) {
    const status = getFieldValue(r.values, "Status Dev").trim() || "(Tanpa Status)"
    const docName = getFieldValue(r.values, "Doc. Name").trim() || getFieldValue(r.values, "Doc. No.").trim() || "(tanpa nama)"
    if (!groups.has(status)) { groups.set(status, []); order.push(status) }
    groups.get(status)!.push(docName)
  }
  order.sort((a, b) => groups.get(b)!.length - groups.get(a)!.length)
  const lines = [`Berikut adalah plan release ${batchName} dengan status sebagai berikut`]
  for (const status of order) {
    lines.push(`${status}:`)
    for (const d of groups.get(status)!) lines.push(`- ${d}`)
  }
  return lines.join("\n")
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
// "Udah kelar" kalau masuk bucket pertama statusColor() di atas (ijo) —
// dipakai buat nentuin apakah masih relevan dicek telat/nggaknya (item
// yang udah DONE/RELEASE/PILOT nggak perlu diingetin lagi).
function isDoneStatusText(v: string): boolean {
  const s = v.trim().toUpperCase()
  return s.includes("READY") || s.includes("DONE") || s.includes("RELEASE") || s.includes("PILOT")
}

// Reminder "sprint telat" ADOP (diminta user, berdasarkan Operation
// Calendar Mayora Group yang nomor minggunya SAMA PERSIS sama ISO 8601
// — lihat src/lib/isoWeek.ts) — value Submit/Review/Dev/Test Sprint
// formatnya "2026.45" dkk (tahun.minggu); kalau minggu itu udah lewat
// (hari ini > Minggu/akhir minggu tsb), dianggap telat.
const ADOP_SPRINT_COL_NAMES = ["Submit Sprint", "Review Sprint", "Dev Sprint", "Test Sprint"]
function isSprintColumn(c: string): boolean {
  return ADOP_SPRINT_COL_NAMES.some(n => normKey(n) === normKey(c))
}
// "overdue" = minggunya udah LEWAT (merah) — "due-soon" = masih
// minggu INI juga (mepet, belum lewat) tapi dikasih warna beda
// (oranye) biar kebedain, diminta user. "upcoming" = minggu DEPAN
// (masih 1 minggu lagi, tapi udah deket — "mepet", diminta user biar
// ada peringatan juga sebelum due-soon). Selain itu (masih 2+ minggu
// lagi) dianggap aman, null.
function sprintOverdueInfo(value: string): { status: "overdue" | "due-soon" | "upcoming"; weekEndLabel: string } | null {
  const yw = parseYearWeek(value)
  if (!yw) return null
  const start = isoWeekStart(yw.year, yw.week)
  const weekEnd = new Date(start)
  weekEnd.setDate(start.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  const weekEndLabel = weekEnd.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
  const now = new Date()
  if (now > weekEnd) return { status: "overdue", weekEndLabel }
  const cur = isoWeekInfo(now)
  const curStart = isoWeekStart(cur.year, cur.week)
  // Selisih minggu dihitung dari jarak hari antar awal-minggu (bukan
  // bandingin {year,week} langsung) biar aman nyebrang pergantian
  // tahun (mis. minggu 52 2026 ke minggu 1 2027).
  const weeksAhead = Math.round((start.getTime() - curStart.getTime()) / (7 * 86400000))
  if (weeksAhead <= 0) return { status: "due-soon", weekEndLabel }
  if (weeksAhead === 1) return { status: "upcoming", weekEndLabel }
  return null
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
// Widget "hari ini tanggal berapa, week berapa" — diminta user KHUSUS
// buat page CODA (bukan semua halaman dashboard). Dihitung client-side
// di useEffect biar nggak mismatch hydration jam server vs browser.
function DayWeekBadge() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])
  if (!now) return null
  const { week } = isoWeekInfo(now)
  const dayName = now.toLocaleDateString("id-ID", { weekday: "long" })
  const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 999, background: "linear-gradient(135deg,#0E4D64,#0891B2)", alignSelf: "flex-start" }}>
      <span style={{ fontSize: 15 }}>📅</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: "white", whiteSpace: "nowrap" }}>{dayName}, {dateStr}</span>
      <span style={{ fontSize: 10, fontWeight: 800, color: "#0891B2", background: "white", padding: "2px 8px", borderRadius: 999 }}>Week {week}</span>
    </div>
  )
}

function SortableHeader({ label, col, sortCol, sortDir, onSort }: { label: string; col: string; sortCol: string | null; sortDir: SortDir; onSort: (col: string) => void }) {
  const active = sortCol === col
  return (
    <th onClick={() => onSort(col)} style={{ padding: "8px 10px", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", color: active ? "var(--text)" : "var(--text3)" }}>
      {label} <span style={{ opacity: active ? 1 : 0.35 }}>{active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  )
}

// Chart breakdown status — vertical bar, rounded, warna dari
// statusColor() yang sama dipakai badge status di tabel (biar identitas
// warnanya konsisten, bukan skema warna baru). Label count+persen DI
// ATAS tiap bar + nama status di bawahnya (direct label, nggak perlu
// legend terpisah). Dipakai bareng Plan Pilot & ADOP (diminta user).
function StatusBarChart({ title, subtitle, data }: { title: string; subtitle?: string; data: { status: string; n: number }[] }) {
  if (data.length === 0) return null
  const max = Math.max(1, ...data.map(d => d.n))
  const total = data.reduce((s, d) => s + d.n, 0) || 1
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text)" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 14 }}>{subtitle}</div>}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150, paddingTop: 22, overflowX: "auto" }}>
        {data.map(({ status, n }) => {
          const sc = statusColor(status)
          const pct = (n / total) * 100
          const h = Math.max(6, (n / max) * 100)
          return (
            <div key={status} title={`${status}: ${n} baris (${pct.toFixed(1)}%)`}
              style={{ flex: "1 0 54px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 54 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: "var(--text)" }}>{n}</span>
              <div style={{
                width: "100%", maxWidth: 46, height: h, borderRadius: "10px 10px 3px 3px",
                background: `linear-gradient(180deg, ${sc.fg}, ${sc.fg}B3)`,
                boxShadow: `0 6px 12px -4px ${sc.fg}66`,
                transition: "height 0.35s cubic-bezier(0.22,1,0.36,1)",
              }} />
              <span style={{ fontSize: 9, color: "var(--text3)", textAlign: "center", lineHeight: 1.25, wordBreak: "break-word" }}>{status}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: sc.fg }}>{pct.toFixed(0)}%</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DynamicTable({ rows, columns, driveLookup, driveLookupCol }: {
  rows: CodaRowItem[]; columns: string[]
  // Opsional — cuma dipake Plan Pilot buat nampilin tombol "Lihat
  // Dokumen" (diminta user, sama kayak ADOP). driveLookup dipanggil per
  // baris, balikin file Drive yang cocok (atau null kalau nggak ketemu);
  // ikonnya ditaruh nempel di kolom `driveLookupCol`.
  driveLookup?: (row: CodaRowItem) => DriveFile | null
  driveLookupCol?: string
}) {
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
          {sortedRows.map(r => {
            const driveFile = driveLookup ? driveLookup(r) : null
            return (
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
                  return (
                    <td key={c} style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>
                      {rawText}
                      {driveLookupCol && normKey(c) === normKey(driveLookupCol) && driveFile && <DriveLinkIcon file={driveFile} />}
                    </td>
                  )
                })}
              </tr>
            )
          })}
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
function DriveLinkIcon({ file }: { file: DriveFile }) {
  return (
    <a href={file.webViewLink} target="_blank" rel="noopener noreferrer" title={`Buka di Drive: ${file.name}`}
      style={{ display: "inline-flex", alignItems: "center", marginLeft: 5, color: "#1D4ED8", verticalAlign: "middle", flexShrink: 0 }}>
      <ExternalLink size={12} />
    </a>
  )
}

function AdopTable({ rows, columnOrder, docRefKey, statusKey, companyFiles }: {
  rows: CodaRowItem[]; columnOrder: string[]; docRefKey?: string; statusKey?: string; companyFiles: DriveFile[]
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
    // Masih "aktif" (belum semua doc-nya DONE/RELEASE/PILOT) — reminder
    // telat cuma relevan buat baris yang masih ada kerjaan jalan. PENTING:
    // kalau Doc. Ref.-nya KOSONG (docs.length === 0, nggak ada 1 pun doc
    // yang ke-track), itu BUKAN berarti "udah selesai semua" — nggak ada
    // yang bisa dicek, jadi default-nya tetep dianggap pending (biar
    // reminder sprint tetep nyala). Ketauan dari bug: baris tanpa Doc.
    // Ref. sama sekali nggak pernah dapet reminder apapun walau sprint-nya
    // udah deket/lewat, padahal sprint-nya sendiri tetep berjalan di
    // level baris (independen dari ada/nggaknya sub-item Doc. Ref.).
    const hasPending = docs.length === 0 || pairs.some(p => p.status && !isDoneStatusText(p.status))
    return { r, n, pairs, hasPending }
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
            <div key={`d-${recIdx}-${j}`} style={{ ...cellBase, whiteSpace: "normal", gridColumn: col, gridRow: rowStart + j, color: "var(--text2)", borderBottom: bb, borderRight: "1px solid var(--border)", overflowWrap: "break-word" }}>
              {p.doc}
              {(() => { const f = findDriveFileForDoc(companyFiles, p.doc); return f ? <DriveLinkIcon file={f} /> : null })()}
            </div>
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
        // Reminder sprint telat — cuma dicek buat kolom Submit/Review/
        // Dev/Test Sprint, cuma kalau baris ini masih ada doc yang
        // belum kelar (hasPending), biar item yang udah DONE nggak
        // terus-terusan "diingetin telat" walau emang udah lewat.
        const overdueInfo = isSprintColumn(s.col) && rec.hasPending && rawText !== "—" ? sprintOverdueInfo(rawText) : null
        let content: ReactNode = rawText
        let cellStyle: CSSProperties = {}
        if (overdueInfo?.status === "overdue") {
          content = <span title={`Harusnya kelar ${overdueInfo.weekEndLabel} — udah lewat`} style={{ display: "flex", alignItems: "center", gap: 4, color: "#991B1B", fontWeight: 700 }}>⚠️ {rawText}</span>
          cellStyle = { background: "#FEE2E2" }
        } else if (overdueInfo?.status === "due-soon") {
          content = <span title={`Harus kelar ${overdueInfo.weekEndLabel} — minggu ini!`} style={{ display: "flex", alignItems: "center", gap: 4, color: "#92400E", fontWeight: 700 }}>⏰ {rawText}</span>
          cellStyle = { background: "#FEF3C7" }
        } else if (overdueInfo?.status === "upcoming") {
          content = <span title={`Harus kelar ${overdueInfo.weekEndLabel} — minggu depan, mulai disiapin`} style={{ display: "flex", alignItems: "center", gap: 4, color: "#1E40AF", fontWeight: 700 }}>🔔 {rawText}</span>
          cellStyle = { background: "#DBEAFE" }
        } else if (isStatusColumn(s.col) && rawText !== "—") {
          const { bg, fg } = statusColor(rawText)
          content = <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color: fg }}>{rawText}</span>
        }
        bodyCells.push(
          <div key={`p-${recIdx}-${slotIdx}`} style={{ ...cellBase, ...cellStyle, gridColumn: col, gridRow: `${rowStart} / span ${rec.n}`, color: "var(--text2)", display: "flex", alignItems: "center", borderRight: "1px solid var(--border)" }}>{content}</div>
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

// Dropdown dengan kotak search — dibutuhin buat "Plan Pilot" karena
// sekarang nampilin SEMUA baris (grouping dibuang), opsinya bisa puluhan
// batch sekaligus, <select> polos jadi kepanjangan buat di-scroll.
function SearchableSelect({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder: string }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const filtered = query ? options.filter(o => o.toLowerCase().includes(query.toLowerCase())) : options
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => { setOpen(o => !o); setQuery("") }}
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: value ? "var(--text)" : "var(--text3)", fontSize: 12, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>
        {value || placeholder}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 998 }} />
          <div style={{ position: "absolute", top: "110%", left: 0, right: 0, zIndex: 999, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: 6, maxHeight: 320, display: "flex", flexDirection: "column", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari..."
              style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 11, fontFamily: "inherit", marginBottom: 4, outline: "none" }} />
            <div style={{ overflowY: "auto", maxHeight: 250 }}>
              <div onClick={() => { onChange(""); setOpen(false) }}
                style={{ padding: "6px 8px", fontSize: 11, color: "var(--text3)", cursor: "pointer", borderRadius: 4 }}>— Semua —</div>
              {filtered.map(o => (
                <div key={o} onClick={() => { onChange(o); setOpen(false) }}
                  style={{ padding: "6px 8px", fontSize: 11, color: o === value ? "#0891B2" : "var(--text2)", fontWeight: o === value ? 700 : 400, cursor: "pointer", borderRadius: 4, background: o === value ? "#0891B21A" : undefined }}>
                  {o}
                </div>
              ))}
              {filtered.length === 0 && <div style={{ padding: "6px 8px", fontSize: 11, color: "var(--text3)" }}>Nggak ketemu.</div>}
            </div>
          </div>
        </>
      )}
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

// Fetch parent page suatu table (cuma kebaca lewat endpoint detail
// satuan, bukan /tables list) — dipakai buat disambiguasi kalau
// `matcher` cocok ke lebih dari 1 table.
async function pageNameOfTable(docId: string, tableId: string): Promise<string> {
  try {
    const res = await fetch(`/api/superhuman-docs/table-detail?docId=${encodeURIComponent(docId)}&tableId=${encodeURIComponent(tableId)}`).then(r => r.json())
    return (res?.parent?.name as string | undefined) || ""
  } catch {
    return ""
  }
}

// Dari SEMUA kandidat yang cocok matcher, pilih satu: kalau cuma 1
// kandidat ya itu aja (nggak perlu cek apa-apa lagi, hemat request);
// kalau lebih dari 1, cek page induk tiap kandidat SATU-SATU, ambil
// yang page-nya mengandung `pageNameHint`. Nggak ketemu yang cocok ->
// fallback ke kandidat pertama (lebih baik salah satu daripada error).
async function pickBestMatch(docId: string, candidates: CodaTableItem[], pageNameHint?: string): Promise<CodaTableItem | null> {
  if (candidates.length === 0) return null
  if (candidates.length === 1 || !pageNameHint) return candidates[0]
  for (const c of candidates) {
    const pageName = await pageNameOfTable(docId, c.id)
    if (pageName.toLowerCase().includes(pageNameHint.toLowerCase())) return c
  }
  return candidates[0]
}

async function findTable(matcher: (name: string) => boolean, fresh = false, pageNameHint?: string): Promise<TableLocation | null> {
  const f = fresh ? "&fresh=1" : ""
  const docsRes = await fetch(`/api/superhuman-docs/docs${fresh ? "?fresh=1" : ""}`).then(r => r.json())
  if (docsRes.error) throw new Error(docsRes.error)
  const allDocs = (docsRes.items || []) as CodaDocItem[]

  const knownDoc = allDocs.find(d => d.id === KNOWN_DOC_ID)
  if (knownDoc) {
    const tablesRes = await fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(knownDoc.id)}${f}`).then(r => r.json())
    if (!tablesRes.error) {
      const candidates = ((tablesRes.items || []) as CodaTableItem[]).filter(t => matcher(t.name))
      const match = await pickBestMatch(knownDoc.id, candidates, pageNameHint)
      if (match) return resolveLocation(knownDoc.id, knownDoc.name, match, fresh)
    }
  }

  for (const d of allDocs) {
    if (d.id === KNOWN_DOC_ID) continue
    const tablesRes = await fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(d.id)}${f}`).then(r => r.json())
    if (tablesRes.error) continue
    const candidates = ((tablesRes.items || []) as CodaTableItem[]).filter(t => matcher(t.name))
    const match = await pickBestMatch(d.id, candidates, pageNameHint)
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
  const [planPilotReportText, setPlanPilotReportText] = useState<string | null>(null)
  // Popup "Form Release (Excel)" — data di sini SELALU diprefill dari
  // Coda (lihat openReportExcelModal), tapi semuanya EDITABLE sebelum
  // di-generate (diminta user: "saya bisa edit valuenya terus klik
  // generate"). Field yang nggak ada sumbernya di Coda (Kode/Nama
  // Subdist, tanda tangan) dibiarin kosong buat diisi manual.
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportGenerating, setReportGenerating] = useState(false)
  const [reportReleaseName, setReportReleaseName] = useState("")
  const [reportSubdist, setReportSubdist] = useState<ReportSubdistRow[]>([])
  const [reportDocs, setReportDocs] = useState<ReportDocRow[]>([])
  const [reportSignatures, setReportSignatures] = useState({ mengajukan: "", mengCompile: "", mengetahui: "", menyetujui: "" })
  const [adopSubTab, setAdopSubTab] = useState(ADOP_CATEGORIES[0].key)
  // Default difokusin ke periode yang lagi berjalan/mendatang (diminta
  // user) — array kosong = "semua" (nggak difilter). Perlu di-update
  // manual kalau periode "berjalan" ini udah lewat (mis. ganti ke
  // 2027.Q1 dkk pas waktunya).
  const [adopTimelineFilter, setAdopTimelineFilter] = useState<string[]>(["2026.Q4", "2026.Q4.BE", "2026.X"])
  const [adopSprintFilter, setAdopSprintFilter] = useState("")
  // Daftar file Drive per perusahaan (PHI/HSJ/SCP/MT) — dipakai buat
  // tombol "Lihat Dokumen" di ADOP & Plan Pilot (diminta user: muncul
  // CUMA kalau filenya ketemu). Di-fetch 1x aja pas halaman dibuka
  // (di-cache 10 menit di server, lihat src/lib/googleDrive.ts), bukan
  // per-baris per-render.
  const [driveFiles, setDriveFiles] = useState<Record<string, DriveFile[]>>({})
  useEffect(() => {
    fetch("/api/coda/drive-docs")
      .then(r => r.json())
      .then(d => {
        if (d.files) setDriveFiles(d.files)
        // Diagnostik — kalau GOOGLE_SERVICE_ACCOUNT_KEY belum/salah
        // setting di hosting, errornya kebaca di sini (console browser),
        // bukan ditelan diam-diam kayak sebelumnya.
        else console.error("[CODA] Gagal ambil daftar file Drive:", d.error)
      })
      .catch(e => console.error("[CODA] Gagal fetch /api/coda/drive-docs:", e))
  }, [])

  useEffect(() => { loadTab(activeTab) }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTab(tabKey: string, force = false) {
    if (!force && (rowsByTab[tabKey] || loading[tabKey])) return
    const tab = TABS.find(t => t.key === tabKey)!
    setLoading(l => ({ ...l, [tabKey]: true }))
    setErrorByTab(er => ({ ...er, [tabKey]: "" }))
    try {
      let loc = located[tabKey]
      if (!loc || force) {
        loc = await findTable(tab.matcher, force, tab.pageNameHint)
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

  const tab = TABS.find(t => t.key === activeTab)!
  const rows = rowsByTab[activeTab] || []
  const loc = located[activeTab]
  const isLoading = loading[activeTab]
  const error = errorByTab[activeTab]

  const columns = collectColumns(rows)

  // Khusus tab Plan Pilot: SATU tabel isi semua baris (grouping by
  // User/User Request DIBUANG, lihat catatan di PLAN_PILOT_PREVIEW_COLS),
  // cuma difilter dropdown "Plan Pilot" (opsinya dari SEMUA baris, bisa
  // di-search lewat SearchableSelect — jumlah batch bisa banyak banget
  // sekarang nggak ada grouping kategori lagi).
  const planPilotAllRows = activeTab === "plan-pilot" ? rows : []
  const planPilotOptions = Array.from(new Set(planPilotAllRows.map(r => getFieldValue(r.values, "Plan Pilot")).filter(Boolean))).sort()
  const planPilotRows = planPilotFilter ? planPilotAllRows.filter(r => getFieldValue(r.values, "Plan Pilot") === planPilotFilter) : planPilotAllRows
  // Tombol "Lihat Dokumen" Plan Pilot (sama kayak ADOP, diminta user) —
  // beda dari ADOP, 1 batch Plan Pilot bisa nyampur beberapa User
  // sekaligus ("PHI + ALL" dkk), jadi SEMUA perusahaan yang disebut di
  // "User Request" dicoba, bukan exact-match 1 nilai.
  const planPilotDriveLookup = (row: CodaRowItem): DriveFile | null => {
    const userField = getFieldValue(row.values, "User Request") || getFieldValue(row.values, "User")
    const docText = `${getFieldValue(row.values, "Doc. No.")} ${getFieldValue(row.values, "Doc. Name")}`
    for (const c of detectCompanies(userField)) {
      const match = findDriveFileForDoc(driveFiles[c] || [], docText)
      if (match) return match
    }
    return null
  }
  const { found: planPilotFoundCols, missing: planPilotMissingColumns } = activeTab === "plan-pilot" ? resolveColumns(planPilotRows, PLAN_PILOT_PREVIEW_COLS) : { found: [], missing: [] }

  // Prefill popup "Form Release (Excel)" dari baris Plan Pilot yang
  // lagi difilter — "modul"/"testBy" nebak dari kolom "Application"/
  // "Testing PIC 1" (nama kolom asli di Coda, dari dropdown filter yang
  // pernah user tunjukin), "status" default "OK" (sama kayak contoh
  // Excel asli). SEMUA field ini tetap bisa diedit user di popup
  // sebelum generate, jadi kalau tebakannya meleset user bisa benerin.
  function openReportExcelModal() {
    setReportReleaseName(planPilotFilter)
    setReportDocs(planPilotRows.map((r, i) => ({
      no: i + 1,
      modul: getFieldValue(r.values, "Application"),
      docName: getFieldValue(r.values, "Doc. Name"),
      keterangan: "",
      onVersion: getFieldValue(r.values, "Plan Pilot") || planPilotFilter,
      reqBy: getFieldValue(r.values, "User"),
      testBy: getFieldValue(r.values, "Testing PIC 1"),
      status: "OK",
    })))
    setReportSubdist([{ no: 1, kodeSubdist: "", namaSubdist: "", keterangan: "", pilotBy: "" }])
    setReportSignatures({ mengajukan: "", mengCompile: "", mengetahui: "", menyetujui: "" })
    setReportModalOpen(true)
  }

  async function generateReportExcel() {
    setReportGenerating(true)
    try {
      const payload: PlanPilotReportData = { releaseName: reportReleaseName, subdist: reportSubdist, docs: reportDocs, signatures: reportSignatures }
      const res = await fetch("/api/coda/plan-pilot-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      if (!res.ok) {
        const e = await res.json().catch(() => ({}))
        throw new Error(e.error || "Gagal generate Excel")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Form_Request_Pilot_${reportReleaseName.replace(/[^\w.-]+/g, "_")}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      setReportModalOpen(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
    }
    setReportGenerating(false)
  }

  // Chart persentase per "Status Dev" (diminta user) — warna bar-nya
  // dicocokin ke statusColor() yang SAMA dipakai buat badge status di
  // tabel, biar konsisten (bukan skema warna baru). CUMA muncul kalau
  // user udah milih 1 batch Plan Pilot spesifik (diminta user) — nggak
  // berguna/terlalu berat buat ditampilin atas SEMUA ~9900 baris.
  const statusDevPercent = activeTab === "plan-pilot" && planPilotFilter ? (() => {
    const counts = new Map<string, number>()
    for (const r of planPilotRows) {
      const v = getFieldValue(r.values, "Status Dev").trim() || "(kosong)"
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n)
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

  // Chart breakdown Status Dev buat ADOP (diminta user, chart yang
  // sama kayak Plan Pilot) — "Status Dev" ADOP itu ARRAY per-doc
  // (paralel sama Doc. Ref., lihat toStatusArray), jadi dihitung per
  // ITEM dokumen, bukan per baris Coda (1 baris bisa punya banyak doc).
  const adopStatusDevPercent = activeTab === "adop" && adopStatusDevKey ? (() => {
    const counts = new Map<string, number>()
    for (const r of adopRows) {
      const statuses = toStatusArray(r.values?.[adopStatusDevKey])
      for (const s of statuses) {
        const v = cellItemText(s).trim() || "(kosong)"
        counts.set(v, (counts.get(v) || 0) + 1)
      }
    }
    return Array.from(counts.entries()).map(([status, n]) => ({ status, n })).sort((a, b) => b.n - a.n)
  })() : []

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>
      <MotivationBanner page="docreq" />
      <DayWeekBadge />

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

      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
        <button onClick={() => loadTab(activeTab, true)} disabled={isLoading}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 11, color: "var(--text2)", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
          {isLoading ? <Loader2 size={12} style={{ animation: "spin 0.8s linear infinite" }} /> : <RefreshCw size={12} />} Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#991B1B", display: "flex", alignItems: "flex-start", gap: 8 }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {isLoading ? (
        <p style={{ fontSize: 12, color: "var(--text3)" }}>Memuat data {tab.label}...</p>
      ) : !error && activeTab === "plan-pilot" ? (
        // Tab Plan Pilot — 1 TABEL isi semua baris (grouping by User
        // dibuang, lihat catatan di PLAN_PILOT_PREVIEW_COLS), filter
        // searchable "Plan Pilot" + chart persentase Status Dev (cuma
        // muncul kalau udah difilter ke 1 batch).
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {planPilotOptions.length > 0 && (
              <div style={{ flex: 1 }}>
                <SearchableSelect value={planPilotFilter} onChange={setPlanPilotFilter} options={planPilotOptions}
                  placeholder={`— Semua Plan Pilot (${planPilotAllRows.length}) —`} />
              </div>
            )}
            <button onClick={() => setPlanPilotReportText(buildReportText(planPilotFilter, planPilotRows))}
              disabled={!planPilotFilter || planPilotRows.length === 0}
              style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: "none", background: planPilotFilter ? "var(--accent)" : "var(--surface2)", cursor: planPilotFilter ? "pointer" : "not-allowed", opacity: planPilotFilter ? 1 : 0.5, fontSize: 12, color: planPilotFilter ? "white" : "var(--text3)", fontFamily: "inherit", fontWeight: 700 }}>
              📋 Buat Report
            </button>
            <button onClick={openReportExcelModal}
              disabled={!planPilotFilter || planPilotRows.length === 0}
              style={{ flexShrink: 0, padding: "8px 14px", borderRadius: 8, border: "none", background: planPilotFilter ? "#16A34A" : "var(--surface2)", cursor: planPilotFilter ? "pointer" : "not-allowed", opacity: planPilotFilter ? 1 : 0.5, fontSize: 12, color: planPilotFilter ? "white" : "var(--text3)", fontFamily: "inherit", fontWeight: 700, whiteSpace: "nowrap" }}>
              📥 Form Release (Excel)
            </button>
          </div>

          {planPilotMissingColumns.length > 0 && (
            <p style={{ fontSize: 10, color: "#92400E", background: "#FEF3C7", borderRadius: 8, padding: "6px 10px" }}>
              Kolom nggak ketemu di data: {planPilotMissingColumns.join(", ")} — kemungkinan nama aslinya beda di table &quot;{loc?.tableName}&quot;.
            </p>
          )}

          <StatusBarChart title={`Breakdown Status Dev${planPilotFilter ? ` — ${planPilotFilter}` : ""}`} subtitle={`${planPilotRows.length} baris`} data={statusDevPercent} />

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
            <DynamicTable rows={planPilotRows} columns={planPilotFoundCols} driveLookup={planPilotDriveLookup} driveLookupCol="Doc. No." />
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

          <StatusBarChart title={`Breakdown Status Dev (${adopActive.label})`} subtitle={`${adopRows.length} baris`} data={adopStatusDevPercent} />

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: `3px solid ${adopActive.color}`, borderRadius: 12, overflow: "hidden" }}>
            <AdopTable rows={adopRows} columnOrder={adopFoundCols} docRefKey={adopDocRefKey} statusKey={adopStatusDevKey} companyFiles={driveFiles[adopActive.key.toUpperCase()] || []} />
          </div>
        </>
      ) : !error && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <DynamicTable rows={rows} columns={columns} />
        </div>
      )}

      {planPilotReportText !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          onClick={() => setPlanPilotReportText(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>📋 Report Plan Release</span>
              <button onClick={() => setPlanPilotReportText(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18 }}>✕</button>
            </div>
            <textarea readOnly value={planPilotReportText}
              style={{ flex: 1, padding: "14px 18px", fontSize: 12, color: "var(--text)", background: "var(--surface)", border: "none", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6, minHeight: 240 }} />
            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => navigator.clipboard.writeText(planPilotReportText)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Copy ke Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {reportModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          onClick={() => setReportModalOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 14, width: "100%", maxWidth: 1100, maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>📥 Form Release (Excel) — validasi dulu sebelum generate</span>
              <button onClick={() => setReportModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 18 }}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)" }}>Nama Release (judul form)</label>
                <input value={reportReleaseName} onChange={e => setReportReleaseName(e.target.value)}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Pilot Implementation (Subdist)</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--text3)", background: "var(--surface2)" }}>
                        <th style={{ padding: 6 }}>No</th><th style={{ padding: 6 }}>Kode Subdist</th><th style={{ padding: 6 }}>Nama Subdist</th><th style={{ padding: 6 }}>Keterangan</th><th style={{ padding: 6 }}>Pilot By</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {reportSubdist.map((s, i) => (
                        <tr key={i}>
                          <td style={{ padding: 4, textAlign: "center" }}>{s.no}</td>
                          {(["kodeSubdist", "namaSubdist", "keterangan", "pilotBy"] as const).map(f => (
                            <td key={f} style={{ padding: 4 }}>
                              <input value={s[f]} onChange={e => setReportSubdist(arr => arr.map((row, j) => j === i ? { ...row, [f]: e.target.value } : row))}
                                style={{ width: "100%", padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" }} />
                            </td>
                          ))}
                          <td style={{ padding: 4 }}>
                            <button onClick={() => setReportSubdist(arr => arr.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => setReportSubdist(arr => [...arr, { no: arr.length + 1, kodeSubdist: "", namaSubdist: "", keterangan: "", pilotBy: "" }])}
                  style={{ marginTop: 6, padding: "5px 10px", borderRadius: 6, border: "1px dashed var(--border)", background: "none", cursor: "pointer", fontSize: 10, color: "var(--text3)", fontFamily: "inherit" }}>
                  + Tambah baris subdist
                </button>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>List Dokumen ({reportDocs.length})</div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr style={{ textAlign: "left", color: "var(--text3)", background: "var(--surface2)" }}>
                        <th style={{ padding: 6 }}>No</th><th style={{ padding: 6, minWidth: 110 }}>Modul</th><th style={{ padding: 6, minWidth: 260 }}>No. DR/ST Nama Dokumen</th>
                        <th style={{ padding: 6, minWidth: 100 }}>Keterangan</th><th style={{ padding: 6, minWidth: 110 }}>On Version</th>
                        <th style={{ padding: 6 }}>Req By</th><th style={{ padding: 6, minWidth: 100 }}>Test By</th><th style={{ padding: 6 }}>Status</th><th />
                      </tr>
                    </thead>
                    <tbody>
                      {reportDocs.map((d, i) => (
                        <tr key={i}>
                          <td style={{ padding: 4, textAlign: "center" }}>{d.no}</td>
                          {(["modul", "docName", "keterangan", "onVersion", "reqBy", "testBy", "status"] as const).map(f => (
                            <td key={f} style={{ padding: 4 }}>
                              <input value={d[f]} onChange={e => setReportDocs(arr => arr.map((row, j) => j === i ? { ...row, [f]: e.target.value } : row))}
                                style={{ width: "100%", padding: "5px 7px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" }} />
                            </td>
                          ))}
                          <td style={{ padding: 4 }}>
                            <button onClick={() => setReportDocs(arr => arr.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#DC2626" }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => setReportDocs(arr => [...arr, { no: arr.length + 1, modul: "", docName: "", keterangan: "", onVersion: reportReleaseName, reqBy: "", testBy: "", status: "OK" }])}
                  style={{ marginTop: 6, padding: "5px 10px", borderRadius: 6, border: "1px dashed var(--border)", background: "none", cursor: "pointer", fontSize: 10, color: "var(--text3)", fontFamily: "inherit" }}>
                  + Tambah baris dokumen
                </button>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "var(--text)", marginBottom: 6 }}>Tanda Tangan</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 8 }}>
                  {([["mengajukan", "Mengajukan"], ["mengCompile", "Meng-compile"], ["mengetahui", "Mengetahui"], ["menyetujui", "Menyetujui"]] as const).map(([key, label]) => (
                    <div key={key}>
                      <label style={{ fontSize: 10, color: "var(--text3)" }}>{label}</label>
                      <input value={reportSignatures[key]} onChange={e => setReportSignatures(s => ({ ...s, [key]: e.target.value }))}
                        style={{ display: "block", width: "100%", marginTop: 3, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: 11, fontFamily: "inherit", boxSizing: "border-box" }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setReportModalOpen(false)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text2)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                Batal
              </button>
              <button onClick={generateReportExcel} disabled={reportGenerating || !reportReleaseName}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: "#16A34A", color: "white", fontSize: 12, fontWeight: 700, cursor: reportGenerating ? "default" : "pointer", opacity: reportGenerating ? 0.7 : 1, fontFamily: "inherit" }}>
                {reportGenerating ? "Generating..." : "Generate & Download"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
