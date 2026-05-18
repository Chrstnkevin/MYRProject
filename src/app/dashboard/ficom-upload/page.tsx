"use client"
// PATH: src/app/dashboard/ficom-upload/page.tsx

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import {
  Upload, CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet,
  Eye, Trash2, Search, TriangleAlert, Users, TrendingUp,
  ChevronDown, ChevronRight, EyeOff
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── BD Calendar 2026 (official PH calendar) ──────────────────
const BD_2026: Record<string, number> = {
  "2026-01": 26, "2026-02": 19, "2026-03": 21, "2026-04": 22,
  "2026-05": 25, "2026-06": 25, "2026-07": 27, "2026-08": 24,
  "2026-09": 26, "2026-10": 27, "2026-11": 24, "2026-12": 22,
}

// PH Public Holidays 2026 (yyyy-mm-dd)
const PH_HOLIDAYS_2026 = new Set([
  "2026-01-01","2026-02-20","2026-04-02","2026-04-03","2026-04-09",
  "2026-05-01","2026-06-12","2026-08-21","2026-08-31","2026-11-01",
  "2026-11-30","2026-12-08","2026-12-24","2026-12-25","2026-12-30","2026-12-31",
])

/** Count BD from month start to maxDate (inclusive), using official calendar */
function calcSellingDays(minDate: string, maxDate: string): number {
  const start = new Date(minDate)
  const end   = new Date(maxDate)
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const iso = cur.toISOString().slice(0, 10)
    const dow = cur.getDay() // 0=Sun
    if (dow !== 0 && !PH_HOLIDAYS_2026.has(iso)) count++
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

// ── Types ─────────────────────────────────────────────────────
interface MasterUser {
  user_login: string
  sales_name: string
  position: string   // ADM | ADS | RDM | SD | COO
  aor: string
  sub_aor: string
  wf_map: string
  is_active: boolean
}

interface UserRow {
  user_login:      string
  sales_name:      string
  position:        string
  aor:             string
  sub_aor:         string
  wf_map:          string   // ADM code this user belongs to
  usage_days:      number
  selling_days:    number
  compliance_pct:  number
  last_usage_date: string | null
  never_login:     boolean
  period_month:    string
}

interface ParsedData {
  periodMonth:  string   // "2026-05"
  minDate:      string
  maxDate:      string
  sellingDays:  number
  users:        UserRow[]         // ALL users (ADM+RDM+ADS+SD+COO)
  usersNoAds:   UserRow[]         // without ADS
}

// Compliance bucket
function compBucket(pct: number): string {
  if (pct === 0)   return "0%"
  if (pct <= 25)   return "≤25%"
  if (pct <= 50)   return "≤50%"
  if (pct <= 75)   return "≤75%"
  return ">75%"
}
const BUCKET_ORDER = ["0%","≤25%","≤50%","≤75%",">75%"]
const BUCKET_CLR: Record<string, { bg: string; color: string }> = {
  "0%":   { bg: "#FEE2E2", color: "#991B1B" },
  "≤25%": { bg: "#FFEDD5", color: "#C2410C" },
  "≤50%": { bg: "#FEF9C3", color: "#854D0E" },
  "≤75%": { bg: "#DCFCE7", color: "#166534" },
  ">75%": { bg: "#D1FAE5", color: "#064E3B" },
}
const AOR_CLR: Record<string, string> = {
  GMA:"#D97706", NOL:"#2563EB", SOL:"#9333EA", VIS:"#0891B2", MIN:"#EF4444"
}

// ── Parse EDI CSV ─────────────────────────────────────────────
async function parseEdi(
  file: File,
  master: MasterUser[],
  onProgress: (m: string) => void,
  maxDateOverride?: string
): Promise<ParsedData> {
  onProgress("⏳ Reading EDI file...")
  const text = await file.text()
  const lines = text.trim().split("\n")
  const delim = lines[0]?.includes("|") ? "|" : ","
  const headers = lines[0].split(delim).map(h => h.replace(/"/g,"").trim())

  const idxUser = headers.indexOf("username")
  const idxDate = headers.indexOf("tanggal")
  if (idxUser < 0 || idxDate < 0) throw new Error("Kolom 'username' atau 'tanggal' tidak ditemukan")

  // activity: user_login → Set of date strings
  const activity = new Map<string, Set<string>>()
  const allDates: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(delim)
    if (cols.length < Math.max(idxUser, idxDate) + 1) continue
    const uid   = cols[idxUser].replace(/"/g,"").trim().toUpperCase()
    const dtRaw = cols[idxDate].replace(/"/g,"").trim()
    if (!uid.startsWith("WF")) continue
    // parse DD/MM/YYYY
    let iso = ""
    const m = dtRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) iso = `${m[3]}-${m[2]}-${m[1]}`
    else {
      const d = new Date(dtRaw)
      if (!isNaN(d.getTime())) iso = d.toISOString().slice(0,10)
    }
    if (!iso) continue
    if (!activity.has(uid)) activity.set(uid, new Set())
    activity.get(uid)!.add(iso)
    allDates.push(iso)
  }

  if (!allDates.length) throw new Error("Tidak ada data aktivitas ditemukan")

  const sortedDates = [...new Set(allDates)].sort()
  const minDate = sortedDates[0]
  const autoMaxDate = sortedDates[sortedDates.length - 1]
  // Use override if set and within same month, otherwise auto
  const maxDate = (maxDateOverride && maxDateOverride.slice(0,7) === autoMaxDate.slice(0,7))
    ? maxDateOverride
    : autoMaxDate
  if (maxDateOverride && maxDate !== maxDateOverride)
    onProgress(`⚠️ Override date ${maxDateOverride} diluar bulan file — pakai auto: ${autoMaxDate}`)
  const periodMonth = minDate.slice(0, 7)

  // Use BD calendar: count from 1st of month to maxDate
  const monthStart = `${periodMonth}-01`
  const sellingDays = calcSellingDays(monthStart, maxDate)
  const overrideNote = maxDate !== autoMaxDate ? ` (manual override dari ${autoMaxDate})` : ""
  onProgress(`✅ EDI: ${activity.size} user aktif · ${minDate} s/d ${maxDate} · ${sellingDays} BD${overrideNote}`)

  // Build UserRow for each master user
  const buildRows = (masterList: MasterUser[]): UserRow[] =>
    masterList.filter(u => u.is_active && !["SD","COO"].includes(u.position)).map(u => {
      const uid   = u.user_login.toUpperCase()
      const dates = activity.get(uid)
      const used  = dates ? dates.size : 0
      const comp  = sellingDays > 0 ? Math.round(used / sellingDays * 1000) / 10 : 0
      const last  = dates ? [...dates].sort().pop()! : null
      return {
        user_login:     u.user_login,
        sales_name:     u.sales_name,
        position:       u.position,
        aor:            u.aor,
        sub_aor:        u.sub_aor,
        wf_map:         u.wf_map,
        usage_days:     used,
        selling_days:   sellingDays,
        compliance_pct: comp,
        last_usage_date: last,
        never_login:    used === 0,
        period_month:   periodMonth,
      }
    })

  // SD/COO are excluded from utilisasi denominator (shown in table but not counted)
  const allMaster    = master.filter(u => u.is_active && !["SD","COO"].includes(u.position))
  const masterNoAds  = master.filter(u => u.is_active && !["SD","COO"].includes(u.position) && u.position !== "ADS")

  const users     = buildRows(allMaster)
  const usersNoAds = buildRows(masterNoAds)

  onProgress(`✅ Master: ${users.length} total (termasuk ADS) · ${usersNoAds.length} tanpa ADS`)
  onProgress(`✅ Tidak pernah login: ${users.filter(u=>u.never_login).length} user`)

  return { periodMonth, minDate, maxDate, sellingDays, users, usersNoAds }
}

// ── Stats helper ──────────────────────────────────────────────
function calcStats(rows: UserRow[]) {
  const total   = rows.length
  const active  = rows.filter(r => r.usage_days > 0).length
  const never   = rows.filter(r => r.never_login).length
  const avgComp = total ? Math.round(rows.reduce((s,r) => s + r.compliance_pct, 0) / total * 10) / 10 : 0
  const utilisasi = total ? Math.round(active / total * 100) : 0

  const buckets: Record<string, { count: number; pct: number }> = {}
  for (const b of BUCKET_ORDER) buckets[b] = { count: 0, pct: 0 }
  rows.forEach(r => { const b = compBucket(r.compliance_pct); buckets[b].count++ })
  for (const b of BUCKET_ORDER) buckets[b].pct = total ? Math.round(buckets[b].count / total * 100) : 0

  const byAor: Record<string, { total:number; active:number; avgComp:number; never:number }> = {}
  for (const r of rows) {
    if (!r.aor || r.aor === "UNK") continue
    if (!byAor[r.aor]) byAor[r.aor] = { total:0, active:0, avgComp:0, never:0 }
    byAor[r.aor].total++
    if (r.usage_days > 0) byAor[r.aor].active++
    if (r.never_login) byAor[r.aor].never++
    byAor[r.aor].avgComp += r.compliance_pct
  }
  for (const aor in byAor) {
    byAor[aor].avgComp = Math.round(byAor[aor].avgComp / byAor[aor].total * 10) / 10
  }

  return { total, active, never, avgComp, utilisasi, buckets, byAor }
}

// ── Upload to Supabase ────────────────────────────────────────
async function uploadToSupabase(data: ParsedData, includeAds: boolean, onProgress: (m: string) => void) {
  const pm   = data.periodMonth
  const rows = includeAds ? data.users : data.usersNoAds

  onProgress("⏳ Clearing old data...")
  await Promise.all([
    supabase.from("ficom_snapshots").delete().eq("period_month", pm),
    supabase.from("ficom_areas").delete().eq("period_month", pm),
    supabase.from("ficom_users").delete().eq("period_month", pm),
  ])

  const stats = calcStats(rows)
  const snapshot = {
    period_month: pm,
    period_label: `Period ${new Date(data.minDate).getMonth()+1} (${new Date(data.minDate).toLocaleDateString("en-US",{month:"long",year:"numeric"})})`,
    as_of_date:   data.maxDate,
    selling_days: data.sellingDays,
    total_users:  stats.total,
    total_trained: 0,
    total_active: stats.active,
    total_high:   stats.buckets[">75%"].count,
    total_medium: (stats.buckets["≤75%"].count + stats.buckets["≤50%"].count),
    total_low:    (stats.buckets["≤25%"].count + stats.buckets["0%"].count),
    avg_compliance: stats.avgComp,
    pct_trained:  0,
    pct_active:   stats.utilisasi,
    total_ads:    0, total_lp: 0,
    include_ads:  includeAds,
  }

  onProgress("⏳ Saving snapshot...")
  const { error: e1 } = await supabase.from("ficom_snapshots").insert([snapshot])
  if (e1) throw new Error(e1.message)

  // Areas
  const areaRows = Object.entries(stats.byAor).map(([aor, s]) => ({
    period_month: pm, aor,
    total_users: s.total, trained: 0, active: s.active,
    avg_compliance: s.avgComp,
    high_count:   rows.filter(r=>r.aor===aor&&r.compliance_pct>75).length,
    medium_count: rows.filter(r=>r.aor===aor&&r.compliance_pct>0&&r.compliance_pct<=75).length,
    low_count:    rows.filter(r=>r.aor===aor&&r.compliance_pct===0).length,
    pct_active:   s.total ? Math.round(s.active/s.total*100) : 0,
  }))
  const { error: e2 } = await supabase.from("ficom_areas").insert(areaRows)
  if (e2) throw new Error(e2.message)

  // Users in chunks
  const chunk = 200
  for (let i = 0; i < rows.length; i += chunk) {
    const { error: e3 } = await supabase.from("ficom_users").insert(rows.slice(i, i+chunk))
    if (e3) throw new Error(e3.message)
    onProgress(`⏳ Users: ${Math.min(i+chunk, rows.length)}/${rows.length}`)
  }
  onProgress(`🎉 Upload selesai! ${rows.length} user · ${pm}`)
}

// ─────────────────────────────────────────────────────────────
// ── COMPLIANCE SUMMARY COMPONENT ─────────────────────────────
// ─────────────────────────────────────────────────────────────
function ComplianceSummary({ rows, label }: { rows: UserRow[]; label: string }) {
  const stats = useMemo(() => calcStats(rows), [rows])

  const ovColor = stats.utilisasi >= 80 ? "#166534" : stats.utilisasi >= 60 ? "#92400E" : "#991B1B"
  const ovBg    = stats.utilisasi >= 80 ? "#DCFCE7" : stats.utilisasi >= 60 ? "#FEF3C7" : "#FEE2E2"

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
      {/* Hero row */}
      {/* Top stat cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"10px" }}>
        {[
          { label:"Total User",         val: stats.total,            color:"var(--text)", bg:"var(--surface2)", sub: undefined as string|undefined },
          { label:"Aktif Login",         val: stats.active,           color:"#166534",     bg:"#DCFCE7",         sub: undefined },
          { label:"Belum Pernah Login",  val: stats.never,            color:"#991B1B",     bg:"#FEE2E2",         sub: undefined },
          { label:"Utilisasi",           val:`${stats.utilisasi}%`,   color:ovColor,       bg: ovBg,             sub:"aktif / total" },
          { label:"Avg Compliance",      val:`${stats.avgComp}%`,
            color: stats.avgComp>=75?"#166534":stats.avgComp>=50?"#0369A1":stats.avgComp>=25?"#92400E":"#991B1B",
            bg:    stats.avgComp>=75?"#DCFCE7":stats.avgComp>=50?"#EFF6FF":stats.avgComp>=25?"#FEF3C7":"#FEE2E2",
            sub:"target >75%" },
        ].map(s => (
          <div key={s.label} style={{ background:s.bg, borderRadius:"10px", padding:"12px 14px" }}>
            <div style={{ fontSize:"10px", color:"var(--text3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"4px" }}>{s.label}</div>
            <div style={{ fontSize:"22px", fontWeight:900, color:s.color, letterSpacing:"-0.03em" }}>{s.val}</div>
            {s.sub && <div style={{ fontSize:"10px", color:s.color, opacity:0.7, marginTop:"2px" }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Target bar: >75% compliance */}
      {(() => {
        const above75 = rows.filter(r => r.compliance_pct > 75).length
        const pctAbove = stats.total ? Math.round(above75 / stats.total * 100) : 0
        const barColor = pctAbove >= 75 ? "#166534" : pctAbove >= 50 ? "#0369A1" : "#991B1B"
        return (
          <div style={{ background:"var(--surface2)", borderRadius:"10px", padding:"12px 16px", display:"flex", alignItems:"center", gap:"14px" }}>
            <div style={{ flexShrink:0 }}>
              <div style={{ fontSize:"10px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em" }}>Compliance &gt;75%</div>
              <div style={{ fontSize:"11px", color:"var(--text3)", marginTop:"1px" }}>bare minimum target</div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ background:"var(--surface3)", borderRadius:"99px", height:"10px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pctAbove}%`, background:barColor, borderRadius:"99px", transition:"width 0.5s ease" }}/>
              </div>
            </div>
            <div style={{ flexShrink:0, textAlign:"right" }}>
              <div style={{ fontSize:"20px", fontWeight:900, color:barColor, letterSpacing:"-0.03em" }}>{pctAbove}%</div>
              <div style={{ fontSize:"10px", color:"var(--text3)" }}>{above75}/{stats.total} user</div>
            </div>
            <div style={{ flexShrink:0, width:"1px", background:"var(--border)", height:"36px" }}/>
            <div style={{ flexShrink:0, textAlign:"right" }}>
              <div style={{ fontSize:"11px", color:"var(--text3)" }}>Belum capai target</div>
              <div style={{ fontSize:"18px", fontWeight:800, color:"#991B1B" }}>{stats.total - above75} user</div>
            </div>
          </div>
        )
      })()}

      {/* Compliance buckets table */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"10px", overflow:"hidden" }}>
        <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)", fontSize:"11px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em" }}>
          % Compliance Distribution — {label}
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ background:"var(--surface2)" }}>
              {[
                { h:"% Compliance", tip:"" },
                { h:"Jumlah User", tip:"" },
                { h:"% vs Total", tip:"Persentase jumlah user di bucket ini dari total user" },
                { h:"Avg Compliance bucket", tip:"Rata-rata compliance_pct khusus user di bucket ini (bukan avg keseluruhan)" },
              ].map(({ h, tip }) => (
                <th key={h} title={tip} style={{ padding:"8px 14px", fontSize:"10px", fontWeight:700, color:"var(--text3)", textAlign:"left", borderBottom:"1px solid var(--border)", textTransform:"uppercase", letterSpacing:"0.05em", cursor:tip?"help":"default", whiteSpace:"nowrap" }}>
                  {h}{tip && <span style={{ marginLeft:"3px", opacity:0.5 }}>ⓘ</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BUCKET_ORDER.map(b => {
              const bRows = rows.filter(r => compBucket(r.compliance_pct) === b)
              const avg   = bRows.length ? Math.round(bRows.reduce((s,r)=>s+r.compliance_pct,0)/bRows.length*10)/10 : 0
              const c     = BUCKET_CLR[b]
              return (
                <tr key={b} style={{ borderBottom:"1px solid var(--border)" }}>
                  <td style={{ padding:"9px 14px" }}>
                    <span style={{ ...c, padding:"2px 10px", borderRadius:"99px", fontSize:"11px", fontWeight:700 }}>{b}</span>
                  </td>
                  <td style={{ padding:"9px 14px", fontWeight:700, fontSize:"14px", color:"var(--text)" }}>{stats.buckets[b].count}</td>
                  <td style={{ padding:"9px 14px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                      <div style={{ width:"80px", height:"6px", background:"var(--surface3)", borderRadius:"99px", overflow:"hidden" }}>
                        <div style={{ width:`${stats.buckets[b].pct}%`, height:"100%", background:c.color, borderRadius:"99px", transition:"width 0.5s" }}/>
                      </div>
                      <span style={{ fontSize:"12px", fontWeight:700, color:c.color }}>{stats.buckets[b].pct}%</span>
                    </div>
                  </td>
                  <td style={{ padding:"9px 14px", fontSize:"12px", color:"var(--text3)" }}>{bRows.length ? `${avg}%` : "—"}</td>
                </tr>
              )
            })}
            {/* Total row */}
            <tr style={{ background:"var(--surface2)", fontWeight:700 }}>
              <td style={{ padding:"9px 14px", fontWeight:800, fontSize:"12px" }}>TOTAL</td>
              <td style={{ padding:"9px 14px", fontWeight:800, fontSize:"14px" }}>{stats.total}</td>
              <td style={{ padding:"9px 14px", fontWeight:700, fontSize:"12px" }}>100%</td>
              <td style={{ padding:"9px 14px", fontWeight:700, fontSize:"12px", color:"var(--text3)" }}>{stats.avgComp}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* AOR breakdown */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"10px", overflow:"hidden" }}>
        <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)", fontSize:"11px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.06em" }}>
          Per Area (AOR)
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"0" }}>
          {["GMA","NOL","SOL","VIS","MIN"].map((aor, i) => {
            const s = stats.byAor[aor] || { total:0, active:0, avgComp:0, never:0 }
            const util = s.total ? Math.round(s.active/s.total*100) : 0
            const clr  = AOR_CLR[aor] || "#888"
            return (
              <div key={aor} style={{ padding:"14px 16px", borderRight: i < 4 ? "1px solid var(--border)" : "none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px", marginBottom:"8px" }}>
                  <span style={{ background: clr+"20", color:clr, padding:"2px 8px", borderRadius:"99px", fontSize:"11px", fontWeight:800 }}>{aor}</span>
                </div>
                <div style={{ fontSize:"22px", fontWeight:900, color:clr, letterSpacing:"-0.03em" }}>{util}%</div>
                <div style={{ fontSize:"11px", color:"var(--text3)", marginTop:"2px" }}>utilisasi</div>
                <div style={{ marginTop:"6px", fontSize:"11px", color:"var(--text3)" }}>
                  {s.active}/{s.total} aktif · avg {s.avgComp}%
                </div>
                {s.never > 0 && (
                  <div style={{ marginTop:"3px", fontSize:"10px", color:"#991B1B", fontWeight:600 }}>⚠ {s.never} belum login</div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ── USER TABLE COMPONENT ──────────────────────────────────────
// ─────────────────────────────────────────────────────────────
function UserTable({ rows, highlightNever = false }: { rows: UserRow[]; highlightNever?: boolean }) {
  const [search,      setSearch]      = useState("")
  const [posFilter,   setPosFilter]   = useState("ALL")
  const [aorFilter,   setAorFilter]   = useState("ALL")
  const [bucketFilter,setBucketFilter]= useState("ALL")
  const [expandedAdm, setExpandedAdm] = useState<string|null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r =>
      (posFilter === "ALL" || r.position === posFilter) &&
      (aorFilter === "ALL" || r.aor === aorFilter) &&
      (bucketFilter === "ALL" || compBucket(r.compliance_pct) === bucketFilter) &&
      (!q || r.user_login.toLowerCase().includes(q) || r.sales_name.toLowerCase().includes(q))
    )
  }, [rows, search, posFilter, aorFilter, bucketFilter])

  // Group by ADM (wf_map)
  const grouped = useMemo(() => {
    const m: Record<string, { adm: UserRow|null; members: UserRow[] }> = {}
    filtered.forEach(r => {
      const key = r.wf_map || r.user_login
      if (!m[key]) m[key] = { adm: null, members: [] }
      if (r.position === "ADM" || r.position === "RDM" || r.position === "SD" || r.position === "COO") m[key].adm = r
      else m[key].members.push(r)
    })
    // Also add standalone ADM/RDM that aren't in any group
    filtered.forEach(r => {
      const key = r.wf_map || r.user_login
      if (!m[key].adm && r.position !== "ADS") m[key].adm = r
    })
    return Object.entries(m).sort(([a],[b]) => a.localeCompare(b))
  }, [filtered])

  const compColor = (p: number) => p > 75 ? "#166534" : p > 50 ? "#0369A1" : p > 25 ? "#92400E" : p > 0 ? "#C2410C" : "#991B1B"

  return (
    <div>
      {/* Filters */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"12px", flexWrap:"wrap", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"7px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"8px", padding:"7px 11px", flex:"1", minWidth:"160px" }}>
          <Search size={13} color="var(--text3)"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari WF atau nama..."
            style={{ background:"none", border:"none", outline:"none", fontSize:"12px", color:"var(--text)", width:"100%", fontFamily:"inherit" }}/>
        </div>
        <select value={posFilter} onChange={e=>setPosFilter(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:"12px", fontFamily:"inherit" }}>
          {["ALL","ADM","ADS","RDM","SD","COO"].map(p=><option key={p} value={p}>{p==="ALL"?"All Position":p==="SD"?"SD (excluded)":p==="COO"?"COO (excluded)":p}</option>)}
        </select>
        <select value={aorFilter} onChange={e=>setAorFilter(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:"12px", fontFamily:"inherit" }}>
          {["ALL","GMA","NOL","SOL","VIS","MIN"].map(a=><option key={a} value={a}>{a==="ALL"?"All AOR":a}</option>)}
        </select>
        <select value={bucketFilter} onChange={e=>setBucketFilter(e.target.value)}
          style={{ padding:"7px 10px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text)", fontSize:"12px", fontFamily:"inherit" }}>
          <option value="ALL">All Compliance</option>
          {BUCKET_ORDER.map(b=><option key={b} value={b}>{b}</option>)}
        </select>
        {highlightNever && (
          <button onClick={()=>setBucketFilter(bucketFilter==="0%"?"ALL":"0%")}
            style={{ padding:"6px 12px", borderRadius:"8px", border:"1px solid #FECACA", background: bucketFilter==="0%"?"#FEE2E2":"var(--surface)", color:"#991B1B", fontSize:"11px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
            ⚠️ Belum Login ({rows.filter(r=>r.never_login).length})
          </button>
        )}
        <span style={{ fontSize:"12px", color:"var(--text3)", marginLeft:"auto" }}>{filtered.length}/{rows.length}</span>
      </div>

      {/* Grouped table */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"12px", overflow:"hidden" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
          <thead>
            <tr style={{ background:"var(--surface2)" }}>
              {["","WF Code","Nama","Position","AOR","Usage / SD","Compliance","Last Login","Status"].map(h=>(
                <th key={h} style={{ padding:"9px 12px", fontSize:"10px", fontWeight:700, color:"var(--text3)", textAlign:"left", borderBottom:"1px solid var(--border)", textTransform:"uppercase", letterSpacing:"0.05em", whiteSpace:"nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grouped
            .filter(([, { adm }]) => !adm || !["SD","COO"].includes(adm.position))
            .map(([admKey, { adm, members }]) => {
              const isExp = expandedAdm === admKey
              const hasMembers = members.length > 0
              return (
                <>
                  {/* ADM/RDM row */}
                  {adm && (
                    <tr key={adm.user_login}
                      onClick={() => hasMembers && setExpandedAdm(isExp ? null : admKey)}
                      style={{ background: adm.never_login ? "#FFF5F5" : adm.compliance_pct>75?"#F0FDF4":"transparent", cursor: hasMembers ? "pointer" : "default", borderBottom:"1px solid var(--border)" }}
                      onMouseEnter={e => { if(hasMembers)(e.currentTarget as HTMLElement).style.background="var(--accent-muted)" }}
                      onMouseLeave={e => { if(hasMembers)(e.currentTarget as HTMLElement).style.background = adm.never_login?"#FFF5F5":adm.compliance_pct>75?"#F0FDF4":"transparent" }}>
                      <td style={{ padding:"9px 8px", width:"24px", textAlign:"center" }}>
                        {hasMembers && (isExp ? <ChevronDown size={12} color="#0891B2"/> : <ChevronRight size={12} color="var(--text3)"/>)}
                      </td>
                      <td style={{ padding:"9px 12px", fontFamily:"monospace", fontWeight:700, color:"#0369A1", fontSize:"11px" }}>{adm.user_login}</td>
                      <td style={{ padding:"9px 12px", fontWeight:700, maxWidth:"180px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{adm.sales_name}</td>
                      <td style={{ padding:"9px 12px" }}>
                        <span style={{ fontSize:"10px", fontWeight:700, background:"var(--surface3)", color:"var(--text2)", padding:"2px 7px", borderRadius:"99px" }}>{adm.position}</span>
                      </td>
                      <td style={{ padding:"9px 12px" }}>
                        <span style={{ fontSize:"10px", fontWeight:700, background:(AOR_CLR[adm.aor]||"#888")+"20", color:AOR_CLR[adm.aor]||"#888", padding:"2px 7px", borderRadius:"99px" }}>{adm.aor||"—"}</span>
                      </td>
                      <td style={{ padding:"9px 12px", fontFamily:"monospace" }}>
                        <span style={{ fontWeight:700, color: adm.usage_days>0?"var(--text)":"var(--text3)" }}>{adm.usage_days}</span>
                        <span style={{ color:"var(--text3)" }}>/{adm.selling_days}</span>
                      </td>
                      <td style={{ padding:"9px 12px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                          <div style={{ width:"50px", height:"5px", background:"var(--surface3)", borderRadius:"99px", overflow:"hidden" }}>
                            <div style={{ width:`${Math.min(adm.compliance_pct,100)}%`, height:"100%", background:compColor(adm.compliance_pct), borderRadius:"99px" }}/>
                          </div>
                          <span style={{ fontSize:"11px", fontWeight:700, color:compColor(adm.compliance_pct) }}>{adm.compliance_pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding:"9px 12px", fontSize:"11px", color:"var(--text3)", fontFamily:"monospace" }}>{adm.last_usage_date||"—"}</td>
                      <td style={{ padding:"9px 12px" }}>
                        {["SD","COO"].includes(adm.position)
                          ? <span style={{ fontSize:"10px", fontWeight:700, color:"#9CA3AF", background:"var(--surface3)", padding:"2px 8px", borderRadius:"99px" }}>— Excluded</span>
                          : adm.never_login
                          ? <span style={{ fontSize:"10px", fontWeight:700, color:"#991B1B", background:"#FEE2E2", padding:"2px 8px", borderRadius:"99px" }}>⚠ Belum Login</span>
                          : <span style={{ fontSize:"10px", color:"#166534", background:"#DCFCE7", padding:"2px 8px", borderRadius:"99px", fontWeight:700 }}>● Aktif</span>}
                      </td>
                    </tr>
                  )}

                  {/* ADS members (expanded) */}
                  {isExp && members.map(u => (
                    <tr key={u.user_login} style={{ background: u.never_login?"#FFF8F8":"var(--surface2)", borderBottom:"1px solid var(--border)" }}>
                      <td style={{ padding:"7px 8px" }}/>
                      <td style={{ padding:"7px 12px 7px 24px", fontFamily:"monospace", fontSize:"11px", color:"#7C3AED" }}>{u.user_login}</td>
                      <td style={{ padding:"7px 12px", color:"var(--text3)", maxWidth:"160px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>↳ {u.sales_name}</td>
                      <td style={{ padding:"7px 12px" }}>
                        <span style={{ fontSize:"9px", fontWeight:700, background:"#E0F2FE", color:"#0369A1", padding:"1px 6px", borderRadius:"99px" }}>{u.position}</span>
                      </td>
                      <td style={{ padding:"7px 12px", fontSize:"11px", color:"var(--text3)" }}>{u.aor}</td>
                      <td style={{ padding:"7px 12px", fontFamily:"monospace", fontSize:"11px" }}>
                        <span style={{ color: u.usage_days>0?"var(--text)":"var(--text3)" }}>{u.usage_days}</span>/{u.selling_days}
                      </td>
                      <td style={{ padding:"7px 12px" }}>
                        <span style={{ fontSize:"11px", fontWeight:700, color:compColor(u.compliance_pct) }}>{u.compliance_pct}%</span>
                      </td>
                      <td style={{ padding:"7px 12px", fontSize:"11px", color:"var(--text3)", fontFamily:"monospace" }}>{u.last_usage_date||"—"}</td>
                      <td style={{ padding:"7px 12px" }}>
                        {u.never_login
                          ? <span style={{ fontSize:"9px", color:"#991B1B" }}>⚠ Belum Login</span>
                          : <span style={{ fontSize:"9px", color:"#166534" }}>● Aktif</span>}
                      </td>
                    </tr>
                  ))}
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// ── MAIN PAGE ─────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
export default function FicomUploadPage() {
  const ediRef   = useRef<HTMLInputElement>(null)
  const [ediFile, setEdiFile]     = useState<File|null>(null)
  const [master,  setMaster]      = useState<MasterUser[]>([])
  const [parsed,  setParsed]      = useState<ParsedData|null>(null)
  const [parsing, setParsing]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress]   = useState<string[]>([])
  const [error,   setError]       = useState("")
  const [done,    setDone]        = useState(false)
  const [dupWarn, setDupWarn]     = useState("")
  const [drag,    setDrag]        = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [includeAds, setIncludeAds]       = useState(false)
  const [maxDateOverride, setMaxDateOverride] = useState("")   // "" = auto from file
  const [editMaxDate, setEditMaxDate]         = useState(false)
  const [tempMaxDate, setTempMaxDate]         = useState("")
  const [activeView, setActiveView] = useState<"summary"|"table">("summary")

  // Load master from Supabase
  useEffect(() => {
    supabase.from("utilisasi_master_users")
      .select("user_login,sales_name,position,aor,sub_aor,wf_map,is_active")
      .then(({ data }) => { if (data) setMaster(data as MasterUser[]) })
  }, [])

  const addLog = (m: string) => setProgress(p => [...p, m])

  const handleFile = useCallback(async (file: File, dateOverride?: string) => {
    setError(""); setParsed(null); setDone(false); setProgress([])
    setParsing(true)
    try {
      const data = await parseEdi(file, master, addLog, dateOverride || undefined)
      setParsed(data)
      // Dup check
      const { data: ex } = await supabase.from("ficom_snapshots")
        .select("period_month,as_of_date").eq("period_month", data.periodMonth).maybeSingle()
      if (ex) setDupWarn(`⚠️ Data ${ex.period_month} (as of ${ex.as_of_date}) sudah ada — upload akan overwrite.`)
      else setDupWarn("")
    } catch(e) { setError(e instanceof Error ? e.message : String(e)) }
    setParsing(false)
  }, [master])

  const handleUpload = async () => {
    if (!parsed) return
    setUploading(true); setProgress([]); setError(""); setDone(false)
    try {
      await uploadToSupabase(parsed, includeAds, addLog)
      setDone(true)
    } catch(e) { setError(e instanceof Error ? e.message : String(e)) }
    setUploading(false)
  }

  const reset = () => { setEdiFile(null); setParsed(null); setProgress([]); setError(""); setDone(false); setDupWarn("") }

  const displayRows = parsed ? (includeAds ? parsed.users : parsed.usersNoAds) : []

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px", padding:"0" }}>
      <MotivationBanner page="docreq" />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
        <div style={{ width:"38px", height:"38px", borderRadius:"10px", background:"linear-gradient(135deg,#FB8C00,#FFB74D)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <FileSpreadsheet size={20} color="white"/>
        </div>
        <div>
          <h1 style={{ fontSize:"20px", fontWeight:800, color:"var(--text)", margin:0 }}>Ficom Upload</h1>
          <p style={{ fontSize:"12px", color:"var(--text3)", margin:0 }}>Upload EDI Log Activity → hitung utilisasi & compliance ADM/RDM</p>
        </div>
      </div>

      {/* Info card */}
      <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", borderRadius:"10px", padding:"12px 16px" }}>
        <div style={{ fontSize:"11px", fontWeight:700, color:"#166534", marginBottom:"6px" }}>ℹ️ Cara hitung utilisasi Ficom</div>
        <div style={{ fontSize:"11px", color:"#14532D", lineHeight:1.8 }}>
          <strong>Denominator</strong> = ADM + RDM aktif dari master (dapat toggle include/exclude ADS) &nbsp;·&nbsp;
          <strong>Selling Days</strong> = BD kalender resmi PH dari tanggal 1 s/d <em>max date di file EDI</em> &nbsp;·&nbsp;
          <strong>Compliance</strong> = usage_days ÷ selling_days × 100
        </div>
        {master.length > 0 && (
          <div style={{ marginTop:"8px", display:"flex", gap:"10px", flexWrap:"wrap" }}>
            {[
              { label:"ADM",    count: master.filter(u=>u.position==="ADM"&&u.is_active).length, color:"#7C3AED" },
              { label:"RDM",    count: master.filter(u=>u.position==="RDM"&&u.is_active).length, color:"#92400E" },
              { label:"ADS",    count: master.filter(u=>u.position==="ADS"&&u.is_active).length, color:"#0369A1" },
              { label:"SD/COO ✗", count: master.filter(u=>["SD","COO"].includes(u.position)&&u.is_active).length, color:"#9CA3AF" },
            ].map(s => (
              <span key={s.label} style={{ fontSize:"11px", fontWeight:700, color:s.color, background:s.color+"15", padding:"2px 10px", borderRadius:"99px" }}>
                {s.label}: {s.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Upload button + file chip */}
      <div style={{ display:"flex", alignItems:"center", gap:"12px", flexWrap:"wrap" }}>
        <button onClick={() => setUploadOpen(true)}
          style={{ display:"flex", alignItems:"center", gap:"8px", padding:"10px 20px", borderRadius:"9px", border:"none", background:"#FB8C00", color:"white", fontSize:"13px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
          <Upload size={14}/> Upload EDI Log Activity
        </button>
        {ediFile && (
          <div style={{ display:"flex", alignItems:"center", gap:"8px", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"8px", padding:"7px 12px" }}>
            <FileSpreadsheet size={14} color="#FB8C00"/>
            <span style={{ fontSize:"12px", fontWeight:600, color:"var(--text)", maxWidth:"260px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{ediFile.name}</span>
            <button onClick={reset} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", padding:"0 0 0 4px", fontSize:"16px", lineHeight:1 }}>×</button>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {uploadOpen && (
        <div onClick={e => { if(e.target===e.currentTarget) setUploadOpen(false) }}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(3px)" }}>
          <div style={{ background:"var(--surface)", borderRadius:"16px", padding:"28px", width:"440px", maxWidth:"90vw", boxShadow:"0 20px 60px rgba(0,0,0,0.3)", border:"1px solid var(--border)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"18px" }}>
              <div>
                <div style={{ fontSize:"17px", fontWeight:800, color:"var(--text)" }}>Upload EDI Log Activity</div>
                <div style={{ fontSize:"12px", color:"var(--text3)", marginTop:"2px" }}>CSV pipe-delimited · kolom username = WFxxxx</div>
              </div>
              <button onClick={() => setUploadOpen(false)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", fontSize:"22px", lineHeight:1, padding:"0 4px" }}>×</button>
            </div>
            <input ref={ediRef} type="file" accept=".csv,.xlsx,.xls" style={{ display:"none" }}
              onChange={e => { const f=e.target.files?.[0]; if(f){setEdiFile(f);handleFile(f);setUploadOpen(false);e.target.value=""} }}/>
            <div
              onDrop={e => { e.preventDefault(); setDrag(false); const f=e.dataTransfer.files[0]; if(f){setEdiFile(f);handleFile(f);setUploadOpen(false)} }}
              onDragOver={e => { e.preventDefault(); setDrag(true) }}
              onDragLeave={() => setDrag(false)}
              onClick={() => ediRef.current?.click()}
              style={{ border:`2px dashed ${drag?"#FB8C00":"var(--border)"}`, borderRadius:"12px", padding:"36px 20px", textAlign:"center", cursor:"pointer", background:drag?"rgba(251,140,0,0.05)":"var(--surface2)", transition:"all 0.15s", marginBottom:"14px" }}>
              <Upload size={32} color="#FB8C00" style={{ margin:"0 auto 12px" }}/>
              <div style={{ fontSize:"13px", fontWeight:700, color:"var(--text)", marginBottom:"4px" }}>Klik atau drop file EDI di sini</div>
              <div style={{ fontSize:"11px", color:"var(--text3)" }}>EDI_Log_Activity_Detail_brt.csv</div>
            </div>
            <div style={{ fontSize:"11px", color:"var(--text3)", background:"var(--surface2)", borderRadius:"8px", padding:"10px 12px" }}>
              ℹ️ Selling days dihitung otomatis dari tanggal 1 s/d <strong>max date di file</strong> menggunakan kalender BD resmi PH 2026.
            </div>
          </div>
        </div>
      )}

      {/* Parsing progress */}
      {parsing && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"10px", padding:"14px 16px", display:"flex", alignItems:"center", gap:"12px" }}>
          <RefreshCw size={16} color="var(--accent)" style={{ animation:"spin 1s linear infinite", flexShrink:0 }}/>
          <div style={{ fontSize:"13px", fontWeight:600 }}>Memproses...</div>
          <div style={{ marginLeft:"auto", display:"flex", flexDirection:"column", gap:"3px" }}>
            {progress.slice(-3).map((p,i) => <div key={i} style={{ fontSize:"11px", color:"var(--text3)" }}>{p}</div>)}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background:"#FEE2E2", border:"1px solid #FECACA", borderRadius:"9px", padding:"10px 14px", fontSize:"12px", color:"#991B1B", display:"flex", gap:"8px" }}>
          <AlertCircle size={14} style={{ flexShrink:0, marginTop:"1px" }}/>{error}
        </div>
      )}
      {dupWarn && (
        <div style={{ background:"#FFFBEB", border:"1.5px solid #FDE68A", borderRadius:"10px", padding:"12px 16px", fontSize:"12px", color:"#92400E", display:"flex", gap:"10px" }}>
          <TriangleAlert size={16} color="#F59E0B" style={{ flexShrink:0 }}/>{dupWarn}
        </div>
      )}

      {/* Preview + controls */}
      {parsed && !done && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"12px", padding:"18px" }}>
          {/* Meta info */}
          <div style={{ display:"flex", gap:"10px", marginBottom:"16px", flexWrap:"wrap", alignItems:"center" }}>
            <div style={{ fontSize:"14px", fontWeight:800, color:"var(--text)" }}>📊 Preview Hasil Parse</div>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center" }}>
              {[
                { l:"Period",       v: parsed.periodMonth },
                { l:"As of",        v: parsed.maxDate },
                { l:"Selling Days", v: `${parsed.sellingDays} BD` },
              ].map(s => (
                <span key={s.l} style={{ fontSize:"11px", background:"var(--surface2)", padding:"3px 10px", borderRadius:"99px", color:"var(--text3)" }}>
                  {s.l}: <strong style={{ color:"var(--text)" }}>{s.v}</strong>
                </span>
              ))}
              <span title="Selling days = BD dari tgl 1 s/d max date file. Makin baru data diupload, denominator makin besar. User yang tidak login di hari-hari baru akan turun bucket-nya — ini normal & benar secara matematis."
                style={{ fontSize:"10px", color:"#0369A1", background:"#EFF6FF", border:"1px solid #BFDBFE", padding:"2px 8px", borderRadius:"99px", cursor:"help" }}>
                ⓘ Selling days bertambah setiap upload baru
              </span>

              {/* Max date override */}
              <div style={{ display:"flex", alignItems:"center", gap:"6px", background:"var(--surface2)", border:`1.5px solid ${maxDateOverride?"#FB8C00":"var(--border)"}`, borderRadius:"8px", padding:"4px 10px" }}>
                <span style={{ fontSize:"10px", color:"var(--text3)", fontWeight:600 }}>Max date:</span>
                {editMaxDate ? (
                  <input type="date" value={tempMaxDate} autoFocus
                    min={parsed.minDate} max={`${parsed.periodMonth}-31`}
                    onChange={e => setTempMaxDate(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        setMaxDateOverride(tempMaxDate)
                        setEditMaxDate(false)
                        if (ediFile) handleFile(ediFile, tempMaxDate)
                      }
                      if (e.key === "Escape") setEditMaxDate(false)
                    }}
                    style={{ border:"none", outline:"none", fontSize:"11px", fontWeight:700, color:"#FB8C00", background:"transparent", fontFamily:"inherit", width:"110px" }} />
                ) : (
                  <span style={{ fontSize:"11px", fontWeight:700, color: maxDateOverride?"#FB8C00":"var(--text3)" }}>
                    {maxDateOverride || parsed.maxDate}
                    {maxDateOverride && <span style={{ fontSize:"9px", color:"#FB8C00", marginLeft:"3px" }}>(manual)</span>}
                  </span>
                )}
                <button
                  onClick={() => {
                    if (editMaxDate) {
                      setMaxDateOverride(tempMaxDate)
                      setEditMaxDate(false)
                      if (ediFile) handleFile(ediFile, tempMaxDate)
                    } else {
                      setTempMaxDate(maxDateOverride || parsed.maxDate)
                      setEditMaxDate(true)
                    }
                  }}
                  style={{ background:"none", border:"none", cursor:"pointer", color: editMaxDate?"#166534":"var(--text3)", display:"flex", padding:"0 2px" }}>
                  {editMaxDate
                    ? <span style={{ fontSize:"14px", color:"#166534", fontWeight:700 }}>✓</span>
                    : <span style={{ fontSize:"12px" }}>✏️</span>}
                </button>
                {maxDateOverride && (
                  <button onClick={() => { setMaxDateOverride(""); if(ediFile) handleFile(ediFile, "") }}
                    style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", padding:"0", fontSize:"14px", lineHeight:1 }}>×</button>
                )}
              </div>
            </div>

            {/* ADS Toggle */}
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:"8px", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:"8px", padding:"6px 12px" }}>
              <span style={{ fontSize:"11px", color:"var(--text3)", fontWeight:600 }}>Include ADS:</span>
              <button onClick={() => setIncludeAds(v => !v)}
                style={{ width:"36px", height:"20px", borderRadius:"99px", border:"none", cursor:"pointer", background:includeAds?"#0891B2":"var(--surface3)", position:"relative", transition:"background 0.2s" }}>
                <div style={{ position:"absolute", top:"2px", left: includeAds?"18px":"2px", width:"16px", height:"16px", borderRadius:"50%", background:"white", transition:"left 0.2s" }}/>
              </button>
              <span style={{ fontSize:"11px", fontWeight:700, color:includeAds?"#0891B2":"var(--text3)" }}>
                {includeAds ? `Ya (${parsed.users.length})` : `Tidak (${parsed.usersNoAds.length})`}
              </span>
            </div>
          </div>

          {/* View toggle */}
          <div style={{ display:"flex", gap:"4px", marginBottom:"16px", background:"var(--surface2)", borderRadius:"8px", padding:"3px", width:"fit-content", border:"1px solid var(--border)" }}>
            {([["summary","📊 Summary"],["table","📋 Detail"]] as const).map(([key, label]) => (
              <button key={key} onClick={() => setActiveView(key)}
                style={{ padding:"6px 16px", borderRadius:"6px", border:"none", cursor:"pointer", fontSize:"12px", fontWeight:700, fontFamily:"inherit", background:activeView===key?"white":"transparent", color:activeView===key?"var(--text)":"var(--text3)", boxShadow:activeView===key?"0 1px 3px rgba(0,0,0,0.1)":"none", transition:"all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>

          {activeView === "summary" && (
            <ComplianceSummary rows={displayRows} label={includeAds?"(Include ADS)":"(Exclude ADS)"} />
          )}
          {activeView === "table" && (
            <UserTable rows={displayRows} highlightNever />
          )}

          {/* Action buttons */}
          <div style={{ display:"flex", gap:"10px", marginTop:"18px" }}>
            <button onClick={handleUpload} disabled={uploading}
              style={{ display:"flex", alignItems:"center", gap:"6px", padding:"10px 22px", borderRadius:"9px", border:"none", background:uploading?"#94A3B8":"#166534", color:"white", fontSize:"13px", fontWeight:700, cursor:uploading?"not-allowed":"pointer", fontFamily:"inherit" }}>
              {uploading ? <><RefreshCw size={14} style={{ animation:"spin 1s linear infinite" }}/> Uploading...</> : <><Upload size={14}/> Upload ke Supabase {dupWarn?"(Overwrite)":""}</>}
            </button>
            <button onClick={reset}
              style={{ display:"flex", alignItems:"center", gap:"6px", padding:"10px 16px", borderRadius:"9px", border:"1px solid var(--border)", background:"var(--surface2)", color:"var(--text3)", fontSize:"13px", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              <Trash2 size={14}/> Reset
            </button>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {progress.length > 0 && !parsing && (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:"10px", padding:"14px 16px" }}>
          <div style={{ fontWeight:700, fontSize:"13px", marginBottom:"10px" }}>Progress Upload</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
            {progress.map((p,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"12px", color:p.startsWith("✅")||p.startsWith("🎉")?"#166534":p.startsWith("❌")?"#991B1B":"var(--text2)" }}>
                {p.startsWith("✅")||p.startsWith("🎉")?<CheckCircle size={12} color="#166534"/>:<RefreshCw size={12} style={{ animation:"spin 1s linear infinite" }}/>}{p}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success */}
      {done && (
        <div style={{ background:"#DCFCE7", border:"1px solid #BBF7D0", borderRadius:"12px", padding:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <CheckCircle size={24} color="#166534"/>
            <div>
              <div style={{ fontWeight:800, fontSize:"15px", color:"#166534" }}>Upload berhasil! 🎉</div>
              <div style={{ fontSize:"12px", color:"#14532D", marginTop:2 }}>
                {parsed?.periodMonth} · {parsed?.sellingDays} hari jual · as of {parsed?.maxDate}
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:"10px", marginTop:"14px" }}>
            <a href="/landing/ficom" target="_blank">
              <button style={{ display:"flex", alignItems:"center", gap:"6px", padding:"9px 16px", borderRadius:"8px", border:"none", background:"#166534", color:"white", fontSize:"12px", fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                <Eye size={13}/> Preview Landing
              </button>
            </a>
            <button onClick={reset}
              style={{ padding:"9px 16px", borderRadius:"8px", border:"1px solid var(--border)", background:"var(--surface)", color:"var(--text3)", fontSize:"12px", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              Upload Periode Baru
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}