"use client"
// PATH: src/app/dashboard/ficom-lite-upload/page.tsx
//
// KONSEP UTILISASI FICOM LITE:
// - Master user = ADM (rsm_id) + RDM (grsm_id) + SS/ADS (ss_id) dari productivity data
// - Aktif = user yang muncul di access_log (ficom-lite-dashboard / leaderboard / leaderboard-detail)
// - Utilisasi = active_users / total_users × 100
// - Compliance = unique login days / selling_days × 100
 
import { useState, useRef, useCallback } from "react"
import { Upload, CheckCircle, AlertCircle, RefreshCw, FileText, Eye, Trash2, Database, FileSpreadsheet } from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"
 
// ── Types ─────────────────────────────────────────────────────
interface ParsedFL {
  snapshot: SnapRow; areas: AreaRow[]; users: UserRow[]
  summary: { period_label:string; period_month:string; as_of_date:string; selling_days:number; total_users:number; active_users:number; utilisation_pct:number }
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
  prodFile: File,        // processed_productivity_data.csv
  logFile: File,         // access_log_ficom-lite_PHI_xxx.log
  onProgress: (msg:string)=>void
): Promise<ParsedFL> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (await import("xlsx")) as any
  const s = (v:unknown) => String(v||"").trim()
 
  // ── 1. Parse productivity data → build user master ──
  onProgress("⏳ Reading productivity master...")
  const prodBuf = await prodFile.arrayBuffer()
  const prodWb  = XLSX.read(prodBuf, { type:"array" })
  const prodWs  = prodWb.Sheets[prodWb.SheetNames[0]]
  const prodRows: Record<string,string>[] = XLSX.utils.sheet_to_json(prodWs, { raw:false })
 
  // User master: keyed by WF ID
  const userMaster: Record<string, {
    username:string; role:"ADM"|"RDM"|"SS"; aor:string
    rdm_name:string; sub_aor:string; grsm_id:string
  }> = {}
 
  for(const r of prodRows) {
    const gnm    = s(r["grsm_nm"])
    const area   = getArea(gnm)
    if(!VALID_AORS.has(area)) continue
    const rdmName = gnm.includes(" - ") ? gnm.split(" - ").slice(1).join(" - ") : gnm
 
    // ADM: rsm_id / rsm_nm
    const admId  = s(r["rsm_id"])
    const admNm  = s(r["rsm_nm"])
    if(admId.startsWith("WF") && !userMaster[admId]) {
      const subAor = admNm.includes(" - ") ? admNm.split(" - ")[0] : admNm
      const name   = admNm.includes(" - ") ? admNm.split(" - ").slice(1).join(" - ") : admNm
      userMaster[admId] = { username:name||admNm, role:"ADM", aor:area, rdm_name:rdmName, sub_aor:subAor, grsm_id:s(r["grsm_id"]) }
    }
 
    // RDM: grsm_id / grsm_nm
    const rdmId = s(r["grsm_id"])
    if(rdmId.startsWith("WF") && !userMaster[rdmId]) {
      const name = gnm.includes(" - ") ? gnm.split(" - ").slice(1).join(" - ") : gnm
      userMaster[rdmId] = { username:name||gnm, role:"RDM", aor:area, rdm_name:rdmName, sub_aor:gnm.split(" - ")[0]||area, grsm_id:rdmId }
    }
 
    // SS/ADS: ss_id / ss_nm
    const ssId = s(r["ss_id"])
    const ssNm = s(r["ss_nm"])
    if(ssId.startsWith("WF") && !userMaster[ssId]) {
      const subAor = ssNm.includes(" - ") ? ssNm.split(" - ")[0] : ssNm
      const name   = ssNm.includes(" - ") ? ssNm.split(" - ").slice(1).join(" - ") : ssNm
      userMaster[ssId] = { username:name||ssNm, role:"SS", aor:area, rdm_name:rdmName, sub_aor:subAor, grsm_id:rdmId }
    }
  }
 
  const totalMaster = Object.keys(userMaster).length
  onProgress(`✅ Productivity master: ${totalMaster} users (ADM/RDM/ADS)`)
 
  // ── 2. Parse access log ──
  onProgress("⏳ Reading access log...")
  const logText = await logFile.text()
  const logLines = logText.split("\n").map(l=>l.trim()).filter(l=>l)
 
  // date | page | user_id
  const userLog: Record<string, { dates:Set<string>; pages:Set<string>; lastDate:string }> = {}
  let minDate = "9999-12-31"; let maxDate = "0000-01-01"
 
  for(const line of logLines) {
    const parts = line.split("|")
    if(parts.length < 3) continue
    const dt  = parts[0].trim()
    const pg  = parts[1].trim()
    const uid = parts[2].trim()
    if(!uid || uid === "brt" || uid === "VUONO123") continue
 
    if(!userLog[uid]) userLog[uid] = { dates:new Set(), pages:new Set(), lastDate:"" }
    userLog[uid].dates.add(dt)
    userLog[uid].pages.add(pg)
    if(dt > userLog[uid].lastDate) userLog[uid].lastDate = dt
    if(dt < minDate) minDate = dt
    if(dt > maxDate) maxDate = dt
  }
 
  const logUserIds = new Set(Object.keys(userLog))
  onProgress(`✅ Access log: ${logUserIds.size} unique users · ${minDate} to ${maxDate}`)
 
  // ── 3. Calculate selling days ──
  const startDate = new Date(minDate)
  const endDate   = new Date(maxDate)
  let sellingDays = 0
  const cur = new Date(startDate)
  while(cur <= endDate) {
    if(cur.getDay() !== 0) sellingDays++
    cur.setDate(cur.getDate() + 1)
  }
 
  // Period info
  const periodMonth = maxDate.slice(0, 7)
  const periodD     = new Date(maxDate)
  const periodNum   = periodD.getMonth() + 1
  const periodLabel = `Period ${periodNum} (${periodD.toLocaleDateString("en-US",{month:"long",year:"numeric"})})`
 
  // ── 4. Build user rows ──
  const VALID_AREA = new Set(["GMA","MIN","NOL","SOL","VIS"])
  const userRows: UserRow[] = []
 
  for(const [uid, info] of Object.entries(userMaster)) {
    if(!VALID_AREA.has(info.aor)) continue
    const logInfo   = userLog[uid]
    const isActive  = logInfo ? 1 : 0
    const activeDays = logInfo ? logInfo.dates.size : 0
    const compPct   = sellingDays ? Math.round(activeDays / sellingDays * 1000) / 10 : 0
    const pages     = logInfo ? [...logInfo.pages].join(",") : ""
    const lastDate  = logInfo?.lastDate || null
 
    userRows.push({
      period_month: periodMonth, user_id: uid, username: info.username,
      role: info.role, aor: info.aor, rdm_name: info.rdm_name, sub_aor: info.sub_aor,
      active_days: activeDays, selling_days: sellingDays,
      compliance_pct: compPct, last_access_date: lastDate,
      is_active: isActive, pages_accessed: pages,
    })
  }
 
  // ── 5. Area aggregation ──
  const areaMap: Record<string, {
    total:number; active:number
    adm_t:number; adm_a:number; rdm_t:number; rdm_a:number; ss_t:number; ss_a:number
  }> = {}
 
  for(const u of userRows) {
    if(!areaMap[u.aor]) areaMap[u.aor] = {total:0,active:0,adm_t:0,adm_a:0,rdm_t:0,rdm_a:0,ss_t:0,ss_a:0}
    const m = areaMap[u.aor]
    m.total++; if(u.is_active) m.active++
    if(u.role==="ADM"){ m.adm_t++; if(u.is_active) m.adm_a++ }
    if(u.role==="RDM"){ m.rdm_t++; if(u.is_active) m.rdm_a++ }
    if(u.role==="SS") { m.ss_t++;  if(u.is_active) m.ss_a++  }
  }
 
  const areaRows: AreaRow[] = Object.entries(areaMap).map(([aor,m])=>({
    period_month:periodMonth, aor,
    total_users:m.total, active_users:m.active,
    utilisation_pct: m.total ? Math.round(m.active/m.total*1000)/10 : 0,
    total_adm:m.adm_t, active_adm:m.adm_a,
    total_rdm:m.rdm_t, active_rdm:m.rdm_a,
    total_ss:m.ss_t,   active_ss:m.ss_a,
  }))
 
  // ── 6. Snapshot ──
  const totalU = userRows.length
  const activeU = userRows.filter(u=>u.is_active).length
  const rolesAll = {
    adm_t:0,adm_a:0, rdm_t:0,rdm_a:0, ss_t:0,ss_a:0
  }
  for(const u of userRows) {
    if(u.role==="ADM"){ rolesAll.adm_t++; if(u.is_active) rolesAll.adm_a++ }
    if(u.role==="RDM"){ rolesAll.rdm_t++; if(u.is_active) rolesAll.rdm_a++ }
    if(u.role==="SS") { rolesAll.ss_t++;  if(u.is_active) rolesAll.ss_a++  }
  }
 
  const snapshot: SnapRow = {
    period_label:periodLabel, period_month:periodMonth, as_of_date:maxDate, selling_days:sellingDays,
    total_users:totalU, active_users:activeU,
    utilisation_pct: totalU ? Math.round(activeU/totalU*1000)/10 : 0,
    total_adm:rolesAll.adm_t, active_adm:rolesAll.adm_a,
    pct_adm: rolesAll.adm_t ? Math.round(rolesAll.adm_a/rolesAll.adm_t*1000)/10 : 0,
    total_rdm:rolesAll.rdm_t, active_rdm:rolesAll.rdm_a,
    pct_rdm: rolesAll.rdm_t ? Math.round(rolesAll.rdm_a/rolesAll.rdm_t*1000)/10 : 0,
    total_ss:rolesAll.ss_t, active_ss:rolesAll.ss_a,
    pct_ss: rolesAll.ss_t ? Math.round(rolesAll.ss_a/rolesAll.ss_t*1000)/10 : 0,
  }
 
  return {
    snapshot, areas:areaRows, users:userRows,
    summary: {
      period_label:periodLabel, period_month:periodMonth,
      as_of_date:maxDate, selling_days:sellingDays,
      total_users:totalU, active_users:activeU,
      utilisation_pct:snapshot.utilisation_pct,
    }
  }
}
 
// ── Upload to Supabase ─────────────────────────────────────────
async function uploadToSupabase(data:ParsedFL, onProgress:(msg:string)=>void) {
  const pm = data.summary.period_month
 
  onProgress("⏳ Uploading snapshot...")
  const { error:e1 } = await supabase.from("fl_snapshots").upsert([data.snapshot], { onConflict:"period_month" })
  if(e1) throw new Error(`Snapshot: ${e1.message}`)
  onProgress(`✅ Snapshot: ${pm}`)
 
  onProgress("⏳ Clearing old area data...")
  await supabase.from("fl_areas").delete().eq("period_month", pm)
  const { error:e2 } = await supabase.from("fl_areas").insert(data.areas)
  if(e2) throw new Error(`Areas: ${e2.message}`)
  onProgress(`✅ Areas: ${data.areas.length}`)
 
  onProgress("⏳ Clearing old user data...")
  await supabase.from("fl_users").delete().eq("period_month", pm)
  const chunk = 200
  for(let i=0; i<data.users.length; i+=chunk) {
    const { error:e3 } = await supabase.from("fl_users").insert(data.users.slice(i, i+chunk))
    if(e3) throw new Error(`Users: ${e3.message}`)
    onProgress(`⏳ Users: ${Math.min(i+chunk, data.users.length)}/${data.users.length}`)
  }
  onProgress(`✅ Users: ${data.users.length}`)
  onProgress("🎉 Ficom Lite data uploaded!")
}
 
// ── MAIN PAGE ─────────────────────────────────────────────────
export default function FicomLiteUploadPage() {
  const prodRef = useRef<HTMLInputElement>(null)
  const logRef  = useRef<HTMLInputElement>(null)
  const [prodFile,  setProdFile]  = useState<File|null>(null)
  const [logFile,   setLogFile]   = useState<File|null>(null)
  const [parsed,    setParsed]    = useState<ParsedFL|null>(null)
  const [parsing,   setParsing]   = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress,  setProgress]  = useState<string[]>([])
  const [error,     setError]     = useState("")
  const [done,      setDone]      = useState(false)
 
  const tryParse = useCallback(async(prod:File|null, log:File|null)=>{
    if(!prod||!log) return
    setError(""); setParsed(null); setDone(false); setProgress([]); setParsing(true)
    try {
      const d = await parseFicomLite(prod, log, msg=>setProgress(p=>[...p,msg]))
      setParsed(d)
    } catch(e) {
      setError(e instanceof Error ? e.message : "Parse failed")
    } finally { setParsing(false) }
  }, [])
 
  const handleUpload = async() => {
    if(!parsed) return
    setUploading(true); setProgress([]); setError(""); setDone(false)
    try {
      await uploadToSupabase(parsed, msg=>setProgress(p=>[...p,msg]))
      setDone(true)
    } catch(e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally { setUploading(false) }
  }
 
  const reset = () => { setProdFile(null); setLogFile(null); setParsed(null); setProgress([]); setError(""); setDone(false) }
 
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
        <div style={{fontSize:"11px",fontWeight:700,color:"#16A34A",marginBottom:"8px"}}>💡 Konsep Utilisasi Ficom Lite</div>
        <div style={{fontSize:"11px",color:"var(--text2)",lineHeight:1.7}}>
          <strong>Utilisasi = siapa yang sudah LOGIN ke Ficom Lite</strong> (bukan visit ke outlet)<br/>
          Source data: <code>access_log</code> → siapa yang buka ficom-lite-dashboard / leaderboard<br/>
          Master user: <code>productivity</code> → ADM (<code>rsm_id</code>) + RDM (<code>grsm_id</code>) + ADS (<code>ss_id</code>)<br/>
          Compliance: unique login days ÷ selling days × 100
        </div>
      </div>
 
      {/* File uploads */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"16px"}}>
        {[
          {
            num:"1", label:"Productivity Master", color:"#22C55E",
            desc:"processed_productivity_data.csv",
            hint:"Kolom: rsm_id, rsm_nm, grsm_id, grsm_nm, ss_id, ss_nm",
            file:prodFile, ref:prodRef,
            onSet:(f:File)=>{ setProdFile(f); tryParse(f, logFile) }
          },
          {
            num:"2", label:"Access Log", color:"#10B981",
            desc:"access_log_ficom-lite_PHI_xxx.log",
            hint:"Format: YYYY-MM-DD | page | user_id (one per line)",
            file:logFile, ref:logRef,
            onSet:(f:File)=>{ setLogFile(f); tryParse(prodFile, f) }
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
 
      {/* Preview */}
      {parsed && !done && (
        <div className="card" style={{padding:"20px"}}>
          <div style={{fontWeight:700,fontSize:"14px",marginBottom:"16px"}}>📊 Preview Hasil</div>
 
          {/* Main metrics */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"12px",marginBottom:"16px"}}>
            {[
              {l:"Period",       v:parsed.summary.period_label,                          c:"var(--accent)"},
              {l:"As of Date",   v:parsed.summary.as_of_date,                            c:"var(--accent)"},
              {l:"Selling Days", v:`${parsed.summary.selling_days} hari`,                c:"#F97316"},
              {l:"Total Users",  v:parsed.summary.total_users.toLocaleString(),          c:"var(--text)"},
              {l:"Aktif Login",  v:parsed.summary.active_users.toLocaleString(),         c:"#22C55E"},
              {l:"Utilisasi",    v:`${parsed.summary.utilisation_pct}%`,                 c:"#22C55E"},
              {l:"% ADM Aktif",  v:`${parsed.snapshot.pct_adm}% (${parsed.snapshot.active_adm}/${parsed.snapshot.total_adm})`,c:"#F97316"},
              {l:"% RDM Aktif",  v:`${parsed.snapshot.pct_rdm}% (${parsed.snapshot.active_rdm}/${parsed.snapshot.total_rdm})`,c:"#A855F7"},
              {l:"% ADS Aktif",  v:`${parsed.snapshot.pct_ss}% (${parsed.snapshot.active_ss}/${parsed.snapshot.total_ss})`,  c:"#06B6D4"},
            ].map((s,i)=>(
              <div key={i} style={{background:"var(--surface2)",borderRadius:"12px",padding:"12px"}}>
                <div style={{fontSize:"9px",color:"var(--text3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"5px"}}>{s.l}</div>
                <div style={{fontSize:"clamp(12px,2vw,16px)",fontWeight:900,color:s.c,fontFamily:"'Bricolage Grotesque',sans-serif",lineHeight:1.2}}>{s.v}</div>
              </div>
            ))}
          </div>
 
          {/* Area breakdown */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"8px",marginBottom:"16px"}}>
            {parsed.areas.sort((a,b)=>b.utilisation_pct-a.utilisation_pct).map((a,i)=>{
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
                  {["User ID","Nama","Role","Area","Hari Aktif","Compliance"].map(h=>(
                    <th key={h} style={{padding:"5px 8px",textAlign:"left",fontSize:"9px",color:"var(--text3)",textTransform:"uppercase",fontWeight:700}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {parsed.users.filter(u=>u.is_active).sort((a,b)=>b.active_days-a.active_days).slice(0,5).map((u,i)=>(
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
              {uploading?<><RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/> Uploading...</>:<><Database size={15}/> Upload ke Supabase</>}
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
              <div style={{fontWeight:800,fontSize:"15px",color:"#16A34A",marginBottom:"3px"}}>Ficom Lite data uploaded! 🎉</div>
              <div style={{fontSize:"12px",color:"var(--text2)"}}>
                {parsed?.summary.active_users}/{parsed?.summary.total_users} users aktif · {parsed?.summary.utilisation_pct}% utilisasi · {parsed?.summary.period_label}
              </div>
            </div>
          </div>
          <div style={{display:"flex",gap:"10px",marginTop:"14px"}}>
            <a href="/landing/ficom-lite" target="_blank"><button className="btn btn-primary"><Eye size={14}/> View Landing</button></a>
            <button className="btn btn-ghost" onClick={reset}>Upload Periode Baru</button>
          </div>
        </div>
      )}
 
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}