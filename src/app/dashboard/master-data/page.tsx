"use client"
// PATH: src/app/dashboard/master-data/page.tsx

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Search, X, FileSpreadsheet, Building2, MapPin, Server, Users,
  RefreshCw, AlertCircle, CheckCircle2, Plus, Trash2, Pencil,
  Save, Upload, ChevronDown, ChevronUp, ChevronRight, KeyRound, Copy, Check,
  List, FolderTree, Link2,
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"

interface DepotRow {
  id: string
  adp_code: number | null
  depot: string
  distributor_name: string
  server: number | null
  server_name: string
  area: number | null
  area_name: string
  region: number | null
  region_name: string
  ads_name: string
  adm_name: string
  rdm_name: string
  status: string
  remarks: string
  updated_at?: string
  ads_id?: string | null
}

interface FicomUser {
  id: string
  user_login: string
  sales_name: string
  password: string
  position: string
}

type HierLevel = "RDM" | "ADM" | "ADS"
interface HierarchyNode {
  id: string
  level: HierLevel
  name: string
  parent_id: string | null
}
const CHILD_LEVEL: Record<HierLevel, HierLevel | null> = { RDM: "ADM", ADM: "ADS", ADS: null }

const REGION_CLR: Record<string, string> = {
  GMA: "#7C3AED", NOL: "#1D4ED8", SOL: "#DB2777", VIS: "#0891B2", MIN: "#DC2626",
}
const REMARKS_CLR: Record<string, { bg: string; color: string }> = {
  Active:   { bg: "#DCFCE7", color: "#166534" },
  Inactive: { bg: "#FEE2E2", color: "#991B1B" },
  New:      { bg: "#FEF3C7", color: "#92400E" },
}
const STATUS_CLR: Record<string, { bg: string; color: string }> = {
  "MAIN WH": { bg: "#EDE9FE", color: "#7C3AED" },
  "SDP":     { bg: "#FEF3C7", color: "#92400E" },
}
const POS_CLR: Record<string, { bg: string; color: string }> = {
  RDM: { bg: "#FEF3C7", color: "#92400E" },
  ADM: { bg: "#EDE9FE", color: "#7C3AED" },
  ADS: { bg: "#E0F2FE", color: "#0369A1" },
}

// Extract WF code from name like "WF1105-BARAS_RIZAL- ADM C. Roque"
function extractLogin(name: string): string {
  const m = name.match(/^(WF\d+)/i)
  return m ? m[1].toUpperCase() : ""
}

export default function MasterDataPage() {
  const [data, setData]             = useState<DepotRow[]>([])
  const [ficomMap, setFicomMap]     = useState<Record<string, FicomUser>>({})
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState("")
  const [success, setSuccess]       = useState("")
  const [search, setSearch]         = useState("")
  const [regionFilter, setRegion]   = useState("ALL")
  const [statusFilter, setStatus]   = useState("ALL")
  const [remarksFilter, setRemarks] = useState("ALL")
  const [serverFilter, setServerFilter] = useState("ALL")  // values: ALL | 138 | 228 | 252
  const [exporting, setExporting]   = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editId, setEditId]         = useState<string | null>(null)
  const [draft, setDraft]           = useState<Partial<DepotRow>>({})
  const [copied, setCopied]         = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Hierarki RDM → ADM → ADS ───────────────────────────────
  const [view, setView] = useState<"table" | "hierarchy">("table")
  const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([])
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null)
  const [nodeNameDraft, setNodeNameDraft] = useState("")
  const [addingUnder, setAddingUnder] = useState<{ parentId: string | null; level: HierLevel } | null>(null)
  const [newNodeName, setNewNodeName] = useState("")
  const [hierSaving, setHierSaving] = useState(false)

  const load = async () => {
    setLoading(true); setError("")
    const [depotRes, ficomRes, hierRes] = await Promise.all([
      supabase.from("master_data_adp").select("*").order("region_name").order("adp_code").order("depot"),
      supabase.from("ficom_passwords").select("*"),
      supabase.from("master_hierarchy").select("*").order("level").order("name"),
    ])
    if (depotRes.data) setData(depotRes.data)
    if (depotRes.error) setError(depotRes.error.message)
    if (ficomRes.data) {
      const map: Record<string, FicomUser> = {}
      ficomRes.data.forEach((u: FicomUser) => { map[u.user_login.toUpperCase()] = u })
      setFicomMap(map)
    }
    if (hierRes.data) setHierarchy(hierRes.data)
    if (hierRes.error) setError(hierRes.error.message)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const nodeById = useMemo(() => new Map(hierarchy.map(n => [n.id, n])), [hierarchy])
  const childrenOf = useMemo(() => {
    const m = new Map<string, HierarchyNode[]>()
    for (const n of hierarchy) {
      const key = n.parent_id ?? "__root__"
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(n)
    }
    return m
  }, [hierarchy])
  const depotsByAds = useMemo(() => {
    const m = new Map<string, DepotRow[]>()
    for (const d of data) {
      if (!d.ads_id) continue
      if (!m.has(d.ads_id)) m.set(d.ads_id, [])
      m.get(d.ads_id)!.push(d)
    }
    return m
  }, [data])
  const unassignedDepots = useMemo(() => data.filter(d => !d.ads_id), [data])
  const adsOptions = useMemo(() => {
    return hierarchy.filter(n => n.level === "ADS").map(ads => {
      const adm = ads.parent_id ? nodeById.get(ads.parent_id) : undefined
      const rdm = adm?.parent_id ? nodeById.get(adm.parent_id) : undefined
      return { id: ads.id, label: `${rdm?.name || "?"} / ${adm?.name || "?"} / ${ads.name}` }
    }).sort((a, b) => a.label.localeCompare(b.label))
  }, [hierarchy, nodeById])

  const toggleNode = (id: string) => setExpandedNodes(p => {
    const n = new Set(p)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  // Rantai nama (rdm/adm/ads) buat sebuah node ADS — dipakai buat sinkron
  // kolom teks denormalized di master_data_adp (dipakai halaman lain).
  const chainFor = (adsId: string): { rdm_name: string; adm_name: string; ads_name: string } | null => {
    const ads = nodeById.get(adsId)
    if (!ads || ads.level !== "ADS") return null
    const adm = ads.parent_id ? nodeById.get(ads.parent_id) : undefined
    const rdm = adm?.parent_id ? nodeById.get(adm.parent_id) : undefined
    return { rdm_name: rdm?.name || "", adm_name: adm?.name || "", ads_name: ads.name }
  }

  const addNode = async (level: HierLevel, parentId: string | null) => {
    const name = newNodeName.trim()
    if (!name) return
    setHierSaving(true); setError("")
    const { data: row, error: err } = await supabase.from("master_hierarchy")
      .insert({ level, name, parent_id: parentId }).select().single()
    setHierSaving(false)
    if (err) { setError(err.message); return }
    setHierarchy(p => [...p, row])
    setAddingUnder(null); setNewNodeName("")
    if (parentId) setExpandedNodes(p => new Set(p).add(parentId))
  }

  const startRenameNode = (n: HierarchyNode) => { setEditingNodeId(n.id); setNodeNameDraft(n.name) }

  const saveRenameNode = async (n: HierarchyNode) => {
    const name = nodeNameDraft.trim()
    if (!name) { setError("Nama tidak boleh kosong"); return }
    setHierSaving(true); setError("")
    const { error: err } = await supabase.from("master_hierarchy").update({ name, updated_at: new Date().toISOString() }).eq("id", n.id)
    if (err) { setError(err.message); setHierSaving(false); return }
    const updatedHierarchy = hierarchy.map(h => h.id === n.id ? { ...h, name } : h)
    setHierarchy(updatedHierarchy)
    setEditingNodeId(null)

    // Sinkron kolom teks denormalized di semua depot yang kena dampak rename ini
    const nodeByIdNew = new Map(updatedHierarchy.map(h => [h.id, h]))
    const affectedAdsIds: string[] = n.level === "ADS" ? [n.id] : updatedHierarchy
      .filter(h => h.level === "ADS" && (n.level === "ADM" ? h.parent_id === n.id : nodeByIdNew.get(h.parent_id || "")?.parent_id === n.id))
      .map(h => h.id)
    for (const adsId of affectedAdsIds) {
      const ads = nodeByIdNew.get(adsId)
      const adm = ads?.parent_id ? nodeByIdNew.get(ads.parent_id) : undefined
      const rdm = adm?.parent_id ? nodeByIdNew.get(adm.parent_id) : undefined
      await supabase.from("master_data_adp")
        .update({ ads_name: ads?.name || "", adm_name: adm?.name || "", rdm_name: rdm?.name || "" })
        .eq("ads_id", adsId)
    }
    setHierSaving(false)
    setData(p => p.map(d => {
      if (!d.ads_id || !affectedAdsIds.includes(d.ads_id)) return d
      const ads = nodeByIdNew.get(d.ads_id)
      const adm = ads?.parent_id ? nodeByIdNew.get(ads.parent_id) : undefined
      const rdm = adm?.parent_id ? nodeByIdNew.get(adm.parent_id) : undefined
      return { ...d, ads_name: ads?.name || "", adm_name: adm?.name || "", rdm_name: rdm?.name || "" }
    }))
    setSuccess("Tersimpan!"); setTimeout(() => setSuccess(""), 2500)
  }

  const deleteNode = async (n: HierarchyNode) => {
    const childCount = (childrenOf.get(n.id) || []).length
    const depotCount = n.level === "ADS" ? (depotsByAds.get(n.id) || []).length : 0
    const warn = childCount > 0
      ? `${n.name} punya ${childCount} sub-node di bawahnya — semua ikut terhapus. Lanjut?`
      : depotCount > 0
        ? `${n.name} masih dipakai ${depotCount} depot — depot itu akan jadi "Belum Terhubung", bukan ikut terhapus. Lanjut?`
        : `Hapus ${n.name}?`
    if (!confirm(warn)) return
    const { error: err } = await supabase.from("master_hierarchy").delete().eq("id", n.id)
    if (err) { setError(err.message); return }
    load()
  }

  const assignDepotToAds = async (depotId: string, adsId: string) => {
    const chain = chainFor(adsId)
    if (!chain) return
    setError("")
    const { error: err } = await supabase.from("master_data_adp")
      .update({ ads_id: adsId, ...chain, updated_at: new Date().toISOString() }).eq("id", depotId)
    if (err) { setError(err.message); return }
    setData(p => p.map(d => d.id === depotId ? { ...d, ads_id: adsId, ...chain } : d))
    setSuccess("Depot terhubung!"); setTimeout(() => setSuccess(""), 2500)
  }

  const regions = useMemo(() =>
    ["ALL", ...Array.from(new Set(data.map(d => d.region_name).filter(Boolean))).sort()],
    [data]
  )
  // Server filter options
  const SERVER_OPTIONS = ["ALL", "138", "228", "252", "NULL"]

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return data.filter(d => {
      const matchQ = !q ||
        d.depot.toLowerCase().includes(q) ||
        d.distributor_name.toLowerCase().includes(q) ||
        String(d.adp_code ?? "").includes(q) ||
        d.adm_name.toLowerCase().includes(q) ||
        d.ads_name.toLowerCase().includes(q) ||
        d.rdm_name.toLowerCase().includes(q)
      return matchQ &&
        (regionFilter  === "ALL" || d.region_name  === regionFilter) &&
        (statusFilter  === "ALL" || d.status       === statusFilter) &&
        (remarksFilter === "ALL" || d.remarks      === remarksFilter) &&
        (serverFilter  === "ALL" || (serverFilter === "NULL" ? (d.server === null || d.server === undefined) : String(d.server ?? "") === serverFilter))
    })
  }, [data, search, regionFilter, statusFilter, remarksFilter, serverFilter])

  const stats = useMemo(() => ({
    total:    data.length,
    active:   data.filter(d => d.remarks === "Active").length,
    inactive: data.filter(d => d.remarks === "Inactive").length,
    newDep:   data.filter(d => d.remarks === "New").length,
  }), [data])

  // ── Row expand/collapse ───────────────────────────────────
  const toggleExpand = (id: string) => {
    if (editId) return
    setExpandedId(p => p === id ? null : id)
  }

  // ── CRUD ──────────────────────────────────────────────────
  const addRow = () => {
    const tempId = `new-${Date.now()}`
    const nu: DepotRow = {
      id: tempId, adp_code: null, depot: "", distributor_name: "",
      server: null, server_name: "", area: null, area_name: "", region: null, region_name: "",
      ads_name: "", adm_name: "", rdm_name: "", status: "MAIN WH", remarks: "Active",
    }
    setData(p => [nu, ...p])
    setEditId(tempId); setDraft(nu); setExpandedId(null)
  }

  const startEdit = (d: DepotRow, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditId(d.id); setDraft({ ...d }); setExpandedId(null)
  }

  const saveEdit = async () => {
    if (!draft.depot?.trim()) { setError("Nama depot tidak boleh kosong"); return }
    setSaving(true); setError("")
    const payload = {
      adp_code:         draft.adp_code ?? null,
      depot:            draft.depot.trim().toUpperCase(),
      distributor_name: draft.distributor_name?.trim() ?? "",
      server:           draft.server ?? null,
      server_name:      draft.server_name?.trim() ?? "",
      area:             draft.area ?? null,
      area_name:        draft.area_name?.trim().toUpperCase() ?? "",
      region:           draft.region ?? null,
      region_name:      draft.region_name?.trim().toUpperCase() ?? "",
      ads_name:         draft.ads_name?.trim() ?? "",
      adm_name:         draft.adm_name?.trim() ?? "",
      rdm_name:         draft.rdm_name?.trim() ?? "",
      status:           draft.status ?? "MAIN WH",
      remarks:          draft.remarks ?? "Active",
      updated_at:       new Date().toISOString(),
    }
    const isNew = editId?.startsWith("new-")
    if (isNew) {
      const { data: row, error: err } = await supabase.from("master_data_adp").insert(payload).select().single()
      if (err) { setError(err.message); setSaving(false); return }
      setData(p => p.map(d => d.id === editId ? row : d))
    } else {
      const { error: err } = await supabase.from("master_data_adp").update(payload).eq("id", editId!)
      if (err) { setError(err.message); setSaving(false); return }
      setData(p => p.map(d => d.id === editId ? { ...d, ...payload } : d))
    }
    setEditId(null); setSaving(false)
    setSuccess("Tersimpan!"); setTimeout(() => setSuccess(""), 2500)
  }

  const cancelEdit = () => {
    setData(p => p.filter(d => !d.id.startsWith("new-")))
    setEditId(null)
  }

  const deleteRow = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Hapus depot ini?")) return
    const { error: err } = await supabase.from("master_data_adp").delete().eq("id", id)
    if (err) setError(err.message)
    else { setData(p => p.filter(d => d.id !== id)); if (expandedId === id) setExpandedId(null) }
  }

  // ── Export Excel ──────────────────────────────────────────
  const exportExcel = async () => {
    setExporting(true)
    try {
      const XLSX = await import("xlsx")
      const ws = XLSX.utils.json_to_sheet(filtered.map(d => ({
        "ADP Code": d.adp_code ?? "", "Depot": d.depot,
        "Distributor Name": d.distributor_name, "Server": d.server ?? "",
        "Area": d.area ?? "", "Area Name": d.area_name,
        "Region": d.region ?? "", "Region Name": d.region_name,
        "ADS Name": d.ads_name, "ADM Name": d.adm_name, "RDM Name": d.rdm_name,
        "Status": d.status, "Remarks": d.remarks,
      })))
      ws["!cols"] = [{wch:10},{wch:30},{wch:45},{wch:8},{wch:8},{wch:14},{wch:8},{wch:10},{wch:36},{wch:36},{wch:36},{wch:10},{wch:10}]
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Master Data ADP")
      XLSX.writeFile(wb, `Master_Data_ADP_${new Date().toISOString().slice(0,10)}.xlsx`)
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
      const toInsert = rows
        .filter(r => String(r["Depot"] ?? "").trim() !== "")
        .map(r => ({
          adp_code:         Number(r["ADP Code"]) || null,
          depot:            String(r["Depot"] ?? "").trim().toUpperCase(),
          distributor_name: String(r["Distributor Name"] ?? "").trim(),
          server:           Number(r["Server"]) || null,
          server_name:      String(r["Server Name"] ?? "").trim(),
          area:             Number(r["Area"]) || null,
          area_name:        String(r["Area Name"] ?? "").trim(),
          region:           Number(r["Region"]) || null,
          region_name:      String(r["Region Name"] ?? "").trim(),
          ads_name:         String(r["ADS Name"] ?? "").trim(),
          adm_name:         String(r["ADM Name"] ?? "").trim(),
          rdm_name:         String(r["RDM Name"] ?? "").trim(),
          status:           String(r["Status"] ?? "MAIN WH").trim(),
          remarks:          String(r["Remarks"] ?? "Active").trim(),
          updated_at:       new Date().toISOString(),
        }))
      const { error: err } = await supabase.from("master_data_adp").insert(toInsert)
      if (err) throw err
      setSuccess(`✅ ${toInsert.length} depot berhasil di-import`); setTimeout(() => setSuccess(""), 3000)
      load()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key); setTimeout(() => setCopied(null), 1500)
  }

  // ── Styles ────────────────────────────────────────────────
  const inputSt: React.CSSProperties = {
    padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--accent-light)",
    background: "var(--surface)", color: "var(--text)", fontSize: "12px",
    fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none",
  }
  const th: React.CSSProperties = {
    padding: "10px 14px", fontSize: "11px", fontWeight: 700, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap",
    borderBottom: "1px solid var(--border)", background: "var(--surface2)",
  }
  const td: React.CSSProperties = {
    padding: "11px 14px", fontSize: "12px", color: "var(--text)",
    borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
    overflow: "hidden", textOverflow: "ellipsis", maxWidth: "180px",
  }

  // ── Personnel Card (shown in expanded row) ────────────────
  const PersonnelCard = ({ label, name, rowId }: { label: string; name: string; rowId: string }) => {
    const login = extractLogin(name)
    const ficom = login ? ficomMap[login] : null
    const clr   = POS_CLR[label] || { bg: "var(--surface3)", color: "var(--text3)" }
    const key   = `${rowId}-${label}`

    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px", minWidth: "220px", flex: "1" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <span style={{ ...clr, padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>{label}</span>
          {login && <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text3)", fontWeight: 600 }}>{login}</span>}
        </div>
        {name ? (
          <>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "4px", whiteSpace: "normal" }}>
              {name.replace(/^WF\d+-[^\s]+ - (ADM|ADS|RDM)\s+/i, "").replace(/^WF\d+-[^\s]+-\s+(ADM|ADS|RDM)\s+/i, "") || name}
            </div>
            {ficom ? (
              <div style={{ marginTop: "8px", background: "var(--surface2)", borderRadius: "8px", padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                  <KeyRound size={11} color="#7C3AED" />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#7C3AED", textTransform: "uppercase", letterSpacing: "0.04em" }}>Ficom Login</span>
                </div>
                <div style={{ fontSize: "13px", fontWeight: 700, fontFamily: "monospace", color: "var(--text)", marginBottom: "4px" }}>
                  {ficom.user_login}
                </div>
                <div style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "6px" }}>{ficom.sales_name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "11px", color: "var(--text3)", letterSpacing: "0.12em", background: "var(--surface)", padding: "3px 8px", borderRadius: "5px" }}>
                    {"•".repeat(Math.min(ficom.password.length, 10))}
                  </span>
                  <button onClick={() => copyText(ficom.password, key)}
                    style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 8px", borderRadius: "5px", border: "1px solid var(--border)", background: copied === key ? "#DCFCE7" : "var(--surface)", color: copied === key ? "#166534" : "var(--text3)", fontSize: "11px", cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, transition: "all 0.2s" }}>
                    {copied === key ? <Check size={11} /> : <Copy size={11} />}
                    {copied === key ? "Copied!" : "Copy Pwd"}
                  </button>
                </div>
              </div>
            ) : login ? (
              <div style={{ marginTop: "8px", background: "#FEF3C7", borderRadius: "8px", padding: "8px 12px" }}>
                <span style={{ fontSize: "11px", color: "#92400E" }}>⚠️ {login} tidak ditemukan di Ficom Password</span>
              </div>
            ) : (
              <div style={{ marginTop: "8px", background: "var(--surface2)", borderRadius: "8px", padding: "8px 12px" }}>
                <span style={{ fontSize: "11px", color: "var(--text3)" }}>Tidak ada kode WF</span>
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: "12px", color: "var(--text3)" }}>—</div>
        )}
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <MotivationBanner page="master-data" />
      <div style={{ padding: "28px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "11px", background: "#0369A1", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={20} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>Master Data</h1>
              <p style={{ fontSize: "13px", color: "var(--text3)", margin: 0 }}>ADP Depot & Distributor · {data.length} records · klik baris untuk detail personel</p>
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
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "9px", border: "1px solid #166534", background: "#166834", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <FileSpreadsheet size={13} /> {exporting ? "Exporting..." : `Export Excel (${filtered.length})`}
            </button>
            <button onClick={addRow} disabled={!!editId}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "9px", border: "none", background: "#0369A1", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: editId ? 0.5 : 1 }}>
              <Plus size={14} /> Tambah Depot
            </button>
          </div>
        </div>

        {/* View tabs */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
          {([
            ["table", "Tabel Depot", List],
            ["hierarchy", "Hierarki RDM/ADM/ADS", FolderTree],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setView(key)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "9px", border: "1px solid var(--border)", background: view === key ? "#0369A1" : "var(--surface)", color: view === key ? "white" : "var(--text3)", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              <Icon size={13} /> {label}
            </button>
          ))}
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

        {view === "table" && <>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px", marginBottom: "20px" }}>
          {([
            ["Total Depots", stats.total,    "#0369A1", Building2],
            ["Active",       stats.active,   "#166534", MapPin   ],
            ["Inactive",     stats.inactive, "#991B1B", Server   ],
            ["New",          stats.newDep,   "#92400E", Users    ],
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "8px 12px", flex: "1", minWidth: "200px" }}>
            <Search size={14} color="var(--text3)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari depot, distributor, ADM/ADS/RDM..."
              style={{ background: "none", border: "none", outline: "none", fontSize: "13px", color: "var(--text)", width: "100%", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
            {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0 }}><X size={14} /></button>}
          </div>
          <select value={regionFilter} onChange={e => setRegion(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "13px", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer" }}>
            {regions.map(o => <option key={o} value={o}>{o === "ALL" ? "All Region" : o}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatus(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "13px", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer" }}>
            {["ALL","MAIN WH","SDP"].map(o => <option key={o} value={o}>{o === "ALL" ? "All Status" : o}</option>)}
          </select>
          <select value={remarksFilter} onChange={e => setRemarks(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "13px", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer" }}>
            {["ALL","Active","Inactive","New"].map(o => <option key={o} value={o}>{o === "ALL" ? "All Remarks" : o}</option>)}
          </select>
          <select value={serverFilter} onChange={e => setServerFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "13px", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer" }}>
            {SERVER_OPTIONS.map(o => <option key={o} value={o}>{o === "ALL" ? "All Server" : o === "NULL" ? "Tanpa Server" : `Server ${o}`}</option>)}
          </select>
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
                    <th style={th}></th>
                    <th style={th}>ADP Code</th>
                    <th style={th}>Depot</th>
                    <th style={th}>Distributor</th>
                    <th style={th}>Server</th>
                    <th style={th}>Server Name</th>
                    <th style={th}>Region</th>
                    <th style={th}>Area</th>
                    <th style={th}>Status</th>
                    <th style={th}>Remarks</th>
                    <th style={th}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={11} style={{ ...td, textAlign: "center", padding: "48px", color: "var(--text3)" }}>Tidak ada data</td></tr>
                  ) : filtered.map((d, i) => {
                    const isEditing  = editId === d.id
                    const isExpanded = expandedId === d.id
                    const bg = isEditing ? "var(--accent-muted)" : isExpanded ? "#F0F9FF" : i % 2 === 0 ? "transparent" : "var(--surface2)"

                    return (
                      <>
                        {/* Main Row */}
                        <tr key={d.id}
                          onClick={() => !isEditing && toggleExpand(d.id)}
                          style={{ background: bg, cursor: isEditing ? "default" : "pointer", transition: "background 0.15s" }}
                          onMouseEnter={e => { if (!isEditing && !isExpanded) (e.currentTarget as HTMLElement).style.background = "var(--accent-muted)" }}
                          onMouseLeave={e => { if (!isEditing && !isExpanded) (e.currentTarget as HTMLElement).style.background = bg }}>

                          {/* Expand indicator */}
                          <td style={{ ...td, width: "36px", textAlign: "center", padding: "11px 8px" }}>
                            {isEditing ? null : isExpanded
                              ? <ChevronUp size={14} color="#0369A1" />
                              : <ChevronDown size={14} color="var(--text3)" />}
                          </td>

                          {/* ADP Code */}
                          <td style={td}>
                            {isEditing ? (
                              <input type="number" value={draft.adp_code ?? ""} onChange={e => setDraft(p => ({ ...p, adp_code: Number(e.target.value) || null }))}
                                placeholder="100018" style={{ ...inputSt, width: "80px" }} />
                            ) : (
                              <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: "11px", color: "#0369A1" }}>{d.adp_code ?? "—"}</span>
                            )}
                          </td>

                          {/* Depot */}
                          <td style={td}>
                            {isEditing ? (
                              <input value={draft.depot ?? ""} onChange={e => setDraft(p => ({ ...p, depot: e.target.value }))}
                                placeholder="Nama Depot" style={{ ...inputSt, width: "150px" }} autoFocus />
                            ) : (
                              <span style={{ fontWeight: 600 }}>{d.depot}</span>
                            )}
                          </td>

                          {/* Distributor */}
                          <td style={td}>
                            {isEditing ? (
                              <input value={draft.distributor_name ?? ""} onChange={e => setDraft(p => ({ ...p, distributor_name: e.target.value }))}
                                placeholder="Distributor Name" style={{ ...inputSt, width: "180px" }} />
                            ) : (
                              <span style={{ fontSize: "11px", color: "var(--text3)" }}>{d.distributor_name || "—"}</span>
                            )}
                          </td>

                          {/* Server */}
                          <td style={{ ...td, textAlign: "center" }}>
                            {isEditing ? (
                              <input type="number" value={draft.server ?? ""} onChange={e => setDraft(p => ({ ...p, server: Number(e.target.value) || null }))}
                                placeholder="138" style={{ ...inputSt, width: "60px", textAlign: "center" }} />
                            ) : (
                              <span style={{ fontFamily: "monospace", fontSize: "11px" }}>{d.server ?? "—"}</span>
                            )}
                          </td>

                          {/* Server Name */}
                          <td style={td}>
                            {isEditing ? (
                              <input value={draft.server_name ?? ""} onChange={e => setDraft(p => ({ ...p, server_name: e.target.value }))}
                                placeholder="MAGIS-TYTY" style={{ ...inputSt, width: "110px" }} />
                            ) : (
                              <span style={{ background: "var(--surface3)", color: "var(--text3)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600 }}>
                                {d.server_name || "—"}
                              </span>
                            )}
                          </td>

                          {/* Region */}
                          <td style={td}>
                            {isEditing ? (
                              <input value={draft.region_name ?? ""} onChange={e => setDraft(p => ({ ...p, region_name: e.target.value }))}
                                placeholder="GMA" style={{ ...inputSt, width: "70px" }} />
                            ) : d.region_name ? (
                              <span style={{ background: (REGION_CLR[d.region_name] || "#64748B") + "20", color: REGION_CLR[d.region_name] || "#64748B", padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>
                                {d.region_name}
                              </span>
                            ) : "—"}
                          </td>

                          {/* Area */}
                          <td style={{ ...td, fontSize: "11px", color: "var(--text3)" }}>
                            {isEditing ? (
                              <input value={draft.area_name ?? ""} onChange={e => setDraft(p => ({ ...p, area_name: e.target.value }))}
                                placeholder="DISTRICT 1" style={{ ...inputSt, width: "100px" }} />
                            ) : (d.area_name || "—")}
                          </td>

                          {/* Status */}
                          <td style={td}>
                            {isEditing ? (
                              <select value={draft.status ?? "MAIN WH"} onChange={e => setDraft(p => ({ ...p, status: e.target.value }))}
                                style={{ ...inputSt, width: "90px", cursor: "pointer" }}>
                                {["MAIN WH","SDP"].map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            ) : d.status ? (
                              <span style={{ ...(STATUS_CLR[d.status] || { bg: "var(--surface3)", color: "var(--text3)" }), padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>
                                {d.status}
                              </span>
                            ) : "—"}
                          </td>

                          {/* Remarks */}
                          <td style={td}>
                            {isEditing ? (
                              <select value={draft.remarks ?? "Active"} onChange={e => setDraft(p => ({ ...p, remarks: e.target.value }))}
                                style={{ ...inputSt, width: "90px", cursor: "pointer" }}>
                                {["Active","Inactive","New"].map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                            ) : d.remarks ? (
                              <span style={{ ...(REMARKS_CLR[d.remarks] || { bg: "var(--surface3)", color: "var(--text3)" }), padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>
                                {d.remarks}
                              </span>
                            ) : "—"}
                          </td>

                          {/* Actions */}
                          <td style={td} onClick={e => e.stopPropagation()}>
                            {isEditing ? (
                              <div style={{ display: "flex", gap: "6px" }}>
                                <button onClick={saveEdit} disabled={saving}
                                  style={{ display: "flex", alignItems: "center", gap: "4px", padding: "5px 10px", borderRadius: "6px", border: "none", background: "#0369A1", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                                  <Save size={11} />{saving ? "..." : "Simpan"}
                                </button>
                                <button onClick={cancelEdit}
                                  style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "11px", cursor: "pointer" }}>
                                  Batal
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: "5px" }}>
                                <button onClick={e => startEdit(d, e)} disabled={!!editId} title="Edit"
                                  style={{ padding: "5px 7px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", color: "var(--text3)", display: "flex", alignItems: "center", opacity: editId ? 0.4 : 1 }}>
                                  <Pencil size={12} />
                                </button>
                                <button onClick={e => deleteRow(d.id, e)} disabled={!!editId} title="Hapus"
                                  style={{ padding: "5px 7px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center", opacity: editId ? 0.4 : 1 }}>
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>

                        {/* Expanded Personnel Row */}
                        {isExpanded && !isEditing && (
                          <tr key={`${d.id}-expanded`}>
                            <td colSpan={11} style={{ padding: 0, borderBottom: "2px solid #0369A1" }}>
                              <div style={{ background: "linear-gradient(135deg,#F0F9FF,#E0F2FE)", padding: "20px 20px 20px 52px" }}>
                                {/* Header info */}
                                <div style={{ marginBottom: "14px" }}>
                                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0369A1", marginBottom: "2px" }}>
                                    📍 {d.depot} {d.distributor_name ? `— ${d.distributor_name}` : ""}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "var(--text3)" }}>
                                    ADP: {d.adp_code ?? "—"} · Server: {d.server ?? "—"} · Area: {d.area_name || "—"} · Region: {d.region_name || "—"}
                                  </div>
                                </div>

                                {/* Edit personel fields */}
                                {isEditing ? null : (
                                  <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                                    <PersonnelCard label="ADS" name={d.ads_name} rowId={d.id} />
                                    <PersonnelCard label="ADM" name={d.adm_name} rowId={d.id} />
                                    <PersonnelCard label="RDM" name={d.rdm_name} rowId={d.id} />
                                  </div>
                                )}

                                {/* Quick edit personel names */}
                                <div style={{ marginTop: "16px", display: "flex", gap: "10px", flexWrap: "wrap", padding: "12px 14px", background: "rgba(255,255,255,0.6)", borderRadius: "8px", border: "1px solid #BAE6FD" }}>
                                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369A1", alignSelf: "center", flexShrink: 0 }}>Edit Personel:</span>
                                  {(["ads_name","adm_name","rdm_name"] as const).map(field => (
                                    <div key={field} style={{ display: "flex", flexDirection: "column", gap: "3px", flex: "1", minWidth: "200px" }}>
                                      <label style={{ fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        {field === "ads_name" ? "ADS" : field === "adm_name" ? "ADM" : "RDM"}
                                      </label>
                                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                                        <span style={{ fontSize: "12px", color: "var(--text)", flex: 1, padding: "5px 8px", background: "var(--surface2)", borderRadius: "6px" }}>
                                          {d[field] || "—"}
                                        </span>
                                        <button onClick={e => { e.stopPropagation(); startEdit(d, e) }}
                                          style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "white", cursor: "pointer", color: "#0369A1", display: "flex", alignItems: "center" }}>
                                          <Pencil size={11} />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>}

        {view === "hierarchy" && (
          <HierarchyView
            childrenOf={childrenOf}
            depotsByAds={depotsByAds}
            unassignedDepots={unassignedDepots}
            adsOptions={adsOptions}
            expandedNodes={expandedNodes}
            toggleNode={toggleNode}
            editingNodeId={editingNodeId}
            nodeNameDraft={nodeNameDraft}
            setNodeNameDraft={setNodeNameDraft}
            startRenameNode={startRenameNode}
            saveRenameNode={saveRenameNode}
            setEditingNodeId={setEditingNodeId}
            deleteNode={deleteNode}
            addingUnder={addingUnder}
            setAddingUnder={setAddingUnder}
            newNodeName={newNodeName}
            setNewNodeName={setNewNodeName}
            addNode={addNode}
            hierSaving={hierSaving}
            assignDepotToAds={assignDepotToAds}
            jumpToDepot={(depotId: string) => { setView("table"); setExpandedId(depotId) }}
            loading={loading}
          />
        )}
      </div>
    </div>
  )
}

// ── Hierarchy tree view ─────────────────────────────────────────
const LEVEL_NEXT_LABEL: Record<HierLevel, string> = { RDM: "ADM", ADM: "ADS", ADS: "" }
const POS_CLR2: Record<HierLevel, { bg: string; color: string }> = {
  RDM: { bg: "#FEF3C7", color: "#92400E" },
  ADM: { bg: "#EDE9FE", color: "#7C3AED" },
  ADS: { bg: "#E0F2FE", color: "#0369A1" },
}

function HierarchyView({
  childrenOf, depotsByAds, unassignedDepots, adsOptions,
  expandedNodes, toggleNode, editingNodeId, nodeNameDraft, setNodeNameDraft,
  startRenameNode, saveRenameNode, setEditingNodeId, deleteNode,
  addingUnder, setAddingUnder, newNodeName, setNewNodeName, addNode, hierSaving,
  assignDepotToAds, jumpToDepot, loading,
}: {
  childrenOf: Map<string, HierarchyNode[]>
  depotsByAds: Map<string, DepotRow[]>
  unassignedDepots: DepotRow[]
  adsOptions: { id: string; label: string }[]
  expandedNodes: Set<string>
  toggleNode: (id: string) => void
  editingNodeId: string | null
  nodeNameDraft: string
  setNodeNameDraft: (v: string) => void
  startRenameNode: (n: HierarchyNode) => void
  saveRenameNode: (n: HierarchyNode) => void
  setEditingNodeId: (v: string | null) => void
  deleteNode: (n: HierarchyNode) => void
  addingUnder: { parentId: string | null; level: HierLevel } | null
  setAddingUnder: (v: { parentId: string | null; level: HierLevel } | null) => void
  newNodeName: string
  setNewNodeName: (v: string) => void
  addNode: (level: HierLevel, parentId: string | null) => void
  hierSaving: boolean
  assignDepotToAds: (depotId: string, adsId: string) => void
  jumpToDepot: (depotId: string) => void
  loading: boolean
}) {
  const rootNodes = childrenOf.get("__root__") || []

  const AddInline = ({ parentId, level }: { parentId: string | null; level: HierLevel }) => {
    const isAdding = addingUnder?.parentId === parentId && addingUnder?.level === level
    if (!isAdding) {
      return (
        <button onClick={() => { setAddingUnder({ parentId, level }); setNewNodeName("") }}
          style={{ display: "flex", alignItems: "center", gap: "4px", padding: "4px 9px", borderRadius: "6px", border: "1px dashed var(--border)", background: "transparent", color: "var(--text3)", fontSize: "11px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <Plus size={11} /> Tambah {level}
        </button>
      )
    }
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <input autoFocus value={newNodeName} onChange={e => setNewNodeName(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") addNode(level, parentId); if (e.key === "Escape") setAddingUnder(null) }}
          placeholder={`Nama ${level} baru`}
          style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--accent-light)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", width: "180px", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
        <button onClick={() => addNode(level, parentId)} disabled={hierSaving}
          style={{ padding: "5px 9px", borderRadius: "6px", border: "none", background: "#0369A1", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
          <Save size={11} />
        </button>
        <button onClick={() => setAddingUnder(null)}
          style={{ padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "11px", cursor: "pointer" }}>
          Batal
        </button>
      </div>
    )
  }

  const NodeRow = ({ n, depth }: { n: HierarchyNode; depth: number }) => {
    const kids = childrenOf.get(n.id) || []
    const isOpen = expandedNodes.has(n.id)
    const isEditing = editingNodeId === n.id
    const depots = n.level === "ADS" ? (depotsByAds.get(n.id) || []) : []
    const clr = POS_CLR2[n.level]
    const hasChildrenOrDepots = kids.length > 0 || depots.length > 0

    return (
      <div style={{ marginLeft: depth * 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 8px", borderRadius: "8px" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
          <button onClick={() => toggleNode(n.id)} disabled={!hasChildrenOrDepots}
            style={{ background: "none", border: "none", cursor: hasChildrenOrDepots ? "pointer" : "default", color: "var(--text3)", padding: 0, display: "flex", opacity: hasChildrenOrDepots ? 1 : 0.25 }}>
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <span style={{ ...clr, padding: "2px 8px", borderRadius: "99px", fontSize: "10px", fontWeight: 800, flexShrink: 0 }}>{n.level}</span>
          {isEditing ? (
            <>
              <input autoFocus value={nodeNameDraft} onChange={e => setNodeNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveRenameNode(n); if (e.key === "Escape") setEditingNodeId(null) }}
                style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--accent-light)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", width: "220px", fontFamily: "'Plus Jakarta Sans', sans-serif" }} />
              <button onClick={() => saveRenameNode(n)} disabled={hierSaving}
                style={{ padding: "5px 9px", borderRadius: "6px", border: "none", background: "#0369A1", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>
                <Save size={11} />
              </button>
              <button onClick={() => setEditingNodeId(null)}
                style={{ padding: "5px 9px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "11px", cursor: "pointer" }}>
                Batal
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{n.name}</span>
              {n.level === "ADS" && <span style={{ fontSize: "10px", color: "var(--text3)", background: "var(--surface3)", padding: "1px 7px", borderRadius: "99px" }}>{depots.length} depot</span>}
              {kids.length > 0 && n.level !== "ADS" && <span style={{ fontSize: "10px", color: "var(--text3)" }}>{kids.length} {LEVEL_NEXT_LABEL[n.level]}</span>}
              <button onClick={() => startRenameNode(n)} title="Rename"
                style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", color: "var(--text3)", display: "flex" }}>
                <Pencil size={11} />
              </button>
              <button onClick={() => deleteNode(n)} title="Hapus"
                style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", color: "#DC2626", display: "flex" }}>
                <Trash2 size={11} />
              </button>
              {n.level !== "ADS" && <AddInline parentId={n.id} level={CHILD_LEVEL[n.level]!} />}
            </>
          )}
        </div>

        {isOpen && (
          <div>
            {kids.map(k => <NodeRow key={k.id} n={k} depth={depth + 1} />)}
            {n.level === "ADS" && depots.map(d => (
              <div key={d.id} onClick={() => jumpToDepot(d.id)}
                style={{ marginLeft: (depth + 1) * 24, display: "flex", alignItems: "center", gap: "8px", padding: "5px 8px", cursor: "pointer", borderRadius: "6px" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <Building2 size={12} color="var(--text3)" />
                <span style={{ fontSize: "12px", color: "var(--text)" }}>{d.depot}</span>
                <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "monospace" }}>ADP {d.adp_code ?? "—"}</span>
                <Link2 size={11} color="var(--text3)" style={{ marginLeft: "auto" }} />
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "18px 20px" }}>
      {loading ? (
        <div style={{ padding: "60px", textAlign: "center", color: "var(--text3)", fontSize: "14px" }}>
          <RefreshCw size={24} style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
          Memuat hierarki...
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text)" }}>Hierarki RDM → ADM → ADS</div>
            <AddInline parentId={null} level="RDM" />
          </div>

          {rootNodes.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>Belum ada node RDM. Klik &quot;Tambah RDM&quot; buat mulai.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {rootNodes.map(n => <NodeRow key={n.id} n={n} depth={0} />)}
            </div>
          )}

          {unassignedDepots.length > 0 && (
            <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--border)" }}>
              <div style={{ fontSize: "13px", fontWeight: 800, color: "#92400E", marginBottom: "4px" }}>
                ⚠️ Depot Belum Terhubung Hierarki ({unassignedDepots.length})
              </div>
              <p style={{ fontSize: "11px", color: "var(--text3)", margin: "0 0 12px" }}>
                Depot ini belum di-link ke node ADS manapun. Pilih ADS tujuannya di dropdown masing-masing.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "320px", overflowY: "auto" }}>
                {unassignedDepots.map(d => (
                  <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", background: "var(--surface2)", borderRadius: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)", flex: 1 }}>{d.depot}</span>
                    <span style={{ fontSize: "10px", color: "var(--text3)", fontFamily: "monospace" }}>ADP {d.adp_code ?? "—"}</span>
                    <select defaultValue="" onChange={e => { if (e.target.value) assignDepotToAds(d.id, e.target.value) }}
                      style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "11px", fontFamily: "'Plus Jakarta Sans', sans-serif", cursor: "pointer", maxWidth: "260px" }}>
                      <option value="" disabled>Hubungkan ke ADS...</option>
                      {adsOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}