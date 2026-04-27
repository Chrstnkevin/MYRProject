"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import LandingNav from "../components/LandingNav"
import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────
interface Snapshot { cutoff_date:string; total:number; done_training:number; active:number; updated:number; pct_done:number; pct_active:number; pct_updated:number }
interface Branch { branch_name:string; area:string; total:number; done:number; active:number; inactive:number; updated:number; not_updated:number; pct:number; pct_updated:number }
interface Salesman { sls_no:string; sls_name:string; salesforce:string; team:string; flag_blok:string; done_training:number; done_update:number; sfa_version:string; last_order_date:string|null; branch_name:string; area:string }

const AREA_COLORS: Record<string,string> = { GMA:"#FF4D4D", MIN:"#FF9A3C", NOL:"#4D9FFF", SOL:"#4DCC70", VIS:"#B94DFF" }
const AREA_NAMES = ["GMA","MIN","NOL","SOL","VIS"] as const
type TPoint = Snapshot & { label:string }

// ── Supabase fetch ─────────────────────────────────────────────
async function fetchSFAData() {
  const [snap, branch, salesman] = await Promise.all([
    supabase.from("sfa_snapshots").select("*").order("cutoff_date"),
    supabase.from("sfa_branches").select("*").order("cutoff_date"),
    supabase.from("sfa_salesman").select("*").order("sls_name"),
  ])
  if (snap.error) throw snap.error
  if (branch.error) throw branch.error
  if (salesman.error) throw salesman.error
  return {
    snapshots: (snap.data || []) as Snapshot[],
    branches:  (branch.data   || []) as (Branch & { cutoff_date:string })[],
    salesman:  (salesman.data  || []) as (Salesman & { cutoff_date:string })[],
  }
}

// ── Animated Counter ───────────────────────────────────────────
function AnimCounter({ target, duration=1200, suffix="" }: { target:number; duration?:number; suffix?:string }) {
  const [val, setVal] = useState(0)
  const rafRef = useRef<number>(0)
  useEffect(() => {
    let start = 0; const step = 16
    const steps = Math.ceil(duration / step)
    let cur = 0
    const tick = () => {
      cur++
      const progress = cur / steps
      const eased = 1 - Math.pow(1 - progress, 3)
      setVal(Math.round(eased * target))
      if (cur < steps) rafRef.current = window.setTimeout(tick, step)
    }
    rafRef.current = window.setTimeout(tick, step)
    return () => clearTimeout(rafRef.current)
  }, [target, duration])
  return <span>{val.toLocaleString()}{suffix}</span>
}

// ── Sparkle / particle for hero ────────────────────────────────
function Particle({ x, y, size, color, delay }: { x:number; y:number; size:number; color:string; delay:number }) {
  return (
    <div style={{
      position:"absolute", left:`${x}%`, top:`${y}%`,
      width:`${size}px`, height:`${size}px`,
      borderRadius:"50%", background:color,
      opacity:0, pointerEvents:"none",
      animation:`particlePop ${1.5+Math.random()}s ease-in-out ${delay}s infinite`,
    }}/>
  )
}

// ── Line Chart ─────────────────────────────────────────────────
function LineChart({ data, metrics, height=200 }: { data:TPoint[]; metrics:{key:keyof TPoint;label:string;color:string}[]; height?:number }) {
  const [tip, setTip] = useState(-1)
  const ref = useRef<SVGSVGElement>(null)
  const W=560; const H=height; const PL=44; const PR=16; const PT=16; const PB=32
  const cW=W-PL-PR; const cH=H-PT-PB
  const allV = metrics.flatMap(m => data.map(d => Number(d[m.key])))
  const mn=Math.min(...allV); const mx=Math.max(...allV)
  const lo=Math.max(0, mn-(mx-mn)*0.15); const hi=mx+(mx-mn)*0.15
  const xP=(i:number) => PL+(i/(Math.max(data.length-1,1)))*cW
  const yP=(v:number) => PT+(1-(v-lo)/(hi-lo||1))*cH
  const ticks=[0,.25,.5,.75,1].map(t=>lo+(hi-lo)*t)
  const onMove = useCallback((e:React.MouseEvent<SVGSVGElement>) => {
    const r = ref.current?.getBoundingClientRect(); if(!r) return
    const rx = (e.clientX-r.left)/r.width*W
    let ci=0, md=Infinity
    data.forEach((_,i)=>{const d=Math.abs(xP(i)-rx);if(d<md){md=d;ci=i}})
    setTip(ci)
  },[data])
  if(!data.length) return <div style={{textAlign:"center",padding:"40px",color:"#888",fontSize:"13px"}}>Belum ada data trend</div>
  return (
    <div style={{position:"relative"}}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{width:"100%",cursor:"crosshair",overflow:"visible"}} onMouseMove={onMove} onMouseLeave={()=>setTip(-1)}>
        <defs>
          {metrics.map((m,mi)=>(
            <linearGradient key={mi} id={`chartGrad${mi}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={m.color} stopOpacity="0.25"/>
              <stop offset="100%" stopColor={m.color} stopOpacity="0"/>
            </linearGradient>
          ))}
        </defs>
        {ticks.map((t,i)=>{const y=yP(t);return(
          <g key={i}>
            <line x1={PL} y1={y} x2={W-PR} y2={y} stroke="rgba(0,0,0,0.06)" strokeWidth="1" strokeDasharray="4,4"/>
            <text x={PL-6} y={y+4} textAnchor="end" fontSize="9" fill="#bbb" fontFamily="monospace">{t.toFixed(1)}%</text>
          </g>
        )})}
        {data.map((d,i)=><text key={i} x={xP(i)} y={H-6} textAnchor="middle" fontSize="9" fill="#bbb" fontFamily="'DM Sans',sans-serif">{d.label}</text>)}
        {metrics.map((m,mi)=>{
          const vals = data.map(d=>Number(d[m.key]))
          const pts = vals.map((v,i)=>`${xP(i)},${yP(v)}`).join(" ")
          const area = data.length>1 ? `${xP(0)},${PT+cH} ${pts} ${xP(data.length-1)},${PT+cH}` : ""
          return(
            <g key={mi}>
              {area && <polygon points={area} fill={`url(#chartGrad${mi})`}/>}
              <polyline points={pts} fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              {vals.map((v,i)=>(
                <circle key={i} cx={xP(i)} cy={yP(v)} r={tip===i?6:3.5}
                  fill={tip===i?m.color:"white"} stroke={m.color} strokeWidth="2"
                  style={{transition:"r 0.15s,fill 0.15s"}}/>
              ))}
            </g>
          )
        })}
        {tip>=0 && <line x1={xP(tip)} y1={PT} x2={xP(tip)} y2={PT+cH} stroke="rgba(0,0,0,0.08)" strokeWidth="1" strokeDasharray="4,3"/>}
      </svg>
      {tip>=0 && (
        <div style={{
          position:"absolute", top:"8px",
          left: xP(tip)/W>0.6 ? "auto" : `${(xP(tip)/W)*100+1}%`,
          right: xP(tip)/W>0.6 ? `${((W-xP(tip))/W)*100+1}%` : "auto",
          background:"rgba(10,10,20,0.95)", backdropFilter:"blur(12px)",
          borderRadius:"14px", padding:"12px 16px", minWidth:"190px",
          boxShadow:"0 12px 40px rgba(0,0,0,0.3)", border:"1px solid rgba(255,255,255,0.1)",
          pointerEvents:"none", zIndex:10,
        }}>
          <div style={{fontSize:"10px",fontWeight:700,color:"rgba(255,255,255,0.4)",marginBottom:"10px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{data[tip].label}</div>
          {metrics.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",gap:"16px",marginBottom:"5px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                <div style={{width:"8px",height:"8px",borderRadius:"50%",background:m.color}}/>
                <span style={{fontSize:"11px",color:"rgba(255,255,255,0.55)"}}>{m.label}</span>
              </div>
              <span style={{fontSize:"13px",fontWeight:800,color:"white"}}>{Number(data[tip][m.key]).toFixed(1)}%</span>
            </div>
          ))}
          <div style={{marginTop:"10px",paddingTop:"10px",borderTop:"1px solid rgba(255,255,255,0.08)",fontSize:"10px",color:"rgba(255,255,255,0.3)"}}>
            Total {data[tip].total?.toLocaleString()} · Updated {data[tip].updated?.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Branch Popup ───────────────────────────────────────────────
function BranchPopup({ b, salesman, onClose }: { b:Branch; salesman:Salesman[]; onClose:()=>void }) {
  const col = AREA_COLORS[b.area] || "#888"
  const [tab, setTab] = useState<"overview"|"salesman">("overview")
  const [slsFilter, setSlsFilter] = useState<"all"|"active"|"inactive"|"updated"|"notUpdated">("all")
  const [slsSearch, setSlsSearch] = useState("")
  const filtered = useMemo(() => salesman.filter(s => {
    const ok = s.sls_name.toLowerCase().includes(slsSearch.toLowerCase()) || s.sls_no.includes(slsSearch)
    if(!ok) return false
    if(slsFilter==="active")     return s.flag_blok==="T"
    if(slsFilter==="inactive")   return s.flag_blok==="Y"
    if(slsFilter==="updated")    return s.done_update===1
    if(slsFilter==="notUpdated") return s.done_update===0
    return true
  }), [salesman, slsFilter, slsSearch])

  return (
    <div className="sfa-popup-bd" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(10px)"}} onClick={onClose}>
      <div className="sfa-popup-inner" style={{background:"white",borderRadius:"clamp(16px,4vw,24px)",maxWidth:"700px",width:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 40px 100px rgba(0,0,0,0.3)",animation:"popIn 0.3s cubic-bezier(0.34,1.56,0.64,1)"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${col}18,${col}06)`,padding:"20px 24px 16px",borderBottom:`3px solid ${col}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"12px"}}>
            <div>
              <span style={{display:"inline-block",background:col,color:"white",fontSize:"10px",fontWeight:700,padding:"2px 10px",borderRadius:"99px",marginBottom:"6px"}}>{b.area}</span>
              <div style={{fontSize:"16px",fontWeight:800,color:"#111"}}>{b.branch_name}</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(0,0,0,0.07)",border:"none",cursor:"pointer",width:"32px",height:"32px",borderRadius:"50%",fontSize:"18px",display:"flex",alignItems:"center",justifyContent:"center",color:"#555",flexShrink:0}}>×</button>
          </div>
          {/* Stats pills */}
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {[
              {l:"Total",   v:b.total,    c:"#666",   bg:"rgba(0,0,0,0.06)"},
              {l:"Trained", v:b.done,     c:col,      bg:`${col}18`},
              {l:"Aktif ✅",v:b.active,   c:"#43A047",bg:"rgba(67,160,71,0.12)"},
              {l:"Tdk Aktif 🚫",v:b.inactive,c:"#E8381A",bg:"rgba(232,56,26,0.1)"},
              {l:"Updated 🔄",v:b.updated,c:"#1E88E5",bg:"rgba(30,136,229,0.12)"},
            ].map((s,i)=>(
              <div key={i} style={{background:s.bg,borderRadius:"10px",padding:"5px 12px",textAlign:"center"}}>
                <div style={{fontSize:"17px",fontWeight:900,color:s.c,fontFamily:"'Bricolage Grotesque',sans-serif",lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:"9px",color:"#888",fontWeight:600,marginTop:"2px"}}>{s.l}</div>
              </div>
            ))}
          </div>
          {/* Tabs */}
          <div style={{display:"flex",gap:"5px",marginTop:"12px"}}>
            {[{k:"overview",l:"📊 Overview"},{k:"salesman",l:`👤 Salesman (${b.total})`}].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k as "overview"|"salesman")}
                style={{padding:"6px 14px",border:"none",borderRadius:"9px",cursor:"pointer",fontSize:"12px",fontWeight:700,fontFamily:"inherit",background:tab===t.k?col:"rgba(0,0,0,0.06)",color:tab===t.k?"white":"#666",transition:"all 0.2s"}}>
                {t.l}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{overflowY:"auto",flex:1}}>
          {tab==="overview" && (
            <div style={{padding:"20px 24px",display:"flex",flexDirection:"column",gap:"12px"}}>
              {[
                {l:"Training Completion", v:b.pct,         c:col,        note:"Salesman yang sudah training SFA"},
                {l:"SFA Update Rate",     v:b.pct_updated, c:"#1E88E5",  note:"Menggunakan SFA versi 2026 (v26.xx)"},
                {l:"Active Rate (Flag T)",v:b.total?Math.round(b.active/b.total*100):0, c:"#43A047", note:"Tidak diblokir & bertransaksi 2026"},
              ].map((m,i)=>(
                <div key={i} style={{background:"#F8F9FA",borderRadius:"14px",padding:"14px 16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                    <div>
                      <div style={{fontSize:"13px",fontWeight:700,color:"#111"}}>{m.l}</div>
                      <div style={{fontSize:"10px",color:"#aaa",marginTop:"2px"}}>{m.note}</div>
                    </div>
                    <div style={{fontSize:"28px",fontWeight:900,color:m.v>=80?"#43A047":m.v>=60?m.c:"#E8381A",fontFamily:"'Bricolage Grotesque',sans-serif"}}>{m.v}%</div>
                  </div>
                  <div style={{height:"8px",background:"rgba(0,0,0,0.08)",borderRadius:"99px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${m.v}%`,background:m.c,borderRadius:"99px",transition:"width 1s cubic-bezier(0.34,1.56,0.64,1)"}}/>
                  </div>
                </div>
              ))}
              <button onClick={()=>setTab("salesman")} style={{width:"100%",padding:"12px",borderRadius:"10px",border:`1.5px solid ${col}30`,background:"transparent",color:col,cursor:"pointer",fontFamily:"inherit",fontSize:"13px",fontWeight:700}}>
                👤 View Salesman List →
              </button>
            </div>
          )}
          {tab==="salesman" && (
            <div>
              <div style={{padding:"10px 14px",borderBottom:"1px solid #F0F0F0",display:"flex",gap:"7px",flexWrap:"wrap",alignItems:"center",position:"sticky",top:0,background:"white",zIndex:1}}>
                <input placeholder="🔍 Name / SLS No..." value={slsSearch} onChange={e=>setSlsSearch(e.target.value)}
                  style={{padding:"6px 10px",border:"1.5px solid #E5E7EB",borderRadius:"9px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(110px,30%,160px)"}}/>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"9px",padding:"2px",flexWrap:"wrap"}}>
                  {([{k:"all",l:"Semua"},{k:"active",l:"✅ Aktif"},{k:"inactive",l:"🚫 Tdk Aktif"},{k:"updated",l:"🔄 Updated"},{k:"notUpdated",l:"⚠️ Blm Update"}] as const).map(opt=>(
                    <button key={opt.k} onClick={()=>setSlsFilter(opt.k)}
                      style={{padding:"3px 9px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:slsFilter===opt.k?"white":"transparent",color:slsFilter===opt.k?"#111":"#888",boxShadow:slsFilter===opt.k?"0 1px 3px rgba(0,0,0,0.1)":"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                <span style={{fontSize:"10px",color:"#aaa",marginLeft:"auto"}}>{filtered.length} salesman</span>
              </div>
              <div style={{padding:"8px 14px",background:"#FFFBEB",borderBottom:"1px solid #FEF3C7",fontSize:"10px",color:"#92400E"}}>
                <strong>Flag T</strong> = aktif · <strong>Flag Y</strong> = blokir · <strong>Updated</strong> = SFA v26.xx · <strong>Blm Update</strong> = versi lama
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:"580px"}}>
                  <thead><tr style={{background:"#FAFAF8",borderBottom:"1px solid #F0F0F0"}}>
                    {["SLS No","Name","Salesforce","Team","Status","SFA Ver","Last Order"].map(h=>(
                      <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:"9px",fontWeight:700,color:"#999",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map((s,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #F8F8F8"}}>
                        <td style={{padding:"8px 10px",fontSize:"11px",color:"#aaa",fontFamily:"monospace"}}>{s.sls_no}</td>
                        <td style={{padding:"8px 10px",fontSize:"12px",fontWeight:600,color:"#111"}}>{s.sls_name}</td>
                        <td style={{padding:"8px 10px",fontSize:"11px",color:"#555",maxWidth:"130px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.salesforce}</td>
                        <td style={{padding:"8px 10px",fontSize:"11px",color:"#555"}}>{s.team}</td>
                        <td style={{padding:"8px 10px"}}><span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",background:s.flag_blok==="T"?"#E8F5E9":"#FEF0ED",color:s.flag_blok==="T"?"#43A047":"#E8381A"}}>{s.flag_blok==="T"?"✅ Aktif":"🚫 Tdk Aktif"}</span></td>
                        <td style={{padding:"8px 10px"}}><span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",background:s.done_update===1?"#EEF7FF":"#F8F8F8",color:s.done_update===1?"#1E88E5":"#999",fontFamily:"monospace"}}>{s.sfa_version==="Unknown"?"—":s.sfa_version}</span></td>
                        <td style={{padding:"8px 10px",fontSize:"11px",color:"#aaa",fontFamily:"monospace",whiteSpace:"nowrap"}}>{s.last_order_date||"—"}</td>
                      </tr>
                    ))}
                    {filtered.length===0 && <tr><td colSpan={7} style={{textAlign:"center",padding:"32px",color:"#bbb"}}>No salesman found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Area Popup ────────────────────────────────────────────────
function AreaPopup({ area, branches, allSalesman, onBranchClick, onClose }: {
  area: string
  branches: Branch[]
  allSalesman: Salesman[]
  onBranchClick: (b: Branch) => void
  onClose: () => void
}) {
  const col = AREA_COLORS[area] || "#888"
  const [search, setSearch] = useState("")
  const [sortCol, setSortCol] = useState<"branch_name"|"total"|"active"|"pct_updated">("branch_name")
  const [sortDir, setSortDir] = useState<1|-1>(1)

  const filtered = useMemo(()=>branches
    .filter(b=>b.branch_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>{
      if(sortCol==="branch_name") return sortDir*a.branch_name.localeCompare(b.branch_name)
      return sortDir*((a[sortCol as keyof Branch] as number)-(b[sortCol as keyof Branch] as number))
    })
  ,[branches,search,sortCol,sortDir])

  const toggle=(col:typeof sortCol)=>{ if(sortCol===col) setSortDir(d=>d===1?-1:1); else{setSortCol(col);setSortDir(1)} }

  // Area summary stats
  const totalSls    = branches.reduce((s,b)=>s+b.total,0)
  const totalActive = branches.reduce((s,b)=>s+b.active,0)
  const totalUpdated= branches.reduce((s,b)=>s+b.updated,0)
  const avgUpdPct   = totalSls ? Math.round(totalUpdated/totalSls*100) : 0

  return (
    <div className="sfa-popup-bd" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.65)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(10px)"}} onClick={onClose}>
      <div className="sfa-popup-inner" style={{background:"white",borderRadius:"clamp(16px,4vw,24px)",maxWidth:"780px",width:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 40px 100px rgba(0,0,0,0.3)",animation:"areaPopIn 0.3s cubic-bezier(0.34,1.56,0.64,1)"}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${col}15,${col}05)`,padding:"20px 24px 16px",borderBottom:`3px solid ${col}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"14px"}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"4px"}}>
                <div style={{width:"36px",height:"36px",borderRadius:"10px",background:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",fontWeight:900,color:"white",fontFamily:"'Bricolage Grotesque',sans-serif"}}>{area}</div>
                <div>
                  <div style={{fontSize:"18px",fontWeight:800,color:"#111"}}>Performance by Area — {area}</div>
                  <div style={{fontSize:"11px",color:"#888"}}>Click a branch to see salesman list</div>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(0,0,0,0.07)",border:"none",cursor:"pointer",width:"32px",height:"32px",borderRadius:"50%",fontSize:"18px",display:"flex",alignItems:"center",justifyContent:"center",color:"#555",flexShrink:0}}>×</button>
          </div>
          {/* Summary pills */}
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"14px"}}>
            {[
              {l:"Branches",    v:branches.length,                c:"#666",   bg:"rgba(0,0,0,0.06)"},
              {l:"Total Sls",   v:totalSls,                       c:col,      bg:`${col}15`},
              {l:"Aktif ✅",    v:totalActive,                    c:"#4DCC70",bg:"rgba(77,204,112,0.1)"},
              {l:"Updated 🔄",  v:totalUpdated,                   c:"#4D9FFF",bg:"rgba(77,159,255,0.1)"},
              {l:"Upd Rate",    v:`${avgUpdPct}%`,                c:col,      bg:`${col}10`},
            ].map((s,i)=>(
              <div key={i} style={{background:s.bg,borderRadius:"10px",padding:"5px 12px",textAlign:"center"}}>
                <div style={{fontSize:"16px",fontWeight:900,color:s.c,fontFamily:"'Bricolage Grotesque',sans-serif",lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:"9px",color:"#888",fontWeight:600,marginTop:"2px"}}>{s.l}</div>
              </div>
            ))}
          </div>
          {/* Search */}
          <input placeholder="🔍 Search branch..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{padding:"7px 12px",border:`1.5px solid ${col}40`,borderRadius:"10px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(140px,40%,240px)",background:"white"}}/>
        </div>

        {/* Branch table */}
        <div style={{overflowY:"auto",flex:1}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:"520px"}}>
              <thead>
                <tr style={{background:"#FAFAF8",borderBottom:"1px solid #F0F0F0",position:"sticky",top:0}}>
                  {[
                    {l:"Branch Name",  c:"branch_name" as const},
                    {l:"Total",        c:"total"        as const},
                    {l:"Aktif ✅",     c:"active"       as const},
                    {l:"Tdk Aktif 🚫", c:null},
                    {l:"Updated 🔄",   c:null},
                    {l:"% Updated",    c:"pct_updated"  as const},
                    {l:"",             c:null},
                  ].map((h,i)=>(
                    <th key={i} onClick={()=>h.c&&toggle(h.c)}
                      style={{padding:"9px 10px",textAlign:"left",fontSize:"9px",fontWeight:700,color:"#999",textTransform:"uppercase",letterSpacing:"0.06em",cursor:h.c?"pointer":"default",userSelect:"none",whiteSpace:"nowrap"}}>
                      {h.l}{h.c&&<span style={{marginLeft:"3px",opacity:sortCol===h.c?1:0.25,fontSize:"9px"}}>{sortDir===1?"↑":"↓"}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b,i)=>(
                  <tr key={i}
                    style={{borderBottom:"1px solid #F8F8F8",cursor:"pointer",transition:"background 0.12s"}}
                    onClick={()=>onBranchClick(b)}
                    onMouseEnter={e=>{e.currentTarget.style.background=`${col}08`}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                    <td style={{padding:"10px",fontSize:"12px",fontWeight:600,color:"#111",maxWidth:"220px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.branch_name}</td>
                    <td style={{padding:"10px",fontSize:"12px",fontWeight:600,color:"#111"}}>{b.total}</td>
                    <td style={{padding:"10px",fontSize:"12px",color:"#4DCC70",fontWeight:700}}>{b.active}</td>
                    <td style={{padding:"10px",fontSize:"12px",color:b.inactive>0?"#FF4D4D":"#aaa",fontWeight:b.inactive>0?700:400}}>{b.inactive}</td>
                    <td style={{padding:"10px",fontSize:"12px",color:"#4D9FFF",fontWeight:600}}>{b.updated}</td>
                    <td style={{padding:"10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                        <div style={{width:"44px",height:"5px",background:"#F0F0F0",borderRadius:"99px",overflow:"hidden",flexShrink:0}}>
                          <div style={{height:"100%",width:`${b.pct_updated}%`,background:b.pct_updated>=80?"#4DCC70":b.pct_updated>=60?"#FF9A3C":"#FF4D4D",borderRadius:"99px"}}/>
                        </div>
                        <span style={{fontSize:"11px",fontWeight:800,color:b.pct_updated>=80?"#4DCC70":b.pct_updated>=60?"#FF9A3C":"#FF4D4D"}}>{b.pct_updated}%</span>
                      </div>
                    </td>
                    <td style={{padding:"10px",textAlign:"center",fontSize:"13px"}}>{b.pct_updated===100?"✅":b.pct_updated>=80?"🟡":"🔴"}</td>
                  </tr>
                ))}
                {filtered.length===0&&(
                  <tr><td colSpan={7} style={{textAlign:"center",padding:"32px",color:"#bbb"}}>No branches found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────
export default function UtilisationPage() {
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState("")
  const [snapshots,   setSnapshots]   = useState<Snapshot[]>([])
  const [allBranches, setAllBranches] = useState<(Branch&{cutoff_date:string})[]>([])
  const [salesman,    setSalesman]    = useState<(Salesman&{cutoff_date:string})[]>([])
  const [uploadToast, setUploadToast] = useState<{show:boolean;data?:{cutoff:string;total:number;branches:number;salesman:number}}>({show:false})
  const [appTab]                       = useState("sfa")
  const [viewMode,    setViewMode]    = useState<"cutoff"|"month">("cutoff")
  const [areaFilter,  setAreaFilter]  = useState("ALL")
  const [chartTab,    setChartTab]    = useState<"overall"|"area">("overall")
  const [showMetrics, setShowMetrics] = useState({done:true,active:true,updated:true})
  const [search,      setSearch]      = useState("")
  const [sortCol,     setSortCol]     = useState<"branch_name"|"total"|"active"|"pct_updated">("branch_name")
  const [sortDir,     setSortDir]     = useState<1|-1>(1)
  const [branchPopup, setBranchPopup] = useState<Branch|null>(null)
  const [areaPopup,   setAreaPopup]   = useState<string|null>(null) // area name e.g. "GMA" 
  const [salsFilter,  setSalsFilter]  = useState<"all"|"active"|"inactive">("all")
  const [heroVisible, setHeroVisible] = useState(true) // ✅ show by default, anime enhances
  const animeLoaded = useRef(false)

  // Load Anime.js
  useEffect(() => {
    if(animeLoaded.current) return
    animeLoaded.current = true
    const s = document.createElement("script")
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"
    s.onload = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anime = (window as any).anime
      if(!anime) return
      // Animate hero KPI cards
      anime({ targets:".kpi-card", translateY:[30,0], opacity:[0,1], delay:anime.stagger(80), duration:700, easing:"easeOutExpo" })
      // Pulse the live dot
      anime({ targets:".live-dot", scale:[1,1.4,1], loop:true, duration:1200, easing:"easeInOutSine" })
      // Float animation on SFA logo
      anime({ targets:".sfa-hero-logo", translateY:[0,-8,0], loop:true, duration:2800, easing:"easeInOutSine" })
      // Stagger area cards
      anime({ targets:".area-card", translateY:[24,0], opacity:[0,1], delay:anime.stagger(100), duration:600, easing:"easeOutBack" })
      setHeroVisible(true)
    }
    document.head.appendChild(s)
    // Load fonts
    const link = document.createElement("link"); link.rel="stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=Space+Grotesk:wght@300;400;500;600;700&display=swap"
    if(!document.querySelector("link[data-util-font]")){ link.setAttribute("data-util-font","1"); document.head.appendChild(link) }
  }, [])

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchSFAData()
        setSnapshots(data.snapshots); setAllBranches(data.branches); setSalesman(data.salesman)
      } catch(e) {
        setError(e instanceof Error ? e.message : "Failed to load data")
      } finally { setLoading(false) }
    }
    load()

    const channel = supabase.channel("sfa-updates")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"sfa_snapshots" }, async (payload) => {
        const data = await fetchSFAData()
        setSnapshots(data.snapshots); setAllBranches(data.branches); setSalesman(data.salesman)
        const snap = payload.new as {cutoff_date:string;total:number}
        const branchCount = data.branches.filter((b:{cutoff_date:string})=>b.cutoff_date===snap.cutoff_date).length
        setUploadToast({ show:true, data:{ cutoff:snap.cutoff_date, total:snap.total, branches:branchCount, salesman:data.salesman.length }})
        setTimeout(()=>setUploadToast({show:false}), 8000)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // Derived
  const latest       = snapshots[snapshots.length-1]
  const latestCutoff = latest?.cutoff_date || ""

  const trendData = useMemo(():TPoint[] => {
    const data = snapshots.map(s=>({...s, label:new Date(s.cutoff_date).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}))
    if(viewMode==="month"){
      const monthly = new Map<string,TPoint>()
      data.forEach(d=>{ const m=d.cutoff_date.slice(0,7); if(!monthly.has(m)||d.cutoff_date>monthly.get(m)!.cutoff_date) monthly.set(m,{...d,label:new Date(d.cutoff_date).toLocaleDateString("en-GB",{month:"short"})}) })
      return [...monthly.values()].sort((a,b)=>a.cutoff_date.localeCompare(b.cutoff_date))
    }
    return data
  },[snapshots,viewMode])

  const latestBranches = useMemo(()=>allBranches.filter(b=>b.cutoff_date===latestCutoff),[allBranches,latestCutoff])

  const areaSummary = useMemo(()=>AREA_NAMES.map(area=>{
    const bs=latestBranches.filter(b=>b.area===area)
    const total=bs.reduce((s,b)=>s+b.total,0)
    const active=bs.reduce((s,b)=>s+b.active,0)
    const updated=bs.reduce((s,b)=>s+b.updated,0)
    return {area,color:AREA_COLORS[area],total,active,updated,pct:100,pctUpdated:total?Math.round(updated/total*100):0,branches:bs.length}
  }),[latestBranches])

  const VALID_AREAS_SET = new Set(["GMA","MIN","NOL","SOL","VIS"])
  const filteredBranches = useMemo(()=>latestBranches
    .filter(b=>{
      if(!VALID_AREAS_SET.has(b.area)) return false // ✅ Filter #N/A etc
      if(areaFilter!=="ALL"&&b.area!==areaFilter) return false
      if(!b.branch_name.toLowerCase().includes(search.toLowerCase())) return false
      if(salsFilter==="active"&&b.active===0) return false
      if(salsFilter==="inactive"&&b.inactive===0) return false
      return true
    })
    .sort((a,b)=>{
      if(sortCol==="branch_name") return sortDir*a.branch_name.localeCompare(b.branch_name)
      return sortDir*((a[sortCol as keyof Branch] as number)-(b[sortCol as keyof Branch] as number))
    })
  ,[latestBranches,areaFilter,search,sortCol,sortDir,salsFilter])

  const branchSalesman     = useMemo(()=>branchPopup?salesman.filter(s=>s.branch_name===branchPopup.branch_name):[],[salesman,branchPopup])
  const areaPopupBranches  = useMemo(()=>areaPopup?latestBranches.filter(b=>b.area===areaPopup):[],[latestBranches,areaPopup])
  const areaPopupSalesman  = useMemo(()=>areaPopup?salesman.filter(s=>s.area===areaPopup):[],[salesman,areaPopup])

  const activeMetrics = [
    showMetrics.done    && {key:"pct_done"    as keyof TPoint,label:"Trained %",  color:"#FF4D4D"},
    showMetrics.active  && {key:"pct_active"  as keyof TPoint,label:"Active %",   color:"#4D9FFF"},
    showMetrics.updated && {key:"pct_updated" as keyof TPoint,label:"Updated %",  color:"#4DCC70"},
  ].filter(Boolean) as {key:keyof TPoint;label:string;color:string}[]

  const sortToggle = (col:typeof sortCol) => { if(sortCol===col) setSortDir(d=>d===1?-1:1); else{ setSortCol(col); setSortDir(1) }}

  // ── Loading ──
  if(loading) return (
    <div style={{fontFamily:"'Space Grotesk',sans-serif",background:"#070714",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <LandingNav/>
      <div style={{textAlign:"center",color:"white"}}>
        <div style={{width:"60px",height:"60px",margin:"0 auto 20px",position:"relative"}}>
          <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid rgba(255,255,255,0.1)"}}/>
          <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"3px solid transparent",borderTopColor:"#FF4D4D",animation:"spin 0.8s linear infinite"}}/>
        </div>
        <div style={{fontSize:"15px",fontWeight:600,color:"rgba(255,255,255,0.6)"}}>Loading SFA data...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  // ── Error ──
  if(error) return (
    <div style={{fontFamily:"'Space Grotesk',sans-serif",background:"#070714",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <LandingNav/>
      <div style={{textAlign:"center",color:"white",maxWidth:"400px",padding:"32px"}}>
        <div style={{fontSize:"48px",marginBottom:"16px"}}>⚠️</div>
        <div style={{fontSize:"18px",fontWeight:700,marginBottom:"8px"}}>Gagal memuat data</div>
        <div style={{fontSize:"13px",color:"rgba(255,255,255,0.4)",marginBottom:"24px"}}>{error}</div>
        <button onClick={()=>window.location.reload()} style={{padding:"12px 28px",borderRadius:"99px",background:"#FF4D4D",color:"white",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:"14px",fontWeight:700}}>Coba Lagi</button>
      </div>
    </div>
  )

  const particles = Array.from({length:18},(_,i)=>({ x:Math.random()*100, y:Math.random()*100, size:Math.random()*6+2, color:["#FF4D4D","#FF9A3C","#4DCC70","#4D9FFF","#B94DFF","#FFD700"][i%6], delay:i*0.3 }))

  return (
    <div style={{fontFamily:"'Space Grotesk',sans-serif",color:"#111",background:"#070714",minHeight:"100vh"}}>
      <LandingNav/>

      {/* ── App Tab Bar ── */}
      <div style={{position:"sticky",top:"64px",zIndex:90,background:"rgba(7,7,20,0.97)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"0 clamp(20px,5vw,80px)"}}>
        <div style={{maxWidth:"1100px",margin:"0 auto",display:"flex",overflowX:"auto"}}>
          {[{id:"sfa",label:"SFA",active:true,href:"#"},{id:"ficom",label:"💰 Ficom",active:false,href:"/landing/ficom"},{id:"ficom-lite",label:"📱 Ficom Lite",active:false,href:"/landing/ficom-lite"}].map(tab=>(
            <button key={tab.id}
  style={{padding:"12px 20px",border:"none",cursor:tab.active||tab.href!=="#"?"pointer":"not-allowed",fontFamily:"inherit",fontSize:"13px",fontWeight:appTab===tab.id?700:500,color:appTab===tab.id?"#FF4D4D":tab.href!=="#"?"rgba(255,255,255,0.45)":"rgba(255,255,255,0.18)",background:"transparent",borderBottom:appTab===tab.id?"2px solid #FF4D4D":"2px solid transparent",transition:"all 0.2s",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",textDecoration:"none"}}
              onClick={()=>tab.href!=="#"&&!tab.active?window.location.href=tab.href:undefined}>
              {tab.id==="sfa" && <img src="/sfa-logo.png" alt="SFA" style={{height:"22px",width:"auto",objectFit:"contain"}}/>}
              {tab.id!=="sfa" && <span>{tab.label}</span>}
              {tab.href==="#" && !tab.active && <span style={{fontSize:"9px",background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.2)",padding:"2px 6px",borderRadius:"99px"}}>Soon</span>}
            </button>
          ))}
        </div>
      </div>

      {/* ── HERO ── */}
      <div style={{position:"relative",overflow:"hidden",background:"linear-gradient(160deg,#0D0D28 0%,#12091A 50%,#0A1A12 100%)",padding:"clamp(60px,9vw,100px) clamp(16px,4vw,80px) clamp(36px,5vw,70px)"}}>
        {/* Animated particles */}
        {particles.map((p,i)=><Particle key={i} {...p}/>)}
        {/* Mesh gradient blobs */}
        <div style={{position:"absolute",top:"-10%",right:"-5%",width:"clamp(300px,45vw,600px)",height:"clamp(300px,45vw,600px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(255,77,77,0.25),transparent 65%)",filter:"blur(80px)",pointerEvents:"none",animation:"blobFloat1 7s ease-in-out infinite"}}/>
        <div style={{position:"absolute",bottom:"-10%",left:"-5%",width:"clamp(250px,35vw,500px)",height:"clamp(250px,35vw,500px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(77,159,255,0.18),transparent 65%)",filter:"blur(70px)",pointerEvents:"none",animation:"blobFloat2 9s ease-in-out infinite"}}/>
        <div style={{position:"absolute",top:"30%",left:"30%",width:"clamp(200px,25vw,400px)",height:"clamp(200px,25vw,400px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(77,204,112,0.12),transparent 65%)",filter:"blur(60px)",pointerEvents:"none"}}/>

        <div style={{maxWidth:"1100px",margin:"0 auto",position:"relative",zIndex:2}}>
          {/* Live badge */}
          <div style={{display:"inline-flex",alignItems:"center",gap:"10px",background:"rgba(255,77,77,0.12)",border:"1px solid rgba(255,77,77,0.3)",borderRadius:"99px",padding:"6px 16px",marginBottom:"24px"}}>
            <div className="live-dot" style={{width:"8px",height:"8px",borderRadius:"50%",background:"#FF4D4D",boxShadow:"0 0 8px #FF4D4D"}}/>
            <span style={{fontSize:"12px",fontWeight:700,color:"#FF6B6B",letterSpacing:"0.1em",textTransform:"uppercase"}}>Live · SFA PHI Pilot · {latestCutoff}</span>
          </div>

          <div className="sfa-hero-layout" style={{display:"flex",gap:"clamp(20px,4vw,64px)",alignItems:"center",flexWrap:"wrap"}}>
            {/* Left */}
            <div style={{flex:1,minWidth:"min(100%,280px)",animation:"fadeInUp 0.8s ease both"}}>
              <h1 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(28px,7vw,60px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-0.03em",color:"white",marginBottom:"clamp(10px,2vw,18px)"}}>
                SFA Utilisation<br/>
                <span style={{background:"linear-gradient(135deg,#FF4D4D,#FF9A3C)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Monitoring</span>
              </h1>
              <p style={{fontSize:"clamp(11px,3vw,14px)",color:"rgba(255,255,255,0.35)",marginBottom:"clamp(16px,3.5vw,36px)",lineHeight:1.7}}>
                {latest?.total?.toLocaleString()} active salesman · {latestBranches.length} branches · 5 areas
              </p>

              {/* KPI Grid */}
              <div className="kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"clamp(6px,1.5vw,10px)",width:"100%",maxWidth:"520px"}}>
                {[
                  {n:<AnimCounter target={latest?.pct_done||0} suffix="%"/>,  l:"Trained",   i:"🎓",c:"#FF4D4D",bg:"rgba(255,77,77,0.12)",border:"rgba(255,77,77,0.2)"},
                  {n:<AnimCounter target={latest?.total||0}/>,                l:"Salesman",  i:"👥",c:"white",  bg:"rgba(255,255,255,0.05)",border:"rgba(255,255,255,0.1)"},
                  {n:<AnimCounter target={latest?.active||0}/>,               l:"Aktif ✅",  i:"💚",c:"#4DCC70",bg:"rgba(77,204,112,0.1)", border:"rgba(77,204,112,0.2)"},
                  {n:<AnimCounter target={(latest?.total||0)-(latest?.active||0)}/>, l:"Tdk Aktif",i:"🚫",c:"rgba(255,255,255,0.4)",bg:"rgba(255,255,255,0.04)",border:"rgba(255,255,255,0.07)"},
                  {n:<AnimCounter target={latest?.updated||0}/>,              l:"Updated 🔄",i:"📱",c:"#4D9FFF",bg:"rgba(77,159,255,0.1)", border:"rgba(77,159,255,0.2)"},
                  {n:<AnimCounter target={latest?.pct_updated||0} suffix="%"/>,l:"Upd Rate",  i:"📊",c:"rgba(255,255,255,0.5)",bg:"rgba(255,255,255,0.04)",border:"rgba(255,255,255,0.07)"},
                ].map((s,i)=>(
                  <div key={i} className="kpi-card" style={{background:s.bg,borderRadius:"clamp(10px,1.5vw,14px)",padding:"clamp(10px,1.5vw,14px)",border:`1px solid ${s.border}`,textAlign:"center",backdropFilter:"blur(10px)",animation:"fadeInUp 0.6s ease both",animationDelay:`${i*0.08}s`}}>
                    <div style={{fontSize:"clamp(16px,2vw,20px)",marginBottom:"4px"}}>{s.i}</div>
                    <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(15px,4vw,20px)",fontWeight:900,color:s.c,lineHeight:1,marginBottom:"4px",whiteSpace:"nowrap"}}>{s.n}</div>
                    <div style={{fontSize:"clamp(8px,1.8vw,9px)",color:"rgba(255,255,255,0.3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.03em"}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: animated SFA illustration */}
            <div className="sfa-hero-logo" style={{flexShrink:0,width:"clamp(100px,18vw,220px)"}}>
              <div style={{position:"relative",width:"100%",paddingBottom:"100%"}}>
                <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <img src="/sfa-logo.png" alt="SFA" style={{width:"70%",height:"70%",objectFit:"contain",filter:"drop-shadow(0 0 40px rgba(255,77,77,0.5))"}}/>
                  {/* Rotating ring */}
                  <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(255,77,77,0.2)",animation:"spin 8s linear infinite"}}/>
                  <div style={{position:"absolute",inset:"8%",borderRadius:"50%",border:"1.5px dashed rgba(255,77,77,0.12)",animation:"spinR 12s linear infinite"}}/>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── WHITE CONTENT ── */}
      <div style={{background:"#F6F7FA",borderRadius:"28px 28px 0 0",marginTop:"-4px"}}>
        <div style={{maxWidth:"1100px",margin:"0 auto",padding:"clamp(16px,3vw,36px) clamp(12px,4vw,80px)"}}>

          {/* Glossary */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(12px,1.5vw,18px)",marginBottom:"clamp(14px,2vw,20px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:700,fontSize:"12px",color:"#333",marginBottom:"10px"}}>📖 Keterangan Istilah</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,150px),1fr))",gap:"8px"}}>
              {[
                {term:"Trained",             def:"Sudah training SFA (100% dari salesman aktif 2026)",c:"#FF4D4D"},
                {term:"Aktif (Flag T)",       def:"Tidak diblokir & bertransaksi di 2026",            c:"#4DCC70"},
                {term:"Tdk Aktif (Flag Y)",   def:"Diblokir — last order bisa 2019–2022",             c:"#888"},
                {term:"Updated SFA",          def:"Menggunakan SFA versi 2026 (v26.xx.xx)",            c:"#4D9FFF"},
              ].map((g,i)=>(
                <div key={i} style={{padding:"8px 12px",background:"#F8F9FA",borderRadius:"10px",borderLeft:`3px solid ${g.c}`}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:g.c,marginBottom:"3px"}}>{g.term}</div>
                  <div style={{fontSize:"10px",color:"#666",lineHeight:1.5}}>{g.def}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Area Filter */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(10px,1.5vw,16px)",marginBottom:"clamp(14px,2vw,20px)",display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:700,fontSize:"12px",color:"#333",flexShrink:0}}>🗺️ Filter Area:</div>
            <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
              {["ALL","GMA","MIN","NOL","SOL","VIS"].map(a=>{
                const col = AREA_COLORS[a]||"#E8381A"
                const active = areaFilter===a
                return(
                  <button key={a} onClick={()=>setAreaFilter(a)}
                    style={{padding:"5px 13px",borderRadius:"10px",border:`1.5px solid ${active?col:"#E5E7EB"}`,background:active?`${col}15`:"transparent",color:active?col:"#666",cursor:"pointer",fontFamily:"inherit",fontSize:"11px",fontWeight:700,transition:"all 0.18s"}}>
                    {a}
                  </button>
                )
              })}
            </div>
            {areaFilter!=="ALL"&&<button onClick={()=>setAreaFilter("ALL")} style={{padding:"5px 13px",borderRadius:"10px",border:"1.5px solid #FF4D4D",background:"#FEF0ED",color:"#FF4D4D",cursor:"pointer",fontFamily:"inherit",fontSize:"11px",fontWeight:700,marginLeft:"auto"}}>✕ Clear</button>}
          </div>

          {/* Chart */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,22px)",marginBottom:"clamp(14px,2vw,20px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginBottom:"14px"}}>
              <div>
                <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:800,color:"#111"}}>📈 Training Progress Trend</h2>
                <p style={{fontSize:"10px",color:"#bbb",marginTop:"3px"}}>Hover untuk detail · 2026 active salesman only</p>
              </div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"10px",padding:"3px"}}>
                  {(["cutoff","month"] as const).map(v=>(
                    <button key={v} onClick={()=>setViewMode(v)} style={{padding:"4px 12px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:viewMode===v?"white":"transparent",color:viewMode===v?"#111":"#888",boxShadow:viewMode===v?"0 2px 6px rgba(0,0,0,0.1)":"none",transition:"all 0.2s",whiteSpace:"nowrap"}}>
                      {v==="cutoff"?"By Date":"By Month"}
                    </button>
                  ))}
                </div>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"10px",padding:"3px"}}>
                  {(["overall","area"] as const).map(t=>(
                    <button key={t} onClick={()=>setChartTab(t)} style={{padding:"4px 12px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:chartTab===t?"white":"transparent",color:chartTab===t?"#111":"#888",boxShadow:chartTab===t?"0 2px 6px rgba(0,0,0,0.1)":"none",transition:"all 0.2s"}}>
                      {t==="overall"?"Overall":"By Area"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {chartTab==="overall" && (
              <div style={{display:"flex",gap:"6px",marginBottom:"14px",flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:"10px",color:"#bbb",fontWeight:600}}>Tampilkan:</span>
                {[{k:"done",l:"Trained %",c:"#FF4D4D"},{k:"active",l:"Active %",c:"#4D9FFF"},{k:"updated",l:"Updated %",c:"#4DCC70"}].map(m=>(
                  <button key={m.k} onClick={()=>setShowMetrics(s=>({...s,[m.k]:!s[m.k as keyof typeof s]}))}
                    style={{display:"flex",alignItems:"center",gap:"5px",padding:"4px 12px",borderRadius:"99px",border:`1.5px solid ${showMetrics[m.k as keyof typeof showMetrics]?m.c:"#e0e0e0"}`,background:showMetrics[m.k as keyof typeof showMetrics]?`${m.c}12`:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:"10px",fontWeight:700,color:showMetrics[m.k as keyof typeof showMetrics]?m.c:"#aaa",transition:"all 0.15s"}}>
                    <div style={{width:"7px",height:"7px",borderRadius:"50%",background:showMetrics[m.k as keyof typeof showMetrics]?m.c:"#ddd"}}/>
                    {m.l}
                  </button>
                ))}
              </div>
            )}
            {chartTab==="overall" && <LineChart data={trendData} metrics={activeMetrics} height={200}/>}
            {chartTab==="area" && (
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"separate",borderSpacing:"3px",width:"100%",minWidth:"380px"}}>
                  <thead><tr>
                    <th style={{fontSize:"10px",color:"#bbb",fontWeight:600,textAlign:"left",padding:"0 8px 8px"}}>Area</th>
                    {trendData.map(r=><th key={r.label} style={{fontSize:"10px",color:"#bbb",fontWeight:600,textAlign:"center",padding:"0 0 8px"}}>{r.label}</th>)}
                  </tr></thead>
                  <tbody>
                    {AREA_NAMES.map(a=>(
                      <tr key={a}>
                        <td style={{padding:"0 8px 0 0"}}><div style={{display:"flex",alignItems:"center",gap:"5px"}}><div style={{width:"8px",height:"8px",borderRadius:"2px",background:AREA_COLORS[a]}}/><span style={{fontSize:"11px",fontWeight:700,color:AREA_COLORS[a]}}>{a}</span></div></td>
                        {trendData.map((_,ci)=>(
                          <td key={ci} style={{padding:"2px"}}><div style={{minWidth:"44px",height:"28px",borderRadius:"8px",background:`${AREA_COLORS[a]}CC`,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"10px",fontWeight:800,color:"white"}}>100%</span></div></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Area Cards */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,22px)",marginBottom:"clamp(14px,2vw,20px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:800,marginBottom:"4px",color:"#111"}}>🗺️ Performance by Area</h2>
            <p style={{fontSize:"10px",color:"#bbb",marginBottom:"14px"}}>Click untuk lihat detail branch · Progress bar = % Updated SFA</p>
            <div className="sfa-area-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,140px),1fr))",gap:"clamp(8px,1.2vw,12px)"}}>
              {areaSummary.map((a,i)=>(
                <div key={i} className="area-card"
                  style={{borderRadius:"16px",padding:"clamp(12px,1.6vw,18px)",border:`2px solid ${a.color}20`,background:"white",cursor:"pointer",transition:"border-color 0.25s,transform 0.25s,box-shadow 0.25s",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",animation:"fadeInUp 0.5s ease both",animationDelay:`${i*0.1}s`,position:"relative",overflow:"hidden"}}
                  onClick={()=>setAreaPopup(a.area)}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color;e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 12px 30px ${a.color}25`}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=`${a.color}20`;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"}}>
                  {/* Glow bg */}
                  <div style={{position:"absolute",top:"-30%",right:"-20%",width:"80px",height:"80px",borderRadius:"50%",background:`${a.color}15`,filter:"blur(20px)",pointerEvents:"none"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                    <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(15px,1.8vw,18px)",fontWeight:900,color:a.color}}>{a.area}</span>
                    <span style={{fontSize:"clamp(14px,1.6vw,17px)",fontWeight:900,color:"#4DCC70",fontFamily:"'Bricolage Grotesque',sans-serif"}}>100%</span>
                  </div>
                  <div style={{height:"5px",background:`${a.color}15`,borderRadius:"99px",marginBottom:"10px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${a.pctUpdated}%`,background:`linear-gradient(90deg,${a.color},${a.color}99)`,borderRadius:"99px"}}/>
                  </div>
                  <div style={{fontSize:"clamp(9px,2vw,10px)",color:"#888",lineHeight:1.7}}>
                    <div><strong style={{color:"#111"}}>{a.total}</strong> salesman · <strong style={{color:"#555"}}>{a.branches}</strong> cab</div>
                    <div>✅ {a.active} aktif · 🔄 {a.pctUpdated}% upd</div>
                  </div>
                  <div style={{marginTop:"8px",fontSize:"9px",fontWeight:700,color:a.color,textAlign:"center",opacity:0.8}}>Tap to view branches →</div>
                </div>
              ))}
            </div>
          </div>

          {/* Branch Table */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,22px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginBottom:"12px"}}>
              <div>
                <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:800,color:"#111"}}>
                  🏢 Branch Detail <span style={{fontSize:"12px",fontWeight:400,color:"#bbb"}}>({filteredBranches.length}/{latestBranches.length})</span>
                </h2>
                <p style={{fontSize:"10px",color:"#bbb",marginTop:"3px"}}>Click row → lihat daftar salesman · {latestCutoff}</p>
              </div>
              <div style={{display:"flex",gap:"7px",flexWrap:"wrap",alignItems:"center"}}>
                <input placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)}
                  style={{padding:"7px 12px",border:"1.5px solid #E5E7EB",borderRadius:"10px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(110px,18vw,160px)",background:"#FAFAF8"}}
                  onFocus={e=>{e.currentTarget.style.borderColor="#FF4D4D"}} onBlur={e=>{e.currentTarget.style.borderColor="#E5E7EB"}}/>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"10px",padding:"3px"}}>
                  {([{k:"all",l:"Semua"},{k:"active",l:"✅ Aktif"},{k:"inactive",l:"🚫 Tdk Aktif"}] as const).map(opt=>(
                    <button key={opt.k} onClick={()=>setSalsFilter(opt.k)}
                      style={{padding:"4px 9px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:salsFilter===opt.k?"white":"transparent",color:salsFilter===opt.k?"#111":"#888",boxShadow:salsFilter===opt.k?"0 1px 4px rgba(0,0,0,0.1)":"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:"480px"}}>
                <thead>
                  <tr style={{borderBottom:"2px solid #F0F0F0"}}>
                    {[{l:"Branch Name",c:"branch_name"as const},{l:"Area",c:null},{l:"Total",c:"total"as const},{l:"Aktif ✅",c:"active"as const},{l:"Tdk Aktif 🚫",c:null},{l:"Updated 🔄",c:null},{l:"% Updated",c:"pct_updated"as const},{l:"",c:null}].map((h,i)=>(
                      <th key={i} onClick={()=>h.c&&sortToggle(h.c)}
                        style={{padding:"8px 10px",textAlign:"left",fontSize:"10px",fontWeight:700,color:"#999",textTransform:"uppercase",letterSpacing:"0.06em",cursor:h.c?"pointer":"default",userSelect:"none",whiteSpace:"nowrap"}}>
                        {h.l}{h.c&&<span style={{marginLeft:"3px",opacity:sortCol===h.c?1:0.25,fontSize:"9px"}}>{sortDir===1?"↑":"↓"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBranches.map((b,i)=>{
                    const col=AREA_COLORS[b.area]||"#888"
                    return(
                      <tr key={i} style={{borderBottom:"1px solid #F8F8F8",cursor:"pointer",transition:"background 0.12s"}}
                        onClick={()=>setBranchPopup(b)}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F9FA"}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                        <td style={{padding:"10px",fontSize:"12px",fontWeight:600,color:"#111",maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.branch_name}</td>
                        <td style={{padding:"10px"}}><span style={{background:`${col}15`,color:col,fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px"}}>{b.area}</span></td>
                        <td style={{padding:"10px",fontSize:"12px",fontWeight:600}}>{b.total}</td>
                        <td style={{padding:"10px",fontSize:"12px",color:"#4DCC70",fontWeight:700}}>{b.active}</td>
                        <td style={{padding:"10px",fontSize:"12px",color:b.inactive>0?"#FF4D4D":"#aaa",fontWeight:b.inactive>0?700:400}}>{b.inactive}</td>
                        <td style={{padding:"10px",fontSize:"12px",color:"#4D9FFF",fontWeight:600}}>{b.updated}</td>
                        <td style={{padding:"10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                            <div style={{width:"48px",height:"6px",background:"#F0F0F0",borderRadius:"99px",overflow:"hidden",flexShrink:0}}>
                              <div style={{height:"100%",width:`${b.pct_updated}%`,background:b.pct_updated>=80?"#4DCC70":b.pct_updated>=60?"#FF9A3C":"#FF4D4D",borderRadius:"99px"}}/>
                            </div>
                            <span style={{fontSize:"11px",fontWeight:800,color:b.pct_updated>=80?"#4DCC70":b.pct_updated>=60?"#FF9A3C":"#FF4D4D"}}>{b.pct_updated}%</span>
                          </div>
                        </td>
                        <td style={{padding:"10px",textAlign:"center",fontSize:"13px"}}>{b.pct_updated===100?"✅":b.pct_updated>=80?"🟡":"🔴"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredBranches.length===0 && (
                <div style={{textAlign:"center",padding:"48px",color:"#bbb"}}>
                  <div style={{fontSize:"28px",marginBottom:"10px"}}>🔍</div>
                  No branches found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Upload Toast */}
      {uploadToast.show && uploadToast.data && (
        <div style={{position:"fixed",bottom:"clamp(16px,3vw,28px)",right:"clamp(16px,3vw,28px)",zIndex:9998,animation:"slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",maxWidth:"360px",width:"calc(100vw - 32px)"}}>
          <div style={{background:"linear-gradient(135deg,#0A1A0A,#0D1F0D)",border:"1px solid rgba(77,204,112,0.35)",borderRadius:"20px",padding:"18px 20px",boxShadow:"0 20px 50px rgba(0,0,0,0.4), 0 0 0 1px rgba(77,204,112,0.1)",backdropFilter:"blur(20px)"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"38px",height:"38px",borderRadius:"50%",background:"rgba(77,204,112,0.2)",border:"2px solid #4DCC70",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",animation:"popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>✅</div>
                <div>
                  <div style={{fontSize:"13px",fontWeight:800,color:"white"}}>Data berhasil diupload!</div>
                  <div style={{fontSize:"10px",color:"rgba(255,255,255,0.4)"}}>Landing page terupdate otomatis</div>
                </div>
              </div>
              <button onClick={()=>setUploadToast({show:false})} style={{background:"rgba(255,255,255,0.08)",border:"none",cursor:"pointer",width:"26px",height:"26px",borderRadius:"50%",fontSize:"14px",color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",marginBottom:"12px"}}>
              {[
                {i:"📅",l:"Cutoff",          v:uploadToast.data.cutoff,c:"#6EE88A"},
                {i:"👥",l:"Total Salesman",  v:uploadToast.data.total.toLocaleString(),c:"white"},
                {i:"🏢",l:"Branches",        v:uploadToast.data.branches.toString(),c:"#60B3FF"},
                {i:"📊",l:"Salesman Detail", v:uploadToast.data.salesman.toLocaleString(),c:"#FFD07A"},
              ].map((s,i)=>(
                <div key={i} style={{background:"rgba(255,255,255,0.06)",borderRadius:"10px",padding:"10px 12px",display:"flex",alignItems:"center",gap:"8px"}}>
                  <span style={{fontSize:"16px"}}>{s.i}</span>
                  <div>
                    <div style={{fontSize:"13px",fontWeight:800,color:s.c,fontFamily:"'Bricolage Grotesque',sans-serif",lineHeight:1}}>{s.v}</div>
                    <div style={{fontSize:"9px",color:"rgba(255,255,255,0.35)",fontWeight:600,marginTop:"2px"}}>{s.l}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{height:"3px",background:"rgba(255,255,255,0.08)",borderRadius:"99px",overflow:"hidden"}}>
              <div style={{height:"100%",background:"linear-gradient(90deg,#4DCC70,#6EE88A)",borderRadius:"99px",animation:"countdown 8s linear forwards"}}/>
            </div>
          </div>
        </div>
      )}

      {branchPopup && <BranchPopup b={branchPopup} salesman={branchSalesman} onClose={()=>setBranchPopup(null)}/>}
      {areaPopup && <AreaPopup area={areaPopup} branches={areaPopupBranches} allSalesman={areaPopupSalesman} onBranchClick={b=>{setAreaPopup(null);setBranchPopup(b)}} onClose={()=>setAreaPopup(null)}/>}

      <style dangerouslySetInnerHTML={{__html:`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeInUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spinR { to { transform: rotate(-360deg) } }
        @keyframes particlePop { 0%,100%{opacity:0;transform:scale(0)} 40%,60%{opacity:0.7;transform:scale(1)} }
        @keyframes blobFloat1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,20px)} }
        @keyframes blobFloat2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-20px)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.7)} to{opacity:1;transform:scale(1)} }
        @keyframes areaPopIn { from{opacity:0;transform:scale(0.88) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes countdown { from{width:100%} to{width:0%} }
        @media(max-width:640px){
          .kpi-grid { grid-template-columns: repeat(2,1fr) !important; }
          .sfa-area-grid { grid-template-columns: repeat(2,1fr) !important; }
          .sfa-hero-logo { display: none !important; }
          .sfa-hero-layout { gap: 16px !important; }
          .sfa-popup-bd { align-items: flex-end !important; padding: 0 !important; }
          .sfa-popup-inner {
            border-bottom-left-radius: 0 !important;
            border-bottom-right-radius: 0 !important;
            max-width: 100% !important;
            max-height: 88vh !important;
          }
        }
        @media(min-width:641px){
          .sfa-popup-bd { align-items: center !important; padding: 16px !important; }
        }
        @media(max-width:380px){
          .kpi-grid { gap: 6px !important; }
          .sfa-area-grid { grid-template-columns: 1fr 1fr !important; }
        }
      `}}/>
    </div>
  )
}