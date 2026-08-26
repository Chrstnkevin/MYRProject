"use client"
// PATH: src/app/dashboard/ficom-password/page.tsx

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Search, X, FileSpreadsheet, Eye, EyeOff, KeyRound, Users, Shield,
  Copy, Check, RefreshCw, AlertCircle, CheckCircle2, Plus, Trash2,
  Pencil, Save, Upload, ChevronDown, ChevronRight, GitBranch, Server
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

interface DepotRow {
  id: string
  adp_code: number | null
  depot: string
  server: number | null
  server_name: string
  region_name: string
  ads_name: string
  adm_name: string
  rdm_name: string
}

const POS_CLR: Record<string, { bg: string; color: string }> = {
  SD:  { bg: "#DCFCE7", color: "#166534" },
  RDM: { bg: "#FEF3C7", color: "#92400E" },
  ADM: { bg: "#EDE9FE", color: "#7C3AED" },
  ADS: { bg: "#E0F2FE", color: "#0369A1" },
  EDI: { bg: "#FFE4E6", color: "#BE123C" },
}
const SERVER_CLR: Record<string, string> = {
  "138": "#0369A1", "228": "#7C3AED", "252": "#DC2626",
}
// "EDI" = akun sistem/fungsional buat ekstraksi EDI (bukan akun SD
// personal) — dipakai api/ficom-edi-sync buat login, bukan buat mapping
// hierarki RDM/ADM/ADS.
const POSITIONS = ["SD", "RDM", "ADM", "ADS", "EDI"]

function extractLogin(name: string): string {
  const m = name?.match(/^(WF\d+)/i)
  return m ? m[1].toUpperCase() : ""
}
function extractPersonName(name: string): string {
  // e.g. "WF1002-EGMA - RDM E. Bongosia" → "E. Bongosia"
  return name?.replace(/^WF\d+[^\-]*-\s*(RDM|ADM|ADS)\s*/i, "").trim() || name || "—"
}

export default function FicomPasswordPage() {
  const [activeTab, setActiveTab]   = useState<"password" | "mapping">("password")
  const [ficomData, setFicomData]   = useState<FicomUser[]>([])
  const [depotData, setDepotData]   = useState<DepotRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")
  const [success, setSuccess]       = useState("")

  // Password tab state
  const [search, setSearch]         = useState("")
  const [posFilter, setPosFilter]   = useState("ALL")
  const [showPwd, setShowPwd]       = useState<Record<string, boolean>>({})
  const [showAll, setShowAll]       = useState(false)
  const [copied, setCopied]         = useState<string | null>(null)
  const [exporting, setExporting]   = useState(false)
  const [editId, setEditId]         = useState<string | null>(null)
  const [draft, setDraft]           = useState<Partial<FicomUser>>({})

  // Mapping tab state
  const [mapSearch, setMapSearch]   = useState("")
  const [mapServer, setMapServer]   = useState("ALL")
  const [expandedRdm, setExpandedRdm] = useState<string | null>(null)
  const [expandedAdm, setExpandedAdm] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load ──────────────────────────────────────────────────
  const load = async () => {
    setLoading(true); setError("")
    const [ficomRes, depotRes] = await Promise.all([
      supabase.from("ficom_passwords").select("*").order("position").order("user_login"),
      supabase.from("master_data_adp").select("id,adp_code,depot,server,server_name,region_name,ads_name,adm_name,rdm_name"),
    ])
    if (ficomRes.data) setFicomData(ficomRes.data)
    if (ficomRes.error) setError(ficomRes.error.message)
    if (depotRes.data) setDepotData(depotRes.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Ficom map: login → user ────────────────────────────────
  const ficomMap = useMemo(() => {
    const m: Record<string, FicomUser> = {}
    ficomData.forEach(u => { m[u.user_login.toUpperCase()] = u })
    return m
  }, [ficomData])

  // ── Build hierarchy: RDM → ADMs → ADS per ADM ─────────────
  const hierarchy = useMemo(() => {
    // map: rdmLogin → { rdmUser, adms: { admLogin → { admUser, adsList: [{adsLogin, adsUser, depots}] } } }
    type AdsEntry  = { login: string; user: FicomUser | null; depots: DepotRow[] }
    type AdmEntry  = { login: string; user: FicomUser | null; adsList: AdsEntry[] }
    type RdmEntry  = { login: string; user: FicomUser | null; adms: AdmEntry[] }

    const rdmMap: Record<string, { rdm: RdmEntry; admMap: Record<string, { adm: AdmEntry; adsMap: Record<string, AdsEntry> }> }> = {}

    depotData.forEach(depot => {
      const rdmLogin = extractLogin(depot.rdm_name)
      const admLogin = extractLogin(depot.adm_name)
      const adsLogin = extractLogin(depot.ads_name)
      if (!rdmLogin) return

      if (!rdmMap[rdmLogin]) {
        rdmMap[rdmLogin] = {
          rdm: { login: rdmLogin, user: ficomMap[rdmLogin] || null, adms: [] },
          admMap: {},
        }
      }
      const rdmEntry = rdmMap[rdmLogin]

      if (admLogin) {
        if (!rdmEntry.admMap[admLogin]) {
          rdmEntry.admMap[admLogin] = {
            adm: { login: admLogin, user: ficomMap[admLogin] || null, adsList: [] },
            adsMap: {},
          }
        }
        const admEntry = rdmEntry.admMap[admLogin]

        if (adsLogin) {
          if (!admEntry.adsMap[adsLogin]) {
            admEntry.adsMap[adsLogin] = { login: adsLogin, user: ficomMap[adsLogin] || null, depots: [] }
          }
          // avoid duplicate depots
          const existing = admEntry.adsMap[adsLogin].depots.find(d => d.id === depot.id)
          if (!existing) admEntry.adsMap[adsLogin].depots.push(depot)
        }
      }
    })

    // flatten to array, sort by login
    return Object.values(rdmMap)
      .map(({ rdm, admMap }) => ({
        ...rdm,
        adms: Object.values(admMap).map(({ adm, adsMap }) => ({
          ...adm,
          adsList: Object.values(adsMap).sort((a, b) => a.login.localeCompare(b.login)),
        })).sort((a, b) => a.login.localeCompare(b.login)),
      }))
      .sort((a, b) => a.login.localeCompare(b.login))
  }, [depotData, ficomMap])

  const filteredHierarchy = useMemo(() => {
    const q = mapSearch.toLowerCase()
    return hierarchy.map(rdm => ({
      ...rdm,
      adms: rdm.adms.map(adm => ({
        ...adm,
        adsList: adm.adsList.map(ads => ({
          ...ads,
          depots: ads.depots.filter(d =>
            (mapServer === "ALL" || String(d.server ?? "") === mapServer) &&
            (!q || d.depot.toLowerCase().includes(q) || String(d.adp_code).includes(q) ||
             d.server_name?.toLowerCase().includes(q))
          ),
        })).filter(ads => ads.depots.length > 0 || !q),
      })).filter(adm => adm.adsList.some(a => a.depots.length > 0) || !q),
    })).filter(rdm => rdm.adms.length > 0 || !q)
  }, [hierarchy, mapSearch, mapServer])

  // ── Password tab helpers ───────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return ficomData.filter(u => {
      const matchQ = !q || u.user_login.toLowerCase().includes(q) || u.sales_name.toLowerCase().includes(q)
      return matchQ && (posFilter === "ALL" || u.position === posFilter)
    })
  }, [ficomData, search, posFilter])

  const stats = useMemo(() => ({
    total: ficomData.length,
    rdm: ficomData.filter(u => u.position === "RDM").length,
    adm: ficomData.filter(u => u.position === "ADM").length,
    ads: ficomData.filter(u => u.position === "ADS").length,
  }), [ficomData])

  // ── CRUD ──────────────────────────────────────────────────
  const addRow = () => {
    const tempId = `new-${Date.now()}`
    const nu: FicomUser = { id: tempId, user_login: "", sales_name: "", password: "", position: "ADM" }
    setFicomData(p => [nu, ...p])
    setEditId(tempId); setDraft(nu)
  }
  const startEdit = (u: FicomUser) => { setEditId(u.id); setDraft({ ...u }) }
  const saveEdit = async () => {
    if (!draft.user_login?.trim()) { setError("User Login tidak boleh kosong"); return }
    setSaving(true); setError("")
    // Posisi "EDI" itu akun sistem/fungsional (mis. "brt") — login-nya
    // case-sensitive di Ficom, JANGAN di-uppercase kayak WF-code
    // (SD/RDM/ADM/ADS) yang memang konvensinya selalu huruf besar.
    const payload = {
      user_login: draft.position === "EDI" ? draft.user_login.trim() : draft.user_login.trim().toUpperCase(),
      sales_name: draft.sales_name?.trim() ?? "",
      password:   draft.password?.trim() ?? "",
      position:   draft.position ?? "ADM",
      updated_at: new Date().toISOString(),
    }
    const isNew = editId?.startsWith("new-")
    if (isNew) {
      const { data: row, error: err } = await supabase.from("ficom_passwords").insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      setFicomData(p => p.map(u => u.id === editId ? row : u))
    } else {
      const { error: err } = await supabase.from("ficom_passwords").update(payload).eq("id", editId!)
      if (err) { setError(err.message); setSaving(false); return }
      setFicomData(p => p.map(u => u.id === editId ? { ...u, ...payload } : u))
    }
    setEditId(null); setSaving(false)
    setSuccess("Tersimpan!"); setTimeout(() => setSuccess(""), 2500)
  }
  const cancelEdit = () => {
    setFicomData(p => p.filter(u => !u.id.startsWith("new-")))
    setEditId(null)
  }
  const deleteRow = async (id: string) => {
    if (!confirm("Hapus user ini?")) return
    const { error: err } = await supabase.from("ficom_passwords").delete().eq("id", id)
    if (err) setError(err.message)
    else setFicomData(p => p.filter(u => u.id !== id))
  }

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
  const importExcel = async (file: File) => {
    try {
      const XLSX = await import("xlsx")
      const buf  = await file.arrayBuffer()
      const wb   = XLSX.read(buf, { type: "array" })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" })
      const toUpsert = rows
        .filter(r => String(r["User Login"] ?? "").trim() !== "")
        .map(r => {
          const position = String(r["Position"] ?? r["POSITION"] ?? "ADM").trim().toUpperCase()
          const rawLogin = String(r["User Login"] ?? "").trim()
          return {
            // Posisi "EDI" (akun sistem/fungsional) case-sensitive di
            // Ficom — jangan di-uppercase, beda dari WF-code SD/RDM/ADM/ADS.
            user_login: position === "EDI" ? rawLogin : rawLogin.toUpperCase(),
            sales_name: String(r["Sales Name"] ?? "").trim(),
            password:   String(r["Password"] ?? "").trim(),
            position,
            updated_at: new Date().toISOString(),
          }
        })
      const { error: err } = await supabase.from("ficom_passwords").upsert(toUpsert, { onConflict: "user_login" })
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

  const Badge = ({ pos }: { pos: string }) => {
    const c = POS_CLR[pos] || { bg: "var(--surface3)", color: "var(--text3)" }
    return <span style={{ ...c, padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>{pos}</span>
  }

  const UserChip = ({ login, name }: { login: string; name?: string }) => {
    const u = ficomMap[login]
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "12px", color: "#7C3AED" }}>{login}</span>
        <span style={{ fontSize: "12px", color: "var(--text)", fontWeight: 600 }}>
          {u?.sales_name || name || "—"}
        </span>
        {!u && <span style={{ fontSize: "10px", color: "#DC2626", background: "#FEF2F2", padding: "1px 6px", borderRadius: "99px" }}>not in Ficom</span>}
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <MotivationBanner page="ficom-password" />
      <div style={{ padding: "28px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "#7C3AED", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={20} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>Ficom Password</h1>
              <p style={{ fontSize: "13px", color: "var(--text3)", margin: 0 }}>User Login & Password · {ficomData.length} users</p>
            </div>
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

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "var(--surface2)", borderRadius: "10px", padding: "4px", width: "fit-content", border: "1px solid var(--border)" }}>
          {(["password", "mapping"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 20px", borderRadius: "7px", border: "none", cursor: "pointer",
                fontSize: "13px", fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
                background: activeTab === tab ? "#7C3AED" : "transparent",
                color: activeTab === tab ? "white" : "var(--text3)",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", gap: "6px",
              }}>
              {tab === "password" ? <KeyRound size={13} /> : <GitBranch size={13} />}
              {tab === "password" ? "Password" : "Mapping"}
            </button>
          ))}
        </div>

        {/* ══════════ TAB: PASSWORD ══════════ */}
        {activeTab === "password" && (
          <>
            {/* Toolbar */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
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
                {["ALL", ...POSITIONS].map(p => <option key={p} value={p}>{p === "ALL" ? "All Position" : p}</option>)}
              </select>
              <button onClick={toggleAll}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                {showAll ? <EyeOff size={13} /> : <Eye size={13} />}
                {showAll ? "Sembunyikan Semua" : "Tampilkan Semua"}
              </button>
              <span style={{ fontSize: "12px", color: "var(--text3)", marginLeft: "auto" }}>{filtered.length}/{ficomData.length}</span>
            </div>

            {/* Table */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
              {loading ? (
                <div style={{ padding: "60px", textAlign: "center", color: "var(--text3)" }}>
                  <RefreshCw size={24} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />Memuat...
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
                          <tr key={u.id} style={{ background: isEditing ? "var(--accent-muted)" : i % 2 === 0 ? "transparent" : "var(--surface2)" }}>
                            <td style={{ ...td, color: "var(--text3)", fontSize: "11px", width: "40px", textAlign: "center" }}>{i + 1}</td>
                            <td style={td}>
                              {isEditing
                                ? <input value={draft.user_login ?? ""} onChange={e => setDraft(p => ({ ...p, user_login: e.target.value }))} placeholder="WF1001" style={{ ...inputSt, width: "110px", fontFamily: "monospace" }} autoFocus />
                                : <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#7C3AED" }}>{u.user_login}</span>}
                            </td>
                            <td style={td}>
                              {isEditing
                                ? <input value={draft.sales_name ?? ""} onChange={e => setDraft(p => ({ ...p, sales_name: e.target.value }))} placeholder="Nama Lengkap" style={{ ...inputSt, width: "160px" }} />
                                : <span style={{ fontWeight: 600 }}>{u.sales_name}</span>}
                            </td>
                            <td style={td}>
                              {isEditing
                                ? <select value={draft.position ?? "ADM"} onChange={e => setDraft(p => ({ ...p, position: e.target.value }))} style={{ ...inputSt, width: "90px", cursor: "pointer" }}>
                                    {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                  </select>
                                : <span style={{ ...clr, padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>{u.position}</span>}
                            </td>
                            <td style={td}>
                              {isEditing
                                ? <input value={draft.password ?? ""} onChange={e => setDraft(p => ({ ...p, password: e.target.value }))} placeholder="Password" style={{ ...inputSt, width: "160px", fontFamily: "monospace" }} />
                                : <span style={{ fontFamily: "monospace", fontSize: "13px", letterSpacing: visible ? "0.02em" : "0.15em", color: visible ? "var(--text)" : "var(--text3)", background: "var(--surface3)", padding: "4px 10px", borderRadius: "6px", display: "inline-block" }}>
                                    {visible ? u.password : "•".repeat(Math.min(u.password.length, 12))}
                                  </span>}
                            </td>
                            <td style={td}>
                              {isEditing ? (
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button onClick={saveEdit} disabled={saving} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "none", background: "#7C3AED", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>
                                    <Save size={12} />{saving ? "..." : "Simpan"}
                                  </button>
                                  <button onClick={cancelEdit} style={{ padding: "6px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "12px", cursor: "pointer" }}>Batal</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button onClick={() => toggleOne(u.id)} style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center" }}>
                                    {visible ? <EyeOff size={13} /> : <Eye size={13} />}
                                  </button>
                                  <button onClick={() => copyPwd(u.password, u.id)} style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: copied === u.id ? "#DCFCE7" : "var(--surface2)", cursor: "pointer", color: copied === u.id ? "#166534" : "var(--text3)", display: "flex", alignItems: "center", transition: "all 0.2s" }}>
                                    {copied === u.id ? <Check size={13} /> : <Copy size={13} />}
                                  </button>
                                  <button onClick={() => startEdit(u)} disabled={!!editId} style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center", opacity: editId ? 0.4 : 1 }}>
                                    <Pencil size={13} />
                                  </button>
                                  <button onClick={() => deleteRow(u.id)} disabled={!!editId} style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", opacity: editId ? 0.4 : 1 }}>
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
          </>
        )}

        {/* ══════════ TAB: MAPPING ══════════ */}
        {activeTab === "mapping" && (
          <>
            {/* Mapping filters */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px", marginBottom: "20px", display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", flex: "1", minWidth: "200px" }}>
                <Search size={14} color="var(--text3)" />
                <input value={mapSearch} onChange={e => setMapSearch(e.target.value)} placeholder="Cari depot, ADP code, server name..."
                  style={{ background: "none", border: "none", outline: "none", fontSize: "13px", color: "var(--text)", width: "100%", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
                {mapSearch && <button onClick={() => setMapSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0 }}><X size={14} /></button>}
              </div>
              <select value={mapServer} onChange={e => setMapServer(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "13px", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer" }}>
                {["ALL","138","228","252"].map(s => <option key={s} value={s}>{s === "ALL" ? "All Server" : `Server ${s}`}</option>)}
              </select>
              <button onClick={() => { setExpandedRdm(null); setExpandedAdm(null) }}
                style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                Tutup Semua
              </button>
              <span style={{ fontSize: "12px", color: "var(--text3)", marginLeft: "auto" }}>
                {filteredHierarchy.length} RDM · {filteredHierarchy.reduce((s, r) => s + r.adms.length, 0)} ADM
              </span>
            </div>

            {loading ? (
              <div style={{ padding: "60px", textAlign: "center", color: "var(--text3)" }}>
                <RefreshCw size={24} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />Memuat...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {filteredHierarchy.length === 0 ? (
                  <div style={{ padding: "48px", textAlign: "center", color: "var(--text3)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
                    Tidak ada data yang sesuai filter
                  </div>
                ) : filteredHierarchy.map(rdm => {
                  const rdmOpen    = expandedRdm === rdm.login
                  const totalDepots = rdm.adms.reduce((s, a) => s + a.adsList.reduce((ss, ads) => ss + ads.depots.length, 0), 0)

                  return (
                    <div key={rdm.login} style={{ background: "var(--surface)", border: `1px solid ${rdmOpen ? "#F59E0B" : "var(--border)"}`, borderRadius: "12px", overflow: "hidden", transition: "border 0.15s" }}>
                      {/* RDM Header */}
                      <button onClick={() => setExpandedRdm(rdmOpen ? null : rdm.login)}
                        style={{ width: "100%", padding: "14px 18px", background: rdmOpen ? "#FFFBEB" : "var(--surface)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", textAlign: "left" }}>
                        <span style={{ ...POS_CLR.RDM, padding: "3px 10px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>RDM</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: "14px", color: "#92400E" }}>{rdm.login}</span>
                        <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--text)" }}>{rdm.user?.sales_name || "—"}</span>
                        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "11px", color: "var(--text3)", background: "var(--surface2)", padding: "3px 10px", borderRadius: "99px" }}>
                            {rdm.adms.length} ADM · {totalDepots} depot
                          </span>
                          {rdmOpen ? <ChevronDown size={16} color="#92400E" /> : <ChevronRight size={16} color="var(--text3)" />}
                        </div>
                      </button>

                      {/* ADM List */}
                      {rdmOpen && (
                        <div style={{ borderTop: "1px solid #FDE68A", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "8px", background: "#FFFDF0" }}>
                          {rdm.adms.map(adm => {
                            const admKey  = `${rdm.login}-${adm.login}`
                            const admOpen = expandedAdm === admKey
                            const admDepots = adm.adsList.reduce((s, a) => s + a.depots.length, 0)

                            return (
                              <div key={adm.login} style={{ background: "var(--surface)", border: `1px solid ${admOpen ? "#A78BFA" : "var(--border)"}`, borderRadius: "10px", overflow: "hidden" }}>
                                {/* ADM Header */}
                                <button onClick={() => setExpandedAdm(admOpen ? null : admKey)}
                                  style={{ width: "100%", padding: "11px 16px", background: admOpen ? "#F5F3FF" : "var(--surface)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", textAlign: "left" }}>
                                  <span style={{ ...POS_CLR.ADM, padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>ADM</span>
                                  <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "13px", color: "#7C3AED" }}>{adm.login}</span>
                                  <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--text)" }}>{adm.user?.sales_name || "—"}</span>
                                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontSize: "11px", color: "var(--text3)", background: "var(--surface2)", padding: "2px 8px", borderRadius: "99px" }}>
                                      {adm.adsList.length} ADS · {admDepots} depot
                                    </span>
                                    {admOpen ? <ChevronDown size={14} color="#7C3AED" /> : <ChevronRight size={14} color="var(--text3)" />}
                                  </div>
                                </button>

                                {/* ADS + Depot list */}
                                {admOpen && (
                                  <div style={{ borderTop: "1px solid #DDD6FE", padding: "10px 14px", background: "#FAF5FF", display: "flex", flexDirection: "column", gap: "8px" }}>
                                    {adm.adsList.map(ads => (
                                      <div key={ads.login}>
                                        {/* ADS Row */}
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                                          <span style={{ ...POS_CLR.ADS, padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700, flexShrink: 0 }}>ADS</span>
                                          <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "12px", color: "#0369A1" }}>{ads.login}</span>
                                          <span style={{ fontWeight: 600, fontSize: "12px", color: "var(--text)" }}>{ads.user?.sales_name || "—"}</span>
                                          <span style={{ fontSize: "11px", color: "var(--text3)", marginLeft: "auto" }}>{ads.depots.length} depot</span>
                                        </div>

                                        {/* Depot chips */}
                                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingLeft: "16px" }}>
                                          {ads.depots.map(depot => (
                                            <div key={depot.id} style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px" }}>
                                              {/* ADP Code */}
                                              <span style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: 700, color: "#0369A1" }}>
                                                {depot.adp_code ?? "—"}
                                              </span>
                                              {/* Depot name */}
                                              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)" }}>{depot.depot}</span>
                                              {/* Server badge */}
                                              {depot.server && (
                                                <span style={{ background: (SERVER_CLR[String(depot.server)] || "#64748B") + "20", color: SERVER_CLR[String(depot.server)] || "#64748B", fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "99px" }}>
                                                  S{depot.server}
                                                </span>
                                              )}
                                              {/* Server name */}
                                              {depot.server_name && (
                                                <span style={{ fontSize: "10px", color: "var(--text3)", background: "var(--surface2)", padding: "1px 6px", borderRadius: "99px" }}>
                                                  {depot.server_name}
                                                </span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                        {/* Divider between ADS */}
                                        {adm.adsList.indexOf(ads) < adm.adsList.length - 1 && (
                                          <div style={{ borderBottom: "1px dashed var(--border)", margin: "8px 0" }} />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  )
}