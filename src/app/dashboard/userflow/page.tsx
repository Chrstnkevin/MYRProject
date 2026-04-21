"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { UserFlow } from "@/lib/types"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { Plus, GitBranch, Trash2, ExternalLink, X, Edit3 } from "lucide-react"

export default function UserFlowPage() {
  const [flows, setFlows]         = useState<UserFlow[]>([])
  const [selected, setSelected]   = useState<UserFlow | null>(null)
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({ title: "", description: "", tags: [] as string[] })
  const [tagInput, setTagInput]   = useState("")
  const [saving, setSaving]       = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")

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
      .select()
      .single()

    if (data && !error) {
      setSelected(data)
      setFlows(prev => [data, ...prev])
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
    if (selected?.id === id) setSelected(null)
  }

  const startEdit = (flow: UserFlow) => {
    setEditingId(flow.id)
    setEditTitle(flow.title)
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

  const openModal = () => {
    setForm({ title: "", description: "", tags: [] })
    setTagInput("")
    setModal(true)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }} className="animate-fade">
      <MotivationBanner page="userflow" />
      <div style={{ display: "flex", gap: "16px", height: "calc(100vh - 180px)", minHeight: "460px" }}>

      {/* Left: flow list */}
      <div style={{ width: "260px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} onClick={openModal}>
          <Plus size={16} /> Buat Flow Baru
        </button>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
          {flows.length === 0 ? (
            <div className="card" style={{ padding: "24px 16px", textAlign: "center" }}>
              <GitBranch size={28} color="var(--text3)" style={{ margin: "0 auto 8px", display: "block" }} />
              <p style={{ fontSize: "12px", color: "var(--text3)" }}>Belum ada flow diagram</p>
            </div>
          ) : (
            flows.map(flow => (
              <div
                key={flow.id}
                onClick={() => setSelected(flow)}
                className="card"
                style={{
                  padding: "12px 14px", cursor: "pointer", transition: "all 0.15s",
                  borderColor: selected?.id === flow.id ? "var(--accent)" : "var(--border)",
                  background: selected?.id === flow.id ? "var(--accent-muted)" : "var(--surface)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                  {editingId === flow.id ? (
                    <input
                      autoFocus
                      value={editTitle}
                      className="input"
                      style={{ fontSize: "13px", padding: "3px 7px", flex: 1 }}
                      onChange={e => setEditTitle(e.target.value)}
                      onBlur={() => confirmEdit(flow)}
                      onKeyDown={e => { if (e.key === "Enter") confirmEdit(flow); if (e.key === "Escape") setEditingId(null) }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span style={{ fontSize: "13px", fontWeight: 600, flex: 1, color: selected?.id === flow.id ? "var(--accent)" : "var(--text)" }}>
                      {flow.title}
                    </span>
                  )}
                  <div style={{ display: "flex", gap: "2px", flexShrink: 0 }}>
                    <button
                      onClick={e => { e.stopPropagation(); startEdit(flow) }}
                      style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "3px" }}>
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); del(flow.id) }}
                      style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "3px" }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {flow.description && (
                  <p style={{ fontSize: "11px", color: "var(--text3)", marginTop: "4px", lineHeight: 1.4 }}>{flow.description}</p>
                )}
                {(flow.tags?.length || 0) > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "6px" }}>
                    {flow.tags?.map(tag => (
                      <span key={tag} style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "99px", background: "var(--accent-muted)", color: "var(--accent)" }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mono" style={{ fontSize: "10px", color: "var(--text3)", marginTop: "6px" }}>
                  {new Date(flow.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right: Excalidraw embed */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
        {selected ? (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "15px", fontWeight: 800 }}>{selected.title}</span>
                {selected.description && (
                  <span style={{ fontSize: "12px", color: "var(--text3)", marginLeft: "10px" }}>{selected.description}</span>
                )}
              </div>
              <a href="https://excalidraw.com" target="_blank" rel="noreferrer"
                className="btn btn-ghost" style={{ textDecoration: "none", fontSize: "12px" }}>
                <ExternalLink size={14} /> Buka Fullscreen
              </a>
            </div>
            <div className="card" style={{ flex: 1, overflow: "hidden", padding: 0 }}>
              <iframe
                key={selected.id}
                src="https://excalidraw.com"
                style={{ width: "100%", height: "100%", border: "none", borderRadius: "var(--radius)" }}
                title={selected.title}
                allow="clipboard-read; clipboard-write"
              />
            </div>
            <p style={{ fontSize: "11px", color: "var(--text3)", textAlign: "center" }}>
              💡 Gambar langsung di canvas Excalidraw. Gunakan "Buka Fullscreen" untuk layar penuh.
            </p>
          </>
        ) : (
          <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
            <div style={{
              width: "72px", height: "72px", borderRadius: "18px",
              background: "var(--accent-muted)", border: "1px solid var(--accent-light)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <GitBranch size={32} color="var(--accent)" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>User Flow Board</div>
              <p style={{ fontSize: "13px", color: "var(--text3)", maxWidth: "320px", lineHeight: 1.6 }}>
                Pilih flow dari daftar kiri, atau buat flow baru untuk mulai menggambar diagram.
              </p>
            </div>
            <button className="btn btn-primary" onClick={openModal}>
              <Plus size={16} /> Buat Flow Pertama
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "440px" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: "16px" }}>Buat User Flow Baru</span>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Nama Flow *</div>
                <input
                  className="input"
                  placeholder="Contoh: Login Flow, Onboarding UX"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && save()}
                  autoFocus
                />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Deskripsi</div>
                <textarea className="input" rows={2} placeholder="Deskripsi singkat flow ini..."
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Tags</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="input" placeholder="Tambah tag lalu Enter..."
                    value={tagInput}
                    onChange={e => setTagInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addTag()} />
                  <button className="btn btn-ghost" type="button" onClick={addTag}><Plus size={14} /></button>
                </div>
                {form.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                    {form.tags.map(tag => (
                      <span key={tag}
                        style={{ background: "var(--accent-muted)", color: "var(--accent)", fontSize: "12px", padding: "2px 9px", borderRadius: "99px", cursor: "pointer" }}
                        onClick={() => setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}>
                        #{tag} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-ghost" onClick={() => setModal(false)} style={{ flex: 1 }}>Batal</button>
                <button
                  className="btn btn-primary"
                  onClick={save}
                  disabled={saving || !form.title.trim()}
                  style={{ flex: 2, opacity: !form.title.trim() ? 0.5 : 1 }}>
                  {saving ? "Menyimpan..." : "Buat & Buka Editor"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}