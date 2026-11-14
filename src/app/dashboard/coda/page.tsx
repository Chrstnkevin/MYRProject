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

import { useEffect, useState } from "react"
import { RefreshCw, AlertCircle, Loader2, Maximize2, X } from "lucide-react"
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

interface TabDef { key: string; label: string; matcher: (name: string) => boolean }

// Nama table dicocokkan longgar (bukan exact match ketat) biar tetep
// jalan walau ada sedikit variasi penamaan di Coda-nya nanti.
const TABS: TabDef[] = [
  { key: "plan-pilot", label: "Plan Pilot", matcher: n => n.trim().toLowerCase() === "plan pilot" },
  { key: "adop", label: "ADOP", matcher: n => /adop/i.test(n) && /backlog/i.test(n) },
  { key: "semua-dokumen", label: "Semua Dokumen", matcher: n => n.trim().toLowerCase().startsWith("list monitoring") },
]

// Khusus tab "Plan Pilot" — dipecah jadi 4 panel berdasarkan kolom
// "User Request" (dikonfirmasi user), biar kebaca sekaligus dalam 1 layar
// tanpa perlu scroll nyari. "HSJ / PGD" digabung jadi 1 panel sesuai
// permintaan (tetap 4 panel total, bukan 5).
const PLAN_PILOT_CATEGORIES: { key: string; label: string; match: (v: string) => boolean; color: string }[] = [
  { key: "phi", label: "PHI", match: v => v.trim().toUpperCase() === "PHI", color: "#DC2626" },
  { key: "hsj-pgd", label: "HSJ / PGD", match: v => ["HSJ", "PGD"].includes(v.trim().toUpperCase()), color: "#7C3AED" },
  { key: "mt", label: "MT", match: v => v.trim().toUpperCase() === "MT", color: "#0891B2" },
  // Nilai asli di data itu "SCP", bukan "SC" persis (ketauan dari panel
  // diagnostik nilai lain) - makanya sebelumnya selalu 0.
  { key: "sc", label: "SC", match: v => v.trim().toUpperCase() === "SCP", color: "#16A34A" },
]
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
// Urutan kolom sprint yang diminta user (Submit->Review->Dev->Test) —
// raw API Coda ngasih kolom dalam urutan nggak tentu, jadi dipaksa rapi.
const ADOP_SPRINT_ORDER = ["Submit Sprint", "Review Sprint", "Dev Sprint", "Test Sprint"]

// Taruh kolom-kolom di `priority` (yang beneran ADA di `columns`) jadi
// satu kelompok berurutan persis sesuai urutan `priority`, posisinya di
// tempat kemunculan PERTAMA salah satu dari mereka di `columns` asli.
// Kolom lain di luar `priority` tetap di urutan aslinya.
function reorderColumns(columns: string[], priority: string[]): string[] {
  const priorityNorm = priority.map(normKey)
  const isPriority = (c: string) => priorityNorm.includes(normKey(c))
  const result: string[] = []
  let inserted = false
  for (const c of columns) {
    if (isPriority(c)) {
      if (!inserted) {
        for (const p of priority) {
          const match = columns.find(col => normKey(col) === normKey(p))
          if (match) result.push(match)
        }
        inserted = true
      }
      continue
    }
    result.push(c)
  }
  return result
}

function fmtCell(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
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
function getFieldValue(values: Record<string, unknown>, fieldName: string): string {
  const target = normKey(fieldName)
  for (const [k, v] of Object.entries(values)) {
    if (normKey(k) === target) return v == null ? "" : String(v)
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

function DynamicTable({ rows, columns }: { rows: CodaRowItem[]; columns: string[] }) {
  if (rows.length === 0) return <p style={{ fontSize: 12, color: "var(--text3)", padding: 20 }}>Nggak ada data.</p>
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
            {columns.map(c => <th key={c} style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
              {columns.map(c => {
                const raw = r.values?.[c]
                if (isStatusColumn(c) && raw != null && String(raw).trim() !== "") {
                  const { bg, fg } = statusColor(String(raw))
                  return (
                    <td key={c} style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color: fg }}>{fmtCell(raw)}</span>
                    </td>
                  )
                }
                return <td key={c} style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>{fmtCell(raw)}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
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
// (lihat catatan viaViewName di TableLocation soal kenapa).
function resolveLocation(docId: string, docName: string, match: CodaTableItem): TableLocation {
  if (match.tableType === "view" && match.parentTable?.id) {
    return {
      docId, docName,
      tableId: match.parentTable.id,
      tableName: match.parentTable.name || match.parentTable.id,
      viaViewName: match.name,
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
      if (match) return resolveLocation(knownDoc.id, knownDoc.name, match)
    }
  }

  for (const d of allDocs) {
    if (d.id === KNOWN_DOC_ID) continue
    const tablesRes = await fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(d.id)}${f}`).then(r => r.json())
    if (tablesRes.error) continue
    const match = ((tablesRes.items || []) as CodaTableItem[]).find(t => matcher(t.name))
    if (match) return resolveLocation(d.id, d.name, match)
  }
  return null
}

export default function CodaPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const [located, setLocated] = useState<Record<string, TableLocation | null>>({})
  const [rowsByTab, setRowsByTab] = useState<Record<string, CodaRowItem[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errorByTab, setErrorByTab] = useState<Record<string, string>>({})
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  // Filter dropdown "Plan Pilot" PER panel — key = category key, value =
  // nilai kolom "Plan Pilot" yang dipilih ("" = semua, nggak difilter).
  const [planPilotFilter, setPlanPilotFilter] = useState<Record<string, string>>({})
  const [adopSubTab, setAdopSubTab] = useState(ADOP_CATEGORIES[0].key)
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
      const res = await fetch(`/api/superhuman-docs/rows?docId=${encodeURIComponent(loc.docId)}&tableId=${encodeURIComponent(loc.tableId)}${force ? "&fresh=1" : ""}`).then(r => r.json())
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

  // Khusus tab Plan Pilot: pecah rows jadi 4 kategori berdasarkan "User
  // Request". Dihitung tiap render (bukan state terpisah) biar selalu
  // sinkron sama rowsByTab tanpa perlu useEffect tambahan.
  const categorized = activeTab === "plan-pilot"
    ? PLAN_PILOT_CATEGORIES.map(cat => {
        const allRows = rows.filter(r => cat.match(getFieldValue(r.values, "User Request")))
        const planPilotOptions = Array.from(new Set(allRows.map(r => getFieldValue(r.values, "Plan Pilot")).filter(Boolean))).sort()
        const selected = planPilotFilter[cat.key] || ""
        const filteredRows = selected ? allRows.filter(r => getFieldValue(r.values, "Plan Pilot") === selected) : allRows
        return { ...cat, rows: filteredRows, totalCount: allRows.length, planPilotOptions, selected }
      })
    : null
  const expandedCat = categorized?.find(c => c.key === expandedCategory) || null

  // Diagnostik: baris yang User Request-nya BUKAN salah satu dari 4
  // kategori — biar kelihatan jelas kenapa jumlah per-kategori sedikit
  // (apakah emang mayoritas data punya User Request lain, atau ada
  // variasi penulisan yang kelewat kecocokannya, mis. "Phi " vs "PHI").
  const otherValueCounts = categorized ? (() => {
    const counts = new Map<string, number>()
    for (const r of rows) {
      const v = getFieldValue(r.values, "User Request").trim()
      const isCategorized = PLAN_PILOT_CATEGORIES.some(cat => cat.match(v))
      if (!isCategorized) {
        const key = v || "(kosong)"
        counts.set(key, (counts.get(key) || 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  })() : []

  // Khusus tab ADOP: filter ke sub-tab (User) yang aktif, urutin baris
  // by KPI dulu baru Request, kolom sprint dirapihin urutannya.
  const adopActive = ADOP_CATEGORIES.find(c => c.key === adopSubTab)!
  const adopRows = activeTab === "adop"
    ? rows
        .filter(r => adopActive.match(getFieldValue(r.values, "User")))
        .sort((a, b) => {
          const ka = getFieldValue(a.values, "KPI"), kb = getFieldValue(b.values, "KPI")
          if (ka !== kb) return ka.localeCompare(kb)
          return getFieldValue(a.values, "Request").localeCompare(getFieldValue(b.values, "Request"))
        })
    : []
  const adopColumns = activeTab === "adop" ? reorderColumns(collectColumns(adopRows), ADOP_SPRINT_ORDER) : []

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>
      <MotivationBanner page="docreq" />

      <div style={{ background: "linear-gradient(135deg,#0E4D64,#0891B2)", borderRadius: 14, padding: "18px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📋</div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 3 }}>CODA</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Monitoring Plan Pilot, ADOP & semua dokumen — langsung tanpa pilih Doc/Table manual</p>
          </div>
        </div>
      </div>

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
      ) : !error && categorized ? (
        // Tab Plan Pilot — 4 panel sekaligus dalam 1 layar, masing-masing
        // bisa di-expand buat lihat full table-nya.
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px,1fr))", gap: 12 }}>
          {categorized.map(cat => (
            <div key={cat.key} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: `3px solid ${cat.color}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: cat.color, flexShrink: 0 }} />
                  {cat.label}
                  <span style={{ padding: "1px 7px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: cat.color + "1A", color: cat.color, flexShrink: 0 }}>
                    {cat.rows.length}{cat.selected ? ` / ${cat.totalCount}` : ""}
                  </span>
                </span>
                <button onClick={() => setExpandedCategory(cat.key)} title="Expand"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", flexShrink: 0 }}>
                  <Maximize2 size={13} />
                </button>
              </div>
              {cat.planPilotOptions.length > 0 && (
                <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--border)" }}>
                  <select value={cat.selected} onChange={e => setPlanPilotFilter(f => ({ ...f, [cat.key]: e.target.value }))}
                    style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 10, fontFamily: "inherit" }}>
                    <option value="">— Semua Plan Pilot ({cat.totalCount}) —</option>
                    {cat.planPilotOptions.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}
              <DynamicTable rows={cat.rows.slice(0, 6)} columns={PREVIEW_COLS} />
              {cat.rows.length > 6 && (
                <button onClick={() => setExpandedCategory(cat.key)}
                  style={{ width: "100%", padding: "8px", border: "none", borderTop: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 10, color: cat.color, fontWeight: 700 }}>
                  Lihat semua {cat.rows.length} baris →
                </button>
              )}
            </div>
          ))}
          {otherValueCounts.length > 0 && (
            <div style={{ gridColumn: "1/-1", background: "var(--surface)", border: "1px dashed var(--border)", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", marginBottom: 6 }}>
                {otherValueCounts.reduce((s, [, n]) => s + n, 0)} baris lain dengan &quot;User Request&quot; di luar PHI/HSJ/PGD/MT/SC:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {otherValueCounts.slice(0, 15).map(([val, n]) => (
                  <span key={val} style={{ padding: "3px 9px", borderRadius: 999, fontSize: 10, background: "var(--surface2)", color: "var(--text2)" }}>{val} ({n})</span>
                ))}
                {otherValueCounts.length > 15 && <span style={{ fontSize: 10, color: "var(--text3)", alignSelf: "center" }}>+{otherValueCounts.length - 15} nilai lain</span>}
              </div>
            </div>
          )}
        </div>
      ) : !error && activeTab === "adop" ? (
        // Tab ADOP — 4 TAB terpisah (User: PHI/SCP/HSJ/MT), beda dari
        // Plan Pilot yang 4 panel sejajar. Baris diurutin KPI->Request,
        // kolom sprint dirapihin Submit->Review->Dev->Test.
        <>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ADOP_CATEGORIES.map(c => (
              <button key={c.key} onClick={() => setAdopSubTab(c.key)}
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
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderTop: `3px solid ${adopActive.color}`, borderRadius: 12, overflow: "hidden" }}>
            <DynamicTable rows={adopRows} columns={adopColumns} />
          </div>
        </>
      ) : !error && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <DynamicTable rows={rows} columns={columns} />
        </div>
      )}

      {expandedCat && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}
          onClick={() => setExpandedCategory(null)}>
          <div onClick={e => e.stopPropagation()} style={{ background: "var(--surface)", borderRadius: 14, width: "100%", maxWidth: 1100, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>{expandedCat.label} — {expandedCat.rows.length} baris</span>
              <button onClick={() => setExpandedCategory(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: "auto" }}>
              <DynamicTable rows={expandedCat.rows} columns={collectColumns(expandedCat.rows)} />
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
