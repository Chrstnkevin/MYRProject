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
import { RefreshCw, AlertCircle, Loader2 } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

interface CodaDocItem { id: string; name: string }
interface CodaTableItem { id: string; name: string }
interface CodaRowItem { id: string; name?: string; values: Record<string, unknown> }
interface TableLocation { docId: string; docName: string; tableId: string; tableName: string }

interface TabDef { key: string; label: string; matcher: (name: string) => boolean }

// Nama table dicocokkan longgar (bukan exact match ketat) biar tetep
// jalan walau ada sedikit variasi penamaan di Coda-nya nanti.
const TABS: TabDef[] = [
  { key: "plan-pilot", label: "Plan Pilot", matcher: n => n.trim().toLowerCase() === "plan pilot" },
  { key: "adop", label: "ADOP", matcher: n => /adop/i.test(n) && /backlog/i.test(n) },
  { key: "semua-dokumen", label: "Semua Dokumen", matcher: n => n.trim().toLowerCase().startsWith("list monitoring") },
]

function fmtCell(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

async function findTable(matcher: (name: string) => boolean): Promise<TableLocation | null> {
  const docsRes = await fetch("/api/superhuman-docs/docs").then(r => r.json())
  if (docsRes.error) throw new Error(docsRes.error)
  for (const d of (docsRes.items || []) as CodaDocItem[]) {
    const tablesRes = await fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(d.id)}`).then(r => r.json())
    if (tablesRes.error) continue
    const match = ((tablesRes.items || []) as CodaTableItem[]).find(t => matcher(t.name))
    if (match) return { docId: d.id, docName: d.name, tableId: match.id, tableName: match.name }
  }
  return null
}

export default function CodaPage() {
  const [activeTab, setActiveTab] = useState(TABS[0].key)
  const [located, setLocated] = useState<Record<string, TableLocation | null>>({})
  const [rowsByTab, setRowsByTab] = useState<Record<string, CodaRowItem[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errorByTab, setErrorByTab] = useState<Record<string, string>>({})

  useEffect(() => { loadTab(activeTab) }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTab(tabKey: string, force = false) {
    if (!force && (rowsByTab[tabKey] || loading[tabKey])) return
    const tab = TABS.find(t => t.key === tabKey)!
    setLoading(l => ({ ...l, [tabKey]: true }))
    setErrorByTab(er => ({ ...er, [tabKey]: "" }))
    try {
      let loc = located[tabKey]
      if (!loc || force) {
        loc = await findTable(tab.matcher)
        if (!loc) throw new Error(`Table buat "${tab.label}" nggak ketemu di Doc manapun yang kebaca token ini — cek apakah token SUPERHUMAN_DOCS_API_TOKEN sudah bisa akses doc yang bersangkutan.`)
        setLocated(l => ({ ...l, [tabKey]: loc }))
      }
      const res = await fetch(`/api/superhuman-docs/rows?docId=${encodeURIComponent(loc.docId)}&tableId=${encodeURIComponent(loc.tableId)}`).then(r => r.json())
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

  const columns: string[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    for (const k of Object.keys(r.values || {})) {
      if (!seen.has(k)) { seen.add(k); columns.push(k) }
    }
  }

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
          {loc ? <>Sumber: <strong>{loc.docName}</strong> → <strong>{loc.tableName}</strong> · {rows.length} baris</> : isLoading ? "Mencari table..." : "—"}
        </span>
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
      ) : !error && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          {rows.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text3)", padding: 20 }}>Nggak ada data.</p>
          ) : (
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
                      {columns.map(c => <td key={c} style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>{fmtCell(r.values?.[c])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
