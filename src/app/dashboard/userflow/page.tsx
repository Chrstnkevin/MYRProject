"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import {
  Plus, Trash2, ChevronLeft, Save, Sparkles,
  FileCode, Eye, RefreshCw, Copy, Check,
  GitBranch, Wand2, MousePointer, X, ArrowRight,
  Circle, Square, Diamond, Minus
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Types ────────────────────────────────────────────────────
interface UserFlow {
  id: string
  title: string
  description?: string
  prompt?: string
  content?: string
  tags?: string[]
  created_at: string
  updated_at: string
}

type View = "list" | "editor"
type EditorTab = "preview" | "code"
type CreateMode = "manual" | "ai"

// ── Manual builder node types ─────────────────────────────────
type NodeType = "start" | "end" | "process" | "decision" | "arrow" | "divider"

interface BuilderNode {
  id: string
  type: NodeType
  label: string
  connectTo?: string   // id node yang dituju
  connectLabel?: string
  altConnectTo?: string  // untuk decision: path "tidak"
  altConnectLabel?: string
}

// ── Render Mermaid ────────────────────────────────────────────
async function renderMermaid(code: string, containerId: string) {
  const mermaid = (await import("mermaid")).default
  mermaid.initialize({
    startOnLoad: false,
    theme: "base",
    themeVariables: {
      primaryColor: "#d8f3dc",
      primaryTextColor: "#1a1a18",
      primaryBorderColor: "#2d6a4f",
      lineColor: "#40916c",
      secondaryColor: "#f0fdf4",
      fontSize: "14px",
    },
  })
  const el = document.getElementById(containerId)
  if (!el) return
  el.innerHTML = ""
  try {
    const uid = `mmd-${Date.now()}`
    const { svg } = await mermaid.render(uid, code.trim())
    el.innerHTML = svg
    const svgEl = el.querySelector("svg")
    if (svgEl) { svgEl.style.width = "100%"; svgEl.style.height = "auto" }
  } catch (err) {
    el.innerHTML = `<div style="color:#c0392b;padding:16px;font-size:12px;background:#fde8e8;border-radius:8px;font-family:monospace;white-space:pre-wrap;">⚠️ Syntax error:\n${String(err)}</div>`
  }
}

// ── Convert builder nodes to Mermaid ─────────────────────────
function nodesToMermaid(nodes: BuilderNode[]): string {
  if (nodes.length === 0) return "flowchart TD\n    A([Mulai])"

  const lines: string[] = ["flowchart TD"]

  // Define nodes
  nodes.forEach(n => {
    const safeId = n.id
    const label = n.label || "..."
    switch (n.type) {
      case "start":
      case "end":
        lines.push(`    ${safeId}(["${label}"])`)
        break
      case "process":
        lines.push(`    ${safeId}["${label}"]`)
        break
      case "decision":
        lines.push(`    ${safeId}{"${label}"}`)
        break
      case "divider":
        lines.push(`    ${safeId}(("${label}"))`)
        break
    }
  })

  // Define connections
  nodes.forEach(n => {
    if (n.connectTo) {
      const target = nodes.find(x => x.id === n.connectTo)
      if (target) {
        const lbl = n.connectLabel ? `|${n.connectLabel}|` : ""
        lines.push(`    ${n.id} -->${lbl} ${n.connectTo}`)
      }
    }
    if (n.type === "decision" && n.altConnectTo) {
      const alt = nodes.find(x => x.id === n.altConnectTo)
      if (alt) {
        const lbl = n.altConnectLabel ? `|${n.altConnectLabel}|` : "|Tidak|"
        lines.push(`    ${n.id} -->${lbl} ${n.altConnectTo}`)
      }
    }
  })

  return lines.join("\n")
}

// ── AI call ──────────────────────────────────────────────────
async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userPrompt }),
  })
  if (!res.ok) throw new Error("AI call failed")
  const data = await res.json()
  return (data.text || "").replace(/```mermaid|```/g, "").trim()
}

const DEFAULT_CODE = `flowchart TD\n    A(["Mulai"]) --> B["Langkah 1"]\n    B --> C{"Keputusan"}\n    C -->|Ya| D["Proses A"]\n    C -->|Tidak| E["Proses B"]\n    D --> F(["Selesai"])\n    E --> F`

const QUICK_EXAMPLES = [
  { label: "Login Flow",    prompt: "alur login user ke sistem SFA dengan validasi dan error handling" },
  { label: "Order Process", prompt: "proses order dari salesman input hingga konfirmasi distributor" },
  { label: "Survey Flow",   prompt: "alur survey tasklist salesman di outlet dari masuk hingga submit" },
  { label: "Approval Flow", prompt: "proses approval dokumen dari submission hingga approved atau rejected" },
]

// ── Mini Preview ─────────────────────────────────────────────
function MiniPreview({ code, id }: { code: string; id: string }) {
  const cid = `mini-${id}`
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const mermaid = (await import("mermaid")).default
        mermaid.initialize({ startOnLoad: false, theme: "base", themeVariables: { fontSize: "9px" } })
        const el = document.getElementById(cid)
        if (!el) return
        const { svg } = await mermaid.render(`mini-r-${id}-${Date.now()}`, code.trim())
        el.innerHTML = svg
        const s = el.querySelector("svg")
        if (s) { s.style.width = "100%"; s.style.height = "auto"; s.style.maxHeight = "110px" }
      } catch { /* silent */ }
    }, 300)
    return () => clearTimeout(t)
  }, [code, cid, id])

  return (
    <div id={cid} style={{ width: "100%", height: "100%", padding: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <GitBranch size={24} color="var(--accent)" style={{ opacity: 0.25 }} />
    </div>
  )
}

// ── NODE SHAPE ICONS ─────────────────────────────────────────
const NODE_TYPES: { type: NodeType; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
  { type: "start",    label: "Start/End",  icon: <Circle size={16} />,   desc: "Titik awal atau akhir", color: "#2d6a4f" },
  { type: "process",  label: "Proses",     icon: <Square size={16} />,   desc: "Langkah/aksi",          color: "#1e40af" },
  { type: "decision", label: "Keputusan",  icon: <Diamond size={16} />,  desc: "Percabangan if/else",   color: "#b45309" },
  { type: "divider",  label: "Konektor",   icon: <Circle size={12} />,   desc: "Titik penghubung",      color: "#6b7280" },
]

// ════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════
export default function UserFlowPage() {
  const [flows, setFlows]         = useState<UserFlow[]>([])
  const [view, setView]           = useState<View>("list")
  const [selected, setSelected]   = useState<UserFlow | null>(null)
  const [tab, setTab]             = useState<EditorTab>("preview")
  const [code, setCode]           = useState(DEFAULT_CODE)
  const [title, setTitle]         = useState("")
  const [description, setDescription] = useState("")
  const [prompt, setPrompt]       = useState("")
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [copied, setCopied]       = useState(false)
  const [genErr, setGenErr]       = useState("")
  const [search, setSearch]       = useState("")

  // Create mode popup
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createMode, setCreateMode] = useState<CreateMode | null>(null)

  // AI prompt in popup
  const [popupPrompt, setPopupPrompt] = useState("")
  const [popupTitle, setPopupTitle]   = useState("")

  // Manual builder
  const [nodes, setNodes]           = useState<BuilderNode[]>([])
  const [editingNode, setEditingNode] = useState<BuilderNode | null>(null)
  const [showNodeEdit, setShowNodeEdit] = useState(false)

  const renderTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async () => {
    const { data } = await supabase.from("user_flows").select("*").order("updated_at", { ascending: false })
    if (data) setFlows(data)
  }
  useEffect(() => { load() }, [])

  // Auto render
  useEffect(() => {
    if (view !== "editor" || tab !== "preview") return
    if (renderTimer.current) clearTimeout(renderTimer.current)
    renderTimer.current = setTimeout(() => renderMermaid(code, "mmd-main"), 500)
    return () => { if (renderTimer.current) clearTimeout(renderTimer.current) }
  }, [code, tab, view])

  useEffect(() => {
    if (tab === "preview" && view === "editor")
      setTimeout(() => renderMermaid(code, "mmd-main"), 100)
  }, [tab]) // eslint-disable-line

  // Sync nodes → code
  useEffect(() => {
    if (createMode === "manual" && nodes.length > 0) {
      setCode(nodesToMermaid(nodes))
    }
  }, [nodes, createMode])

  // ── Handlers ─────────────────────────────────────────────────
  const openCreateModal = () => {
    setShowCreateModal(true)
    setCreateMode(null)
    setPopupPrompt("")
    setPopupTitle("")
  }

  const startManual = () => {
    setSelected(null)
    setTitle(popupTitle || "Flow Baru")
    setDescription("")
    setPrompt("")
    setCreateMode("manual")
    // Init with start node
    const startNode: BuilderNode = { id: "A", type: "start", label: "Mulai" }
    setNodes([startNode])
    setCode(nodesToMermaid([startNode]))
    setTab("preview")
    setGenErr("")
    setShowCreateModal(false)
    setView("editor")
  }

  const startAI = async () => {
    if (!popupPrompt.trim()) return
    setShowCreateModal(false)
    setSelected(null)
    setTitle(popupTitle || popupPrompt.split(" ").slice(0, 4).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))
    setDescription("")
    setPrompt(popupPrompt)
    setCreateMode("ai")
    setCode(DEFAULT_CODE)
    setTab("preview")
    setGenErr("")
    setNodes([])
    setView("editor")
    // Auto generate
    setGenerating(true)
    try {
      const result = await callAI(
        `Kamu ahli Mermaid.js flowchart. ATURAN: Balas HANYA kode Mermaid tanpa backtick. Mulai dengan "flowchart TD". Node ID: huruf/angka/underscore saja. Maksimal 12 node. Bahasa Indonesia.`,
        `Buat flowchart untuk: ${popupPrompt}`
      )
      if (result) setCode(result)
    } catch { setGenErr("Gagal generate. Coba lagi.") }
    setGenerating(false)
  }

  const openFlow = (flow: UserFlow) => {
    setSelected(flow)
    setTitle(flow.title)
    setDescription(flow.description || "")
    setPrompt(flow.prompt || "")
    setCode(flow.content || DEFAULT_CODE)
    setCreateMode("ai")
    setNodes([])
    setTab("preview")
    setGenErr("")
    setView("editor")
  }

  const regenerate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setGenErr("")
    try {
      const result = await callAI(
        `Kamu ahli Mermaid.js flowchart. ATURAN: Balas HANYA kode Mermaid tanpa backtick. Mulai dengan "flowchart TD". Node ID: huruf/angka/underscore saja. Maksimal 12 node. Bahasa Indonesia.`,
        `Buat flowchart untuk: ${prompt}`
      )
      if (result) { setCode(result); setTab("preview") }
    } catch { setGenErr("Gagal generate. Coba lagi.") }
    setGenerating(false)
  }

  const save = async () => {
    if (!title.trim()) { alert("Isi judul dulu!"); return }
    setSaving(true)
    const payload = { title: title.trim(), description, prompt, content: code, updated_at: new Date().toISOString() }
    if (selected?.id) {
      await supabase.from("user_flows").update(payload).eq("id", selected.id)
      setSelected(s => s ? { ...s, ...payload } : null)
    } else {
      const { data } = await supabase.from("user_flows").insert([payload]).select().single()
      if (data) setSelected(data)
    }
    setSaving(false)
    load()
  }

  const del = async (id: string) => {
    if (!confirm("Hapus flow ini?")) return
    await supabase.from("user_flows").delete().eq("id", id)
    load()
    if (selected?.id === id) { setSelected(null); setView("list") }
  }

  // ── Manual builder helpers ───────────────────────────────────
  const addNode = (type: NodeType) => {
    const id = String.fromCharCode(65 + nodes.length) + (nodes.length >= 26 ? nodes.length : "")
    const defaultLabels: Record<NodeType, string> = {
      start: nodes.length === 0 ? "Mulai" : "Selesai",
      end: "Selesai",
      process: "Proses",
      decision: "Keputusan?",
      arrow: "",
      divider: "●",
    }
    const newNode: BuilderNode = { id, type, label: defaultLabels[type] }
    // Auto connect to previous node
    if (nodes.length > 0) {
      const prev = nodes[nodes.length - 1]
      if (!prev.connectTo && prev.type !== "decision") {
        setNodes(ns => ns.map((n, i) => i === ns.length - 1 ? { ...n, connectTo: id } : n))
      }
    }
    setNodes(ns => [...ns, newNode])
    // Open edit immediately
    setEditingNode(newNode)
    setShowNodeEdit(true)
  }

  const updateNode = (id: string, updates: Partial<BuilderNode>) => {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, ...updates } : n))
  }

  const deleteNode = (id: string) => {
    setNodes(ns => ns
      .filter(n => n.id !== id)
      .map(n => ({
        ...n,
        connectTo: n.connectTo === id ? undefined : n.connectTo,
        altConnectTo: n.altConnectTo === id ? undefined : n.altConnectTo,
      }))
    )
  }

  const filtered = flows.filter(f =>
    f.title.toLowerCase().includes(search.toLowerCase()) ||
    f.description?.toLowerCase().includes(search.toLowerCase())
  )


    // ════════════════════════════════════════════════════════════
  // LIST VIEW
  // ════════════════════════════════════════════════════════════
  if (view === "list") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="animate-fade">
      <MotivationBanner page="userflow" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 800 }}>User Flow Diagram</h2>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>Buat flowchart manual atau generate dengan AI ✨</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> Buat Flow Baru
        </button>
      </div>

      {flows.length > 0 && (
        <input className="input" placeholder="🔍 Cari flow..." value={search} onChange={e => setSearch(e.target.value)} />
      )}

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <GitBranch size={40} color="var(--border2)" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "var(--text3)", fontWeight: 600 }}>{search ? "Tidak ada flow yang cocok" : "Belum ada flow diagram"}</p>
          {!search && (
            <>
              <p style={{ color: "var(--text3)", fontSize: "12px", marginTop: "6px" }}>Buat manual atau generate otomatis dengan AI.</p>
              <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={openCreateModal}>
                <Plus size={16} /> Buat Flow Pertama
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {filtered.map(flow => (
            <div key={flow.id} className="card card-hover" style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => openFlow(flow)}>
              <div style={{ height: "130px", background: "linear-gradient(135deg, var(--accent-muted), #f0fdf4)", position: "relative", overflow: "hidden" }}>
                {flow.content ? <MiniPreview code={flow.content} id={flow.id} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><GitBranch size={32} color="var(--accent)" style={{ opacity: 0.3 }} /></div>}
                <button onClick={e => { e.stopPropagation(); del(flow.id) }}
                  style={{ position: "absolute", top: "8px", right: "8px", background: "white", border: "none", borderRadius: "6px", padding: "5px", cursor: "pointer", display: "flex", boxShadow: "var(--shadow-xs)" }}>
                  <Trash2 size={12} color="var(--danger)" />
                </button>
                {/* Badge mode */}
                <div style={{ position: "absolute", top: "8px", left: "8px", background: "white", borderRadius: "99px", padding: "2px 8px", fontSize: "10px", fontWeight: 700, color: flow.prompt ? "var(--accent)" : "#1e40af", boxShadow: "var(--shadow-xs)" }}>
                  {flow.prompt ? "🤖 AI" : "✏️ Manual"}
                </div>
              </div>
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "3px" }}>{flow.title}</div>
                {flow.description && <p style={{ fontSize: "12px", color: "var(--text3)", lineHeight: 1.4, marginBottom: "4px" }}>{flow.description}</p>}
                <div className="mono" style={{ fontSize: "10px", color: "var(--text3)", marginTop: "4px" }}>
                  {new Date(flow.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px", padding: 0, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "17px" }}>Buat User Flow Baru</div>
                <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>Pilih cara membuat diagram</div>
              </div>
              <button onClick={() => setShowCreateModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: "4px" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "20px 24px" }}>
              <div style={{ marginBottom: "20px" }}>
                <div className="label" style={{ marginBottom: "6px" }}>Judul Flow (opsional)</div>
                <input className="input" placeholder="Contoh: Login Flow, Approval Process..." value={popupTitle} onChange={e => setPopupTitle(e.target.value)} />
              </div>
              {!createMode && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <button onClick={() => setCreateMode("manual")}
                    style={{ padding: "20px 16px", borderRadius: "var(--radius)", border: "2px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "left", transition: "all 0.2s", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--accent)"; el.style.background = "var(--accent-muted)" }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.background = "var(--surface)" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                      <MousePointer size={20} color="#1e40af" />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>Manual</div>
                    <div style={{ fontSize: "12px", color: "var(--text3)", lineHeight: 1.5 }}>Buat sendiri dengan shape: kotak, diamond, oval, konektor</div>
                  </button>
                  <button onClick={() => setCreateMode("ai")}
                    style={{ padding: "20px 16px", borderRadius: "var(--radius)", border: "2px solid var(--border)", background: "var(--surface)", cursor: "pointer", textAlign: "left", transition: "all 0.2s", fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--accent)"; el.style.background = "var(--accent-muted)" }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "var(--border)"; el.style.background = "var(--surface)" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                      <Sparkles size={20} color="var(--accent)" />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>AI Generate</div>
                    <div style={{ fontSize: "12px", color: "var(--text3)", lineHeight: 1.5 }}>Ketik prompt singkat, AI generate flowchart otomatis</div>
                  </button>
                </div>
              )}
              {createMode === "manual" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <button onClick={() => setCreateMode(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "12px", textAlign: "left", padding: 0 }}>← Kembali pilih mode</button>
                  <div style={{ padding: "16px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>Kamu akan membuat diagram dengan:</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {[
                        { icon: <Circle size={14} color="#2d6a4f" />, text: "Start/End — oval untuk titik awal & akhir" },
                        { icon: <Square size={14} color="#1e40af" />, text: "Proses — kotak untuk langkah/aksi" },
                        { icon: <Diamond size={14} color="#b45309" />, text: "Keputusan — diamond untuk percabangan" },
                        { icon: <Minus size={14} color="#6b7280" />, text: "Konektor — titik penghubung" },
                      ].map(({ icon, text }) => (
                        <div key={text} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text2)" }}>
                          {icon} {text}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ justifyContent: "center", padding: "12px" }} onClick={startManual}>
                    <MousePointer size={16} /> Mulai Buat Manual
                  </button>
                </div>
              )}
              {createMode === "ai" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <button onClick={() => setCreateMode(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "12px", textAlign: "left", padding: 0 }}>← Kembali pilih mode</button>
                  <div>
                    <div className="label" style={{ marginBottom: "6px" }}>Ceritakan flow yang ingin dibuat *</div>
                    <textarea className="input" rows={3}
                      placeholder="Contoh: alur login user ke SFA dengan validasi credential..."
                      value={popupPrompt} onChange={e => setPopupPrompt(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && e.ctrlKey && startAI()} />
                    <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "4px" }}>Ctrl+Enter untuk generate</div>
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: "8px" }}>Contoh cepat:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {QUICK_EXAMPLES.map(ex => (
                        <button key={ex.label} onClick={() => { setPopupPrompt(ex.prompt); if (!popupTitle) setPopupTitle(ex.label) }}
                          style={{ padding: "4px 12px", borderRadius: "99px", border: "1px solid var(--accent-light)", background: "var(--accent-muted)", color: "var(--accent)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                          {ex.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ justifyContent: "center", padding: "12px" }} onClick={startAI} disabled={!popupPrompt.trim()}>
                    <Sparkles size={16} /> Generate dengan AI
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ════════════════════════════════════════════════════════════
  // EDITOR VIEW
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "calc(100vh - 100px)" }} className="animate-fade">

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", flexShrink: 0 }}>
        <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: "13px", flexShrink: 0 }} onClick={() => setView("list")}>
          <ChevronLeft size={15} /> Kembali
        </button>
        <input className="input" placeholder="Judul diagram..." value={title} onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, minWidth: "180px", fontWeight: 700, fontSize: "14px" }} />
        <button className="btn btn-primary" onClick={save} disabled={saving || !title.trim()} style={{ flexShrink: 0 }}>
          {saving ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Menyimpan...</> : <><Save size={13} /> Simpan</>}
        </button>
      </div>

      {/* AI regenerate bar (only for AI mode) */}
      {createMode === "ai" && (
        <div className="card" style={{ padding: "10px 14px", background: "var(--accent-muted)", border: "1px solid var(--accent-light)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <Wand2 size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
            <input className="input" placeholder="Edit prompt lalu Generate ulang..." value={prompt}
              onChange={e => setPrompt(e.target.value)} onKeyDown={e => e.key === "Enter" && !generating && regenerate()}
              style={{ background: "white", flex: 1, fontSize: "13px" }} />
            <button className="btn btn-primary" onClick={regenerate} disabled={generating || !prompt.trim()} style={{ flexShrink: 0, fontSize: "12px" }}>
              {generating ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><Sparkles size={13} /> Generate Ulang</>}
            </button>
          </div>
          {genErr && <div style={{ fontSize: "12px", color: "var(--danger)", marginTop: "6px" }}>{genErr}</div>}
        </div>
      )}

      {/* Manual builder toolbar */}
      {createMode === "manual" && (
        <div className="card" style={{ padding: "10px 14px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
              <MousePointer size={11} style={{ display: "inline", marginRight: "4px" }} /> Tambah Shape:
            </span>
            {NODE_TYPES.map(nt => (
              <button key={nt.type} onClick={() => addNode(nt.type)}
                title={nt.desc}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "var(--radius-sm)", border: `1.5px solid ${nt.color}30`, background: `${nt.color}10`, color: nt.color, cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "all .15s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = `${nt.color}20`}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = `${nt.color}10`}>
                {nt.icon} {nt.label}
              </button>
            ))}
            {nodes.length > 0 && (
              <span style={{ fontSize: "11px", color: "var(--text3)", marginLeft: "auto" }}>
                {nodes.length} node — klik node untuk edit koneksi
              </span>
            )}
          </div>
        </div>
      )}

      {/* Editor area */}
      <div style={{ display: "flex", gap: "12px", flex: 1, minHeight: 0 }}>

        {/* Left: manual node list (only manual mode) */}
        {createMode === "manual" && (
          <div style={{ width: "220px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Node List</div>
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {nodes.length === 0 ? (
                <div style={{ padding: "20px", textAlign: "center", color: "var(--text3)", fontSize: "12px", background: "var(--surface)", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border2)" }}>
                  Tambah shape dari toolbar di atas
                </div>
              ) : nodes.map((node, idx) => {
                const nt = NODE_TYPES.find(x => x.type === node.type)
                return (
                  <div key={node.id}
                    style={{ padding: "8px 10px", background: "var(--surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", cursor: "pointer", transition: "all .15s" }}
                    onClick={() => { setEditingNode(node); setShowNodeEdit(true) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                      <span style={{ color: nt?.color, flexShrink: 0 }}>{nt?.icon}</span>
                      <span style={{ fontSize: "12px", fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{node.label}</span>
                      <span className="mono" style={{ fontSize: "10px", color: "var(--text3)", background: "var(--bg)", padding: "1px 5px", borderRadius: "4px" }}>{node.id}</span>
                      <button onClick={e => { e.stopPropagation(); deleteNode(node.id) }}
                        style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "2px", flexShrink: 0 }}>
                        <X size={12} />
                      </button>
                    </div>
                    {node.connectTo && (
                      <div style={{ fontSize: "10px", color: "var(--text3)", display: "flex", alignItems: "center", gap: "3px" }}>
                        <ArrowRight size={10} /> {node.connectTo} {node.connectLabel && `(${node.connectLabel})`}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Main: preview / code */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "4px", background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "3px" }}>
              {([{ key: "preview" as EditorTab, icon: Eye, label: "Preview" }, { key: "code" as EditorTab, icon: FileCode, label: "Edit Code" }]).map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "all .15s", background: tab === key ? "var(--surface)" : "transparent", color: tab === key ? "var(--text)" : "var(--text3)", boxShadow: tab === key ? "var(--shadow-xs)" : "none" }}>
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>
            {tab === "code" && (
              <button className="btn btn-ghost" style={{ fontSize: "11px", padding: "5px 10px" }}
                onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}>
                {copied ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
              </button>
            )}
          </div>

          {tab === "preview" ? (
            <div className="card" style={{ flex: 1, padding: "20px", overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
              {generating ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "12px" }}>
                  <RefreshCw size={32} style={{ animation: "spin 1s linear infinite" }} color="var(--accent)" />
                  <span style={{ fontSize: "14px", fontWeight: 600, color: "var(--accent)" }}>AI sedang menggambar flowchart...</span>
                </div>
              ) : (
                <div id="mmd-main" style={{ width: "100%", minHeight: "200px" }} />
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
              <textarea value={code} onChange={e => { setCode(e.target.value); setCreateMode("ai") }}
                className="input mono"
                style={{ flex: 1, resize: "none", fontSize: "12px", lineHeight: 1.8, minHeight: "200px" }}
                spellCheck={false} />
              <p style={{ fontSize: "11px", color: "var(--text3)", marginTop: "6px" }}>
                💡 Edit kode lalu switch ke <strong>Preview</strong>.
              </p>
            </div>
          )}
        </div>

        {/* Right: info + cheatsheet (non-manual) */}
        {createMode !== "manual" && (
          <div style={{ width: "200px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>
            <div className="card" style={{ padding: "14px" }}>
              <div className="label" style={{ marginBottom: "7px" }}>Deskripsi</div>
              <textarea className="input" rows={3} placeholder="Deskripsi singkat..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="card" style={{ padding: "14px" }}>
              <div className="label" style={{ marginBottom: "10px" }}>📖 Syntax</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                {[
                  { c: '["Proses"]', d: "Kotak" },
                  { c: '{"Keputusan"}', d: "Diamond" },
                  { c: '(["Start"])', d: "Oval" },
                  { c: "A --> B", d: "Panah" },
                  { c: "A -->|Ya| B", d: "Label" },
                ].map(({ c, d }) => (
                  <div key={c} style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                    <code style={{ fontSize: "10px", background: "var(--bg)", padding: "2px 5px", borderRadius: "4px", color: "var(--accent)", fontFamily: "monospace" }}>{c}</code>
                    <span style={{ fontSize: "11px", color: "var(--text3)" }}>{d}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right: description for manual mode */}
        {createMode === "manual" && (
          <div style={{ width: "200px", flexShrink: 0 }}>
            <div className="card" style={{ padding: "14px" }}>
              <div className="label" style={{ marginBottom: "7px" }}>Deskripsi</div>
              <textarea className="input" rows={4} placeholder="Deskripsi singkat..." value={description} onChange={e => setDescription(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {/* Node edit popup (manual mode) */}
      {showNodeEdit && editingNode && (
        <div className="modal-overlay" onClick={() => setShowNodeEdit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "400px" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>Edit Node {editingNode.id}</span>
              <button onClick={() => setShowNodeEdit(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)" }}><X size={16} /></button>
            </div>
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div className="label" style={{ marginBottom: "5px" }}>Label</div>
                <input className="input" value={editingNode.label} onChange={e => { setEditingNode({ ...editingNode, label: e.target.value }); updateNode(editingNode.id, { label: e.target.value }) }} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "5px" }}>Sambungkan ke (arrow utama)</div>
                <select className="input" value={editingNode.connectTo || ""}
                  onChange={e => { setEditingNode({ ...editingNode, connectTo: e.target.value || undefined }); updateNode(editingNode.id, { connectTo: e.target.value || undefined }) }}>
                  <option value="">— Tidak ada —</option>
                  {nodes.filter(n => n.id !== editingNode.id).map(n => (
                    <option key={n.id} value={n.id}>{n.id}: {n.label}</option>
                  ))}
                </select>
              </div>
              {editingNode.connectTo && (
                <div>
                  <div className="label" style={{ marginBottom: "5px" }}>Label arrow (opsional)</div>
                  <input className="input" placeholder="Ya / Berhasil / ..." value={editingNode.connectLabel || ""} onChange={e => { setEditingNode({ ...editingNode, connectLabel: e.target.value }); updateNode(editingNode.id, { connectLabel: e.target.value }) }} />
                </div>
              )}
              {editingNode.type === "decision" && (
                <>
                  <div>
                    <div className="label" style={{ marginBottom: "5px" }}>Sambungkan ke (arrow alternatif)</div>
                    <select className="input" value={editingNode.altConnectTo || ""}
                      onChange={e => { setEditingNode({ ...editingNode, altConnectTo: e.target.value || undefined }); updateNode(editingNode.id, { altConnectTo: e.target.value || undefined }) }}>
                      <option value="">— Tidak ada —</option>
                      {nodes.filter(n => n.id !== editingNode.id).map(n => (
                        <option key={n.id} value={n.id}>{n.id}: {n.label}</option>
                      ))}
                    </select>
                  </div>
                  {editingNode.altConnectTo && (
                    <div>
                      <div className="label" style={{ marginBottom: "5px" }}>Label arrow alternatif</div>
                      <input className="input" placeholder="Tidak / Gagal / ..." value={editingNode.altConnectLabel || "Tidak"} onChange={e => { setEditingNode({ ...editingNode, altConnectLabel: e.target.value }); updateNode(editingNode.id, { altConnectLabel: e.target.value }) }} />
                    </div>
                  )}
                </>
              )}
              <button className="btn btn-primary" onClick={() => setShowNodeEdit(false)}>Selesai</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}