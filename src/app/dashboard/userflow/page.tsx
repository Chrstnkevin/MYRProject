"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import {
  Plus, Trash2, ChevronLeft, Save, Sparkles,
  FileCode, Eye, RefreshCw, Copy, Check, GitBranch, Wand2
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

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

// ── Render Mermaid ─────────────────────────────────────────────
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

// ── AI call ────────────────────────────────────────────────────
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

const DEFAULT_CODE = `flowchart TD
    A([Mulai]) --> B[Login SFA]
    B --> C{Autentikasi}
    C -->|Berhasil| D[Dashboard]
    C -->|Gagal| E[Tampilkan Error]
    E --> B
    D --> F([Selesai])`

const QUICK_EXAMPLES = [
  { label: "Login Flow",    prompt: "alur login user ke sistem SFA dengan validasi dan error handling" },
  { label: "Order Process", prompt: "proses order dari salesman input hingga konfirmasi distributor" },
  { label: "Survey Flow",   prompt: "alur survey tasklist salesman di outlet dari masuk hingga submit" },
  { label: "Approval Flow", prompt: "proses approval dokumen dari submission hingga approved atau rejected" },
]

const TEMPLATES = [
  {
    label: "Basic Flow",
    code: `flowchart TD\n    A([Mulai]) --> B[Langkah 1]\n    B --> C{Keputusan}\n    C -->|Ya| D[Proses A]\n    C -->|Tidak| E[Proses B]\n    D --> F([Selesai])\n    E --> F`,
  },
  {
    label: "Login Flow",
    code: `flowchart TD\n    A([Mulai]) --> B[Input Kredensial]\n    B --> C{Validasi}\n    C -->|Valid| D[Generate Token]\n    C -->|Gagal| E[Tampilkan Error]\n    E --> B\n    D --> F[Redirect Dashboard]\n    F --> G([Selesai])`,
  },
  {
    label: "Approval",
    code: `flowchart TD\n    A([Submit]) --> B[Review Manager]\n    B --> C{Keputusan}\n    C -->|Approved| D[Notif Disetujui]\n    C -->|Rejected| E[Notif Ditolak]\n    C -->|Revisi| F[Kembali ke User]\n    F --> A\n    D --> G([Selesai])\n    E --> G`,
  },
]

// ── Mini Preview ───────────────────────────────────────────────
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

// ── Main ──────────────────────────────────────────────────────
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
  const renderTimer               = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = async () => {
    const { data } = await supabase.from("user_flows").select("*").order("updated_at", { ascending: false })
    if (data) setFlows(data)
  }
  useEffect(() => { load() }, [])

  // Auto render on code change
  useEffect(() => {
    if (view !== "editor" || tab !== "preview") return
    if (renderTimer.current) clearTimeout(renderTimer.current)
    renderTimer.current = setTimeout(() => renderMermaid(code, "mmd-main"), 500)
    return () => { if (renderTimer.current) clearTimeout(renderTimer.current) }
  }, [code, tab, view])

  // Render when switch to preview
  useEffect(() => {
    if (tab === "preview" && view === "editor")
      setTimeout(() => renderMermaid(code, "mmd-main"), 100)
  }, [tab]) // eslint-disable-line

  // ── Generate AI ───────────────────────────────────────────────
  const generate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setGenErr("")
    try {
      const result = await callAI(
        `Kamu ahli Mermaid.js flowchart. 
ATURAN KETAT:
- Balas HANYA kode Mermaid, tanpa backtick, tanpa penjelasan
- Mulai dengan "flowchart TD" atau "flowchart LR"
- Node ID: huruf/angka/underscore SAJA, tanpa spasi
- Label: teks bebas dalam kurung kotak/diamond
- Maksimal 12 node
- Bahasa Indonesia`,
        `Buat flowchart untuk: ${prompt}`
      )
      if (result) {
        setCode(result)
        setTab("preview")
        if (!title) {
          const words = prompt.split(" ").slice(0, 4)
          setTitle(words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "))
        }
      }
    } catch {
      setGenErr("Gagal generate. Cek koneksi dan coba lagi.")
    }
    setGenerating(false)
  }

  // ── Save ──────────────────────────────────────────────────────
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

  const openNew = (prefillPrompt = "", prefillTitle = "") => {
    setSelected(null); setTitle(prefillTitle); setDescription(""); setPrompt(prefillPrompt)
    setCode(DEFAULT_CODE); setTab("preview"); setGenErr(""); setView("editor")
  }

  const openFlow = (flow: UserFlow) => {
    setSelected(flow); setTitle(flow.title); setDescription(flow.description || "")
    setPrompt(flow.prompt || ""); setCode(flow.content || DEFAULT_CODE)
    setTab("preview"); setGenErr(""); setView("editor")
  }

  const del = async (id: string) => {
    if (!confirm("Hapus flow ini?")) return
    await supabase.from("user_flows").delete().eq("id", id)
    load()
    if (selected?.id === id) { setSelected(null); setView("list") }
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

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 800 }}>User Flow Diagram</h2>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>
            Generate flowchart dari prompt AI, atau buat manual ✨
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => openNew()}>
          <Plus size={16} /> Buat Flow Baru
        </button>
      </div>

      {/* Quick examples */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
          <Wand2 size={12} /> Coba Generate Cepat
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {QUICK_EXAMPLES.map(ex => (
            <button key={ex.label} onClick={() => openNew(ex.prompt, ex.label)}
              style={{ padding: "6px 14px", borderRadius: "99px", border: "1.5px solid var(--accent-light)", background: "var(--accent-muted)", color: "var(--accent)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--accent-light)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--accent-muted)"}>
              ✦ {ex.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      {flows.length > 0 && (
        <input className="input" placeholder="🔍 Cari flow..." value={search} onChange={e => setSearch(e.target.value)} />
      )}

      {/* Flow cards */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <GitBranch size={40} color="var(--border2)" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "var(--text3)", fontWeight: 600 }}>{search ? "Tidak ada flow yang cocok" : "Belum ada flow diagram"}</p>
          {!search && (
            <>
              <p style={{ color: "var(--text3)", fontSize: "12px", marginTop: "6px" }}>Pilih contoh di atas atau buat dari nol.</p>
              <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={() => openNew()}>
                <Plus size={16} /> Buat Flow Pertama
              </button>
            </>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {filtered.map(flow => (
            <div key={flow.id} className="card card-hover" style={{ overflow: "hidden", cursor: "pointer" }} onClick={() => openFlow(flow)}>
              {/* Mini preview */}
              <div style={{ height: "130px", background: "linear-gradient(135deg, var(--accent-muted), #f0fdf4)", position: "relative", overflow: "hidden" }}>
                {flow.content ? <MiniPreview code={flow.content} id={flow.id} /> : <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><GitBranch size={32} color="var(--accent)" style={{ opacity: 0.3 }} /></div>}
                <button onClick={e => { e.stopPropagation(); del(flow.id) }}
                  style={{ position: "absolute", top: "8px", right: "8px", background: "white", border: "none", borderRadius: "6px", padding: "5px", cursor: "pointer", display: "flex", boxShadow: "var(--shadow-xs)" }}>
                  <Trash2 size={12} color="var(--danger)" />
                </button>
              </div>
              {/* Info */}
              <div style={{ padding: "12px 16px" }}>
                <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "3px" }}>{flow.title}</div>
                {flow.description && <p style={{ fontSize: "12px", color: "var(--text3)", lineHeight: 1.4, marginBottom: "6px" }}>{flow.description}</p>}
                {flow.prompt && (
                  <div style={{ fontSize: "10px", color: "var(--accent)", background: "var(--accent-muted)", padding: "2px 8px", borderRadius: "99px", display: "inline-block", marginBottom: "4px" }}>
                    🤖 {flow.prompt.slice(0, 45)}{flow.prompt.length > 45 ? "..." : ""}
                  </div>
                )}
                <div className="mono" style={{ fontSize: "10px", color: "var(--text3)", marginTop: "4px" }}>
                  {new Date(flow.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          ))}
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
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: "13px", flexShrink: 0 }} onClick={() => setView("list")}>
          <ChevronLeft size={15} /> Kembali
        </button>
        <input className="input" placeholder="Judul diagram..." value={title} onChange={e => setTitle(e.target.value)}
          style={{ flex: 1, minWidth: "180px", fontWeight: 700, fontSize: "14px" }} />
        <button className="btn btn-primary" onClick={save} disabled={saving || !title.trim()} style={{ flexShrink: 0 }}>
          {saving ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Menyimpan...</> : <><Save size={13} /> Simpan</>}
        </button>
      </div>

      {/* AI Prompt */}
      <div className="card" style={{ padding: "12px 16px", background: "var(--accent-muted)", border: "1px solid var(--accent-light)", flexShrink: 0 }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "5px" }}>
          <Wand2 size={12} /> GENERATE DENGAN AI — ketik prompt lalu Enter
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input className="input" placeholder="Contoh: alur proses approval dokumen dari submit hingga approved..."
            value={prompt} onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !generating && generate()}
            style={{ background: "white", flex: 1 }} />
          <button className="btn btn-primary" onClick={generate} disabled={generating || !prompt.trim()} style={{ flexShrink: 0 }}>
            {generating ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Generating...</> : <><Sparkles size={14} /> Generate</>}
          </button>
        </div>
        {genErr && <div style={{ fontSize: "12px", color: "var(--danger)", marginTop: "6px" }}>{genErr}</div>}
      </div>

      {/* Editor area */}
      <div style={{ display: "flex", gap: "12px", flex: 1, minHeight: 0 }}>

        {/* Main: preview / code */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
          {/* Tabs */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: "4px", background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "3px" }}>
              {([{ key: "preview" as EditorTab, icon: Eye, label: "Preview" }, { key: "code" as EditorTab, icon: FileCode, label: "Edit Code" }]).map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setTab(key)}
                  style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif", transition: "all .15s", background: tab === key ? "var(--surface)" : "transparent", color: tab === key ? "var(--text)" : "var(--text3)", boxShadow: tab === key ? "var(--shadow-xs)" : "none" }}>
                  <Icon size={13} />{label}
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

          {/* Content */}
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
              <textarea value={code} onChange={e => setCode(e.target.value)}
                className="input mono"
                style={{ flex: 1, resize: "none", fontSize: "12px", lineHeight: 1.8, minHeight: "200px" }}
                placeholder="Tulis kode Mermaid di sini..." spellCheck={false} />
              <p style={{ fontSize: "11px", color: "var(--text3)", marginTop: "6px" }}>
                💡 Edit kode lalu switch ke <strong>Preview</strong> untuk lihat hasilnya.
              </p>
            </div>
          )}
        </div>

        {/* Right panel */}
        <div style={{ width: "220px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px", overflowY: "auto" }}>

          {/* Description */}
          <div className="card" style={{ padding: "14px" }}>
            <div className="label" style={{ marginBottom: "7px" }}>Deskripsi</div>
            <textarea className="input" rows={3} placeholder="Deskripsi singkat..." value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          {/* Templates */}
          <div className="card" style={{ padding: "14px" }}>
            <div className="label" style={{ marginBottom: "10px" }}>⚡ Template</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {TEMPLATES.map(t => (
                <button key={t.label} onClick={() => { setCode(t.code); setTab("preview") }}
                  style={{ padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "transparent", color: "var(--text2)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans',sans-serif", textAlign: "left", transition: "all .15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--bg)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cheatsheet */}
          <div className="card" style={{ padding: "14px" }}>
            <div className="label" style={{ marginBottom: "10px" }}>📖 Syntax</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {[
                { code: "[Proses]", desc: "Kotak" },
                { code: "{Keputusan}", desc: "Diamond" },
                { code: "([Start])", desc: "Oval" },
                { code: "A --> B", desc: "Panah" },
                { code: "A -->|Ya| B", desc: "Panah label" },
              ].map(({ code: c, desc }) => (
                <div key={c} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                  <code style={{ fontSize: "10px", background: "var(--bg)", padding: "2px 6px", borderRadius: "4px", color: "var(--accent)", fontFamily: "monospace", flexShrink: 0 }}>{c}</code>
                  <span style={{ fontSize: "11px", color: "var(--text3)" }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}