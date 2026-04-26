// PATH: src/app/dashboard/ficom-upload/page.tsx
// Also add "ficom-upload" route to your dashboard sidebar/nav

"use client"
import { useState, useRef, useCallback } from "react"
import { Upload, CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet, Eye, Trash2, ArrowRight, Database } from "lucide-react"
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
}

// ── Parsers ────────────────────────────────────────────────────
async function parseFicomExcels(
  ediFile: File,
  trainingFile: File,
  onProgress: (msg: string) => void,
  masterFile?: File | null
): Promise<ParsedFicomData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (await import("xlsx")) as any

  const fmtDate = (v: unknown): string | null => {
    if (!v) return null
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().split("T")[0]
    const d = new Date(v as string)
    return isNaN(d.getTime()) ? null : d.toISOString().split("T")[0]
  }
  const s = (v: unknown) => String(v || "").trim()

  // ── 1. Parse EDI usage log ──
  onProgress("⏳ Reading EDI usage log...")
  const ediBuf = await ediFile.arrayBuffer()
  const ediWb = XLSX.read(ediBuf, { type: "array", cellDates: true })
  
  // Try multiple sheet names (EDI file might be the raw or processed version)
  const ediSheetName = ediWb.SheetNames.includes("Sheet1") ? "Sheet1"
    : ediWb.SheetNames.includes("EDI Log Activity raw data") ? "EDI Log Activity raw data"
    : ediWb.SheetNames[0]
  
  const ediWs = ediWb.Sheets[ediSheetName]
  const ediRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ediWs, { raw: false, dateNF: "yyyy-mm-dd" })

  // Find the period (month of data)
  const allDates: string[] = []
  const userMap = new Map<string, {
    username: string; position: string; aor: string; sub_aor: string; rdm_name: string
    dates: Set<string>; last_date: string | null
  }>()

  for (const r of ediRows) {
    const uid = s(r["User ID"])
    const dt = fmtDate(r["Date of Usage"])
    const aor = s(r["AOR"])
    const pos = s(r["Position"]) // ADM or RDM

    if (!uid || !aor) continue
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        username: s(r["Username"]),
        position: pos,
        aor,
        sub_aor: s(r["SUB-AOR"]),
        rdm_name: s(r["RDM"]),
        dates: new Set(),
        last_date: null,
      })
    }
    if (dt) {
      userMap.get(uid)!.dates.add(dt)
      allDates.push(dt)
    }
  }

  if (allDates.length === 0) throw new Error("Tidak ada data usage ditemukan di file EDI")

  // Calculate period metadata
  const sortedDates = [...new Set(allDates)].sort()
  const minDate = sortedDates[0]
  const maxDate = sortedDates[sortedDates.length - 1]
  const periodMonth = minDate.slice(0, 7) // "2026-04"
  const asOfDate = maxDate

  // Calculate selling days
  // Count Mon-Sat from minDate to maxDate
  const startD = new Date(minDate)
  const endD = new Date(maxDate)
  let sellingDays = 0
  const cur = new Date(startD)
  while (cur <= endD) {
    if (cur.getDay() !== 0) sellingDays++ // exclude Sunday
    cur.setDate(cur.getDate() + 1)
  }

  // Determine period label (Period N based on month)
  const month = new Date(minDate)
  const periodNum = month.getMonth() + 1
  const periodLabel = `Period ${periodNum} (${month.toLocaleDateString("en-US", { month: "long", year: "numeric" })})`

  onProgress(`✅ EDI: ${userMap.size} users · ${sellingDays} selling days · ${periodLabel}`)

  // ── 2. Parse training file ──
  onProgress("⏳ Reading training schedule...")
  const trBuf = await trainingFile.arrayBuffer()
  const trWb = XLSX.read(trBuf, { type: "array", cellDates: true })
  
  // Try "Training Sched" or "Sheet1"
  const trSheetName = trWb.SheetNames.includes("Training Sched") ? "Training Sched"
    : trWb.SheetNames.includes("Sheet1") ? "Sheet1"
    : trWb.SheetNames[0]
  
  const trWs = trWb.Sheets[trSheetName]
  const trRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(trWs, { raw: false, dateNF: "yyyy-mm-dd" })

  // Build training lookup: user_id -> training_date
  const trainingMap = new Map<string, string>() // user_id -> date
  for (const r of trRows) {
    // Handle both formats:
    // Format 1 (Ficom_Usage file): REG, Position, Employee Name, User ID, Training Date
    // Format 2 (MasterDataFiicom_training): RDM, ADM 1, ADM 2, Date Training
    const uid = s(r["User ID"])
    if (uid && uid !== "User ID") {
      const dt = fmtDate(r["Training Date"] || r["Date Training"])
      if (dt) trainingMap.set(uid, dt)
    }
  }
  onProgress(`✅ Training: ${trainingMap.size} trained users`)

  // ── 2b. Parse m_master (optional) ──
  let totalAds = 0, totalLp = 0
  if (masterFile) {
    onProgress("⏳ Reading m_master...")
    const mBuf = await masterFile.arrayBuffer()
    const mWb = XLSX.read(mBuf, { type: "array", cellDates: true })
    const mWs = mWb.Sheets[mWb.SheetNames[0]]
    const mRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(mWs, { raw: false })
    for (const r of mRows) {
      const t = s(r["Type"])
      if (t === "ADS") totalAds++
      else if (t === "LP") totalLp++
    }
    onProgress(`✅ m_master: ${totalAds} ADS + ${totalLp} LP field users`)
  }

  // ── 3. Build UserRow list ──
  const VALID_AORS = new Set(["GMA", "MIN", "NOL", "SOL", "VIS"])
  const users: UserRow[] = []
  const aorAgg: Record<string, { users: UserRow[] }> = {}

  for (const [uid, u] of userMap) {
    if (!VALID_AORS.has(u.aor)) continue
    const uniqueDays = u.dates.size
    const compliancePct = sellingDays > 0 ? Math.round(uniqueDays / sellingDays * 1000) / 10 : 0
    const lastDate = u.dates.size > 0 ? [...u.dates].sort().pop()! : null
    const isTrained = trainingMap.has(uid) ? 1 : 0
    const trainDate = trainingMap.get(uid) || null

    const row: UserRow = {
      period_month: periodMonth,
      user_id: uid,
      username: u.username,
      position: u.position, // keep ADM/RDM
      aor: u.aor,
      sub_aor: u.sub_aor,
      rdm_name: u.rdm_name,
      usage_days: uniqueDays,
      selling_days: sellingDays,
      compliance_pct: compliancePct,
      last_usage_date: lastDate,
      trained: isTrained,
      training_date: trainDate,
    }
    users.push(row)

    if (!aorAgg[u.aor]) aorAgg[u.aor] = { users: [] }
    aorAgg[u.aor].users.push(row)
  }

  // Also add trained users who have NO usage (compliance = 0)
  for (const [uid, trainDate] of trainingMap) {
    if (!userMap.has(uid)) {
      // We don't have AOR info for non-usage users from training file
      // Skip as we can't determine their AOR without master data
    }
  }

  // ── 4. Build AreaRow list ──
  const areas: AreaRow[] = Object.entries(aorAgg).map(([aor, { users: aUsers }]) => {
    const total = aUsers.length
    const trained = aUsers.filter(u => u.trained === 1).length
    const active = aUsers.filter(u => u.usage_days > 0).length
    const highCount = aUsers.filter(u => u.compliance_pct >= 91).length
    const mediumCount = aUsers.filter(u => u.compliance_pct >= 51 && u.compliance_pct < 91).length
    const lowCount = aUsers.filter(u => u.compliance_pct < 51).length
    const avgComp = total ? Math.round(aUsers.reduce((s, u) => s + u.compliance_pct, 0) / total * 10) / 10 : 0
    return {
      period_month: periodMonth, aor, total_users: total, trained, active,
      avg_compliance: avgComp, high_count: highCount, medium_count: mediumCount,
      low_count: lowCount, pct_active: total ? Math.round(active / total * 1000) / 10 : 0,
    }
  })

  // ── 5. Snapshot ──
  const totalUsers = users.length
  const totalTrained = users.filter(u => u.trained === 1).length
  const totalActive = users.filter(u => u.usage_days > 0).length
  const totalHigh = users.filter(u => u.compliance_pct >= 91).length
  const totalMedium = users.filter(u => u.compliance_pct >= 51 && u.compliance_pct < 91).length
  const totalLow = users.filter(u => u.compliance_pct < 51).length
  const avgCompliance = totalUsers ? Math.round(users.reduce((s, u) => s + u.compliance_pct, 0) / totalUsers * 10) / 10 : 0

  const snapshot: SnapshotRow = {
    period_label: periodLabel, period_month: periodMonth, as_of_date: asOfDate,
    selling_days: sellingDays, total_users: totalUsers, total_trained: totalTrained,
    total_active: totalActive, total_high: totalHigh, total_medium: totalMedium,
    total_low: totalLow, avg_compliance: avgCompliance,
    pct_trained: totalUsers ? Math.round(totalTrained / totalUsers * 1000) / 10 : 0,
    pct_active: totalUsers ? Math.round(totalActive / totalUsers * 1000) / 10 : 0,
    total_ads: totalAds, total_lp: totalLp,
  }

  return {
    snapshot, areas, users,
    summary: { period_label: periodLabel, period_month: periodMonth, as_of_date: asOfDate, selling_days: sellingDays, total_users: totalUsers, total_trained: totalTrained }
  }
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

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function FicomUploadPage() {
  const ediRef = useRef<HTMLInputElement>(null)
  const trRef = useRef<HTMLInputElement>(null)
  const [ediFile,    setEdiFile]    = useState<File | null>(null)
  const [trFile,     setTrFile]     = useState<File | null>(null)
  const [masterFile, setMasterFile] = useState<File | null>(null) // optional m_master
  const [parsed, setParsed] = useState<ParsedFicomData | null>(null)
  const [parsing, setParsing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)
  const [dragOverEdi, setDragOverEdi] = useState(false)
  const [dragOverTr, setDragOverTr] = useState(false)

  const handleFiles = useCallback(async (edi: File, tr: File, master?: File | null) => {
    setError(""); setParsed(null); setDone(false); setProgress([])
    setParsing(true)
    try {
      const data = await parseFicomExcels(edi, tr, msg => setProgress(p => [...p, msg]), master)
      setParsed(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal parse file")
    } finally { setParsing(false) }
  }, [])

  const tryParse = useCallback((edi: File | null, tr: File | null, master?: File | null) => {
    if (edi && tr) handleFiles(edi, tr, master)
  }, [handleFiles])

  const handleUpload = async () => {
    if (!parsed) return
    setUploading(true); setProgress([]); setError(""); setDone(false)
    try {
      await uploadFicomToSupabase(parsed, msg => setProgress(p => [...p, msg]))
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal")
    } finally { setUploading(false) }
  }

  const reset = () => { setEdiFile(null); setTrFile(null); setMasterFile(null); setParsed(null); setProgress([]); setError(""); setDone(false) }

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
            Upload 2 file Excel → parse compliance → update landing page Ficom
          </p>
        </div>
        <a href="/landing/utilisation" target="_blank">
          <button className="btn btn-ghost"><Eye size={14} /> Preview Landing</button>
        </a>
      </div>

      {/* Flow */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", gap: "0", alignItems: "center", flexWrap: "wrap" }}>
          {[
            { icon: <FileSpreadsheet size={20} color="#FB8C00" />, label: "EDI Usage", sub: "MasterDataFiicom_EDI.xlsx" },
            { icon: "+", label: "", sub: "" },
            { icon: <FileSpreadsheet size={20} color="#43A047" />, label: "Training", sub: "MasterDataFiicom_training.xlsx" },
            { icon: <ArrowRight size={18} color="var(--text3)" />, label: "", sub: "" },
            { icon: "⚙️", label: "Parse & Calc", sub: "Compliance %" },
            { icon: <ArrowRight size={18} color="var(--text3)" />, label: "", sub: "" },
            { icon: <Database size={20} color="#1E88E5" />, label: "Supabase", sub: "3 tables" },
            { icon: <ArrowRight size={18} color="var(--text3)" />, label: "", sub: "" },
            { icon: "🌐", label: "Landing", sub: "Ficom tab" },
          ].map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px", padding: "6px 10px" }}>
              {s.icon === "+" || s.icon === "⚙️" || s.icon === "🌐"
                ? <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: s.icon === "+" ? "20px" : "18px", color: s.icon === "+" ? "#bbb" : "inherit" }}>{s.icon}</div>
                    {s.label && <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text)" }}>{s.label}</div>}
                    {s.sub && <div style={{ fontSize: "9px", color: "var(--text3)" }}>{s.sub}</div>}
                  </div>
                : s.label === ""
                  ? <span>{s.icon}</span>
                  : <div style={{ textAlign: "center" }}>
                      <div style={{ display: "flex", justifyContent: "center", marginBottom: "2px" }}>{s.icon}</div>
                      <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text)" }}>{s.label}</div>
                      <div style={{ fontSize: "9px", color: "var(--text3)" }}>{s.sub}</div>
                    </div>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Role mapping info */}
      <div className="card" style={{ padding: "12px 16px", background: "rgba(251,140,0,0.06)", border: "1px solid rgba(251,140,0,0.2)" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#FB8C00", marginBottom: "6px" }}>📋 Role Mapping (Internal → Display)</div>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "11px", color: "var(--text2)" }}>
          <span><strong>GRSM</strong> → ADS/ADM (field user)</span>
          <span><strong>NSM</strong> → RDM (regional manager)</span>
          <span><strong>SD</strong> → SD</span>
          <span><strong>RSM</strong> → ADS</span>
          <span>Compliance = unique login days ÷ selling days × 100</span>
        </div>
      </div>

      {/* File uploads side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "16px" }}>
        {/* EDI File */}
        <div className="card" style={{ padding: "18px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "linear-gradient(135deg,#FB8C00,#FFB74D)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "white" }}>1</div>
            EDI Usage Log
          </div>
          <div onDrop={e => { e.preventDefault(); setDragOverEdi(false); const f = e.dataTransfer.files[0]; if (f) { setEdiFile(f); tryParse(f, trFile, masterFile) } }}
            onDragOver={e => { e.preventDefault(); setDragOverEdi(true) }}
            onDragLeave={() => setDragOverEdi(false)}
            onClick={() => ediRef.current?.click()}
            style={{ border: `2px dashed ${dragOverEdi ? "#FB8C00" : ediFile ? "var(--border)" : "var(--border2)"}`, borderRadius: "var(--radius-sm)", padding: "24px", textAlign: "center", cursor: "pointer", background: dragOverEdi ? "rgba(251,140,0,0.06)" : "var(--surface2)", transition: "all 0.2s" }}>
            <input ref={ediRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { setEdiFile(f); tryParse(f, trFile, masterFile) }; e.target.value = "" }} />
            {ediFile
              ? <div><FileSpreadsheet size={24} color="#FB8C00" style={{ margin: "0 auto 8px", display: "block" }} /><div style={{ fontWeight: 700, fontSize: "12px", color: "var(--text)" }}>{ediFile.name}</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>{(ediFile.size / 1024 / 1024).toFixed(2)} MB</div></div>
              : <div><Upload size={24} color="var(--text3)" style={{ margin: "0 auto 8px", display: "block" }} /><div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>MasterDataFiicom_EDI.xlsx</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>EDI log activity · kolom: AOR, User ID, Username, Date of Usage</div></div>
            }
          </div>
        </div>

        {/* Training File */}
        <div className="card" style={{ padding: "18px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "linear-gradient(135deg,#43A047,#66BB6A)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "white" }}>2</div>
            Training Schedule
          </div>
          <div onDrop={e => { e.preventDefault(); setDragOverTr(false); const f = e.dataTransfer.files[0]; if (f) { setTrFile(f); tryParse(ediFile, f, masterFile) } }}
            onDragOver={e => { e.preventDefault(); setDragOverTr(true) }}
            onDragLeave={() => setDragOverTr(false)}
            onClick={() => trRef.current?.click()}
            style={{ border: `2px dashed ${dragOverTr ? "#43A047" : trFile ? "var(--border)" : "var(--border2)"}`, borderRadius: "var(--radius-sm)", padding: "24px", textAlign: "center", cursor: "pointer", background: dragOverTr ? "rgba(67,160,71,0.06)" : "var(--surface2)", transition: "all 0.2s" }}>
            <input ref={trRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { setTrFile(f); tryParse(ediFile, f, masterFile) }; e.target.value = "" }} />
            {trFile
              ? <div><FileSpreadsheet size={24} color="#43A047" style={{ margin: "0 auto 8px", display: "block" }} /><div style={{ fontWeight: 700, fontSize: "12px", color: "var(--text)" }}>{trFile.name}</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>{(trFile.size / 1024 / 1024).toFixed(2)} MB</div></div>
              : <div><Upload size={24} color="var(--text3)" style={{ margin: "0 auto 8px", display: "block" }} /><div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text)" }}>MasterDataFiicom_training.xlsx</div><div style={{ fontSize: "11px", color: "var(--text3)" }}>Training sched · kolom: User ID + Training Date</div></div>
            }
          </div>
        </div>
      </div>

      {/* m_master File (optional) */}
      <div className="card" style={{ padding: "18px", opacity: 0.9 }}>
        <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "linear-gradient(135deg,#F97316,#FB923C)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900, color: "white" }}>3</div>
          Master Data ADS/LP <span style={{ fontSize: "10px", fontWeight: 400, color: "var(--text3)", background: "var(--surface2)", padding: "2px 8px", borderRadius: "99px", marginLeft: "4px" }}>Optional</span>
        </div>
        <p style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "12px", marginLeft: "28px" }}>
          Upload <strong>MasterDataFiicom_m_master.xlsx</strong> untuk menampilkan jumlah ADS & LP di hero section
        </p>
        <div
          onClick={() => { const i = document.createElement("input"); i.type="file"; i.accept=".xlsx,.xls"; i.onchange=(e)=>{ const f=(e.target as HTMLInputElement).files?.[0]; if(f){setMasterFile(f); tryParse(ediFile,trFile,f)} }; i.click() }}
          style={{ border: `2px dashed ${masterFile ? "var(--border)" : "var(--border2)"}`, borderRadius: "var(--radius-sm)", padding: "16px", textAlign: "center", cursor: "pointer", background: "var(--surface2)", transition: "all 0.2s" }}>
          {masterFile
            ? <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text)" }}>✅ {masterFile.name} · {(masterFile.size/1024).toFixed(0)} KB</div>
            : <div style={{ fontSize: "12px", color: "var(--text3)" }}>📂 Click to upload m_master (optional) — columns: SPV ID, Type (ADS/LP)</div>
          }
        </div>
      </div>

      {parsing && (
        <div className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: "12px" }}>
          <RefreshCw size={18} color="var(--accent)" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)" }}>Parsing & calculating compliance...</div>
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

      {/* Preview */}
      {parsed && !done && (
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "16px" }}>📊 Preview Data Hasil Parse</div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px", marginBottom: "16px" }}>
            {[
              { l: "Period", v: parsed.summary.period_label, c: "var(--accent)" },
              { l: "As of Date", v: parsed.summary.as_of_date, c: "var(--accent)" },
              { l: "Selling Days", v: parsed.summary.selling_days.toString(), c: "#FB8C00" },
              { l: "Total Users", v: parsed.summary.total_users.toLocaleString(), c: "var(--text)" },
              { l: "Trained", v: parsed.summary.total_trained.toString(), c: "#43A047" },
              { l: "Avg Compliance", v: `${parsed.snapshot.avg_compliance}%`, c: "#1E88E5" },
            ].map((s, i) => (
              <div key={i} style={{ background: "var(--surface2)", borderRadius: "12px", padding: "14px" }}>
                <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>{s.l}</div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: s.c, fontFamily: "'Bricolage Grotesque',sans-serif", lineHeight: 1 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Area breakdown preview */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text2)", marginBottom: "8px" }}>Compliance by Area:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: "8px" }}>
              {parsed.areas.sort((a, b) => b.avg_compliance - a.avg_compliance).map((a, i) => (
                <div key={i} style={{ background: "var(--surface2)", borderRadius: "10px", padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700 }}>{a.aor}</span>
                    <span style={{ fontSize: "12px", fontWeight: 800, color: a.avg_compliance >= 80 ? "#43A047" : a.avg_compliance >= 60 ? "#FB8C00" : "#E8381A" }}>{a.avg_compliance}%</span>
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--text3)" }}>{a.total_users} users · ≥91%: {a.high_count} · &lt;50%: {a.low_count}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading} style={{ fontSize: "14px", padding: "12px 28px" }}>
              {uploading ? <><RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Uploading...</> : <><Upload size={15} /> Upload ke Supabase</>}
            </button>
            <button className="btn btn-ghost" onClick={reset}><Trash2 size={14} /> Reset</button>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {progress.length > 0 && !parsing && (
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "12px" }}>Progress Upload</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
        <div className="card" style={{ padding: "24px", background: "var(--success-bg)", border: "1px solid var(--success)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <CheckCircle size={28} color="var(--success)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: "16px", color: "var(--success)", marginBottom: "4px" }}>Ficom data berhasil diupload! 🎉</div>
              <div style={{ fontSize: "12px", color: "var(--text2)" }}>
                {parsed?.summary.total_users} users · {parsed?.summary.period_label} · Avg compliance {parsed?.snapshot.avg_compliance}%
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <a href="/landing/utilisation" target="_blank">
              <button className="btn btn-primary"><Eye size={14} /> Lihat Landing Ficom</button>
            </a>
            <button className="btn btn-ghost" onClick={reset}>Upload Periode Baru</button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}