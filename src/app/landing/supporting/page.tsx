"use client"
import LandingNav from "../components/LandingNav"
import { useEffect } from "react"

const C = { primary:"#E8381A", gray:"#6B7280", dark:"#111111", light:"#F4F4F2", white:"#FFFFFF" }

const SECTIONS = [
  {
    icon:"🖼️", title:"Infographics", href:"/landing/infographics",
    desc:"Visual reference materials — quick summaries, process flows, and key information in easy-to-understand graphic format.",
    items:["SFA User Flow","Ficom Finance Report","Outlet Coverage Map","Ficom Lite Guide","Q1 Performance Summary","Training Roadmap"],
    color:C.primary, bg:"#FEF0ED", cta:"Browse Infographics",
  },
  {
    icon:"📖", title:"Tutorial System", href:"/landing/tutorials",
    desc:"Step-by-step interactive guides for every application — from first login to advanced features, with screenshots and descriptions.",
    items:["SFA — 4 step guides","Ficom — 3 step guides","Ficom Lite — 3 step guides","Getting Started Series","Feature Deep Dives","Troubleshooting Guides"],
    color:"#1E88E5", bg:"#EEF7FF", cta:"Start Learning",
  },
]

export default function SupportingPage() {
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
      <div style={{ background:`linear-gradient(135deg, #FEF0ED, #FFF8F5, ${C.white})`, padding:"clamp(88px,12vw,120px) clamp(20px,5vw,80px) clamp(40px,5vw,64px)", textAlign:"center" }}>
        <div style={{ display:"inline-block", background:`${C.primary}12`, borderRadius:"99px", padding:"5px 16px", fontSize:"12px", fontWeight:700, color:C.primary, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"16px" }}>Supporting Materials</div>
        <h1 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(34px,6vw,64px)", fontWeight:900, lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:"16px" }}>
          Learn, Reference, <span style={{ color:C.primary }}>and Grow</span>
        </h1>
        <p style={{ fontSize:"clamp(14px,1.6vw,17px)", color:C.gray, lineHeight:1.8, maxWidth:"520px", margin:"0 auto" }}>
          Everything your team needs to get the most out of SFA, Ficom, and Ficom Lite — in one place.
        </p>
      </div>

      {/* Cards */}
      <div style={{ padding:"clamp(40px,6vw,80px) clamp(20px,5vw,80px)" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(min(100%,460px), 1fr))", gap:"clamp(20px,3vw,32px)" }}>
          {SECTIONS.map((s,i) => (
            <div key={i} style={{ background:C.light, borderRadius:"28px", overflow:"hidden", transition:"all 0.3s" }}
              onMouseEnter={e => { e.currentTarget.style.transform="translateY(-6px)"; e.currentTarget.style.boxShadow="0 20px 48px rgba(0,0,0,0.12)" }}
              onMouseLeave={e => { e.currentTarget.style.transform="none"; e.currentTarget.style.boxShadow="none" }}>
              {/* Top accent */}
              <div style={{ background:s.bg, padding:"clamp(24px,3vw,36px)" }}>
                <div style={{ fontSize:"clamp(40px,5vw,56px)", marginBottom:"16px" }}>{s.icon}</div>
                <div style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(22px,2.8vw,30px)", fontWeight:900, marginBottom:"10px" }}>{s.title}</div>
                <p style={{ fontSize:"clamp(13px,1.4vw,15px)", color:C.gray, lineHeight:1.7 }}>{s.desc}</p>
              </div>
              {/* Items */}
              <div style={{ padding:"clamp(20px,2.5vw,28px)" }}>
                <div style={{ fontSize:"11px", fontWeight:700, color:C.gray, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"14px" }}>What's Inside</div>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px", marginBottom:"clamp(20px,2.5vw,28px)" }}>
                  {s.items.map((item,j) => (
                    <div key={j} style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 14px", background:C.white, borderRadius:"12px", fontSize:"clamp(12px,1.3vw,14px)", fontWeight:500 }}>
                      <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:s.color, flexShrink:0 }} />
                      {item}
                    </div>
                  ))}
                </div>
                <a href={s.href} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"8px", background:s.color, color:"white", textDecoration:"none", padding:"clamp(12px,1.5vw,16px)", borderRadius:"14px", fontSize:"clamp(13px,1.4vw,15px)", fontWeight:700, transition:"all 0.2s", boxShadow:`0 6px 20px ${s.color}35` }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform="none" }}>
                  {s.cta} →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>
    </div>
  )
}