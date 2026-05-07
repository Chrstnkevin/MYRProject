"use client"
// PATH: src/app/dashboard/vm-db/page.tsx

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Upload, RefreshCw, Database, Copy, Check, Calendar, Server, X, CheckCircle, AlertCircle } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"

interface DriveInfo   { drive:string; free:number; total:number; used:number; usedPct:number }
interface VMEntry     { vm:string; drives:DriveInfo[]; date:string }
interface ParsedResult{ mondays:string[]; vmsByMonday:Record<string,VMEntry[]> }
interface SavedRecord { id:string; week_date:string; week_label:string; vm:string; drive:string; free_gb:number; total_gb:number; used_gb:number; used_pct:number }

const VM_STRUCTURE: Record<string,string[]> = {
  "1":["C","D","E","F","G"], "2":["E","F"],           "3":["D"],
  "4":["C","D","E","F","G"], "5":["C","D","E"],
  "6":["C","D","E","F"],     "7":["C","D","E","F","G"], "8":["C","D","E","F","G","H"],
  "9":["C","D","E","F"],     "10":["C","D","E","F"],    "11":["C","D","E","F"],
  "12":["C","D","E","F","G"],"13":["C","D","E","F","G"],"14":["C","D","E","F","G"],
}
const ALL_VMS = Object.keys(VM_STRUCTURE)

function getISOWeek(d:Date){const dt=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));dt.setUTCDate(dt.getUTCDate()+4-(dt.getUTCDay()||7));const y0=new Date(Date.UTC(dt.getUTCFullYear(),0,1));return Math.ceil(((dt.getTime()-y0.getTime())/86400000+1)/7)}
function getMondayOf(dt:Date){const d=new Date(dt);d.setDate(d.getDate()-(d.getDay()===0?6:d.getDay()-1));return d.toISOString().split("T")[0]}
function weekLabel(iso:string){const d=new Date(iso);return `Week ${getISOWeek(d)} · ${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getFullYear()).slice(2)}`}

function parseChat(text:string):ParsedResult{
  const msgPat=/\[(\d{2}\/\d{2}\/\d{2}),\s+\d{2}\.\d{2}\.\d{2}\]\s+[\u202f\s]*~[\u202f\s]*Assion-Bot:\s*/g
  const parts:string[]=[],dates:string[]=[]
  let last=0,m
  while((m=msgPat.exec(text))!==null){if(last>0)parts.push(text.slice(last,m.index));dates.push(m[1]);last=m.index+m[0].length}
  if(last>0)parts.push(text.slice(last))
  const mondayMap:Record<string,Record<string,VMEntry>>={}
  for(let i=0;i<parts.length;i++){
    const body=parts[i]||"",dateStr=dates[i]||""
    if(!body.includes("[READY] VM DB"))continue
    const vmM=body.match(/\[READY\] VM DB (\d+)/);if(!vmM)continue
    const drives:DriveInfo[]=[],dPat=/-\s+([A-Z]):?\s+([\d.]+)\s+GB free of\s+([\d.]+)\s+GB/g
    let dm;while((dm=dPat.exec(body))!==null){const free=parseFloat(dm[2]),total=parseFloat(dm[3]);drives.push({drive:dm[1],free,total,used:Math.round((total-free)*10)/10,usedPct:Math.round((total-free)/total*100)})}
    if(!drives.length)continue
    try{
      const [dd,mm,yy]=dateStr.split("/")
      const dt=new Date(2000+parseInt(yy),parseInt(mm)-1,parseInt(dd))
      const monday=getMondayOf(dt)
      if(!mondayMap[monday])mondayMap[monday]={}
      const ex=mondayMap[monday][vmM[1]]
      const newDt=dt.getTime()
      const exDt=ex?new Date(ex.date.split("/").map((v:string,i:number)=>i===2?"20"+v:v).reverse().join("-")).getTime():0
      if(!ex||newDt>exDt)mondayMap[monday][vmM[1]]={vm:vmM[1],drives,date:dateStr}
    }catch{}
  }
  const vmsByMonday:Record<string,VMEntry[]>={}
  for(const[mon,vmMap]of Object.entries(mondayMap))vmsByMonday[mon]=Object.values(vmMap).sort((a,b)=>parseInt(a.vm)-parseInt(b.vm))
  return{mondays:Object.keys(vmsByMonday).sort(),vmsByMonday}
}

const usedBg =(p:number)=>p>=90?"#FEE2E2":p>=75?"#FEF3C7":p>=50?"#FFFBEB":"transparent"
const usedFg =(p:number)=>p>=90?"#DC2626":p>=75?"#D97706":p>=50?"#92400E":"inherit"
const freeFg =(p:number)=>p>=90?"#DC2626":p>=75?"#D97706":"#059669"
const barClr =(p:number)=>p>=90?"#EF4444":p>=75?"#F59E0B":p>=50?"#10B981":"#059669"

export default function VMDBPage(){
  const fileRef=useRef<HTMLInputElement>(null)
  const [showUpload,setShowUpload]=useState(false)
  const [parsed,setParsed]=useState<ParsedResult|null>(null)
  const [selMonday,setSelMonday]=useState("")
  const [parsing,setParsing]=useState(false)
  const [saving,setSaving]=useState(false)
  const [saved,setSaved]=useState(false)
  const [error,setError]=useState("")
  const [copied,setCopied]=useState(false)
  const [history,setHistory]=useState<SavedRecord[]>([])
  const [selHist,setSelHist]=useState("")
  const [histLoading,setHistLoading]=useState(false)
  const [viewMode,setViewMode]=useState<"parsed"|"history">("parsed")

  const loadHistory=useCallback(async()=>{
    setHistLoading(true)
    const{data}=await supabase.from("vm_db_records").select("*").order("week_date",{ascending:false})
    if(data)setHistory(data as SavedRecord[])
    setHistLoading(false)
  },[])
  useEffect(()=>{loadHistory()},[loadHistory])

  const handleFile=async(file:File)=>{
    setError("");setSaved(false);setParsing(true)
    try{
      const text=await file.text()
      const result=parseChat(text)
      if(!result.mondays.length)throw new Error("Tidak ada data VM DB ditemukan")
      setParsed(result)
      const lp=getMondayOf(new Date())
      setSelMonday(result.mondays.includes(lp)?lp:result.mondays[result.mondays.length-1])
      setShowUpload(false);setViewMode("parsed")
    }catch(e){setError(e instanceof Error?e.message:"Parse failed")}
    finally{setParsing(false)}
  }

  const currentVMs=useMemo(()=>parsed?.vmsByMonday[selMonday]??[],[parsed,selMonday])
  const vmDriveMap=useMemo(()=>{
    const map:Record<string,Record<string,DriveInfo>>={}
    currentVMs.forEach(vm=>{map[vm.vm]={};vm.drives.forEach(d=>{map[vm.vm][d.drive]=d})})
    return map
  },[currentVMs])

  const histDates=useMemo(()=>[...new Set(history.map(r=>r.week_date))].sort().reverse(),[history])
  const histMap=useMemo(()=>{
    if(!selHist)return{}
    const map:Record<string,Record<string,SavedRecord>>={}
    history.filter(r=>r.week_date===selHist).forEach(r=>{if(!map[r.vm])map[r.vm]={};map[r.vm][r.drive]=r})
    return map
  },[history,selHist])

  const handleSave=async()=>{
    if(!currentVMs.length||!selMonday)return
    setSaving(true);setError("")
    try{
      const rows=ALL_VMS.flatMap(vm=>(VM_STRUCTURE[vm]||[]).map(drive=>{const d=vmDriveMap[vm]?.[drive];if(!d)return null;return{week_date:selMonday,week_label:weekLabel(selMonday),vm,drive,free_gb:d.free,total_gb:d.total,used_gb:d.used,used_pct:d.usedPct}}).filter(Boolean))
      await supabase.from("vm_db_records").delete().eq("week_date",selMonday)
      const{error:e}=await supabase.from("vm_db_records").insert(rows)
      if(e)throw new Error(e.message)
      setSaved(true);loadHistory()
    }catch(e){setError(e instanceof Error?e.message:"Save failed")}
    finally{setSaving(false)}
  }

  const handleCopy=()=>{
    const lines=ALL_VMS.flatMap(vm=>(VM_STRUCTURE[vm]||[]).map(drive=>{const d=vmDriveMap[vm]?.[drive];return d?String(d.free):""}))
    navigator.clipboard.writeText(lines.join("\n"))
    setCopied(true);setTimeout(()=>setCopied(false),2000)
  }

  const isHistory=viewMode==="history"
  const activeMap=isHistory?histMap:vmDriveMap

  // Render spreadsheet table
  const renderTable=(map:typeof activeMap)=>(
    <div style={{overflowX:"auto"}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontFamily:"'Consolas','Menlo',monospace",fontSize:12}}>
        <thead>
          <tr style={{background:"#1B4332",color:"white"}}>
            {["VM","DRV","TERPAKAI","FREE","TOTAL","% PAKAI"].map((h,i)=>(
              <th key={h} style={{padding:"7px "+(i===0?"14px":"12px"),textAlign:i<=1?"left":"right",fontSize:10,fontWeight:700,letterSpacing:"0.07em",borderRight:i<5?"1px solid rgba(255,255,255,0.12)":undefined,whiteSpace:"nowrap",minWidth:i===0?90:i===5?110:80}}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ALL_VMS.map((vm,vi)=>{
            const drives=VM_STRUCTURE[vm]||[]
            const hasData=!!map[vm]
            return drives.map((drive,di)=>{
              const raw=map[vm]?.[drive]
              const used  =raw?(isHistory?(raw as SavedRecord).used_gb :(raw as DriveInfo).used )  :null
              const free  =raw?(isHistory?(raw as SavedRecord).free_gb :(raw as DriveInfo).free )  :null
              const total =raw?(isHistory?(raw as SavedRecord).total_gb:(raw as DriveInfo).total)  :null
              const pct   =raw?(isHistory?(raw as SavedRecord).used_pct:(raw as DriveInfo).usedPct):null
              const isFirst=di===0
              const evenBg=vi%2===0?"#F9FAFB":"#FFFFFF"
              const rowBg=pct!=null&&pct>=90?"#FFF5F5":pct!=null&&pct>=75?"#FFFBF0":evenBg
              return(
                <tr key={`${vm}-${drive}`} style={{background:rowBg}}>
                  {isFirst&&(
                    <td rowSpan={drives.length} style={{
                      padding:"0 14px",background:hasData?"#064E3B":"#6B7280",color:"white",
                      fontWeight:800,fontSize:12,borderRight:"2px solid #D1FAE5",
                      verticalAlign:"middle",whiteSpace:"nowrap",
                      borderBottom:"2px solid #D1D5DB",letterSpacing:"0.03em"
                    }}>
                      VM DB {vm}
                    </td>
                  )}
                  <td style={{padding:"5px 12px",textAlign:"center",fontWeight:700,color:"#374151",borderRight:"1px solid #E5E7EB",borderBottom:"1px solid #E5E7EB"}}>{drive}</td>
                  <td style={{padding:"5px 14px",textAlign:"right",fontWeight:raw?700:400,borderRight:"1px solid #E5E7EB",borderBottom:"1px solid #E5E7EB",color:pct!=null?usedFg(pct):"#D1D5DB",background:pct!=null?usedBg(pct):"transparent"}}>
                    {used!=null?`${used} GB`:<span style={{color:"#D1D5DB"}}>—</span>}
                  </td>
                  <td style={{padding:"5px 14px",textAlign:"right",borderRight:"1px solid #E5E7EB",borderBottom:"1px solid #E5E7EB",color:pct!=null?freeFg(pct):"#D1D5DB"}}>
                    {free!=null?`${free} GB`:<span style={{color:"#D1D5DB"}}>—</span>}
                  </td>
                  <td style={{padding:"5px 14px",textAlign:"right",borderRight:"1px solid #E5E7EB",borderBottom:"1px solid #E5E7EB",color:"#6B7280"}}>
                    {total!=null?`${total} GB`:<span style={{color:"#D1D5DB"}}>—</span>}
                  </td>
                  <td style={{padding:"5px 14px",borderBottom:"1px solid #E5E7EB"}}>
                    {pct!=null?(
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{flex:1,height:6,background:"#E5E7EB",borderRadius:99,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,borderRadius:99,background:barClr(pct)}}/>
                        </div>
                        <span style={{fontSize:11,fontWeight:700,minWidth:32,textAlign:"right",color:pct>=90?"#DC2626":pct>=75?"#D97706":"#065F46"}}>{pct}%</span>
                      </div>
                    ):<span style={{color:"#D1D5DB",fontSize:11}}>—</span>}
                  </td>
                </tr>
              )
            })
          })}
        </tbody>
      </table>
      {/* Footer */}
      <div style={{padding:"7px 14px",background:"#F3F4F6",borderTop:"1px solid #E5E7EB",display:"flex",justifyContent:"space-between",fontSize:11,color:"#6B7280"}}>
        <span>{isHistory?`History: ${selHist?weekLabel(selHist):"—"}`:`${currentVMs.length}/${ALL_VMS.length} VM · ${currentVMs.reduce((s,v)=>s+v.drives.length,0)} drives`}</span>
        <span style={{color:"#EF4444",fontWeight:600}}>
          {(() => {
            const allDrives = isHistory
              ? Object.values(map).flatMap(v=>Object.values(v))
              : currentVMs.flatMap(v=>v.drives)
            const critical = allDrives.filter((d:any) => (isHistory?(d as SavedRecord).used_pct:(d as DriveInfo).usedPct) >= 90).length
            return critical > 0 ? `🔴 ${critical} drive kritis` : "✅ Semua OK"
          })()}
        </span>
      </div>
    </div>
  )

  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <MotivationBanner page="docreq"/>

      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <h1 style={{fontSize:20,fontWeight:800,color:"var(--text)",letterSpacing:"-0.02em",display:"flex",alignItems:"center",gap:8}}>
            <Server size={20} color="var(--accent)"/> VM DB · Disk Monitor
          </h1>
          <p style={{fontSize:11,color:"var(--text3)",marginTop:2}}>Upload _chat.txt → parse disk usage VM DB · copy ke spreadsheet atau simpan ke Supabase</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {(parsed||histDates.length>0)&&(
            <div style={{display:"flex",gap:0,border:"1px solid var(--border)",borderRadius:8,overflow:"hidden"}}>
              {(["parsed","history"]as const).map(mode=>(
                <button key={mode} onClick={()=>setViewMode(mode)}
                  style={{padding:"5px 14px",border:"none",cursor:"pointer",fontSize:11,fontWeight:600,
                    background:viewMode===mode?"var(--accent)":"transparent",
                    color:viewMode===mode?"white":"var(--text3)",transition:"all 0.15s"}}>
                  {mode==="parsed"?"📄 Parsed":"🗄 History"}
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-primary" onClick={()=>{setShowUpload(true);setError("")}} style={{fontSize:12}}>
            <Upload size={13}/> Upload chat.txt
          </button>
        </div>
      </div>

      {/* Controls */}
      <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",minHeight:32}}>
        {viewMode==="parsed"&&parsed&&(
          <>
            <Calendar size={13} color="var(--text3)"/>
            <select value={selMonday} onChange={e=>{setSelMonday(e.target.value);setSaved(false)}}
              className="input" style={{width:"auto",fontSize:12,fontWeight:700,padding:"4px 10px"}}>
              {[...parsed.mondays].reverse().map(m=><option key={m} value={m}>{weekLabel(m)}</option>)}
            </select>
            <span style={{fontSize:11,color:"var(--text3)"}}>{currentVMs.length}/{ALL_VMS.length} VM</span>
            <div style={{marginLeft:"auto",display:"flex",gap:8}}>
              <button className="btn btn-ghost" onClick={handleCopy} style={{fontSize:11}}>
                {copied?<><Check size={12}/> Copied!</>:<><Copy size={12}/> Copy Spreadsheet</>}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving||saved} style={{fontSize:11}}>
                {saving?<><RefreshCw size={12} style={{animation:"spin 1s linear infinite"}}/> Saving...</>
                  :saved?<><CheckCircle size={12}/> Saved!</>
                  :<><Database size={12}/> Simpan</>}
              </button>
            </div>
          </>
        )}
        {viewMode==="history"&&(
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Calendar size={13} color="var(--text3)"/>
            <select value={selHist} onChange={e=>setSelHist(e.target.value)}
              className="input" style={{width:"auto",fontSize:12,fontWeight:700,padding:"4px 10px"}}>
              <option value="">Pilih minggu...</option>
              {histDates.map(d=><option key={d} value={d}>{weekLabel(d)}</option>)}
            </select>
            {histLoading&&<RefreshCw size={12} style={{animation:"spin 1s linear infinite",color:"var(--text3)"}}/>}
          </div>
        )}
      </div>

      {error&&(
        <div style={{fontSize:12,color:"#DC2626",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,padding:"8px 12px",display:"flex",gap:6}}>
          <AlertCircle size={13} style={{flexShrink:0,marginTop:1}}/>{error}
        </div>
      )}

      {/* Spreadsheet */}
      {viewMode==="parsed"&&currentVMs.length>0&&(
        <div className="card" style={{overflow:"hidden",padding:0}}>{renderTable(vmDriveMap)}</div>
      )}
      {viewMode==="history"&&selHist&&(
        <div className="card" style={{overflow:"hidden",padding:0}}>{renderTable(histMap)}</div>
      )}

      {/* Empty states */}
      {viewMode==="parsed"&&!currentVMs.length&&!parsing&&(
        <div className="card" style={{padding:"40px 20px",textAlign:"center",color:"var(--text3)"}}>
          <Server size={32} style={{margin:"0 auto 12px",display:"block",opacity:0.3}}/>
          <div style={{fontWeight:600,marginBottom:4}}>Belum ada data</div>
          <div style={{fontSize:12}}>Klik "Upload chat.txt" untuk mulai</div>
        </div>
      )}
      {viewMode==="history"&&!selHist&&(
        <div className="card" style={{padding:"32px 20px",textAlign:"center",color:"var(--text3)",fontSize:12}}>
          {histDates.length>0?`${histDates.length} minggu tersimpan · pilih minggu di atas`:"Belum ada history tersimpan"}
        </div>
      )}

      {/* Upload Popup */}
      {showUpload&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999,padding:16}}
          onClick={e=>{if(e.target===e.currentTarget)setShowUpload(false)}}>
          <div style={{background:"var(--surface)",borderRadius:16,padding:28,width:"min(400px,95vw)",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <div style={{fontWeight:800,fontSize:15,color:"var(--text)"}}>Upload _chat.txt</div>
                <div style={{fontSize:11,color:"var(--text3)",marginTop:2}}>Export chat WhatsApp dari Assion-Bot</div>
              </div>
              <button onClick={()=>setShowUpload(false)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--text3)",padding:6,borderRadius:8}}>
                <X size={18}/>
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".txt" style={{display:"none"}}
              onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f);e.target.value=""}}/>
            <div onClick={()=>fileRef.current?.click()}
              onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
              onDragOver={e=>e.preventDefault()}
              style={{border:"2px dashed var(--border2)",borderRadius:12,padding:"28px 20px",textAlign:"center",cursor:"pointer",background:"var(--surface2)"}}>
              {parsing
                ?<div style={{color:"var(--text3)",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                    <RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/> Parsing...
                  </div>
                :<>
                  <Upload size={24} color="var(--accent)" style={{margin:"0 auto 10px",display:"block"}}/>
                  <div style={{fontWeight:700,fontSize:13,color:"var(--text)",marginBottom:4}}>Klik atau drag & drop</div>
                  <div style={{fontSize:11,color:"var(--text3)"}}>_chat.txt</div>
                </>}
            </div>
            {error&&<div style={{marginTop:10,fontSize:12,color:"#DC2626",background:"#FEF2F2",borderRadius:8,padding:"8px 12px",display:"flex",gap:6}}><AlertCircle size={13}/>{error}</div>}
            <div style={{marginTop:14,fontSize:11,color:"var(--text3)",lineHeight:1.7,background:"var(--surface2)",borderRadius:8,padding:"10px 12px"}}>
              💡 Otomatis cari <code style={{background:"var(--surface3)",padding:"1px 4px",borderRadius:3}}>[READY] VM DB</code> dari Assion-Bot · default ke <strong>Senin terdekat sebelum hari ini</strong>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}