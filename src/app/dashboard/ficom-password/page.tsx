"use client"
// PATH: src/app/dashboard/ficom-password/page.tsx

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Search, X, FileSpreadsheet, Eye, EyeOff, KeyRound, Users, Shield,
  Copy, Check, RefreshCw, AlertCircle, CheckCircle2, Plus, Trash2,
  Pencil, Save, Upload
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"

interface FicomUser {
  id: string
  user_login: string
  sales_name: string
  password: string
  position: string
  updated_at?: string
}

const POS_CLR: Record<string, { bg: string; color: string }> = {
  RDM: { bg: "#FEF3C7", color: "#92400E" },
  ADM: { bg: "#EDE9FE", color: "#7C3AED" },
  ADS: { bg: "#E0F2FE", color: "#0369A1" },
}
const POSITIONS = ["RDM", "ADM", "ADS"]

export default function FicomPasswordPage() {
  const [data, setData]           = useState<FicomUser[]>([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState("")
  const [success, setSuccess]     = useState("")
  const [search, setSearch]       = useState("")
  const [posFilter, setPosFilter] = useState("ALL")
  const [showPwd, setShowPwd]     = useState<Record<string, boolean>>({})
  const [showAll, setShowAll]     = useState(false)
  const [copied, setCopied]       = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [draft, setDraft]         = useState<Partial<FicomUser>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true); setError("")
    const { data: rows, error: err } = await supabase
      .from("ficom_passwords").select("*").order("position").order("user_login")
    if (rows) setData(rows)
    if (err)  setError(err.message)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(u => {
      const matchQ = !q || u.user_login.toLowerCase().includes(q) || u.sales_name.toLowerCase().includes(q)
      const matchP = posFilter === "ALL" || u.position === posFilter
      return matchQ && matchP
    })
  }, [data, search, posFilter])

  const stats = useMemo(() => ({
    total: data.length,
    rdm: data.filter(u => u.position === "RDM").length,
    adm: data.filter(u => u.position === "ADM").length,
    ads: data.filter(u => u.position === "ADS").length,
  }), [data])

  // ── CRUD ──────────────────────────────────────────────────
  const addRow = () => {
    const tempId = `new-${Date.now()}`
    const nu: FicomUser = { id: tempId, user_login: "", sales_name: "", password: "", position: "ADM" }
    setData(p => [nu, ...p])
    setEditId(tempId); setDraft(nu)
  }

  const startEdit = (u: FicomUser) => { setEditId(u.id); setDraft({ ...u }) }

  const saveEdit = async () => {
    if (!draft.user_login?.trim()) { setError("User Login tidak boleh kosong"); return }
    setSaving(true); setError("")
    const payload = {
      user_login: draft.user_login.trim().toUpperCase(),
      sales_name: draft.sales_name?.trim() ?? "",
      password:   draft.password?.trim() ?? "",
      position:   draft.position ?? "ADM",
      updated_at: new Date().toISOString(),
    }
    const isNew = editId?.startsWith("new-")
    if (isNew) {
      const { data: row, error: err } = await supabase.from("ficom_passwords").insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      setData(p => p.map(u => u.id === editId ? row : u))
    } else {
      const { error: err } = await supabase.from("ficom_passwords").update(payload).eq("id", editId!)
      if (err) { setError(err.message); setSaving(false); return }
      setData(p => p.map(u => u.id === editId ? { ...u, ...payload } : u))
    }
    setEditId(null); setSaving(false)
    setSuccess("Tersimpan!"); setTimeout(() => setSuccess(""), 2500)
  }

  const cancelEdit = () => {
    setData(p => p.filter(u => !u.id.startsWith("new-")))
    setEditId(null)
  }

  const deleteRow = async (id: string) => {
    if (!confirm("Hapus user ini dari Ficom Password?")) return
    const { error: err } = await supabase.from("ficom_passwords").delete().eq("id", id)
    if (err) setError(err.message)
    else setData(p => p.filter(u => u.id !== id))
  }

  // ── Visibility ────────────────────────────────────────────
  const toggleOne = (id: string) => setShowPwd(p => ({ ...p, [id]: !p[id] }))
  const toggleAll = () => {
    const next = !showAll; setShowAll(next)
    const map: Record<string, boolean> = {}
    filtered.forEach(u => { map[u.id] = next })
    setShowPwd(map)
  }
  const copyPwd = (pwd: string, id: string) => {
    navigator.clipboard.writeText(pwd)
    setCopied(id); setTimeout(() => setCopied(null), 1500)
  }

  // ── Export Excel ──────────────────────────────────────────
  const exportExcel = async () => {
    setExporting(true)
    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(filtered.map(u => ({
        "User Login": u.user_login, "Sales Name": u.sales_name,
        "Password": u.password, "Position": u.position,
      })))
      ws["!cols"] = [{ wch: 12 }, { wch: 30 }, { wch: 22 }, { wch: 10 }]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Ficom Passwords")
      XLSX.writeFile(wb, `Ficom_Passwords_${new Date().toISOString().slice(0,10)}.xlsx`)
    } catch (e) { setError("Export gagal: " + String(e)) }
    setExporting(false)
  }

  // ── Import Excel ──────────────────────────────────────────
  const importExcel = async (file: File) => {
    try {
      const XLSX = await import("xlsx")
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: "array" })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
      const toUpsert = rows
        .filter(r => String(r["User Login"] ?? "").trim() !== "")
        .map(r => ({
          user_login: String(r["User Login"] ?? "").trim().toUpperCase(),
          sales_name: String(r["Sales Name"] ?? "").trim(),
          password:   String(r["Password"] ?? "").trim(),
          position:   String(r["Position"] ?? r["POSITION"] ?? "ADM").trim().toUpperCase(),
          updated_at: new Date().toISOString(),
        }))
      const { error: err } = await supabase
        .from("ficom_passwords").upsert(toUpsert, { onConflict: "user_login" })
      if (err) throw err
      setSuccess(`✅ ${toUpsert.length} users berhasil di-import`); setTimeout(() => setSuccess(""), 3000)
      load()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  // ── Styles ────────────────────────────────────────────────
  const inputSt: React.CSSProperties = {
    padding: "6px 10px", borderRadius: "7px", border: "1px solid var(--accent-light)",
    background: "var(--surface)", color: "var(--text)", fontSize: "12px",
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", width: "100%",
  }
  const th: React.CSSProperties = {
    padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border)", background: "var(--surface2)", whiteSpace: "nowrap",
  }
  const td: React.CSSProperties = {
    padding: "10px 14px", fontSize: "13px", color: "var(--text)",
    borderBottom: "1px solid var(--border)",
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <MotivationBanner page="ficom-password" />
      <div style={{ padding: "28px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={20} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>Ficom Password</h1>
              <p style={{ fontSize: "13px", color: "var(--text3)", margin: 0 }}>User Login & Password Ficom · {data.length} users</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button onClick={load} disabled={loading}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text3)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <RefreshCw size={13} /> Refresh
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) { importExcel(f); e.target.value = "" } }} />
            <button onClick={() => fileRef.current?.click()}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text3)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Upload size={13} /> Import Excel
            </button>
            <button onClick={exportExcel} disabled={exporting || loading}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "9px", border: "1px solid #166534", background: "#166534", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <FileSpreadsheet size={13} /> {exporting ? "Exporting..." : `Export Excel (${filtered.length})`}
            </button>
            <button onClick={addRow} disabled={!!editId}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "9px", border: "none", background: "#7C3AED", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: editId ? 0.5 : 1 }}>
              <Plus size={14} /> Tambah User
            </button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "14px", color: "#991B1B", fontSize: "13px" }}>
            <AlertCircle size={15} />{error}
            <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#991B1B" }}><X size={14} /></button>
          </div>
        )}
        {success && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "12px 16px", marginBottom: "14px", color: "#166534", fontSize: "13px" }}>
            <CheckCircle2 size={15} />{success}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
          {([
            ["Total", stats.total, "#7C3AED", Users ],
            ["RDM",   stats.rdm,   "#92400E", Shield],
            ["ADM",   stats.adm,   "#7C3AED", Shield],
            ["ADS",   stats.ads,   "#0369A1", Shield],
          ] as const).map(([label, value, color, Icon]) => (
            <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <Icon size={14} color={color} />
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
              </div>
              <div style={{ fontSize: "26px", fontWeight: 800, color, letterSpacing: "-0.03em" }}>{loading ? "—" : value}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", marginBottom: "16px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", flex: "1", minWidth: "180px" }}>
            <Search size={14} color="var(--text3)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari user login atau nama..."
              style={{ background: "none", border: "none", outline: "none", fontSize: "13px", color: "var(--text)", width: "100%", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0 }}><X size={14} /></button>}
          </div>
          <select value={posFilter} onChange={e => setPosFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "13px", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer" }}>
            {["ALL","RDM","ADM","ADS"].map(p => <option key={p} value={p}>{p === "ALL" ? "All Position" : p}</option>)}
          </select>
          <button onClick={toggleAll}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {showAll ? <EyeOff size={13} /> : <Eye size={13} />}
            {showAll ? "Sembunyikan Semua" : "Tampilkan Semua"}
          </button>
          <span style={{ fontSize: "12px", color: "var(--text3)", marginLeft: "auto", whiteSpace: "nowrap" }}>{filtered.length}/{data.length} hasil</span>
        </div>

        {/* Table */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: "60px", textAlign: "center", color: "var(--text3)", fontSize: "14px" }}>
              <RefreshCw size={24} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
              Memuat data dari Supabase...
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>#</th>
                    <th style={th}>User Login</th>
                    <th style={th}>Sales Name</th>
                    <th style={th}>Position</th>
                    <th style={th}>Password</th>
                    <th style={th}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ ...td, textAlign: "center", padding: "48px", color: "var(--text3)" }}>Tidak ada data</td></tr>
                  ) : filtered.map((u, i) => {
                    const isEditing = editId === u.id
                    const visible   = showPwd[u.id] ?? showAll
                    const clr       = POS_CLR[u.position] || { bg: "var(--surface3)", color: "var(--text3)" }
                    return (
                      <tr key={u.id}
                        style={{ background: isEditing ? "var(--accent-muted)" : i % 2 === 0 ? "transparent" : "var(--surface2)" }}>
                        <td style={{ ...td, color: "var(--text3)", fontSize: "11px", width: "40px", textAlign: "center" }}>{i + 1}</td>

                        {/* User Login */}
                        <td style={td}>
                          {isEditing ? (
                            <input value={draft.user_login ?? ""} onChange={e => setDraft(p => ({ ...p, user_login: e.target.value }))}
                              placeholder="WF1001" style={{ ...inputSt, width: "110px", fontFamily: "monospace" }} autoFocus />
                          ) : (
                            <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "13px", color: "#7C3AED" }}>{u.user_login}</span>
                          )}
                        </td>

                        {/* Sales Name */}
                        <td style={td}>
                          {isEditing ? (
                            <input value={draft.sales_name ?? ""} onChange={e => setDraft(p => ({ ...p, sales_name: e.target.value }))}
                              placeholder="Nama Lengkap" style={{ ...inputSt, width: "160px" }} />
                          ) : (
                            <span style={{ fontWeight: 600 }}>{u.sales_name}</span>
                          )}
                        </td>

                        {/* Position */}
                        <td style={td}>
                          {isEditing ? (
                            <select value={draft.position ?? "ADM"} onChange={e => setDraft(p => ({ ...p, position: e.target.value }))}
                              style={{ ...inputSt, width: "90px", cursor: "pointer" }}>
                              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                          ) : (
                            <span style={{ ...clr, padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>{u.position}</span>
                          )}
                        </td>

                        {/* Password */}
                        <td style={td}>
                          {isEditing ? (
                            <input value={draft.password ?? ""} onChange={e => setDraft(p => ({ ...p, password: e.target.value }))}
                              placeholder="Password" style={{ ...inputSt, width: "160px", fontFamily: "monospace" }} />
                          ) : (
                            <span style={{ fontFamily: "monospace", fontSize: "13px", letterSpacing: visible ? "0.02em" : "0.15em", color: visible ? "var(--text)" : "var(--text3)", background: "var(--surface3)", padding: "4px 10px", borderRadius: "6px", display: "inline-block" }}>
                              {visible ? u.password : "•".repeat(Math.min(u.password.length, 12))}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={td}>
                          {isEditing ? (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={saveEdit} disabled={saving}
                                style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "none", background: "#7C3AED", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                                <Save size={12} />{saving ? "..." : "Simpan"}
                              </button>
                              <button onClick={cancelEdit}
                                style={{ padding: "6px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "12px", cursor: "pointer" }}>
                                Batal
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button onClick={() => toggleOne(u.id)} title={visible ? "Sembunyikan" : "Tampilkan"}
                                style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center" }}>
                                {visible ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                              <button onClick={() => copyPwd(u.password, u.id)} title="Copy password"
                                style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: copied === u.id ? "#DCFCE7" : "var(--surface2)", cursor: "pointer", color: copied === u.id ? "#166534" : "var(--text3)", display: "flex", alignItems: "center", transition: "all 0.2s" }}>
                                {copied === u.id ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                              <button onClick={() => startEdit(u)} disabled={!!editId} title="Edit"
                                style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center", opacity: editId ? 0.4 : 1 }}>
                                <Pencil size={13} />
                              </button>
                              <button onClick={() => deleteRow(u.id)} disabled={!!editId} title="Hapus"
                                style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", opacity: editId ? 0.4 : 1 }}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}