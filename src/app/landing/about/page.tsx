"use client"
import LandingNav from "../components/LandingNav"

import { useState, useEffect, useRef } from "react"

const C = { primary:"#E8381A", primaryLight:"#FF6B4A", gray:"#6B7280", dark:"#111111", light:"#F4F4F2", white:"#FFFFFF", border:"rgba(0,0,0,0.08)" }

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [v, setV] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) setV(true) }, { threshold: 0.1 })
    o.observe(ref.current); return () => o.disconnect()
  }, [ref]); return v
}

const VALUES = [
  { icon: "🎯", title: "Goal-Oriented", desc: "Every feature built around team targets and measurable performance outcomes." },
  { icon: "🤝", title: "Collaborative", desc: "Designed for teams — shared visibility, coordinated actions, unified reporting." },
  { icon: "⚡", title: "Fast & Reliable", desc: "99.1% uptime with real-time sync and sub-2-second load times across all modules." },
  { icon: "📱", title: "Mobile First", desc: "Built responsive from the ground up — works on phone, tablet, and desktop." },
  { icon: "🔄", title: "Always Current", desc: "Admin-managed content ensures resources and data stay up to date." },
  { icon: "🛡️", title: "Secure Access", desc: "Role-based permissions ensure the right people see the right information." },
]

const TIMELINE = [
  { year: "2023", title: "Project Kickoff", desc: "PHI Support Hub initiated to centralize digital tools for the Philippines team." },
  { year: "2024 Q1", title: "SFA Launch", desc: "Sales Force Automation deployed — visit tracking and target monitoring." },
  { year: "2024 Q3", title: "Ficom Integration", desc: "Finance module integrated with automated period-closing and reporting." },
  { year: "2025", title: "Ficom Lite", desc: "Mobile-first version launched for field agents operating offline." },
  { year: "2026", title: "Unified Hub", desc: "This platform launched to bring all three systems together." },
]

export default function AboutPage() {
  const valRef = useRef(null); const tlRef = useRef(null)
  const vIn = useInView(valRef); const tIn = useInView(tlRef)
  useEffect(() => {
    const l = document.createElement("link"); l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600&display=swap"
    document.head.appendChild(l)
  }, [])
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: C.dark, background: C.white, minHeight: "100vh" }}>
      <LandingNav />
      {/* Back */}
      <div style={{ padding: "clamp(80px,10vw,120px) clamp(20px,5vw,80px) 0" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto" }}>

        </div>
      </div>

      {/* Hero */}
      <div style={{ background:`linear-gradient(135deg, #FEF0ED 0%, #FFF8F5 60%, ${C.white} 100%)`, padding:"clamp(40px,6vw,80px) clamp(20px,5vw,80px)", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-10%", right:"-5%", width:"clamp(200px,30vw,400px)", height:"clamp(200px,30vw,400px)", borderRadius:"50%", background:`radial-gradient(circle, ${C.primary}15, transparent 70%)`, filter:"blur(60px)", pointerEvents:"none" }} />
        <div style={{ maxWidth:"700px", margin:"0 auto", textAlign:"center", position:"relative" }}>
          <div style={{ display:"inline-block", background:`${C.primary}12`, borderRadius:"99px", padding:"5px 16px", fontSize:"12px", fontWeight:700, color:C.primary, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"16px" }}>About Us</div>
          <h1 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(36px,6vw,68px)", fontWeight:900, lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:"20px" }}>
            Empowering the <span style={{ color:C.primary }}>Philippines</span> Team
          </h1>
          <p style={{ fontSize:"clamp(15px,1.8vw,18px)", color:C.gray, lineHeight:1.8 }}>
            PHI Support Hub is the central digital platform built specifically for Mayora Indah&apos;s Philippines team — unifying SFA, Ficom, and Ficom Lite into one seamless experience.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding:"clamp(40px,6vw,80px) clamp(20px,5vw,80px)" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))", gap:"clamp(12px,2vw,20px)", marginBottom:"clamp(60px,8vw,100px)" }}>
            {[{num:"120+",label:"Active Users",c:C.primary},{num:"3",label:"Applications",c:"#FB8C00"},{num:"99.1%",label:"Uptime",c:"#1E88E5"},{num:"2026",label:"Hub Launched",c:"#43A047"}].map((s,i) => (
              <div key={i} style={{ background:C.light, borderRadius:"20px", padding:"clamp(20px,2.5vw,28px)", textAlign:"center" }}>
                <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(28px,4vw,44px)", fontWeight:900, color:s.c, lineHeight:1, marginBottom:"6px" }}>{s.num}</div>
                <div style={{ fontSize:"clamp(12px,1.2vw,13px)", color:C.gray, fontWeight:600 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Values */}
          <div ref={valRef}>
            <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(26px,3.5vw,42px)", fontWeight:800, letterSpacing:"-0.02em", marginBottom:"clamp(24px,3vw,40px)", textAlign:"center" }}>What We Stand For</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%,280px), 1fr))", gap:"clamp(12px,2vw,18px)" }}>
              {VALUES.map((v,i) => (
                <div key={i} style={{ background:C.light, borderRadius:"20px", padding:"clamp(20px,2.5vw,28px)", opacity:vIn?1:0, transform:vIn?"none":"translateY(20px)", transition:`all 0.5s ${i*0.08}s ease` }}
                  onMouseEnter={e=>{e.currentTarget.style.background=`${C.primary}08`;e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.08)"}}
                  onMouseLeave={e=>{e.currentTarget.style.background=C.light;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
                  <div style={{ fontSize:"clamp(28px,3.5vw,36px)", marginBottom:"12px" }}>{v.icon}</div>
                  <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(14px,1.5vw,17px)", fontWeight:800, marginBottom:"8px" }}>{v.title}</div>
                  <div style={{ fontSize:"clamp(12px,1.2vw,13px)", color:C.gray, lineHeight:1.6 }}>{v.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div ref={tlRef} style={{ marginTop:"clamp(60px,8vw,100px)" }}>
            <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(26px,3.5vw,42px)", fontWeight:800, letterSpacing:"-0.02em", marginBottom:"clamp(24px,3vw,40px)", textAlign:"center" }}>Our Journey</h2>
            <div style={{ maxWidth:"660px", margin:"0 auto" }}>
              {TIMELINE.map((t,i) => (
                <div key={i} style={{ display:"flex", gap:"clamp(16px,3vw,28px)", marginBottom:"clamp(20px,2.5vw,28px)", opacity:tIn?1:0, transform:tIn?"none":"translateX(-20px)", transition:`all 0.5s ${i*0.1}s ease` }}>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                    <div style={{ width:"clamp(44px,5vw,56px)", height:"clamp(44px,5vw,56px)", borderRadius:"14px", background:i===TIMELINE.length-1?C.primary:C.light, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(9px,1vw,11px)", fontWeight:800, color:i===TIMELINE.length-1?"white":C.gray, textAlign:"center", lineHeight:1.2, padding:"4px" }}>{t.year}</div>
                    {i<TIMELINE.length-1&&<div style={{ width:"2px", height:"clamp(20px,2.5vw,28px)", background:`${C.primary}30`, marginTop:"4px" }} />}
                  </div>
                  <div style={{ paddingTop:"clamp(8px,1vw,14px)" }}>
                    <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(15px,1.6vw,18px)", fontWeight:800, marginBottom:"4px" }}>{t.title}</div>
                    <div style={{ fontSize:"clamp(13px,1.3vw,15px)", color:C.gray, lineHeight:1.6 }}>{t.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } html { scroll-behavior: smooth; }`}</style>
    </div>
  )
}