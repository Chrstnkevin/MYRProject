"use client"

import { useState, useEffect, useMemo, useCallback, Fragment } from "react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"
import {
  Plus, X, Save, Trash2, RefreshCw, AlertCircle,
  Edit2, ChevronDown, ChevronUp, Eye, EyeOff,
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Types & Constants
// ─────────────────────────────────────────────────────────────
interface OwnCloudRow {
  id: string
  year: number; week: number; periode: string
  date_request: string; date_create: string; h1: string
  tipe: string; activity: string; folder_name: string
  account: string; password: string; grp: string
  requestor: string; remark: string; status: string; pic_create: string
  created_at: string; updated_at: string
}

const TIPE_OPTIONS    = ["Request", "AutoDelete"]
const ACTIVITY_OPTIONS = ["Create New", "Maintenance", "Recreate", "File BackupDB", "Delete"]
const STATUS_OPTIONS  = ["Request Completed", "Done", "Pending", "Cancelled"]
const H1_OPTIONS      = ["MEET", "UNMEET"]
const PIC_OPTIONS     = ["Risky Mulya", "Kevin"]

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  "Request Completed": { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  "Done":              { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  "Pending":           { bg: "#fef3c7", text: "#92400e", border: "#fcd34d" },
  "Cancelled":         { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
}
const TIPE_STYLE: Record<string, { bg: string; text: string }> = {
  "Request":    { bg: "#dbeafe", text: "#1d4ed8" },
  "AutoDelete": { bg: "#fee2e2", text: "#991b1b" },
}
const H1_STYLE: Record<string, { bg: string; text: string }> = {
  "MEET":   { bg: "#d1fae5", text: "#065f46" },
  "UNMEET": { bg: "#fee2e2", text: "#991b1b" },
}

const emptyForm = (year: number, week: number): Partial<OwnCloudRow> => ({
  year, week, periode: "", date_request: "", date_create: "",
  h1: "MEET", tipe: "Request", activity: "Create New",
  folder_name: "", account: "", password: "", grp: "",
  requestor: "", remark: "Create folder, account and Mapping to group account",
  status: "Request Completed", pic_create: "Risky Mulya",
})

// ─────────────────────────────────────────────────────────────
// Form Modal
// ─────────────────────────────────────────────────────────────
function OwnCloudForm({ initial, onSave, onClose }: {
  initial?: OwnCloudRow
  onSave: (data: Partial<OwnCloudRow>) => Promise<void>
  onClose: () => void
}) {
  const now = new Date()
  const [form, setForm] = useState<Partial<OwnCloudRow>>(
    initial ?? emptyForm(now.getFullYear(), 1)
  )
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState("")
  const [showPass, setShowPass] = useState(false)

  const up = (f: string, v: unknown) => setForm(p => ({ ...p, [f]: v }))

  const submit = async () => {
    if (!form.folder_name?.trim() && !form.activity?.trim()) {
      setErr("Folder Name atau Activity wajib diisi"); return
    }
    setSaving(true); setErr("")
    await onSave(form)
    setSaving(false)
  }

  const inp: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 9, border: "1.5px solid #e5e7eb",
    fontSize: 13, width: "100%", fontFamily: "inherit", outline: "none",
    background: "#ffffff", color: "#111827",
  }
  const lbl: React.CSSProperties = {
    fontSize: 10, fontWeight: 800, color: "#6b7280",
    textTransform: "uppercase", letterSpacing: "0.08em",
    marginBottom: 4, display: "block",
  }
  const sel: React.CSSProperties = { ...inp, cursor: "pointer" }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#ffffff", borderRadius: 18, width: "100%", maxWidth: 700, maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

        {/* Header */}
        <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f9fafb", borderRadius: "18px 18px 0 0" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#111827" }}>
              {initial ? "✏️ Edit Log OwnCloud" : "➕ Tambah Log OwnCloud"}
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: "#6b7280", marginTop: 2 }}>Isi detail aktivitas OwnCloud</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", padding: 6, borderRadius: 8 }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14, background: "#ffffff" }}>
          {err && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#991b1b", display: "flex", gap: 6 }}>
              <AlertCircle size={13} />{err}
            </div>
          )}

          {/* Row 1: Year Week Periode H+1 */}
          <div style={{ display: "grid", gridTemplateColumns: "80px 80px 80px 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Year</label>
              <input style={inp} type="number" value={form.year ?? ""} onChange={e => up("year", +e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Week</label>
              <input style={inp} type="number" value={form.week ?? ""} onChange={e => up("week", +e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Periode</label>
              <input style={inp} placeholder="01" value={form.periode ?? ""} onChange={e => up("periode", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>H+1</label>
              <select style={sel} value={form.h1 ?? "MEET"} onChange={e => up("h1", e.target.value)}>
                {H1_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Dates */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Date Request</label>
              <input style={inp} placeholder="e.g. 21 Jan 2025" value={form.date_request ?? ""} onChange={e => up("date_request", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Date Create</label>
              <input style={inp} placeholder="e.g. 21 Jan 2025" value={form.date_create ?? ""} onChange={e => up("date_create", e.target.value)} />
            </div>
          </div>

          {/* Row 3: Tipe + Activity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Tipe</label>
              <select style={sel} value={form.tipe ?? "Request"} onChange={e => up("tipe", e.target.value)}>
                {TIPE_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Activity</label>
              <select style={sel} value={form.activity ?? "Create New"} onChange={e => up("activity", e.target.value)}>
                {ACTIVITY_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Folder Name */}
          <div>
            <label style={lbl}>Folder Name</label>
            <input style={inp} placeholder="e.g. TRIJAYA SIDADADI ABADI GT M3 (311879) - WANGON" value={form.folder_name ?? ""} onChange={e => up("folder_name", e.target.value)} />
          </div>

          {/* Row 5: Account + Password + Group */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Account</label>
              <input style={inp} placeholder="e.g. 311879" value={form.account ?? ""} onChange={e => up("account", e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Password</label>
              <div style={{ position: "relative" }}>
                <input style={{ ...inp, paddingRight: 36 }}
                  type={showPass ? "text" : "password"}
                  placeholder="Password"
                  value={form.password ?? ""}
                  onChange={e => up("password", e.target.value)} />
                <button onClick={() => setShowPass(p => !p)}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <label style={lbl}>Group</label>
              <input style={inp} placeholder="e.g. EAST-999" value={form.grp ?? ""} onChange={e => up("grp", e.target.value)} />
            </div>
          </div>

          {/* Row 6: Requestor */}
          <div>
            <label style={lbl}>Requestor</label>
            <input style={inp} placeholder="Nama requestor" value={form.requestor ?? ""} onChange={e => up("requestor", e.target.value)} />
          </div>

          {/* Row 7: Remark */}
          <div>
            <label style={lbl}>Remark</label>
            <textarea style={{ ...inp, resize: "vertical" }} rows={2}
              placeholder="Catatan aktivitas..."
              value={form.remark ?? ""}
              onChange={e => up("remark", e.target.value)} />
          </div>

          {/* Row 8: Status + PIC Create */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={lbl}>Status</label>
              <select style={sel} value={form.status ?? "Request Completed"} onChange={e => up("status", e.target.value)}>
                {STATUS_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>PIC Create</label>
              <select style={sel} value={form.pic_create ?? "Risky Mulya"} onChange={e => up("pic_create", e.target.value)}>
                {PIC_OPTIONS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end", background: "#f9fafb", borderRadius: "0 0 18px 18px" }}>
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
// Main Page
// ─────────────────────────────────────────────────────────────
export default function OwnCloudAdminPage() {
  const [items, setItems]     = useState<OwnCloudRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState("")
  const [formOpen, setFormOpen] = useState(false)
  const [editItem, setEditItem] = useState<OwnCloudRow | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showPassFor, setShowPassFor] = useState<string | null>(null)

  // Filters
  const [filterYear,   setFilterYear]   = useState("2026")
  const [filterTipe,   setFilterTipe]   = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [filterPIC,    setFilterPIC]    = useState("ALL")
  const [search, setSearch] = useState("")

  // Sort
  const [sortCol, setSortCol] = useState<"year"|"week"|"date_create"|"tipe">("year")
  const [sortDir, setSortDir] = useState<"asc"|"desc">("desc")

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from("owncloud_accounts")
      .select("*")
      .order("year", { ascending: false })
      .order("week", { ascending: false })
    if (err) setError(err.message)
    else setItems((data ?? []) as OwnCloudRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const saveItem = async (form: Partial<OwnCloudRow>) => {
    const payload = { ...form, updated_at: new Date().toISOString() }
    if (editItem) {
      const { error: err } = await supabase.from("owncloud_accounts").update(payload).eq("id", editItem.id)
      if (err) { setError(err.message); return }
      setItems(p => p.map(i => i.id === editItem.id ? { ...i, ...payload } : i))
    } else {
      const { data, error: err } = await supabase.from("owncloud_accounts").insert([payload]).select().single()
      if (err) { setError(err.message); return }
      setItems(p => [data as OwnCloudRow, ...p])
    }
    setFormOpen(false); setEditItem(null)
  }

  const deleteItem = async (id: string) => {
    await supabase.from("owncloud_accounts").delete().eq("id", id)
    setItems(p => p.filter(i => i.id !== id))
    setDeleteId(null)
  }

  const years = [...new Set(items.map(i => String(i.year)))].sort().reverse()

  // Filtered + sorted
  const filtered = useMemo(() => {
    let r = items
    if (filterYear   !== "ALL") r = r.filter(i => String(i.year) === filterYear)
    if (filterTipe   !== "ALL") r = r.filter(i => i.tipe   === filterTipe)
    if (filterStatus !== "ALL") r = r.filter(i => i.status === filterStatus)
    if (filterPIC    !== "ALL") r = r.filter(i => i.pic_create === filterPIC)
    if (search) {
      const s = search.toLowerCase()
      r = r.filter(i =>
        i.folder_name.toLowerCase().includes(s) ||
        i.account.toLowerCase().includes(s) ||
        i.requestor.toLowerCase().includes(s) ||
        i.grp.toLowerCase().includes(s) ||
        String(i.week).includes(s)
      )
    }
    return [...r].sort((a, b) => {
      const va = a[sortCol], vb = b[sortCol]
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1  : -1
      return 0
    })
  }, [items, filterYear, filterTipe, filterStatus, filterPIC, search, sortCol, sortDir])

  // Stats — computed after filtered
  const totalRequest    = filtered.filter(i => i.tipe === "Request").length
  const totalAutoDelete = filtered.filter(i => i.tipe === "AutoDelete").length
  const totalCompleted  = filtered.filter(i => i.status === "Request Completed" || i.status === "Done").length
  const totalMeet       = filtered.filter(i => i.h1 === "MEET").length

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortCol(col); setSortDir("desc") }
  }

  const SortIcon = ({ col }: { col: typeof sortCol }) =>
    sortCol === col
      ? sortDir === "asc" ? <ChevronUp size={11}/> : <ChevronDown size={11}/>
      : <span style={{ opacity: 0.3, fontSize: 10 }}>↕</span>

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <MotivationBanner page="docreq" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em", margin: 0 }}>☁️ OwnCloud Logs</h1>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 3 }}>
            {filtered.length} total log · {totalRequest} request · {totalAutoDelete} auto-delete · {totalCompleted} completed
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={load} disabled={loading} style={{ fontSize: 12 }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> Refresh
          </button>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setFormOpen(true) }}>
            <Plus size={14} /> Tambah Log
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[
          { label: "Total Log",     val: filtered.length, icon: "📋", bg: "#f9fafb", color: "#374151" },
          { label: "Request",       val: totalRequest,   icon: "📤", bg: "#dbeafe", color: "#1d4ed8" },
          { label: "Auto Delete",   val: totalAutoDelete,icon: "🗑️", bg: "#fee2e2", color: "#991b1b" },
          { label: "H+1 Meet",      val: `${totalMeet}/${filtered.length}`, icon: "✅", bg: "#d1fae5", color: "#065f46" },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1.1, marginTop: 2 }}>{s.val}</div>
            </div>
            <span style={{ fontSize: 22, opacity: 0.4 }}>{s.icon}</span>
          </div>
        ))}
      </div>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#991b1b", display: "flex", justifyContent: "space-between" }}>
          <span><AlertCircle size={13} style={{ display: "inline", marginRight: 6 }} />{error}</span>
          <button onClick={() => setError("")} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={13} /></button>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input placeholder="🔍 Cari folder, account, requestor..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "7px 14px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 13, width: 260, outline: "none", fontFamily: "inherit", background: "var(--surface2)", color: "var(--text)" }} />

        {/* Year */}
        <div style={{ display: "flex", gap: 5 }}>
          {["ALL", ...years].map(y => (
            <button key={y} onClick={() => setFilterYear(y)}
              style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: filterYear === y ? "var(--accent)" : "var(--surface2)",
                color: filterYear === y ? "white" : "var(--text3)",
                border: `1.5px solid ${filterYear === y ? "var(--accent)" : "var(--border)"}` }}>
              {y === "ALL" ? "Semua Tahun" : y}
            </button>
          ))}
        </div>

        {/* Tipe */}
        <div style={{ display: "flex", gap: 5 }}>
          {["ALL", ...TIPE_OPTIONS].map(t => (
            <button key={t} onClick={() => setFilterTipe(t)}
              style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: filterTipe === t ? (TIPE_STYLE[t]?.bg ?? "var(--accent-muted)") : "var(--surface2)",
                color: filterTipe === t ? (TIPE_STYLE[t]?.text ?? "var(--accent)") : "var(--text3)",
                border: "1.5px solid var(--border)" }}>
              {t === "ALL" ? "Semua Tipe" : t}
            </button>
          ))}
        </div>

        {/* Status */}
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 12, background: "var(--surface2)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          <option value="ALL">Semua Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* PIC */}
        <select value={filterPIC} onChange={e => setFilterPIC(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 10, border: "1.5px solid var(--border)", fontSize: 12, background: "var(--surface2)", color: "var(--text)", cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
          <option value="ALL">Semua PIC</option>
          {PIC_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text3)" }}>{filtered.length} log</span>
      </div>

      {/* Table */}
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
                    { col: "year",        label: "Year",    sort: true  },
                    { col: "week",        label: "Week",    sort: true  },
                    { col: null,          label: "Periode", sort: false },
                    { col: "date_create", label: "Date Create", sort: true },
                    { col: null,          label: "H+1",     sort: false },
                    { col: "tipe",        label: "Tipe",    sort: true  },
                    { col: null,          label: "Activity",sort: false },
                    { col: null,          label: "Folder Name", sort: false },
                    { col: null,          label: "Account", sort: false },
                    { col: null,          label: "Group",   sort: false },
                    { col: null,          label: "Requestor",sort: false },
                    { col: null,          label: "Status",  sort: false },
                    { col: null,          label: "PIC",     sort: false },
                    { col: null,          label: "Aksi",    sort: false },
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
                  <Fragment key={item.id}>
                    <tr
                      style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "var(--card)" : "var(--surface)", cursor: "pointer" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--accent-muted)")}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "var(--card)" : "var(--surface)")}>

                      <td style={{ padding: "9px 14px", fontWeight: 600, color: "var(--text2)" }}>{item.year}</td>
                      <td style={{ padding: "9px 14px", color: "var(--text2)" }}>W{item.week}</td>
                      <td style={{ padding: "9px 14px", color: "var(--text3)", fontSize: 11 }}>P{item.periode}</td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--text2)", whiteSpace: "nowrap" }}>{item.date_create}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ background: H1_STYLE[item.h1]?.bg ?? "#f9fafb", color: H1_STYLE[item.h1]?.text ?? "#374151", borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                          {item.h1}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ background: TIPE_STYLE[item.tipe]?.bg ?? "#f3f4f6", color: TIPE_STYLE[item.tipe]?.text ?? "#374151", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                          {item.tipe}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--text2)" }}>{item.activity}</td>
                      <td style={{ padding: "9px 14px", maxWidth: 200 }}>
                        <div style={{ fontWeight: 500, color: "var(--text)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.folder_name || "—"}
                        </div>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 12, fontFamily: "monospace", color: "var(--text2)" }}>
                        {item.account || "—"}
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--text3)" }}>{item.grp || "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--text2)" }}>{item.requestor || "—"}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={{ background: STATUS_STYLE[item.status]?.bg ?? "#f9fafb", color: STATUS_STYLE[item.status]?.text ?? "#374151", border: `1px solid ${STATUS_STYLE[item.status]?.border ?? "#d1d5db"}`, borderRadius: 20, padding: "2px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "var(--text2)", whiteSpace: "nowrap" }}>{item.pic_create}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "var(--text3)" }}
                            title="Detail">
                            {expandedId === item.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          <button onClick={() => { setEditItem(item); setFormOpen(true) }}
                            style={{ background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "var(--text2)" }}
                            title="Edit">
                            <Edit2 size={11} />
                          </button>
                          <button onClick={() => setDeleteId(item.id)}
                            style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 7, padding: "4px 7px", cursor: "pointer", color: "#991b1b" }}
                            title="Hapus">
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {expandedId === item.id && (
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        <td colSpan={14} style={{ padding: "14px 20px", background: "var(--surface2)" }}>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", marginBottom: 4 }}>Password</div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text)", background: "var(--card)", padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border)" }}>
                                  {showPassFor === item.id ? item.password : "••••••••"}
                                </span>
                                <button onClick={() => setShowPassFor(showPassFor === item.id ? null : item.id)}
                                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 2 }}>
                                  {showPassFor === item.id ? <EyeOff size={13} /> : <Eye size={13} />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", marginBottom: 4 }}>Remark</div>
                              <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{item.remark || "—"}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", marginBottom: 4 }}>Date Request</div>
                              <div style={{ fontSize: 12, color: "var(--text2)" }}>{item.date_request || "—"}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Tidak ada log yang sesuai filter</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Form modal */}
      {formOpen && (
        <OwnCloudForm
          initial={editItem ?? undefined}
          onSave={saveItem}
          onClose={() => { setFormOpen(false); setEditItem(null) }}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#ffffff", borderRadius: 16, padding: 28, maxWidth: 380, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: "0 0 8px", color: "#111827", fontSize: 16 }}>Hapus log ini?</h3>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px" }}>Tindakan ini tidak bisa dibatalkan.</p>
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