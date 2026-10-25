"use client"
// PATH: src/app/dashboard/pilot-plan/page.tsx
//
// "Plan Pilot SFA" — kurasi semi-otomatis: dokumen dipilih dari Superhuman
// Docs (Coda, read-only, lewat picker yang reuse /api/superhuman-docs/*),
// data subdist diisi manual, semuanya disimpan PERMANEN di Supabase
// (pilot_plans/pilot_plan_subdist/pilot_plan_docs — independen dari Coda,
// nggak akan ilang walau datanya di Coda berubah/kehapus). Begitu plan-nya
// dianggap OK, tombol "Generate Dokumen" export jadi .xlsx format "Form
// Detail PILOT" (sama kayak template Form_Request_Pilot_SFA_For_MD_*.xlsx
// yang dikasih user) lewat /api/pilot-plan/generate (exceljs, server-only).

import { useEffect, useState } from "react"
import { Plus, Trash2, Save, Download, X, Loader2, Users, CheckSquare, Square, FileSpreadsheet } from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"

interface PilotPlan { id: string; name: string; created_at: string }
interface SubdistRow { id: string; kode_subdist: string; nama_subdist: string; keterangan: string; pilot_by: string }
interface DocRow {
  id: string; modul: string; doc_no_nama: string; keterangan: string
  on_version: string; req_by: string; test_by: string; status: string
  source_coda_doc_id?: string | null; source_coda_table_id?: string | null; source_coda_row_id?: string | null
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)",
  background: "var(--surface)", color: "var(--text)", fontSize: 11, fontFamily: "inherit",
}
const thStyle: React.CSSProperties = { padding: "7px 8px", textAlign: "left", whiteSpace: "nowrap" }
const tdStyle: React.CSSProperties = { padding: "4px 8px", verticalAlign: "top" }

function newId() { return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) }

export default function PilotPlanPage() {
  const [plans, setPlans] = useState<PilotPlan[]>([])
  const [plansLoading, setPlansLoading] = useState(true)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [newPlanName, setNewPlanName] = useState("")
  const [creating, setCreating] = useState(false)
  const [plansError, setPlansError] = useState("")

  const [subdistRows, setSubdistRows] = useState<SubdistRow[]>([])
  const [docRows, setDocRows] = useState<DocRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState("")
  const [generating, setGenerating] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)

  useEffect(() => { loadPlans() }, [])
  useEffect(() => { if (selectedPlanId) loadDetail(selectedPlanId) }, [selectedPlanId])

  async function loadPlans() {
    setPlansLoading(true); setPlansError("")
    const { data, error } = await supabase.from("pilot_plans").select("*").order("created_at", { ascending: false })
    if (error) setPlansError(error.message)
    else setPlans((data || []) as PilotPlan[])
    setPlansLoading(false)
  }

  async function loadDetail(planId: string) {
    setDetailLoading(true); setSaveMsg("")
    const [sRes, dRes] = await Promise.all([
      supabase.from("pilot_plan_subdist").select("*").eq("plan_id", planId).order("sort_order"),
      supabase.from("pilot_plan_docs").select("*").eq("plan_id", planId).order("sort_order"),
    ])
    setSubdistRows((sRes.data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string, kode_subdist: (r.kode_subdist as string) || "", nama_subdist: (r.nama_subdist as string) || "",
      keterangan: (r.keterangan as string) || "", pilot_by: (r.pilot_by as string) || "",
    })))
    setDocRows((dRes.data || []).map((r: Record<string, unknown>) => ({
      id: r.id as string, modul: (r.modul as string) || "", doc_no_nama: (r.doc_no_nama as string) || "",
      keterangan: (r.keterangan as string) || "", on_version: (r.on_version as string) || "",
      req_by: (r.req_by as string) || "", test_by: (r.test_by as string) || "", status: (r.status as string) || "",
      source_coda_doc_id: r.source_coda_doc_id as string | null, source_coda_table_id: r.source_coda_table_id as string | null,
      source_coda_row_id: r.source_coda_row_id as string | null,
    })))
    setDetailLoading(false)
  }

  async function handleCreatePlan() {
    if (!newPlanName.trim()) return
    setCreating(true); setPlansError("")
    const { data, error } = await supabase.from("pilot_plans").insert({ name: newPlanName.trim() }).select().single()
    setCreating(false)
    if (error) { setPlansError(error.message); return }
    setNewPlanName("")
    await loadPlans()
    setSelectedPlanId(data.id)
  }

  async function handleDeletePlan(planId: string) {
    if (!confirm("Hapus plan ini beserta seluruh isinya? Nggak bisa dibatalin.")) return
    const { error } = await supabase.from("pilot_plans").delete().eq("id", planId)
    if (error) { setPlansError(error.message); return }
    if (selectedPlanId === planId) setSelectedPlanId(null)
    await loadPlans()
  }

  async function handleSave() {
    if (!selectedPlanId) return
    setSaving(true); setSaveMsg("")
    try {
      const { error: delS } = await supabase.from("pilot_plan_subdist").delete().eq("plan_id", selectedPlanId)
      if (delS) throw delS
      const { error: delD } = await supabase.from("pilot_plan_docs").delete().eq("plan_id", selectedPlanId)
      if (delD) throw delD

      if (subdistRows.length > 0) {
        const { error } = await supabase.from("pilot_plan_subdist").insert(
          subdistRows.map((r, i) => ({
            plan_id: selectedPlanId, sort_order: i, kode_subdist: r.kode_subdist, nama_subdist: r.nama_subdist,
            keterangan: r.keterangan, pilot_by: r.pilot_by,
          }))
        )
        if (error) throw error
      }
      if (docRows.length > 0) {
        const { error } = await supabase.from("pilot_plan_docs").insert(
          docRows.map((r, i) => ({
            plan_id: selectedPlanId, sort_order: i, modul: r.modul, doc_no_nama: r.doc_no_nama, keterangan: r.keterangan,
            on_version: r.on_version, req_by: r.req_by, test_by: r.test_by, status: r.status,
            source_coda_doc_id: r.source_coda_doc_id || null, source_coda_table_id: r.source_coda_table_id || null,
            source_coda_row_id: r.source_coda_row_id || null,
          }))
        )
        if (error) throw error
      }
      setSaveMsg("✅ Tersimpan")
      await loadDetail(selectedPlanId)
    } catch (e) {
      setSaveMsg(`❌ ${e instanceof Error ? e.message : String(e)}`)
    }
    setSaving(false)
  }

  async function handleGenerate() {
    const plan = plans.find(p => p.id === selectedPlanId)
    if (!plan) return
    setGenerating(true)
    try {
      const res = await fetch("/api/pilot-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planName: plan.name,
          subdist: subdistRows.map(r => ({ kode_subdist: r.kode_subdist, nama_subdist: r.nama_subdist, keterangan: r.keterangan, pilot_by: r.pilot_by })),
          docs: docRows.map(r => ({ modul: r.modul, doc_no_nama: r.doc_no_nama, keterangan: r.keterangan, on_version: r.on_version, req_by: r.req_by, test_by: r.test_by, status: r.status })),
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Form_Detail_PILOT_${plan.name}.xlsx`.replace(/[\\/:*?"<>|]/g, "_")
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setSaveMsg(`❌ Gagal generate: ${e instanceof Error ? e.message : String(e)}`)
    }
    setGenerating(false)
  }

  function updateSubdist(id: string, patch: Partial<SubdistRow>) {
    setSubdistRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  }
  function updateDoc(id: string, patch: Partial<DocRow>) {
    setDocRows(rs => rs.map(r => r.id === id ? { ...r, ...patch } : r))
  }

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || null

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>
      <MotivationBanner page="docreq" />

      <div style={{ background: "linear-gradient(135deg,#0E4D64,#0891B2)", borderRadius: 14, padding: "18px 22px", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -30, top: -30, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📋</div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, color: "white", marginBottom: 3 }}>Plan Pilot SFA</h1>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Kurasi dokumen dari Superhuman Docs + subdist manual → generate Form Detail PILOT</p>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 14 }}>
        {/* Panel kiri: daftar plan */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", height: "fit-content" }}>
          <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>Daftar Plan</span>
          </div>
          <div style={{ padding: "10px 14px", display: "flex", gap: 6, borderBottom: "1px solid var(--border)" }}>
            <input value={newPlanName} onChange={e => setNewPlanName(e.target.value)}
              placeholder="Nama plan, mis. SFA for MD 26.10.05"
              onKeyDown={e => { if (e.key === "Enter") handleCreatePlan() }}
              style={{ ...inputStyle, flex: 1 }} />
            <button onClick={handleCreatePlan} disabled={creating || !newPlanName.trim()}
              style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: "#0891B2", color: "white", cursor: "pointer", display: "flex", alignItems: "center" }}>
              {creating ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={13} />}
            </button>
          </div>
          {plansError && <div style={{ padding: "8px 14px", fontSize: 11, color: "#991B1B" }}>❌ {plansError}</div>}
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {plansLoading ? (
              <p style={{ padding: 14, fontSize: 11, color: "var(--text3)" }}>Memuat...</p>
            ) : plans.length === 0 ? (
              <p style={{ padding: 14, fontSize: 11, color: "var(--text3)" }}>Belum ada plan.</p>
            ) : plans.map(p => (
              <div key={p.id} onClick={() => setSelectedPlanId(p.id)}
                style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: selectedPlanId === p.id ? "var(--accent-muted)" : "transparent", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: selectedPlanId === p.id ? "#0891B2" : "var(--text)" }}>{p.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text3)" }}>{new Date(p.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div>
                </div>
                <button onClick={e => { e.stopPropagation(); handleDeletePlan(p.id) }} title="Hapus plan"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex", flexShrink: 0 }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Panel kanan: detail plan */}
        {!selectedPlan ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface)", border: "1.5px dashed var(--border)", borderRadius: 12, padding: 40 }}>
            <p style={{ fontSize: 12, color: "var(--text3)" }}>Pilih atau bikin plan dulu di panel kiri.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: "var(--text)" }}>{selectedPlan.name}</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {saveMsg && <span style={{ fontSize: 11, color: saveMsg.startsWith("✅") ? "#166534" : "#991B1B" }}>{saveMsg}</span>}
                <button onClick={handleSave} disabled={saving || detailLoading}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text2)", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                  {saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Save size={13} />} Simpan
                </button>
                <button onClick={handleGenerate} disabled={generating || detailLoading}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#16A34A", color: "white", cursor: "pointer", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                  {generating ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Download size={13} />} Generate Dokumen
                </button>
              </div>
            </div>

            {detailLoading ? (
              <p style={{ fontSize: 12, color: "var(--text3)" }}>Memuat detail plan...</p>
            ) : (
              <>
                {/* Pilot Implementation */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}><Users size={13} color="#0891B2" /> Pilot Implementation</span>
                    <button onClick={() => setSubdistRows(rs => [...rs, { id: newId(), kode_subdist: "", nama_subdist: "", keterangan: "", pilot_by: "" }])}
                      style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 10, color: "var(--text2)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Plus size={11} /> Tambah Baris
                    </button>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 560 }}>
                      <thead>
                        <tr style={{ background: "var(--surface2)", color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>Kode Subdist</th>
                          <th style={thStyle}>Nama Subdist</th>
                          <th style={thStyle}>Keterangan</th>
                          <th style={thStyle}>Pilot By</th>
                          <th style={thStyle}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {subdistRows.length === 0 ? (
                          <tr><td colSpan={6} style={{ padding: 20, textAlign: "center", color: "var(--text3)" }}>Belum ada subdist — klik &quot;Tambah Baris&quot;.</td></tr>
                        ) : subdistRows.map((r, i) => (
                          <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ ...tdStyle, color: "var(--text3)" }}>{i + 1}</td>
                            <td style={tdStyle}><input value={r.kode_subdist} onChange={e => updateSubdist(r.id, { kode_subdist: e.target.value })} style={inputStyle} /></td>
                            <td style={tdStyle}><input value={r.nama_subdist} onChange={e => updateSubdist(r.id, { nama_subdist: e.target.value })} style={inputStyle} /></td>
                            <td style={tdStyle}><input value={r.keterangan} onChange={e => updateSubdist(r.id, { keterangan: e.target.value })} style={inputStyle} /></td>
                            <td style={tdStyle}><input value={r.pilot_by} onChange={e => updateSubdist(r.id, { pilot_by: e.target.value })} style={inputStyle} /></td>
                            <td style={tdStyle}>
                              <button onClick={() => setSubdistRows(rs => rs.filter(x => x.id !== r.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex" }}>
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* List dokumen */}
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: 6 }}><FileSpreadsheet size={13} color="#0891B2" /> List Dokumen</span>
                    <button onClick={() => setPickerOpen(true)}
                      style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 10, color: "var(--text2)", display: "flex", alignItems: "center", gap: 4 }}>
                      <Plus size={11} /> Tambah dari Superhuman Docs
                    </button>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, minWidth: 900 }}>
                      <thead>
                        <tr style={{ background: "var(--surface2)", color: "var(--text3)", borderBottom: "1px solid var(--border)" }}>
                          <th style={thStyle}>#</th>
                          <th style={thStyle}>Modul</th>
                          <th style={thStyle}>No. DR/ST Nama Dokumen</th>
                          <th style={thStyle}>Keterangan</th>
                          <th style={thStyle}>On Version</th>
                          <th style={thStyle}>Req By</th>
                          <th style={thStyle}>Test By</th>
                          <th style={thStyle}>Status</th>
                          <th style={thStyle}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {docRows.length === 0 ? (
                          <tr><td colSpan={9} style={{ padding: 20, textAlign: "center", color: "var(--text3)" }}>Belum ada dokumen — klik &quot;Tambah dari Superhuman Docs&quot;.</td></tr>
                        ) : docRows.map((r, i) => (
                          <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ ...tdStyle, color: "var(--text3)" }}>{i + 1}</td>
                            <td style={{ ...tdStyle, minWidth: 110 }}><input value={r.modul} onChange={e => updateDoc(r.id, { modul: e.target.value })} style={inputStyle} /></td>
                            <td style={{ ...tdStyle, minWidth: 260 }}><input value={r.doc_no_nama} onChange={e => updateDoc(r.id, { doc_no_nama: e.target.value })} style={inputStyle} /></td>
                            <td style={{ ...tdStyle, minWidth: 140 }}><input value={r.keterangan} onChange={e => updateDoc(r.id, { keterangan: e.target.value })} style={inputStyle} /></td>
                            <td style={{ ...tdStyle, minWidth: 120 }}><input value={r.on_version} onChange={e => updateDoc(r.id, { on_version: e.target.value })} style={inputStyle} /></td>
                            <td style={{ ...tdStyle, minWidth: 90 }}><input value={r.req_by} onChange={e => updateDoc(r.id, { req_by: e.target.value })} style={inputStyle} /></td>
                            <td style={{ ...tdStyle, minWidth: 90 }}><input value={r.test_by} onChange={e => updateDoc(r.id, { test_by: e.target.value })} style={inputStyle} /></td>
                            <td style={{ ...tdStyle, minWidth: 90 }}><input value={r.status} onChange={e => updateDoc(r.id, { status: e.target.value })} style={inputStyle} /></td>
                            <td style={tdStyle}>
                              <button onClick={() => setDocRows(rs => rs.filter(x => x.id !== r.id))} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex" }}>
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {pickerOpen && selectedPlan && (
        <CodaPickerModal
          defaultOnVersion={selectedPlan.name}
          onClose={() => setPickerOpen(false)}
          onAdd={rows => { setDocRows(rs => [...rs, ...rows]); setPickerOpen(false) }}
        />
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Modal buat pilih dokumen dari Superhuman Docs (Coda) ──
// Reuse route /api/superhuman-docs/{docs,tables,rows} yang sama persis
// dipakai halaman /dashboard/superhuman-docs. Mapping field Coda -> field
// "List Dokumen" plan ini dilakuin heuristik by NAMA KOLOM (case-insensitive)
// soalnya tabel "List Pilot" bisa punya kolom lebih banyak dari yang
// kelihatan di halaman Browse: "Modul"/"Keterangan" diambil kalau ada
// kolom persis namanya, "doc_no_nama" diprioritaskan dari kolom yang
// namanya mengandung "Doc" & "Name" (atau "Nama" & "Dokumen"), fallback ke
// nama baris (row.name) kalau nggak ketemu.
interface CodaDocItem { id: string; name: string; ownerName?: string }
interface CodaTableItem { id: string; name: string; rowCount?: number }
interface CodaRowItem { id: string; name?: string; values: Record<string, unknown> }

function pickByKeyPattern(values: Record<string, unknown>, pattern: RegExp): string {
  for (const [k, v] of Object.entries(values)) {
    if (pattern.test(k) && v != null) return String(v)
  }
  return ""
}

function CodaPickerModal({ defaultOnVersion, onClose, onAdd }: {
  defaultOnVersion: string
  onClose: () => void
  onAdd: (rows: DocRow[]) => void
}) {
  const [docs, setDocs] = useState<CodaDocItem[]>([])
  const [docsLoading, setDocsLoading] = useState(true)
  const [error, setError] = useState("")

  const [selectedDocId, setSelectedDocId] = useState("")
  const [tables, setTables] = useState<CodaTableItem[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)

  const [selectedTableId, setSelectedTableId] = useState("")
  const [rows, setRows] = useState<CodaRowItem[]>([])
  const [rowsLoading, setRowsLoading] = useState(false)

  const [checked, setChecked] = useState<Set<string>>(new Set())

  useEffect(() => {
    setDocsLoading(true)
    fetch("/api/superhuman-docs/docs").then(r => r.json()).then(d => {
      if (d.error) setError(d.error)
      else setDocs(d.items || [])
    }).catch(e => setError(String(e))).finally(() => setDocsLoading(false))
  }, [])

  function pickDoc(docId: string) {
    setSelectedDocId(docId); setTables([]); setSelectedTableId(""); setRows([]); setChecked(new Set()); setError("")
    if (!docId) return
    setTablesLoading(true)
    fetch(`/api/superhuman-docs/tables?docId=${encodeURIComponent(docId)}`).then(r => r.json()).then(d => {
      if (d.error) setError(d.error)
      else setTables(d.items || [])
    }).catch(e => setError(String(e))).finally(() => setTablesLoading(false))
  }

  function pickTable(tableId: string) {
    setSelectedTableId(tableId); setRows([]); setChecked(new Set()); setError("")
    if (!tableId) return
    setRowsLoading(true)
    fetch(`/api/superhuman-docs/rows?docId=${encodeURIComponent(selectedDocId)}&tableId=${encodeURIComponent(tableId)}`).then(r => r.json()).then(d => {
      if (d.error) setError(d.error)
      else setRows(d.items || [])
    }).catch(e => setError(String(e))).finally(() => setRowsLoading(false))
  }

  function toggle(id: string) {
    setChecked(s => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  function confirmAdd() {
    const table = tables.find(t => t.id === selectedTableId)
    const mapped: DocRow[] = rows.filter(r => checked.has(r.id)).map(r => {
      const docNoNama = pickByKeyPattern(r.values, /doc.*name|nama.*dokumen|doc.*no/i) || r.name || Object.values(r.values)[0] as string || ""
      return {
        id: newId(),
        modul: pickByKeyPattern(r.values, /^modul$/i),
        doc_no_nama: docNoNama,
        keterangan: pickByKeyPattern(r.values, /keterangan/i),
        on_version: defaultOnVersion,
        req_by: "", test_by: "", status: "",
        source_coda_doc_id: selectedDocId, source_coda_table_id: table?.id || selectedTableId, source_coda_row_id: r.id,
      }
    })
    onAdd(mapped)
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div style={{ background: "var(--surface)", borderRadius: 14, width: "100%", maxWidth: 760, maxHeight: "85vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: "var(--text)" }}>Tambah Dokumen dari Superhuman Docs</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
          {error && <div style={{ background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#991B1B" }}>❌ {error}</div>}

          <div>
            <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", marginBottom: 4, display: "block" }}>DOC</label>
            {docsLoading ? <p style={{ fontSize: 11, color: "var(--text3)" }}>Memuat...</p> : (
              <select value={selectedDocId} onChange={e => pickDoc(e.target.value)} style={inputStyle}>
                <option value="">— Pilih Doc —</option>
                {docs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>

          {selectedDocId && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", marginBottom: 4, display: "block" }}>TABLE</label>
              {tablesLoading ? <p style={{ fontSize: 11, color: "var(--text3)" }}>Memuat...</p> : (
                <select value={selectedTableId} onChange={e => pickTable(e.target.value)} style={inputStyle}>
                  <option value="">— Pilih Table —</option>
                  {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              )}
            </div>
          )}

          {selectedTableId && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", marginBottom: 4, display: "block" }}>
                PILIH BARIS ({checked.size} dipilih)
              </label>
              {rowsLoading ? <p style={{ fontSize: 11, color: "var(--text3)" }}>Memuat baris...</p> : rows.length === 0 ? (
                <p style={{ fontSize: 11, color: "var(--text3)" }}>Table ini kosong.</p>
              ) : (
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, maxHeight: 280, overflowY: "auto" }}>
                  {rows.map(r => {
                    const label = pickByKeyPattern(r.values, /doc.*name|nama.*dokumen/i) || r.name || Object.values(r.values)[0] as string || r.id
                    const isChecked = checked.has(r.id)
                    return (
                      <div key={r.id} onClick={() => toggle(r.id)}
                        style={{ padding: "8px 10px", borderBottom: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, background: isChecked ? "var(--accent-muted)" : "transparent" }}>
                        {isChecked ? <CheckSquare size={14} color="#0891B2" /> : <Square size={14} color="var(--text3)" />}
                        <span style={{ fontSize: 11, color: "var(--text)" }}>{label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text2)", cursor: "pointer", fontSize: 12 }}>Batal</button>
          <button onClick={confirmAdd} disabled={checked.size === 0}
            style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: checked.size === 0 ? "var(--border)" : "#0891B2", color: "white", cursor: checked.size === 0 ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700 }}>
            Tambahkan {checked.size > 0 ? `${checked.size} dokumen` : ""}
          </button>
        </div>
      </div>
    </div>
  )
}
