"use client"
import LandingNav from "../components/LandingNav"
import { useState, useEffect, useRef } from "react"

const C = { primary:"#E8381A", gray:"#6B7280", dark:"#111111", light:"#F4F4F2", white:"#FFFFFF" }

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data); const min = Math.min(...data); const h = 64; const w = 100
  const pts = data.map((v,i) => `${(i/(data.length-1))*w},${h-((v-min)/(max-min||1))*h*0.85-2}`).join(" ")
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow:"visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v,i) => i===data.length-1 ? <circle key={i} cx={(i/(data.length-1))*w} cy={h-((v-min)/(max-min||1))*h*0.85-2} r="3.5" fill={color} stroke="white" strokeWidth="2"/> : null)}
    </svg>
  )
}

const MONTHLY = [
  { app:"SFA", emoji:"📊", color:"#E8381A", bg:"#FEF0ED", data:[65,72,68,81,75,88,92,87,90,85,94,92],
    metrics:[{l:"Daily Active Users",v:87},{l:"Target Achievement",v:92},{l:"Visit Completion",v:78}],
    summary:"SFA usage has grown steadily throughout the year, with a peak in November driven by Q4 target campaigns." },
  { app:"Ficom", emoji:"💰", color:"#FB8C00", bg:"#FFF8F0", data:[78,82,79,91,88,93,96,94,97,95,98,96],
    metrics:[{l:"Transaction Success",v:96},{l:"Outlet Coverage",v:84},{l:"Report Accuracy",v:99}],
    summary:"Ficom maintains consistently high accuracy rates, reflecting strong team adoption and disciplined period-closing habits." },
  { app:"Ficom Lite", emoji:"📱", color:"#1E88E5", bg:"#EEF7FF", data:[45,52,58,63,61,68,71,74,72,78,75,71],
    metrics:[{l:"Mobile Adoption",v:71},{l:"Sync Success Rate",v:98},{l:"Offline Sessions",v:45}],
    summary:"Ficom Lite adoption continues to climb as more field agents transition to mobile-first workflows." },
]

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const HIGHLIGHTS = [
  { num:"120+", label:"Active Users", icon:"👥", desc:"Team members actively using at least one platform monthly", color:C.primary },
  { num:"99.1%", label:"System Uptime", icon:"⚡", desc:"Across all three platforms combined, measured over 12 months", color:"#43A047" },
  { num:"15k+", label:"Monthly Transactions", icon:"💳", desc:"Financial transactions processed through Ficom each month", color:"#FB8C00" },
  { num:"1.2k+", label:"Visits Logged", icon:"📍", desc:"SFA outlet visits recorded per month by the field team", color:"#1E88E5" },
]

export default function StatsPage() {
  const [active, setActive] = useState(0)
  const app = MONTHLY[active]
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold:0.1 })
    o.observe(ref.current); return () => o.disconnect()
  }, [])
  useEffect(() => {
    const l = document.createElement("link"); l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600&display=swap"
    document.head.appendChild(l)
  }, [])

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", color:C.dark, background:C.white, minHeight:"100vh" }}>
      <LandingNav />
      <div style={{ padding:"clamp(80px,10vw,100px) clamp(20px,5vw,80px) 0" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>

        </div>
      </div>

      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg, #111 0%, #1a1a1a 100%)`, padding:"clamp(88px,12vw,120px) clamp(20px,5vw,80px) clamp(40px,5vw,64px)", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-20%", right:"-10%", width:"clamp(200px,30vw,450px)", height:"clamp(200px,30vw,450px)", borderRadius:"50%", background:`radial-gradient(circle, ${C.primary}25, transparent 70%)`, filter:"blur(60px)", pointerEvents:"none" }} />
        <div style={{ maxWidth:"700px", margin:"0 auto", textAlign:"center", position:"relative" }}>
          <div style={{ display:"inline-block", background:`${C.primary}25`, borderRadius:"99px", padding:"5px 16px", fontSize:"12px", fontWeight:700, color:"#FF6B4A", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"16px" }}>Utilisation Stats</div>
          <h1 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(34px,6vw,64px)", fontWeight:900, lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:"16px", color:"white" }}>
            Numbers That <span style={{ color:"#FF6B4A" }}>Tell the Story</span>
          </h1>
          <p style={{ fontSize:"clamp(14px,1.6vw,17px)", color:"rgba(255,255,255,0.55)", lineHeight:1.8 }}>
            Real utilisation data across SFA, Ficom, and Ficom Lite — updated regularly by the admin team.
          </p>
        </div>
      </div>

      {/* Highlights */}
      <div style={{ padding:"clamp(40px,6vw,64px) clamp(20px,5vw,80px)" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:"clamp(12px,2vw,20px)", marginBottom:"clamp(48px,6vw,80px)" }}>
            {HIGHLIGHTS.map((h,i) => (
              <div key={i} style={{ background:C.light, borderRadius:"24px", padding:"clamp(20px,2.5vw,32px)", textAlign:"center", transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-4px)"; e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.1)" }}
                onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none" }}>
                <div style={{ fontSize:"clamp(24px,3.5vw,32px)", marginBottom:"10px" }}>{h.icon}</div>
                <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(30px,5vw,48px)", fontWeight:900, color:h.color, lineHeight:1, marginBottom:"6px" }}>{h.num}</div>
                <div style={{ fontSize:"clamp(13px,1.4vw,15px)", fontWeight:700, color:C.dark, marginBottom:"6px" }}>{h.label}</div>
                <div style={{ fontSize:"clamp(11px,1.1vw,12px)", color:C.gray, lineHeight:1.5 }}>{h.desc}</div>
              </div>
            ))}
          </div>

          {/* Per-app charts */}
          <div ref={ref}>
            <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(24px,3vw,36px)", fontWeight:800, letterSpacing:"-0.02em", marginBottom:"clamp(20px,2.5vw,32px)" }}>Monthly Trend by Application</h2>
            <div style={{ display:"flex", gap:"8px", marginBottom:"clamp(24px,3vw,36px)", flexWrap:"wrap" }}>
              {MONTHLY.map((a,i) => (
                <button key={i} onClick={() => setActive(i)}
                  style={{ background:active===i?a.color:"transparent", color:active===i?"white":C.gray, border:`2px solid ${active===i?a.color:"#e0e0e0"}`, borderRadius:"99px", padding:"clamp(7px,1vw,10px) clamp(14px,2vw,24px)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:"clamp(12px,1.3vw,14px)", fontWeight:700, display:"flex", alignItems:"center", gap:"6px", transition:"all 0.2s", boxShadow:active===i?`0 6px 20px ${a.color}40`:"none" }}>
                  {a.emoji} {a.app}
                </button>
              ))}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%,420px), 1fr))", gap:"clamp(16px,2vw,24px)" }}>
              {/* Chart */}
              <div style={{ background:C.light, borderRadius:"24px", padding:"clamp(20px,2.5vw,28px)", opacity:inView?1:0, transition:"all 0.6s ease" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px" }}>
                  <div>
                    <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(18px,2vw,22px)", fontWeight:800 }}>{app.app} 2026</div>
                    <div style={{ fontSize:"12px", color:C.gray }}>Monthly usage rate (%)</div>
                  </div>
                  <div style={{ background:app.bg, color:app.color, fontSize:"clamp(13px,1.5vw,15px)", fontWeight:800, padding:"6px 14px", borderRadius:"99px" }}>
                    ↑ {app.data[app.data.length-1]}%
                  </div>
                </div>
                <MiniChart data={app.data} color={app.color} />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:"8px" }}>
                  {MONTHS.map((m,i) => <span key={i} style={{ fontSize:"clamp(8px,0.9vw,10px)", color:"#aaa" }}>{m}</span>)}
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
                {app.metrics.map((m,i) => (
                  <div key={i} style={{ background:app.bg, borderRadius:"18px", padding:"clamp(16px,2vw,22px)", opacity:inView?1:0, transform:inView?"none":"translateX(20px)", transition:`all 0.5s ${i*0.1}s ease` }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                      <div style={{ fontSize:"clamp(13px,1.4vw,14px)", fontWeight:600 }}>{m.l}</div>
                      <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(18px,2vw,22px)", fontWeight:900, color:app.color }}>{m.v}%</div>
                    </div>
                    <div style={{ height:"8px", background:"rgba(0,0,0,0.08)", borderRadius:"99px", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${m.v}%`, background:app.color, borderRadius:"99px", transition:"width 1s ease" }} />
                    </div>
                  </div>
                ))}
                <div style={{ background:C.dark, borderRadius:"18px", padding:"clamp(16px,2vw,22px)" }}>
                  <div style={{ fontSize:"11px", fontWeight:700, color:"rgba(255,255,255,0.5)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"8px" }}>Summary</div>
                  <p style={{ fontSize:"clamp(12px,1.3vw,14px)", color:"rgba(255,255,255,0.7)", lineHeight:1.7 }}>{app.summary}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
    </div>
  )
}