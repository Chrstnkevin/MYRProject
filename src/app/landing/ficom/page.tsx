"use client"
// PATH: src/app/landing/ficom/page.tsx
import { useState, useEffect, useRef, useMemo } from "react"
import LandingNav from "../components/LandingNav"
import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────
interface FicomSnapshot {
  period_label: string; period_month: string; as_of_date: string; selling_days: number
  total_users: number; total_trained: number; total_active: number
  total_high: number; total_medium: number; total_low: number
  avg_compliance: number; pct_trained: number; pct_active: number
  // m_master fields
  total_ads: number; total_lp: number
}
interface FicomArea {
  period_month: string; aor: string; total_users: number; trained: number; active: number
  avg_compliance: number; high_count: number; medium_count: number; low_count: number; pct_active: number
  // m_master
  total_ads: number; total_lp: number
}
interface FicomUser {
  period_month: string; user_id: string; username: string; position: string
  aor: string; sub_aor: string; rdm_name: string
  usage_days: number; selling_days: number; compliance_pct: number
  last_usage_date: string | null; trained: number; training_date: string | null
  // m_master
  employee_type: string | null; distributor_name: string | null
}

// ── Constants ──────────────────────────────────────────────────
const AOR_COLORS: Record<string,string> = {
  GMA:"#F97316", MIN:"#3B82F6", NOL:"#22C55E", SOL:"#EF4444", VIS:"#A855F7"
}
const AOR_NAMES = ["GMA","MIN","NOL","SOL","VIS"] as const

const posLabel = (p: string) => p === "ADM" ? "ADS/ADM" : p === "RDM" ? "RDM" : p
const compColor = (p: number) => p >= 91 ? "#22C55E" : p >= 71 ? "#84CC16" : p >= 51 ? "#F97316" : "#EF4444"
const compBg    = (p: number) => p >= 91 ? "#052e16" : p >= 71 ? "#1a2e05" : p >= 51 ? "#431407" : "#450a0a"

async function fetchFicomData() {
  const [snap, areas, users] = await Promise.all([
    supabase.from("ficom_snapshots").select("*").order("period_month"),
    supabase.from("ficom_areas").select("*").order("period_month"),
    supabase.from("ficom_users").select("*").order("username"),
  ])
  if (snap.error) throw snap.error
  if (areas.error) throw areas.error
  if (users.error) throw users.error
  return {
    snapshots: (snap.data||[]) as FicomSnapshot[],
    areas:     (areas.data||[]) as FicomArea[],
    users:     (users.data||[]) as FicomUser[],
  }
}

// ── Animated Counter ──────────────────────────────────────────
function AnimCount({ to, suffix="", dec=0, delay=0 }: { to:number; suffix?:string; dec?:number; delay?:number }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => {
      let frame = 0; const frames = 55
      const tick = () => {
        frame++
        const ease = 1 - Math.pow(1 - frame/frames, 4)
        setV(ease * to)
        if (frame < frames) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }, delay)
    return () => clearTimeout(t)
  }, [to, delay])
  return <>{v.toFixed(dec)}{suffix}</>
}

// ── Ficom Logo SVG (HD) ───────────────────────────────────────
function FicomLogo({ size=80, glow=true }: { size?:number; glow?:boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size*0.22, flexShrink: 0,
      background: "linear-gradient(145deg,#1E40AF,#1565C0,#0D47A1)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: glow ? `0 0 ${size*0.5}px rgba(59,130,246,0.5), 0 0 ${size*0.25}px rgba(59,130,246,0.3), inset 0 1px 0 rgba(255,255,255,0.15)` : "none",
      position: "relative", overflow: "hidden",
    }}>
      {/* inner shine */}
      <div style={{ position:"absolute", top:0, left:0, right:0, height:"45%", background:"linear-gradient(180deg,rgba(255,255,255,0.12),transparent)", borderRadius:`${size*0.22}px ${size*0.22}px 0 0` }}/>
      <svg viewBox="0 0 80 80" style={{ width:"82%", height:"82%", position:"relative", zIndex:1 }}>
        <defs>
          <linearGradient id="shieldG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60A5FA"/>
            <stop offset="100%" stopColor="#1D4ED8"/>
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {/* Shield */}
        <path d="M40 6 L68 17 L68 40 Q68 62 40 74 Q12 62 12 40 L12 17 Z" fill="url(#shieldG)"/>
        {/* Chart bars */}
        <rect x="22" y="47" width="8" height="14" rx="2" fill="white" opacity="0.95"/>
        <rect x="33" y="38" width="8" height="23" rx="2" fill="white"/>
        <rect x="44" y="30" width="8" height="31" rx="2" fill="white"/>
        <rect x="55" y="40" width="8" height="21" rx="2" fill="white" opacity="0.95"/>
        {/* Trend line with glow */}
        <polyline points="26,45 37,36 48,28 59,38" fill="none" stroke="#93C5FD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)"/>
        {/* Dots on line */}
        <circle cx="26" cy="45" r="2.5" fill="#BFDBFE"/>
        <circle cx="37" cy="36" r="2.5" fill="#BFDBFE"/>
        <circle cx="48" cy="28" r="3" fill="white"/>
        <circle cx="59" cy="38" r="2.5" fill="#BFDBFE"/>
      </svg>
    </div>
  )
}

// ── Animated SVG Chart for hero ───────────────────────────────
function HeroChart({ latest }: { latest: FicomSnapshot | undefined }) {
  if (!latest) return null
  const bars = [
    { label:"≥91%",  val: latest.total_high,   color:"#22C55E", pct: latest.total_users ? latest.total_high/latest.total_users : 0 },
    { label:"71–90%",val: latest.total_medium,  color:"#84CC16", pct: latest.total_users ? (latest.total_medium-latest.total_high)/latest.total_users : 0 },
    { label:"51–70%",val: Math.max(0, latest.total_medium - latest.total_high), color:"#F97316", pct:0 },
    { label:"<50%",  val: latest.total_low,     color:"#EF4444", pct: latest.total_users ? latest.total_low/latest.total_users : 0 },
  ]
  return (
    <svg viewBox="0 0 200 110" style={{ width:"100%", maxWidth:"240px" }}>
      <defs>
        {bars.map((b,i) => (
          <linearGradient key={i} id={`bG${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={b.color} stopOpacity="1"/>
            <stop offset="100%" stopColor={b.color} stopOpacity="0.6"/>
          </linearGradient>
        ))}
      </defs>
      {bars.map((b,i) => {
        const barH = Math.max(4, (b.val / (latest.total_users||1)) * 90)
        const x = 20 + i*44
        return (
          <g key={i}>
            <rect x={x} y={100-barH} width="32" height={barH} rx="4" fill={`url(#bG${i})`}>
              <animate attributeName="height" from="0" to={barH} dur="1.2s" begin={`${i*0.15}s`} fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1"/>
              <animate attributeName="y" from="100" to={100-barH} dur="1.2s" begin={`${i*0.15}s`} fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1"/>
            </rect>
            <text x={x+16} y="108" textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.5)" fontFamily="monospace">{b.label}</text>
            <text x={x+16} y={95-barH} textAnchor="middle" fontSize="8" fill="white" fontWeight="700">{b.val}</text>
          </g>
        )
      })}
      <line x1="14" y1="100" x2="186" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
    </svg>
  )
}

// ── Donut Chart ───────────────────────────────────────────────
function Donut({ high,medium,low,total,size=160 }: { high:number;medium:number;low:number;total:number;size?:number }) {
  const cx=size/2, cy=size/2, r=size*0.37, stroke=size*0.1
  const circ = 2*Math.PI*r
  const pctHigh   = total ? high/total   : 0
  const pctMedium = total ? medium/total : 0
  const pctLow    = total ? low/total    : 0
  const segs = [
    { pct:pctHigh,   color:"#22C55E", offset:0 },
    { pct:pctMedium, color:"#F97316", offset:pctHigh*circ },
    { pct:pctLow,    color:"#EF4444", offset:(pctHigh+pctMedium)*circ },
  ]
  const activePct = total ? Math.round((high+medium)/total*100) : 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
      {segs.map((s,i) => (
        <circle key={i} cx={cx} cy={cy} r={r} fill="none"
          stroke={s.color} strokeWidth={stroke}
          strokeDasharray={`${s.pct*circ} ${circ}`}
          strokeDashoffset={-s.offset}
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ filter:`drop-shadow(0 0 6px ${s.color}60)` }}
        >
          <animate attributeName="stroke-dasharray"
            from={`0 ${circ}`} to={`${s.pct*circ} ${circ}`}
            dur="1.4s" begin={`${i*0.2}s`} fill="freeze"
            calcMode="spline" keySplines="0.4 0 0.2 1"/>
        </circle>
      ))}
      <text x={cx} y={cy-6} textAnchor="middle" fontSize={size*0.2} fontWeight="900" fill="white" fontFamily="'Bricolage Grotesque',sans-serif">{activePct}%</text>
      <text x={cx} y={cy+size*0.13} textAnchor="middle" fontSize={size*0.09} fill="rgba(255,255,255,0.45)" fontFamily="sans-serif">≥50%</text>
    </svg>
  )
}

// ── User Popup ────────────────────────────────────────────────
function UserPopup({ users, aorLabel, onClose }: { users:FicomUser[]; aorLabel:string; onClose:()=>void }) {
  const col = AOR_COLORS[aorLabel]||"#888"
  const [search, setSearch] = useState("")
  const [posF, setPosF]     = useState<"all"|"ADM"|"RDM">("all")
  const [compF, setCompF]   = useState<"all"|"high"|"medium"|"low">("all")

  const filtered = useMemo(()=>users.filter(u=>{
    const m = u.username.toLowerCase().includes(search.toLowerCase())||u.user_id.toLowerCase().includes(search.toLowerCase())
    if(!m) return false
    if(posF!=="all"&&u.position!==posF) return false
    if(compF==="high"&&u.compliance_pct<91)    return false
    if(compF==="medium"&&(u.compliance_pct<51||u.compliance_pct>=91)) return false
    if(compF==="low"&&u.compliance_pct>=51)    return false
    return true
  }).sort((a,b)=>b.compliance_pct-a.compliance_pct),[users,search,posF,compF])

  const avg = users.length ? Math.round(users.reduce((s,u)=>s+u.compliance_pct,0)/users.length) : 0

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",backdropFilter:"blur(12px)"}} onClick={onClose}>
      <div style={{background:"#0F1117",border:`1px solid ${col}40`,borderRadius:"24px",maxWidth:"780px",width:"100%",maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:`0 40px 100px rgba(0,0,0,0.5),0 0 0 1px ${col}20`,animation:"popUp 0.3s cubic-bezier(0.34,1.56,0.64,1)"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${col}18,${col}06)`,padding:"20px 24px 16px",borderBottom:`2px solid ${col}30`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
              <div style={{width:"40px",height:"40px",borderRadius:"12px",background:`linear-gradient(135deg,${col},${col}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"15px",fontWeight:900,color:"white",fontFamily:"'Bricolage Grotesque',sans-serif",boxShadow:`0 0 20px ${col}40`}}>{aorLabel}</div>
              <div>
                <div style={{fontSize:"17px",fontWeight:800,color:"white"}}>Ficom Users — {aorLabel}</div>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)"}}>Avg compliance {avg}% · {users.length} users</div>
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",cursor:"pointer",width:"32px",height:"32px",borderRadius:"50%",fontSize:"18px",color:"rgba(255,255,255,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
          {/* Stats row */}
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"12px"}}>
            {[
              {l:"≥91%",     v:users.filter(u=>u.compliance_pct>=91).length,   c:"#22C55E", bg:"rgba(34,197,94,0.12)"},
              {l:"51–90%",   v:users.filter(u=>u.compliance_pct>=51&&u.compliance_pct<91).length, c:"#F97316", bg:"rgba(249,115,22,0.12)"},
              {l:"<50%",     v:users.filter(u=>u.compliance_pct<51).length,    c:"#EF4444", bg:"rgba(239,68,68,0.12)"},
              {l:"Trained ✅",v:users.filter(u=>u.trained===1).length,          c:col,       bg:`${col}15`},
            ].map((s,i)=>(
              <div key={i} style={{background:s.bg,borderRadius:"10px",padding:"5px 12px",textAlign:"center",border:`1px solid ${s.c}20`}}>
                <div style={{fontSize:"16px",fontWeight:900,color:s.c,fontFamily:"'Bricolage Grotesque',sans-serif",lineHeight:1}}>{s.v}</div>
                <div style={{fontSize:"9px",color:"rgba(255,255,255,0.4)",fontWeight:600,marginTop:"2px"}}>{s.l}</div>
              </div>
            ))}
          </div>
          {/* Filters */}
          <div style={{display:"flex",gap:"7px",flexWrap:"wrap",alignItems:"center"}}>
            <input placeholder="🔍 Name / User ID..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{padding:"6px 10px",border:`1.5px solid ${col}40`,borderRadius:"9px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(120px,30%,170px)",background:"rgba(255,255,255,0.05)",color:"white"}}/>
            <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:"9px",padding:"2px"}}>
              {(["all","ADM","RDM"] as const).map(p=>(
                <button key={p} onClick={()=>setPosF(p)} style={{padding:"3px 9px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:posF===p?"rgba(255,255,255,0.12)":"transparent",color:posF===p?"white":"rgba(255,255,255,0.4)",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                  {p==="all"?"Semua":posLabel(p)}
                </button>
              ))}
            </div>
            <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:"9px",padding:"2px"}}>
              {([{k:"all",l:"Semua"},{k:"high",l:"✅ ≥91%"},{k:"medium",l:"🟡 51–90%"},{k:"low",l:"🔴 <50%"}] as const).map(o=>(
                <button key={o.k} onClick={()=>setCompF(o.k)} style={{padding:"3px 9px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:compF===o.k?"rgba(255,255,255,0.12)":"transparent",color:compF===o.k?"white":"rgba(255,255,255,0.4)",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                  {o.l}
                </button>
              ))}
            </div>
            <span style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",marginLeft:"auto"}}>{filtered.length} users</span>
          </div>
        </div>
        {/* Table */}
        <div style={{overflowY:"auto",flex:1}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",minWidth:"620px"}}>
              <thead>
                <tr style={{background:"rgba(255,255,255,0.03)",borderBottom:"1px solid rgba(255,255,255,0.08)"}}>
                  {["User ID","Name","Role","Sub-AOR","RDM","Days","Compliance","Training","Last Login"].map(h=>(
                    <th key={h} style={{padding:"9px 10px",textAlign:"left",fontSize:"9px",fontWeight:700,color:"rgba(255,255,255,0.3)",textTransform:"uppercase",letterSpacing:"0.06em",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u,i)=>(
                  <tr key={i} style={{borderBottom:"1px solid rgba(255,255,255,0.04)",transition:"background 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)"}}
                    onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                    <td style={{padding:"8px 10px",fontSize:"11px",color:"rgba(255,255,255,0.3)",fontFamily:"monospace"}}>{u.user_id}</td>
                    <td style={{padding:"8px 10px",fontSize:"12px",fontWeight:600,color:"white",maxWidth:"160px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.username}</td>
                    <td style={{padding:"8px 10px"}}>
                      <span style={{fontSize:"10px",fontWeight:700,padding:"2px 7px",borderRadius:"99px",background:u.position==="RDM"?"rgba(59,130,246,0.2)":"rgba(168,85,247,0.2)",color:u.position==="RDM"?"#60A5FA":"#C084FC"}}>{posLabel(u.position)}</span>
                    </td>
                    <td style={{padding:"8px 10px",fontSize:"11px",color:"rgba(255,255,255,0.5)"}}>{u.sub_aor}</td>
                    <td style={{padding:"8px 10px",fontSize:"11px",color:"rgba(255,255,255,0.4)",maxWidth:"130px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.rdm_name}</td>
                    <td style={{padding:"8px 10px",fontSize:"12px",fontWeight:700,color:"white",textAlign:"center"}}>{u.usage_days}<span style={{fontSize:"9px",color:"rgba(255,255,255,0.3)",fontWeight:400}}>/{u.selling_days}</span></td>
                    <td style={{padding:"8px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                        <div style={{width:"44px",height:"5px",background:"rgba(255,255,255,0.08)",borderRadius:"99px",overflow:"hidden",flexShrink:0}}>
                          <div style={{height:"100%",width:`${Math.min(u.compliance_pct,100)}%`,background:compColor(u.compliance_pct),borderRadius:"99px"}}/>
                        </div>
                        <span style={{fontSize:"11px",fontWeight:800,color:compColor(u.compliance_pct),minWidth:"38px"}}>{u.compliance_pct}%</span>
                      </div>
                    </td>
                    <td style={{padding:"8px 10px"}}>
                      <span style={{fontSize:"10px",fontWeight:700,padding:"2px 7px",borderRadius:"99px",background:u.trained===1?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.06)",color:u.trained===1?"#4ADE80":"rgba(255,255,255,0.35)"}}>
                        {u.trained===1?"✅ Trained":"⏳ Pending"}
                      </span>
                    </td>
                    <td style={{padding:"8px 10px",fontSize:"11px",color:"rgba(255,255,255,0.3)",fontFamily:"monospace",whiteSpace:"nowrap"}}>{u.last_usage_date||"—"}</td>
                  </tr>
                ))}
                {filtered.length===0&&<tr><td colSpan={9} style={{textAlign:"center",padding:"32px",color:"rgba(255,255,255,0.2)"}}>No users found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Area Popup (branches of an area) ─────────────────────────
function AreaPopup({ aor, users, onClose }: { aor:string; users:FicomUser[]; onClose:()=>void }) {
  const col = AOR_COLORS[aor]||"#888"
  // Group by sub_aor
  const subAors = useMemo(()=>{
    const map: Record<string,FicomUser[]> = {}
    users.forEach(u=>{ if(!map[u.sub_aor]) map[u.sub_aor]=[]; map[u.sub_aor].push(u) })
    return Object.entries(map).map(([sub,us])=>({
      sub, count:us.length, avg: Math.round(us.reduce((s,u)=>s+u.compliance_pct,0)/us.length),
      high:us.filter(u=>u.compliance_pct>=91).length, low:us.filter(u=>u.compliance_pct<51).length
    })).sort((a,b)=>b.avg-a.avg)
  },[users])

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:9998,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px",backdropFilter:"blur(12px)"}} onClick={onClose}>
      <div style={{background:"#0F1117",border:`1px solid ${col}40`,borderRadius:"24px",maxWidth:"600px",width:"100%",maxHeight:"85vh",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:`0 40px 100px rgba(0,0,0,0.5)`,animation:"popUp 0.3s cubic-bezier(0.34,1.56,0.64,1)"}} onClick={e=>e.stopPropagation()}>
        <div style={{background:`linear-gradient(135deg,${col}15,transparent)`,padding:"20px 24px",borderBottom:`2px solid ${col}25`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div>
              <div style={{fontSize:"18px",fontWeight:800,color:"white"}}>📍 {aor} — Sub-Area Breakdown</div>
              <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",marginTop:"3px"}}>{users.length} users · {subAors.length} sub-areas · Click sub-area to view users</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",cursor:"pointer",width:"32px",height:"32px",borderRadius:"50%",fontSize:"18px",color:"rgba(255,255,255,0.6)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
        </div>
        <div style={{overflowY:"auto",flex:1,padding:"16px"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
            {subAors.map((s,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:"14px",padding:"14px 16px",border:`1px solid ${col}20`,cursor:"pointer",transition:"all 0.2s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=`${col}12`;e.currentTarget.style.borderColor=`${col}40`}}
                onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";e.currentTarget.style.borderColor=`${col}20`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                  <span style={{fontSize:"14px",fontWeight:700,color:"white"}}>{s.sub}</span>
                  <span style={{fontSize:"16px",fontWeight:900,color:compColor(s.avg),fontFamily:"'Bricolage Grotesque',sans-serif"}}>{s.avg}%</span>
                </div>
                <div style={{height:"5px",background:"rgba(255,255,255,0.08)",borderRadius:"99px",overflow:"hidden",marginBottom:"8px"}}>
                  <div style={{height:"100%",width:`${Math.min(s.avg,100)}%`,background:`linear-gradient(90deg,${compColor(s.avg)},${compColor(s.avg)}88)`,borderRadius:"99px"}}/>
                </div>
                <div style={{display:"flex",gap:"12px",fontSize:"10px",color:"rgba(255,255,255,0.4)"}}>
                  <span>{s.count} users</span>
                  <span style={{color:"#22C55E"}}>✅ {s.high} ≥91%</span>
                  <span style={{color:"#EF4444"}}>🔴 {s.low} &lt;50%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────
export default function FicomPage() {
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState("")
  const [snapshots,  setSnapshots]  = useState<FicomSnapshot[]>([])
  const [areas,      setAreas]      = useState<FicomArea[]>([])
  const [users,      setUsers]      = useState<FicomUser[]>([])
  const [areaPopup,  setAreaPopup]  = useState<string|null>(null)
  const [userPopup,  setUserPopup]  = useState<string|null>(null)
  const [areaFilter, setAreaFilter] = useState("ALL")
  const [posFilter,  setPosFilter]  = useState<"all"|"ADM"|"RDM">("all")
  const [search,     setSearch]     = useState("")
  const [sortCol,    setSortCol]    = useState<"username"|"compliance_pct"|"usage_days">("compliance_pct")
  const [sortDir,    setSortDir]    = useState<1|-1>(-1)
  const [heroMounted, setHeroMounted] = useState(false)
  const animeRef = useRef(false)

  useEffect(()=>{
    const load=async()=>{
      try {
        const d=await fetchFicomData()
        setSnapshots(d.snapshots); setAreas(d.areas); setUsers(d.users)
      } catch(e){ setError(e instanceof Error?e.message:"Failed") }
      finally{ setLoading(false) }
    }
    load()
    const ch=supabase.channel("ficom-live")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"ficom_snapshots"},async()=>{
        const d=await fetchFicomData()
        setSnapshots(d.snapshots); setAreas(d.areas); setUsers(d.users)
      }).subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[])

  useEffect(()=>{
    if(loading||animeRef.current) return
    animeRef.current=true
    const s=document.createElement("script")
    s.src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"
    s.onload=()=>{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anime=(window as any).anime; if(!anime) return
      anime({targets:".kpi-card",translateY:[28,0],opacity:[0,1],delay:anime.stagger(80),duration:700,easing:"easeOutExpo"})
      anime({targets:".area-card",translateY:[20,0],opacity:[0,1],delay:anime.stagger(90),duration:650,easing:"easeOutBack"})
      anime({targets:".live-dot",scale:[1,1.6,1],loop:true,duration:1400,easing:"easeInOutSine"})
      anime({targets:".ficom-logo-wrap",rotate:[-3,3,-3],loop:true,duration:4000,easing:"easeInOutSine"})
    }
    document.head.appendChild(s)
    const link=document.createElement("link"); link.rel="stylesheet"
    link.href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
    document.head.appendChild(link)
    setTimeout(()=>setHeroMounted(true), 100)
  },[loading])

  // Derived
  const latest       = snapshots[snapshots.length-1]
  const latestMonth  = latest?.period_month||""
  const latestAreas  = useMemo(()=>areas.filter(a=>a.period_month===latestMonth),[areas,latestMonth])
  const latestUsers  = useMemo(()=>users.filter(u=>u.period_month===latestMonth),[users,latestMonth])

  const filteredUsers = useMemo(()=>latestUsers
    .filter(u=>{
      if(areaFilter!=="ALL"&&u.aor!==areaFilter) return false
      if(posFilter!=="all"&&u.position!==posFilter) return false
      const q=search.toLowerCase()
      return u.username.toLowerCase().includes(q)||u.user_id.toLowerCase().includes(q)||u.sub_aor.toLowerCase().includes(q)
    })
    .sort((a,b)=>{
      if(sortCol==="username") return sortDir*a.username.localeCompare(b.username)
      return sortDir*((a[sortCol]as number)-(b[sortCol]as number))
    })
  ,[latestUsers,areaFilter,posFilter,search,sortCol,sortDir])

  const sortToggle=(col:typeof sortCol)=>{ if(sortCol===col) setSortDir(d=>d===1?-1:1); else{setSortCol(col);setSortDir(-1)} }

  if(loading) return (
    <div style={{background:"#060C1A",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <LandingNav/>
      <div style={{textAlign:"center",color:"white"}}>
        <div style={{width:"56px",height:"56px",margin:"0 auto 16px",borderRadius:"50%",border:"3px solid rgba(255,255,255,0.08)",borderTopColor:"#F97316",animation:"spin 0.9s linear infinite"}}/>
        <div style={{fontSize:"13px",color:"rgba(255,255,255,0.4)"}}>Loading Ficom data...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if(error) return (
    <div style={{background:"#060C1A",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <LandingNav/>
      <div style={{textAlign:"center",color:"white",padding:"32px"}}>
        <div style={{fontSize:"48px",marginBottom:"12px"}}>⚠️</div>
        <div style={{fontSize:"16px",marginBottom:"20px"}}>{error}</div>
        <button onClick={()=>window.location.reload()} style={{padding:"10px 24px",borderRadius:"99px",background:"#F97316",color:"white",border:"none",cursor:"pointer",fontSize:"13px",fontWeight:700}}>Retry</button>
      </div>
    </div>
  )

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#111",background:"#060C1A",minHeight:"100vh"}}>
      <LandingNav/>

      {/* ── Tab Bar ── */}
      <div style={{position:"sticky",top:"64px",zIndex:90,background:"rgba(6,12,26,0.97)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"0 clamp(20px,5vw,80px)"}}>
        <div style={{maxWidth:"1200px",margin:"0 auto",display:"flex",overflowX:"auto"}}>
          {[
            {id:"sfa",   label:"SFA",        href:"/landing/utilisation", active:false},
            {id:"ficom", label:"Ficom",       href:"#",                    active:true},
            {id:"lite",  label:"Ficom Lite",  href:"#",                    active:false, soon:true},
          ].map(tab=>(
            <a key={tab.id} href={tab.href}
              style={{padding:"12px 20px",border:"none",fontFamily:"inherit",fontSize:"13px",fontWeight:tab.active?700:500,color:tab.active?"#F97316":tab.soon?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.45)",background:"transparent",borderBottom:tab.active?"2px solid #F97316":"2px solid transparent",transition:"all 0.2s",display:"flex",alignItems:"center",gap:"8px",whiteSpace:"nowrap",textDecoration:"none",cursor:tab.soon?"not-allowed":"pointer"}}>
              {tab.id==="ficom"&&<FicomLogo size={22} glow={false}/>}
              {tab.label}
              {tab.soon&&<span style={{fontSize:"9px",background:"rgba(255,255,255,0.07)",color:"rgba(255,255,255,0.2)",padding:"2px 6px",borderRadius:"99px"}}>Soon</span>}
            </a>
          ))}
        </div>
      </div>

      {/* ══════════ HERO ══════════ */}
      <div style={{position:"relative",overflow:"hidden",minHeight:"clamp(420px,60vh,620px)",display:"flex",alignItems:"center",padding:"clamp(60px,8vw,100px) clamp(20px,5vw,80px)"}}>

        {/* Deep animated background */}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(135deg,#0A0500 0%,#100800 30%,#060C1A 60%,#000A08 100%)"}}/>

        {/* Animated grid */}
        <div style={{position:"absolute",inset:0,backgroundImage:"linear-gradient(rgba(249,115,22,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(249,115,22,0.04) 1px,transparent 1px)",backgroundSize:"48px 48px",animation:"gridSlide 20s linear infinite",pointerEvents:"none"}}/>

        {/* Big glowing orbs */}
        <div style={{position:"absolute",top:"-20%",right:"-10%",width:"clamp(350px,50vw,650px)",height:"clamp(350px,50vw,650px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(249,115,22,0.28),rgba(249,115,22,0.08) 45%,transparent 70%)",filter:"blur(60px)",animation:"orb1 8s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"-15%",left:"-5%",width:"clamp(250px,35vw,500px)",height:"clamp(250px,35vw,500px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.2),transparent 65%)",filter:"blur(60px)",animation:"orb2 11s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:"40%",left:"40%",width:"clamp(200px,25vw,380px)",height:"clamp(200px,25vw,380px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(34,197,94,0.1),transparent 65%)",filter:"blur(50px)",pointerEvents:"none"}}/>

        {/* Floating particles */}
        {heroMounted && Array.from({length:20},(_,i)=>(
          <div key={i} style={{position:"absolute",left:`${5+i*5}%`,top:`${10+Math.sin(i)*40}%`,width:`${2+Math.random()*4}px`,height:`${2+Math.random()*4}px`,borderRadius:"50%",background:["#F97316","#FB923C","#3B82F6","#22C55E","#A855F7","#FCD34D"][i%6],opacity:0,animation:`particle ${2+i*0.3}s ease-in-out ${i*0.2}s infinite`,pointerEvents:"none"}}/>
        ))}

        <div style={{maxWidth:"1200px",margin:"0 auto",width:"100%",position:"relative",zIndex:2}}>
          <div style={{display:"flex",gap:"clamp(32px,5vw,72px)",alignItems:"center",flexWrap:"wrap"}}>

            {/* LEFT ─ text + KPI */}
            <div style={{flex:1,minWidth:"280px"}}>
              {/* Live badge */}
              <div style={{display:"inline-flex",alignItems:"center",gap:"10px",background:"rgba(249,115,22,0.12)",border:"1px solid rgba(249,115,22,0.3)",borderRadius:"99px",padding:"6px 18px",marginBottom:"clamp(18px,3vw,28px)",backdropFilter:"blur(8px)"}}>
                <div className="live-dot" style={{width:"8px",height:"8px",borderRadius:"50%",background:"#F97316",boxShadow:"0 0 10px #F97316"}}/>
                <span style={{fontSize:"11px",fontWeight:700,color:"#FB923C",letterSpacing:"0.12em",textTransform:"uppercase"}}>
                  Live · Ficom PHI · {latest?.period_label||"—"} · as of {latest?.as_of_date||"—"}
                </span>
              </div>

              {/* Title + Logo */}
              <div style={{display:"flex",alignItems:"flex-start",gap:"clamp(14px,2vw,22px)",marginBottom:"clamp(12px,2vw,18px)",flexWrap:"wrap"}}>
                <h1 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(36px,5.5vw,68px)",fontWeight:900,lineHeight:1.04,letterSpacing:"-0.03em",color:"white",margin:0}}>
                  Ficom Usage<br/>
                  <span style={{background:"linear-gradient(135deg,#F97316 0%,#FB923C 40%,#FCD34D 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",filter:"drop-shadow(0 0 30px rgba(249,115,22,0.4))"}}>
                    Monitoring
                  </span>
                </h1>
                <div className="ficom-logo-wrap" style={{marginTop:"8px",flexShrink:0}}>
                  <FicomLogo size={clampVal(64,80)} glow={true}/>
                </div>
              </div>

              <p style={{fontSize:"clamp(12px,1.4vw,15px)",color:"rgba(255,255,255,0.35)",marginBottom:"clamp(24px,4vw,40px)",lineHeight:1.7}}>
                {latest?.total_users||"—"} Ficom users (ADM/RDM) ·{" "}
                {(latest?.total_ads||0)+(latest?.total_lp||0)>0&&<><strong style={{color:"rgba(255,255,255,0.5)"}}>{latest?.total_ads||0}</strong> ADS + <strong style={{color:"rgba(255,255,255,0.5)"}}>{latest?.total_lp||0}</strong> LP field · </>}
                <strong style={{color:"rgba(255,255,255,0.5)"}}>{latest?.selling_days||"—"}</strong> selling days
              </p>

              {/* KPI GRID 3×2 */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"clamp(7px,1.2vw,12px)",maxWidth:"580px"}}>
                {[
                  {n:<AnimCount to={latest?.total_users||0} delay={0}/>,    l:"Total Users",   i:"👥", c:"white",   bg:"rgba(255,255,255,0.06)", bo:"rgba(255,255,255,0.1)"},
                  {n:<AnimCount to={latest?.total_trained||0} delay={80}/>, l:"Trained ✅",    i:"🎓", c:"#FCD34D", bg:"rgba(252,211,77,0.1)",   bo:"rgba(252,211,77,0.25)"},
                  {n:<AnimCount to={latest?.total_active||0} delay={160}/>, l:"Active Users",  i:"💚", c:"#4ADE80", bg:"rgba(34,197,94,0.1)",    bo:"rgba(34,197,94,0.25)"},
                  {n:<AnimCount to={latest?.avg_compliance||0} suffix="%" dec={1} delay={240}/>,l:"Avg Compliance",i:"📊",c:"#60A5FA",bg:"rgba(59,130,246,0.1)",bo:"rgba(59,130,246,0.2)"},
                  {n:<AnimCount to={latest?.total_high||0} delay={320}/>,   l:"≥91% Users 🏆", i:"⭐", c:"#4ADE80", bg:"rgba(34,197,94,0.1)",    bo:"rgba(34,197,94,0.2)"},
                  {n:<AnimCount to={latest?.total_low||0} delay={400}/>,    l:"<50% Users ⚠️", i:"🔴", c:"rgba(255,255,255,0.4)",bg:"rgba(255,255,255,0.04)",bo:"rgba(255,255,255,0.08)"},
                ].map((s,i)=>(
                  <div key={i} className="kpi-card" style={{background:s.bg,borderRadius:"clamp(10px,1.5vw,14px)",padding:"clamp(10px,1.5vw,15px)",border:`1px solid ${s.bo}`,textAlign:"center",backdropFilter:"blur(12px)",animation:"fadeUp 0.6s ease both",animationDelay:`${i*0.08}s`,position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:"1px",background:`linear-gradient(90deg,transparent,${s.bo},transparent)`}}/>
                    <div style={{fontSize:"clamp(14px,2vw,20px)",marginBottom:"5px"}}>{s.i}</div>
                    <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,21px)",fontWeight:900,color:s.c,lineHeight:1,marginBottom:"5px"}}>{s.n}</div>
                    <div style={{fontSize:"clamp(7px,0.65vw,9px)",color:"rgba(255,255,255,0.3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT ─ Donut + Bar Chart */}
            <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:"24px"}}>
              {/* Donut */}
              <div style={{position:"relative"}}>
                <Donut
                  high={latest?.total_high||0}
                  medium={latest?.total_medium||0}
                  low={latest?.total_low||0}
                  total={latest?.total_users||1}
                  size={clampVal(160,200)}
                />
                {/* Glow ring */}
                <div style={{position:"absolute",inset:"-8px",borderRadius:"50%",background:"radial-gradient(circle,rgba(249,115,22,0.08),transparent 65%)",pointerEvents:"none"}}/>
              </div>
              {/* Legend */}
              <div style={{display:"flex",flexDirection:"column",gap:"6px",minWidth:"180px"}}>
                {[
                  {l:"≥91% (High)",     c:"#22C55E",v:latest?.total_high||0},
                  {l:"51–90% (Medium)", c:"#F97316",v:latest?.total_medium||0},
                  {l:"<50% (Low)",      c:"#EF4444",v:latest?.total_low||0},
                ].map((d,i)=>(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    <div style={{width:"8px",height:"8px",borderRadius:"50%",background:d.c,boxShadow:`0 0 6px ${d.c}80`,flexShrink:0}}/>
                    <span style={{fontSize:"11px",color:"rgba(255,255,255,0.45)",flex:1}}>{d.l}</span>
                    <span style={{fontSize:"13px",fontWeight:700,color:"white"}}>{d.v}</span>
                  </div>
                ))}
              </div>
              {/* Bar mini chart */}
              <div style={{opacity:0.9}}><HeroChart latest={latest}/></div>
            </div>
          </div>
        </div>
      </div>
      {/* ══════════ END HERO ══════════ */}

      {/* ── WHITE CONTENT ── */}
      <div style={{background:"#F6F7FA",borderRadius:"28px 28px 0 0",marginTop:"-6px"}}>
        <div style={{maxWidth:"1200px",margin:"0 auto",padding:"clamp(20px,3vw,36px) clamp(20px,5vw,80px)"}}>

          {/* Glossary */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(12px,1.5vw,18px)",marginBottom:"clamp(14px,2vw,20px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:700,fontSize:"12px",color:"#333",marginBottom:"10px"}}>📖 Role Mapping & Compliance</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:"8px"}}>
              {[
                {term:"ADS/ADM (GRSM)",  def:"Area Distributor Supervisor/Manager — field Ficom users", c:"#A855F7"},
                {term:"RDM (NSM)",        def:"Regional Distribution Manager — monitors multiple ADMs",   c:"#3B82F6"},
                {term:"ADS field (m_master)",def:"ADS/LP assigned to distributors — tracked separately", c:"#F97316"},
                {term:"Compliance %",     def:`Unique login days ÷ ${latest?.selling_days||"N"} selling days × 100`, c:"#22C55E"},
              ].map((g,i)=>(
                <div key={i} style={{padding:"8px 12px",background:"#F8F9FA",borderRadius:"10px",borderLeft:`3px solid ${g.c}`}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:g.c,marginBottom:"3px"}}>{g.term}</div>
                  <div style={{fontSize:"10px",color:"#666",lineHeight:1.5}}>{g.def}</div>
                </div>
              ))}
            </div>
          </div>

          {/* m_master ADS/LP summary card */}
          {((latest?.total_ads||0)+(latest?.total_lp||0))>0&&(
            <div style={{background:"linear-gradient(135deg,#431407,#1c0a00)",borderRadius:"16px",border:"1px solid rgba(249,115,22,0.2)",padding:"clamp(14px,2vw,20px)",marginBottom:"clamp(14px,2vw,20px)",boxShadow:"0 2px 20px rgba(249,115,22,0.08)"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}}>
                <div style={{fontSize:"20px"}}>📋</div>
                <div>
                  <div style={{fontWeight:700,fontSize:"13px",color:"#FB923C"}}>Field User Master (ADS/LP)</div>
                  <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)"}}>Data dari MasterDataFiicom_m_master.xlsx · Tracked terpisah dari WebFicom login</div>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:"8px"}}>
                {[
                  {l:"Total ADS",v:latest?.total_ads||0,c:"#FB923C"},
                  {l:"Total LP",v:latest?.total_lp||0,c:"#FCD34D"},
                  {l:"Total Field",v:(latest?.total_ads||0)+(latest?.total_lp||0),c:"white"},
                ].map((s,i)=>(
                  <div key={i} style={{background:"rgba(255,255,255,0.06)",borderRadius:"10px",padding:"10px 14px",border:"1px solid rgba(249,115,22,0.15)"}}>
                    <div style={{fontSize:"20px",fontWeight:900,color:s.c,fontFamily:"'Bricolage Grotesque',sans-serif"}}>{s.v}</div>
                    <div style={{fontSize:"10px",color:"rgba(255,255,255,0.4)",fontWeight:600,marginTop:"2px"}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Area Filter */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(10px,1.5vw,16px)",marginBottom:"clamp(14px,2vw,20px)",display:"flex",gap:"10px",flexWrap:"wrap",alignItems:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:700,fontSize:"12px",color:"#333",flexShrink:0}}>🗺️ Filter Area:</div>
            <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
              {["ALL",...AOR_NAMES].map(a=>{
                const col=AOR_COLORS[a]||"#F97316"; const active=areaFilter===a
                return(
                  <button key={a} onClick={()=>setAreaFilter(a)}
                    style={{padding:"5px 13px",borderRadius:"10px",border:`1.5px solid ${active?col:"#E5E7EB"}`,background:active?`${col}15`:"transparent",color:active?col:"#666",cursor:"pointer",fontFamily:"inherit",fontSize:"11px",fontWeight:700,transition:"all 0.18s"}}>
                    {a}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Area Cards */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,22px)",marginBottom:"clamp(14px,2vw,20px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:800,marginBottom:"4px",color:"#111"}}>🗺️ Compliance by Area</h2>
            <p style={{fontSize:"10px",color:"#bbb",marginBottom:"14px"}}>Click area → lihat sub-area breakdown · Click "View Users" → lihat semua user</p>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,185px),1fr))",gap:"clamp(8px,1.2vw,12px)"}}>
              {latestAreas
                .filter(a=>areaFilter==="ALL"||a.aor===areaFilter)
                .map((a,i)=>{
                  const col=AOR_COLORS[a.aor]||"#888"
                  return (
                    <div key={i} className="area-card"
                      style={{borderRadius:"16px",padding:"clamp(12px,1.6vw,18px)",border:`2px solid ${col}20`,background:"white",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",animation:"fadeUp 0.5s ease both",animationDelay:`${i*0.1}s`,position:"relative",overflow:"hidden",transition:"border-color 0.25s,transform 0.25s,box-shadow 0.25s"}}
                      onMouseEnter={e=>{e.currentTarget.style.borderColor=col;e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow=`0 12px 30px ${col}22`}}
                      onMouseLeave={e=>{e.currentTarget.style.borderColor=`${col}20`;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"}}
                      onClick={()=>setAreaPopup(a.aor)}>
                      <div style={{position:"absolute",top:"-20%",right:"-10%",width:"70px",height:"70px",borderRadius:"50%",background:`${col}15`,filter:"blur(18px)",pointerEvents:"none"}}/>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                        <div>
                          <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(16px,1.8vw,20px)",fontWeight:900,color:col}}>{a.aor}</span>
                          <div style={{fontSize:"10px",color:"#aaa",marginTop:"1px"}}>{a.total_users} users</div>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <div style={{fontSize:"clamp(18px,2vw,22px)",fontWeight:900,color:compColor(a.avg_compliance),fontFamily:"'Bricolage Grotesque',sans-serif"}}>{a.avg_compliance.toFixed(0)}%</div>
                          <div style={{fontSize:"9px",color:"#aaa"}}>avg</div>
                        </div>
                      </div>
                      <div style={{height:"5px",background:`${col}15`,borderRadius:"99px",marginBottom:"10px",overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${Math.min(a.avg_compliance,100)}%`,background:`linear-gradient(90deg,${col},${col}88)`,borderRadius:"99px"}}/>
                      </div>
                      {/* Mini 3-tier breakdown */}
                      <div style={{display:"flex",gap:"4px",marginBottom:"10px"}}>
                        {[{v:a.high_count,c:"#22C55E",l:"≥91%"},{v:a.medium_count,c:"#F97316",l:"51–90%"},{v:a.low_count,c:"#EF4444",l:"<50%"}].map((b,bi)=>(
                          <div key={bi} style={{flex:1,background:`${b.c}10`,borderRadius:"7px",padding:"4px 0",textAlign:"center",border:`1px solid ${b.c}20`}}>
                            <div style={{fontSize:"13px",fontWeight:800,color:b.c}}>{b.v}</div>
                            <div style={{fontSize:"8px",color:"#aaa"}}>{b.l}</div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={e=>{e.stopPropagation();setUserPopup(a.aor)}}
                        style={{width:"100%",padding:"6px",borderRadius:"9px",border:`1.5px solid ${col}30`,background:"transparent",color:col,cursor:"pointer",fontFamily:"inherit",fontSize:"10px",fontWeight:700,transition:"all 0.15s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background=`${col}12`}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                        👤 View {a.total_users} Users →
                      </button>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* User Table */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,22px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginBottom:"14px"}}>
              <div>
                <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:800,color:"#111"}}>
                  👤 User Detail <span style={{fontSize:"12px",fontWeight:400,color:"#bbb"}}>({filteredUsers.length}/{latestUsers.length})</span>
                </h2>
                <p style={{fontSize:"10px",color:"#bbb",marginTop:"3px"}}>Click header to sort · {latest?.period_label}</p>
              </div>
              <div style={{display:"flex",gap:"7px",flexWrap:"wrap",alignItems:"center"}}>
                <input placeholder="🔍 Name / ID / Sub-AOR..." value={search} onChange={e=>setSearch(e.target.value)}
                  style={{padding:"7px 12px",border:"1.5px solid #E5E7EB",borderRadius:"10px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(130px,22vw,200px)",background:"#FAFAF8"}}
                  onFocus={e=>{e.currentTarget.style.borderColor="#F97316"}} onBlur={e=>{e.currentTarget.style.borderColor="#E5E7EB"}}/>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"10px",padding:"3px"}}>
                  {(["all","ADM","RDM"] as const).map(p=>(
                    <button key={p} onClick={()=>setPosFilter(p)} style={{padding:"4px 10px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"10px",fontWeight:700,fontFamily:"inherit",background:posFilter===p?"white":"transparent",color:posFilter===p?"#111":"#888",boxShadow:posFilter===p?"0 1px 4px rgba(0,0,0,0.1)":"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                      {p==="all"?"Semua":posLabel(p)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:"700px"}}>
                <thead>
                  <tr style={{borderBottom:"2px solid #F0F0F0"}}>
                    {[
                      {l:"User ID",c:null},{l:"Name",c:"username"as const},{l:"Role",c:null},
                      {l:"AOR",c:null},{l:"Sub-AOR",c:null},{l:"RDM",c:null},
                      {l:"Days",c:"usage_days"as const},{l:"Compliance",c:"compliance_pct"as const},
                      {l:"Training",c:null},{l:"Last Login",c:null}
                    ].map((h,i)=>(
                      <th key={i} onClick={()=>h.c&&sortToggle(h.c)}
                        style={{padding:"8px 10px",textAlign:"left",fontSize:"9px",fontWeight:700,color:"#999",textTransform:"uppercase",letterSpacing:"0.06em",cursor:h.c?"pointer":"default",userSelect:"none",whiteSpace:"nowrap"}}>
                        {h.l}{h.c&&<span style={{marginLeft:"3px",opacity:sortCol===h.c?1:0.25}}>{sortDir===1?"↑":"↓"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u,i)=>{
                    const col=AOR_COLORS[u.aor]||"#888"
                    return (
                      <tr key={i} style={{borderBottom:"1px solid #F8F8F8",transition:"background 0.12s"}}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F8F9FA"}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                        <td style={{padding:"9px 10px",fontSize:"11px",color:"#aaa",fontFamily:"monospace"}}>{u.user_id}</td>
                        <td style={{padding:"9px 10px",fontSize:"12px",fontWeight:600,color:"#111",maxWidth:"170px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.username}</td>
                        <td style={{padding:"9px 10px"}}>
                          <span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",background:u.position==="RDM"?"#EEF7FF":"#F3E8FF",color:u.position==="RDM"?"#1E88E5":"#8E24AA"}}>{posLabel(u.position)}</span>
                        </td>
                        <td style={{padding:"9px 10px"}}>
                          <span style={{background:`${col}15`,color:col,fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px"}}>{u.aor}</span>
                        </td>
                        <td style={{padding:"9px 10px",fontSize:"11px",color:"#666"}}>{u.sub_aor}</td>
                        <td style={{padding:"9px 10px",fontSize:"11px",color:"#555",maxWidth:"130px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.rdm_name}</td>
                        <td style={{padding:"9px 10px",fontSize:"12px",fontWeight:700,color:"#111",textAlign:"center"}}>
                          {u.usage_days}<span style={{fontSize:"9px",color:"#aaa",fontWeight:400}}>/{u.selling_days}</span>
                        </td>
                        <td style={{padding:"9px 10px"}}>
                          <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
                            <div style={{width:"48px",height:"6px",background:"#F0F0F0",borderRadius:"99px",overflow:"hidden",flexShrink:0}}>
                              <div style={{height:"100%",width:`${Math.min(u.compliance_pct,100)}%`,background:compColor(u.compliance_pct),borderRadius:"99px"}}/>
                            </div>
                            <span style={{fontSize:"11px",fontWeight:800,color:compColor(u.compliance_pct),minWidth:"40px"}}>{u.compliance_pct}%</span>
                          </div>
                        </td>
                        <td style={{padding:"9px 10px"}}>
                          <span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",background:u.trained===1?"#E8F5E9":"#F8F8F8",color:u.trained===1?"#43A047":"#999"}}>
                            {u.trained===1?"✅ Trained":"⏳ Pending"}
                          </span>
                        </td>
                        <td style={{padding:"9px 10px",fontSize:"11px",color:"#aaa",fontFamily:"monospace",whiteSpace:"nowrap"}}>{u.last_usage_date||"—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredUsers.length===0&&(
                <div style={{textAlign:"center",padding:"48px",color:"#bbb"}}>
                  <div style={{fontSize:"28px",marginBottom:"10px"}}>🔍</div>No users found.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Popups */}
      {areaPopup&&<AreaPopup aor={areaPopup} users={latestUsers.filter(u=>u.aor===areaPopup)} onClose={()=>setAreaPopup(null)}/>}
      {userPopup&&<UserPopup users={latestUsers.filter(u=>u.aor===userPopup)} aorLabel={userPopup} onClose={()=>setUserPopup(null)}/>}

      <style dangerouslySetInnerHTML={{__html:`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes popUp   { from{opacity:0;transform:scale(0.88) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes orb1    { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-30px,20px) scale(1.08)} }
        @keyframes orb2    { 0%,100%{transform:translate(0,0)} 50%{transform:translate(25px,-25px)} }
        @keyframes gridSlide { from{backgroundPosition:0 0} to{backgroundPosition:48px 48px} }
        @keyframes particle { 0%,100%{opacity:0;transform:translateY(0) scale(0)} 40%,60%{opacity:0.6;transform:translateY(-20px) scale(1)} }
        @media(max-width:640px){ .kpi-card{ animation: none !important; } }
      `}}/>
    </div>
  )
}

function clampVal(min: number, preferred: number) { return preferred }