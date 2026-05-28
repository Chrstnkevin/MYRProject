"use client"
import { useState, useEffect, useMemo, useCallback } from "react"
import LandingNav from "../components/LandingNav"
import { supabase } from "@/lib/supabase"

interface StagingRow { distributor_id:string; distributor_nm:string; tgl_gudang:string; spv:string; grsm:string }
interface MasterRow  { adp_code:number; server:number; server_name:string; region_name:string; remarks:string }
interface DisplayRow { distributor_id:string; distributor_nm:string; tgl_gudang:string; server:string; aor:string; tas:string; lama:number; excluded:boolean }

function getBaseline(){const d=new Date();const day=d.getDay();const sub=day===1?3:day===0?2:1;d.setDate(d.getDate()-sub);return d.toISOString().slice(0,10)}
function parseTgl(raw:string){if(!raw)return"";const s=String(raw);if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);const M:Record<string,string>={JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12"};const p=s.trim().toUpperCase().split(/\s+/);return p.length===3?`${p[2]}-${M[p[1]]||"01"}-${p[0].padStart(2,"0")}`:"";}
function calcLama(t:string,b:string){if(!t||!b)return 99;return Math.round((new Date(b+"T12:00:00").setHours(0,0,0,0)-new Date(t+"T12:00:00").setHours(0,0,0,0))/86400000)}
function pct(n:number,d:number){return d===0?0:Math.round(n/d*1000)/10}

const AOR:Record<string,{color:string;glow:string;bg:string}>={
  GMA:{color:"#F59E0B",glow:"rgba(245,158,11,0.4)",bg:"rgba(245,158,11,0.08)"},
  NOL:{color:"#3B82F6",glow:"rgba(59,130,246,0.4)",bg:"rgba(59,130,246,0.08)"},
  SOL:{color:"#8B5CF6",glow:"rgba(139,92,246,0.4)",bg:"rgba(139,92,246,0.08)"},
  VIS:{color:"#06B6D4",glow:"rgba(6,182,212,0.4)",bg:"rgba(6,182,212,0.08)"},
  MIN:{color:"#EF4444",glow:"rgba(239,68,68,0.4)",bg:"rgba(239,68,68,0.08)"},
}
const TAS:Record<string,string>={GMA:"JC",NOL:"Van",SOL:"Lindon",VIS:"Darren",MIN:"JC"}

export default function DataTransferLanding(){
  const [staging, setStaging] = useState<StagingRow[]>([])
  const [master,  setMaster]  = useState<MasterRow[]>([])
  const [loading, setLoading] = useState(true)
  const [updated, setUpdated] = useState<Date|null>(null)
  const [filterAor, setFilterAor] = useState("ALL")
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("ALL")
  const [mounted, setMounted] = useState(false)
  const baseline = getBaseline()

  const load = useCallback(async()=>{
    setLoading(true)
    const [s,m] = await Promise.all([
      supabase.from("edi_transfer_staging").select("distributor_id,distributor_nm,tgl_gudang,spv,grsm"),
      supabase.from("master_data_adp").select("adp_code,server,server_name,region_name,remarks")
    ])
    if(s.data)setStaging(s.data as StagingRow[])
    if(m.data)setMaster(m.data as MasterRow[])
    setUpdated(new Date()); setLoading(false)
  },[])

  useEffect(()=>{setMounted(true);load()},[load])
  useEffect(()=>{const iv=setInterval(load,5*60*1000);return()=>clearInterval(iv)},[load])

  const rows = useMemo(():DisplayRow[]=>{
    const mm:Record<string,MasterRow>={}
    master.forEach(m=>{const k=String(m.adp_code);const cur=mm[k];if(!cur||(m.remarks!=="Inactive"&&cur.remarks==="Inactive"))mm[k]=m})
    const dd:Record<string,StagingRow>={}
    staging.forEach(r=>{const k=String(r.distributor_id);if(!dd[k]||parseTgl(r.tgl_gudang)>parseTgl(dd[k].tgl_gudang))dd[k]=r})
    return Object.values(dd).map(r=>{
      const m=mm[String(r.distributor_id)]; const iso=parseTgl(r.tgl_gudang); const aor=m?.region_name||""
      return{distributor_id:r.distributor_id,distributor_nm:r.distributor_nm,tgl_gudang:iso,
        server:m?.server?String(m.server):"—",aor,tas:TAS[aor]||"—",lama:calcLama(iso,baseline),excluded:m?.remarks==="Inactive"}
    }).sort((a,b)=>b.lama-a.lama)
  },[staging,master,baseline])

  const active   = useMemo(()=>rows.filter(r=>!r.excluded),[rows])
  const ok       = useMemo(()=>active.filter(r=>r.lama<=0).length,[active])
  const overall  = pct(ok,active.length)
  const late     = active.length - ok

  const aorStats = useMemo(()=>["GMA","NOL","SOL","VIS","MIN"].map(aor=>{
    const g=active.filter(r=>r.aor===aor); const o=g.filter(r=>r.lama<=0).length
    return{aor,ok:o,total:g.length,p:pct(o,g.length)}
  }).filter(g=>g.total>0),[active])

  const tasStats = useMemo(()=>["JC","Van","Lindon","Darren"].map(tas=>{
    const g=active.filter(r=>r.tas===tas); const o=g.filter(r=>r.lama<=0).length
    return{tas,ok:o,total:g.length,p:pct(o,g.length)}
  }).filter(g=>g.total>0),[active])

  const filtered = useMemo(()=>rows.filter(r=>{
    if(filterAor!=="ALL"&&r.aor!==filterAor)return false
    if(filterStatus==="LATE"&&(r.excluded||r.lama<=0))return false
    if(filterStatus==="OK"&&r.lama>0)return false
    if(search&&!r.distributor_id.includes(search)&&!r.distributor_nm.toLowerCase().includes(search.toLowerCase()))return false
    return true
  }),[rows,filterAor,search,filterStatus])

  const ovColor  = overall>=90?"#10B981":overall>=70?"#3B82F6":"#EF4444"
  const ovGlow   = overall>=90?"rgba(16,185,129,0.3)":overall>=70?"rgba(59,130,246,0.3)":"rgba(239,68,68,0.3)"
  const r2 = (size:number)=>{ const radius=(size-12)/2; const circ=2*Math.PI*radius; const dash=(overall/100)*circ; return{radius,circ,dash} }
  const {radius,circ,dash} = r2(160)

  return (
    <div style={{minHeight:"100vh",background:"#030711",color:"#E2E8F0",fontFamily:"'DM Sans',system-ui,sans-serif",paddingTop:64}}>
      <LandingNav/>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');
        @keyframes pulse-ring { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.8;transform:scale(1.05)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes count-up { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @media (max-width: 768px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-grid > div:first-child { flex-direction: row !important; align-items: center !important; padding: 16px !important; gap: 16px !important; }
        }
        @media (max-width: 640px) {
          .hero-grid > div:first-child { flex-direction: column !important; }
        }
        @media (max-width: 700px) {
          .desktop-table { display: none !important; }
          .mobile-cards { display: flex !important; }
        }
        @media (min-width: 701px) {
          .mobile-cards { display: none !important; }
        }
        .stat-card { transition:transform 0.2s,box-shadow 0.2s; }
        .stat-card:hover { transform:translateY(-3px); }
        .aor-pill:hover { filter:brightness(1.2); }
        .table-row { transition:background 0.15s; }
        .table-row:hover { background:rgba(255,255,255,0.03) !important; }
        .glow-border { position:relative; }
        .glow-border::before { content:''; position:absolute; inset:-1px; border-radius:inherit; padding:1px; background:linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.03)); -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor; pointer-events:none; }
      `}</style>

      {/* Background orbs */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
        <div style={{position:"absolute",top:"10%",left:"5%",width:400,height:400,borderRadius:"50%",background:`radial-gradient(circle,${ovGlow} 0%,transparent 70%)`,filter:"blur(60px)",opacity:0.6}}/>
        <div style={{position:"absolute",bottom:"20%",right:"5%",width:300,height:300,borderRadius:"50%",background:"radial-gradient(circle,rgba(139,92,246,0.2) 0%,transparent 70%)",filter:"blur(50px)"}}/>
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,backgroundImage:"radial-gradient(rgba(255,255,255,0.02) 1px,transparent 1px)",backgroundSize:"32px 32px"}}/>
      </div>

      <div style={{maxWidth:1140,margin:"0 auto",padding:"28px 16px 60px",position:"relative",zIndex:1}}>

        {/* ── HEADER ─────────────────────────────────────────── */}
        <div style={{marginBottom:36,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:ovColor,boxShadow:`0 0 12px ${ovGlow}`,animation:"pulse-ring 2s ease-in-out infinite"}}/>
              <span style={{fontSize:11,fontFamily:"'Space Mono',monospace",color:"#64748B",letterSpacing:"0.12em",textTransform:"uppercase"}}>Live · update tiap jam</span>
            </div>
            <h1 style={{fontSize:"clamp(22px,4vw,32px)",fontWeight:800,margin:0,lineHeight:1.1,letterSpacing:"-0.02em",background:"linear-gradient(135deg,#F1F5F9 40%,#64748B)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              Data Transfer<br/>Web Ficom
            </h1>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 14px",fontSize:12}}>
              <span style={{color:"#64748B"}}>Baseline </span>
              <span style={{fontFamily:"'Space Mono',monospace",color:"#3B82F6",fontWeight:700}}>{baseline}</span>
            </div>
            <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 14px",fontSize:12,display:"flex",gap:8,alignItems:"center"}}>
              {loading
                ? <span style={{display:"inline-block",animation:"spin 1s linear infinite",fontSize:14}}>⟳</span>
                : <span style={{color:"#10B981",fontSize:10}}>●</span>
              }
              <span style={{color:"#64748B"}}>{updated?updated.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}):"—"}</span>
            </div>
          </div>
        </div>

        {/* ── HERO STATS ──────────────────────────────────────── */}
        <div style={{display:"grid",gridTemplateColumns:"240px 1fr",gap:16,marginBottom:16}} className="hero-grid">

          {/* Overall ring */}
          <div className="stat-card glow-border" style={{background:"rgba(255,255,255,0.03)",borderRadius:20,padding:"28px 20px",display:"flex",flexDirection:"column",alignItems:"center",gap:12,border:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {/* Glow ring */}
              <div style={{position:"absolute",width:170,height:170,borderRadius:"50%",background:`radial-gradient(circle,${ovGlow} 0%,transparent 70%)`,filter:"blur(20px)",opacity:0.7}}/>
              <svg width={160} height={160} style={{transform:"rotate(-90deg)",position:"relative"}}>
                <circle cx={80} cy={80} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10}/>
                <circle cx={80} cy={80} r={radius} fill="none" stroke={ovColor} strokeWidth={10}
                  strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
                  style={{filter:`drop-shadow(0 0 8px ${ovGlow})`,transition:"stroke-dasharray 1.2s ease"}}/>
              </svg>
              <div style={{position:"absolute",textAlign:"center"}}>
                <div style={{fontSize:30,fontWeight:900,color:ovColor,lineHeight:1,fontFamily:"'Space Mono',monospace",
                  filter:`drop-shadow(0 0 12px ${ovGlow})`,animation:"count-up 0.6s ease"}}>{overall}%</div>
                <div style={{fontSize:10,color:"#64748B",marginTop:2,letterSpacing:"0.08em"}}>OVERALL</div>
              </div>
            </div>
            <div style={{textAlign:"center"}}>
              <div style={{fontSize:16,fontWeight:700,color:ovColor}}>{ok}<span style={{color:"#64748B",fontWeight:400,fontSize:13}}>/{active.length}</span></div>
              <div style={{fontSize:11,color:"#64748B"}}>distributor on time</div>
            </div>
            <div style={{display:"flex",gap:12,width:"100%"}}>
              <div style={{flex:1,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.15)",borderRadius:10,padding:"8px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#10B981"}}>{ok}</div>
                <div style={{fontSize:10,color:"#64748B"}}>OK</div>
              </div>
              <div style={{flex:1,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.15)",borderRadius:10,padding:"8px",textAlign:"center"}}>
                <div style={{fontSize:18,fontWeight:800,color:"#EF4444"}}>{late}</div>
                <div style={{fontSize:10,color:"#64748B"}}>Late</div>
              </div>
            </div>
          </div>

          {/* Area + TAS */}
          <div style={{display:"grid",gridTemplateRows:"1fr 1fr",gap:12}}>

            {/* Per Area */}
            <div className="glow-border" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"18px 22px"}}>
              <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:"#64748B",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>Per Area</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {aorStats.map(s=>{
                  const a=AOR[s.aor]||{color:"#888",glow:"rgba(136,136,136,0.3)",bg:"rgba(136,136,136,0.08)"}
                  return(
                    <div key={s.aor} className="stat-card" style={{flex:"1 1 100px",background:a.bg,border:`1px solid ${a.color}25`,borderRadius:12,padding:"10px 12px"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <span style={{fontSize:11,fontWeight:700,color:a.color,letterSpacing:"0.05em"}}>{s.aor}</span>
                        <span style={{fontSize:13,fontWeight:800,color:a.color,fontFamily:"'Space Mono',monospace"}}>{s.p}%</span>
                      </div>
                      <div style={{background:"rgba(255,255,255,0.08)",borderRadius:99,height:4,overflow:"hidden"}}>
                        <div style={{width:`${s.p}%`,height:"100%",background:a.color,borderRadius:99,boxShadow:`0 0 6px ${a.glow}`,transition:"width 0.8s ease"}}/>
                      </div>
                      <div style={{fontSize:10,color:"#64748B",marginTop:4}}>{s.ok}/{s.total}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Per TAS */}
            <div className="glow-border" style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,padding:"18px 22px"}}>
              <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:"#64748B",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:14}}>Per TAS</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                {tasStats.map(s=>(
                  <div key={s.tas} className="stat-card" style={{flex:"1 1 100px",background:"rgba(99,102,241,0.08)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"10px 12px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{fontSize:11,fontWeight:700,color:"#818CF8"}}>{s.tas}</span>
                      <span style={{fontSize:13,fontWeight:800,color:"#818CF8",fontFamily:"'Space Mono',monospace"}}>{s.p}%</span>
                    </div>
                    <div style={{background:"rgba(255,255,255,0.08)",borderRadius:99,height:4,overflow:"hidden"}}>
                      <div style={{width:`${s.p}%`,height:"100%",background:"#818CF8",borderRadius:99,boxShadow:"0 0 6px rgba(129,140,248,0.4)",transition:"width 0.8s ease"}}/>
                    </div>
                    <div style={{fontSize:10,color:"#64748B",marginTop:4}}>{s.ok}/{s.total}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── TABLE ──────────────────────────────────────────── */}
        <div className="glow-border" style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:20,overflow:"hidden"}}>

          {/* Table header/filter */}
          <div style={{padding:"16px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",display:"flex",gap:10,alignItems:"flex-start",flexWrap:"wrap",background:"rgba(255,255,255,0.02)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"8px 14px",flex:1,minWidth:200}}>
              <span style={{color:"#64748B",fontSize:14}}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari ADP atau distributor..."
                style={{background:"none",border:"none",outline:"none",fontSize:13,color:"#E2E8F0",width:"100%",fontFamily:"inherit"}}/>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {["ALL","GMA","NOL","SOL","VIS","MIN"].map(a=>{
                const active2=filterAor===a; const ac=AOR[a]
                return(
                  <button key={a} onClick={()=>setFilterAor(a)} className="aor-pill"
                    style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${active2?(ac?.color||"#E2E8F0"):"rgba(255,255,255,0.08)"}`,
                      background:active2?(ac?.bg||"rgba(255,255,255,0.1)"):"transparent",
                      color:active2?(ac?.color||"#E2E8F0"):"#64748B",
                      fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"'Space Mono',monospace",
                      boxShadow:active2?`0 0 12px ${ac?.glow||"transparent"}`:"none",transition:"all 0.15s"}}>
                    {a}
                  </button>
                )
              })}
            </div>
            <div style={{display:"flex",gap:6,marginLeft:"auto"}}>
              {[["ALL","Semua","#64748B","rgba(100,116,139,0.15)"],["LATE","Terlambat","#EF4444","rgba(239,68,68,0.15)"],["OK","On Time","#10B981","rgba(16,185,129,0.15)"]].map(([v,label,color,bg])=>(
                <button key={v} onClick={()=>setFilterStatus(v)}
                  style={{padding:"7px 14px",borderRadius:8,border:`1px solid ${filterStatus===v?color:"rgba(255,255,255,0.08)"}`,
                    background:filterStatus===v?bg:"transparent",color:filterStatus===v?color:"#64748B",
                    fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s",
                    boxShadow:filterStatus===v?`0 0 12px ${bg}`:"none"}}>
                  {label}
                </button>
              ))}
              <span style={{padding:"7px 10px",fontSize:12,color:"#64748B",fontFamily:"'Space Mono',monospace",display:"flex",alignItems:"center"}}>{filtered.length} dist</span>
            </div>
          </div>

          <div style={{overflowX:"auto"}} className="desktop-table">
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"rgba(255,255,255,0.02)"}}>
                  {["ADP","Distributor","Server","Area","TAS","Tgl Transfer","Status"].map(h=>(
                    <th key={h} style={{padding:"10px 16px",fontSize:10,fontWeight:700,color:"#475569",textAlign:"left",
                      borderBottom:"1px solid rgba(255,255,255,0.06)",textTransform:"uppercase",letterSpacing:"0.08em",
                      fontFamily:"'Space Mono',monospace",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0?(
                  <tr><td colSpan={7} style={{padding:60,textAlign:"center",color:"#475569"}}>
                    {loading?"Memuat data...":"Tidak ada data"}
                  </td></tr>
                ):filtered.map((r,i)=>{
                  const a=AOR[r.aor]
                  const rowBg=r.excluded?"rgba(255,255,255,0.01)":r.lama>3?"rgba(239,68,68,0.04)":r.lama>0?"rgba(245,158,11,0.04)":"transparent"
                  return(
                    <tr key={i} className="table-row" style={{borderBottom:"1px solid rgba(255,255,255,0.04)",background:rowBg,opacity:r.excluded?0.4:1}}>
                      <td style={{padding:"10px 16px",fontFamily:"'Space Mono',monospace",fontWeight:700,color:"#38BDF8",fontSize:11}}>{r.distributor_id}</td>
                      <td style={{padding:"10px 16px",maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",fontWeight:600,color:"#CBD5E1"}}>{r.distributor_nm}</td>
                      <td style={{padding:"10px 16px",fontSize:11,color:"#64748B",fontFamily:"'Space Mono',monospace"}}>{r.server}</td>
                      <td style={{padding:"10px 16px"}}>
                        {r.aor&&a?(
                          <span style={{background:a.bg,border:`1px solid ${a.color}30`,color:a.color,
                            padding:"3px 10px",borderRadius:99,fontSize:10,fontWeight:700,
                            boxShadow:`0 0 8px ${a.glow}`,letterSpacing:"0.04em"}}>{r.aor}</span>
                        ):"—"}
                      </td>
                      <td style={{padding:"10px 16px",fontSize:11,color:"#94A3B8"}}>{r.tas}</td>
                      <td style={{padding:"10px 16px",fontFamily:"'Space Mono',monospace",fontSize:11,color:"#94A3B8"}}>{r.tgl_gudang||"—"}</td>
                      <td style={{padding:"10px 16px"}}>
                        {r.excluded?(
                          <span style={{fontSize:10,color:"#475569",fontFamily:"'Space Mono',monospace"}}>excluded</span>
                        ):r.lama<=0?(
                          <span style={{background:"rgba(16,185,129,0.12)",border:"1px solid rgba(16,185,129,0.25)",color:"#10B981",
                            padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,
                            boxShadow:"0 0 8px rgba(16,185,129,0.2)"}}>✓ OK</span>
                        ):(
                          <span style={{background:r.lama>3?"rgba(239,68,68,0.12)":"rgba(245,158,11,0.12)",
                            border:`1px solid ${r.lama>3?"rgba(239,68,68,0.25)":"rgba(245,158,11,0.25)"}`,
                            color:r.lama>3?"#EF4444":"#F59E0B",
                            padding:"3px 10px",borderRadius:99,fontSize:11,fontWeight:700,fontFamily:"'Space Mono',monospace",
                            boxShadow:`0 0 8px ${r.lama>3?"rgba(239,68,68,0.2)":"rgba(245,158,11,0.2)"}`}}>
                            {r.lama>3?"🚨":"⚡"} {r.lama}h
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}