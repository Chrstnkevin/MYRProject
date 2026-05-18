"use client"
// PATH: src/app/dashboard/data-transfer/page.tsx

import { useState, useEffect, useMemo, useRef } from "react"
import {
  Upload, Save, RefreshCw, AlertCircle, CheckCircle2, X,
  Search, Calendar, ChevronRight, ChevronDown,
  Check, Pencil, Trash2, Info
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"

// ── Types ────────────────────────────────────────────────────
interface TransferRow {
  distributor_id: number
  distributor_nm: string
  spv: string
  grsm: string
  rsm: string
  release: string
  tgl_gudang: string
  lama: number
  server: number | null
  server_name: string
  depot: string
  region_name: string
  area_name: string
  aor: string
  tas: string
  excluded: boolean
  inactive: boolean
}

interface MasterDepot {
  adp_code: number
  depot: string
  distributor_name: string
  server: number | null
  server_name: string
  region_name: string
  area_name: string
  remarks: string
}

const AOR_TAS: Record<string, string> = {
  GMA: "JC", NOL: "Van", SOL: "Lindon", VIS: "Darren", MIN: "JC"
}
const AREA_CLR: Record<string, { bg: string; color: string; bar: string }> = {
  GMA: { bg: "#FEF3C7", color: "#92400E", bar: "#D97706" },
  NOL: { bg: "#EFF6FF", color: "#1D4ED8", bar: "#2563EB" },
  SOL: { bg: "#FDF4FF", color: "#7C3AED", bar: "#9333EA" },
  VIS: { bg: "#ECFEFF", color: "#0891B2", bar: "#06B6D4" },
  MIN: { bg: "#FEF2F2", color: "#DC2626", bar: "#EF4444" },
}
const TAS_CLR: Record<string, { bg: string; color: string; bar: string }> = {
  JC:     { bg: "#DCFCE7", color: "#166534", bar: "#16A34A" },
  Van:    { bg: "#EFF6FF", color: "#1D4ED8", bar: "#2563EB" },
  Lindon: { bg: "#FEF3C7", color: "#92400E", bar: "#D97706" },
  Darren: { bg: "#F5F3FF", color: "#7C3AED", bar: "#9333EA" },
}
const SVR_CLR: Record<string, { bg: string; color: string }> = {
  "138": { bg: "#EFF6FF", color: "#0369A1" },
  "228": { bg: "#F5F3FF", color: "#7C3AED" },
  "252": { bg: "#FEF2F2", color: "#DC2626" },
}

// ── Helpers ───────────────────────────────────────────────────
function parseLocalDate(iso: string): number {
  if (!iso) return 0
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d).getTime()
}
function calcLama(tglISO: string, baseline: string): number {
  if (!tglISO || !baseline) return 99
  return Math.round((parseLocalDate(baseline) - parseLocalDate(tglISO)) / 86400000)
}
function pct(n: number, d: number) { return d === 0 ? 0 : Math.round(n / d * 100) }
function yesterdayISO() {
  const d = new Date(); d.setDate(d.getDate() - 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dy = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${dy}`
}

function parseEdiCsv(text: string): Record<number, { spv: string; tgl: string; grsm: string; rsm: string; release: string }> {
  const lines = text.trim().split("\n").filter(l => l.trim())
  if (!lines.length) return {}
  const headers = lines[0].split("|").map(h => h.replace(/"/g, "").trim())
  const distMap: Record<number, { spv: string; tgl: string; grsm: string; rsm: string; release: string; ts: number }> = {}
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split("|").map(v => v.replace(/"/g, "").trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, j) => { obj[h] = vals[j] ?? "" })
    const distId = parseInt(obj.distributor_id)
    if (!distId) continue
    let tglISO = "", ts = 0
    try {
      const d = new Date(obj.tgl_gudang)
      if (!isNaN(d.getTime())) {
        const yr = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, "0"), dy = String(d.getDate()).padStart(2, "0")
        tglISO = `${yr}-${mo}-${dy}`; ts = d.getTime()
      }
    } catch {}
    if (!distMap[distId] || ts > distMap[distId].ts)
      distMap[distId] = { spv: obj.spv ?? "", tgl: tglISO, grsm: obj.grsm ?? "", rsm: obj.rsm ?? "", release: obj.release ?? "", ts }
  }
  const result: Record<number, { spv: string; tgl: string; grsm: string; rsm: string; release: string }> = {}
  Object.entries(distMap).forEach(([k, v]) => { result[parseInt(k)] = { spv: v.spv, tgl: v.tgl, grsm: v.grsm, rsm: v.rsm, release: v.release } })
  return result
}

// ── Status badge ──────────────────────────────────────────────
function StatusBadge({ lama }: { lama: number }) {
  if (lama <= 0) return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", background: "#DCFCE7", color: "#166534", padding: "3px 9px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>
      <Check size={10} strokeWidth={3} />OK
    </span>
  )
  const bg = lama === 1 ? "#FEF3C7" : lama <= 3 ? "#FFEDD5" : "#FEE2E2"
  const cl = lama === 1 ? "#92400E" : lama <= 3 ? "#C2410C" : "#991B1B"
  const ic = lama <= 3 ? "⚠️" : "🚨"
  return <span style={{ background: bg, color: cl, padding: "3px 9px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>{ic} {lama}h</span>
}

// ── Donut ─────────────────────────────────────────────────────
function DonutPct({ pct: p, size = 72, color = "#166534" }: { pct: number; size?: number; color?: string }) {
  const r = size / 2 - 6, cx = size / 2, cy = size / 2
  const circ = 2 * Math.PI * r, filled = circ * (p / 100)
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface3)" strokeWidth={6} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${filled} ${circ - filled}`} strokeLinecap="round" style={{ transition: "stroke-dasharray 0.6s ease" }} />
    </svg>
  )
}

// ── Shared table component ─────────────────────────────────────
function TransferTable({
  data,
  showActions = false,
  onDelete,
  onToggleExclude,
  expandedId,
  setExpandedId,
}: {
  data: any[]
  showActions?: boolean
  onDelete?: (id: number) => void
  onToggleExclude?: (id: number) => void
  expandedId: number | null
  setExpandedId: (id: number | null) => void
}) {
  const th = (a: "left" | "center" | "right" = "left"): React.CSSProperties => ({
    padding: "9px 12px", fontSize: "10px", fontWeight: 700, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border)", background: "var(--surface2)",
    textAlign: a, whiteSpace: "nowrap",
  })
  const td = (a: "left" | "center" | "right" = "left"): React.CSSProperties => ({
    padding: "10px 12px", fontSize: "12px", color: "var(--text)",
    borderBottom: "1px solid var(--border)", textAlign: a,
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
  })

  if (!data.length) return (
    <div style={{ padding: "48px", textAlign: "center", color: "var(--text3)", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
      Tidak ada data
    </div>
  )

  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th()}></th>
              <th style={th()}>ADP</th>
              <th style={th()}>Distributor</th>
              <th style={th("center")}>Server</th>
              <th style={th()}>Server Name</th>
              <th style={th()}>Depot</th>
              <th style={th("center")}>Area</th>
              <th style={th("center")}>TAS</th>
              <th style={th("center")}>Tgl Transfer</th>
              <th style={th("center")}>Status</th>
              {showActions && <th style={th("center")}>Aksi</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const isExp = expandedId === r.distributor_id
              const lama = r.lama ?? 0
              const excluded = r.excluded ?? false
              const inactive = r.inactive ?? false
              const rowBg = excluded ? "var(--surface3)" :
                lama > 7 ? "#FFF5F5" : lama > 3 ? "#FFFBF0" : lama >= 1 ? "#FFFDF5" :
                  i % 2 === 0 ? "transparent" : "var(--surface2)"
              const aorStr = r.aor || r.region_name || ""
              const tasStr = r.tas || ""
              const svrStr = String(r.server ?? "")
              return (
                <>
                  <tr key={r.distributor_id}
                    onClick={() => setExpandedId(isExp ? null : r.distributor_id)}
                    style={{ background: isExp ? "#F0F9FF" : rowBg, cursor: "pointer", opacity: excluded ? 0.5 : 1 }}
                    onMouseEnter={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = "var(--accent-muted)" }}
                    onMouseLeave={e => { if (!isExp) (e.currentTarget as HTMLElement).style.background = rowBg }}>
                    <td style={{ ...td("center"), width: "28px", padding: "10px 6px" }}>
                      {isExp ? <ChevronDown size={12} color="#0891B2" /> : <ChevronRight size={12} color="var(--text3)" />}
                    </td>
                    <td style={{ ...td(), fontFamily: "monospace", fontWeight: 700, color: "#0369A1", fontSize: "11px" }}>{r.distributor_id}</td>
                    <td style={{ ...td(), fontWeight: 600, maxWidth: "200px" }}>{r.distributor_nm}</td>
                    <td style={td("center")}>
                      {r.server
                        ? <span style={{ ...SVR_CLR[svrStr], padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>{r.server}</span>
                        : <span style={{ color: "var(--text3)" }}>—</span>}
                    </td>
                    <td style={{ ...td(), fontSize: "11px" }}>
                      {r.server_name
                        ? <span style={{ background: "var(--surface3)", padding: "2px 7px", borderRadius: "5px", fontSize: "10px", fontWeight: 600, color: "var(--text3)" }}>{r.server_name}</span>
                        : "—"}
                    </td>
                    <td style={{ ...td(), fontSize: "11px", color: "var(--text3)", maxWidth: "140px" }}>{r.depot || "—"}</td>
                    <td style={td("center")}>
                      {aorStr
                        ? <span style={{ ...AREA_CLR[aorStr], padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>{aorStr}</span>
                        : "—"}
                    </td>
                    <td style={td("center")}>
                      {tasStr
                        ? <span style={{ ...TAS_CLR[tasStr], padding: "2px 8px", borderRadius: "99px", fontSize: "11px", fontWeight: 700 }}>{tasStr}</span>
                        : "—"}
                    </td>
                    <td style={{ ...td("center"), fontFamily: "monospace", fontSize: "11px" }}>
                      {r.tgl_gudang ? String(r.tgl_gudang).slice(0, 10) : "—"}
                    </td>
                    <td style={td("center")}>
                      {excluded
                        ? <span style={{ background: "var(--surface3)", color: "var(--text3)", padding: "3px 9px", borderRadius: "99px", fontSize: "11px", fontWeight: 600 }}>
                          {inactive ? "Inactive" : "Dikecualikan"}
                        </span>
                        : <StatusBadge lama={lama} />}
                    </td>
                    {showActions && (
                      <td style={td("center")} onClick={e => e.stopPropagation()}>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "center" }}>
                          <button onClick={() => onToggleExclude?.(r.distributor_id)}
                            style={{ padding: "4px 7px", borderRadius: "6px", border: "1px solid var(--border)", background: excluded ? "#DCFCE7" : "var(--surface2)", cursor: "pointer", color: excluded ? "#166534" : "var(--text3)", display: "flex", alignItems: "center", fontSize: "10px", fontWeight: 600, gap: "3px", fontFamily: "inherit" }}>
                            {excluded ? <><Check size={10} />Aktif</> : <>— Kecuali</>}
                          </button>
                          <button onClick={() => { if (confirm(`Hapus ${r.distributor_nm}?`)) onDelete?.(r.distributor_id) }}
                            style={{ padding: "4px 6px", borderRadius: "6px", border: "1px solid #FECACA", background: "#FEF2F2", cursor: "pointer", color: "#DC2626", display: "flex", alignItems: "center" }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {isExp && (
                    <tr key={`${r.distributor_id}-exp`}>
                      <td colSpan={showActions ? 11 : 10} style={{ padding: 0, borderBottom: "2px solid #0891B2" }}>
                        <div style={{ background: "linear-gradient(135deg,#F0F9FF,#E0F2FE)", padding: "12px 14px 12px 46px" }}>
                          <div style={{ display: "flex", gap: "20px", fontSize: "12px", flexWrap: "wrap" }}>
                            <div><span style={{ fontWeight: 700, color: "#0369A1" }}>RDM:</span> {(r.grsm || "").replace(/^WF\d+-\S+ - RDM\s*/i, "") || r.grsm || "—"}</div>
                            <div><span style={{ fontWeight: 700, color: "#0369A1" }}>ADM:</span> {(r.rsm || "").replace(/^WF\d+-\S+ - ADM\s*/i, "") || r.rsm || "—"}</div>
                            <div><span style={{ fontWeight: 700, color: "#0369A1" }}>Release:</span> <span style={{ fontFamily: "monospace", color: "var(--text3)" }}>{r.release || "—"}</span></div>
                            <div><span style={{ fontWeight: 700, color: "#0369A1" }}>Sub AOR:</span> <span style={{ color: "var(--text3)" }}>{r.area_name || r.sub_aor || "—"}</span></div>
                            <div><span style={{ fontWeight: 700, color: "#0369A1" }}>Lama:</span> <span style={{ color: lama <= 0 ? "#166534" : lama <= 3 ? "#C2410C" : "#991B1B", fontWeight: 700 }}>{lama <= 0 ? "On time" : lama + " hari terlambat"}</span></div>
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
    </div>
  )
}

// ── Summary stats component ───────────────────────────────────
function SummaryCards({
  activeRows, aorFilter, setAorFilter
}: {
  activeRows: TransferRow[]
  aorFilter: string
  setAorFilter: (v: string) => void
}) {
  const overall = useMemo(() => {
    const ok = activeRows.filter(r => r.lama <= 0).length
    return { ok, total: activeRows.length, p: pct(ok, activeRows.length) }
  }, [activeRows])

  const aorStats = useMemo(() =>
    ["GMA", "NOL", "SOL", "VIS", "MIN"].map(aor => {
      const g = activeRows.filter(r => r.aor === aor)
      const ok = g.filter(r => r.lama <= 0).length
      return { aor, ok, total: g.length, p: pct(ok, g.length) }
    }).filter(g => g.total > 0)
  , [activeRows])

  const tasStats = useMemo(() =>
    ["JC", "Van", "Lindon", "Darren"].map(tas => {
      const g = activeRows.filter(r => r.tas === tas)
      const ok = g.filter(r => r.lama <= 0).length
      return { tas, ok, total: g.length, p: pct(ok, g.length) }
    }).filter(g => g.total > 0)
  , [activeRows])

  const ovColor = overall.p >= 95 ? "#166534" : overall.p >= 80 ? "#0369A1" : overall.p >= 60 ? "#92400E" : "#991B1B"

  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 1fr", gap: "14px", marginBottom: "16px" }}>
      {/* Overall */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "6px" }}>
        <div style={{ position: "relative", width: "88px", height: "88px" }}>
          <DonutPct pct={overall.p} size={88} color={ovColor} />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: "20px", fontWeight: 900, color: ovColor, letterSpacing: "-0.04em" }}>{overall.p}%</span>
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "var(--text)" }}>{overall.ok} / {overall.total}</div>
          <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>distributor on time</div>
        </div>
      </div>

      {/* Area */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>Area</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          {aorStats.map(({ aor, ok, total, p }) => {
            const c = AREA_CLR[aor] || { bg: "var(--surface3)", color: "var(--text3)", bar: "#94A3B8" }
            return (
              <div key={aor} style={{ display: "grid", gridTemplateColumns: "44px 1fr 48px 44px", alignItems: "center", gap: "8px" }}>
                <span onClick={() => setAorFilter(aorFilter === aor ? "ALL" : aor)}
                  style={{ ...c, padding: "2px 0", borderRadius: "6px", fontSize: "11px", fontWeight: 800, cursor: "pointer", textAlign: "center", border: aorFilter === aor ? `1.5px solid ${c.color}` : "1.5px solid transparent", transition: "all 0.15s" }}>
                  {aor}
                </span>
                <div style={{ background: "var(--surface3)", borderRadius: "99px", height: "7px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p}%`, background: c.bar, borderRadius: "99px", transition: "width 0.5s ease" }} />
                </div>
                <span style={{ fontSize: "12px", fontWeight: 800, color: c.color, textAlign: "right" }}>{p}%</span>
                <span style={{ fontSize: "10px", color: "var(--text3)", textAlign: "right" }}>{ok}/{total}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* TAS */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "18px 20px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "12px" }}>TAS</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
          {tasStats.map(({ tas, ok, total, p }) => {
            const c = TAS_CLR[tas] || { bg: "var(--surface3)", color: "var(--text3)", bar: "#94A3B8" }
            return (
              <div key={tas} style={{ display: "grid", gridTemplateColumns: "52px 1fr 48px 44px", alignItems: "center", gap: "8px" }}>
                <span style={{ ...c, padding: "2px 0", borderRadius: "6px", fontSize: "11px", fontWeight: 800, textAlign: "center" }}>{tas}</span>
                <div style={{ background: "var(--surface3)", borderRadius: "99px", height: "7px", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p}%`, background: c.bar, borderRadius: "99px", transition: "width 0.5s ease" }} />
                </div>
                <span style={{ fontSize: "12px", fontWeight: 800, color: c.color, textAlign: "right" }}>{p}%</span>
                <span style={{ fontSize: "10px", color: "var(--text3)", textAlign: "right" }}>{ok}/{total}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function DataTransferPage() {
  const [activeTab, setActiveTab]   = useState<"dashboard" | "history">("dashboard")
  const [rows, setRows]             = useState<TransferRow[]>([])
  const [masterMap, setMasterMap]   = useState<Record<number, MasterDepot>>({})
  const [ediRaw, setEdiRaw]         = useState<Record<number, { spv: string; tgl: string; grsm: string; rsm: string; release: string }>>({})
  const [baseline, setBaseline]     = useState(yesterdayISO)
  const [editBaseline, setEditBaseline] = useState(false)
  const [tempBaseline, setTempBaseline] = useState("")
  const [uploadOpen, setUploadOpen] = useState(false)
  const [fileName, setFileName]     = useState("")
  const [uploading, setUploading]   = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saveNote, setSaveNote]     = useState("")
  const [error, setError]           = useState("")
  const [success, setSuccess]       = useState("")
  const [search, setSearch]         = useState("")
  const [srvFilter, setSrvFilter]   = useState("ALL")
  const [aorFilter, setAorFilter]   = useState("ALL")
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // History state
  const [history, setHistory]             = useState<any[]>([])
  const [histLoading, setHistLoading]     = useState(false)
  const [selSnap, setSelSnap]             = useState<string | null>(null)
  const [selSnapDate, setSelSnapDate]     = useState("")
  const [snapRows, setSnapRows]           = useState<any[]>([])
  const [snapLoading, setSnapLoading]     = useState(false)
  const [snapSearch, setSnapSearch]       = useState("")
  const [snapSrvFilter, setSnapSrvFilter] = useState("ALL")
  const [snapAorFilter, setSnapAorFilter] = useState("ALL")
  const [histExpandedId, setHistExpandedId] = useState<number | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  // Load master
  useEffect(() => {
    supabase.from("master_data_adp")
      .select("adp_code,depot,distributor_name,server,server_name,region_name,area_name,remarks")
      .then(({ data }) => {
        if (!data) return
        const map: Record<number, MasterDepot> = {}
        data.forEach((d: MasterDepot) => { if (d.adp_code) map[d.adp_code] = d })
        setMasterMap(map)
      })
  }, [])

  // Rebuild rows
  useEffect(() => {
    if (!Object.keys(ediRaw).length) return
    const built: TransferRow[] = Object.entries(ediRaw).map(([k, edi]) => {
      const distId = parseInt(k)
      const master = masterMap[distId]
      const lama = calcLama(edi.tgl, baseline)
      const aor = master?.region_name || ""
      return {
        distributor_id: distId,
        distributor_nm: master?.distributor_name || `Dist ${distId}`,
        spv: edi.spv, grsm: edi.grsm, rsm: edi.rsm, release: edi.release,
        tgl_gudang: edi.tgl, lama,
        server: master?.server ?? null, server_name: master?.server_name ?? "",
        depot: master?.depot ?? "", region_name: aor, area_name: master?.area_name ?? "",
        aor, tas: AOR_TAS[aor] || "",
        excluded: master?.remarks === "Inactive",
        inactive: master?.remarks === "Inactive",
      }
    }).sort((a, b) => b.lama - a.lama || a.distributor_id - b.distributor_id)
    setRows(built)
  }, [ediRaw, masterMap, baseline])

  // Load history list
  const loadHistory = async () => {
    setHistLoading(true)
    const { data } = await supabase.from("edi_transfer_snapshots")
      .select("id,snapshot_date,uploaded_at,note").order("snapshot_date", { ascending: false }).limit(30)
    if (data) setHistory(data)
    setHistLoading(false)
  }
  useEffect(() => { if (activeTab === "history") loadHistory() }, [activeTab])

  // Load snapshot detail
  const loadSnap = async (id: string, date: string) => {
    setSelSnap(id); setSelSnapDate(date); setSnapLoading(true)
    setSnapSearch(""); setSnapSrvFilter("ALL"); setSnapAorFilter("ALL")
    const { data } = await supabase.from("edi_transfer_detail")
      .select("*").eq("snapshot_id", id).order("lama", { ascending: false })
    if (data) {
      // Enrich with tas from AOR
      const enriched = data.map((r: any) => ({
        ...r,
        aor: r.region_name || "",
        tas: AOR_TAS[r.region_name || ""] || "",
      }))
      setSnapRows(enriched)
    }
    setSnapLoading(false)
  }

  // File upload
  const handleFile = async (file: File) => {
    setUploading(true); setError("")
    setFileName(file.name)
    try {
      const text = await file.text()
      const parsed = parseEdiCsv(text)
      if (!Object.keys(parsed).length) { setError("File kosong atau format tidak sesuai"); setUploading(false); return }
      setEdiRaw(parsed)
      setUploadOpen(false)
      setSuccess(`✅ ${Object.keys(parsed).length} distributor dimuat`)
      setTimeout(() => setSuccess(""), 3000)
    } catch (e) { setError("Gagal parse: " + String(e)) }
    setUploading(false)
  }

  const deleteRow = (distId: number) => {
    setRows(prev => prev.filter(r => r.distributor_id !== distId))
    setEdiRaw(prev => { const next = { ...prev }; delete next[distId]; return next })
  }
  const toggleExclude = (distId: number) => {
    setRows(prev => prev.map(r => r.distributor_id === distId ? { ...r, excluded: !r.excluded } : r))
  }

  // Save
  const handleSave = async () => {
    if (!activeRows.length) return
    setSaving(true); setError("")
    try {
      const { data: snap, error: e1 } = await supabase
        .from("edi_transfer_snapshots")
        .insert({ snapshot_date: baseline, note: saveNote || `Snapshot ${baseline}`, created_by: "System Support" })
        .select().single()
      if (e1 || !snap) throw new Error(e1?.message || "Gagal buat snapshot")
      const details = activeRows.map(r => ({
        snapshot_id: snap.id, snapshot_date: baseline,
        distributor_id: r.distributor_id, distributor_nm: r.distributor_nm,
        spv: r.spv, grsm: r.grsm, rsm: r.rsm, release: r.release,
        tgl_gudang: r.tgl_gudang || null, lama: r.lama,
        server: r.server, server_name: r.server_name,
        depot: r.depot, region_name: r.region_name, sub_aor: r.area_name,
        oa: 0, nilai_omset: 0, target_omset: 0, perc_omset: 0,
      }))
      const { error: e2 } = await supabase.from("edi_transfer_detail").insert(details)
      if (e2) throw new Error(e2.message)
      setSuccess(`✅ ${details.length} data tersimpan — snapshot ${baseline}`)
      setTimeout(() => setSuccess(""), 4000)
      setSaveNote("")
    } catch (e) { setError(String(e)) }
    setSaving(false)
  }

  // Computed
  const activeRows = useMemo(() => rows.filter(r => !r.excluded), [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r =>
      (srvFilter === "ALL" || String(r.server ?? "") === srvFilter) &&
      (aorFilter === "ALL" || r.aor === aorFilter) &&
      (!q || r.distributor_nm.toLowerCase().includes(q) || String(r.distributor_id).includes(q) ||
        r.depot.toLowerCase().includes(q) || r.server_name.toLowerCase().includes(q))
    )
  }, [rows, search, srvFilter, aorFilter])

  // History filtered rows
  const snapFiltered = useMemo(() => {
    const q = snapSearch.toLowerCase()
    return snapRows.filter(r =>
      (snapSrvFilter === "ALL" || String(r.server ?? "") === snapSrvFilter) &&
      (snapAorFilter === "ALL" || (r.region_name || "") === snapAorFilter) &&
      (!q || (r.distributor_nm || "").toLowerCase().includes(q) || String(r.distributor_id).includes(q) ||
        (r.depot || "").toLowerCase().includes(q) || (r.server_name || "").toLowerCase().includes(q))
    )
  }, [snapRows, snapSearch, snapSrvFilter, snapAorFilter])

  const snapActiveRows = useMemo(() => snapRows.filter((r: any) => !r.excluded), [snapRows])

  const th_style = (a: "left" | "center" | "right" = "left"): React.CSSProperties => ({
    padding: "9px 12px", fontSize: "10px", fontWeight: 700, color: "var(--text3)",
    textTransform: "uppercase", letterSpacing: "0.05em",
    borderBottom: "1px solid var(--border)", background: "var(--surface2)",
    textAlign: a, whiteSpace: "nowrap",
  })

  const overallColor = useMemo(() => {
    const p = pct(activeRows.filter(r => r.lama <= 0).length, activeRows.length)
    return p >= 95 ? "#166534" : p >= 80 ? "#0369A1" : p >= 60 ? "#92400E" : "#991B1B"
  }, [activeRows])

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <MotivationBanner page="data-transfer" />
      <div style={{ padding: "22px 24px" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "#0891B2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshCw size={18} color="white" />
            </div>
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", margin: 0 }}>Data Transfer Web Ficom</h1>
              <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>Monitoring transfer status EDI per distributor</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Baseline */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface)", border: "1.5px solid var(--border)", borderRadius: "8px", padding: "6px 10px" }}>
              <Calendar size={12} color="#0891B2" />
              <span style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 600 }}>Baseline:</span>
              {editBaseline ? (
                <input type="date" value={tempBaseline} autoFocus
                  onChange={e => setTempBaseline(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { setBaseline(tempBaseline); setEditBaseline(false) } if (e.key === "Escape") setEditBaseline(false) }}
                  style={{ border: "none", outline: "none", fontSize: "12px", fontWeight: 700, color: "#0891B2", background: "transparent", fontFamily: "inherit", cursor: "pointer", width: "120px" }} />
              ) : (
                <span style={{ fontSize: "12px", fontWeight: 700, color: "#0891B2" }}>{baseline}</span>
              )}
              <button onClick={() => { if (editBaseline) { setBaseline(tempBaseline || baseline); setEditBaseline(false) } else { setTempBaseline(baseline); setEditBaseline(true) } }}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: "0 2px" }}>
                {editBaseline ? <Check size={13} color="#166534" /> : <Pencil size={11} color="var(--text3)" />}
              </button>
            </div>
            <div title={`Baseline ${baseline}: distributor dengan tgl_gudang ≥ ${baseline} = OK`}
              style={{ display: "flex", alignItems: "center", gap: "4px", background: "#ECFEFF", border: "1px solid #A5F3FC", borderRadius: "7px", padding: "5px 9px", cursor: "help" }}>
              <Info size={12} color="#0891B2" />
              <span style={{ fontSize: "11px", color: "#0E7490", fontWeight: 600 }}>Cek transfer ≥ {baseline}</span>
            </div>
            <button onClick={() => setUploadOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "none", background: "#0891B2", color: "white", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Upload size={13} /> Upload EDI
            </button>
            {rows.length > 0 && (
              <button onClick={handleSave} disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "none", background: saving ? "#94A3B8" : "#166534", color: "white", fontSize: "12px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                <Save size={13} />{saving ? "Saving..." : "Save"}
              </button>
            )}
            <div style={{ display: "flex", background: "var(--surface2)", borderRadius: "8px", padding: "3px", border: "1px solid var(--border)" }}>
              {(["dashboard", "history"] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  style={{ padding: "5px 12px", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, fontFamily: "inherit", background: activeTab === t ? "white" : "transparent", color: activeTab === t ? "var(--text)" : "var(--text3)", boxShadow: activeTab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none", transition: "all 0.15s" }}>
                  {t === "dashboard" ? "Dashboard" : "History"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "9px", padding: "10px 14px", marginBottom: "14px", color: "#991B1B", fontSize: "13px" }}>
            <AlertCircle size={14} />{error}
            <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#991B1B" }}><X size={13} /></button>
          </div>
        )}
        {success && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: "9px", padding: "10px 14px", marginBottom: "14px", color: "#166534", fontSize: "13px" }}>
            <CheckCircle2 size={14} />{success}
          </div>
        )}

        {/* ══ UPLOAD MODAL ══ */}
        {uploadOpen && (
          <div onClick={e => { if (e.target === e.currentTarget) setUploadOpen(false) }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)" }}>
            <div style={{ background: "var(--surface)", borderRadius: "16px", padding: "28px", width: "440px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <div>
                  <div style={{ fontSize: "17px", fontWeight: 800, color: "var(--text)" }}>Upload EDI Omset</div>
                  <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>Format CSV · separator pipe (|)</div>
                </div>
                <button onClick={() => setUploadOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)" }}><X size={18} /></button>
              </div>
              <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) { handleFile(f); e.target.value = "" } }} />
              <div onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "#0891B2"; (e.currentTarget as HTMLElement).style.background = "#ECFEFF" }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--surface2)" }}
                onDrop={e => { e.preventDefault(); (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.background = "var(--surface2)"; const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                style={{ border: "2px dashed var(--border)", borderRadius: "12px", padding: "28px 20px", textAlign: "center", cursor: "pointer", background: "var(--surface2)", transition: "all 0.15s", marginBottom: "14px" }}>
                <Upload size={28} color="#0891B2" style={{ margin: "0 auto 10px" }} />
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)", marginBottom: "4px" }}>
                  {uploading ? "Memproses..." : fileName ? `📄 ${fileName}` : "Klik atau drop file EDI di sini"}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text3)" }}>EDI_OMSET_DASHBOARD*.csv</div>
              </div>
              <div style={{ display: "flex", gap: "8px", padding: "10px 12px", background: "#ECFEFF", borderRadius: "8px", border: "1px solid #A5F3FC" }}>
                <Info size={13} color="#0891B2" style={{ flexShrink: 0, marginTop: "1px" }} />
                <div style={{ fontSize: "12px", color: "#0E7490" }}>
                  Baseline aktif: <strong>{baseline}</strong> — distributor Inactive otomatis dikecualikan dari %.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ TAB: DASHBOARD ══════════ */}
        {activeTab === "dashboard" && (<>
          {rows.length === 0 ? (
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px", padding: "60px", textAlign: "center" }}>
              <Upload size={36} color="var(--text3)" style={{ margin: "0 auto 14px", opacity: 0.35 }} />
              <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)", marginBottom: "6px" }}>Belum ada data EDI</div>
              <div style={{ fontSize: "13px", color: "var(--text3)", marginBottom: "18px" }}>Klik "Upload EDI" untuk memulai</div>
              <button onClick={() => setUploadOpen(true)}
                style={{ padding: "10px 22px", borderRadius: "8px", border: "none", background: "#0891B2", color: "white", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                Upload EDI
              </button>
            </div>
          ) : (<>
            <SummaryCards activeRows={activeRows} aorFilter={aorFilter} setAorFilter={setAorFilter} />

            {/* Filters */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 11px", flex: "1", minWidth: "180px" }}>
                <Search size={13} color="var(--text3)" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari distributor, depot, server name..."
                  style={{ background: "none", border: "none", outline: "none", fontSize: "12px", color: "var(--text)", width: "100%", fontFamily: "inherit" }} />
                {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0 }}><X size={12} /></button>}
              </div>
              <select value={srvFilter} onChange={e => setSrvFilter(e.target.value)}
                style={{ padding: "7px 11px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
                {["ALL", "138", "228", "252"].map(s => <option key={s} value={s}>{s === "ALL" ? "All Server" : `Server ${s}`}</option>)}
              </select>
              <select value={aorFilter} onChange={e => setAorFilter(e.target.value)}
                style={{ padding: "7px 11px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
                {["ALL", "GMA", "NOL", "SOL", "VIS", "MIN"].map(a => <option key={a} value={a}>{a === "ALL" ? "All Area" : a}</option>)}
              </select>
              <span style={{ fontSize: "12px", color: "var(--text3)" }}>{filtered.length}/{rows.length}</span>
              {rows.some(r => r.excluded) && (
                <button onClick={() => setRows(p => p.map(r => ({ ...r, excluded: false })))}
                  style={{ fontSize: "11px", color: "#92400E", background: "#FEF3C7", border: "none", padding: "5px 10px", borderRadius: "99px", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  Reset eksklusi
                </button>
              )}
            </div>

            <TransferTable
              data={filtered}
              showActions={true}
              onDelete={deleteRow}
              onToggleExclude={toggleExclude}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
            />

            {/* Save bar */}
            <div style={{ marginTop: "14px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "12px 16px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
              <input value={saveNote} onChange={e => setSaveNote(e.target.value)}
                placeholder={`Catatan opsional untuk snapshot ${baseline}...`}
                style={{ flex: 1, padding: "8px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", outline: "none", minWidth: "200px" }} />
              <button onClick={handleSave} disabled={saving}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 18px", borderRadius: "8px", border: "none", background: saving ? "#94A3B8" : "#166534", color: "white", fontSize: "12px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                <Save size={13} />{saving ? "Menyimpan..." : `Save snapshot (${activeRows.length} dist)`}
              </button>
            </div>
          </>)}
        </>)}

        {/* ══════════ TAB: HISTORY ══════════ */}
        {activeTab === "history" && (
          <div style={{ display: "flex", gap: "14px" }}>
            {/* Snapshot list — sidebar kiri */}
            <div style={{ width: "220px", flexShrink: 0, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden", alignSelf: "flex-start" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: "13px" }}>Riwayat</span>
                <button onClick={loadHistory} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)" }}><RefreshCw size={13} /></button>
              </div>
              {histLoading ? <div style={{ padding: "30px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>Memuat...</div>
                : history.length === 0 ? <div style={{ padding: "30px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>Belum ada snapshot</div>
                  : (
                    <div style={{ maxHeight: "70vh", overflowY: "auto" }}>
                      {history.map(h => (
                        <button key={h.id} onClick={() => loadSnap(h.id, h.snapshot_date)}
                          style={{ width: "100%", padding: "10px 14px", border: "none", borderBottom: "1px solid var(--border)", background: selSnap === h.id ? "#E0F2FE" : "transparent", cursor: "pointer", textAlign: "left", fontFamily: "inherit", display: "flex", flexDirection: "column", gap: "2px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Calendar size={11} color={selSnap === h.id ? "#0891B2" : "var(--text3)"} />
                            <span style={{ fontWeight: 700, fontSize: "12px", color: selSnap === h.id ? "#0891B2" : "var(--text)" }}>{h.snapshot_date}</span>
                          </div>
                          <div style={{ fontSize: "10px", color: "var(--text3)" }}>
                            {new Date(h.uploaded_at).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </div>
                          {h.note && <div style={{ fontSize: "10px", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.note}</div>}
                        </button>
                      ))}
                    </div>
                  )}
            </div>

            {/* Snapshot detail — full view */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {!selSnap ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "60px", textAlign: "center", color: "var(--text3)" }}>
                  <Calendar size={32} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                  <div style={{ fontSize: "14px" }}>Pilih snapshot dari daftar kiri</div>
                </div>
              ) : snapLoading ? (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "60px", textAlign: "center", color: "var(--text3)" }}>
                  Memuat...
                </div>
              ) : (<>
                {/* Snapshot summary */}
                <SummaryCards activeRows={snapActiveRows as TransferRow[]} aorFilter={snapAorFilter} setAorFilter={setSnapAorFilter} />

                {/* Filters */}
                <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 12px", background: "#E0F2FE", borderRadius: "8px", border: "1px solid #BAE6FD" }}>
                    <Calendar size={12} color="#0891B2" />
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#0891B2" }}>Snapshot: {selSnapDate}</span>
                    <button onClick={() => { setSelSnap(null); setSnapRows([]) }} style={{ background: "none", border: "none", cursor: "pointer", color: "#0891B2", marginLeft: "4px" }}><X size={12} /></button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 11px", flex: "1", minWidth: "160px" }}>
                    <Search size={13} color="var(--text3)" />
                    <input value={snapSearch} onChange={e => setSnapSearch(e.target.value)} placeholder="Cari..."
                      style={{ background: "none", border: "none", outline: "none", fontSize: "12px", color: "var(--text)", width: "100%", fontFamily: "inherit" }} />
                    {snapSearch && <button onClick={() => setSnapSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0 }}><X size={12} /></button>}
                  </div>
                  <select value={snapSrvFilter} onChange={e => setSnapSrvFilter(e.target.value)}
                    style={{ padding: "7px 11px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
                    {["ALL", "138", "228", "252"].map(s => <option key={s} value={s}>{s === "ALL" ? "All Server" : `Server ${s}`}</option>)}
                  </select>
                  <select value={snapAorFilter} onChange={e => setSnapAorFilter(e.target.value)}
                    style={{ padding: "7px 11px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "inherit", cursor: "pointer" }}>
                    {["ALL", "GMA", "NOL", "SOL", "VIS", "MIN"].map(a => <option key={a} value={a}>{a === "ALL" ? "All Area" : a}</option>)}
                  </select>
                  <span style={{ fontSize: "12px", color: "var(--text3)" }}>{snapFiltered.length}/{snapRows.length}</span>
                </div>

                <TransferTable
                  data={snapFiltered}
                  showActions={false}
                  expandedId={histExpandedId}
                  setExpandedId={setHistExpandedId}
                />
              </>)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}