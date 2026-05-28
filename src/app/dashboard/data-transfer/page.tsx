"use client"
import React from "react"
// PATH: src/app/dashboard/data-transfer/page.tsx
// Data Transfer Web Ficom
// Dashboard = live staging dari n8n (tiap jam)
// History   = snapshot fix jam 00/06/16 dari n8n

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import {
  RefreshCw, Upload, X, Search, ChevronDown, ChevronRight,
  CheckCircle, AlertCircle, Clock, Calendar, Radio, Save,
  Filter, TriangleAlert, Info
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Types ─────────────────────────────────────────────────────
interface StagingRow {
  id:             number
  distributor_id: string
  distributor_nm: string
  tgl_gudang:     string  // "DD MMM YYYY" e.g. "27 MAY 2026"
  spv:            string
  rsm:            string
  grsm:           string
  release:        string
  // joined from master_data_adp:
  server?:        string
  server_name?:   string
  depot?:         string
  aor?:           string
  tas?:           string
}

interface MasterRow {
  adp_code:    number
  server:      number
  server_name: string
  depot:       string
  area_name:   string   // AOR e.g. GMA, NOL
  region_name: string
  remarks:     string
  status:      string
  ads_name:    string
  adm_name:    string
}

interface DisplayRow extends StagingRow {
  lama:         number
  excluded:     boolean
  tgl_iso:      string
  region_name?: string
}

interface SnapshotHeader {
  id:            string
  snapshot_date: string
  note:          string
  created_by:    string
  created_at:    string
}

interface SnapshotDetail {
  distributor_id: string
  distributor_nm: string
  tgl_gudang:     string
  lama:           number
  excluded:       boolean
  server?:        number
  server_name?:   string
  depot?:         string
  region_name?:   string   // AOR: GMA, NOL, SOL, VIS, MIN
  aor?:           string   // alias for region_name compatibility
  tas?:           string
  spv?:           string
  grsm?:          string
  release?:       string
}

// ── Helpers ───────────────────────────────────────────────────
function parseTglGudang(raw: string | Date | null | undefined): string {
  if (!raw) return ""
  const s = String(raw)
  // Already ISO: "2026-05-27" or "2026-05-27T..."
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10)
  // "27 MAY 2026" format
  const months: Record<string,string> = {
    JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",
    JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12"
  }
  const parts = s.trim().toUpperCase().split(/\s+/)
  if (parts.length === 3) {
    const [d, m, y] = parts
    return `${y}-${months[m] || "01"}-${d.padStart(2,"0")}`
  }
  return ""
}

function getBaseline(fromDateISO: string): string {
  // h-1, tapi Senin → h-3 (Jumat), Minggu → h-2 (Jumat)
  const d = new Date(fromDateISO)
  const day = d.getDay() // 0=Sun, 1=Mon, 6=Sat
  const sub = day === 1 ? 3 : day === 0 ? 2 : 1
  d.setDate(d.getDate() - sub)
  return d.toISOString().slice(0, 10)
}

function calcLama(tglISO: string, baselineISO: string): number {
  if (!tglISO || !baselineISO) return 99
  // Add T12:00:00 to avoid UTC midnight timezone shift issues
  const t = new Date(tglISO + "T12:00:00").setHours(0,0,0,0)
  const b = new Date(baselineISO + "T12:00:00").setHours(0,0,0,0)
  return Math.round((b - t) / 86400000)
}

function pct(n: number, d: number) { return d === 0 ? 0 : Math.round(n / d * 1000) / 10 }

const AOR_COLORS: Record<string,string> = {
  GMA:"#D97706", NOL:"#2563EB", SOL:"#9333EA", VIS:"#0891B2", MIN:"#EF4444"
}

const TAS_MAP: Record<string,string> = {
  GMA:"JC", NOL:"Van", SOL:"Lindon", VIS:"Darren", MIN:"JC"
}

function StatusBadge({ lama }: { lama: number }) {
  if (lama <= 0) return (
    <span style={{ background:"#DCFCE7", color:"#166534", padding:"3px 9px", borderRadius:"99px", fontSize:"11px", fontWeight:700, display:"inline-flex", alignItems:"center", gap:"4px" }}>
      <CheckCircle size={10} strokeWidth={3}/>OK
    </span>
  )
  const bg = lama === 1 ? "#FEF3C7" : lama <= 3 ? "#FFEDD5" : "#FEE2E2"
  const cl = lama === 1 ? "#92400E" : lama <= 3 ? "#C2410C" : "#991B1B"
  const ic = lama <= 3 ? "⚠️" : "🚨"
  return <span style={{ background:bg, color:cl, padding:"3px 9px", borderRadius:"99px", fontSize:"11px", fontWeight:700 }}>{ic} {lama}h</span>
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function DataTransferPage() {
  const [tab, setTab] = useState<"dashboard"|"history">("dashboard")

  // ── DASHBOARD state ────────────────────────────────────────
  const [staging,      setStaging]      = useState<StagingRow[]>([])
  const [master,       setMaster]       = useState<MasterRow[]>([])
  const [loading,      setLoading]      = useState(false)
  const [lastRefresh,  setLastRefresh]  = useState<Date|null>(null)
  const [baseline,     setBaseline]     = useState(() => {
    const today = new Date().toISOString().slice(0, 10)
    return getBaseline(today)
  })
  const [editBaseline, setEditBaseline] = useState(false)
  const [tempBaseline, setTempBaseline] = useState("")
  const [excludedIds,  setExcludedIds]  = useState<Set<string>>(new Set())
  const [search,       setSearch]       = useState("")
  const [filterAor,    setFilterAor]    = useState("ALL")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [expandedIds,  setExpandedIds]  = useState<Set<string>>(new Set())
  const [saveNote,     setSaveNote]     = useState("")
  const [saving,       setSaving]       = useState(false)
  const [saveMsg,      setSaveMsg]      = useState("")
  const [showSaveModal,setShowSaveModal]= useState(false)

  // manual upload
  const ediRef = useRef<HTMLInputElement>(null)
  const [uploadOpen, setUploadOpen]    = useState(false)
  const [ediFile,    setEdiFile]       = useState<File|null>(null)
  const [parsing,    setParsing]       = useState(false)
  const [dragEdi,    setDragEdi]       = useState(false)

  // ── HISTORY state ──────────────────────────────────────────
  const [snapshots,    setSnapshots]    = useState<SnapshotHeader[]>([])
  const [selectedSnap, setSelectedSnap]= useState<string|null>(null)
  const [snapDetail,   setSnapDetail]   = useState<SnapshotDetail[]>([])
  const [snapLoading,  setSnapLoading]  = useState(false)
  const [histSearch,   setHistSearch]   = useState("")
  const [histAor,      setHistAor]      = useState("ALL")
  const [histStatus,   setHistStatus]   = useState("ALL")

  // ── Load master + staging ──────────────────────────────────
  const loadMaster = useCallback(async () => {
    const { data } = await supabase.from("master_data_adp")
      .select("adp_code,server,server_name,depot,area_name,region_name,remarks,status,ads_name,adm_name")
    if (data) setMaster(data as MasterRow[])
  }, [])

  const loadStaging = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from("edi_transfer_staging")
      .select("*").order("distributor_id")
    if (data) {
      setStaging(data as StagingRow[])
      // Auto-set baseline = MAX tgl_gudang
      const isos = data.map(r => parseTglGudang(r.tgl_gudang)).filter(Boolean).sort()
      if (isos.length) setBaseline(prev => prev || isos[isos.length - 1])
      setLastRefresh(new Date())
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadMaster(); loadStaging() }, [loadMaster, loadStaging])

  // Auto-refresh staging setiap 5 menit (n8n update tiap jam)
  useEffect(() => {
    const interval = setInterval(() => { loadStaging() }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadStaging])

  // ── Join staging + master ──────────────────────────────────
  const displayRows = useMemo((): DisplayRow[] => {
    // Exclude: ONLY remarks = Inactive (Excel does not exclude Vacant)
    const isVacantOrInactive = (m: MasterRow) =>
      m.remarks === "Inactive"

    // Build master map — prefer non-vacant entry per adp_code
    const masterMap: Record<string, MasterRow> = {}
    master.forEach(m => {
      const key = String(m.adp_code)
      const cur = masterMap[key]
      if (!cur || (!isVacantOrInactive(m) && isVacantOrInactive(cur))) {
        masterMap[key] = m
      }
    })

    // Deduplicate staging by distributor_id — keep LATEST tgl_gudang (Excel behavior)
    const dedupMap: Record<string, StagingRow> = {}
    staging.forEach(r => {
      const key = String(r.distributor_id)
      const cur = dedupMap[key]
      if (!cur) {
        dedupMap[key] = r
      } else {
        const isoNew = parseTglGudang(r.tgl_gudang)
        const isoOld = parseTglGudang(cur.tgl_gudang)
        if (isoNew > isoOld) dedupMap[key] = r  // keep latest
      }
    })

    return Object.values(dedupMap).map(r => {
      const m   = masterMap[String(r.distributor_id)]
      const iso = parseTglGudang(r.tgl_gudang)
      const aor = m?.region_name || ""
      return {
        ...r,
        server:      m?.server ? String(m.server) : "",
        server_name: m?.server_name || "",
        depot:       m?.depot || "",
        aor,
        region_name: aor,
        tas:         TAS_MAP[aor] || "",
        lama:        calcLama(iso, baseline),
        excluded:    excludedIds.has(r.distributor_id) || (m ? isVacantOrInactive(m) : false),
        tgl_iso:     iso,
      }
    })
  }, [staging, master, baseline, excludedIds])

  const activeRows = useMemo(() => displayRows.filter(r => !r.excluded), [displayRows])

  // ── Summary stats ──────────────────────────────────────────
  const overall = useMemo(() => {
    const ok = activeRows.filter(r => r.lama <= 0).length
    return { ok, total: activeRows.length, p: pct(ok, activeRows.length) }
  }, [activeRows])

  const aorStats = useMemo(() => {
    const aors = ["GMA","NOL","SOL","VIS","MIN"]
    return aors.map(aor => {
      const g  = activeRows.filter(r => r.aor === aor)
      const ok = g.filter(r => r.lama <= 0).length
      return { aor, ok, total: g.length, p: pct(ok, g.length) }
    }).filter(g => g.total > 0)
  }, [activeRows])

  const tasStats = useMemo(() => {
    const tas = ["JC","Van","Lindon","Darren"]
    return tas.map(t => {
      const g  = activeRows.filter(r => r.tas === t)
      const ok = g.filter(r => r.lama <= 0).length
      return { tas: t, ok, total: g.length, p: pct(ok, g.length) }
    }).filter(g => g.total > 0)
  }, [activeRows])

  // ── Filtered rows for table ────────────────────────────────
  const filteredRows = useMemo(() => {
    const q = search.toLowerCase()
    return displayRows.filter(r => {
      if (filterAor !== "ALL" && r.aor !== filterAor) return false
      if (filterStatus === "OK"   && r.lama > 0)  return false
      if (filterStatus === "LATE" && r.lama <= 0) return false
      if (q && !r.distributor_id.toLowerCase().includes(q) &&
               !r.distributor_nm.toLowerCase().includes(q)) return false
      return true
    }).sort((a, b) => b.lama - a.lama)  // sort terlama → terpendek
  }, [displayRows, search, filterAor, filterStatus])

  // ── Manual upload EDI ──────────────────────────────────────
  const handleEdiFile = async (file: File) => {
    setParsing(true)
    try {
      const text  = await file.text()
      const lines = text.trim().split("\n")
      const delim = lines[0].includes("|") ? "|" : ","
      const headers = lines[0].split(delim).map(h => h.replace(/"/g,"").trim().toLowerCase())

      const rows = lines.slice(1).map(line => {
        const cols = line.split(delim).map(c => c.replace(/"/g,"").trim())
        const row: any = {}
        headers.forEach((h, i) => { row[h] = cols[i] || "" })
        return row
      }).filter(r => r.distributor_id)

      // Truncate & insert staging
      await supabase.rpc("truncate_edi_transfer_staging")
      const chunk = 100
      for (let i = 0; i < rows.length; i += chunk) {
        await supabase.from("edi_transfer_staging").insert(rows.slice(i, i+chunk))
      }
      setUploadOpen(false)
      setEdiFile(null)
      await loadStaging()
    } catch(e) { alert("Error parsing EDI: " + e) }
    setParsing(false)
  }

  // ── Save snapshot ──────────────────────────────────────────
  const handleSave = async () => {
    if (!activeRows.length) return
    setSaving(true)
    try {
      const { data: snap, error: e1 } = await supabase
        .from("edi_transfer_snapshots")
        .insert({ snapshot_date: baseline, note: saveNote || `Snapshot ${baseline}`, created_by: "Manual" })
        .select().single()
      if (e1 || !snap) throw new Error(e1?.message)

      const details = activeRows.map(r => ({
        snapshot_id:    snap.id,
        snapshot_date:  baseline,
        distributor_id: r.distributor_id,
        distributor_nm: r.distributor_nm,
        tgl_gudang:     r.tgl_iso,
        lama:           r.lama,
        excluded:       r.excluded,
        server:         r.server,
        server_name:    r.server_name,
        depot:          r.depot,
        aor:            r.aor,
        tas:            r.tas,
        spv:            r.spv,
        grsm:           r.grsm,
      }))
      const chunk = 100
      for (let i = 0; i < details.length; i += chunk) {
        await supabase.from("edi_transfer_detail").insert(details.slice(i, i+chunk))
      }
      setSaveMsg(`✅ ${details.length} data tersimpan — snapshot ${baseline}`)
      setShowSaveModal(false)
      setSaveNote("")
      loadSnapshots()
    } catch(e) { setSaveMsg("❌ " + String(e)) }
    setSaving(false)
  }

  // ── Load history ───────────────────────────────────────────
  const loadSnapshots = useCallback(async () => {
    const { data } = await supabase.from("edi_transfer_snapshots")
      .select("*").order("snapshot_date", { ascending: false })
    if (data) setSnapshots(data as SnapshotHeader[])
  }, [])

  const loadSnapDetail = useCallback(async (snapId: string) => {
    setSnapLoading(true)
    const [detailRes, masterRes] = await Promise.all([
      supabase.from("edi_transfer_detail").select("*").eq("snapshot_id", snapId),
      supabase.from("master_data_adp").select("adp_code,server,server_name,depot,region_name,ads_name,adm_name,status,remarks")
    ])

    if (detailRes.data && masterRes.data) {
      const masterMap = Object.fromEntries(masterRes.data.map((m: any) => [String(m.adp_code), m]))

      // Get snapshot_date to compute baseline
      const snap = snapshots.find(s => s.id === snapId)
      const snapDate = snap?.snapshot_date || ""
      const snapBaseline = snapDate ? getBaseline(snapDate) : ""

      const enriched = detailRes.data.map((r: any) => {
        const m = masterMap[String(r.distributor_id)]
        const aor = (r.region_name) || (m?.region_name) || ""
        const tglISO = r.tgl_gudang ? String(r.tgl_gudang).slice(0, 10) : ""

        // Recalculate lama using proper baseline (h-1 rule)
        const lama = snapBaseline && tglISO ? calcLama(tglISO, snapBaseline) : (r.lama ?? 99)

        // Excluded: from stored value OR recalculate from master
        // Exclude: ONLY remarks = Inactive
        const excluded = r.excluded
          || m?.remarks === "Inactive"

        return {
          ...r,
          server:      r.server || (m?.server ? String(m.server) : ""),
          server_name: r.server_name || m?.server_name || "",
          depot:       r.depot || m?.depot || "",
          region_name: aor,
          aor,
          tas:         r.tas || (TAS_MAP[aor] || ""),
          tgl_gudang:  tglISO,
          lama,
          excluded,
        }
      })
      setSnapDetail(enriched as SnapshotDetail[])
    }
    setSnapLoading(false)
  }, [snapshots, master])

  useEffect(() => { if (tab === "history") loadSnapshots() }, [tab, loadSnapshots])
  useEffect(() => { if (selectedSnap) loadSnapDetail(selectedSnap) }, [selectedSnap, loadSnapDetail])

  // Auto-select latest snapshot
  useEffect(() => {
    if (snapshots.length && !selectedSnap) setSelectedSnap(snapshots[0].id)
  }, [snapshots])

  const histFiltered = useMemo(() => {
    const q = histSearch.toLowerCase()
    return snapDetail.filter(r => {
      if (histAor !== "ALL" && r.region_name !== histAor) return false
      if (histStatus === "OK"   && r.lama > 0)  return false
      if (histStatus === "LATE" && r.lama <= 0) return false
      if (q && !r.distributor_id.toLowerCase().includes(q) &&
               !r.distributor_nm.toLowerCase().includes(q)) return false
      return true
    })
  }, [snapDetail, histSearch, histAor, histStatus])

  const histOverall = useMemo(() => {
    const active = snapDetail.filter(r => !r.excluded)
    const ok     = active.filter(r => r.lama <= 0).length
    const late   = active.filter(r => r.lama > 0).length
    return { ok, total: active.length, p: pct(ok, active.length), late }
  }, [snapDetail])

  const ovColor = overall.p >= 90 ? "#166534" : overall.p >= 70 ? "#0369A1" : "#991B1B"
  const ovBg    = overall.p >= 90 ? "#DCFCE7" : overall.p >= 70 ? "#EFF6FF" : "#FEE2E2"

  // ── TABLE component (shared) ───────────────────────────────
  const DataTable = ({ rows, isHistory = false }: { rows: (DisplayRow|SnapshotDetail)[], isHistory?: boolean }) => (
    <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"12px", overflow:"auto" }}>
      <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
        <thead>
          <tr style={{ background:"var(--surface2)" }}>
            {["","ADP","Distributor","Server","Area","TAS","Tgl Transfer","Status"].map(h => (
              <th key={h} style={{ padding:"9px 12px", fontSize:"10px", fontWeight:700, color:"var(--text3)", textAlign:"left", borderBottom:"1px solid var(--border)", textTransform:"uppercase", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{h}</th>
            ))}
            {!isHistory && <th style={{ padding:"9px 12px", fontSize:"10px", fontWeight:700, color:"var(--text3)", textAlign:"left", borderBottom:"1px solid var(--border)", textTransform:"uppercase" }}>Aksi</th>}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={9} style={{ padding:"40px", textAlign:"center", color:"var(--text3)", fontSize:"13px" }}>Tidak ada data</td></tr>
          ) : rows.map((r: any, i) => {
            const isExpanded = expandedIds.has(r.distributor_id + i)
            const aorKey   = r.aor || r.region_name || ""
            const aorColor = AOR_COLORS[aorKey] || "#888"
            const rowBg = r.excluded ? "var(--surface2)" : r.lama > 0 ? (r.lama > 3 ? "#FFF5F5" : "#FFFBF0") : "transparent"
            return (
              <React.Fragment key={i}>
                <tr style={{ borderBottom:"1px solid var(--border)", background: rowBg, opacity: r.excluded ? 0.5 : 1 }}
                  onMouseEnter={e => !(r.excluded) && ((e.currentTarget as HTMLElement).style.background = "var(--accent-muted)")}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = rowBg)}>
                  <td style={{ padding:"8px 8px", width:"28px" }}>
                    <button onClick={() => setExpandedIds(p => {
                      const n = new Set(p); n.has(r.distributor_id+i)?n.delete(r.distributor_id+i):n.add(r.distributor_id+i); return n
                    })} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex" }}>
                      {isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
                    </button>
                  </td>
                  <td style={{ padding:"8px 12px", fontFamily:"monospace", fontWeight:700, color:"#0369A1", fontSize:"11px" }}>{r.distributor_id}</td>
                  <td style={{ padding:"8px 12px", maxWidth:"220px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", fontWeight:600 }}>{r.distributor_nm}</td>
                  <td style={{ padding:"8px 12px", fontSize:"11px", color:"var(--text3)" }}>{r.server||"—"}</td>
                  <td style={{ padding:"8px 12px" }}>
                    {aorKey ? <span style={{ background:aorColor+"15", color:aorColor, padding:"2px 8px", borderRadius:"99px", fontSize:"10px", fontWeight:700 }}>{aorKey}</span> : "—"}
                  </td>
                  <td style={{ padding:"8px 12px", fontSize:"11px", color:"var(--text3)" }}>{r.tas||"—"}</td>
                  <td style={{ padding:"8px 12px", fontFamily:"monospace", fontSize:"11px" }}>{r.tgl_gudang||r.tgl_iso||"—"}</td>
                  <td style={{ padding:"8px 12px" }}>
                    {r.excluded ? <span style={{ fontSize:"10px", color:"var(--text3)" }}>— Excluded</span> : <StatusBadge lama={r.lama}/>}
                  </td>
                  {!isHistory && (
                    <td style={{ padding:"8px 12px" }}>
                      <button onClick={() => setExcludedIds(p => {
                        const n = new Set(p); n.has(r.distributor_id)?n.delete(r.distributor_id):n.add(r.distributor_id); return n
                      })} style={{ fontSize:"10px", padding:"2px 8px", borderRadius:"6px", border:"1px solid var(--border)", background:"var(--surface2)", cursor:"pointer", color:"var(--text3)", fontFamily:"inherit" }}>
                        {r.excluded ? "Include" : "Exclude"}
                      </button>
                    </td>
                  )}
                </tr>
                {isExpanded && (
                  <tr key={i+"exp"} style={{ background:"var(--surface2)", borderBottom:"1px solid var(--border)" }}>
                    <td colSpan={9} style={{ padding:"10px 16px 10px 40px" }}>
                      <div style={{ display:"flex", gap:"24px", fontSize:"12px", flexWrap:"wrap" }}>
                        {[
                          ["SPV", r.spv], ["GRSM", r.grsm], ["Server Name", r.server_name],
                          ["Depot", r.depot], ["Release", r.release],
                          ["Lama", r.lama <= 0 ? "On time" : r.lama + " hari terlambat"],
                          ["Excluded", r.excluded ? "Ya (tidak dihitung)" : null],
                        ].map(([k,v]) => v && (
                          <div key={k as string}><span style={{ fontWeight:700, color:"var(--text3)" }}>{k}:</span> {v as string}</div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"16px" }}>
      <MotivationBanner page="data-transfer"/>

      {/* ── HEADER ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:"linear-gradient(135deg,#0891B2,#0369A1)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <Radio size={20} color="white"/>
          </div>
          <div>
            <h1 style={{ fontSize:"20px", fontWeight:800, margin:0 }}>Data Transfer Web Ficom</h1>
            <p style={{ fontSize:"12px", color:"var(--text3)", margin:0 }}>Monitoring transfer status EDI per distributor</p>
          </div>
        </div>

        <div style={{ marginLeft:"auto", display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
          {/* Baseline */}
          <div style={{ display:"flex", alignItems:"center", gap:"6px", background:"var(--surface)", border:`1.5px solid ${editBaseline?"#0891B2":"var(--border)"}`, borderRadius:"8px", padding:"5px 10px" }}>
            <Calendar size={12} color="var(--text3)"/>
            <span style={{ fontSize:"11px", color:"var(--text3)", fontWeight:600 }}>Baseline:</span>
            {editBaseline ? (
              <input type="date" value={tempBaseline} autoFocus
                onChange={e => setTempBaseline(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"){setBaseline(tempBaseline);setEditBaseline(false)} if(e.key==="Escape")setEditBaseline(false) }}
                style={{ border:"none", outline:"none", fontSize:"11px", fontWeight:700, color:"#0891B2", background:"transparent", fontFamily:"inherit", width:"110px" }}/>
            ) : (
              <span style={{ fontSize:"11px", fontWeight:700, color:"#0891B2" }}>{baseline || "auto"}</span>
            )}
            <button onClick={() => { if(editBaseline){setBaseline(tempBaseline);setEditBaseline(false)}else{setTempBaseline(baseline);setEditBaseline(true)} }}
              style={{ background:"none", border:"none", cursor:"pointer", color:editBaseline?"#166534":"var(--text3)", padding:0, display:"flex" }}>
              {editBaseline ? <CheckCircle size={13} color="#166534"/> : <span style={{ fontSize:"12px" }}>✏️</span>}
            </button>
            {baseline && (
              <button onClick={() => { setBaseline(""); loadStaging() }} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", padding:0, fontSize:"14px" }}>×</button>
            )}
          </div>

          {/* Cek transfer badge */}
          {baseline && (
            <div style={{ display:"flex", alignItems:"center", gap:"5px", background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:"8px", padding:"5px 10px" }}>
              <Clock size={12} color="#0369A1"/>
              <span style={{ fontSize:"11px", color:"#0369A1", fontWeight:600 }}>Cek transfer ≥ {baseline}</span>
            </div>
          )}

          {/* Upload EDI */}
          <button onClick={() => setUploadOpen(true)}
            style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 14px", borderRadius:"8px", border:"none", background:"#0891B2", color:"white", fontSize:"12px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            <Upload size={13}/>Upload EDI
          </button>

          {/* Refresh */}
          <button onClick={loadStaging} disabled={loading}
            style={{ display:"flex", alignItems:"center", gap:"5px", padding:"7px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface2)", color:"var(--text3)", fontSize:"12px", cursor:"pointer", fontFamily:"inherit" }}>
            <RefreshCw size={13} style={{ animation: loading?"spin 1s linear infinite":"none" }}/>
            {lastRefresh ? lastRefresh.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}) : "Refresh"}
          </button>

          {/* Tabs */}
          <div style={{ display:"flex", background:"var(--surface2)", borderRadius:"8px", padding:"3px", border:"1px solid var(--border)" }}>
            {(["dashboard","history"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding:"5px 14px", borderRadius:"6px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:700, fontFamily:"inherit", background:tab===t?"white":"transparent", color:tab===t?"var(--text)":"var(--text3)", boxShadow:tab===t?"0 1px 3px rgba(0,0,0,0.1)":"none", transition:"all 0.15s", textTransform:"capitalize" }}>
                {t === "dashboard" ? "Dashboard" : "History"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === "dashboard" && (<>
        {staging.length === 0 && !loading ? (
          <div style={{ padding:"60px", textAlign:"center", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"12px" }}>
            <Upload size={36} color="var(--text3)" style={{ margin:"0 auto 12px", display:"block", opacity:0.3 }}/>
            <div style={{ fontSize:"16px", fontWeight:700, marginBottom:"4px" }}>Belum ada data EDI</div>
            <div style={{ fontSize:"13px", color:"var(--text3)", marginBottom:"16px" }}>Data akan muncul otomatis dari n8n setiap jam, atau upload manual</div>
            <button onClick={() => setUploadOpen(true)} style={{ padding:"9px 20px", borderRadius:"9px", border:"none", background:"#0891B2", color:"white", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>Upload EDI</button>
          </div>
        ) : (<>
          {/* Summary cards */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"10px" }}>
            <div style={{ background:ovBg, borderRadius:"10px", padding:"14px 16px" }}>
              <div style={{ fontSize:"10px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"4px" }}>Overall</div>
              <div style={{ fontSize:"28px", fontWeight:900, color:ovColor }}>{overall.p}%</div>
              <div style={{ fontSize:"11px", color:ovColor, marginTop:"2px" }}>{overall.ok}/{overall.total} on time</div>
            </div>
            {aorStats.slice(0,3).map(s => (
              <div key={s.aor} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"10px", padding:"14px 16px" }}>
                <div style={{ fontSize:"10px", fontWeight:700, color:AOR_COLORS[s.aor], textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"4px" }}>{s.aor}</div>
                <div style={{ fontSize:"22px", fontWeight:900, color:AOR_COLORS[s.aor] }}>{s.p}%</div>
                <div style={{ fontSize:"11px", color:"var(--text3)", marginTop:"2px" }}>{s.ok}/{s.total}</div>
              </div>
            ))}
          </div>

          {/* Area + TAS progress bars */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
            {[{ title:"Per Area", stats:aorStats }, { title:"Per TAS", stats:tasStats }].map(({ title, stats }) => (
              <div key={title} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"10px", padding:"14px 16px" }}>
                <div style={{ fontSize:"11px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"10px" }}>{title}</div>
                {stats.map(s => {
                  const c = "aor" in s ? AOR_COLORS[(s as any).aor] : "#0891B2"
                  const label = "aor" in s ? (s as any).aor : (s as any).tas
                  return (
                    <div key={label} style={{ marginBottom:"8px" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                        <span style={{ fontSize:"11px", fontWeight:700, color:c }}>{label}</span>
                        <span style={{ fontSize:"11px", color:"var(--text3)" }}>{s.ok}/{s.total} · {s.p}%</span>
                      </div>
                      <div style={{ background:"var(--surface3)", borderRadius:"99px", height:"5px", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${s.p}%`, background:c, borderRadius:"99px", transition:"width 0.5s" }}/>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Filters + table */}
          <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"7px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"8px", padding:"7px 11px", flex:"1", minWidth:"160px" }}>
              <Search size={13} color="var(--text3)"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari ADP atau nama distributor..."
                style={{ background:"none", border:"none", outline:"none", fontSize:"12px", color:"var(--text)", width:"100%", fontFamily:"inherit" }}/>
            </div>
            <select value={filterAor} onChange={e=>setFilterAor(e.target.value)}
              style={{ padding:"7px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:"12px", fontFamily:"inherit" }}>
              {["ALL","GMA","NOL","SOL","VIS","MIN"].map(a=><option key={a} value={a}>{a==="ALL"?"All Area":a}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}
              style={{ padding:"7px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:"12px", fontFamily:"inherit" }}>
              <option value="ALL">All Status</option>
              <option value="OK">✅ OK</option>
              <option value="LATE">⚠️ Terlambat</option>
            </select>
            <span style={{ fontSize:"12px", color:"var(--text3)" }}>{filteredRows.length}/{displayRows.length}</span>
            <button onClick={() => setShowSaveModal(true)}
              style={{ display:"flex", alignItems:"center", gap:"6px", padding:"7px 14px", borderRadius:"8px", border:"none", background:"#166534", color:"white", fontSize:"12px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", marginLeft:"auto" }}>
              <Save size={13}/>Save Snapshot
            </button>
          </div>

          {saveMsg && (
            <div style={{ background: saveMsg.startsWith("✅")?"#DCFCE7":"#FEE2E2", border:`1px solid ${saveMsg.startsWith("✅")?"#BBF7D0":"#FECACA"}`, borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color: saveMsg.startsWith("✅")?"#166534":"#991B1B" }}>
              {saveMsg}
            </div>
          )}

          <DataTable rows={filteredRows}/>
        </>)}
      </>)}

      {/* ── HISTORY TAB ── */}
      {tab === "history" && (
        <div style={{ display:"grid", gridTemplateColumns:"260px 1fr", gap:"14px" }}>
          {/* Sidebar snapshots */}
          <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"12px", overflow:"hidden" }}>
            <div style={{ padding:"12px 14px", borderBottom:"1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:"12px", fontWeight:700, color:"var(--text)" }}>Riwayat</span>
              <button onClick={loadSnapshots} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", display:"flex" }}>
                <RefreshCw size={13}/>
              </button>
            </div>
            <div style={{ overflowY:"auto", maxHeight:"520px" }}>
              {snapshots.map(s => {
                const isSel = selectedSnap === s.id
                return (
                  <button key={s.id} onClick={() => setSelectedSnap(s.id)}
                    style={{ width:"100%", padding:"12px 14px", borderBottom:"1px solid var(--border)", background:isSel?"var(--accent-muted)":"transparent", border:"none", cursor:"pointer", textAlign:"left", fontFamily:"inherit" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"3px" }}>
                      <Calendar size={11} color={isSel?"#0891B2":"var(--text3)"}/>
                      <span style={{ fontSize:"13px", fontWeight:700, color:isSel?"#0891B2":"var(--text)" }}>{s.snapshot_date}</span>
                    </div>
                    <div style={{ fontSize:"10px", color:"var(--text3)" }}>{new Date(s.created_at).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
                    <div style={{ fontSize:"10px", color:"var(--text3)", marginTop:"1px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.note}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Snapshot detail */}
          <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
            {selectedSnap && (<>
              {/* History summary */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px" }}>
                <div style={{ background: histOverall.p>=90?"#DCFCE7":histOverall.p>=70?"#EFF6FF":"#FEE2E2", borderRadius:"10px", padding:"14px 16px" }}>
                  <div style={{ fontSize:"10px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"4px" }}>Overall</div>
                  <div style={{ fontSize:"28px", fontWeight:900, color: histOverall.p>=90?"#166534":histOverall.p>=70?"#0369A1":"#991B1B" }}>{histOverall.p}%</div>
                  <div style={{ fontSize:"11px", color:"var(--text3)" }}>{histOverall.ok}/{histOverall.total}</div>
                </div>
                <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"10px", padding:"14px 16px" }}>
                  <div style={{ fontSize:"10px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"4px" }}>Snapshot</div>
                  <div style={{ fontSize:"14px", fontWeight:800, color:"var(--text)" }}>{snapshots.find(s=>s.id===selectedSnap)?.snapshot_date}</div>
                  <div style={{ fontSize:"11px", color:"var(--text3)", marginTop:"2px" }}>{snapshots.find(s=>s.id===selectedSnap)?.note}</div>
                </div>
                <div style={{ background:"#FEE2E2", borderRadius:"10px", padding:"14px 16px" }}>
                  <div style={{ fontSize:"10px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"4px" }}>Terlambat</div>
                  <div style={{ fontSize:"28px", fontWeight:900, color:"#991B1B" }}>{histOverall.late ?? histOverall.total - histOverall.ok}</div>
                  <div style={{ fontSize:"11px", color:"#991B1B" }}>distributor</div>
                </div>
              </div>

              {/* History filters */}
              <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"7px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"8px", padding:"7px 11px", flex:"1", minWidth:"160px" }}>
                  <Search size={13} color="var(--text3)"/>
                  <input value={histSearch} onChange={e=>setHistSearch(e.target.value)} placeholder="Cari..."
                    style={{ background:"none", border:"none", outline:"none", fontSize:"12px", color:"var(--text)", width:"100%", fontFamily:"inherit" }}/>
                </div>
                <select value={histAor} onChange={e=>setHistAor(e.target.value)}
                  style={{ padding:"7px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:"12px", fontFamily:"inherit" }}>
                  {["ALL","GMA","NOL","SOL","VIS","MIN"].map(a=><option key={a} value={a}>{a==="ALL"?"All Area":a}</option>)}
                </select>
                <select value={histStatus} onChange={e=>setHistStatus(e.target.value)}
                  style={{ padding:"7px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:"12px", fontFamily:"inherit" }}>
                  <option value="ALL">All Status</option>
                  <option value="OK">✅ OK</option>
                  <option value="LATE">⚠️ Terlambat</option>
                </select>
                <span style={{ fontSize:"12px", color:"var(--text3)" }}>{histFiltered.length}/{snapDetail.length}</span>
              </div>

              {snapLoading ? (
                <div style={{ padding:"40px", textAlign:"center", color:"var(--text3)" }}>
                  <RefreshCw size={20} style={{ animation:"spin 1s linear infinite", margin:"0 auto 8px", display:"block" }}/>
                  Memuat data...
                </div>
              ) : <DataTable rows={histFiltered as any} isHistory/>}
            </>)}
          </div>
        </div>
      )}

      {/* ── UPLOAD MODAL ── */}
      {uploadOpen && (
        <div onClick={e=>{if(e.target===e.currentTarget)setUploadOpen(false)}}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
          <div style={{ background:"var(--surface)", borderRadius:"16px", padding:"28px", width:"440px", maxWidth:"90vw", boxShadow:"0 20px 60px rgba(0,0,0,0.3)", border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"18px" }}>
              <div>
                <div style={{ fontSize:"17px", fontWeight:800, color:"var(--text)" }}>Upload EDI Manual</div>
                <div style={{ fontSize:"12px", color:"var(--text3)", marginTop:"2px" }}>CSV pipe-delimited · akan replace data staging</div>
              </div>
              <button onClick={() => setUploadOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", fontSize:"22px" }}>×</button>
            </div>
            <input ref={ediRef} type="file" accept=".csv" style={{ display:"none" }}
              onChange={e => { const f=e.target.files?.[0]; if(f){setEdiFile(f);handleEdiFile(f);e.target.value=""} }}/>
            <div
              onDrop={e=>{e.preventDefault();setDragEdi(false);const f=e.dataTransfer.files[0];if(f){setEdiFile(f);handleEdiFile(f)}}}
              onDragOver={e=>{e.preventDefault();setDragEdi(true)}}
              onDragLeave={()=>setDragEdi(false)}
              onClick={()=>ediRef.current?.click()}
              style={{ border:`2px dashed ${dragEdi?"#0891B2":"var(--border)"}`, borderRadius:"12px", padding:"32px 20px", textAlign:"center", cursor:"pointer", background:dragEdi?"rgba(8,145,178,0.05)":"var(--surface2)", transition:"all 0.15s", marginBottom:"14px" }}>
              {parsing ? (
                <><RefreshCw size={28} color="#0891B2" style={{ margin:"0 auto 10px", animation:"spin 1s linear infinite" }}/><div style={{ fontSize:"13px", fontWeight:700 }}>Memproses...</div></>
              ) : ediFile ? (
                <><CheckCircle size={28} color="#166534" style={{ margin:"0 auto 10px" }}/><div style={{ fontSize:"13px", fontWeight:700, color:"var(--text)" }}>{ediFile.name}</div></>
              ) : (
                <><Upload size={28} color="#0891B2" style={{ margin:"0 auto 10px" }}/><div style={{ fontSize:"13px", fontWeight:700, color:"var(--text)", marginBottom:"4px" }}>Klik atau drop file EDI</div><div style={{ fontSize:"11px", color:"var(--text3)" }}>EDI_OMSET_DASHBOARD_brt.csv</div></>
              )}
            </div>
            <div style={{ fontSize:"11px", color:"var(--text3)", background:"#FEF3C7", borderRadius:"8px", padding:"10px 12px", display:"flex", gap:"8px" }}>
              <TriangleAlert size={14} color="#92400E" style={{ flexShrink:0, marginTop:"1px" }}/>
              Upload manual akan menggantikan data staging saat ini
            </div>
          </div>
        </div>
      )}

      {/* ── SAVE SNAPSHOT MODAL ── */}
      {showSaveModal && (
        <div onClick={e=>{if(e.target===e.currentTarget)setShowSaveModal(false)}}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(4px)" }}>
          <div style={{ background:"var(--surface)", borderRadius:"16px", padding:"28px", width:"400px", maxWidth:"90vw", boxShadow:"0 20px 60px rgba(0,0,0,0.3)", border:"1px solid var(--border)" }}>
            <div style={{ fontSize:"17px", fontWeight:800, marginBottom:"6px" }}>Save Snapshot</div>
            <div style={{ fontSize:"12px", color:"var(--text3)", marginBottom:"16px" }}>Simpan {activeRows.length} data aktif sebagai snapshot {baseline}</div>
            <input value={saveNote} onChange={e=>setSaveNote(e.target.value)} placeholder="Catatan (opsional)..."
              style={{ width:"100%", padding:"9px 12px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface2)", color:"var(--text)", fontSize:"13px", fontFamily:"inherit", outline:"none", boxSizing:"border-box", marginBottom:"14px" }}/>
            <div style={{ display:"flex", gap:"8px" }}>
              <button onClick={handleSave} disabled={saving}
                style={{ flex:1, padding:"10px", borderRadius:"9px", border:"none", background:saving?"#94A3B8":"#166534", color:"white", fontSize:"13px", fontWeight:700, cursor:saving?"not-allowed":"pointer", fontFamily:"inherit" }}>
                {saving?"Menyimpan...":"Simpan"}
              </button>
              <button onClick={()=>setShowSaveModal(false)} style={{ padding:"10px 16px", borderRadius:"9px", border:"1px solid var(--border)", background:"var(--surface2)", color:"var(--text3)", fontSize:"13px", cursor:"pointer", fontFamily:"inherit" }}>Batal</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}