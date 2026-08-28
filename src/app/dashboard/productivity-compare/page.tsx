"use client"
// PATH: src/app/dashboard/productivity-compare/page.tsx
// Target vs Realisasi per komponen (C1, C3, C4, C7, ...) dari EDI Ficom
// Lite Productivity (EDI2600006), breakdown hierarki SD → RDM → ADM →
// ADS → Salesman. Data ditarik lewat /api/ficom-productivity-sync (tombol
// "Tarik dari Ficom" di bawah, atau otomatis tiap jam lewat Vercel Cron),
// filter tanggal awal bulan berjalan s.d. hari ini.

import { useState, useEffect, useMemo, useCallback } from "react"
import { RefreshCw, TrendingUp, Search, ChevronDown, ChevronRight, Calendar, AlertCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Types ─────────────────────────────────────────────────────
interface ProdRow {
  period_month: string
  nsm_id: string | null; nsm_nm: string | null       // → SD
  grsm_id: string | null; grsm_nm: string | null     // → RDM
  rsm_id: string | null; rsm_nm: string | null       // → ADM
  ss_id: string | null; ss_nm: string | null         // → ADS
  sls_id: string | null; sls_nm: string | null       // → Salesman
  component_id: string | null
  component_target: number | null
  component_realisasi: number | null
}

interface TreeNode {
  key: string
  name: string
  level: string
  target: number
  realisasi: number
  rowCount: number
  children: TreeNode[]
}

// ── Mapping TIPE_ID/COMPONENT_ID → VIEW SFA (dari Form Request File Set
// RBAC MTX PHI) — dipakai buat urutan & label tab. C3 muncul di T1 & T5
// dengan label sama ("Prod. Call"), jadi tab tetap unik per component_id.
const COMPONENT_LABELS: Record<string, string> = {
  C1: "STT", C3: "Prod. Call", C36: "Effective Call",
  C4: "STT", C7: "Prod. Call",
  C12: "STT", C16: "AO",
  C17: "STT",
  C22: "AVG Linesold", C25: "QR Scan", C37: "Effective Call",
}
const COMPONENT_ORDER = ["C1", "C3", "C36", "C4", "C7", "C12", "C16", "C17", "C22", "C25", "C37"]

const LEVELS: { idField: keyof ProdRow; nameField: keyof ProdRow; label: string }[] = [
  { idField: "nsm_id", nameField: "nsm_nm", label: "SD" },
  { idField: "grsm_id", nameField: "grsm_nm", label: "RDM" },
  { idField: "rsm_id", nameField: "rsm_nm", label: "ADM" },
  { idField: "ss_id", nameField: "ss_nm", label: "ADS" },
  { idField: "sls_id", nameField: "sls_nm", label: "Salesman" },
]

const fmt = (n: number) => Math.round(n).toLocaleString("id-ID")
const achColor = (pct: number) => pct >= 100 ? "#166534" : pct >= 80 ? "#0369A1" : pct >= 50 ? "#C2410C" : "#991B1B"
const achBg = (pct: number) => pct >= 100 ? "#DCFCE7" : pct >= 80 ? "#EFF6FF" : pct >= 50 ? "#FFEDD5" : "#FEE2E2"

// Bottom-up: leaf (Salesman) dedupe target (nilai konstan per salesman/
// komponen, terulang di tiap baris detail pcode/hari — kalau di-SUM
// mentah akan overcount berkali-kali lipat). Realisasi tetap SUM mentah
// dari semua baris detail (additive per event). Level di atasnya tinggal
// jumlahkan hasil children — otomatis tidak double-count.
function buildTree(rows: ProdRow[], depth = 0): TreeNode[] {
  const { idField, nameField, label } = LEVELS[depth]
  const groups = new Map<string, ProdRow[]>()
  for (const r of rows) {
    const k = (r[idField] as string) || "—"
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(r)
  }
  const isLeaf = depth === LEVELS.length - 1
  const nodes = Array.from(groups.entries()).map(([k, grs]) => {
    const name = (grs[0][nameField] as string) || k
    let target = 0, realisasi = 0, children: TreeNode[] = []
    if (isLeaf) {
      target = grs.find(r => r.component_target != null)?.component_target ?? 0
      realisasi = grs.reduce((s, r) => s + (r.component_realisasi || 0), 0)
    } else {
      children = buildTree(grs, depth + 1)
      target = children.reduce((s, c) => s + c.target, 0)
      realisasi = children.reduce((s, c) => s + c.realisasi, 0)
    }
    return { key: k, name, level: label, target, realisasi, rowCount: grs.length, children }
  })
  return nodes.sort((a, b) => b.target - a.target)
}

function filterTree(nodes: TreeNode[], q: string): TreeNode[] {
  if (!q) return nodes
  const lq = q.toLowerCase()
  const out: TreeNode[] = []
  for (const n of nodes) {
    const selfMatch = n.name.toLowerCase().includes(lq) || n.key.toLowerCase().includes(lq)
    const kids = filterTree(n.children, q)
    if (selfMatch || kids.length) out.push(selfMatch ? n : { ...n, children: kids })
  }
  return out
}

// ── Fetch staging (paginated — bisa ribuan baris) ──────────────
async function fetchProductivityRows(periodMonth: string, onProgress?: (m: string) => void): Promise<ProdRow[]> {
  const pageSize = 1000
  let from = 0
  let all: ProdRow[] = []
  for (;;) {
    const { data, error } = await supabase
      .from("ficom_productivity_staging")
      .select("period_month,nsm_id,nsm_nm,grsm_id,grsm_nm,rsm_id,rsm_nm,ss_id,ss_nm,sls_id,sls_nm,component_id,component_target,component_realisasi")
      .eq("period_month", periodMonth)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data as ProdRow[])
    onProgress?.(`⏳ Memuat data... ${all.length} baris`)
    if (data.length < pageSize) break
    from += pageSize
  }
  return all
}

// ── TREE ROW (recursive, expand/collapse) ──────────────────────
function TreeRow({ node, depth, expanded, toggle }: {
  node: TreeNode; depth: number
  expanded: Set<string>; toggle: (path: string) => void
}) {
  const path = `${depth}:${node.key}`
  const isOpen = expanded.has(path)
  const pct = node.target ? Math.round(node.realisasi / node.target * 1000) / 10 : (node.realisasi ? 100 : 0)
  const hasChildren = node.children.length > 0
  return (
    <>
      <div onClick={() => hasChildren && toggle(path)}
        style={{
          display: "grid", gridTemplateColumns: "1fr 130px 130px 110px", alignItems: "center",
          padding: "8px 12px", cursor: hasChildren ? "pointer" : "default",
          borderBottom: "1px solid var(--border)", background: depth === 0 ? "var(--surface2)" : "transparent",
        }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", paddingLeft: `${depth * 18}px`, fontSize: depth === 0 ? "12px" : "11.5px", fontWeight: depth === 0 ? 800 : 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {hasChildren ? (isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />) : <span style={{ width: "12px" }} />}
          <span title={`${node.level} · ${node.key}`}>{node.name}</span>
          {hasChildren && <span style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 400 }}>({node.children.length})</span>}
        </div>
        <div style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "11.5px" }}>{fmt(node.target)}</div>
        <div style={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: "11.5px" }}>{fmt(node.realisasi)}</div>
        <div style={{ textAlign: "right" }}>
          <span style={{ fontSize: "10.5px", fontWeight: 800, padding: "2px 8px", borderRadius: "99px", background: achBg(pct), color: achColor(pct) }}>{pct.toFixed(1)}%</span>
        </div>
      </div>
      {isOpen && node.children.map(c => (
        <TreeRow key={`${path}/${c.key}`} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} />
      ))}
    </>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function ProductivityComparePage() {
  const [periods, setPeriods] = useState<string[]>([])
  const [period, setPeriod] = useState("")
  const [rows, setRows] = useState<ProdRow[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState("")
  const [search, setSearch] = useState("")
  const [component, setComponent] = useState("")
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const defaultPeriod = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])

  const loadPeriods = useCallback(async () => {
    const { data } = await supabase
      .from("ficom_productivity_staging")
      .select("period_month")
      .order("period_month", { ascending: false })
    const uniq = Array.from(new Set((data || []).map(d => d.period_month as string)))
    if (uniq.length) {
      setPeriods(uniq)
      setPeriod(prev => prev || uniq[0])
    } else {
      setPeriods([defaultPeriod])
      setPeriod(defaultPeriod)
    }
  }, [defaultPeriod])

  const loadRows = useCallback(async (p: string) => {
    if (!p) return
    setLoading(true)
    try {
      const data = await fetchProductivityRows(p)
      setRows(data)
    } catch { /* biarkan rows lama tampil, jangan crash halaman */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadPeriods() }, [loadPeriods])
  useEffect(() => { if (period) loadRows(period) }, [period, loadRows])

  // Tab komponen: gabungan urutan Excel (COMPONENT_ORDER) + komponen lain
  // yang ternyata ada di data tapi belum ada di mapping (fallback label = id-nya).
  const componentTabs = useMemo(() => {
    const present = new Set(rows.map(r => r.component_id).filter(Boolean) as string[])
    const known = COMPONENT_ORDER.filter(c => present.has(c))
    const unknown = Array.from(present).filter(c => !COMPONENT_ORDER.includes(c)).sort()
    return [...known, ...unknown]
  }, [rows])

  useEffect(() => {
    if (componentTabs.length && !componentTabs.includes(component)) setComponent(componentTabs[0])
  }, [componentTabs, component])

  const componentRows = useMemo(() => rows.filter(r => r.component_id === component), [rows, component])

  const tree = useMemo(() => componentRows.length ? buildTree(componentRows) : [], [componentRows])
  const filteredTree = useMemo(() => filterTree(tree, search), [tree, search])

  const summary = useMemo(() => {
    const target = tree.reduce((s, n) => s + n.target, 0)
    const realisasi = tree.reduce((s, n) => s + n.realisasi, 0)
    const pct = target ? Math.round(realisasi / target * 1000) / 10 : 0
    const salesmanCount = componentRows.reduce((set, r) => { if (r.sls_id) set.add(r.sls_id); return set }, new Set<string>()).size
    return { target, realisasi, pct, salesmanCount }
  }, [tree, componentRows])

  const toggle = (path: string) => setExpanded(p => {
    const n = new Set(p); n.has(path) ? n.delete(path) : n.add(path); return n
  })

  const expandAllSD = () => setExpanded(new Set(tree.map(n => `0:${n.key}`)))
  const collapseAll = () => setExpanded(new Set())

  const handleSync = async () => {
    setSyncing(true); setSyncMsg("")
    try {
      const res = await fetch("/api/ficom-productivity-sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Sync gagal")
      setSyncMsg(`✅ ${data.rows} baris tersinkron (${data.dateFrom} s.d. ${data.dateTo})`)
      await loadPeriods()
      await loadRows(data.periodMonth || period || defaultPeriod)
    } catch (e) {
      setSyncMsg("❌ " + (e instanceof Error ? e.message : String(e)))
    }
    setSyncing(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <MotivationBanner page="productivity-compare" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg,#16A34A,#166534)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TrendingUp size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>Productivity Compare</h1>
            <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>Target vs Realisasi per komponen · EDI Ficom Lite Productivity</p>
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px" }}>
            <Calendar size={12} color="var(--text3)" />
            <select value={period} onChange={e => setPeriod(e.target.value)}
              style={{ border: "none", outline: "none", fontSize: "11px", fontWeight: 700, color: "#166534", background: "transparent", fontFamily: "inherit" }}>
              {periods.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <button onClick={handleSync} disabled={syncing}
            title="Login Ficom & tarik data EDI Productivity terbaru (awal bulan s.d. hari ini)"
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "none", background: syncing ? "#94A3B8" : "#166534", color: "white", fontSize: "12px", fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
            {syncing ? "Sync..." : "Tarik dari Ficom"}
          </button>

          <button onClick={() => loadRows(period)} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "5px", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            Refresh
          </button>
        </div>
      </div>

      {syncMsg && (
        <div style={{ background: syncMsg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2", border: `1px solid ${syncMsg.startsWith("✅") ? "#BBF7D0" : "#FECACA"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: syncMsg.startsWith("✅") ? "#166534" : "#991B1B" }}>
          {syncMsg}
        </div>
      )}

      {rows.length === 0 && !loading ? (
        <div style={{ padding: "60px", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
          <AlertCircle size={36} color="var(--text3)" style={{ margin: "0 auto 12px", display: "block", opacity: 0.3 }} />
          <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "4px" }}>Belum ada data Productivity</div>
          <div style={{ fontSize: "13px", color: "var(--text3)", marginBottom: "16px" }}>Data di-refresh otomatis tiap jam dari Ficom, atau tarik manual sekarang</div>
          <button onClick={handleSync} disabled={syncing} style={{ padding: "9px 20px", borderRadius: "9px", border: "none", background: syncing ? "#94A3B8" : "#166534", color: "white", fontSize: "13px", fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>{syncing ? "Sync..." : "Tarik dari Ficom"}</button>
        </div>
      ) : (<>
        {/* Component tabs */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "10px", padding: "6px" }}>
          {componentTabs.map(c => {
            const active = c === component
            return (
              <button key={c} onClick={() => { setComponent(c); setSearch(""); setExpanded(new Set()) }}
                style={{ padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, fontFamily: "inherit", background: active ? "#166534" : "var(--surface)", color: active ? "white" : "var(--text2)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                {c} <span style={{ opacity: active ? 0.85 : 0.6, fontWeight: 500 }}>· {COMPONENT_LABELS[c] || "—"}</span>
              </button>
            )
          })}
        </div>

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "10px" }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Total Target</div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "var(--text)" }}>{fmt(summary.target)}</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Total Realisasi</div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "var(--text)" }}>{fmt(summary.realisasi)}</div>
          </div>
          <div style={{ background: achBg(summary.pct), borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Achievement</div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: achColor(summary.pct) }}>{summary.pct.toFixed(1)}%</div>
          </div>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", padding: "14px 16px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Salesman</div>
            <div style={{ fontSize: "22px", fontWeight: 900, color: "var(--text)" }}>{summary.salesmanCount}</div>
          </div>
        </div>

        {/* Search + expand controls */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "7px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", padding: "7px 11px", flex: "1", minWidth: "160px" }}>
            <Search size={13} color="var(--text3)" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari SD, RDM, ADM, ADS, atau Salesman..."
              style={{ background: "none", border: "none", outline: "none", fontSize: "12px", color: "var(--text)", width: "100%", fontFamily: "inherit" }} />
          </div>
          <button onClick={expandAllSD} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", cursor: "pointer", fontFamily: "inherit" }}>Expand SD</button>
          <button onClick={collapseAll} style={{ fontSize: "11px", padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", cursor: "pointer", fontFamily: "inherit" }}>Collapse</button>
        </div>

        {/* Hierarchy tree */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 130px 130px 110px", padding: "9px 12px", background: "var(--surface2)", fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", borderBottom: "1px solid var(--border)" }}>
            <div>SD / RDM / ADM / ADS / Salesman</div>
            <div style={{ textAlign: "right" }}>Target</div>
            <div style={{ textAlign: "right" }}>Realisasi</div>
            <div style={{ textAlign: "right" }}>Ach.</div>
          </div>
          <div style={{ maxHeight: "600px", overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>
                <RefreshCw size={20} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px", display: "block" }} />
                Memuat data...
              </div>
            ) : filteredTree.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text3)", fontSize: "12px" }}>Tidak ada data untuk komponen {component}</div>
            ) : filteredTree.map(n => (
              <TreeRow key={`0:${n.key}`} node={n} depth={0} expanded={expanded} toggle={toggle} />
            ))}
          </div>
        </div>
      </>)}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}