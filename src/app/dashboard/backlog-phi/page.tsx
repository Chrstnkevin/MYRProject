"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"
import {
  Plus, X, Save, Trash2, RefreshCw, AlertCircle,
  CheckCircle2, LayoutGrid, List, ChevronUp, ChevronDown,
  Edit2, Filter,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const STATUSES = ["OPEN", "OPEN DEV", "OPEN DR", "ON PROGRESS", "REVIEW BR", "PILOT", "DONE", "HOLD", "CANCELLED"] as const
type Status = typeof STATUSES[number]

const KANBAN_COLS: { key: Status | "OPEN_ALL"; label: string; color: string; statuses: Status[] }[] = [
  { key: "OPEN_ALL",    label: "Open",       color: "#6b7280", statuses: ["OPEN","OPEN DEV","OPEN DR"] },
  { key: "ON PROGRESS", label: "On Progress", color: "#3b82f6", statuses: ["ON PROGRESS"] },
  { key: "REVIEW BR",   label: "Review BR",  color: "#8b5cf6", statuses: ["REVIEW BR"] },
  { key: "PILOT",       label: "Pilot",      color: "#f59e0b", statuses: ["PILOT"] },
  { key: "DONE",        label: "Done",       color: "#10b981", statuses: ["DONE"] },
  { key: "HOLD",        label: "Hold / Cancelled", color: "#ef4444", statuses: ["HOLD","CANCELLED"] },
]

const TYPES = ["Request","Issue","Concern","Discussion","Decision"] as const
type ItemType = typeof TYPES[number]

const TYPE_COLOR: Record<ItemType, { bg: string; text: string }> = {
  Request:    { bg: "#dbeafe", text: "#1d4ed8" },
  Issue:      { bg: "#fee2e2", text: "#991b1b" },
  Concern:    { bg: "#fef3c7", text: "#92400e" },
  Discussion: { bg: "#f3e8ff", text: "#6b21a8" },
  Decision:   { bg: "#d1fae5", text: "#065f46" },
}

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  "OPEN":        { bg: "#f9fafb", text: "#374151", border: "#d1d5db" },
  "OPEN DEV":    { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" },
  "OPEN DR":     { bg: "#fce7f3", text: "#9d174d", border: "#f9a8d4" },
  "ON PROGRESS": { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  "REVIEW BR":   { bg: "#f3e8ff", text: "#6d28d9", border: "#c4b5fd" },
  "PILOT":       { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  "DONE":        { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  "HOLD":        { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  "CANCELLED":   { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" },
}

const PRIORITY_MAP: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: "P1 · High",   color: "#dc2626", bg: "#fee2e2" },
  2: { label: "P2 · High",   color: "#ea580c", bg: "#ffedd5" },
  3: { label: "P3 · Medium", color: "#d97706", bg: "#fef3c7" },
  4: { label: "P4 · Medium", color: "#65a30d", bg: "#ecfccb" },
  5: { label: "P5 · Low",    color: "#16a34a", bg: "#dcfce7" },
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface BacklogItem {
  id: string
  no: number
  concern: string
  remark: string
  concern_pic: string
  pic_request: string
  app: string
  type: ItemType
  priority: number
  status: Status
  note: string
  created_at: string
  updated_at: string
}

const emptyForm = (): Omit<BacklogItem, "id" | "created_at" | "updated_at"> => ({
  no: 0, concern: "", remark: "", concern_pic: "", pic_request: "",
  app: "", type: "Request", priority: 3, status: "OPEN", note: "",
})

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: ItemType }) {
  const c = TYPE_COLOR[type] ?? { bg: "#f3f4f6", text: "#374151" }
  return (
    <span style={{ background: c.bg, color: c.text, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {type}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_COLOR[status] ?? { bg: "#f3f4f6", text: "#6b7280", border: "#d1d5db" }
  return (
    <span style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}`, borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      {status}
    </span>
  )
}

function PriorityBadge({ priority }: { priority: number }) {
  const p = PRIORITY_MAP[priority] ?? PRIORITY_MAP[3]
  return (
    <span style={{ background: p.bg, color: p.color, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
      {p.label}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────
// Form Modal
// ─────────────────────────────────────────────────────────────
function ItemForm({
  initial, onSave, onClose, maxNo,
}: {
  initial?: BacklogItem
  onSave: (data: Omit<BacklogItem, "id" | "created_at" | "updated_at">) => Promise<void>
  onClose: () => void
  maxNo: number
}) {
  const [form, setForm] = useState(initial
    ? { no: initial.no, concern: initial.concern, remark: initial.remark,
        concern_pic: initial.concern_pic, pic_request: initial.pic_request,
        app: initial.app, type: initial.type, priority: initial.priority,
        status: initial.status, note: initial.note }
    : { ...emptyForm(), no: maxNo + 1 }
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState("")

  const up = (f: string, v: unknown) => setForm(p => ({ ...p, [f]: v }))

  const submit = async () => {
    if (!form.concern.trim()) { setErr("Concern wajib diisi"); return }
    setSaving(true); setErr("")
    await onSave(form as Omit<BacklogItem, "id" | "created_at" | "updated_at">)
    setSaving(false)
  }

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 9, border: "1.5px solid var(--border)",
    fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none",
    background: "#f9fafb", color: "#111827",
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block",
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#ffffff", borderRadius: 18, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
              {initial ? "Edit Backlog Item" : "Tambah Backlog Item"}
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "#6b7280", marginTop: 2 }}>PHI Backlog</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 6, borderRadius: 8 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16, background: "#ffffff" }}>
          {err && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#991b1b", display: "flex", gap: 6, alignItems: "center" }}>
              <AlertCircle size={13} />{err}
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>No.</label>
              <input style={inputStyle} type="number" value={form.no} onChange={e => up("no", +e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Concern *</label>
              <input style={inputStyle} placeholder="Judul concern / request" value={form.concern} onChange={e => up("concern", e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Remark / Detail</label>
            <textarea style={{ ...inputStyle, resize: "vertical" }} rows={3} placeholder="Deskripsi lengkap..." value={form.remark} onChange={e => up("remark", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>PIC Concern (Pembuat Dokumen)</label>
              <input style={inputStyle} placeholder="e.g. Kevin, Risky" value={form.concern_pic} onChange={e => up("concern_pic", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>PIC Request (Penemu Masalah)</label>
              <input style={inputStyle} placeholder="e.g. Pak Raul, Yona" value={form.pic_request} onChange={e => up("pic_request", e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Aplikasi</label>
            <input style={inputStyle} placeholder="e.g. SFA, FiCom, Matrix" value={form.app} onChange={e => up("app", e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.type} onChange={e => up("type", e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority (1=Highest)</label>
              <select style={inputStyle} value={form.priority} onChange={e => up("priority", +e.target.value)}>
                {[1,2,3,4,5].map(p => (
                  <option key={p} value={p}>{PRIORITY_MAP[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => up("status", e.target.value)}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Note</label>
            <textarea style={{ ...inputStyle, resize: "vertical" }} rows={2} placeholder="Catatan tambahan..." value={form.note} onChange={e => up("note", e.target.value)} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn btn-ghost" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" onClick={submit} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
            <Save size={14} /> {saving ? "Menyimpan…" : initial ? "Update" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Kanban Card
// ─────────────────────────────────────────────────────────────
function KanbanCard({ item, onEdit, onDelete, onStatusChange }: {
  item: BacklogItem
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (status: Status) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8, cursor: "default", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", transition: "box-shadow 0.15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)")}>

      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
          <TypeBadge type={item.type} />
          <PriorityBadge priority={item.priority} />
        </div>
        <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
          <button onClick={onEdit} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: "3px 5px", borderRadius: 6 }}
            title="Edit"><Edit2 size={12} /></button>
          <button onClick={onDelete} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "3px 5px", borderRadius: 6 }}
            title="Hapus"><Trash2 size={12} /></button>
        </div>
      </div>

      {/* Concern */}
      <div>
        <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 2 }}>#{item.no} · {item.app || "—"}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", lineHeight: 1.3 }}>{item.concern}</div>
      </div>

      {/* Remark */}
      {item.remark && (
        <div style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {item.remark}
        </div>
      )}

      {/* PICs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {item.concern_pic && (
          <span style={{ fontSize: 10, color: "var(--text3)", background: "var(--surface2)", borderRadius: 20, padding: "2px 7px" }}>
            📝 {item.concern_pic}
          </span>
        )}
        {item.pic_request && (
          <span style={{ fontSize: 10, color: "var(--text3)", background: "var(--surface2)", borderRadius: 20, padding: "2px 7px" }}>
            🙋 {item.pic_request}
          </span>
        )}
      </div>

      {/* Status changer */}
      <div style={{ position: "relative" }}>
        <button onClick={() => setMenuOpen(p => !p)}
          style={{ width: "100%", background: STATUS_COLOR[item.status]?.bg ?? "#f9fafb", color: STATUS_COLOR[item.status]?.text ?? "#374151", border: `1px solid ${STATUS_COLOR[item.status]?.border ?? "#d1d5db"}`, borderRadius: 8, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          {item.status}
          <ChevronDown size={12} />
        </button>
        {menuOpen && (
          <div style={{ position: "absolute", bottom: "110%", left: 0, right: 0, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>
            {STATUSES.map(s => (
              <button key={s} onClick={() => { onStatusChange(s); setMenuOpen(false) }}
                style={{ width: "100%", padding: "7px 12px", border: "none", background: s === item.status ? "var(--accent-muted)" : "none", cursor: "pointer", fontSize: 12, textAlign: "left", color: STATUS_COLOR[s]?.text ?? "var(--text)", fontWeight: s === item.status ? 700 : 400, fontFamily: "inherit" }}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function BacklogPhiAdminPage() {
  const [items, setItems]     = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState("")
  const [view, setView]       = useState<"table" | "kanban">("table")
  const [formOpen, setFormOpen]   = useState(false)
  const [editItem, setEditItem]   = useState<BacklogItem | null>(null)
  const [deleteId, setDeleteId]   = useState<string | null>(null)

  // Filters
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterType,   setFilterType]   = useState("ALL")
  const [search, setSearch] = useState("")

  // Table sort
  const [sortCol, setSortCol] = useState<"no"|"priority"|"status"|"type">("no")
  const [sortDir, setSortDir] = useState<"asc"|"desc">("asc")

  // ── Load ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from("backlog_phi")
      .select("*")
      .order("no", { ascending: true })
    if (err) setError(err.message)
    else setItems((data ?? []) as BacklogItem[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── CRUD ────────────────────────────────────────────────────
  const saveItem = async (form: Omit<BacklogItem, "id" | "created_at" | "updated_at">) => {
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (editItem) {
      const { error: err } = await supabase.from("backlog_phi").update(payload).eq("id", editItem.id)
      if (err) { setError(err.message); return }
      setItems(p => p.map(i => i.id === editItem.id ? { ...i, ...payload } : i))
    } else {
      const { data, error: err } = await supabase.from("backlog_phi").insert([payload]).select().single()
      if (err) { setError(err.message); return }
      setItems(p => [...p, data as BacklogItem].sort((a, b) => a.no - b.no))
    }
    setFormOpen(false); setEditItem(null)
  }

  const deleteItem = async (id: string) => {
    await supabase.from("backlog_phi").delete().eq("id", id)
    setItems(p => p.filter(i => i.id !== id))
    setDeleteId(null)
  }

  const updateStatus = async (id: string, status: Status) => {
    await supabase.from("backlog_phi").update({ status, updated_at: new Date().toISOString() }).eq("id", id)
    setItems(p => p.map(i => i.id === id ? { ...i, status } : i))
  }

  // ── Filtered & sorted ────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = items
    if (filterStatus !== "ALL") r = r.filter(i => i.status === filterStatus)
    if (filterType   !== "ALL") r = r.filter(i => i.type   === filterType)
    if (search) {
      const s = search.toLowerCase()
      r = r.filter(i =>
        i.concern.toLowerCase().includes(s) ||
        i.app.toLowerCase().includes(s) ||
        i.concern_pic.toLowerCase().includes(s) ||
        i.pic_request.toLowerCase().includes(s) ||
        String(i.no).includes(s)
      )
    }
    return [...r].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol]
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1  : -1
      return 0
    })
  }, [items, filterStatus, filterType, search, sortCol, sortDir])

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("asc") }
  }

  const SortIcon = ({ col }: { col: typeof sortCol }) =>
    sortCol === col
      ? sortDir === "asc" ? <ChevronUp size={12}/> : <ChevronDown size={12}/>
      : <span style={{ opacity: 0.3 }}>↕</span>

  const maxNo = Math.max(0, ...items.map(i => i.no))

  // ── Stats ────────────────────────────────────────────────────
  const statsDone     = items.filter(i => i.status === "DONE").length
  const statsProgress = items.filter(i => ["ON PROGRESS","REVIEW BR","PILOT"].includes(i.status)).length
  const statsOpen     = items.filter(i => ["OPEN","OPEN DEV","OPEN DR"].includes(i.status)).length
  const statsHold     = items.filter(i => ["HOLD","CANCELLED"].includes(i.status)).length

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <MotivationBanner page="docreq" />

      {/* ── PAGE HEADER ──────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>📋 Backlog PHI</h1>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>
            {items.length} item · {statsDone} done · {statsProgress} progress · {statsOpen} open · {statsHold} hold
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* View toggle */}
          <div style={{ display: "flex", background: "var(--surface2)", borderRadius: 10, padding: 3, gap: 2 }}>
            <button onClick={() => setView("table")}
              className={view === "table" ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8 }}>
              <List size={14} /> Tabel
            </button>
            <button onClick={() => setView("kanban")}
              className={view === "kanban" ? "btn btn-primary" : "btn btn-ghost"}
              style={{ padding: "6px 12px", fontSize: 12, borderRadius: 8 }}>
              <LayoutGrid size={14} /> Kanban
            </button>
          </div>
          <button className="btn btn-ghost" onClick={load} disabled={loading} style={{ fontSize: 12 }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setFormOpen(true) }}>
            <Plus size={14} /> Tambah
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Open",       val: statsOpen,     color: "#6b7280", bg: "#f9fafb" },
          { label: "On Progress",val: statsProgress, color: "#3b82f6", bg: "#dbeafe" },
          { label: "Done",       val: statsDone,     color: "#10b981", bg: "#d1fae5" },
          { label: "Hold",       val: statsHold,     color: "#ef4444", bg: "#fee2e2" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1.1, marginTop: 2 }}>{s.val}</div>
            </div>
            <div style={{ fontSize: 24, opacity: 0.3 }}>
              {s.label === "Open" ? "📋" : s.label === "On Progress" ? "🔄" : s.label === "Done" ? "✅" : "⏸️"}
            </div>
          </div>
        ))}
      </div>

      {/* ── ERROR ────────────────────────────────────────────── */}
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b", display: "flex", justifyContent: "space-between" }}>
          <span><AlertCircle size={13} style={{ display: "inline", marginRight: 6 }} />{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} /></button>
        </div>
      )}

      {/* ── FILTER BAR ───────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="🔍 Cari concern, app, PIC..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: "7px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, width: 240, outline: "none", fontFamily: "inherit", background: "var(--surface2)", color: "var(--text)" }} />

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {["ALL", ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              style={{ padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: filterStatus === s ? (STATUS_COLOR[s]?.bg ?? "var(--accent)") : "var(--surface2)",
                color: filterStatus === s ? (STATUS_COLOR[s]?.text ?? "white") : "var(--text3)",
                border: `1.5px solid ${filterStatus === s ? (STATUS_COLOR[s]?.border ?? "var(--accent)") : "var(--border)"}`,
              }}>
              {s === "ALL" ? "Semua Status" : s}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 5 }}>
          {["ALL", ...TYPES].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding: "5px 11px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: filterType === t ? (TYPE_COLOR[t as ItemType]?.bg ?? "var(--accent-muted)") : "var(--surface2)",
                color: filterType === t ? (TYPE_COLOR[t as ItemType]?.text ?? "var(--accent)") : "var(--text3)",
                border: "1.5px solid var(--border)",
              }}>
              {t === "ALL" ? "Semua Type" : t}
            </button>
          ))}
        </div>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text3)" }}>{filtered.length} item</span>
      </div>

      {/* ═══════════════════════════════════════════════════════
          TABLE VIEW
      ═══════════════════════════════════════════════════════ */}
      {view === "table" && (
        <div className="card" style={{ overflow: "hidden" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
              <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 10px" }} />
              Memuat data…
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface2)", borderBottom: "2px solid var(--border)" }}>
                    {([
                      { col: "no",       label: "#",       sort: true  },
                      { col: null,       label: "Concern",  sort: false },
                      { col: null,       label: "App",      sort: false },
                      { col: "type",     label: "Type",    sort: true  },
                      { col: "priority", label: "Priority", sort: true  },
                      { col: "status",   label: "Status",  sort: true  },
                      { col: null,       label: "PIC Concern", sort: false },
                      { col: null,       label: "PIC Request", sort: false },
                      { col: null,       label: "Aksi",    sort: false },
                    ] as const).map(h => (
                      <th key={h.label}
                        onClick={() => h.sort && h.col && toggleSort(h.col as typeof sortCol)}
                        style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap", cursor: h.sort ? "pointer" : "default", userSelect: "none" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          {h.label}
                          {h.sort && h.col && <SortIcon col={h.col as typeof sortCol} />}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => (
                    <tr key={item.id}
                      style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "var(--card)" : "var(--surface)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-muted)")}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "var(--card)" : "var(--surface)")}>
                      <td style={{ padding: "10px 14px", color: "var(--text3)", fontSize: 11, fontWeight: 600 }}>{item.no}</td>
                      <td style={{ padding: "10px 14px", maxWidth: 260 }}>
                        <div style={{ fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{item.concern}</div>
                        {item.remark && <div style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 240 }}>{item.remark}</div>}
                        {item.note && <div style={{ fontSize: 10, color: "var(--accent)", marginTop: 2 }}>📝 {item.note}</div>}
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text2)", whiteSpace: "nowrap" }}>{item.app || "—"}</td>
                      <td style={{ padding: "10px 14px" }}><TypeBadge type={item.type} /></td>
                      <td style={{ padding: "10px 14px" }}><PriorityBadge priority={item.priority} /></td>
                      <td style={{ padding: "10px 14px" }}>
                        <select value={item.status}
                          onChange={e => updateStatus(item.id, e.target.value as Status)}
                          style={{ background: STATUS_COLOR[item.status]?.bg, color: STATUS_COLOR[item.status]?.text, border: `1px solid ${STATUS_COLOR[item.status]?.border}`, borderRadius: 20, padding: "3px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none", fontFamily: "inherit" }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text2)", whiteSpace: "nowrap" }}>{item.concern_pic || "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text2)", whiteSpace: "nowrap" }}>{item.pic_request || "—"}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => { setEditItem(item); setFormOpen(true) }}
                            style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "var(--text2)" }}>
                            <Edit2 size={11} /> Edit
                          </button>
                          <button onClick={() => setDeleteId(item.id)}
                            style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "4px 8px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: "#991b1b" }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>Tidak ada item yang sesuai filter</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
          KANBAN VIEW
      ═══════════════════════════════════════════════════════ */}
      {view === "kanban" && (
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${KANBAN_COLS.length}, minmax(240px, 1fr))`, gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {KANBAN_COLS.map(col => {
            const colItems = filtered.filter(i => col.statuses.includes(i.status))
            return (
              <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 240 }}>
                {/* Column header */}
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `3px solid ${col.color}` }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: col.color }}>{col.label}</span>
                  <span style={{ background: col.color, color: "white", borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{colItems.length}</span>
                </div>
                {/* Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {colItems.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text3)", fontSize: 12, border: "2px dashed var(--border)", borderRadius: 12 }}>
                      Tidak ada item
                    </div>
                  ) : colItems.map(item => (
                    <KanbanCard key={item.id} item={item}
                      onEdit={() => { setEditItem(item); setFormOpen(true) }}
                      onDelete={() => setDeleteId(item.id)}
                      onStatusChange={s => updateStatus(item.id, s)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── FORM MODAL ───────────────────────────────────────── */}
      {formOpen && (
        <ItemForm
          initial={editItem ?? undefined}
          onSave={saveItem}
          onClose={() => { setFormOpen(false); setEditItem(null) }}
          maxNo={maxNo}
        />
      )}

      {/* ── DELETE CONFIRM ───────────────────────────────────── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#ffffff", borderRadius: 16, padding: 24, maxWidth: 400, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🗑️</div>
            <h3 style={{ textAlign: "center", margin: "0 0 8px", color: "#111827" }}>Hapus item ini?</h3>
            <p style={{ textAlign: "center", fontSize: 13, color: "var(--text3)", margin: "0 0 20px" }}>
              Tindakan ini tidak bisa dibatalkan.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button className="btn btn-ghost" onClick={() => setDeleteId(null)}>Batal</button>
              <button onClick={() => deleteItem(deleteId)}
                style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 9, padding: "8px 20px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                <Trash2 size={14} /> Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}