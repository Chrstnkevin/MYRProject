"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import {
  Upload, FileText, Sparkles, Loader2, Check, X, MessageSquarePlus,
  Download, AlertTriangle, Trash2, RotateCcw, MessagesSquare, Send, PanelRightOpen,
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

interface UserComment { id: string; anchorText: string; text: string }
interface SelectionState { text: string; top: number; left: number }
interface ChatMessage { role: "user" | "assistant"; content: string }

const SEVERITY_CFG = {
  high:   { label: "Tinggi", color: "var(--danger)",  bg: "var(--danger-bg)" },
  medium: { label: "Sedang", color: "var(--warning)", bg: "var(--warning-bg)" },
  low:    { label: "Rendah", color: "var(--text2)",   bg: "var(--surface3)" },
} as const

// Warna highlight komentar milik user sendiri — SENGAJA beda dari ke-3
// warna severity AI (merah/oranye/abu) biar langsung keliatan "ini
// komentar saya" vs "ini temuan AI" cuma dari warnanya aja.
const USER_HL = { bg: "#DBEAFE", border: "#2563EB" }

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

// Render ringan buat teks temuan AI yang sekarang lebih terstruktur
// (**bold**, bullet "- ", numbered "1. ", per-baris) — tanpa nambah
// dependency markdown library, cukup cover pola yang diminta di system
// prompt analyze/route.ts.
function renderInline(s: string, keyPrefix: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g).filter(p => p.length > 0)
  return parts.map((p, idx) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={`${keyPrefix}-${idx}`}>{p.slice(2, -2)}</strong>
      : <span key={`${keyPrefix}-${idx}`}>{p}</span>
  )
}

function renderFindingText(text: string) {
  const lines = text.split("\n").map(l => l.trim()).filter(l => l.length > 0)
  const blocks: ReactNode[] = []
  let i = 0
  let key = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^[-•]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^[-•]\s+/.test(lines[i])) { items.push(lines[i].replace(/^[-•]\s+/, "")); i++ }
      blocks.push(
        <ul key={key++} style={{ margin: "2px 0 8px", paddingLeft: "18px" }}>
          {items.map((it, idx) => <li key={idx} style={{ marginBottom: "3px" }}>{renderInline(it, `${key}-${idx}`)}</li>)}
        </ul>
      )
    } else if (/^\d+[.)]\s+/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\d+[.)]\s+/, "")); i++ }
      blocks.push(
        <ol key={key++} style={{ margin: "2px 0 8px", paddingLeft: "18px" }}>
          {items.map((it, idx) => <li key={idx} style={{ marginBottom: "3px" }}>{renderInline(it, `${key}-${idx}`)}</li>)}
        </ol>
      )
    } else {
      blocks.push(<p key={key++} style={{ margin: "0 0 7px" }}>{renderInline(line, `${key}`)}</p>)
      i++
    }
  }
  return blocks
}

// ── Highlight di preview: cari teks target di dalam text node (TreeWalker,
// nggak nyentuh atribut/tag sama sekali), split node-nya, bungkus match-nya
// pakai <mark>. Dipanggil ulang tiap findings/userComments berubah — makanya
// SELALU unwrap mark lama dulu sebelum apply ulang, biar idempotent & nggak
// numpuk mark bersarang berkali-kali.
function unwrapMarks(root: HTMLElement) {
  root.querySelectorAll("mark[data-review-mark]").forEach(mark => {
    const parent = mark.parentNode
    if (!parent) return
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  })
}

function highlightOne(root: HTMLElement, text: string, bg: string, border: string, onClick: () => void) {
  const target = text.trim()
  if (!target) return
  const lower = target.toLowerCase()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode() as Text | null
  while (node) {
    const idx = node.data.toLowerCase().indexOf(lower)
    if (idx === -1) { node = walker.nextNode() as Text | null; continue }
    const matchNode = node.splitText(idx)
    matchNode.splitText(target.length)
    const mark = document.createElement("mark")
    mark.setAttribute("data-review-mark", "1")
    mark.style.background = bg
    mark.style.boxShadow = `inset 0 -2px 0 ${border}`
    mark.style.borderRadius = "3px"
    mark.style.padding = "0 1px"
    mark.style.cursor = "pointer"
    mark.title = "Lihat komentar"
    mark.addEventListener("click", onClick)
    matchNode.parentNode?.insertBefore(mark, matchNode)
    mark.appendChild(matchNode)
    return
  }
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
  const [selection, setSelection] = useState<SelectionState | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerText, setComposerText] = useState("")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<"review" | "chat">("review")
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [chatLoading, setChatLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const previewWrapRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle()
      setAuthorName(profile?.full_name || user.email || "Reviewer")
    })()
  }, [])

  // Klik di luar area preview → tutup popover komentar yang lagi kebuka.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (previewWrapRef.current && !previewWrapRef.current.contains(e.target as Node)) {
        setSelection(null); setComposerOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Deteksi select teks pakai event "selectionchange" bawaan browser —
  // jauh lebih reliable daripada onMouseUp: kebaca buat semua cara select
  // (mouse drag, shift+klik, keyboard), dan nggak kena race timing kayak
  // mouseup. PENTING: pas selection COLLAPSE (mis. abis klik tombol
  // "Komentar" sendiri, yang natural ngilangin selection) kita SENGAJA
  // nggak nutup popovernya di sini — ini yang kemarin bikin bug "komentar
  // kedua dst nggak kesave" (popover kena tutup sendiri duluan sebelum
  // sempet ke-klik). Popover cuma ditutup eksplisit lewat Simpan/X, atau
  // kalau user mulai bikin selection BARU di tempat lain.
  useEffect(() => {
    const handler = () => {
      if (composerOpen) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
      if (!previewRef.current || !previewWrapRef.current) return
      const range = sel.getRangeAt(0)
      if (!previewRef.current.contains(range.commonAncestorContainer)) return
      const text = sel.toString().trim()
      if (!text) return
      // Buat selection PANJANG (nyebrang beberapa baris), bounding box
      // keseluruhan nggak pas buat posisi tombol (bisa jauh dari ujung
      // selection tempat mouse berhenti) — pakai client rect TERAKHIR
      // (baris paling akhir dari selection-nya) biar tombol muncul deket
      // posisi mouse-up yang sebenarnya.
      const rects = range.getClientRects()
      const rect = rects.length > 0 ? rects[rects.length - 1] : range.getBoundingClientRect()
      const wrapRect = previewWrapRef.current.getBoundingClientRect()
      setSelection({
        text,
        top: rect.top - wrapRect.top + previewWrapRef.current.scrollTop,
        left: Math.max(0, rect.left - wrapRect.left),
      })
      setComposerOpen(false)
      setComposerText("")
    }
    document.addEventListener("selectionchange", handler)
    return () => document.removeEventListener("selectionchange", handler)
  }, [composerOpen])

  // Re-apply highlight tiap kali dokumen/temuan/komentar berubah. Aman
  // dipanggil berkali-kali karena dangerouslySetInnerHTML cuma re-render
  // kalau string `html`-nya sendiri berubah — manipulasi DOM manual di sini
  // nggak bakal ketimpa React selama itu.
  useEffect(() => {
    const root = previewRef.current
    if (!root) return
    unwrapMarks(root)
    for (const f of findings) {
      if (f.status === "rejected") continue
      const anchor = anchorTextForSection(f.sectionKey, sections)
      const sev = SEVERITY_CFG[f.severity]
      highlightOne(root, anchor, sev.bg, sev.color, () => openCard(`finding-${f.id}`))
    }
    for (const c of userComments) {
      highlightOne(root, c.anchorText, USER_HL.bg, USER_HL.border, () => openCard(`usercomment-${c.id}`))
    }
  }, [html, findings, userComments, sections])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [chatMessages, chatLoading])

  const openCard = (domId: string) => {
    setDrawerTab("review")
    setDrawerOpen(true)
    setTimeout(() => {
      const el = document.getElementById(domId)
      if (!el) return
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.style.transition = "background 0.25s"
      const prevBg = el.style.background
      el.style.background = "var(--accent-light)"
      setTimeout(() => { el.style.background = prevBg }, 900)
    }, 150)
  }

  const reset = () => {
    setFile(null); setHtml(""); setSections([]); setFindings([]); setUserComments([]); setError("")
    setSelection(null); setComposerOpen(false); setDrawerOpen(false); setChatMessages([])
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
      setDrawerTab("review")
      setDrawerOpen(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal minta review AI")
    } finally {
      setAnalyzing(false)
    }
  }

  const setFindingStatus = (id: string, status: Finding["status"]) =>
    setFindings(prev => prev.map(f => (f.id === id ? { ...f, status } : f)))

  const submitComposer = () => {
    if (!selection || !composerText.trim()) return
    setUserComments(prev => [...prev, { id: crypto.randomUUID(), anchorText: selection.text, text: composerText.trim() }])
    setSelection(null); setComposerOpen(false); setComposerText("")
    window.getSelection()?.removeAllRanges()
  }

  const removeUserComment = (id: string) => setUserComments(prev => prev.filter(c => c.id !== id))

  const acceptedFindings = findings.filter(f => f.status === "accepted")
  const totalToExport = acceptedFindings.length + userComments.length
  const drawerBadge = findings.filter(f => f.status === "pending").length + userComments.length

  const handleExport = async () => {
    if (!file || totalToExport === 0) return
    setExporting(true)
    setError("")
    try {
      const comments = [
        ...acceptedFindings.map(f => ({ anchorText: anchorTextForSection(f.sectionKey, sections), author: "AI Reviewer", text: f.comment })),
        ...userComments.map(c => ({ anchorText: c.anchorText, author: authorName, text: c.text })),
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

  const sendChatMessage = async () => {
    const text = chatInput.trim()
    if (!text || chatLoading) return
    const next = [...chatMessages, { role: "user" as const, content: text }]
    setChatMessages(next)
    setChatInput("")
    setChatLoading(true)
    try {
      const res = await fetch("/api/review-document/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections, messages: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Gagal tanya AI")
      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply || "(nggak ada balasan)" }])
    } catch (e) {
      setChatMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Gagal tanya AI"}` }])
    } finally {
      setChatLoading(false)
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
          Upload dokumen Business Requirement (.docx) — AI bakal bertindak sebagai QC + Developer buat nyari hal yang ambigu, nggak konsisten, atau kurang jelas. Blok/select teks di dokumen buat nambah komentar sendiri, atau buka panel di kanan buat lihat temuan & tanya-jawab soal dokumennya.
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
          <div className="rd-toolbar" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", gap: "10px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "9px", minWidth: 0 }}>
              <FileText size={18} style={{ color: "var(--accent2)", flexShrink: 0 }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: "1 1 auto" }}>{file.name}</span>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={reset}><RotateCcw size={14} /> Ganti File</button>
              <button className="btn btn-primary" onClick={runAnalyze} disabled={analyzing}>
                {analyzing ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={14} />}
                {analyzing ? "AI sedang review..." : findings.length > 0 ? "Review Ulang" : "Minta AI Review"}
              </button>
            </div>
          </div>

          {/* ── Preview dokumen full-width (mockup kertas) ── */}
          <div className="card" style={{ padding: "0", overflow: "hidden" }}>
            <div className="rd-legend" style={{ padding: "12px 18px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Preview Dokumen
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "10.5px", color: "var(--text3)", fontWeight: 600, flexWrap: "wrap" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: SEVERITY_CFG.high.color, display: "inline-block" }} /> Tinggi</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: SEVERITY_CFG.medium.color, display: "inline-block" }} /> Sedang</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: SEVERITY_CFG.low.color, display: "inline-block" }} /> Rendah</span>
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: USER_HL.border, display: "inline-block" }} /> Komentar kamu</span>
              </div>
            </div>

            <div
              ref={previewWrapRef}
              style={{ position: "relative", maxHeight: "78vh", overflowY: "auto", padding: "32px 20px", background: "var(--surface3)" }}
            >
              <div
                ref={previewRef}
                className="docpreview"
                style={{
                  background: "#ffffff", maxWidth: "850px", margin: "0 auto", padding: "56px 64px",
                  minHeight: "500px", borderRadius: "2px", fontSize: "13.5px", lineHeight: 1.75,
                  color: "#1a1a1a", boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 10px 28px rgba(0,0,0,0.08)",
                }}
                dangerouslySetInnerHTML={{ __html: html }}
              />

              {selection && (
                <div style={{ position: "absolute", top: Math.max(4, selection.top - 42), left: selection.left, zIndex: 20 }}>
                  {!composerOpen ? (
                    <button
                      onClick={() => setComposerOpen(true)}
                      style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--accent)", color: "white", border: "none", borderRadius: "999px", padding: "7px 14px", fontSize: "12px", fontWeight: 700, cursor: "pointer", boxShadow: "0 6px 18px rgba(0,0,0,0.18)" }}
                    >
                      <MessageSquarePlus size={13} /> Komentar
                    </button>
                  ) : (
                    <div className="card" style={{ padding: "11px", width: "270px", boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
                      <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "7px", fontStyle: "italic", borderLeft: `3px solid ${USER_HL.border}`, paddingLeft: "8px" }}>
                        &ldquo;{selection.text.length > 70 ? selection.text.slice(0, 70) + "…" : selection.text}&rdquo;
                      </div>
                      <textarea
                        className="input" rows={2} autoFocus placeholder="Tulis komentar kamu..."
                        value={composerText} onChange={e => setComposerText(e.target.value)}
                        style={{ marginBottom: "7px", resize: "vertical" }}
                      />
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button className="btn btn-primary" onClick={submitComposer} disabled={!composerText.trim()} style={{ flex: 1, justifyContent: "center", padding: "7px" }}>Simpan</button>
                        <button className="btn btn-ghost" onClick={() => { setSelection(null); setComposerOpen(false) }} style={{ padding: "7px 10px" }}><X size={13} /></button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Tombol mengambang buat buka panel Review & Tanya AI ── */}
          <button
            className="rd-fab"
            onClick={() => setDrawerOpen(v => !v)}
            style={{
              position: "fixed", bottom: "26px", right: "26px", zIndex: 70,
              display: "flex", alignItems: "center", gap: "8px",
              background: "var(--accent)", color: "white", border: "none",
              borderRadius: "999px", padding: "13px 20px", fontSize: "13.5px", fontWeight: 700,
              cursor: "pointer", boxShadow: "0 10px 28px rgba(0,0,0,0.25)",
            }}
          >
            {drawerOpen ? <X size={17} /> : <PanelRightOpen size={17} />}
            <span className="rd-fab-label">{drawerOpen ? "Tutup Panel" : "Review & Tanya AI"}</span>
            {!drawerOpen && drawerBadge > 0 && (
              <span style={{ background: "white", color: "var(--accent)", borderRadius: "999px", fontSize: "11px", fontWeight: 800, minWidth: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>
                {drawerBadge}
              </span>
            )}
          </button>

          {/* ── Backdrop + Drawer (Review / Tanya AI) ── */}
          {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(10,10,8,0.35)", zIndex: 65 }} />}
          <div className="rd-drawer" style={{
            position: "fixed", top: 0, bottom: 0, right: 0, width: "440px", maxWidth: "92vw",
            background: "var(--surface)", boxShadow: "-8px 0 32px rgba(0,0,0,0.2)", zIndex: 70,
            display: "flex", flexDirection: "column",
            transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.28s cubic-bezier(0.34,1.1,0.64,1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid var(--border)", padding: "6px 10px 0" }}>
              <button
                onClick={() => setDrawerTab("review")}
                style={{ flex: 1, padding: "12px 8px", border: "none", background: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: drawerTab === "review" ? "var(--accent)" : "var(--text3)", borderBottom: drawerTab === "review" ? "2.5px solid var(--accent)" : "2.5px solid transparent" }}
              >
                Temuan &amp; Komentar
              </button>
              <button
                onClick={() => setDrawerTab("chat")}
                style={{ flex: 1, padding: "12px 8px", border: "none", background: "none", cursor: "pointer", fontSize: "13px", fontWeight: 700, color: drawerTab === "chat" ? "var(--accent)" : "var(--text3)", borderBottom: drawerTab === "chat" ? "2.5px solid var(--accent)" : "2.5px solid transparent", display: "flex", alignItems: "center", justifyContent: "center", gap: "5px" }}
              >
                <MessagesSquare size={14} /> Tanya AI
              </button>
              <button onClick={() => setDrawerOpen(false)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--text3)", padding: "10px 6px" }}><X size={16} /></button>
            </div>

            {drawerTab === "review" ? (
              <>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "14px" }}>
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
                            <div key={f.id} id={`finding-${f.id}`} style={{
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
                              <div style={{ fontSize: "13px", color: "var(--text)", marginTop: "7px", lineHeight: 1.55 }}>{renderFindingText(f.comment)}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}

                  {/* ── Komentar kamu (hasil select teks di preview) ── */}
                  {sections.length > 0 && (
                    <div className="card" style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: "12.5px", fontWeight: 800, color: "var(--text2)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <MessageSquarePlus size={14} /> Komentar Kamu
                      </div>
                      {userComments.length === 0 ? (
                        <div style={{ fontSize: "12.5px", color: "var(--text3)" }}>
                          💡 Blok/select kalimat di dokumen, lalu klik tombol <strong>Komentar</strong> yang muncul buat nambahin komentar kamu sendiri.
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {userComments.map(c => (
                            <div key={c.id} id={`usercomment-${c.id}`} style={{ display: "flex", justifyContent: "space-between", gap: "8px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "9px 11px", background: "#EFF6FF" }}>
                              <div>
                                <div style={{ fontSize: "11px", color: "var(--text3)", fontStyle: "italic", marginBottom: "3px" }}>
                                  &ldquo;{c.anchorText.length > 60 ? c.anchorText.slice(0, 60) + "…" : c.anchorText}&rdquo;
                                </div>
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
                </div>

                <div style={{ padding: "14px 16px", borderTop: "1px solid var(--border)" }}>
                  <button className="btn btn-primary" onClick={handleExport} disabled={totalToExport === 0 || exporting} style={{ width: "100%", justifyContent: "center", padding: "12px" }}>
                    {exporting ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={15} />}
                    {exporting ? "Menyiapkan file..." : `Download dengan Comment (${totalToExport})`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {chatMessages.length === 0 && (
                    <div style={{ fontSize: "12.5px", color: "var(--text3)", textAlign: "center", marginTop: "20px" }}>
                      💬 Tanya apa aja seputar isi dokumen ini — misal &ldquo;apa definisi historical salfo di dokumen ini?&rdquo;
                    </div>
                  )}
                  {chatMessages.map((m, i) => (
                    <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
                      <div style={{
                        background: m.role === "user" ? "var(--accent)" : "var(--surface2)",
                        color: m.role === "user" ? "white" : "var(--text)",
                        padding: "9px 13px", borderRadius: "var(--radius-sm)", fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap",
                      }}>
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: "6px", color: "var(--text3)", fontSize: "12.5px" }}>
                      <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> AI lagi mikir...
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: "12px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: "8px" }}>
                  <input
                    className="input" placeholder="Tanya seputar dokumen ini..."
                    value={chatInput} onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                  />
                  <button className="btn btn-primary" onClick={sendChatMessage} disabled={!chatInput.trim() || chatLoading} style={{ padding: "9px 12px" }}>
                    <Send size={15} />
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        .docpreview p{margin:0 0 11px}
        .docpreview a:empty{display:none}
        /* Heading section (Background/Product Scope/dst) dari Word keluar
           sebagai <li><strong>...</strong></li> di outline list bernomor,
           BUKAN <p> biasa — jadi target-nya <li>, dan khusus yang di luar
           tabel (:not(td *)) biar label tabel metadata nggak ikut ke-style. */
        .docpreview li:has(> strong:only-child):not(td *){
          margin:22px 0 10px; padding-bottom:6px; font-size:16px; font-weight:800;
          color:var(--accent); letter-spacing:.01em; border-bottom:2px solid var(--accent-light);
          list-style:none;
        }
        .docpreview ol:has(> li:has(> strong:only-child):not(td *)){ padding-left:0 }
        .docpreview table{ width:100%; border-collapse:collapse; margin:14px 0 20px; font-size:13px }
        .docpreview table td{ border:1px solid var(--border2); padding:9px 13px; vertical-align:top }
        .docpreview table td p{ margin:0 }
        .docpreview table tr td:first-child{ background:var(--surface2); width:28%; font-weight:600 }
        .docpreview ul, .docpreview ol{ margin:0 0 12px; padding-left:22px }
        .docpreview li{ margin-bottom:5px }

        @media (max-width: 720px) {
          .rd-toolbar { flex-direction: column !important; align-items: stretch !important; flex-wrap: nowrap !important; }
          .rd-toolbar > div:first-child { width: 100%; }
          .rd-legend { flex-direction: column; align-items: flex-start; }
          .docpreview { padding: 30px 18px !important; }
          .rd-drawer { width: 100vw !important; max-width: 100vw !important; }
          .rd-fab { right: 14px !important; bottom: 14px !important; padding: 13px 14px !important; }
          .rd-fab-label { display: none; }
        }
      `}</style>
    </div>
  )
}
