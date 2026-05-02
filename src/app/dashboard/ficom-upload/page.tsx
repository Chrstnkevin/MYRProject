// PATH: src/app/dashboard/ficom-upload/page.tsx
// Also add "ficom-upload" route to your dashboard sidebar/nav

"use client"
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Upload, CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet, Eye, Trash2, Search, ChevronDown, TriangleAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Types ─────────────────────────────────────────────────────
interface ParsedFicomData {
  snapshot: SnapshotRow
  areas: AreaRow[]
  users: UserRow[]
  summary: {
    period_label: string
    period_month: string
    as_of_date: string
    selling_days: number
    total_users: number
    total_trained: number
  }
}

interface SnapshotRow {
  period_label: string; period_month: string; as_of_date: string; selling_days: number
  total_users: number; total_trained: number; total_active: number
  total_high: number; total_medium: number; total_low: number
  avg_compliance: number; pct_trained: number; pct_active: number
  total_ads: number; total_lp: number  // from m_master
}

interface AreaRow {
  period_month: string; aor: string; total_users: number; trained: number; active: number
  avg_compliance: number; high_count: number; medium_count: number; low_count: number; pct_active: number
}

interface UserRow {
  period_month: string; user_id: string; username: string; position: string
  aor: string; sub_aor: string; rdm_name: string
  usage_days: number; selling_days: number; compliance_pct: number
  last_usage_date: string | null; trained: number; training_date: string | null
  activity_count?: number; master_name?: string; master_position?: string
}

// ── Parsers ────────────────────────────────────────────────────
// LOGIC BARU:
// - Denominator = master PERMANEN dari utilisasi_master_users (ADM + RDM saja)
// - Numerator   = WF yang muncul di EDI Log Activity (aktif login)
// - Compliance  = usage_days / selling_days
// - Supports: CSV pipe-delimited (EDI_Log_Activity_Detail_brt.csv) OR XLSX
async function parseFicomExcels(
  ediFile: File,
  onProgress: (msg: string) => void,
  masterFile?: File | null   // optional m_master for ADS/LP count only
): Promise<ParsedFicomData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (await import("xlsx")) as any

  const fmtDate = (v: unknown): string | null => {
    if (!v) return null
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().split("T")[0]
    const strVal = String(v).trim()
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(strVal)) {
      const [dd, mm, yyyy] = strVal.split("/")
      return `${yyyy}-${mm}-${dd}`
    }
    const d = new Date(strVal)
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0]
  }
  const s = (v: unknown) => String(v || "").trim()

  // ── 1. Load MASTER from Supabase (ADM + RDM only — ADS tidak bisa akses Ficom) ──
  onProgress("⏳ Loading master users from Supabase (ADM + RDM)...")
  const { data: masterData, error: masterErr } = await supabase
    .from("utilisasi_master_users")
    .select("user_login, sales_name, position, is_active")
    .in("position", ["ADM", "RDM"])
  if (masterErr) throw new Error(`Master load error: ${masterErr.message}`)

  const masterMap = new Map<string, { name: string; position: string; is_active: boolean }>()
  for (const u of masterData ?? []) {
    masterMap.set(u.user_login.toUpperCase(), {
      name: u.sales_name, position: u.position, is_active: u.is_active
    })
  }
  const masterActive = [...masterMap.values()].filter(u => u.is_active)
  onProgress(`✅ Master: ${masterActive.length} active ADM/RDM (denominator utilisasi Ficom)`)

  // ── 2. Parse EDI — detect format ──
  onProgress("⏳ Reading EDI Log Activity...")

  // userActivity: user_login -> { dates: Set<string>, aor, sub_aor, rdm_name }
  const userActivity = new Map<string, {
    dates: Set<string>; aor: string; sub_aor: string; rdm_name: string
  }>()
  const allDates: string[] = []

  const isCsv = ediFile.name.toLowerCase().endsWith(".csv")

  if (isCsv) {
    // CSV: aplikasi|modul|tanggal|waktu|username|nama_user|emp_type_id|...|grsm_nm|nsm_id|nsm_nm
    // idx:  0      | 1   | 2     | 3   | 4      | 5       | 6         |...|12     |13    |14
    const text = await ediFile.text()
    const lines = text.split("\n")
    const delim = lines[0]?.includes("|") ? "|" : ","

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].trim().split(delim)
      if (cols.length < 5) continue
      const uid    = cols[4]?.replace(/"/g, "").trim().toUpperCase()
      const dtRaw  = cols[2]?.replace(/"/g, "").trim()
      const grsmNm = cols[12]?.replace(/"/g, "").trim() ?? ""
      if (!uid?.startsWith("WF")) continue
      const dt  = fmtDate(dtRaw)
      const aor = getAreaFromName(grsmNm)
      if (!userActivity.has(uid)) userActivity.set(uid, { dates: new Set(), aor, sub_aor: "", rdm_name: grsmNm })
      if (dt) { userActivity.get(uid)!.dates.add(dt); allDates.push(dt) }
    }
  } else {
    // XLSX: columns "User ID", "Date of Usage", "AOR", "SUB-AOR", "RDM"
    const ediBuf = await ediFile.arrayBuffer()
    const ediWb  = XLSX.read(ediBuf, { type: "array", cellDates: true })
    const ediWs  = ediWb.Sheets[ediWb.SheetNames.includes("Sheet1") ? "Sheet1" : ediWb.SheetNames[0]]
    const ediRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ediWs, { raw: false, dateNF: "yyyy-mm-dd" })
    for (const r of ediRows) {
      const uid = s(r["User ID"]).toUpperCase()
      const dt  = fmtDate(r["Date of Usage"])
      const aor = s(r["AOR"])
      if (!uid) continue
      if (!userActivity.has(uid)) userActivity.set(uid, { dates: new Set(), aor, sub_aor: s(r["SUB-AOR"]), rdm_name: s(r["RDM"]) })
      if (dt) { userActivity.get(uid)!.dates.add(dt); allDates.push(dt) }
    }
  }

  if (allDates.length === 0) throw new Error("Tidak ada data usage ditemukan di file EDI")

  // ── 3. Period metadata ──
  const sortedDates = [...new Set(allDates)].sort()
  const minDate = sortedDates[0], maxDate = sortedDates[sortedDates.length - 1]
  const periodMonth = minDate.slice(0, 7)

  let sellingDays = 0
  const cur = new Date(minDate)
  while (cur <= new Date(maxDate)) { if (cur.getDay() !== 0) sellingDays++; cur.setDate(cur.getDate() + 1) }

  const periodD = new Date(minDate)
  const periodLabel = `Period ${periodD.getMonth() + 1} (${periodD.toLocaleDateString("en-US", { month: "long", year: "numeric" })})`
  onProgress(`✅ EDI: ${userActivity.size} unique users · ${sellingDays} selling days · ${periodLabel}`)

  // ── 4. m_master optional (for ADS/LP count in hero) ──
  let totalAds = 0, totalLp = 0
  if (masterFile) {
    onProgress("⏳ Reading m_master...")
    const mBuf = await masterFile.arrayBuffer()
    const mWb  = XLSX.read(mBuf, { type: "array" })
    const mWs  = mWb.Sheets[mWb.SheetNames[0]]
    const mRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(mWs, { raw: false })
    for (const r of mRows) {
      const t = s(r["Type"])
      if (t === "ADS") totalAds++
      else if (t === "LP") totalLp++
    }
  }

  // ── 5. Build UserRows from MASTER (ADM+RDM) ──
  // Every master user gets a row; EDI provides compliance data
  const VALID_AORS = new Set(["GMA", "MIN", "NOL", "SOL", "VIS"])
  const users: UserRow[] = []
  const aorAgg: Record<string, { users: UserRow[] }> = {}

  for (const [uid, master] of masterMap.entries()) {
    if (!master.is_active) continue  // skip Vacant

    const ediInfo   = userActivity.get(uid)
    const usageDays = ediInfo ? ediInfo.dates.size : 0
    const compliance = sellingDays > 0 ? Math.round(usageDays / sellingDays * 1000) / 10 : 0
    const lastDate  = ediInfo?.dates.size ? [...ediInfo.dates].sort().pop()! : null
    const aor       = ediInfo?.aor && VALID_AORS.has(ediInfo.aor) ? ediInfo.aor : "UNK"

    const row: UserRow = {
      period_month: periodMonth,
      user_id:      uid,
      username:     master.name || uid,
      position:     master.position,
      aor,
      sub_aor:      ediInfo?.sub_aor || "",
      rdm_name:     ediInfo?.rdm_name || "",
      usage_days:   usageDays,
      selling_days: sellingDays,
      compliance_pct: compliance,
      last_usage_date: lastDate,
      trained:      0,  // training removed from new logic
      training_date: null,
      // extra fields for master enrichment
      activity_count: usageDays,
      master_name:    master.name,
      master_position: master.position,
    }
    users.push(row)

    if (VALID_AORS.has(aor)) {
      if (!aorAgg[aor]) aorAgg[aor] = { users: [] }
      aorAgg[aor].users.push(row)
    }
  }

  // ── 6. AreaRows ──
  const areas: AreaRow[] = Object.entries(aorAgg).map(([aor, { users: au }]) => ({
    period_month: periodMonth, aor,
    total_users:  au.length,
    trained:      0,
    active:       au.filter(u => u.usage_days > 0).length,
    avg_compliance: au.length ? Math.round(au.reduce((s, u) => s + u.compliance_pct, 0) / au.length * 10) / 10 : 0,
    high_count:   au.filter(u => u.compliance_pct >= 91).length,
    medium_count: au.filter(u => u.compliance_pct >= 51 && u.compliance_pct < 91).length,
    low_count:    au.filter(u => u.compliance_pct < 51).length,
    pct_active:   au.length ? Math.round(au.filter(u => u.usage_days > 0).length / au.length * 1000) / 10 : 0,
  }))

  // ── 7. Snapshot ──
  const totalUsers    = users.length
  const totalActive   = users.filter(u => u.usage_days > 0).length
  const avgCompliance = totalUsers ? Math.round(users.reduce((s, u) => s + u.compliance_pct, 0) / totalUsers * 10) / 10 : 0

  const snapshot: SnapshotRow = {
    period_label: periodLabel, period_month: periodMonth, as_of_date: maxDate,
    selling_days: sellingDays, total_users: totalUsers, total_trained: 0,
    total_active: totalActive,
    total_high:   users.filter(u => u.compliance_pct >= 91).length,
    total_medium: users.filter(u => u.compliance_pct >= 51 && u.compliance_pct < 91).length,
    total_low:    users.filter(u => u.compliance_pct < 51).length,
    avg_compliance: avgCompliance,
    pct_trained:  0,
    pct_active:   totalUsers ? Math.round(totalActive / totalUsers * 1000) / 10 : 0,
    total_ads: totalAds, total_lp: totalLp,
  }

  return {
    snapshot, areas, users,
    summary: { period_label: periodLabel, period_month: periodMonth, as_of_date: maxDate, selling_days: sellingDays, total_users: totalUsers, total_trained: 0 }
  }
}

function getAreaFromName(nm: string): string {
  const g = nm.toUpperCase()
  if (["EVIS","WVIS","CVIS","VIS"].some(x => g.includes(x))) return "VIS"
  if (["USOL","MSOL","LSOL","SOL"].some(x => g.includes(x))) return "SOL"
  if (["WNOL","CNOL","ENOL","NOL"].some(x => g.includes(x))) return "NOL"
  if (["NMIN","SMIN","WMIN","MIN"].some(x => g.includes(x))) return "MIN"
  if (["EGMA","SGMA","NGMA","GMA"].some(x => g.includes(x))) return "GMA"
  return "UNK"
}

// ── Upload to Supabase ─────────────────────────────────────────
async function uploadFicomToSupabase(data: ParsedFicomData, onProgress: (msg: string) => void) {
  const { snapshot, areas, users, summary } = data
  const pm = summary.period_month

  // 1. Upsert snapshot
  onProgress("⏳ Uploading snapshot...")
  const { error: e1 } = await supabase.from("ficom_snapshots").upsert([snapshot], { onConflict: "period_month" })
  if (e1) throw new Error(`Snapshot error: ${e1.message}`)
  onProgress(`✅ Snapshot: ${pm}`)

  // 2. Replace areas
  onProgress("⏳ Clearing old area data...")
  await supabase.from("ficom_areas").delete().eq("period_month", pm)
  const { error: e2 } = await supabase.from("ficom_areas").insert(areas)
  if (e2) throw new Error(`Areas error: ${e2.message}`)
  onProgress(`✅ Areas: ${areas.length} records`)

  // 3. Replace users (in chunks)
  onProgress("⏳ Clearing old user data...")
  await supabase.from("ficom_users").delete().eq("period_month", pm)
  const chunkSize = 200
  for (let i = 0; i < users.length; i += chunkSize) {
    const { error: e3 } = await supabase.from("ficom_users").insert(users.slice(i, i + chunkSize))
    if (e3) throw new Error(`Users error: ${e3.message}`)
    onProgress(`⏳ Users: ${Math.min(i + chunkSize, users.length)}/${users.length}`)
  }
  onProgress(`✅ Users: ${users.length} records`)
  onProgress("🎉 All Ficom data uploaded successfully!")
}

// ── Ficom Data Viewer ──────────────────────────────────────────
function FicomDataViewer({ refreshKey }: { refreshKey: number }) {
  const [periods, setPeriods]     = useState<string[]>([])
  const [selPeriod, setSelPeriod] = useState("")
  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [search, setSearch]       = useState("")
  const [posFilter, setPosFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [deleting, setDeleting]   = useState<string | null>(null)

  // Load available periods
  useEffect(() => {
    supabase.from("ficom_snapshots").select("period_month, period_label").order("period_month", { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          const opts = data.map(d => d.period_month as string)
          setPeriods(opts)
          setSelPeriod(opts[0])
        }
      })
  }, [refreshKey])

  // Load users for selected period
  useEffect(() => {
    if (!selPeriod) return
    setLoading(true)
    supabase.from("ficom_users").select("*").eq("period_month", selPeriod).order("aor").order("username")
      .then(({ data }) => { setUsers((data ?? []) as UserRow[]); setLoading(false) })
  }, [selPeriod])

  const filtered = useMemo(() => users.filter(u => {
    const q = search.toLowerCase()
    const mQ = !q || u.user_id.toLowerCase().includes(q) || u.username.toLowerCase().includes(q)
    const mP = posFilter === "ALL" || u.position === posFilter
    const mS = statusFilter === "ALL" || (statusFilter === "ACTIVE" ? u.usage_days > 0 : u.usage_days === 0)
    return mQ && mP && mS
  }), [users, search, posFilter, statusFilter])

  const deleteUser = async (userId: string) => {
    if (!confirm(`Hapus user ${userId} dari periode ${selPeriod}?`)) return
    setDeleting(userId)
    await supabase.from("ficom_users").delete().eq("period_month", selPeriod).eq("user_id", userId)
    setUsers(p => p.filter(u => u.user_id !== userId))
    setDeleting(null)
  }

  const deletePeriod = async () => {
    if (!confirm(`Hapus SEMUA data periode ${selPeriod}? Ini juga akan hapus snapshot & area data.`)) return
    await Promise.all([
      supabase.from("ficom_users").delete().eq("period_month", selPeriod),
      supabase.from("ficom_areas").delete().eq("period_month", selPeriod),
      supabase.from("ficom_snapshots").delete().eq("period_month", selPeriod),
    ])
    setPeriods(p => p.filter(x => x !== selPeriod))
    setUsers([])
    setSelPeriod(prev => periods.find(p => p !== prev) ?? "")
  }

  const activeCount = users.filter(u => u.usage_days > 0).length
  const utilisasi = users.length ? Math.round(activeCount / users.length * 100) : 0
  const AOR_COLORS: Record<string,string> = { GMA:"#F97316",MIN:"#3B82F6",NOL:"#22C55E",SOL:"#EF4444",VIS:"#A855F7" }
  const compColor = (p: number) => p >= 91 ? "#22C55E" : p >= 51 ? "#F97316" : "#EF4444"

  if (!periods.length) return (
    <div className="card" style={{ padding: "24px", textAlign: "center", color: "var(--text3)" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📭</div>
      <div style={{ fontWeight: 600 }}>Belum ada data tersimpan</div>
      <div style={{ fontSize: 12, marginTop: 4 }}>Upload EDI di atas untuk mulai menyimpan data</div>
    </div>
  )

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border)", background: "var(--surface)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text)" }}>📋 Data Tersimpan — Ficom</div>

        {/* Period selector */}
        <div style={{ position: "relative" }}>
          <select value={selPeriod} onChange={e => setSelPeriod(e.target.value)}
            className="input" style={{ fontSize: 12, paddingRight: 28, width: "auto", minWidth: 140 }}>
            {periods.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Summary pills */}
        {!loading && users.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: "#FFF3E0", color: "#FB8C00" }}>
              {activeCount}/{users.length} aktif
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: utilisasi >= 80 ? "#ECFDF5" : utilisasi >= 60 ? "#FEF3C7" : "#FEF2F2", color: utilisasi >= 80 ? "#16a34a" : utilisasi >= 60 ? "#92400E" : "#dc2626" }}>
              {utilisasi}% utilisasi
            </span>
          </div>
        )}

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={12} style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }} />
            <input className="input" placeholder="Search WF / name…" value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 26, fontSize: 11, width: 160 }} />
          </div>
          <select className="input" style={{ fontSize: 11, width: "auto" }} value={posFilter} onChange={e => setPosFilter(e.target.value)}>
            <option value="ALL">All Position</option>
            {["ADM","ADS","RDM"].map(p => <option key={p}>{p}</option>)}
          </select>
          <select className="input" style={{ fontSize: 11, width: "auto" }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Tidak Aktif</option>
          </select>
          <button onClick={deletePeriod}
            style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "5px 12px", cursor: "pointer", color: "#dc2626", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
            <Trash2 size={12} /> Hapus Periode
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
            <tr style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}>
              {["No","User ID","Username","Position","AOR","Usage Days","Selling Days","Compliance","Status",""].map(h => (
                <th key={h} style={{ padding: "8px 11px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.07em", whiteSpace: "nowrap" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ padding: "32px", textAlign: "center", color: "var(--text3)" }}>
                <RefreshCw size={16} style={{ animation: "spin 1s linear infinite", display: "inline", marginRight: 8 }} />Loading…
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} style={{ padding: "24px", textAlign: "center", color: "var(--text3)" }}>No data found</td></tr>
            ) : filtered.map((u, i) => {
              const aorCol = AOR_COLORS[u.aor] ?? "#888"
              const cp     = u.compliance_pct
              return (
                <tr key={u.user_id} style={{ borderBottom: "1px solid var(--border)", background: u.usage_days > 0 ? "transparent" : "var(--surface2)" }}>
                  <td style={{ padding: "8px 11px", color: "var(--text3)", fontSize: 11 }}>{i + 1}</td>
                  <td style={{ padding: "8px 11px", fontFamily: "monospace", fontWeight: 700, color: "var(--accent)", fontSize: 11 }}>{u.user_id}</td>
                  <td style={{ padding: "8px 11px", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username}</td>
                  <td style={{ padding: "8px 11px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "var(--surface3)", color: "var(--text2)" }}>{u.position}</span>
                  </td>
                  <td style={{ padding: "8px 11px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: `${aorCol}18`, color: aorCol }}>{u.aor || "—"}</span>
                  </td>
                  <td style={{ padding: "8px 11px", fontWeight: 700, color: u.usage_days > 0 ? "var(--text)" : "var(--text3)" }}>{u.usage_days}</td>
                  <td style={{ padding: "8px 11px", color: "var(--text3)" }}>{u.selling_days}</td>
                  <td style={{ padding: "8px 11px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 40, height: 5, background: "var(--surface3)", borderRadius: 99, overflow: "hidden", flexShrink: 0 }}>
                        <div style={{ height: "100%", width: `${Math.min(cp, 100)}%`, background: compColor(cp), borderRadius: 99 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: compColor(cp) }}>{cp}%</span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 11px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: u.usage_days > 0 ? "#16a34a" : "#9CA3AF" }}>
                      {u.usage_days > 0 ? "● Aktif" : "○ Tidak Aktif"}
                    </span>
                  </td>
                  <td style={{ padding: "8px 11px" }}>
                    <button onClick={() => deleteUser(u.user_id)} disabled={deleting === u.user_id}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", opacity: deleting === u.user_id ? 0.5 : 0.6, padding: "3px 6px", borderRadius: 6 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"} onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", fontSize: 11, color: "var(--text3)", display: "flex", justifyContent: "space-between" }}>
        <span>Showing {filtered.length} of {users.length} users</span>
        <span style={{ color: "var(--text3)" }}>Period: {selPeriod}</span>
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function FicomUploadPage() {
  const ediRef = useRef<HTMLInputElement>(null)
  const [ediFile,    setEdiFile]    = useState<File | null>(null)
  const [masterFile, setMasterFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<ParsedFicomData | null>(null)
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [dragOverEdi, setDragOverEdi] = useState(false)
  const [dupWarning, setDupWarning] = useState("")   // ← duplicate warning
  const [viewerKey, setViewerKey]   = useState(0)   // ← refresh viewer after upload

  const handleFiles = useCallback(async (edi: File, master?: File | null) => {
    setError(""); setParsed(null); setDone(false); setProgress([])
    setParsing(true)
    try {
      const data = await parseFicomExcels(edi, msg => setProgress(p => [...p, msg]), master)
      setParsed(data)

      // ── Duplicate check ──────────────────────────────────────
      const { data: existing } = await supabase
        .from("ficom_snapshots")
        .select("period_month, period_label, as_of_date")
        .eq("period_month", data.summary.period_month)
        .maybeSingle()
      if (existing) {
        setDupWarning(`⚠️ Data periode ${existing.period_month} (${existing.period_label}) sudah ada — as of ${existing.as_of_date}. Klik Upload untuk overwrite, atau Reset untuk batal.`)
      } else {
        setDupWarning("")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal parse file")
    } finally { setParsing(false) }
  }, [])

  const tryParse = useCallback((edi: File | null, master?: File | null) => {
    if (edi) handleFiles(edi, master)
  }, [handleFiles])

  const handleUpload = async () => {
    if (!parsed) return
    setUploading(true); setProgress([]); setError(""); setDone(false)
    try {
      await uploadFicomToSupabase(parsed, msg => setProgress(p => [...p, msg]))
      setDone(true)
      setViewerKey(k => k + 1)   // refresh data viewer
      setDupWarning("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal")
    } finally { setUploading(false) }
  }

  const reset = () => { setEdiFile(null); setMasterFile(null); setParsed(null); setProgress([]); setError(""); setDone(false); setDupWarning("") }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <MotivationBanner page="docreq" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "linear-gradient(135deg,#FB8C00,#FFB74D)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileSpreadsheet size={16} color="white" />
            </div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>Ficom Data Upload</h1>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginLeft: "42px" }}>
            Upload EDI Log Activity → cross-check dengan MASTERDATAPHI → update landing Ficom
          </p>
        </div>
        <a href="/landing/ficom" target="_blank">
          <button className="btn btn-ghost"><Eye size={14} /> Preview Landing</button>
        </a>
      </div>

      {/* Info */}
      <div className="card" style={{ padding: "14px 16px", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#16A34A", marginBottom: "6px" }}>✅ Logic Baru — Master dari MASTERDATAPHI (Supabase)</div>
        <div style={{ fontSize: "11px", color: "var(--text2)", lineHeight: 1.7 }}>
          <strong>Denominator</strong> = ADM + RDM dari <code>utilisasi_master_users</code> (~113 users aktif) — ADS tidak dihitung karena tidak bisa akses Ficom<br/>
          <strong>Numerator</strong> = user yang muncul di EDI Log Activity (aktif login)<br/>
          <strong>Compliance</strong> = usage_days ÷ selling_days × 100
        </div>
      </div>

      {/* EDI upload */}
      <div className="card" style={{ padding: "18px" }}>
        <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "linear-gradient(135deg,#FB8C00,#FFB74D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "white" }}>1</div>
          EDI Log Activity (CSV atau XLSX)
        </div>
        <div onDrop={e => { e.preventDefault(); setDragOverEdi(false); const f = e.dataTransfer.files[0]; if (f) { setEdiFile(f); tryParse(f, masterFile) } }}
          onDragOver={e => { e.preventDefault(); setDragOverEdi(true) }}
          onDragLeave={() => setDragOverEdi(false)}
          onClick={() => ediRef.current?.click()}
          style={{ border: `2px dashed ${dragOverEdi ? "#FB8C00" : ediFile ? "var(--border)" : "var(--border2)"}`, borderRadius: "var(--radius-sm)", padding: "24px", textAlign: "center", cursor: "pointer", background: dragOverEdi ? "rgba(251,140,0,0.06)" : "var(--surface2)", transition: "all 0.2s" }}>
          <input ref={ediRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { setEdiFile(f); tryParse(f, masterFile) }; e.target.value = "" }} />
          {ediFile
            ? <div><FileSpreadsheet size={24} color="#FB8C00" style={{ margin: "0 auto 8px", display: "block" }} /><div style={{ fontWeight: 700, fontSize: "12px", color: "var(--text)" }}>{ediFile.name}</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>{(ediFile.size / 1024 / 1024).toFixed(2)} MB</div></div>
            : <div><Upload size={24} color="var(--text3)" style={{ margin: "0 auto 8px", display: "block" }} /><div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>EDI_Log_Activity_Detail_brt.csv</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>Pipe-delimited CSV atau XLSX · kolom username = WFxxxx</div></div>
          }
        </div>
      </div>

      {parsing && (
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <RefreshCw size={18} color="var(--accent)" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>Parsing & cross-checking master...</div>
          <div style={{ marginLeft: "auto", display: "flex", flexDirection: "column", gap: "4px", maxHeight: "80px", overflowY: "auto" }}>
            {progress.map((p, i) => <div key={i} style={{ fontSize: "11px", color: "var(--text3)" }}>{p}</div>)}
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: "var(--danger-bg)", border: "1px solid var(--danger)", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "var(--danger)", display: "flex", gap: "8px" }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />{error}
        </div>
      )}

      {/* Duplicate warning */}
      {dupWarning && (
        <div style={{ background: "#FFFBEB", border: "1.5px solid #FDE68A", borderRadius: "10px", padding: "12px 16px", fontSize: "12px", color: "#92400E", display: "flex", gap: "10px", alignItems: "flex-start" }}>
          <TriangleAlert size={16} style={{ flexShrink: 0, marginTop: 1, color: "#F59E0B" }} />
          <div>{dupWarning}</div>
        </div>
      )}

      {/* Preview */}
      {parsed && !done && (
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px" }}>📊 Preview Data Hasil Parse</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "10px", marginBottom: "16px" }}>
            {[
              { l: "Period",       v: parsed.summary.period_label,              c: "var(--accent)" },
              { l: "As of Date",   v: parsed.summary.as_of_date,               c: "var(--accent)" },
              { l: "Selling Days", v: parsed.summary.selling_days.toString(),   c: "#FB8C00" },
              { l: "Total Users",  v: parsed.summary.total_users.toLocaleString(), c: "var(--text)" },
              { l: "Aktif",        v: parsed.snapshot.total_active.toString(),  c: "#43A047" },
              { l: "Utilisasi",    v: `${parsed.snapshot.pct_active}%`,         c: "#1E88E5" },
              { l: "Avg Compliance", v: `${parsed.snapshot.avg_compliance}%`,  c: "#7C3AED" },
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--surface2)", borderRadius: "10px", padding: "12px 14px" }}>
                <div style={{ fontSize: "9px", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "5px" }}>{s.l}</div>
                <div style={{ fontSize: "18px", fontWeight: 900, color: s.c, lineHeight: 1 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading} style={{ fontSize: "14px", padding: "10px 24px" }}>
              {uploading ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Uploading...</> : <><Upload size={15} /> {dupWarning ? "Overwrite & Upload" : "Upload ke Supabase"}</>}
            </button>
            <button className="btn btn-ghost" onClick={reset}><Trash2 size={14} /> Reset</button>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {progress.length > 0 && !parsing && (
        <div className="card" style={{ padding: "16px 20px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>Progress Upload</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            {progress.map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: p.startsWith("✅") || p.startsWith("🎉") ? "#43A047" : p.startsWith("❌") ? "#E8381A" : "var(--text2)" }}>
                {p.startsWith("✅") || p.startsWith("🎉") ? <CheckCircle size={13} color="#43A047" /> : p.startsWith("❌") ? <AlertCircle size={13} color="#E8381A" /> : <RefreshCw size={13} color="var(--accent)" style={{ animation: "spin 1s linear infinite" }} />}
                {p}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success */}
      {done && (
        <div className="card" style={{ padding: "20px", background: "var(--success-bg)", border: "1px solid var(--success)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CheckCircle size={24} color="var(--success)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "var(--success)" }}>Ficom data berhasil diupload! 🎉</div>
              <div style={{ fontSize: "12px", color: "var(--text2)", marginTop: 2 }}>
                {parsed?.summary.total_users} users · {parsed?.summary.period_label} · Utilisasi {parsed?.snapshot.pct_active}%
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            <a href="/landing/ficom" target="_blank">
              <button className="btn btn-primary"><Eye size={14} /> Lihat Landing Ficom</button>
            </a>
            <button className="btn btn-ghost" onClick={reset}>Upload Periode Baru</button>
          </div>
        </div>
      )}

      {/* ── Data Viewer ── */}
      <div style={{ borderTop: "2px solid var(--border)", paddingTop: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 14 }}>📂 Data Tersimpan & Maintenance</div>
        <FicomDataViewer refreshKey={viewerKey} />
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}