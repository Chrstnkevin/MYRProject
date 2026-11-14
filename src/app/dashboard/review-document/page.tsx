"use client"

import { useEffect, useRef, useState } from "react"
import {
  Upload, FileText, Sparkles, Loader2, Check, X, MessageSquarePlus,
  Download, AlertTriangle, Trash2, RotateCcw,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { SECTION_HEADINGS, type DocSection } from "@/lib/docxSections"

interface Finding {
  id: string
  sectionKey: string
  severity: "low" | "medium" | "high"
  comment: string
  status: "pending" | "accepted" | "rejected"
}

interface UserComment { id: string; sectionKey: string; text: string }

const SEVERITY_CFG = {
  high:   { label: "Tinggi", color: "var(--danger)",  bg: "var(--danger-bg)" },
  medium: { label: "Sedang", color: "var(--warning)", bg: "var(--warning-bg)" },
  low:    { label: "Rendah", color: "var(--text2)",   bg: "var(--surface3)" },
} as const

function sectionLabel(key: string, sections: DocSection[]): string {
  const found = sections.find(s => s.key === key)
  if (found) return found.label
  if (key === "general") return "Umum / Keseluruhan Dokumen"
  return key
}

// Anchor comment Word ke paragraf heading section-nya. "header" dianchor
// ke baris pertama teks sebelum heading pertama (biasanya judul dokumen).
// "general" nggak punya satu paragraf spesifik buat ditempelin — comment
// ini bakal masuk ke notFound pas export (tetap keliatan di review, cuma
// nggak ketempel di file .docx-nya).
function anchorTextForSection(key: string, sections: DocSection[]): string {
  const section = SECTION_HEADINGS.find(h => h.key === key)
  if (section) return section.heading
  if (key === "header") return sections.find(s => s.key === "header")?.text.split("\n")[0]?.trim() || ""
  return ""
}

export default function ReviewDocumentPage() {
  const [file, setFile] = useState<File | null>(null)
  const [html, setHtml] = useState("")
  const [sections, setSections] = useState<DocSection[]>([])
  const [findings, setFindings] = useState<Finding[]>([])
  const [userComments, setUserComments] = useState<UserComment[]>([])
  const [authorName, setAuthorName] = useState("Reviewer")
  const [parsing, setParsing] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [newCommentSection, setNewCommentSection] = useState("")
  const [newCommentText, setNewCommentText] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      setAuthorName(profile?.full_name || user.email || "Reviewer")
    })()
  }, [])

  const reset = () => {
    setFile(null); setHtml(""); setSections([]); setFindings([]); setUserComments([]); setError("")
  }

  const handleUpload = async (f: File) => {
    if (!/\.docx$/i.test(f.name)) { setError("Harus file .docx"); return }
    reset()
    setFile(f)
    setParsing(true)
    try {
      const form = new FormData()
      form.append("file", f)
      const res = await fetch("/api/review-document/parse", { method: "POST", body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal baca dokumen")
      setHtml(data.html)
      setSections(data.sections)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal baca dokumen")
      setFile(null)
    } finally {
      setParsing(false)
    }
  }

  const runAnalyze = async () => {
    if (sections.length === 0) return
    setAnalyzing(true)
    setError("")
    try {
      const res = await fetch("/api/review-document/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal minta review AI")
      const rawFindings = data.findings as { sectionKey: string; severity: Finding["severity"]; comment: string }[]
      setFindings(rawFindings.map(f => ({ id: crypto.randomUUID(), ...f, status: "pending" as const })))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal minta review AI")
    } finally {
      setAnalyzing(false)
    }
  }

  const setFindingStatus = (id: string, status: Finding["status"]) =>
    setFindings(prev => prev.map(f => (f.id === id ? { ...f, status } : f)))

  const addUserComment = () => {
    if (!newCommentSection || !newCommentText.trim()) return
    setUserComments(prev => [...prev, { id: crypto.randomUUID(), sectionKey: newCommentSection, text: newCommentText.trim() }])
    setNewCommentText("")
  }
  const removeUserComment = (id: string) => setUserComments(prev => prev.filter(c => c.id !== id))

  const acceptedFindings = findings.filter(f => f.status === "accepted")
  const totalToExport = acceptedFindings.length + userComments.length

  const handleExport = async () => {
    if (!file || totalToExport === 0) return
    setExporting(true)
    setError("")
    try {
      const comments = [
        ...acceptedFindings.map(f => ({ anchorText: anchorTextForSection(f.sectionKey, sections), author: "AI Reviewer", text: f.comment })),
        ...userComments.map(c => ({ anchorText: anchorTextForSection(c.sectionKey, sections), author: authorName, text: c.text })),
      ]
      const form = new FormData()
      form.append("file", file)
      form.append("comments", JSON.stringify(comments))
      const res = await fetch("/api/review-document/export", { method: "POST", body: form })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Gagal export dokumen")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = file.name.replace(/\.docx$/i, "") + "_reviewed.docx"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal export dokumen")
    } finally {
      setExporting(false)
    }
  }

  const sectionOptions = [
    ...sections.filter(s => s.key !== "header").map(s => ({ key: s.key, label: s.label })),
    { key: "general", label: "Umum / Keseluruhan Dokumen" },
  ]

  const findingsBySection = sectionOptions
    .map(opt => ({ opt, items: findings.filter(f => f.sectionKey === opt.key) }))
    .filter(g => g.items.length > 0)

  return (
    <div style={{ padding: "28px 32px", maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "22px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", display: "flex", alignItems: "center", gap: "9px" }}>
          <Sparkles size={22} style={{ color: "var(--accent2)" }} /> Review Document
        </h1>
        <p style={{ fontSize: "13.5px", color: "var(--text2)", marginTop: "4px" }}>
          Upload dokumen Business Requirement (.docx) — AI bakal bertindak sebagai QC + Developer buat nyari hal yang ambigu, nggak konsisten, atau kurang jelas. Pilih temuan mana yang mau disetujui, baru di-download dengan comment Word asli, format dokumen nggak berubah.
        </p>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--danger-bg)", color: "var(--danger)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "13px", fontWeight: 600, marginBottom: "16px" }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {!file && (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false)
            const f = e.dataTransfer.files?.[0]
            if (f) handleUpload(f)
          }}
          className="card"
          style={{
            padding: "60px 24px", textAlign: "center", cursor: "pointer",
            borderStyle: "dashed", borderWidth: "2px",
            borderColor: dragOver ? "var(--accent2)" : "var(--border2)",
            background: dragOver ? "var(--accent-muted)" : "var(--surface)",
          }}
        >
          <input ref={fileInputRef} type="file" accept=".docx" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
          {parsing ? (
            <>
              <Loader2 size={34} style={{ color: "var(--accent2)", marginBottom: "10px", animation: "spin 1s linear infinite" }} />
              <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text2)" }}>Membaca dokumen...</div>
            </>
          ) : (
            <>
              <Upload size={34} style={{ color: "var(--text3)", marginBottom: "10px" }} />
              <div style={{ fontSize: "15px", fontWeight: 700, color: "var(--text)" }}>Klik atau drag file .docx ke sini</div>
              <div style={{ fontSize: "12.5px", color: "var(--text3)", marginTop: "4px" }}>Dokumen Business Requirement hasil Doc Req / template BR</div>
            </>
          )}
        </div>
      )}

      {file && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px" }}>
              <FileText size={18} style={{ color: "var(--accent2)" }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{file.name}</span>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn-ghost" onClick={reset}><RotateCcw size={14} /> Ganti File</button>
              <button className="btn btn-primary" onClick={runAnalyze} disabled={analyzing}>
                {analyzing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                {analyzing ? "AI sedang review..." : findings.length > 0 ? "Review Ulang" : "Minta AI Review"}
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px", alignItems: "start" }}>
            {/* ── Preview dokumen ── */}
            <div className="card" style={{ padding: "0", overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", fontSize: "12px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Preview Dokumen
              </div>
              <div
                style={{ padding: "22px 26px", maxHeight: "72vh", overflowY: "auto", fontSize: "13.5px", lineHeight: 1.65, color: "var(--text)" }}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>

            {/* ── Panel review ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {findings.length === 0 && !analyzing && (
                <div className="card" style={{ padding: "22px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
                  Klik <strong>Minta AI Review</strong> buat mulai analisa.
                </div>
              )}

              {findingsBySection.map(({ opt, items }) => (
                <div key={opt.key} className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--accent)", marginBottom: "10px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {opt.label}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {items.map(f => {
                      const sev = SEVERITY_CFG[f.severity]
                      return (
                        <div key={f.id} style={{
                          border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "11px 13px",
                          opacity: f.status === "rejected" ? 0.45 : 1,
                          background: f.status === "accepted" ? "var(--accent-muted)" : "var(--surface2)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                            <span style={{ fontSize: "9.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "99px", background: sev.bg, color: sev.color, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
                              {sev.label}
                            </span>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button title="Setujui"
                                onClick={() => setFindingStatus(f.id, f.status === "accepted" ? "pending" : "accepted")}
                                style={{ border: "none", background: f.status === "accepted" ? "var(--success)" : "var(--surface3)", color: f.status === "accepted" ? "white" : "var(--text2)", borderRadius: "6px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                <Check size={14} />
                              </button>
                              <button title="Tolak"
                                onClick={() => setFindingStatus(f.id, f.status === "rejected" ? "pending" : "rejected")}
                                style={{ border: "none", background: f.status === "rejected" ? "var(--danger)" : "var(--surface3)", color: f.status === "rejected" ? "white" : "var(--text2)", borderRadius: "6px", width: "26px", height: "26px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                <X size={14} />
                              </button>
                            </div>
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--text)", marginTop: "7px", lineHeight: 1.55 }}>{f.comment}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* ── Tambah comment sendiri ── */}
              {sections.length > 0 && (
                <div className="card" style={{ padding: "14px 16px" }}>
                  <div style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--text2)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <MessageSquarePlus size={14} /> Tambah Komentar Sendiri
                  </div>
                  <select className="input" value={newCommentSection} onChange={e => setNewCommentSection(e.target.value)} style={{ marginBottom: "8px" }}>
                    <option value="">Pilih section...</option>
                    {sectionOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                  </select>
                  <textarea className="input" rows={2} placeholder="Tulis komentar kamu..." value={newCommentText}
                    onChange={e => setNewCommentText(e.target.value)} style={{ marginBottom: "8px", resize: "vertical" }} />
                  <button className="btn btn-secondary" onClick={addUserComment} disabled={!newCommentSection || !newCommentText.trim()} style={{ width: "100%", justifyContent: "center" }}>
                    <MessageSquarePlus size={14} /> Tambah
                  </button>

                  {userComments.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "12px" }}>
                      {userComments.map(c => (
                        <div key={c.id} style={{ display: "flex", justifyContent: "space-between", gap: "8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 11px", background: "var(--accent-muted)" }}>
                          <div>
                            <div style={{ fontSize: "10.5px", fontWeight: 700, color: "var(--accent)", marginBottom: "3px" }}>{sectionLabel(c.sectionKey, sections)}</div>
                            <div style={{ fontSize: "12.5px", color: "var(--text)" }}>{c.text}</div>
                          </div>
                          <button onClick={() => removeUserComment(c.id)} style={{ border: "none", background: "transparent", color: "var(--text3)", cursor: "pointer", flexShrink: 0 }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button className="btn btn-primary" onClick={handleExport} disabled={totalToExport === 0 || exporting} style={{ justifyContent: "center", padding: "12px" }}>
                {exporting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={15} />}
                {exporting ? "Menyiapkan file..." : `Download dengan Comment (${totalToExport})`}
              </button>
            </div>
          </div>
        </>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
