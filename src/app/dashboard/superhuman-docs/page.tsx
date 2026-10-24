"use client"
// PATH: src/app/dashboard/superhuman-docs/page.tsx
//
// Halaman "Browse" buat eksplorasi integrasi Superhuman Docs (eks-Coda) —
// pilih Doc → pilih Table → lihat isi row-nya. Semua panggilan API lewat
// route server-side di src/app/api/superhuman-docs/* (token API-nya
// server-side only, lihat src/lib/superhumanDocs.ts), browser nggak pernah
// pegang token. Token yang ada sekarang READ-ONLY, jadi halaman ini
// cuma baca, belum ada fitur tulis/insert row.

import { useEffect, useState } from "react"
import { FolderOpen, Table2, RefreshCw, ExternalLink } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

interface DocItem { id: string; name: string; ownerName?: string; updatedAt?: string; browserLink?: string }
interface TableItem { id: string; name: string; rowCount?: number }
interface RowItem { id: string; name?: string; values: Record<string, unknown> }

function fmtCell(v: unknown): string {
  if (v == null) return "—"
  if (typeof v === "object") return JSON.stringify(v)
  return String(v)
}

export default function SuperhumanDocsPage() {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [docsError, setDocsError] = useState("")

  const [selectedDocId, setSelectedDocId] = useState("")
  const [tables, setTables] = useState<TableItem[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)
  const [tablesError, setTablesError] = useState("")

  const [selectedTableId, setSelectedTableId] = useState("")
  const [rows, setRows] = useState<RowItem[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)
  const [rowsError, setRowsError] = useState("")

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    setDocsLoading(true); setDocsError("")
    try {
      const res = await fetch("/api/superhuman-docs/docs")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setDocs(data.items || [])
    } catch (e) {
      setDocsError(e instanceof Error ? e.message : String(e))
    }
    setDocsLoading(false)
  }

  async function loadTables(docId: string) {
    setSelectedDocId(docId)
    setTables([]); setSelectedTableId(""); setRows([]); setTablesError("")
    if (!docId) return
    setTablesLoading(true)
    try {
      const res = await fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(docId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setTables(data.items || [])
    } catch (e) {
      setTablesError(e instanceof Error ? e.message : String(e))
    }
    setTablesLoading(false)
  }

  async function loadRows(tableId: string) {
    setSelectedTableId(tableId)
    setRows([]); setRowsError("")
    if (!tableId || !selectedDocId) return
    setRowsLoading(true)
    try {
      const res = await fetch(`/api/superhuman-docs/rows?docId=${encodeURIComponent(selectedDocId)}&tableId=${encodeURIComponent(tableId)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setRows(data.items || [])
    } catch (e) {
      setRowsError(e instanceof Error ? e.message : String(e))
    }
    setRowsLoading(false)
  }

  // Kolom dikumpulin dari union semua key "values" di seluruh row (bukan
  // cuma row pertama) — jaga-jaga kalau ada row yang sebagian kolomnya
  // kosong/nggak muncul di payload.
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
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📄</div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 3 }}>Superhuman Docs</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Browse Doc &amp; Table (read-only) — eks-Coda</p>
          </div>
        </div>
      </div>

      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#92400E" }}>
        ⚠️ Token yang kepake sekarang read-only — halaman ini cuma buat lihat isi Doc/Table, belum bisa insert/update row dari sini.
      </div>

      {/* Pilih Doc */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FolderOpen size={14} color="#0891B2" />
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Pilih Doc</span>
          </div>
          <button onClick={loadDocs} disabled={docsLoading} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 11, color: "var(--text2)", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5 }}>
            <RefreshCw size={12} style={{ animation: docsLoading ? "spin 0.8s linear infinite" : "none" }} /> Refresh
          </button>
        </div>

        {docsError && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B", marginBottom: 10 }}>
            ❌ {docsError}
          </div>
        )}

        {docsLoading ? (
          <p style={{ fontSize: 12, color: "var(--text3)" }}>Memuat daftar Doc...</p>
        ) : docs.length === 0 && !docsError ? (
          <p style={{ fontSize: 12, color: "var(--text3)" }}>Nggak ada Doc yang kebaca token ini.</p>
        ) : (
          <select value={selectedDocId} onChange={e => loadTables(e.target.value)}
            style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }}>
            <option value="">— Pilih Doc —</option>
            {docs.map(d => <option key={d.id} value={d.id}>{d.name} {d.ownerName ? `(${d.ownerName})` : ""}</option>)}
          </select>
        )}
      </div>

      {/* Pilih Table */}
      {selectedDocId && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Table2 size={14} color="#0891B2" />
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Pilih Table</span>
          </div>

          {tablesError && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B", marginBottom: 10 }}>
              ❌ {tablesError}
            </div>
          )}

          {tablesLoading ? (
            <p style={{ fontSize: 12, color: "var(--text3)" }}>Memuat daftar Table...</p>
          ) : tables.length === 0 && !tablesError ? (
            <p style={{ fontSize: 12, color: "var(--text3)" }}>Doc ini nggak punya Table.</p>
          ) : (
            <select value={selectedTableId} onChange={e => loadRows(e.target.value)}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }}>
              <option value="">— Pilih Table —</option>
              {tables.map(t => <option key={t.id} value={t.id}>{t.name}{t.rowCount != null ? ` (${t.rowCount} baris)` : ""}</option>)}
            </select>
          )}
        </div>
      )}

      {/* Isi Table */}
      {selectedTableId && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text)" }}>Isi Table — {rows.length} baris</span>
            {docs.find(d => d.id === selectedDocId)?.browserLink && (
              <a href={docs.find(d => d.id === selectedDocId)!.browserLink} target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 11, color: "#0891B2", display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                Buka di Superhuman Docs <ExternalLink size={11} />
              </a>
            )}
          </div>

          {rowsError && (
            <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#991B1B", margin: 14 }}>
              ❌ {rowsError}
            </div>
          )}

          {rowsLoading ? (
            <p style={{ fontSize: 12, color: "var(--text3)", padding: 20 }}>Memuat isi table...</p>
          ) : rows.length === 0 && !rowsError ? (
            <p style={{ fontSize: 12, color: "var(--text3)", padding: 20 }}>Table ini kosong.</p>
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