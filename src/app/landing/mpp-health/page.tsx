"use client"
// PATH: src/app/landing/mpp-health/page.tsx

import LandingNav from "../components/LandingNav"
import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const C = { navy:"#1E3A5F", red:"#DC2626", orange:"#EA580C", green:"#16A34A", gray:"#6B7280", dark:"#111111", white:"#FFFFFF" }

type HealthRow  = { id:number; snapshot_time:string; status:string; subdist_issue:number; impacted_salesman:number; rdm_active_zero:number; adm_active_zero:number; ads_active_zero:number; subdist_list:any[]; message:string }
type AlertSnapshot = {
  id: number
  snapshot_time: string
  total_not_update: number
  total_rdm: number
  total_adm: number
  total_ads: number
  top_rdm: string
  top_rdm_count: number
  top_ads: string
  top_ads_count: number
  alert_message: string
}

function PulseDot({color}:{color:string}) {
  return (
    <span style={{position:"relative",display:"inline-flex",width:12,height:12,flexShrink:0}}>
      <span style={{position:"absolute",inset:0,borderRadius:"50%",background:color,opacity:0.4,animation:"ping 1.5s cubic-bezier(0,0,0.2,1) infinite"}}/>
      <span style={{position:"relative",display:"inline-flex",width:12,height:12,borderRadius:"50%",background:color}}/>
    </span>
  )
}

function MetricCard({icon,label,value,sub,color,bg,border,delay=0}:{icon:string;label:string;value:number;sub?:string;color:string;bg:string;border:string;delay?:number}) {
  const [vis,setVis]=useState(false)
  useEffect(()=>{const t=setTimeout(()=>setVis(true),delay);return()=>clearTimeout(t)},[delay])
  return (
    <div style={{background:C.white,borderRadius:20,overflow:"hidden",border:`1.5px solid ${border}`,boxShadow:`0 4px 20px ${color}12`,opacity:vis?1:0,transform:vis?"none":"translateY(16px)",transition:"opacity 0.5s,transform 0.5s"}}>
      <div style={{background:bg,padding:"18px 20px 14px",borderBottom:`1px solid ${border}`}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:24}}>{icon}</span>
          <span style={{fontSize:9,fontWeight:700,color,textTransform:"uppercase",letterSpacing:"0.1em"}}>{label}</span>
        </div>
        <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:36,fontWeight:900,color,lineHeight:1,letterSpacing:"-0.04em"}}>{value}</div>
      </div>
      {sub&&<div style={{padding:"8px 20px",fontSize:11,color:C.gray}}>{sub}</div>}
    </div>
  )
}

function TrendBar({data}:{data:{date:string;val:number}[]}) {
  if(!data.length) return <p style={{fontSize:12,color:C.gray,textAlign:"center",padding:"20px 0"}}>No historical data yet</p>
  const max=Math.max(...data.map(d=>d.val),1)
  return (
    <div>
      <div style={{display:"flex",alignItems:"flex-end",gap:4,height:80}}>
        {data.map((d,i)=>{
          const h=Math.max((d.val/max)*68,4);const ok=d.val===0
          return (
            <div key={i} title={`${d.date}: ${d.val} issue`} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:2,height:"100%",cursor:"default"}}>
              <div style={{fontSize:8,fontWeight:700,color:ok?C.green:C.red,lineHeight:1}}>{d.val>0?d.val:""}</div>
              <div style={{width:"100%",height:h,borderRadius:"3px 3px 0 0",background:ok?C.green:C.red,opacity:0.8,transition:"height 0.4s"}}/>
            </div>
          )
        })}
      </div>
      <div style={{display:"flex",gap:4,marginTop:4}}>
        {data.map((d,i)=>(
          <div key={i} style={{flex:1,fontSize:8,color:C.gray,textAlign:"center",overflow:"hidden"}}>
            {i%Math.max(1,Math.floor(data.length/7))===0?d.date:""}
          </div>
        ))}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:14,marginTop:10,justifyContent:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.gray}}><div style={{width:10,height:10,background:C.green,borderRadius:2}}/> Healthy</div>
        <div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.gray}}><div style={{width:10,height:10,background:C.red,borderRadius:2}}/> Warning</div>
      </div>
    </div>
  )
}

export default function LandingMPPHealth() {
  const [health,setHealth]   = useState<HealthRow|null>(null)
  const [alertSnap,setAlertSnap] = useState<AlertSnapshot|null>(null)
  const [details,setDetails]     = useState<{rdm_name:string;adm_name:string;ads_name:string;salesman_name:string;last_date:string}[]>([])
  const [trend,setTrend]     = useState<{date:string;val:number}[]>([])
  const [loading,setLoading] = useState(true)

  useEffect(()=>{
    const l=document.createElement("link");l.rel="stylesheet"
    l.href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600;700&display=swap"
    document.head.appendChild(l)
    loadData()
    const t=setInterval(loadData,5*60*1000);return()=>clearInterval(t)
  },[])

  async function loadData() {
    setLoading(true)
    const [{data:h},{data:snap},{data:det},{data:hist}] = await Promise.all([
      supabase.from("m_dashboard_health").select("*").order("id",{ascending:false}).limit(1).single(),
      supabase.from("mpp_alert_snapshot").select("*").order("id",{ascending:false}).limit(1).single(),
      supabase.from("mpp_alert_detail").select("*").order("snapshot_time",{ascending:false}).limit(500),
      supabase.from("m_dashboard_health").select("id,snapshot_time,subdist_issue").order("id",{ascending:false}).limit(200),
    ])
    if(h) setHealth(h)
    if(snap) setAlertSnap(snap)
    if(det) setDetails(det)
    if(hist){
      const byDate:Record<string,number>={}
      for(const row of hist){
        const date=new Date(row.snapshot_time).toLocaleDateString("en-US",{month:"short",day:"2-digit"})
        if(!(date in byDate)) byDate[date]=row.subdist_issue||0
      }
      setTrend(Object.entries(byDate).slice(0,30).reverse().map(([date,val])=>({date,val})))
    }
    setLoading(false)
  }

  const isHealthy   = (health?.subdist_issue||0)===0
  const statusColor = isHealthy ? C.green : C.red
  const fmtTime = (s:string) => s ? new Date(s).toLocaleString("en-US",{month:"short",day:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"

  const rdmBreakdown = Object.entries(
    details.reduce((acc,d)=>{acc[d.rdm_name]=(acc[d.rdm_name]||0)+1;return acc},{} as Record<string,number>)
  ).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count}))

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",color:C.dark,background:C.white,minHeight:"100vh"}}>
      <LandingNav/>

      {/* Hero */}
      <div style={{background:isHealthy?"linear-gradient(135deg,#F0FDF4,#DCFCE7,#F8FAFC,white)":"linear-gradient(135deg,#FEF2F2,#FFE4E6,#FFF1F0,white)",padding:"clamp(100px,12vw,140px) clamp(20px,5vw,80px) clamp(48px,6vw,72px)",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"5%",left:"3%",width:240,height:240,borderRadius:"50%",background:isHealthy?"#DCFCE7":"#FEE2E2",opacity:0.5}}/>
        <div style={{position:"absolute",bottom:"0%",right:"5%",width:180,height:180,borderRadius:"50%",background:isHealthy?"#BBF7D0":"#FECACA",opacity:0.4}}/>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:20}}>
            <PulseDot color={statusColor}/>
            <div style={{background:isHealthy?"#DCFCE7":"#FEE2E2",borderRadius:99,padding:"6px 18px",fontSize:12,fontWeight:700,color:statusColor,letterSpacing:"0.1em",textTransform:"uppercase",border:`1px solid ${isHealthy?"#BBF7D0":"#FECACA"}`}}>
              {loading?"Loading data..." : isHealthy?"HEALTHY — All systems normal":`WARNING — ${health?.subdist_issue} Subdist Issues Detected`}
            </div>
          </div>
          <h1 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(34px,6vw,68px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:16}}>
            MPP Health <span style={{color:statusColor}}>Monitoring</span>
          </h1>
          <p style={{fontSize:"clamp(14px,1.6vw,17px)",color:C.gray,lineHeight:1.8,maxWidth:560,margin:"0 auto 24px"}}>
            Real-time SFA hierarchy health monitoring for PHI — detecting anomalies where Subdist has MPP targets but no active salesman.
          </p>
          <div style={{fontSize:12,color:C.gray}}>Last update: <strong>{fmtTime(health?.snapshot_time||"")}</strong> · Auto-refresh every 5 minutes</div>
        </div>
      </div>

      {/* KPI Metrics */}
      <div style={{padding:"clamp(48px,6vw,72px) clamp(20px,5vw,80px) 0"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:22}}>🎯</span><span style={{fontSize:12,fontWeight:700,color:C.navy,textTransform:"uppercase",letterSpacing:"0.12em"}}>Key Metrics</span></div>
          <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(22px,3vw,32px)",fontWeight:900,letterSpacing:"-0.02em",marginBottom:28}}>System Health Status</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:16,marginBottom:48}}>
            <MetricCard icon="🚨" label="Subdist Issues"    value={health?.subdist_issue||0}    color={isHealthy?C.green:C.red} bg={isHealthy?"#F0FDF4":"#FEF2F2"} border={isHealthy?"#BBF7D0":"#FECACA"} sub="Problematic subdists"  delay={0}/>
            <MetricCard icon="👥" label="Impacted Salesman" value={health?.impacted_salesman||0} color={C.orange} bg="#FFF7ED" border="#FED7AA" sub="Total affected salesman" delay={80}/>
            <MetricCard icon="⚠️" label="Not Updated"       value={alertSnap?.total_not_update||0}           color="#CA8A04"  bg="#FFFBEB" border="#FDE68A" sub="Salesman not updating"  delay={160}/>
            <MetricCard icon="📍" label="RDM Affected"      value={alertSnap?.total_rdm||0}       color="#7C3AED"  bg="#F5F3FF" border="#DDD6FE" sub="Unique RDMs"            delay={240}/>
            <MetricCard icon="🏢" label="ADM Affected"      value={alertSnap?.total_adm||0}       color={C.navy}   bg="#EFF6FF" border="#BFDBFE" sub="Unique ADMs"            delay={320}/>
            <MetricCard icon="📦" label="ADS Affected"      value={alertSnap?.total_ads||0}       color="#0891B2"  bg="#ECFEFF" border="#A5F3FC" sub="Unique ADS"             delay={400}/>
          </div>
        </div>
      </div>

      {/* Trend + Top Issue */}
      <div style={{padding:"0 clamp(20px,5vw,80px)"}}>
        <div style={{maxWidth:1200,margin:"0 auto",display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,marginBottom:48}}>
          <div style={{background:C.white,borderRadius:24,padding:"28px 30px",border:"1.5px solid #F3F4F6",boxShadow:"0 4px 20px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:22}}>📈</span><h3 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:18,fontWeight:800}}>Daily Trend</h3></div>
            <p style={{fontSize:12,color:C.gray,marginBottom:20}}>Subdist issues per day — last 30 days</p>
            <TrendBar data={trend}/>
          </div>
          <div style={{background:C.white,borderRadius:24,padding:"28px 30px",border:"1.5px solid #F3F4F6",boxShadow:"0 4px 20px rgba(0,0,0,0.06)"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:22}}>🔝</span><h3 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:18,fontWeight:800}}>Top Issue Areas</h3></div>
            <p style={{fontSize:12,color:C.gray,marginBottom:20}}>Areas with most salesman not updating</p>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{padding:"14px 16px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:14}}>
                <div style={{fontSize:10,fontWeight:700,color:C.red,letterSpacing:"0.08em",marginBottom:6}}>🔴 TOP RDM</div>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:15,fontWeight:800,color:C.dark,marginBottom:4}}>{alertSnap?.top_rdm||"—"}</div>
                <div style={{fontSize:12,color:C.red,fontWeight:600}}>{alertSnap?.top_rdm_count||0} salesman not updated</div>
              </div>
              <div style={{padding:"14px 16px",background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:14}}>
                <div style={{fontSize:10,fontWeight:700,color:C.orange,letterSpacing:"0.08em",marginBottom:6}}>🟠 TOP ADM</div>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:15,fontWeight:800,color:C.dark,marginBottom:4}}>{alertSnap?.top_ads||"—"}</div>
                <div style={{fontSize:12,color:C.orange,fontWeight:600}}>{alertSnap?.top_ads_count||0} salesman not updated</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Subdist Issue List */}
      <div style={{padding:"0 clamp(20px,5vw,80px)",marginBottom:64}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:22}}>🚨</span><span style={{fontSize:12,fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:"0.12em"}}>Problematic Subdists</span></div>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",marginBottom:24,flexWrap:"wrap",gap:12}}>
            <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(22px,3vw,32px)",fontWeight:900,letterSpacing:"-0.02em"}}>
              {isHealthy ? "All Subdists Healthy ✅" : `${health?.subdist_issue} Subdists Need Attention`}
            </h2>
            <div style={{fontSize:12,color:C.gray,padding:"6px 14px",background:"#F4F4F2",borderRadius:99}}>Active = 0 & MPP &gt; 0</div>
          </div>
          {isHealthy ? (
            <div style={{textAlign:"center",padding:"clamp(40px,6vw,80px) 20px",background:"linear-gradient(135deg,#F0FDF4,#DCFCE7)",borderRadius:28,border:"1.5px solid #BBF7D0"}}>
              <div style={{fontSize:64,marginBottom:16}}>✅</div>
              <h3 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:24,fontWeight:900,color:C.green,marginBottom:8}}>All Systems Healthy</h3>
              <p style={{fontSize:15,color:C.gray,lineHeight:1.6}}>No subdists with issues at this time.<br/>All areas have sufficient active salesman.</p>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
              {(health?.subdist_list||[]).map((item:any,i:number)=>(
                <div key={i} style={{padding:"14px 16px",background:C.white,border:"1.5px solid #FECACA",borderRadius:14,boxShadow:"0 2px 8px rgba(220,38,38,0.08)"}}>
                  <div style={{fontSize:10,fontWeight:700,color:C.red,letterSpacing:"0.08em",marginBottom:3}}>{item.wf||"—"}</div>
                  <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:14,fontWeight:800,color:C.dark,marginBottom:8}}>{item.name||"—"}</div>
                  <div style={{display:"flex",gap:6}}>
                    <span style={{fontSize:10,fontWeight:700,background:"#FEE2E2",color:C.red,padding:"3px 10px",borderRadius:99}}>Active: {item.active??0}</span>
                    <span style={{fontSize:10,fontWeight:700,background:"#FEF3C7",color:"#92400E",padding:"3px 10px",borderRadius:99}}>MPP: {item.mpp??"—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RDM Breakdown */}
      {(rdmBreakdown.length)>0 && (
        <div style={{padding:"0 clamp(20px,5vw,80px)",marginBottom:80}}>
          <div style={{maxWidth:1200,margin:"0 auto"}}>
            <div style={{background:"linear-gradient(135deg,#1E3A5F,#1E40AF)",borderRadius:28,padding:"clamp(32px,4vw,48px)",color:"white"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}><span style={{fontSize:22}}>📊</span><span style={{fontSize:12,fontWeight:700,opacity:0.7,textTransform:"uppercase",letterSpacing:"0.12em"}}>Not Updated Breakdown</span></div>
              <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(20px,2.8vw,28px)",fontWeight:900,marginBottom:24,letterSpacing:"-0.02em"}}>Salesman Not Updating by RDM</h2>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {(rdmBreakdown).slice(0,10).map((rdm,i)=>{
                  const pct = alertSnap?.total_not_update ? Math.round(rdm.count/alertSnap.total_not_update*100) : 0
                  return (
                    <div key={i} style={{display:"flex",alignItems:"center",gap:12}}>
                      <div style={{fontSize:11,color:"rgba(255,255,255,0.7)",width:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{rdm.name}</div>
                      <div style={{flex:1,height:8,background:"rgba(255,255,255,0.15)",borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:"white",borderRadius:99,opacity:0.8,transition:"width 0.4s"}}/>
                      </div>
                      <span style={{fontSize:12,fontWeight:700,color:"white",width:28,textAlign:"right",flexShrink:0}}>{rdm.count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes ping{75%,100%{transform:scale(2);opacity:0}}
      `}</style>
    </div>
  )
}