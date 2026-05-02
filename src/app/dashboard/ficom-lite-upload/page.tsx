"use client"
// PATH: src/app/dashboard/ficom-lite-upload/page.tsx
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { Upload, CheckCircle, AlertCircle, RefreshCw, FileText, Eye, Trash2, Database, FileSpreadsheet, Search, TriangleAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"
 
// ── Types ─────────────────────────────────────────────────────
interface ParsedFL {
  snapshot: SnapRow; areas: AreaRow[]; users: UserRow[]
  summary: { period_label:string; period_month:string; as_of_date:string; selling_days:number; total_users:number; active_users:number; utilisation_pct:number }
  realisasi_active?: number | null   // context dari productivity CSV
}
interface SnapRow {
  period_label:string; period_month:string; as_of_date:string; selling_days:number
  total_users:number; active_users:number; utilisation_pct:number
  total_adm:number; active_adm:number; pct_adm:number
  total_rdm:number; active_rdm:number; pct_rdm:number
  total_ss:number;  active_ss:number;  pct_ss:number
}
interface AreaRow {
  period_month:string; aor:string
  total_users:number; active_users:number; utilisation_pct:number
  total_adm:number; active_adm:number
  total_rdm:number; active_rdm:number
  total_ss:number;  active_ss:number
}
interface UserRow {
  period_month:string; user_id:string; username:string
  role:string; aor:string; rdm_name:string; sub_aor:string
  active_days:number; selling_days:number; compliance_pct:number
  last_access_date:string|null; is_active:number; pages_accessed:string
  activity_count?: number; master_name?: string; master_position?: string; is_active_bool?: boolean
}
 
// ── Helpers ───────────────────────────────────────────────────
function getArea(gnm: string): string {
  const g = gnm.toUpperCase()
  if(["EVIS","WVIS","CVIS","VIS"].some(x=>g.includes(x))) return "VIS"
  if(["USOL","MSOL","LSOL","SOL"].some(x=>g.includes(x))) return "SOL"
  if(["WNOL","CNOL","ENOL","NOL"].some(x=>g.includes(x))) return "NOL"
  if(["NMIN","SMIN","WMIN","MIN"].some(x=>g.includes(x))) return "MIN"
  if(["EGMA","SGMA","NGMA","GMA"].some(x=>g.includes(x))) return "GMA"
  return "UNK"
}
 
const VALID_AORS = new Set(["GMA","MIN","NOL","SOL","VIS"])
 
// ── Parser ────────────────────────────────────────────────────
async function parseFicomLite(
  logFile: File,
  prodFile: File | null,
  onProgress: (msg:string)=>void
): Promise<ParsedFL[]> {   // returns ARRAY — one per month
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (await import("xlsx")) as any
  const s = (v:unknown) => String(v||"").trim()

  // ── 1. Load MASTER ──────────────────────────────────────────────
  onProgress("⏳ Loading master from MASTERDATAPHI (Supabase)...")
  const { data: masterData, error: masterErr } = await supabase
    .from("utilisasi_master_users")
    .select("user_login, sales_name, position, is_active, aor, sub_aor")
  if (masterErr) throw new Error(`Master load error: ${masterErr.message}`)

  const supabaseMaster = new Map<string,{
    name:string; position:string; is_active:boolean; aor:string; sub_aor:string
  }>()
  for (const u of masterData ?? []) {
    supabaseMaster.set(u.user_login.toUpperCase(), {
      name: u.sales_name, position: u.position, is_active: u.is_active,
      aor: u.aor ?? "", sub_aor: u.sub_aor ?? "",
    })
  }
  const masterActiveCount = [...supabaseMaster.values()].filter(u=>u.is_active).length
  onProgress(`✅ MASTERDATAPHI: ${masterActiveCount} active users`)

  // ── 2. Parse Access Log → group by month ───────────────────────
  onProgress("⏳ Parsing access log per bulan...")
  const logText = await logFile.text()
  const logLines = logText.split("\n").map(l=>l.trim()).filter(l=>l)

  // monthLog: month -> uid -> { dates, pages, lastDate }
  const monthLog: Record<string, Record<string,{
    dates:Set<string>; pages:Set<string>; lastDate:string
  }>> = {}
  const monthDates: Record<string, Set<string>> = {}   // month -> all dates

  for (const line of logLines) {
    const dt = line.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue
    const month = dt.slice(0, 7)

    let uid = "", pg = ""
    if (line.includes("|")) {
      const parts = line.split("|")
      if (parts.length < 3) continue
      pg  = parts[1].trim()
      uid = parts[2].trim().toUpperCase()
    } else {
      const uidM  = line.match(/user-id=([A-Za-z0-9]+)/i)
      const pageM = line.match(/ficom-lite-dashboard\/([^?/\s]+)/i)
      if (!uidM) continue
      uid = uidM[1].toUpperCase()
      pg  = pageM ? pageM[1] : "dashboard"
    }
    if (!uid.startsWith("WF")) continue

    if (!monthLog[month]) monthLog[month] = {}
    if (!monthLog[month][uid]) monthLog[month][uid] = { dates:new Set(), pages:new Set(), lastDate:"" }
    monthLog[month][uid].dates.add(dt)
    monthLog[month][uid].pages.add(pg)
    if (dt > monthLog[month][uid].lastDate) monthLog[month][uid].lastDate = dt

    if (!monthDates[month]) monthDates[month] = new Set()
    monthDates[month].add(dt)
  }

  const months = Object.keys(monthLog).sort()
  if (!months.length) throw new Error("Tidak ada data valid di access log")

  // Count entries per month for logging
  const monthCounts = Object.entries(monthLog).map(([m,u])=>
    `${m}:${Object.values(u).reduce((s,v)=>s+v.dates.size,0)}`).join(", ")
  onProgress(`✅ Access log: ${months.length} bulan terdeteksi (${monthCounts})`)

  // ── 3. Parse Productivity CSV (opsional) ───────────────────────
  // realisasiLog: month -> uid -> realisasi_days count
  const realisasiLog: Record<string, Record<string,number>> = {}

  if (prodFile) {
    onProgress("⏳ Parsing productivity CSV per bulan...")
    const isCsv = prodFile.name.toLowerCase().endsWith(".csv")
    if (isCsv) {
      const text = await prodFile.text()
      const lines = text.split("\n")
      const delim = lines[0]?.includes("|") ? "|" : ","
      const clean = (v:string) => v.replace(/"/g,"").trim()
      const realisasiDays: Record<string, Record<string,Set<string>>> = {}

      for (let i=1;i<lines.length;i++) {
        const cols = lines[i].trim().split(delim)
        if (cols.length < 20) continue
        const realisasi = parseFloat(clean(cols[19]??"0")) || 0
        const slsDate   = clean(cols[13]??"")
        if (!slsDate || realisasi <= 0) continue
        const month = slsDate.slice(0,7)

        for (const colIdx of [4,6,8]) {
          const wf = clean(cols[colIdx]??"").toUpperCase()
          if (!wf.startsWith("WF")) continue
          if (!realisasiDays[month]) realisasiDays[month] = {}
          if (!realisasiDays[month][wf]) realisasiDays[month][wf] = new Set()
          realisasiDays[month][wf].add(slsDate)
        }
      }
      for (const [month, users] of Object.entries(realisasiDays)) {
        realisasiLog[month] = {}
        for (const [wf, days] of Object.entries(users)) realisasiLog[month][wf] = days.size
      }
    }
    onProgress(`✅ Productivity: ${Object.keys(realisasiLog).length} bulan`)
  }

  // ── 4. Build ParsedFL per month ────────────────────────────────
  const VALID_AREA = new Set(["GMA","MIN","NOL","SOL","VIS"])
  const results: ParsedFL[] = []

  for (const month of months) {
    const loginByUser = monthLog[month]
    const allDatesThisMonth = [...monthDates[month]].sort()
    const minDate = allDatesThisMonth[0]
    const maxDate = allDatesThisMonth[allDatesThisMonth.length-1]

    // Selling days (Mon-Sat) for this month
    let sellingDays = 0
    const cur = new Date(minDate)
    while (cur <= new Date(maxDate)) {
      if (cur.getDay() !== 0) sellingDays++
      cur.setDate(cur.getDate()+1)
    }

    const periodD = new Date(minDate)
    const periodLabel = `Period ${periodD.getMonth()+1} (${periodD.toLocaleDateString("en-US",{month:"long",year:"numeric"})})`

    // Build user rows
    const userRows: UserRow[] = []
    for (const [uid, supaUser] of supabaseMaster.entries()) {
      if (!supaUser.is_active) continue
      const logInfo       = loginByUser[uid]
      const loginDays     = logInfo ? logInfo.dates.size : 0
      const isActive      = loginDays > 0 ? 1 : 0
      const compPct       = sellingDays ? Math.round(loginDays/sellingDays*1000)/10 : 0
      const lastDate      = logInfo?.lastDate || null
      const pages         = logInfo ? [...logInfo.pages].join(",") : ""
      const realisasiDays = realisasiLog[month]?.[uid] ?? 0
      const role          = supaUser.position==="ADS"?"SS":supaUser.position==="RDM"?"RDM":"ADM"
      const aor           = supaUser.aor && VALID_AREA.has(supaUser.aor) ? supaUser.aor : "UNK"

      userRows.push({
        period_month:month, user_id:uid, username:supaUser.name||uid,
        role, aor, rdm_name:"", sub_aor:supaUser.sub_aor||"",
        active_days:loginDays, selling_days:sellingDays, compliance_pct:compPct,
        last_access_date:lastDate, is_active:isActive, pages_accessed:pages,
        activity_count:realisasiDays, master_name:supaUser.name,
        master_position:supaUser.position, is_active_bool:isActive===1,
      })
    }

    // Area aggregation
    const areaMap: Record<string,{total:number;active:number;adm_t:number;adm_a:number;rdm_t:number;rdm_a:number;ss_t:number;ss_a:number}> = {}
    for (const u of userRows) {
      if (!areaMap[u.aor]) areaMap[u.aor] = {total:0,active:0,adm_t:0,adm_a:0,rdm_t:0,rdm_a:0,ss_t:0,ss_a:0}
      const m = areaMap[u.aor]; m.total++; if(u.is_active) m.active++
      if(u.role==="ADM"){m.adm_t++;if(u.is_active)m.adm_a++}
      if(u.role==="RDM"){m.rdm_t++;if(u.is_active)m.rdm_a++}
      if(u.role==="SS"){m.ss_t++;if(u.is_active)m.ss_a++}
    }
    const areaRows: AreaRow[] = Object.entries(areaMap).map(([aor,m])=>({
      period_month:month, aor,
      total_users:m.total, active_users:m.active,
      utilisation_pct:m.total?Math.round(m.active/m.total*1000)/10:0,
      total_adm:m.adm_t, active_adm:m.adm_a,
      total_rdm:m.rdm_t, active_rdm:m.rdm_a,
      total_ss:m.ss_t, active_ss:m.ss_a,
    }))

    // Snapshot
    const totalU  = userRows.length
    const activeU = userRows.filter(u=>u.is_active).length
    const r = {adm_t:0,adm_a:0,rdm_t:0,rdm_a:0,ss_t:0,ss_a:0}
    for(const u of userRows){
      if(u.role==="ADM"){r.adm_t++;if(u.is_active)r.adm_a++}
      if(u.role==="RDM"){r.rdm_t++;if(u.is_active)r.rdm_a++}
      if(u.role==="SS"){r.ss_t++;if(u.is_active)r.ss_a++}
    }
    const snapshot: SnapRow = {
      period_label:periodLabel, period_month:month,
      as_of_date:maxDate, selling_days:sellingDays,
      total_users:totalU, active_users:activeU,
      utilisation_pct:totalU?Math.round(activeU/totalU*1000)/10:0,
      total_adm:r.adm_t, active_adm:r.adm_a, pct_adm:r.adm_t?Math.round(r.adm_a/r.adm_t*1000)/10:0,
      total_rdm:r.rdm_t, active_rdm:r.rdm_a, pct_rdm:r.rdm_t?Math.round(r.rdm_a/r.rdm_t*1000)/10:0,
      total_ss:r.ss_t,   active_ss:r.ss_a,   pct_ss:r.ss_t?Math.round(r.ss_a/r.ss_t*1000)/10:0,
    }

    results.push({
      snapshot, areas:areaRows, users:userRows,
      summary:{ period_label:periodLabel, period_month:month, as_of_date:maxDate,
        selling_days:sellingDays, total_users:totalU, active_users:activeU,
        utilisation_pct:snapshot.utilisation_pct },
      realisasi_active: prodFile ? (realisasiLog[month] ? Object.values(realisasiLog[month]).filter(d=>d>0).length : 0) : null,
    })
    onProgress(`✅ ${periodLabel}: ${activeU}/${totalU} aktif = ${snapshot.utilisation_pct}%`)
  }

  return results
}

// ── Upload to Supabase (Smart Merge) ──────────────────────────
// Logic:
//   - Upload log  → update kolom login (active_days, compliance_pct, is_active, dll)
//                   activity_count TIDAK disentuh jika sudah ada data
//   - Upload prod → update kolom realisasi (activity_count) saja
//                   active_days, compliance_pct TIDAK disentuh jika sudah ada data
// Requires: UNIQUE(period_month, user_id) di fl_users
async function uploadToSupabase(data: ParsedFL, onProgress: (msg:string)=>void) {
  const pm = data.summary.period_month
  const hasLog  = data.users.some(u => u.active_days > 0 || u.is_active === 1)
  const hasProd = data.users.some(u => (u.activity_count ?? 0) > 0)

  // ── Snapshot: selalu upsert ──────────────────────────────────
  onProgress("⏳ Uploading snapshot...")
  const { error: e1 } = await supabase
    .from("fl_snapshots")
    .upsert([data.snapshot], { onConflict: "period_month" })
  if (e1) throw new Error(`Snapshot: ${e1.message}`)
  onProgress(`✅ Snapshot: ${pm}`)

  // ── Areas: selalu replace ─────────────────────────────────────
  onProgress("⏳ Updating area data...")
  await supabase.from("fl_areas").delete().eq("period_month", pm)
  const { error: e2 } = await supabase.from("fl_areas").insert(data.areas)
  if (e2) throw new Error(`Areas: ${e2.message}`)
  onProgress(`✅ Areas: ${data.areas.length}`)

  // ── Users: smart merge ────────────────────────────────────────
  onProgress("⏳ Smart merging user data...")

  // Check existing users for this period
  const { data: existing } = await supabase
    .from("fl_users")
    .select("user_id, active_days, activity_count")
    .eq("period_month", pm)

  const existingMap = new Map<string, { active_days: number; activity_count: number }>()
  for (const r of existing ?? []) {
    existingMap.set(r.user_id, {
      active_days:    r.active_days    ?? 0,
      activity_count: r.activity_count ?? 0,
    })
  }

  const hasExisting = existingMap.size > 0

  if (!hasExisting) {
    // No existing data → full insert
    onProgress("⏳ First upload for this period — inserting all users...")
    const chunk = 200
    for (let i = 0; i < data.users.length; i += chunk) {
      const { error: e3 } = await supabase
        .from("fl_users")
        .insert(data.users.slice(i, i + chunk))
      if (e3) throw new Error(`Users insert: ${e3.message}`)
      onProgress(`⏳ Users: ${Math.min(i + chunk, data.users.length)}/${data.users.length}`)
    }
  } else if (hasLog && !hasProd) {
    // Log-only upload → update login columns, preserve activity_count from existing
    onProgress("⏳ Log-only upload — updating login columns, preserving realisasi...")
    const toUpsert = data.users.map(u => ({
      ...u,
      // Preserve existing activity_count if this upload has no productivity data
      activity_count: existingMap.get(u.user_id)?.activity_count ?? 0,
    }))
    // Delete and re-insert with merged data
    await supabase.from("fl_users").delete().eq("period_month", pm)
    const chunk = 200
    for (let i = 0; i < toUpsert.length; i += chunk) {
      const { error: e3 } = await supabase
        .from("fl_users")
        .insert(toUpsert.slice(i, i + chunk))
      if (e3) throw new Error(`Users upsert: ${e3.message}`)
    }
    onProgress(`✅ Login data updated · realisasi data preserved`)
  } else if (hasProd && !hasLog) {
    // Prod-only upload → update activity_count only, preserve login columns
    onProgress("⏳ Productivity-only upload — updating realisasi, preserving login data...")
    const toUpsert = data.users.map(u => ({
      ...u,
      // Preserve existing login data
      active_days:      existingMap.get(u.user_id)?.active_days ?? 0,
      compliance_pct:   existingMap.get(u.user_id)?.active_days
        ? Math.round((existingMap.get(u.user_id)!.active_days / (data.snapshot.selling_days || 20)) * 1000) / 10
        : 0,
    }))
    await supabase.from("fl_users").delete().eq("period_month", pm)
    const chunk = 200
    for (let i = 0; i < toUpsert.length; i += chunk) {
      const { error: e3 } = await supabase
        .from("fl_users")
        .insert(toUpsert.slice(i, i + chunk))
      if (e3) throw new Error(`Users upsert: ${e3.message}`)
    }
    onProgress(`✅ Realisasi data updated · login data preserved`)
  } else {
    // Both log + prod → full replace
    onProgress("⏳ Full upload (log + productivity)...")
    await supabase.from("fl_users").delete().eq("period_month", pm)
    const chunk = 200
    for (let i = 0; i < data.users.length; i += chunk) {
      const { error: e3 } = await supabase
        .from("fl_users")
        .insert(data.users.slice(i, i + chunk))
      if (e3) throw new Error(`Users insert: ${e3.message}`)
      onProgress(`⏳ Users: ${Math.min(i + chunk, data.users.length)}/${data.users.length}`)
    }
  }

  onProgress(`✅ Users: ${data.users.length} · Mode: ${!hasExisting ? "Full Insert" : hasLog && !hasProd ? "Log Merge" : hasProd && !hasLog ? "Productivity Merge" : "Full Replace"}`)
  onProgress("🎉 Ficom Lite data uploaded!")
}
 
// ── MAIN PAGE ─────────────────────────────────────────────────

export default function FicomLiteUploadPage() {
  const prodRef = useRef<HTMLInputElement>(null)
  const logRef  = useRef<HTMLInputElement>(null)
  const [logFile,    setLogFile]   = useState<File|null>(null)   // PRIMARY wajib
  const [prodFile,   setProdFile]  = useState<File|null>(null)   // SECONDARY opsional
  const [parsed,     setParsed]    = useState<ParsedFL[]>([])
  const [parsing,    setParsing]   = useState(false)
  const [uploading,  setUploading] = useState(false)
  const [progress,   setProgress]  = useState<string[]>([])
  const [error,      setError]     = useState("")
  const [done,       setDone]      = useState(false)
  const [dupWarning, setDupWarning] = useState("")
  const [viewerKey,  setViewerKey]  = useState(0)

  const tryParse = useCallback(async(log:File|null, prod:File|null)=>{
    if(!log) return
    setError(""); setParsed([]); setDone(false); setProgress([]); setDupWarning(""); setParsing(true)
    try {
      const results = await parseFicomLite(log, prod, msg=>setProgress(p=>[...p,msg]))
      setParsed(results)
      // Check which months already exist
      const months = results.map(r=>r.summary.period_month)
      const { data: existing } = await supabase
        .from("fl_snapshots").select("period_month, as_of_date").in("period_month", months)
      if (existing?.length) {
        const existList = existing.map((e:any)=>`${e.period_month} (as of ${e.as_of_date})`).join(", ")
        setDupWarning(`ℹ️ Periode berikut sudah ada: ${existList}. Upload akan merge data — tidak saling menghapus.`)
      }
    } catch(e) {
      setError(e instanceof Error ? e.message : "Parse failed")
    } finally { setParsing(false) }
  }, [])

  const handleUpload = async() => {
    if(!parsed.length) return
    setUploading(true); setProgress([]); setError(""); setDone(false)
    try {
      for (const p of parsed) {
        await uploadToSupabase(p, msg=>setProgress(prev=>[...prev,msg]))
      }
      setDone(true)
      setViewerKey(k=>k+1)
      setDupWarning("")
    } catch(e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally { setUploading(false) }
  }

  const reset = () => { setLogFile(null); setProdFile(null); setParsed([]); setProgress([]); setError(""); setDone(false); setDupWarning("") }
 
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
      <MotivationBanner page="docreq"/>
 
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
        <div>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"}}>
            <div style={{width:"32px",height:"32px",borderRadius:"8px",background:"linear-gradient(135deg,#22C55E,#10B981)",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <FileSpreadsheet size={16} color="white"/>
            </div>
            <h1 style={{fontSize:"20px",fontWeight:800,color:"var(--text)",letterSpacing:"-0.02em"}}>Ficom Lite Upload</h1>
          </div>
          <p style={{fontSize:"12px",color:"var(--text3)",marginLeft:"42px"}}>Upload 2 file → kalkulasi utilisasi (siapa yang sudah login ke Ficom Lite)</p>
        </div>
        <a href="/landing/ficom-lite" target="_blank">
          <button className="btn btn-ghost"><Eye size={14}/> Preview</button>
        </a>
      </div>
 
      {/* Concept info */}
      <div className="card" style={{padding:"14px 16px",background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.2)"}}>
        <div style={{fontSize:"11px",fontWeight:700,color:"#16A34A",marginBottom:"8px"}}>💡 Konsep Utilisasi Ficom Lite (Logic Baru)</div>
        <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.8}}>
          <strong>Utilisasi = user yang LOGIN ke Ficom Lite</strong> (bukan realisasi sales)<br/>
          <strong>File 1 (Wajib): Access Log</strong> → <code>access_log_ficom-lite_PHI_xxx.log</code><br/>
          → Aktif = muncul di log minimal 1 hari<br/>
          → Compliance = login_days ÷ selling_days (Senin–Sabtu otomatis)<br/>
          <strong>File 2 (Opsional): Productivity CSV</strong> → context realisasi saja, bukan utilisasi utama<br/>
          Master user = semua 199 user dari <code>utilisasi_master_users</code> (Supabase)
        </div>
      </div>
 
      {/* File uploads */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"16px"}}>
        {[
          {
            num:"1", label:"Access Log (Wajib)", color:"#22C55E",
            desc:"access_log_ficom-lite_PHI_xxx.log",
            hint:"Format: YYYY-MM-DD | page | user_id · Utilisasi = login days ÷ selling days",
            file:logFile, ref:logRef,
            onSet:(f:File)=>{ setLogFile(f); tryParse(f, prodFile) }
          },
          {
            num:"2", label:"Productivity CSV (Opsional)", color:"#10B981",
            desc:"EDI_FICOM_LITE_PRODUCTIVITY_brt.csv",
            hint:"Opsional — context realisasi. Pipe-delimited CSV · kolom: component_realisasi",
            file:prodFile, ref:prodRef,
            onSet:(f:File)=>{ setProdFile(f); tryParse(logFile, f) }
          },
        ].map((slot,i)=>(
          <div key={i} className="card" style={{padding:"18px"}}>
            <div style={{fontWeight:700,fontSize:"13px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"8px"}}>
              <div style={{width:"20px",height:"20px",borderRadius:"50%",background:slot.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:900,color:"white"}}>{slot.num}</div>
              {slot.label}
            </div>
            <p style={{fontSize:"11px",color:"var(--text3)",marginBottom:"12px",marginLeft:"28px"}}>{slot.hint}</p>
            <div onClick={()=>slot.ref.current?.click()}
              style={{border:`2px dashed ${slot.file?slot.color+"50":"var(--border2)"}`,borderRadius:"var(--radius-sm)",padding:"22px",textAlign:"center",cursor:"pointer",background:"var(--surface2)",transition:"all 0.2s"}}>
              <input ref={slot.ref} type="file" accept=".csv,.log,.txt,.xlsx" style={{display:"none"}}
                onChange={e=>{ const f=e.target.files?.[0]; if(f) slot.onSet(f); e.target.value="" }}/>
              {slot.file
                ? <div>
                    {slot.desc.includes('.log') ? <FileText size={22} color={slot.color} style={{margin:"0 auto 8px",display:"block"}}/> : <FileSpreadsheet size={22} color={slot.color} style={{margin:"0 auto 8px",display:"block"}}/>}
                    <div style={{fontWeight:700,fontSize:"12px",color:"var(--text)"}}>{slot.file.name}</div>
                    <div style={{fontSize:"11px",color:"var(--text3)"}}>{(slot.file.size/1024).toFixed(0)} KB · klik untuk ganti</div>
                  </div>
                : <div>
                    <Upload size={22} color="var(--text3)" style={{margin:"0 auto 8px",display:"block"}}/>
                    <div style={{fontSize:"12px",fontWeight:600,color:"var(--text)"}}>{slot.desc}</div>
                  </div>
              }
            </div>
          </div>
        ))}
      </div>
 
      {/* Parsing */}
      {parsing && (
        <div className="card" style={{padding:"14px 18px",display:"flex",alignItems:"center",gap:"12px"}}>
          <RefreshCw size={17} color="var(--accent)" style={{animation:"spin 1s linear infinite",flexShrink:0}}/>
          <div>
            <div style={{fontSize:"13px",fontWeight:600,color:"var(--text)"}}>Mengkalkulasi utilisasi...</div>
            {progress.length>0&&<div style={{fontSize:"11px",color:"var(--text3)",marginTop:"2px"}}>{progress[progress.length-1]}</div>}
          </div>
        </div>
      )}
 
      {error && <div style={{background:"var(--danger-bg)",border:"1px solid var(--danger)",borderRadius:"8px",padding:"10px 14px",fontSize:"12px",color:"var(--danger)",display:"flex",gap:"8px"}}><AlertCircle size={14} style={{flexShrink:0}}/>{error}</div>}

      {/* Duplicate warning */}
      {dupWarning && (
        <div style={{background:"#FFFBEB",border:"1.5px solid #FDE68A",borderRadius:"10px",padding:"12px 16px",fontSize:"12px",color:"#92400E",display:"flex",gap:"10px",alignItems:"flex-start"}}>
          <TriangleAlert size={16} style={{flexShrink:0,marginTop:1,color:"#F59E0B"}}/>
          <div>{dupWarning}</div>
        </div>
      )}

      {/* Preview */}
      {parsed.length > 0 && !done && (
        <div className="card" style={{padding:"20px"}}>
          <div style={{fontWeight:700,fontSize:"14px",marginBottom:"4px"}}>
            📊 Preview — {parsed.length} Periode Terdeteksi
          </div>
          <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"16px"}}>
            Utilisasi berbasis login (access log) · Compliance = login days ÷ selling days
          </div>

          {/* Per-month summary cards */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"12px",marginBottom:"16px"}}>
            {parsed.map((p,i)=>{
              const pct = p.summary.utilisation_pct
              const col = pct>=80?"#22C55E":pct>=60?"#F97316":"#EF4444"
              return(
                <div key={i} style={{background:"var(--surface2)",borderRadius:"12px",padding:"14px",border:`1px solid ${col}30`}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"6px"}}>{p.summary.period_label}</div>
                  <div style={{fontSize:"24px",fontWeight:900,color:col,fontFamily:"'Bricolage Grotesque',sans-serif",lineHeight:1,marginBottom:"4px"}}>{pct}%</div>
                  <div style={{fontSize:"11px",color:"var(--text3)",marginBottom:"8px"}}>{p.summary.active_users}/{p.summary.total_users} aktif · {p.summary.selling_days} selling days</div>
                  <div style={{height:4,background:"var(--border)",borderRadius:99,overflow:"hidden",marginBottom:"6px"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:99}}/>
                  </div>
                  <div style={{display:"flex",gap:6,fontSize:"10px"}}>
                    <span style={{color:"#F97316"}}>ADM {p.snapshot.pct_adm}%</span>
                    <span style={{color:"#A855F7"}}>RDM {p.snapshot.pct_rdm}%</span>
                    <span style={{color:"#06B6D4"}}>ADS {p.snapshot.pct_ss}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          {parsed.some(p=>p.realisasi_active!=null) && (
            <div style={{background:"rgba(6,182,212,0.06)",border:"1px solid rgba(6,182,212,0.2)",borderRadius:"10px",padding:"10px 14px",marginBottom:"16px",fontSize:"12px",color:"var(--text2)"}}>
              <span style={{fontWeight:700,color:"#06B6D4"}}>📦 Context Realisasi tersedia</span> — activity_count akan disimpan per periode
            </div>
          )}
 
          {/* Area breakdown — from latest parsed month */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"8px",marginBottom:"16px"}}>
            {(parsed[parsed.length-1]?.areas ?? []).sort((a:AreaRow,b:AreaRow)=>b.utilisation_pct-a.utilisation_pct).map((a:AreaRow,i:number)=>{
              const pct = a.utilisation_pct
              const col = pct>=80?"#22C55E":pct>=60?"#10B981":pct>=40?"#F97316":"#EF4444"
              return(
                <div key={i} style={{background:"var(--surface2)",borderRadius:"10px",padding:"12px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:"4px"}}>
                    <span style={{fontSize:"13px",fontWeight:700}}>{a.aor}</span>
                    <span style={{fontSize:"13px",fontWeight:800,color:col}}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{height:"4px",background:"var(--border)",borderRadius:"99px",overflow:"hidden",marginBottom:"5px"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:"99px"}}/>
                  </div>
                  <div style={{fontSize:"10px",color:"var(--text3)"}}>{a.active_users}/{a.total_users} aktif</div>
                  <div style={{fontSize:"9px",color:"var(--text3)",marginTop:"3px"}}>ADM {a.active_adm}/{a.total_adm} · RDM {a.active_rdm}/{a.total_rdm} · ADS {a.active_ss}/{a.total_ss}</div>
                </div>
              )
            })}
          </div>
 
          {/* Sample users */}
          <div style={{marginBottom:"16px"}}>
            <div style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",marginBottom:"8px"}}>Sample 5 user paling aktif:</div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:"480px",fontSize:"11px"}}>
                <thead><tr style={{borderBottom:"1px solid var(--border)"}}>
                  {["User ID","Nama","Role","Area","Login Days","Compliance"].map(h=>(
                    <th key={h} style={{padding:"5px 8px",textAlign:"left",fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",fontWeight:700}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {(parsed[parsed.length-1]?.users??[]).filter((u:UserRow)=>u.is_active).sort((a:UserRow,b:UserRow)=>b.active_days-a.active_days).slice(0,5).map((u:UserRow,i:number)=>(
                    <tr key={i} style={{borderBottom:"1px solid var(--border2)"}}>
                      <td style={{padding:"6px 8px",fontFamily:"monospace",color:"var(--text3)"}}>{u.user_id}</td>
                      <td style={{padding:"6px 8px",fontWeight:600}}>{u.username}</td>
                      <td style={{padding:"6px 8px"}}><span style={{fontSize:"10px",padding:"1px 6px",borderRadius:"99px",background:u.role==="ADM"?"#FFF7ED":u.role==="RDM"?"#F3E8FF":"#ECFEFF",color:u.role==="ADM"?"#EA580C":u.role==="RDM"?"#9333EA":"#0891B2"}}>{u.role==="SS"?"ADS":u.role}</span></td>
                      <td style={{padding:"6px 8px"}}><span style={{fontSize:"10px",fontWeight:700,color:"var(--accent)"}}>{u.aor}</span></td>
                      <td style={{padding:"6px 8px",fontWeight:600}}>{u.active_days}/{u.selling_days}</td>
                      <td style={{padding:"6px 8px",fontWeight:700,color:u.compliance_pct>=80?"#22C55E":u.compliance_pct>=60?"#F97316":"#EF4444"}}>{u.compliance_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
 
          <div style={{display:"flex",gap:"10px"}}>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading} style={{fontSize:"14px",padding:"12px 28px"}}>
              {uploading?<><RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/> Uploading...</>:<><Database size={15}/> {dupWarning ? "Merge & Upload" : `Upload ${parsed.length} Periode ke Supabase`}</>}
            </button>
            <button className="btn btn-ghost" onClick={reset}><Trash2 size={14}/> Reset</button>
          </div>
        </div>
      )}
 
      {/* Progress */}
      {progress.length>0&&!parsing&&(
        <div className="card" style={{padding:"18px"}}>
          <div style={{fontWeight:700,fontSize:"13px",marginBottom:"10px"}}>Progress Upload</div>
          <div style={{display:"flex",flexDirection:"column",gap:"5px"}}>
            {progress.map((p,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",fontSize:"12px",color:p.startsWith("✅")||p.startsWith("🎉")?"#22C55E":p.startsWith("❌")?"#EF4444":"var(--text2)"}}>
                {p.startsWith("✅")||p.startsWith("🎉")?<CheckCircle size={13} color="#22C55E"/>:p.startsWith("❌")?<AlertCircle size={13}/>:<RefreshCw size={13} style={{animation:"spin 1s linear infinite"}}/>}
                {p}
              </div>
            ))}
          </div>
        </div>
      )}
 
      {/* Done */}
      {done&&(
        <div className="card" style={{padding:"22px",background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.3)"}}>
          <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
            <CheckCircle size={26} color="#22C55E"/>
            <div>
              <div style={{fontWeight:800,fontSize:"15px",color:"#16A34A",marginBottom:"3px"}}>{parsed.length} periode berhasil diupload! 🎉</div>
              <div style={{fontSize:"12px",color:"var(--text2)"}}>{parsed.map(p=>p.summary.period_label).join(" · ")}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"14px"}}>
            <a href="/landing/ficom-lite" target="_blank"><button className="btn btn-primary"><Eye size={14}/> Lihat Landing</button></a>
            <button className="btn btn-ghost" onClick={reset}>Upload Baru</button>
          </div>
        </div>
      )}
 
      {/* ── Data Viewer ── */}
      <div style={{borderTop:"2px solid var(--border)",paddingTop:20}}>
        <div style={{fontWeight:700,fontSize:15,color:"var(--text)",marginBottom:14}}>📂 Data Tersimpan & Maintenance</div>
        <FicomLiteDataViewer refreshKey={viewerKey}/>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Ficom Lite Data Viewer ─────────────────────────────────────
function FicomLiteDataViewer({refreshKey}:{refreshKey:number}) {
  const [periods,    setPeriods]    = useState<string[]>([])
  const [selPeriod,  setSelPeriod]  = useState("")
  const [users,      setUsers]      = useState<UserRow[]>([])
  const [loading,    setLoading]    = useState(false)
  const [search,     setSearch]     = useState("")
  const [roleFilter, setRoleFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [deleting,   setDeleting]   = useState<string|null>(null)

  useEffect(()=>{
    supabase.from("fl_snapshots").select("period_month,period_label").order("period_month",{ascending:false})
      .then(({data})=>{
        if(data?.length){
          const opts = data.map(d=>d.period_month as string)
          setPeriods(opts); setSelPeriod(opts[0])
        }
      })
  },[refreshKey])

  useEffect(()=>{
    if(!selPeriod) return
    setLoading(true)
    supabase.from("fl_users").select("*").eq("period_month",selPeriod).order("aor").order("username")
      .then(({data})=>{ setUsers((data??[]) as UserRow[]); setLoading(false) })
  },[selPeriod])

  const filtered = useMemo(()=>users.filter(u=>{
    const q=search.toLowerCase()
    const mQ=!q||u.user_id.toLowerCase().includes(q)||u.username.toLowerCase().includes(q)
    const mR=roleFilter==="ALL"||(u.role==="SS"?"ADS":u.role)===roleFilter
    const mS=statusFilter==="ALL"||(statusFilter==="ACTIVE"?u.is_active===1:u.is_active===0)
    return mQ&&mR&&mS
  }),[users,search,roleFilter,statusFilter])

  const deleteUser = async(userId:string)=>{
    if(!confirm(`Hapus user ${userId} dari periode ${selPeriod}?`)) return
    setDeleting(userId)
    await supabase.from("fl_users").delete().eq("period_month",selPeriod).eq("user_id",userId)
    setUsers(p=>p.filter(u=>u.user_id!==userId))
    setDeleting(null)
  }

  const deletePeriod = async()=>{
    if(!confirm(`Hapus SEMUA data Ficom Lite periode ${selPeriod}?`)) return
    await Promise.all([
      supabase.from("fl_users").delete().eq("period_month",selPeriod),
      supabase.from("fl_areas").delete().eq("period_month",selPeriod),
      supabase.from("fl_snapshots").delete().eq("period_month",selPeriod),
    ])
    setPeriods(p=>p.filter(x=>x!==selPeriod))
    setUsers([]); setSelPeriod(prev=>periods.find(p=>p!==prev)??"")
  }

  const activeCount=users.filter(u=>u.is_active===1).length
  const utilisasi=users.length?Math.round(activeCount/users.length*100):0
  const ROLE_CLR: Record<string,string> = {ADM:"#F97316",RDM:"#A855F7",SS:"#06B6D4",ADS:"#06B6D4"}
  const AOR_CLR: Record<string,string>  = {GMA:"#F97316",MIN:"#3B82F6",NOL:"#22C55E",SOL:"#EF4444",VIS:"#A855F7"}

  if(!periods.length) return(
    <div className="card" style={{padding:"24px",textAlign:"center",color:"var(--text3)"}}>
      <div style={{fontSize:28,marginBottom:8}}>📭</div>
      <div style={{fontWeight:600}}>Belum ada data tersimpan</div>
      <div style={{fontSize:12,marginTop:4}}>Upload EDI di atas untuk mulai menyimpan data</div>
    </div>
  )

  return(
    <div className="card" style={{overflow:"hidden"}}>
      {/* Header */}
      <div style={{padding:"14px 18px",borderBottom:"1px solid var(--border)",background:"var(--surface)",display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{fontWeight:700,fontSize:14,color:"var(--text)"}}>📋 Data Tersimpan — Ficom Lite</div>
        <select value={selPeriod} onChange={e=>setSelPeriod(e.target.value)} className="input" style={{fontSize:12,width:"auto",minWidth:140}}>
          {periods.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        {!loading&&users.length>0&&(
          <div style={{display:"flex",gap:8}}>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99,background:"#ECFDF5",color:"#16a34a"}}>{activeCount}/{users.length} aktif</span>
            <span style={{fontSize:11,fontWeight:700,padding:"3px 10px",borderRadius:99,background:utilisasi>=80?"#ECFDF5":utilisasi>=60?"#FEF3C7":"#FEF2F2",color:utilisasi>=80?"#16a34a":utilisasi>=60?"#92400E":"#dc2626"}}>{utilisasi}% utilisasi</span>
          </div>
        )}
        <div style={{marginLeft:"auto",display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{position:"relative"}}>
            <Search size={12} style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:"var(--text3)"}}/>
            <input className="input" placeholder="Search WF / name…" value={search} onChange={e=>setSearch(e.target.value)} style={{paddingLeft:26,fontSize:11,width:150}}/>
          </div>
          <select className="input" style={{fontSize:11,width:"auto"}} value={roleFilter} onChange={e=>setRoleFilter(e.target.value)}>
            <option value="ALL">All Role</option>
            {["ADM","RDM","ADS"].map(r=><option key={r}>{r}</option>)}
          </select>
          <select className="input" style={{fontSize:11,width:"auto"}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Tidak Aktif</option>
          </select>
          <button onClick={deletePeriod} style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"5px 12px",cursor:"pointer",color:"#dc2626",fontSize:11,fontWeight:700,display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
            <Trash2 size={12}/> Hapus Periode
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{overflowX:"auto",maxHeight:480,overflowY:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead style={{position:"sticky",top:0,zIndex:2}}>
            <tr style={{background:"var(--surface)",borderBottom:"1px solid var(--border)"}}>
              {["No","User ID","Username","Role","AOR","Login Days","Selling Days","Compliance","Status",""].map(h=>(
                <th key={h} style={{padding:"8px 11px",textAlign:"left",fontSize:10,fontWeight:800,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.07em",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading?(
              <tr><td colSpan={10} style={{padding:"32px",textAlign:"center",color:"var(--text3)"}}>
                <RefreshCw size={16} style={{animation:"spin 1s linear infinite",display:"inline",marginRight:8}}/>Loading…
              </td></tr>
            ):filtered.length===0?(
              <tr><td colSpan={10} style={{padding:"24px",textAlign:"center",color:"var(--text3)"}}>No data found</td></tr>
            ):filtered.map((u,i)=>{
              const roleLabel=u.role==="SS"?"ADS":u.role
              const rc=ROLE_CLR[u.role]??"#888"
              const ac=AOR_CLR[u.aor]??"#888"
              const cp=u.compliance_pct
              const compCol=cp>=80?"#22C55E":cp>=60?"#F97316":"#EF4444"
              return(
                <tr key={u.user_id} style={{borderBottom:"1px solid var(--border)",background:u.is_active?"transparent":"var(--surface2)"}}>
                  <td style={{padding:"8px 11px",color:"var(--text3)",fontSize:11}}>{i+1}</td>
                  <td style={{padding:"8px 11px",fontFamily:"monospace",fontWeight:700,color:"var(--accent)",fontSize:11}}>{u.user_id}</td>
                  <td style={{padding:"8px 11px",maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.username}</td>
                  <td style={{padding:"8px 11px"}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,background:`${rc}18`,color:rc}}>{roleLabel}</span>
                  </td>
                  <td style={{padding:"8px 11px"}}>
                    <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,background:`${ac}18`,color:ac}}>{u.aor||"—"}</span>
                  </td>
                  <td style={{padding:"8px 11px",fontWeight:700,color:u.is_active?"var(--text)":"var(--text3)"}}>{u.active_days}</td>
                  <td style={{padding:"8px 11px",color:"var(--text3)"}}>{u.selling_days}</td>
                  <td style={{padding:"8px 11px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <div style={{width:40,height:5,background:"var(--surface3)",borderRadius:99,overflow:"hidden",flexShrink:0}}>
                        <div style={{height:"100%",width:`${Math.min(cp,100)}%`,background:compCol,borderRadius:99}}/>
                      </div>
                      <span style={{fontSize:11,fontWeight:700,color:compCol}}>{cp.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td style={{padding:"8px 11px"}}>
                    <span style={{fontSize:10,fontWeight:700,color:u.is_active?"#16a34a":"#9CA3AF"}}>
                      {u.is_active?"● Aktif":"○ Tidak Aktif"}
                    </span>
                  </td>
                  <td style={{padding:"8px 11px"}}>
                    <button onClick={()=>deleteUser(u.user_id)} disabled={deleting===u.user_id}
                      style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",opacity:deleting===u.user_id?0.5:0.6,padding:"3px 6px",borderRadius:6}}
                      onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.6"}>
                      <Trash2 size={13}/>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{padding:"8px 14px",borderTop:"1px solid var(--border)",fontSize:11,color:"var(--text3)",display:"flex",justifyContent:"space-between"}}>
        <span>Showing {filtered.length} of {users.length} users</span>
        <span>Period: {selPeriod}</span>
      </div>
    </div>
  )
}