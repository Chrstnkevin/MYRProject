"use client"
import LandingNav from "../components/LandingNav"
import { useState, useEffect } from "react"

const C = { primary:"#E8381A", gray:"#6B7280", dark:"#111111", light:"#F4F4F2", white:"#FFFFFF" }

const INFOS = [
  { id:1, emoji:"🗺️", title:"SFA User Flow", tag:"SFA", color:"#E8F5E9", accent:"#43A047", desc:"Complete user journey map for SFA daily operations — from login to visit submission." },
  { id:2, emoji:"📊", title:"Ficom Finance Report", tag:"Ficom", color:"#FFF3E0", accent:"#FB8C00", desc:"Monthly financial reporting infographic — key figures and period-closing steps." },
  { id:3, emoji:"📍", title:"Outlet Coverage Map", tag:"SFA", color:"#FCE4EC", accent:"#E91E63", desc:"PHI outlet distribution and regional coverage visualization." },
  { id:4, emoji:"📱", title:"Ficom Lite Guide", tag:"Ficom Lite", color:"#E3F2FD", accent:"#1E88E5", desc:"Quick reference guide for mobile agents — offline mode and sync workflow." },
  { id:5, emoji:"📈", title:"Q1 Performance Summary", tag:"Ficom", color:"#F3E5F5", accent:"#8E24AA", desc:"Q1 2026 performance summary by region and application." },
  { id:6, emoji:"🎓", title:"Training Roadmap", tag:"General", color:"#E0F7FA", accent:"#00ACC1", desc:"System training roadmap for new team members joining PHI Support." },
]

export default function InfographicsPage() {
  const [popup, setPopup] = useState<number | null>(null)
  const [filter, setFilter] = useState("All")
  const selected = INFOS.find(i => i.id === popup)
  const tags = ["All", "SFA", "Ficom", "Ficom Lite", "General"]
  const filtered = filter === "All" ? INFOS : INFOS.filter(i => i.tag === filter)

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
      <div style={{ background:`linear-gradient(135deg, #FEF0ED, #FFF8F5, ${C.white})`, padding:"clamp(80px,10vw,100px) clamp(20px,5vw,80px) clamp(40px,5vw,64px)", textAlign:"center" }}>
        <div style={{ display:"inline-block", background:`${C.primary}12`, borderRadius:"99px", padding:"5px 16px", fontSize:"12px", fontWeight:700, color:C.primary, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"16px" }}>🖼️ Infographics</div>
        <h1 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(32px,5.5vw,60px)", fontWeight:900, lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:"14px" }}>
          Visual <span style={{ color:C.primary }}>Reference Library</span>
        </h1>
        <p style={{ fontSize:"clamp(14px,1.6vw,17px)", color:C.gray, lineHeight:1.8, maxWidth:"460px", margin:"0 auto" }}>
          Click any infographic to view it in full — visual guides for SFA, Ficom, and more.
        </p>
      </div>

      {/* Filter + Grid */}
      <div style={{ padding:"clamp(32px,5vw,64px) clamp(20px,5vw,80px)" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          {/* Filter */}
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"clamp(24px,3vw,36px)" }}>
            {tags.map(t => (
              <button key={t} onClick={() => setFilter(t)}
                style={{ background:filter===t?C.primary:"transparent", color:filter===t?"white":C.gray, border:`1.5px solid ${filter===t?C.primary:"#e0e0e0"}`, borderRadius:"99px", padding:"7px 18px", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:"clamp(12px,1.3vw,14px)", fontWeight:600, transition:"all 0.2s" }}>
                {t}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(min(100%,280px), 1fr))", gap:"clamp(14px,2vw,20px)" }}>
            {filtered.map(inf => (
              <div key={inf.id} onClick={() => setPopup(inf.id as number)}
                style={{ background:inf.color, borderRadius:"20px", padding:"clamp(20px,2.5vw,28px)", cursor:"pointer", transition:"all 0.25s", border:"1.5px solid transparent" }}
                onMouseEnter={e => { e.currentTarget.style.transform="translateY(-5px)"; e.currentTarget.style.boxShadow=`0 16px 40px ${inf.accent}25`; e.currentTarget.style.borderColor=`${inf.accent}40` }}
                onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none"; e.currentTarget.style.borderColor="transparent" }}>
                <div style={{ fontSize:"clamp(32px,4vw,40px)", marginBottom:"12px" }}>{inf.emoji}</div>
                <div style={{ display:"inline-block", background:`${inf.accent}20`, color:inf.accent, fontSize:"10px", fontWeight:700, padding:"3px 10px", borderRadius:"99px", marginBottom:"10px", letterSpacing:"0.08em", textTransform:"uppercase" }}>{inf.tag}</div>
                <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(15px,1.6vw,17px)", fontWeight:800, marginBottom:"8px" }}>{inf.title}</div>
                <div style={{ fontSize:"clamp(11px,1.2vw,13px)", color:"#555", lineHeight:1.5, marginBottom:"14px" }}>{inf.desc}</div>
                <div style={{ fontSize:"12px", color:inf.accent, fontWeight:700 }}>Click to view →</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popup */}
      {popup && selected && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center", padding:"clamp(16px,3vw,32px)", backdropFilter:"blur(8px)" }}
          onClick={() => setPopup(null)}>
          <div style={{ background:C.white, borderRadius:"clamp(16px,2vw,28px)", maxWidth:"680px", width:"100%", overflow:"hidden", boxShadow:"0 32px 80px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
            <div style={{ background:selected.color, padding:"clamp(24px,3vw,36px)", position:"relative" }}>
              <button onClick={() => setPopup(null)} style={{ position:"absolute", top:"16px", right:"16px", background:"rgba(0,0,0,0.1)", border:"none", cursor:"pointer", width:"32px", height:"32px", borderRadius:"50%", fontSize:"18px", display:"flex", alignItems:"center", justifyContent:"center" }}>×</button>
              <div style={{ fontSize:"clamp(36px,5vw,48px)", marginBottom:"12px" }}>{selected.emoji}</div>
              <div style={{ display:"inline-block", background:selected.accent, color:"white", fontSize:"10px", fontWeight:700, padding:"3px 10px", borderRadius:"99px", marginBottom:"10px", letterSpacing:"0.1em", textTransform:"uppercase" }}>{selected.tag}</div>
              <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(20px,2.5vw,26px)", fontWeight:900 }}>{selected.title}</div>
            </div>
            <div style={{ padding:"clamp(20px,2.5vw,32px)" }}>
              <p style={{ fontSize:"clamp(13px,1.4vw,15px)", color:C.gray, lineHeight:1.7, marginBottom:"20px" }}>{selected.desc}</p>
              <div style={{ background:C.light, borderRadius:"16px", padding:"clamp(48px,8vw,80px) clamp(20px,3vw,32px)", textAlign:"center" }}>
                <div style={{ fontSize:"clamp(32px,4vw,48px)", marginBottom:"10px" }}>🖼️</div>
                <div style={{ fontSize:"clamp(13px,1.4vw,15px)", color:C.gray, fontWeight:500 }}>Infographic will display here</div>
                <div style={{ fontSize:"11px", color:"#aaa", marginTop:"4px" }}>Upload via Admin Dashboard</div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
    </div>
  )
}