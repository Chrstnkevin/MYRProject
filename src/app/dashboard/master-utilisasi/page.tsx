"use client"
// PATH: src/app/dashboard/master-utilisasi/page.tsx
// CRUD master users (MASTERDATAPHI) yang dipakai sebagai denominator
// utilisasi Ficom (ADM+RDM) dan Ficom Lite (semua role)

import { useState, useEffect, useRef } from "react"
import {
  Plus, Trash2, Save, RefreshCw, AlertCircle, CheckCircle2,
  Search, X, Pencil, Check, FileSpreadsheet, Users, Upload
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"

interface MasterUser {
  id: string
  user_login: string
  sales_name: string
  position: string   // ADM | ADS | RDM | SD
  is_active: boolean
  aor: string        // GMA | MIN | NOL | SOL | VIS
  sub_aor: string    // SGMA | NGMA | EGMA | NMIN | SMIN | WMIN | ...
  updated_at?: string
}

const POSITIONS = ["ADM","ADS","RDM","SD"]
const POS_CLR: Record<string,{bg:string;color:string}> = {
  ADM:{bg:"#EDE9FE",color:"#7C3AED"},
  ADS:{bg:"#E0F2FE",color:"#0369A1"},
  RDM:{bg:"#FEF3C7",color:"#92400E"},
  SD: {bg:"#DCFCE7",color:"#166534"},
}
const AOR_CLR: Record<string,string> = {
  GMA:"#F97316", MIN:"#3B82F6", NOL:"#22C55E", SOL:"#EF4444", VIS:"#A855F7"
}
const SUB_AORS: Record<string,string[]> = {
  GMA: ["EGMA","NGMA","SGMA"],
  MIN: ["NMIN","SMIN","WMIN"],
  NOL: ["CNOL","ENOL","WNOL"],
  SOL: ["LSOL","MSOL","USOL"],
  VIS: ["CVIS","EVIS","WVIS"],
}

export default function MasterUtilisasiPage() {
  const [users, setUsers]       = useState<MasterUser[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState("")
  const [success, setSuccess]   = useState("")
  const [search, setSearch]     = useState("")
  const [posFilter, setPosFilter]   = useState("ALL")
  const [aorFilter, setAorFilter]   = useState("ALL")
  const [activeFilter, setActiveFilter] = useState<"ALL"|"ACTIVE"|"VACANT">("ALL")
  const [editId, setEditId]     = useState<string | null>(null)
  const [draft, setDraft]       = useState<Partial<MasterUser>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load ──────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("utilisasi_master_users")
      .select("*")
      .order("position")
      .order("user_login")
    if (data) setUsers(data)
    if (error) setError(error.message)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Derived ────────────────────────────────────────────────────
  const filtered = users.filter(u => {
    const q = search.toLowerCase()
    const matchQ = !q || u.user_login.toLowerCase().includes(q) || u.sales_name.toLowerCase().includes(q)
    const matchP = posFilter === "ALL" || u.position === posFilter
    const matchAor = aorFilter === "ALL" || (aorFilter === "EMPTY" ? !u.aor : aorFilter === "NO_SUBAOR" ? !u.sub_aor : u.aor === aorFilter)
    const matchS = activeFilter === "ALL" || (activeFilter === "ACTIVE" ? u.is_active : !u.is_active)
    return matchQ && matchP && matchAor && matchS
  })

  const stats = {
    total:   users.length,
    active:  users.filter(u => u.is_active).length,
    vacant:  users.filter(u => !u.is_active).length,
    byPos:   POSITIONS.reduce((a,p) => ({ ...a, [p]: users.filter(u => u.position === p && u.is_active).length }), {} as Record<string,number>),
    ficomDenom:     users.filter(u => (u.position === "ADM" || u.position === "RDM") && u.is_active).length,
    ficomLiteDenom: users.filter(u => u.is_active).length,
  }

  // ── CRUD ───────────────────────────────────────────────────────
  const addUser = () => {
    const tempId = `new-${Date.now()}`
    const nu: MasterUser = { id: tempId, user_login: "", sales_name: "", position: "ADM", is_active: true, aor: "", sub_aor: "" }
    setUsers(p => [nu, ...p])
    setEditId(tempId); setDraft(nu)
  }

  const startEdit = (u: MasterUser) => { setEditId(u.id); setDraft({ ...u }) }

  const saveEdit = async () => {
    if (!draft.user_login?.trim()) { setError("User Login tidak boleh kosong"); return }
    setSaving(true); setError("")
    const payload = {
      user_login:  draft.user_login.trim().toUpperCase(),
      sales_name:  draft.sales_name?.trim() ?? "",
      position:    draft.position ?? "ADM",
      is_active:   draft.is_active ?? true,
      aor:         draft.aor?.trim().toUpperCase() ?? "",
      sub_aor:     draft.sub_aor?.trim().toUpperCase() ?? "",
      updated_at:  new Date().toISOString(),
    }
    const isNew = editId?.startsWith("new-")
    if (isNew) {
      const { data, error } = await supabase.from("utilisasi_master_users").insert(payload).select().single()
      if (error) setError(error.message)
      else setUsers(p => p.map(u => u.id === editId ? data : u))
    } else {
      const { error } = await supabase.from("utilisasi_master_users").update(payload).eq("id", editId!)
      if (error) setError(error.message)
      else setUsers(p => p.map(u => u.id === editId ? { ...u, ...payload } : u))
    }
    setEditId(null); setSaving(false)
    setSuccess("Saved!"); setTimeout(() => setSuccess(""), 2000)
  }

  const cancelEdit = () => {
    setUsers(p => p.filter(u => !u.id.startsWith("new-")))
    setEditId(null)
  }

  const deleteUser = async (id: string) => {
    if (!confirm("Hapus user ini dari master? Data utilisasi yang sudah diupload tidak terpengaruh.")) return
    const { error } = await supabase.from("utilisasi_master_users").delete().eq("id", id)
    if (error) setError(error.message)
    else setUsers(p => p.filter(u => u.id !== id))
  }

  // ── Export to Excel ───────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import("xlsx")
    const rows = users.map(u => ({
      "User Login":  u.user_login,
      "Sales Name":  u.sales_name,
      "POSITION":    u.position,
      "AOR":         u.aor,
      "SUB-AOR":     u.sub_aor,
      "Status":      u.is_active ? "Active" : "Vacant",
      "Dipakai Untuk": u.is_active
        ? (u.position === "ADM" || u.position === "RDM")
          ? "Ficom + Ficom Lite"
          : "Ficom Lite"
        : "—",
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    // Column widths
    ws["!cols"] = [
      { wch: 14 }, { wch: 30 }, { wch: 12 },
      { wch: 8  }, { wch: 10 }, { wch: 10 }, { wch: 20 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Master Utilisasi")
    XLSX.writeFile(wb, `master_utilisasi_${new Date().toISOString().slice(0,10)}.xlsx`)
  }
  const importExcel = async (file: File) => {
    try {
      const XLSX = await import("xlsx")
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: "array" })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<{
        "User Login"?: string; "Sales Name"?: string; POSITION?: string
      }>(ws, { defval: "" })

      const toUpsert = rows
        .filter(r => String(r["User Login"] ?? "").startsWith("WF"))
        .map(r => {
          const row = r as Record<string, unknown>
          return {
            user_login:  String(row["User Login"] ?? "").trim().toUpperCase(),
            sales_name:  String(row["Sales Name"] ?? "").trim(),
            position:    String(row["POSITION"] ?? "ADM").trim().toUpperCase(),
            is_active:   !String(row["Sales Name"] ?? "").toLowerCase().includes("vacant"),
            aor:         String(row["AOR"] ?? "").trim().toUpperCase(),
            sub_aor:     String(row["SUB-AOR"] ?? row["SUB_AOR"] ?? "").trim().toUpperCase(),
            updated_at:  new Date().toISOString(),
          }
        })

      const { error } = await supabase
        .from("utilisasi_master_users")
        .upsert(toUpsert, { onConflict: "user_login" })
      if (error) throw error

      setSuccess(`✅ ${toUpsert.length} users upserted from Excel`)
      setTimeout(() => setSuccess(""), 3000)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <MotivationBanner page="docreq" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            👥 Master Utilisasi
          </h1>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>
            Data master permanen dari MASTERDATAPHI.xlsx — dipakai sebagai denominator utilisasi Ficom & Ficom Lite
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
            onChange={e => { if (e.target.files?.[0]) importExcel(e.target.files[0]); e.target.value = "" }} />
          <button className="btn btn-ghost" onClick={exportExcel}>
            <FileSpreadsheet size={14} /> Export Excel
          </button>
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            <FileSpreadsheet size={14} /> Import Excel
          </button>
          <button className="btn btn-ghost" onClick={load}><RefreshCw size={13} /></button>
          <button className="btn btn-primary" onClick={addUser}><Plus size={13} /> Add User</button>
        </div>
      </div>

      {/* Denominator info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
        <div className="card" style={{ padding: "12px 16px", border: "1.5px solid #FB8C0035", background: "#FFF3E008" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#FB8C00", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>💰 Ficom Denom</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#FB8C00", lineHeight: 1 }}>{stats.ficomLiteDenom}</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Semua role aktif (= Ficom Lite)</div>
        </div>
        <div className="card" style={{ padding: "12px 16px", border: "1.5px solid #1E88E535", background: "#E3F2FD08" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#1E88E5", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>📱 Ficom Lite Denom</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: "#1E88E5", lineHeight: 1 }}>{stats.ficomLiteDenom}</div>
          <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2 }}>Semua role aktif</div>
        </div>
        {POSITIONS.map(p => (
          <div key={p} className="card" style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 99, background: POS_CLR[p]?.bg, color: POS_CLR[p]?.color }}>{p}</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: POS_CLR[p]?.color }}>{stats.byPos[p] ?? 0}</span>
            </div>
            <div style={{ fontSize: 10, color: "var(--text3)" }}>active users</div>
          </div>
        ))}
        <div className="card" style={{ padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", marginBottom: 4 }}>VACANT</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: "#9CA3AF" }}>{stats.vacant}</div>
          <div style={{ fontSize: 10, color: "var(--text3)" }}>not counted</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }} />
          <input className="input" placeholder="Search WF / name…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 30, fontSize: 12 }} />
        </div>
        <select className="input" style={{ width: "auto", fontSize: 12 }} value={posFilter} onChange={e => setPosFilter(e.target.value)}>
          <option value="ALL">All Positions</option>
          {POSITIONS.map(p => <option key={p}>{p}</option>)}
        </select>
        <select className="input" style={{ width: "auto", fontSize: 12 }} value={aorFilter} onChange={e => setAorFilter(e.target.value)}>
          <option value="ALL">All AOR</option>
          {["GMA","MIN","NOL","SOL","VIS"].map(a => <option key={a}>{a}</option>)}
          <option value="EMPTY">— No AOR</option>
          <option value="NO_SUBAOR">— No SUB-AOR</option>
        </select>
        <select className="input" style={{ width: "auto", fontSize: 12 }} value={activeFilter} onChange={e => setActiveFilter(e.target.value as any)}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="VACANT">Vacant</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap" }}>
          {filtered.length} / {users.length} users
        </span>
      </div>

      {/* Alerts */}
      {error   && <div style={{ fontSize: 12, color: "#991B1B", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8 }}><AlertCircle size={13} style={{ flexShrink: 0 }} />{error}</div>}
      {success && <div style={{ fontSize: 12, color: "#065F46", background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "8px 12px", display: "flex", gap: 8 }}><CheckCircle2 size={13} />{success}</div>}

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
                {["User Login","Sales Name","Position","AOR","SUB-AOR","Status","Dipakai Untuk",""].map(h => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--text3)" }}>
                  <RefreshCw size={16} style={{ animation: "spin 1s linear infinite", display: "inline", marginRight: 8 }} />Loading…
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: "var(--text3)" }}>No users found</td></tr>
              ) : filtered.map(u => {
                const isEditing = editId === u.id
                const pc = POS_CLR[u.position] ?? { bg: "#f4f4f4", color: "#888" }
                const isVacant = !u.is_active || u.sales_name.toLowerCase().includes("vacant")
                const usedBy = u.is_active ? "💰 Ficom + 📱 Ficom Lite" : "—"

                return (
                  <tr key={u.id} style={{ borderBottom: "1px solid var(--border)", background: isEditing ? "var(--accent-muted)" : isVacant ? "var(--surface2)" : "transparent", opacity: isVacant && !isEditing ? 0.65 : 1 }}>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700, color: isVacant ? "var(--text3)" : "var(--accent)" }}>
                      {isEditing
                        ? <input className="input" style={{ fontSize: 12, width: 100 }} value={draft.user_login ?? ""} onChange={e => setDraft(p => ({ ...p, user_login: e.target.value }))} placeholder="WFxxxx" />
                        : u.user_login}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing
                        ? <input className="input" style={{ fontSize: 12, minWidth: 160 }} value={draft.sales_name ?? ""} onChange={e => setDraft(p => ({ ...p, sales_name: e.target.value }))} placeholder="Full name" />
                        : <span style={{ color: isVacant ? "var(--text3)" : "var(--text)", fontStyle: isVacant ? "italic" : "normal" }}>{u.sales_name}</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing
                        ? <select className="input" style={{ fontSize: 12, width: "auto" }} value={draft.position ?? "ADM"} onChange={e => setDraft(p => ({ ...p, position: e.target.value }))}>
                            {POSITIONS.map(p => <option key={p}>{p}</option>)}
                          </select>
                        : <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: pc.bg, color: pc.color }}>{u.position}</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing
                        ? <select className="input" style={{ fontSize: 12, width: "auto" }} value={draft.aor ?? ""}
                            onChange={e => setDraft(p => ({ ...p, aor: e.target.value, sub_aor: "" }))}>
                            <option value="">–</option>
                            {["GMA","MIN","NOL","SOL","VIS"].map(a => <option key={a}>{a}</option>)}
                          </select>
                        : u.aor
                          ? <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: `${AOR_CLR[u.aor] ?? "#888"}18`, color: AOR_CLR[u.aor] ?? "#888" }}>{u.aor}</span>
                          : <span style={{ color: "var(--text3)", fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing
                        ? <select className="input" style={{ fontSize: 12, width: "auto" }} value={draft.sub_aor ?? ""}
                            onChange={e => setDraft(p => ({ ...p, sub_aor: e.target.value }))}>
                            <option value="">–</option>
                            {(SUB_AORS[draft.aor ?? ""] ?? []).map(s => <option key={s}>{s}</option>)}
                          </select>
                        : <span style={{ fontSize: 11, color: u.sub_aor ? "var(--text2)" : "var(--text3)" }}>{u.sub_aor || "—"}</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {isEditing
                        ? <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                            <input type="checkbox" checked={draft.is_active ?? true} onChange={e => setDraft(p => ({ ...p, is_active: e.target.checked }))} />
                            <span style={{ fontSize: 11 }}>Active</span>
                          </label>
                        : <span style={{ fontSize: 11, fontWeight: 600, color: u.is_active ? "#16a34a" : "#9CA3AF" }}>
                            {u.is_active ? "● Active" : "○ Vacant"}
                          </span>}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "var(--text3)" }}>{usedBy}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        {isEditing ? (
                          <>
                            <button className="btn btn-primary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={saveEdit} disabled={saving}><Check size={11} /> Save</button>
                            <button className="btn btn-ghost"   style={{ fontSize: 11, padding: "4px 10px" }} onClick={cancelEdit}><X size={11} /></button>
                          </>
                        ) : (
                          <>
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => startEdit(u)}><Pencil size={11} /></button>
                            <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "4px 8px", opacity: 0.5, borderRadius: 6 }}
                              onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
                              onClick={() => deleteUser(u.id)}><Trash2 size={11} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: "8px 12px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text3)", display: "flex", justifyContent: "space-between" }}>
          <span>Showing {filtered.length} of {users.length} users</span>
          <span>Ficom denom: <strong>{stats.ficomDenom}</strong> · Ficom Lite denom: <strong>{stats.ficomLiteDenom}</strong></span>
        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}