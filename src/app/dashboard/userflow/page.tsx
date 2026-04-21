"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { UserFlow } from "@/lib/types"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { Plus, GitBranch, Trash2, ExternalLink, X, Edit3, ChevronLeft, Layers, Search } from "lucide-react"

type ViewMode = "list" | "editor"

const TOOLS = [
  { name: "Excalidraw", url: "https://excalidraw.com", desc: "Whiteboard diagram & sketching", emoji: "✏️", color: "#6c63ff" },
  { name: "draw.io", url: "https://app.diagrams.net", desc: "Professional flowchart & UML", emoji: "📐", color: "#f08705" },
  { name: "Miro", url: "https://miro.com/app/dashboard", desc: "Collaborative mind mapping", emoji: "🧩", color: "#ffdd00" },
  { name: "Figma FigJam", url: "https://www.figma.com/figjam", desc: "Design & brainstorming board", emoji: "🎨", color: "#a259ff" },
]

export default function UserFlowPage() {
  const [flows, setFlows]       = useState<UserFlow[]>([])
  const [selected, setSelected] = useState<UserFlow | null>(null)
  const [view, setView]         = useState<ViewMode>("list")
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ title: "", description: "", tags: [] as string[] })
  const [tagInput, setTagInput] = useState("")
  const [saving, setSaving]     = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [search, setSearch]     = useState("")
  const [activeTool, setActiveTool] = useState(TOOLS[0])

  const load = async () => {
    const { data } = await supabase.from("user_flows").select("*").order("updated_at", { ascending: false })
    if (data) setFlows(data)
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("user_flows")
      .insert([{ title: form.title.trim(), description: form.description, tags: form.tags, created_at: now, updated_at: now }])
      .select().single()
    if (data && !error) {
      setFlows(prev => [data, ...prev])
      setSelected(data)
      setView("editor")
    }
    setModal(false)
    setForm({ title: "", description: "", tags: [] })
    setTagInput("")
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm("Hapus flow ini?")) return
    await supabase.from("user_flows").delete().eq("id", id)
    setFlows(prev => prev.filter(f => f.id !== id))
    if (selected?.id === id) { setSelected(null); setView("list") }
  }

  const confirmEdit = async (flow: UserFlow) => {
    if (!editTitle.trim()) { setEditingId(null); return }
    await supabase.from("user_flows").update({ title: editTitle.trim(), updated_at: new Date().toISOString() }).eq("id", flow.id)
    setFlows(prev => prev.map(f => f.id === flow.id ? { ...f, title: editTitle.trim() } : f))
    setSelected(s => s?.id === flow.id ? { ...s, title: editTitle.trim() } : s)
    setEditingId(null)
  }

  const addTag = () => {
    if (!tagInput.trim()) return
    setForm(f => ({ ...f, tags: [...f.tags, tagInput.trim()] }))
    setTagInput("")
  }

  const openFlow = (flow: UserFlow) => { setSelected(flow); setView("editor") }

  const filtered = flows.filter(f =>
    f.title.toLowerCase().includes(search.toLowerCase()) ||
    f.description?.toLowerCase().includes(search.toLowerCase()) ||
    f.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  )

  // ── EDITOR VIEW ──────────────────────────────────────────────
  if (view === "editor" && selected) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "calc(100vh - 108px)" }} className="animate-fade">
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" style={{ padding: "8px 12px", fontSize: "13px" }} onClick={() => setView("list")}>
          <ChevronLeft size={16} /> Kembali
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editingId === selected.id ? (
            <input autoFocus value={editTitle} className="input"
              style={{ fontSize: "15px", fontWeight: 700, maxWidth: "400px" }}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={() => confirmEdit(selected)}
              onKeyDown={e => { if (e.key === "Enter") confirmEdit(selected); if (e.key === "Escape") setEditingId(null) }}
            />
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selected.title}</span>
              <button onClick={() => { setEditingId(selected.id); setEditTitle(selected.title) }}
                style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "3px" }}>
                <Edit3 size={14} />
              </button>
            </div>
          )}
          {selected.description && <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>{selected.description}</div>}
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <a href={activeTool.url} target="_blank" rel="noreferrer"
            className="btn btn-primary" style={{ textDecoration: "none", fontSize: "12px" }}>
            <ExternalLink size={14} /> Buka Fullscreen
          </a>
          <button className="btn btn-danger" style={{ padding: "8px 12px" }} onClick={() => del(selected.id)}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Tool switcher */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        {TOOLS.map(tool => (
          <button key={tool.name} onClick={() => setActiveTool(tool)}
            style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px",
              borderRadius: "var(--radius-sm)", border: "1.5px solid",
              borderColor: activeTool.name === tool.name ? tool.color : "var(--border)",
              background: activeTool.name === tool.name ? `${tool.color}15` : "var(--surface)",
              color: activeTool.name === tool.name ? tool.color : "var(--text3)",
              cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: "12px", fontWeight: 600, transition: "all 0.15s",
            }}>
            <span>{tool.emoji}</span> {tool.name}
          </button>
        ))}
      </div>

      {/* Iframe */}
      <div className="card" style={{ flex: 1, overflow: "hidden", padding: 0 }}>
        <iframe
          key={`${selected.id}-${activeTool.name}`}
          src={activeTool.url}
          style={{ width: "100%", height: "100%", border: "none", borderRadius: "var(--radius)" }}
          title={`${selected.title} - ${activeTool.name}`}
          allow="clipboard-read; clipboard-write"
        />
      </div>
      <p style={{ fontSize: "11px", color: "var(--text3)", textAlign: "center" }}>
        💡 Diagram berjalan di browser. Gunakan <strong>Buka Fullscreen</strong> untuk layar penuh. Pilih tool di atas sesuai kebutuhan.
      </p>
    </div>
  )

  // ── LIST VIEW ────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade">
      <MotivationBanner page="userflow" />

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 800 }}>User Flow</h2>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>{flows.length} diagram tersimpan</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm({ title: "", description: "", tags: [] }); setTagInput(""); setModal(true) }}>
          <Plus size={16} /> Buat Flow Baru
        </button>
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <Search size={15} color="var(--text3)" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
        <input className="input" placeholder="Cari flow..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: "36px" }} />
      </div>

      {/* Tool info strip */}
      <div style={{ display: "flex", gap: "10px", overflowX: "auto", paddingBottom: "4px" }}>
        {TOOLS.map(tool => (
          <div key={tool.name} className="card" style={{ padding: "12px 16px", flexShrink: 0, minWidth: "160px" }}>
            <div style={{ fontSize: "20px", marginBottom: "6px" }}>{tool.emoji}</div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: tool.color }}>{tool.name}</div>
            <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px", lineHeight: 1.4 }}>{tool.desc}</div>
          </div>
        ))}
      </div>

      {/* Flow list */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <GitBranch size={40} color="var(--border2)" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "var(--text3)", fontSize: "14px", fontWeight: 600 }}>
            {search ? "Tidak ada flow yang cocok" : "Belum ada flow diagram"}
          </p>
          {!search && <p style={{ color: "var(--text3)", fontSize: "12px", marginTop: "6px" }}>Buat flow baru untuk mulai menggambar diagram.</p>}
          {!search && (
            <button className="btn btn-primary" style={{ marginTop: "16px" }}
              onClick={() => { setForm({ title: "", description: "", tags: [] }); setModal(true) }}>
              <Plus size={16} /> Buat Flow Pertama
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
          {filtered.map(flow => (
            <div key={flow.id} className="card card-hover"
              style={{ padding: "0", overflow: "hidden", cursor: "pointer" }}
              onClick={() => openFlow(flow)}>
              {/* Thumbnail area */}
              <div style={{
                height: "120px", background: `linear-gradient(135deg, var(--accent-muted), var(--accent-light))`,
                display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
              }}>
                <GitBranch size={40} color="var(--accent)" style={{ opacity: 0.5 }} />
                <div style={{
                  position: "absolute", top: "10px", right: "10px", display: "flex", gap: "6px"
                }}>
                  <button onClick={e => { e.stopPropagation(); setEditingId(flow.id); setEditTitle(flow.title) }}
                    style={{ background: "white", border: "none", borderRadius: "6px", padding: "5px", cursor: "pointer", display: "flex" }}>
                    <Edit3 size={13} color="var(--text3)" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); del(flow.id) }}
                    style={{ background: "white", border: "none", borderRadius: "6px", padding: "5px", cursor: "pointer", display: "flex" }}>
                    <Trash2 size={13} color="var(--danger)" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div style={{ padding: "14px 16px" }}>
                {editingId === flow.id ? (
                  <input autoFocus value={editTitle} className="input"
                    style={{ fontSize: "14px", fontWeight: 700, marginBottom: "6px" }}
                    onChange={e => setEditTitle(e.target.value)}
                    onBlur={() => confirmEdit(flow)}
                    onKeyDown={e => { if (e.key === "Enter") confirmEdit(flow); if (e.key === "Escape") setEditingId(null) }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <div style={{ fontSize: "14px", fontWeight: 700, marginBottom: "4px" }}>{flow.title}</div>
                )}
                {flow.description && (
                  <p style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "8px", lineHeight: 1.4 }}>{flow.description}</p>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {flow.tags?.map(tag => (
                      <span key={tag} style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "99px", background: "var(--accent-muted)", color: "var(--accent)" }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="mono" style={{ fontSize: "10px", color: "var(--text3)", whiteSpace: "nowrap" }}>
                    {new Date(flow.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: "16px" }}>Buat User Flow Baru</span>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Nama Flow *</div>
                <input className="input" placeholder="Contoh: Login Flow, Onboarding UX"
                  value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && save()} autoFocus />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Deskripsi</div>
                <textarea className="input" rows={2} placeholder="Deskripsi singkat..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Tool Diagram</div>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {TOOLS.map(tool => (
                    <button key={tool.name} type="button"
                      onClick={() => setActiveTool(tool)}
                      style={{
                        padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid",
                        borderColor: activeTool.name === tool.name ? tool.color : "var(--border)",
                        background: activeTool.name === tool.name ? `${tool.color}15` : "transparent",
                        color: activeTool.name === tool.name ? tool.color : "var(--text3)",
                        cursor: "pointer", fontSize: "12px", fontWeight: 600,
                        fontFamily: "'Plus Jakarta Sans', sans-serif",
                      }}>
                      {tool.emoji} {tool.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Tags</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="input" placeholder="Tambah tag lalu Enter..."
                    value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} />
                  <button className="btn btn-ghost" type="button" onClick={addTag}><Plus size={14} /></button>
                </div>
                {form.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                    {form.tags.map(tag => (
                      <span key={tag} style={{ background: "var(--accent-muted)", color: "var(--accent)", fontSize: "12px", padding: "2px 9px", borderRadius: "99px", cursor: "pointer" }}
                        onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}>
                        #{tag} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-ghost" onClick={() => setModal(false)} style={{ flex: 1 }}>Batal</button>
                <button className="btn btn-primary" onClick={save}
                  disabled={saving || !form.title.trim()} style={{ flex: 2, opacity: !form.title.trim() ? 0.5 : 1 }}>
                  {saving ? "Menyimpan..." : "Buat & Buka Editor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}