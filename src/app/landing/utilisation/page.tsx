"use client"
import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import LandingNav from "../components/LandingNav"
import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────
interface Snapshot { cutoff_date:string; total:number; done_training:number; active:number; updated:number; pct_done:number; pct_active:number; pct_updated:number }
interface Branch { branch_name:string; area:string; total:number; done:number; active:number; inactive:number; updated:number; not_updated:number; pct:number; pct_updated:number }
interface Salesman { sls_no:string; sls_name:string; salesforce:string; team:string; flag_blok:string; done_training:number; done_update:number; sfa_version:string; last_order_date:string|null; branch_name:string; area:string }

const AREA_COLORS: Record<string,string> = {GMA:"#E8381A",MIN:"#FB8C00",NOL:"#1E88E5",SOL:"#43A047",VIS:"#8E24AA"}
const AREA_NAMES = ["GMA","MIN","NOL","SOL","VIS"] as const
type TPoint = Snapshot & { label:string }

// ── Data fetching ─────────────────────────────────────────────
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
    branches: (branch.data || []) as (Branch & { cutoff_date:string })[],
    salesman: (salesman.data || []) as (Salesman & { cutoff_date:string })[],
  }
}

// ── Charts (same as before) ───────────────────────────────────
function LineChart({data,metrics,height=190}:{data:TPoint[];metrics:{key:keyof TPoint;label:string;color:string}[];height?:number}) {
  const [tip,setTip]=useState(-1)
  const ref=useRef<SVGSVGElement>(null)
  const W=560;const H=height;const PL=42;const PR=14;const PT=14;const PB=30
  const cW=W-PL-PR;const cH=H-PT-PB
  const allV=metrics.flatMap(m=>data.map(d=>Number(d[m.key])))
  const mn=Math.min(...allV);const mx=Math.max(...allV)
  const lo=Math.max(0,mn-(mx-mn)*0.15);const hi=mx+(mx-mn)*0.15
  const xP=(i:number)=>PL+(i/(Math.max(data.length-1,1)))*cW
  const yP=(v:number)=>PT+(1-(v-lo)/(hi-lo||1))*cH
  const ticks=[0,.25,.5,.75,1].map(t=>lo+(hi-lo)*t)
  const onMove=useCallback((e:React.MouseEvent<SVGSVGElement>)=>{
    const r=ref.current?.getBoundingClientRect();if(!r)return
    const rx=(e.clientX-r.left)/r.width*W
    let ci=0,md=Infinity
    data.forEach((_,i)=>{const d=Math.abs(xP(i)-rx);if(d<md){md=d;ci=i}})
    setTip(ci)
  },[data])
  if(!data.length) return <div style={{textAlign:"center",padding:"32px",color:"#bbb",fontSize:"13px"}}>No data</div>
  return (
    <div style={{position:"relative"}}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{width:"100%",cursor:"crosshair",overflow:"visible"}} onMouseMove={onMove} onMouseLeave={()=>setTip(-1)}>
        {ticks.map((t,i)=>{const y=yP(t);return(<g key={i}><line x1={PL} y1={y} x2={W-PR} y2={y} stroke="rgba(0,0,0,0.05)" strokeWidth="1" strokeDasharray="4,4"/><text x={PL-5} y={y+3} textAnchor="end" fontSize="9.5" fill="#c0c0c0">{t.toFixed(1)}%</text></g>)})}
        {data.map((d,i)=><text key={i} x={xP(i)} y={H-8} textAnchor="middle" fontSize="9.5" fill="#bbb">{d.label}</text>)}
        {metrics.map((m,mi)=>{
          const vals=data.map(d=>Number(d[m.key]))
          const pts=vals.map((v,i)=>`${xP(i)},${yP(v)}`).join(" ")
          const area=data.length>1?`${xP(0)},${PT+cH} ${pts} ${xP(data.length-1)},${PT+cH}`:""
          return(<g key={mi}>
            <defs><linearGradient id={`lg${mi}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={m.color} stopOpacity="0.2"/><stop offset="100%" stopColor={m.color} stopOpacity="0"/></linearGradient></defs>
            {area&&<polygon points={area} fill={`url(#lg${mi})`}/>}
            <polyline points={pts} fill="none" stroke={m.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            {vals.map((v,i)=><circle key={i} cx={xP(i)} cy={yP(v)} r={tip===i?5:3} fill={m.color} stroke="white" strokeWidth="2" style={{transition:"r 0.1s"}}/>)}
          </g>)})}
        {tip>=0&&<line x1={xP(tip)} y1={PT} x2={xP(tip)} y2={PT+cH} stroke="rgba(0,0,0,0.1)" strokeWidth="1.5" strokeDasharray="3,3"/>}
      </svg>
      {tip>=0&&(
        <div style={{position:"absolute",top:"8px",left:xP(tip)/W>0.6?"auto":`${(xP(tip)/W)*100+1}%`,right:xP(tip)/W>0.6?`${((W-xP(tip))/W)*100+1}%`:"auto",background:"rgba(17,17,17,0.93)",backdropFilter:"blur(8px)",borderRadius:"12px",padding:"10px 14px",minWidth:"180px",boxShadow:"0 8px 24px rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.08)",pointerEvents:"none",zIndex:10}}>
          <div style={{fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.5)",marginBottom:"8px",textTransform:"uppercase"}}>{data[tip].label}</div>
          {metrics.map((m,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",gap:"14px",marginBottom:"3px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"5px"}}><div style={{width:"7px",height:"7px",borderRadius:"50%",background:m.color}}/><span style={{fontSize:"11px",color:"rgba(255,255,255,0.6)"}}>{m.label}</span></div>
              <span style={{fontSize:"12px",fontWeight:800,color:"white"}}>{Number(data[tip][m.key]).toFixed(1)}%</span>
            </div>
          ))}
          <div style={{marginTop:"8px",paddingTop:"8px",borderTop:"1px solid rgba(255,255,255,0.08)",fontSize:"10px",color:"rgba(255,255,255,0.35)"}}>
            Total {data[tip].total?.toLocaleString()} · Updated {data[tip].updated?.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  )
}


// ── ANIMATED ILLUSTRATION ─────────────────────────────────────
function UtilisationAnimation() {
  return (
    <div style={{position:"relative",width:"clamp(180px,24vw,280px)",height:"clamp(180px,24vw,280px)",flexShrink:0}}>
      <svg viewBox="0 0 280 280" style={{width:"100%",height:"100%"}} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="bg-glow2" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#E8381A" stopOpacity="0.15"/><stop offset="100%" stopColor="#E8381A" stopOpacity="0"/></radialGradient>
          <linearGradient id="b-r2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF6B4A"/><stop offset="100%" stopColor="#E8381A"/></linearGradient>
          <linearGradient id="b-b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#60B3FF"/><stop offset="100%" stopColor="#1E88E5"/></linearGradient>
          <linearGradient id="b-g2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6EE88A"/><stop offset="100%" stopColor="#43A047"/></linearGradient>
          <linearGradient id="b-o2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFD07A"/><stop offset="100%" stopColor="#FB8C00"/></linearGradient>
          <filter id="gf2"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <circle cx="140" cy="140" r="120" fill="url(#bg-glow2)"/>
        <circle cx="140" cy="140" r="115" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" strokeDasharray="4,8"/>
        <rect x="50" y="90" width="180" height="140" rx="14" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
        <rect x="50" y="90" width="180" height="30" rx="14" fill="rgba(255,255,255,0.08)"/>
        <rect x="50" y="106" width="180" height="14" fill="rgba(255,255,255,0.08)"/>
        <circle cx="70" cy="106" r="7" fill="#E8381A" opacity="0.9"/>
        <rect x="84" y="101" width="50" height="7" rx="3.5" fill="rgba(255,255,255,0.3)"/>
        {[{x:68,h:78,c:"url(#b-r2)",d:"0s"},{x:98,h:60,c:"url(#b-b2)",d:"0.15s"},{x:128,h:72,c:"url(#b-g2)",d:"0.3s"},{x:158,h:50,c:"url(#b-o2)",d:"0.45s"},{x:188,h:65,c:"rgba(179,136,255,0.9)",d:"0.6s"}].map((b,i)=>(
          <g key={i}>
            <rect x={b.x} y={198-b.h} width="20" height={b.h} rx="4" fill="rgba(255,255,255,0.04)"/>
            <rect x={b.x} y="198" width="20" height="0" rx="4" fill={b.c} opacity="0.9">
              <animate attributeName="height" values={`0;${b.h};${b.h}`} dur="2.5s" begin={b.d} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0 0 0 0"/>
              <animate attributeName="y" values={`198;${198-b.h};${198-b.h}`} dur="2.5s" begin={b.d} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0 0 0 0"/>
            </rect>
          </g>
        ))}
        <line x1="60" y1="198" x2="216" y2="198" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
        <polyline points="78,125 108,138 138,128 168,145 198,132" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="180" strokeDashoffset="180">
          <animate attributeName="stroke-dashoffset" values="180;0;0" dur="2.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.2 1;0 0 0 0"/>
        </polyline>
        {[[78,125],[108,138],[138,128],[168,145],[198,132]].map(([x,y],i)=>(
          <circle key={i} cx={x} cy={y} r="3" fill="white" opacity="0"><animate attributeName="opacity" values="0;0;0.9;0.9" dur="2.5s" begin={`${i*0.08}s`} repeatCount="indefinite"/></circle>
        ))}
        <g filter="url(#gf2)">
          <rect x="186" y="48" width="66" height="30" rx="9" fill="#43A047">
            <animate attributeName="y" values="48;42;48" dur="3s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
          </rect>
          <text x="219" y="60" textAnchor="middle" fontSize="8" fontWeight="700" fill="rgba(255,255,255,0.7)">Training</text>
          <text x="219" y="72" textAnchor="middle" fontSize="13" fontWeight="900" fill="white">100%</text>
        </g>
        <g>
          <rect x="22" y="110" width="64" height="26" rx="7" fill="rgba(30,136,229,0.85)" stroke="rgba(96,179,255,0.4)" strokeWidth="1">
            <animate attributeName="y" values="110;118;110" dur="3.5s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
          </rect>
          <text x="54" y="120" textAnchor="middle" fontSize="7" fontWeight="600" fill="rgba(255,255,255,0.7)"><animate attributeName="y" values="120;128;120" dur="3.5s" repeatCount="indefinite"/>Active</text>
          <text x="54" y="130" textAnchor="middle" fontSize="11" fontWeight="900" fill="white"><animate attributeName="y" values="130;138;130" dur="3.5s" repeatCount="indefinite"/>1,238</text>
        </g>
        <g>
          <rect x="20" y="172" width="56" height="26" rx="7" fill="rgba(142,36,170,0.8)" stroke="rgba(206,147,216,0.4)" strokeWidth="1">
            <animate attributeName="y" values="172;165;172" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1;0.45 0 0.55 1"/>
          </rect>
          <text x="48" y="182" textAnchor="middle" fontSize="7" fontWeight="600" fill="rgba(255,255,255,0.7)"><animate attributeName="y" values="182;175;182" dur="4s" repeatCount="indefinite"/>Updated</text>
          <text x="48" y="192" textAnchor="middle" fontSize="11" fontWeight="900" fill="white"><animate attributeName="y" values="192;185;192" dur="4s" repeatCount="indefinite"/>994</text>
        </g>
        {[[248,92,2.5,"#FF6B4A",2],[38,62,2,"#6EE88A",2.5],[262,185,1.8,"#FFD07A",1.8]].map(([x,y,r,fill,dur],i)=>(
          <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={fill as string} opacity="0">
            <animate attributeName="opacity" values="0;0.8;0" dur={`${dur}s`} begin={`${i*0.6}s`} repeatCount="indefinite"/>
            <animate attributeName="r" values={`${r};${Number(r)*1.8};${r}`} dur={`${dur}s`} begin={`${i*0.6}s`} repeatCount="indefinite"/>
          </circle>
        ))}
      </svg>
    </div>
  )
}

// ── Branch Popup ──────────────────────────────────────────────
function BranchPopup({b,salesman,onClose}:{b:Branch;salesman:Salesman[];onClose:()=>void}) {
  const col=AREA_COLORS[b.area]||"#888"
  const [tab,setTab]=useState<"overview"|"salesman">("overview")
  const [slsFilter,setSlsFilter]=useState<"all"|"active"|"inactive"|"updated"|"notUpdated">("all")
  const [slsSearch,setSlsSearch]=useState("")
  const filtered=useMemo(()=>salesman.filter(s=>{
    const ok=s.sls_name.toLowerCase().includes(slsSearch.toLowerCase())||s.sls_no.includes(slsSearch)
    if(!ok)return false
    if(slsFilter==="active")return s.flag_blok==="T"
    if(slsFilter==="inactive")return s.flag_blok==="Y"
    if(slsFilter==="updated")return s.done_update===1
    if(slsFilter==="notUpdated")return s.done_update===0
    return true
  }),[salesman,slsFilter,slsSearch])

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",backdropFilter:"blur(8px)"}} onClick={onClose}>
      <div style={{background:"white",borderRadius:"24px",maxWidth:"680px",width:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 32px 80px rgba(0,0,0,0.25)"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:`linear-gradient(135deg,${col}15,${col}05)`,padding:"18px 22px 14px",borderBottom:`3px solid ${col}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div style={{flex:1,minWidth:0}}>
              <span style={{display:"inline-block",background:col,color:"white",fontSize:"10px",fontWeight:700,padding:"2px 10px",borderRadius:"99px",marginBottom:"5px"}}>{b.area}</span>
              <div style={{fontSize:"14px",fontWeight:800,color:"#111",paddingRight:"12px"}}>{b.branch_name}</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(0,0,0,0.07)",border:"none",cursor:"pointer",width:"30px",height:"30px",borderRadius:"50%",fontSize:"16px",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
          </div>
          <div style={{display:"flex",gap:"6px",marginTop:"10px",flexWrap:"wrap"}}>
            {[{l:"Total",v:b.total,c:"#666",bg:"rgba(0,0,0,0.06)"},{l:"Trained",v:b.done,c:col,bg:`${col}15`},{l:"Aktif (T)",v:b.active,c:"#43A047",bg:"rgba(67,160,71,0.12)"},{l:"Tdk Aktif (Y)",v:b.inactive,c:"#E8381A",bg:"rgba(232,56,26,0.1)"},{l:"Updated SFA",v:b.updated,c:"#1E88E5",bg:"rgba(30,136,229,0.12)"}].map((s,i)=>(
              <div key={i} style={{background:s.bg,borderRadius:"8px",padding:"4px 10px",textAlign:"center"}}>
                <div style={{fontSize:"15px",fontWeight:900,color:s.c,fontFamily:"'Bricolage Grotesque',sans-serif",lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:"9px",color:"#888",fontWeight:600,marginTop:"1px"}}>{s.l}</div>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:"4px",marginTop:"10px"}}>
            {[{k:"overview",l:"📊 Overview"},{k:"salesman",l:`👤 Salesman (${b.total})`}].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k as "overview"|"salesman")}
                style={{padding:"5px 12px",border:"none",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:700,fontFamily:"inherit",background:tab===t.k?col:"rgba(0,0,0,0.06)",color:tab===t.k?"white":"#666",transition:"all 0.2s"}}>
                {t.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          {tab==="overview"&&(
            <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:"10px"}}>
              {[{l:"Training Completion",v:b.pct,c:col,note:"Semua salesman aktif 2026 sudah trained"},{l:"SFA Update Rate",v:b.pct_updated,c:"#1E88E5",note:"% yang menggunakan SFA versi 2026"},{l:"Active Rate (Flag T)",v:b.total?Math.round(b.active/b.total*100):0,c:"#43A047",note:"% yang tidak diblokir & bertransaksi"}].map((m,i)=>(
                <div key={i} style={{background:"#F8F8F8",borderRadius:"12px",padding:"12px 14px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                    <div><div style={{fontSize:"12px",fontWeight:700,color:"#111"}}>{m.l}</div><div style={{fontSize:"10px",color:"#aaa",marginTop:"1px"}}>{m.note}</div></div>
                    <div style={{fontSize:"22px",fontWeight:900,color:m.v>=80?"#43A047":m.v>=60?m.c:"#E8381A",fontFamily:"'Bricolage Grotesque',sans-serif"}}>{m.v}%</div>
                  </div>
                  <div style={{height:"7px",background:"rgba(0,0,0,0.08)",borderRadius:"99px",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${m.v}%`,background:m.c,borderRadius:"99px"}}/>
                  </div>
                </div>
              ))}
              <button onClick={()=>setTab("salesman")} style={{width:"100%",padding:"10px",borderRadius:"10px",border:`1.5px solid ${col}30`,background:"transparent",color:col,cursor:"pointer",fontFamily:"inherit",fontSize:"12px",fontWeight:700}}>
                👤 View Salesman List →
              </button>
            </div>
          )}
          {tab==="salesman"&&(
            <div>
              <div style={{padding:"10px 14px",borderBottom:"1px solid #F0F0F0",display:"flex",gap:"7px",flexWrap:"wrap",alignItems:"center",position:"sticky",top:0,background:"white",zIndex:1}}>
                <input placeholder="🔍 Name / SLS No..." value={slsSearch} onChange={e=>setSlsSearch(e.target.value)}
                  style={{padding:"5px 10px",border:"1.5px solid #E5E7EB",borderRadius:"8px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(110px,30%,150px)"}}
                  onFocus={e=>{e.currentTarget.style.borderColor=col}} onBlur={e=>{e.currentTarget.style.borderColor="#E5E7EB"}}/>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"8px",padding:"2px",flexWrap:"wrap"}}>
                  {([{k:"all",l:"Semua"},{k:"active",l:"✅ Aktif"},{k:"inactive",l:"🚫 Tdk Aktif"},{k:"updated",l:"🔄 Updated"},{k:"notUpdated",l:"⚠️ Blm Update"}] as const).map(opt=>(
                    <button key={opt.k} onClick={()=>setSlsFilter(opt.k)}
                      style={{padding:"3px 8px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:slsFilter===opt.k?"white":"transparent",color:slsFilter===opt.k?"#111":"#888",boxShadow:slsFilter===opt.k?"0 1px 3px rgba(0,0,0,0.08)":"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                <span style={{fontSize:"10px",color:"#aaa",marginLeft:"auto"}}>{filtered.length} salesman</span>
              </div>
              <div style={{padding:"8px 14px",background:"#FFFBEB",borderBottom:"1px solid #FEF3C7",fontSize:"10px",color:"#92400E",lineHeight:1.6}}>
                <strong>Aktif (T)</strong> = bertransaksi 2026 · <strong>Tdk Aktif (Y)</strong> = blokir ·
                <strong> Updated</strong> = pakai SFA v26.xx · <strong>Blm Update</strong> = SFA versi lama
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:"560px"}}>
                  <thead><tr style={{background:"#FAFAF8",borderBottom:"1px solid #F0F0F0"}}>
                    {["SLS No","Name","Salesforce","Team","Status","SFA Ver","Last Order"].map(h=>(
                      <th key={h} style={{padding:"7px 9px",textAlign:"left",fontSize:"10px",fontWeight:700,color:"#999",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filtered.map((s,i)=>(
                      <tr key={i} style={{borderBottom:"1px solid #F8F8F8"}}>
                        <td style={{padding:"7px 9px",fontSize:"11px",color:"#888",fontFamily:"monospace"}}>{s.sls_no}</td>
                        <td style={{padding:"7px 9px",fontSize:"12px",fontWeight:600,color:"#111"}}>{s.sls_name}</td>
                        <td style={{padding:"7px 9px",fontSize:"11px",color:"#555",maxWidth:"130px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.salesforce}</td>
                        <td style={{padding:"7px 9px",fontSize:"11px",color:"#555"}}>{s.team}</td>
                        <td style={{padding:"7px 9px"}}><span style={{fontSize:"10px",fontWeight:700,padding:"2px 7px",borderRadius:"99px",background:s.flag_blok==="T"?"#E8F5E9":"#FEF0ED",color:s.flag_blok==="T"?"#43A047":"#E8381A"}}>{s.flag_blok==="T"?"✅ Aktif":"🚫 Tdk Aktif"}</span></td>
                        <td style={{padding:"7px 9px"}}><span style={{fontSize:"10px",fontWeight:700,padding:"2px 7px",borderRadius:"99px",background:s.done_update===1?"#EEF7FF":"#F8F8F8",color:s.done_update===1?"#1E88E5":"#999",fontFamily:"monospace"}}>{s.sfa_version==="Unknown"?"—":s.sfa_version}</span></td>
                        <td style={{padding:"7px 9px",fontSize:"11px",color:"#888",fontFamily:"monospace",whiteSpace:"nowrap"}}>{s.last_order_date||"—"}</td>
                      </tr>
                    ))}
                    {filtered.length===0&&<tr><td colSpan={7} style={{textAlign:"center",padding:"28px",color:"#bbb"}}>No salesman found</td></tr>}
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

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function UtilisationPage() {
  const [loading,setLoading]=useState(true)
  const [uploadToast,setUploadToast]=useState<{show:boolean;data?:{cutoff:string;total:number;branches:number;salesman:number}}>({show:false})
  const [error,setError]=useState("")
  const [snapshots,setSnapshots]=useState<Snapshot[]>([])
  const [allBranches,setAllBranches]=useState<(Branch&{cutoff_date:string})[]>([])
  const [salesman,setSalesman]=useState<(Salesman&{cutoff_date:string})[]>([])
  const [appTab]=useState("sfa")
  const [viewMode,setViewMode]=useState<"cutoff"|"month">("cutoff")
  const [areaFilter,setAreaFilter]=useState("ALL")
  const [chartTab,setChartTab]=useState<"overall"|"area">("overall")
  const [showMetrics,setShowMetrics]=useState({done:true,active:true,updated:true})
  const [search,setSearch]=useState("")
  const [sortCol,setSortCol]=useState<"branch_name"|"total"|"active"|"pct_updated">("branch_name")
  const [sortDir,setSortDir]=useState<1|-1>(1)
  const [branchPopup,setBranchPopup]=useState<Branch|null>(null)
  const [salsFilter,setSalsFilter]=useState<"all"|"active"|"inactive">("all")

  useEffect(()=>{
    const load = async () => {
      try {
        const data = await fetchSFAData()
        setSnapshots(data.snapshots)
        setAllBranches(data.branches)
        setSalesman(data.salesman)
      } catch(e) {
        setError(e instanceof Error ? e.message : "Failed to load data")
      } finally { setLoading(false) }
    }
    load()

    // Realtime: listen for new uploads
    const channel = supabase
      .channel("sfa-updates")
      .on("postgres_changes", { event:"INSERT", schema:"public", table:"sfa_snapshots" }, async (payload) => {
        // Reload all data when new snapshot inserted
        const data = await fetchSFAData()
        setSnapshots(data.snapshots)
        setAllBranches(data.branches)
        setSalesman(data.salesman)
        // Show toast
        const snap = payload.new as {cutoff_date:string;total:number}
        const branchCount = data.branches.filter((b:{cutoff_date:string})=>b.cutoff_date===snap.cutoff_date).length
        setUploadToast({
          show: true,
          data: { cutoff: snap.cutoff_date, total: snap.total, branches: branchCount, salesman: data.salesman.length }
        })
        setTimeout(()=>setUploadToast({show:false}), 8000)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
    const l=document.createElement("link");l.rel="stylesheet"
    l.href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600&display=swap"
    if(!document.querySelector("link[data-uf]")){l.setAttribute("data-uf","1");document.head.appendChild(l)}
  },[])

  // Derived data
  const latest=snapshots[snapshots.length-1]
  const latestCutoff=latest?.cutoff_date||""

  const trendData=useMemo(():TPoint[]=>{
    const data = snapshots.map(s=>({...s,label:new Date(s.cutoff_date).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}))
    if(viewMode==="month"){
      const monthly=new Map<string,TPoint>()
      data.forEach(d=>{const m=d.cutoff_date.slice(0,7);if(!monthly.has(m)||d.cutoff_date>monthly.get(m)!.cutoff_date)monthly.set(m,{...d,label:new Date(d.cutoff_date).toLocaleDateString("en-GB",{month:"short"})})})
      return [...monthly.values()].sort((a,b)=>a.cutoff_date.localeCompare(b.cutoff_date))
    }
    return data
  },[snapshots,viewMode])

  const latestBranches=useMemo(()=>allBranches.filter(b=>b.cutoff_date===latestCutoff),[allBranches,latestCutoff])

  const areaSummary=useMemo(()=>AREA_NAMES.map(area=>{
    const bs=latestBranches.filter(b=>b.area===area)
    const total=bs.reduce((s,b)=>s+b.total,0)
    const active=bs.reduce((s,b)=>s+b.active,0)
    const updated=bs.reduce((s,b)=>s+b.updated,0)
    return {area,color:AREA_COLORS[area],total,done:total,active,inactive:bs.reduce((s,b)=>s+b.inactive,0),updated,pct:100,pctUpdated:total?Math.round(updated/total*100):0}
  }),[latestBranches])

  const filteredBranches=useMemo(()=>latestBranches
    .filter(b=>{
      if(areaFilter!=="ALL"&&b.area!==areaFilter)return false
      if(!b.branch_name.toLowerCase().includes(search.toLowerCase()))return false
      if(salsFilter==="active"&&b.active===0)return false
      if(salsFilter==="inactive"&&b.inactive===0)return false
      return true
    })
    .sort((a,b)=>{
      if(sortCol==="branch_name")return sortDir*a.branch_name.localeCompare(b.branch_name)
      return sortDir*((a[sortCol as keyof Branch] as number)-(b[sortCol as keyof Branch] as number))
    })
  ,[latestBranches,areaFilter,search,sortCol,sortDir,salsFilter])

  const branchSalesman=useMemo(()=>branchPopup?salesman.filter(s=>s.branch_name===branchPopup.branch_name):[]
  ,[salesman,branchPopup])

  const activeMetrics=[
    showMetrics.done    &&{key:"pct_done"    as keyof TPoint,label:"Trained %", color:"#E8381A"},
    showMetrics.active  &&{key:"pct_active"  as keyof TPoint,label:"Active %",  color:"#1E88E5"},
    showMetrics.updated &&{key:"pct_updated" as keyof TPoint,label:"Updated %", color:"#43A047"},
  ].filter(Boolean) as {key:keyof TPoint;label:string;color:string}[]

  const sortToggle=(col:typeof sortCol)=>{if(sortCol===col)setSortDir(d=>d===1?-1:1);else{setSortCol(col);setSortDir(1)}}

  if(loading) return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#0f0f0f",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <LandingNav/>
      <div style={{textAlign:"center",color:"white"}}>
        <div style={{fontSize:"32px",marginBottom:"16px",animation:"spin 1s linear infinite",display:"inline-block"}}>⏳</div>
        <div style={{fontSize:"16px",fontWeight:600,color:"rgba(255,255,255,0.7)"}}>Loading utilisation data...</div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  )

  if(error) return (
    <div style={{fontFamily:"'DM Sans',sans-serif",background:"#0f0f0f",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <LandingNav/>
      <div style={{textAlign:"center",color:"white",maxWidth:"400px",padding:"24px"}}>
        <div style={{fontSize:"40px",marginBottom:"16px"}}>⚠️</div>
        <div style={{fontSize:"18px",fontWeight:700,marginBottom:"8px"}}>Failed to load data</div>
        <div style={{fontSize:"13px",color:"rgba(255,255,255,0.5)",marginBottom:"20px"}}>{error}</div>
        <button onClick={()=>window.location.reload()} style={{padding:"10px 24px",borderRadius:"99px",background:"#E8381A",color:"white",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:"13px",fontWeight:700}}>Retry</button>
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",color:"#111",background:"#0f0f0f",minHeight:"100vh"}}>
      <LandingNav/>

      {/* App tabs */}
      <div style={{position:"sticky",top:"64px",zIndex:90,background:"rgba(15,15,15,0.97)",backdropFilter:"blur(16px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"0 clamp(20px,5vw,80px)"}}>
        <div className="tab-bar" style={{maxWidth:"1100px",margin:"0 auto",display:"flex",overflowX:"auto"}}>
          {[{id:"sfa",label:"SFA",logo:"/sfa-logo.png",active:true},{id:"ficom",label:"💰 Ficom",logo:null,active:false},{id:"ficom-lite",label:"📱 Ficom Lite",logo:null,active:false}].map(tab=>(
            <button key={tab.id}
              style={{padding:"10px 20px",border:"none",cursor:tab.active?"pointer":"not-allowed",fontFamily:"inherit",fontSize:"13px",fontWeight:appTab===tab.id?700:500,color:appTab===tab.id?"#FF6B4A":tab.active?"rgba(255,255,255,0.5)":"rgba(255,255,255,0.2)",background:"transparent",borderBottom:appTab===tab.id?"2px solid #FF6B4A":"2px solid transparent",transition:"all 0.2s",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap"}}>
              {tab.logo?<img src={tab.logo} alt={tab.label} style={{height:"26px",width:"auto",objectFit:"contain",opacity:1,transition:"opacity 0.2s"}}/>:<span>{tab.label}</span>}
              {!tab.active&&<span style={{fontSize:"9px",background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.25)",padding:"2px 6px",borderRadius:"99px"}}>Soon</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div style={{padding:"clamp(40px,6vw,72px) clamp(20px,5vw,80px) clamp(28px,4vw,44px)",background:"linear-gradient(180deg,#0f0f0f 0%,#141414 100%)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-20%",right:"-8%",width:"clamp(200px,40vw,520px)",height:"clamp(200px,40vw,520px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(232,56,26,0.18),transparent 70%)",filter:"blur(70px)",pointerEvents:"none"}}/>
        <div style={{maxWidth:"1100px",margin:"0 auto",display:"flex",gap:"clamp(24px,4vw,56px)",alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:"280px"}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:"8px",background:"rgba(232,56,26,0.18)",border:"1px solid rgba(232,56,26,0.35)",borderRadius:"99px",padding:"5px 14px",marginBottom:"18px"}}>
            <div style={{width:"7px",height:"7px",borderRadius:"50%",background:"#FF6B4A",animation:"pulse2 2s infinite"}}/>
            <span style={{fontSize:"12px",fontWeight:700,color:"#FF6B4A",letterSpacing:"0.1em",textTransform:"uppercase"}}>Live · SFA Pilot PHI · {latestCutoff}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:"14px",marginBottom:"10px",flexWrap:"wrap"}}>
            <h1 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(28px,4.5vw,52px)",fontWeight:900,lineHeight:1.08,letterSpacing:"-0.03em",color:"white"}}>
              SFA Utilisation<br/><span style={{color:"#FF6B4A"}}>Monitoring</span>
            </h1>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sfa-logo.png" alt="SFA 2.0" className="sfa-logo-hero" style={{height:"clamp(28px,4vw,44px)",width:"auto",objectFit:"contain",opacity:0.9}}/>
          </div>
          <p style={{fontSize:"clamp(12px,1.3vw,14px)",color:"rgba(255,255,255,0.4)",marginBottom:"clamp(18px,3vw,28px)"}}>
            {latest?.total?.toLocaleString()} active salesman · {latestBranches.length} branches · 5 areas · Data 2026 only
          </p>
          <div className="kpi-6" style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:"clamp(5px,0.8vw,8px)",maxWidth:"640px"}}>
            {[
              {n:`${latest?.pct_done||0}%`,l:"Trained", i:"🎓",c:"#FF6B4A"},
              {n:(latest?.total||0).toLocaleString(),l:"Salesman",i:"👥",c:"white"},
              {n:(latest?.active||0).toLocaleString(),l:"Aktif (T)",i:"✅",c:"#6EE88A"},
              {n:((latest?.total||0)-(latest?.active||0)).toLocaleString(),l:"Tdk Aktif",i:"🚫",c:"rgba(255,255,255,0.5)"},
              {n:(latest?.updated||0).toLocaleString(),l:"Updated",i:"🔄",c:"#60B3FF"},
              {n:`${latest?.pct_updated||0}%`,l:"Upd Rate",i:"📱",c:"rgba(255,255,255,0.6)"},
            ].map((s,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.05)",borderRadius:"10px",padding:"clamp(7px,1vw,11px) clamp(5px,0.7vw,8px)",border:"1px solid rgba(255,255,255,0.07)",textAlign:"center",overflow:"hidden"}}>
                <div style={{fontSize:"clamp(12px,1.6vw,15px)",marginBottom:"3px"}}>{s.i}</div>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(11px,1.4vw,16px)",fontWeight:900,color:s.c,lineHeight:1,marginBottom:"3px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{s.n}</div>
                <div style={{fontSize:"clamp(7px,0.65vw,8px)",color:"rgba(255,255,255,0.3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.04em"}}>{s.l}</div>
              </div>
            ))}
          </div>
          </div>
          <div className="hero-anim"><UtilisationAnimation/></div>
        </div>
      </div>

      <div style={{background:"#FAFAF8",borderRadius:"24px 24px 0 0"}}>
        <div style={{maxWidth:"1100px",margin:"0 auto",padding:"clamp(18px,3vw,32px) clamp(20px,5vw,80px)"}}>

          {/* Glossary */}
          <div style={{background:"white",borderRadius:"14px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(12px,1.5vw,16px)",marginBottom:"clamp(12px,1.8vw,18px)",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:700,fontSize:"12px",color:"#333",marginBottom:"8px"}}>📖 Keterangan Istilah</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:"7px"}}>
              {[
                {term:"Trained",def:"Sudah training SFA (100% dari salesman aktif 2026)",c:"#E8381A"},
                {term:"Aktif (Flag T)",def:"Tidak diblokir & bertransaksi di 2026",c:"#43A047"},
                {term:"Tdk Aktif (Flag Y)",def:"Diblokir — last order bisa 2019–2022",c:"#888"},
                {term:"Updated SFA",def:"Menggunakan SFA versi 2026 (v26.xx.xx)",c:"#1E88E5"},
              ].map((g,i)=>(
                <div key={i} style={{padding:"7px 10px",background:"#F8F8F8",borderRadius:"8px",borderLeft:`3px solid ${g.c}`}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:g.c,marginBottom:"2px"}}>{g.term}</div>
                  <div style={{fontSize:"10px",color:"#666",lineHeight:1.4}}>{g.def}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Area filter */}
          <div style={{background:"white",borderRadius:"14px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(10px,1.5vw,16px)",marginBottom:"clamp(12px,1.8vw,18px)",display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:700,fontSize:"12px",color:"#333",flexShrink:0}}>🗺️ Filter Area:</div>
            <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
              {["ALL","GMA","MIN","NOL","SOL","VIS"].map(a=>(
                <button key={a} onClick={()=>setAreaFilter(a)}
                  style={{padding:"4px 11px",borderRadius:"8px",border:`1.5px solid`,borderColor:areaFilter===a?(AREA_COLORS[a]||"#E8381A"):"#E5E7EB",background:areaFilter===a?`${(AREA_COLORS[a]||"#E8381A")}12`:"transparent",color:areaFilter===a?(AREA_COLORS[a]||"#E8381A"):"#666",cursor:"pointer",fontFamily:"inherit",fontSize:"11px",fontWeight:700,transition:"all 0.15s"}}>
                  {a}
                </button>
              ))}
            </div>
            {areaFilter!=="ALL"&&<button onClick={()=>setAreaFilter("ALL")} style={{padding:"4px 11px",borderRadius:"8px",border:"1.5px solid #E8381A",background:"#FEF0ED",color:"#E8381A",cursor:"pointer",fontFamily:"inherit",fontSize:"11px",fontWeight:700,marginLeft:"auto"}}>✕ Clear</button>}
          </div>

          {/* Chart */}
          <div style={{background:"white",borderRadius:"14px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,20px)",marginBottom:"clamp(12px,1.8vw,18px)",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginBottom:"12px"}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                  <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,17px)",fontWeight:800}}>📈 Training Progress Trend</h2>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/sfa-logo.png" alt="" style={{height:"18px",width:"auto",opacity:0.45}}/>
                </div>
                <p style={{fontSize:"10px",color:"#bbb",marginTop:"2px"}}>Hover untuk detail · 2026 active salesman only</p>
              </div>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"9px",padding:"3px"}}>
                  {(["cutoff","month"] as const).map(v=>(
                    <button key={v} onClick={()=>setViewMode(v)} style={{padding:"4px 10px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:viewMode===v?"white":"transparent",color:viewMode===v?"#111":"#888",boxShadow:viewMode===v?"0 2px 5px rgba(0,0,0,0.08)":"none",transition:"all 0.2s",whiteSpace:"nowrap"}}>
                      {v==="cutoff"?"By Date":"By Month"}
                    </button>
                  ))}
                </div>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"9px",padding:"3px"}}>
                  {(["overall","area"] as const).map(t=>(
                    <button key={t} onClick={()=>setChartTab(t)} style={{padding:"4px 10px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:chartTab===t?"white":"transparent",color:chartTab===t?"#111":"#888",boxShadow:chartTab===t?"0 2px 5px rgba(0,0,0,0.08)":"none",transition:"all 0.2s"}}>
                      {t==="overall"?"Overall":"By Area"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {chartTab==="overall"&&(
              <div style={{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap",alignItems:"center"}}>
                <span style={{fontSize:"10px",color:"#bbb",fontWeight:600}}>Tampilkan:</span>
                {[{k:"done",l:"Trained %",c:"#E8381A"},{k:"active",l:"Active %",c:"#1E88E5"},{k:"updated",l:"Updated %",c:"#43A047"}].map(m=>(
                  <button key={m.k} onClick={()=>setShowMetrics(s=>({...s,[m.k]:!s[m.k as keyof typeof s]}))}
                    style={{display:"flex",alignItems:"center",gap:"5px",padding:"4px 10px",borderRadius:"99px",border:`1.5px solid ${showMetrics[m.k as keyof typeof showMetrics]?m.c:"#e0e0e0"}`,background:showMetrics[m.k as keyof typeof showMetrics]?`${m.c}12`:"transparent",cursor:"pointer",fontFamily:"inherit",fontSize:"10px",fontWeight:700,color:showMetrics[m.k as keyof typeof showMetrics]?m.c:"#aaa",transition:"all 0.15s"}}>
                    <div style={{width:"6px",height:"6px",borderRadius:"50%",background:showMetrics[m.k as keyof typeof showMetrics]?m.c:"#ddd"}}/>
                    {m.l}
                  </button>
                ))}
              </div>
            )}
            {chartTab==="overall"&&<LineChart data={trendData} metrics={activeMetrics} height={190}/>}
            {chartTab==="area"&&(
              <div style={{overflowX:"auto"}}>
                <table style={{borderCollapse:"separate",borderSpacing:"3px",width:"100%",minWidth:"380px"}}>
                  <thead><tr>
                    <th style={{fontSize:"10px",color:"#bbb",fontWeight:600,textAlign:"left",padding:"0 8px 8px"}}>Area</th>
                    {trendData.map(r=><th key={r.label} style={{fontSize:"10px",color:"#bbb",fontWeight:600,textAlign:"center",padding:"0 0 8px"}}>{r.label}</th>)}
                  </tr></thead>
                  <tbody>
                    {AREA_NAMES.map(a=>(
                      <tr key={a}>
                        <td style={{padding:"0 8px 0 0"}}><div style={{display:"flex",alignItems:"center",gap:"5px"}}><div style={{width:"7px",height:"7px",borderRadius:"2px",background:AREA_COLORS[a]}}/><span style={{fontSize:"11px",fontWeight:700,color:AREA_COLORS[a]}}>{a}</span></div></td>
                        {trendData.map((_,ci)=>(
                          <td key={ci} style={{padding:"2px"}}><div style={{minWidth:"44px",height:"28px",borderRadius:"6px",background:"rgba(67,160,71,0.72)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"10px",fontWeight:800,color:"white"}}>100%</span></div></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Area cards */}
          <div style={{background:"white",borderRadius:"14px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,20px)",marginBottom:"clamp(12px,1.8vw,18px)",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,17px)",fontWeight:800,marginBottom:"4px"}}>🗺️ Performance by Area</h2>
            <p style={{fontSize:"10px",color:"#bbb",marginBottom:"12px"}}>Click untuk lihat detail branch · Progress bar = % Updated SFA</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,155px),1fr))",gap:"clamp(8px,1.2vw,12px)"}}>
              {areaSummary.map((a,i)=>(
                <div key={i}
                  style={{borderRadius:"14px",padding:"clamp(12px,1.6vw,16px)",border:`2px solid ${a.color}20`,background:"white",cursor:"pointer",transition:"all 0.22s",boxShadow:"0 2px 6px rgba(0,0,0,0.04)"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=a.color;e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 20px ${a.color}22`}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=`${a.color}20`;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 6px rgba(0,0,0,0.04)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"7px"}}>
                    <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.6vw,16px)",fontWeight:900,color:a.color}}>{a.area}</span>
                    <span style={{fontSize:"clamp(13px,1.5vw,16px)",fontWeight:900,color:"#43A047",fontFamily:"'Bricolage Grotesque',sans-serif"}}>100%</span>
                  </div>
                  <div style={{height:"4px",background:`${a.color}18`,borderRadius:"99px",marginBottom:"8px"}}>
                    <div style={{height:"100%",width:`${a.pctUpdated}%`,background:a.color,borderRadius:"99px"}}/>
                  </div>
                  <div style={{fontSize:"clamp(9px,1vw,10px)",color:"#888",lineHeight:1.7}}>
                    <div><strong style={{color:"#111"}}>{a.total}</strong> salesman</div>
                    <div>✅ {a.active} aktif · 🔄 {a.pctUpdated}% updated</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Branch table */}
          <div style={{background:"white",borderRadius:"14px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,20px)",boxShadow:"0 2px 8px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginBottom:"10px"}}>
              <div>
                <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,17px)",fontWeight:800}}>
                  🏢 Branch Detail <span style={{fontSize:"12px",fontWeight:400,color:"#999"}}>({filteredBranches.length}/{latestBranches.length})</span>
                </h2>
                <p style={{fontSize:"10px",color:"#bbb",marginTop:"2px"}}>Click row → lihat daftar salesman · {latestCutoff}</p>
              </div>
              <div style={{display:"flex",gap:"7px",flexWrap:"wrap",alignItems:"center"}}>
                <input placeholder="🔍 Search..." value={search} onChange={e=>setSearch(e.target.value)}
                  style={{padding:"6px 11px",border:"1.5px solid #E5E7EB",borderRadius:"8px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(110px,18vw,160px)",background:"#FAFAF8"}}
                  onFocus={e=>{e.currentTarget.style.borderColor="#E8381A"}} onBlur={e=>{e.currentTarget.style.borderColor="#E5E7EB"}}/>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"8px",padding:"2px"}}>
                  {([{k:"all",l:"Semua"},{k:"active",l:"✅ Aktif"},{k:"inactive",l:"🚫 Tdk Aktif"}] as const).map(opt=>(
                    <button key={opt.k} onClick={()=>setSalsFilter(opt.k)}
                      style={{padding:"4px 9px",borderRadius:"6px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:salsFilter===opt.k?"white":"transparent",color:salsFilter===opt.k?"#111":"#888",boxShadow:salsFilter===opt.k?"0 1px 3px rgba(0,0,0,0.08)":"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:"520px"}}>
                <thead>
                  <tr style={{borderBottom:"2px solid #F0F0F0"}}>
                    {[{l:"Branch Name",c:"branch_name"as const},{l:"Area",c:null},{l:"Total",c:"total"as const},{l:"Aktif ✅",c:"active"as const},{l:"Tdk Aktif 🚫",c:null},{l:"Updated 🔄",c:null},{l:"% Updated",c:"pct_updated"as const},{l:"",c:null}].map((h,i)=>(
                      <th key={i} onClick={()=>h.c&&sortToggle(h.c)}
                        style={{padding:"7px 9px",textAlign:"left",fontSize:"10px",fontWeight:700,color:"#999",textTransform:"uppercase",letterSpacing:"0.06em",cursor:h.c?"pointer":"default",userSelect:"none",whiteSpace:"nowrap"}}>
                        {h.l}{h.c&&<span style={{marginLeft:"3px",opacity:sortCol===h.c?1:0.25,fontSize:"9px"}}>{sortDir===1?"↑":"↓"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredBranches.map((b,i)=>{
                    const col=AREA_COLORS[b.area]||"#888"
                    return(
                      <tr key={i} style={{borderBottom:"1px solid #F8F8F8",cursor:"pointer",transition:"background 0.1s"}}
                        onClick={()=>setBranchPopup(b)}
                        onMouseEnter={e=>{e.currentTarget.style.background="#FAFAF8"}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                        <td style={{padding:"9px",fontSize:"12px",fontWeight:600,color:"#111",maxWidth:"200px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.branch_name}</td>
                        <td style={{padding:"9px"}}><span style={{background:`${col}15`,color:col,fontSize:"10px",fontWeight:700,padding:"2px 7px",borderRadius:"99px"}}>{b.area}</span></td>
                        <td style={{padding:"9px",fontSize:"12px",fontWeight:600}}>{b.total}</td>
                        <td style={{padding:"9px",fontSize:"12px",color:"#43A047",fontWeight:700}}>{b.active}</td>
                        <td style={{padding:"9px",fontSize:"12px",color:b.inactive>0?"#E8381A":"#aaa",fontWeight:b.inactive>0?700:400}}>{b.inactive}</td>
                        <td style={{padding:"9px",fontSize:"12px",color:"#1E88E5",fontWeight:600}}>{b.updated}</td>
                        <td style={{padding:"9px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                            <div style={{width:"44px",height:"5px",background:"#F0F0F0",borderRadius:"99px",overflow:"hidden",flexShrink:0}}>
                              <div style={{height:"100%",width:`${b.pct_updated}%`,background:b.pct_updated>=80?"#43A047":b.pct_updated>=60?"#FB8C00":"#E8381A",borderRadius:"99px"}}/>
                            </div>
                            <span style={{fontSize:"11px",fontWeight:800,color:b.pct_updated>=80?"#43A047":b.pct_updated>=60?"#FB8C00":"#E8381A"}}>{b.pct_updated}%</span>
                          </div>
                        </td>
                        <td style={{padding:"9px",textAlign:"center",fontSize:"12px"}}>{b.pct_updated===100?"✅":b.pct_updated>=80?"🟡":"🔴"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredBranches.length===0&&<div style={{textAlign:"center",padding:"40px",color:"#bbb"}}><div style={{fontSize:"24px",marginBottom:"8px"}}>🔍</div>No branches found.</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Upload success toast */}
      {uploadToast.show && uploadToast.data && (
        <div style={{
          position:"fixed", bottom:"clamp(16px,3vw,28px)", right:"clamp(16px,3vw,28px)",
          zIndex:9998, animation:"slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          maxWidth:"360px", width:"calc(100vw - 32px)"
        }}>
          <div style={{
            background:"linear-gradient(135deg,#0f1f0f,#0d1a0d)",
            border:"1px solid rgba(67,160,71,0.4)",
            borderRadius:"18px", padding:"18px 20px",
            boxShadow:"0 16px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(67,160,71,0.15)",
            backdropFilter:"blur(16px)",
          }}>
            {/* Header */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"36px",height:"36px",borderRadius:"50%",background:"rgba(67,160,71,0.2)",border:"2px solid #43A047",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",animation:"popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>
                  ✅
                </div>
                <div>
                  <div style={{fontSize:"13px",fontWeight:800,color:"white"}}>Data berhasil diupload!</div>
                  <div style={{fontSize:"10px",color:"rgba(255,255,255,0.4)"}}>Landing page sudah terupdate otomatis</div>
                </div>
              </div>
              <button onClick={()=>setUploadToast({show:false})} style={{background:"rgba(255,255,255,0.08)",border:"none",cursor:"pointer",width:"24px",height:"24px",borderRadius:"50%",fontSize:"13px",color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>

            {/* Stats grid */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:"8px",marginBottom:"12px"}}>
              {[
                {i:"📅",l:"Cutoff",v:uploadToast.data.cutoff,c:"#6EE88A"},
                {i:"👥",l:"Total Salesman",v:uploadToast.data.total.toLocaleString(),c:"white"},
                {i:"🏢",l:"Branches",v:uploadToast.data.branches.toString(),c:"#60B3FF"},
                {i:"📊",l:"Salesman Detail",v:uploadToast.data.salesman.toLocaleString(),c:"#FFD07A"},
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

            {/* Progress bar that counts down */}
            <div style={{height:"3px",background:"rgba(255,255,255,0.08)",borderRadius:"99px",overflow:"hidden"}}>
              <div style={{height:"100%",background:"linear-gradient(90deg,#43A047,#6EE88A)",borderRadius:"99px",animation:"countdown 8s linear forwards"}}/>
            </div>
          </div>
        </div>
      )}
      {branchPopup&&<BranchPopup b={branchPopup} salesman={branchSalesman} onClose={()=>setBranchPopup(null)}/>}

      <style dangerouslySetInnerHTML={{__html:`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes pulse2 { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.9)} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popIn { from{opacity:0;transform:scale(0.5)} to{opacity:1;transform:scale(1)} }
        @keyframes countdown { from{width:100%} to{width:0%} }
        @media(max-width:768px){ .sfa-logo-hero{ height:24px!important; } }
        @media(max-width:640px){ .kpi-6{ grid-template-columns:repeat(3,1fr)!important; } .tab-bar button{ padding:8px 12px!important; font-size:11px!important; } }
        @media(max-width:400px){ .kpi-6{ grid-template-columns:repeat(2,1fr)!important; } }
      `}}/>
    </div>
  )
}