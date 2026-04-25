"use client"
import LandingNav from "../components/LandingNav"
import { useState, useEffect, useRef } from "react"

const C = { primary:"#E8381A", gray:"#6B7280", dark:"#111111", light:"#F4F4F2", white:"#FFFFFF", border:"rgba(0,0,0,0.08)" }

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [v, setV] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold: 0.1 })
    o.observe(ref.current); return () => o.disconnect()
  }, [ref]); return v
}

const APPS = [
  {
    emoji:"📊", name:"SFA", full:"Sales Force Automation", color:"#E8381A", bg:"#FEF0ED",
    desc:"Track daily visits, monitor outlet targets, and manage sales team performance across all regions in the Philippines with real-time dashboards.",
    features:["Daily Visit Tracking","Target vs Achievement Monitor","Outlet Coverage Map","Leaderboard & Rankings","Period Reporting","Offline Visit Log"],
    stat:{num:"92%",label:"Target Achievement"},
    howto:["Log in with your SFA credentials","Set your daily visit plan","Complete visits and check-in at each outlet","Submit your daily report","Review your performance dashboard"],
  },
  {
    emoji:"💰", name:"Ficom", full:"Finance & Commerce Module", color:"#FB8C00", bg:"#FFF8F0",
    desc:"Complete financial transaction management, outlet coverage tracking, and automated period-closing reports for accurate accounting and compliance.",
    features:["Transaction Entry & Validation","Period Opening & Closing","Outlet Financial Summary","Matrix & MCR Reports","SFA-Ficom Sync","Multi-role Approval Flow"],
    stat:{num:"99%",label:"Report Accuracy"},
    howto:["Access Ficom from your dashboard","Select your outlet and period","Enter daily transactions","Validate entries before submission","Close period after admin approval"],
  },
  {
    emoji:"📱", name:"Ficom Lite", full:"Mobile Finance Module", color:"#1E88E5", bg:"#EEF7FF",
    desc:"Lightweight mobile version of Ficom designed specifically for field agents — with full offline capability and seamless sync when reconnected.",
    features:["Offline Mode Support","Auto-sync on Reconnect","Quick Submit Flow","Mobile Dashboard","Push Notifications","< 2s Load Time"],
    stat:{num:"98%",label:"Sync Success Rate"},
    howto:["Install Ficom Lite on Android","Grant required permissions","Log in and sync data","Use offline when in the field","Data auto-syncs when connected"],
  },
]

export default function ApplicationsPage() {
  const [active, setActive] = useState(0)
  const app = APPS[active]
  const ref = useRef(null); const inView = useInView(ref)

  useEffect(() => {
    const l = document.createElement("link"); l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600&display=swap"
    document.head.appendChild(l)
  }, [])

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", color:C.dark, background:C.white, minHeight:"100vh" }}>
      <LandingNav />
      {/* Back */}
      <div style={{ padding:"clamp(80px,10vw,100px) clamp(20px,5vw,80px) 0" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>

        </div>
      </div>

      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg, #FEF0ED, #FFF8F5, ${C.white})`, padding:"clamp(80px,10vw,100px) clamp(20px,5vw,80px) clamp(40px,5vw,64px)", textAlign:"center" }}>
        <div style={{ display:"inline-block", background:`${C.primary}12`, borderRadius:"99px", padding:"5px 16px", fontSize:"12px", fontWeight:700, color:C.primary, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"16px" }}>Our Applications</div>
        <h1 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(34px,6vw,64px)", fontWeight:900, lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:"16px" }}>
          Three Tools, <span style={{ color:C.primary }}>One Mission</span>
        </h1>
        <p style={{ fontSize:"clamp(14px,1.6vw,17px)", color:C.gray, lineHeight:1.8, maxWidth:"520px", margin:"0 auto" }}>
          Deep dive into each application — features, workflows, and everything you need to get the most out of the PHI Support ecosystem.
        </p>
      </div>

      {/* Tab selector */}
      <div style={{ padding:"clamp(32px,4vw,48px) clamp(20px,5vw,80px) 0" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <div style={{ display:"flex", gap:"clamp(8px,1.5vw,14px)", flexWrap:"wrap", marginBottom:"clamp(24px,3vw,40px)" }}>
            {APPS.map((a,i) => (
              <button key={i} onClick={() => setActive(i)}
                style={{ background:active===i?a.color:"transparent", color:active===i?"white":C.gray, border:`2px solid ${active===i?a.color:C.border}`, borderRadius:"99px", padding:"clamp(8px,1.2vw,12px) clamp(16px,2.5vw,28px)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:"clamp(13px,1.4vw,15px)", fontWeight:700, display:"flex", alignItems:"center", gap:"8px", transition:"all 0.25s", boxShadow:active===i?`0 6px 20px ${a.color}40`:"none" }}>
                <span style={{ fontSize:"clamp(16px,2vw,20px)" }}>{a.emoji}</span> {a.name}
              </button>
            ))}
          </div>

          {/* App detail */}
          <div ref={ref} style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap:"clamp(24px,3vw,40px)", marginBottom:"clamp(40px,5vw,64px)" }}>
            {/* Left */}
            <div>
              <div style={{ background:app.bg, borderRadius:"24px", padding:"clamp(24px,3vw,36px)", marginBottom:"clamp(16px,2vw,24px)" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" }}>
                  <div style={{ width:"clamp(52px,6vw,68px)", height:"clamp(52px,6vw,68px)", borderRadius:"18px", background:C.white, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"clamp(26px,3vw,34px)", boxShadow:`0 4px 16px ${app.color}25` }}>{app.emoji}</div>
                  <div style={{ background:app.color, color:"white", fontSize:"clamp(22px,3vw,32px)", fontWeight:900, padding:"clamp(10px,1.5vw,16px) clamp(14px,2vw,22px)", borderRadius:"14px", fontFamily:"'Bricolage Grotesque',sans-serif", lineHeight:1 }}>{app.stat.num}</div>
                </div>
                <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(22px,3vw,32px)", fontWeight:900, marginBottom:"4px" }}>{app.name}</div>
                <div style={{ fontSize:"clamp(12px,1.3vw,14px)", color:app.color, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"14px" }}>{app.stat.label} · {app.full}</div>
                <p style={{ fontSize:"clamp(13px,1.4vw,15px)", color:C.gray, lineHeight:1.8 }}>{app.desc}</p>
              </div>

              {/* Features */}
              <div style={{ background:C.light, borderRadius:"24px", padding:"clamp(20px,2.5vw,28px)" }}>
                <div style={{ fontSize:"12px", fontWeight:700, color:C.gray, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"16px" }}>Key Features</div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"10px" }}>
                  {app.features.map((f,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"clamp(12px,1.3vw,13px)", fontWeight:500 }}>
                      <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:app.color, flexShrink:0 }} />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — How to use */}
            <div>
              <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(20px,2.5vw,28px)", fontWeight:800, marginBottom:"clamp(16px,2vw,24px)" }}>How to Use {app.name}</div>
              {app.howto.map((step,i) => (
                <div key={i} style={{ display:"flex", gap:"clamp(12px,1.5vw,18px)", marginBottom:"clamp(16px,2vw,22px)", opacity:inView?1:0, transform:inView?"none":"translateX(20px)", transition:`all 0.5s ${i*0.1}s ease` }}>
                  <div style={{ width:"clamp(32px,3.5vw,40px)", height:"clamp(32px,3.5vw,40px)", borderRadius:"12px", background:app.color, color:"white", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(14px,1.5vw,16px)", fontWeight:900, flexShrink:0 }}>{i+1}</div>
                  <div style={{ paddingTop:"clamp(6px,0.8vw,10px)" }}>
                    <div style={{ fontSize:"clamp(13px,1.4vw,15px)", lineHeight:1.6, color:C.dark }}>{step}</div>
                  </div>
                </div>
              ))}

              <div style={{ marginTop:"clamp(24px,3vw,36px)", padding:"clamp(16px,2vw,24px)", background:`${app.color}10`, borderRadius:"20px", border:`1.5px solid ${app.color}25` }}>
                <div style={{ fontSize:"clamp(12px,1.2vw,13px)", fontWeight:700, color:app.color, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"8px" }}>💡 Pro Tip</div>
                <p style={{ fontSize:"clamp(12px,1.3vw,14px)", color:C.gray, lineHeight:1.7 }}>
                  For the best experience with {app.name}, make sure to sync your data at the start and end of each working day. Check the Tutorial section for detailed step-by-step guides.
                </p>
              </div>

              <a href="/landing/tutorials" style={{ display:"inline-flex", alignItems:"center", gap:"8px", marginTop:"clamp(16px,2vw,24px)", background:app.color, color:"white", textDecoration:"none", padding:"clamp(12px,1.5vw,14px) clamp(20px,3vw,28px)", borderRadius:"99px", fontSize:"clamp(13px,1.4vw,14px)", fontWeight:700, boxShadow:`0 6px 20px ${app.color}40`, transition:"all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)" }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none" }}>
                📖 View {app.name} Tutorials →
              </a>
            </div>
          </div>
        </div>
      </div>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html { scroll-behavior: smooth; }`}</style>
    </div>
  )
}