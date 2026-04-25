"use client"
import LandingNav from "../components/LandingNav"
import { useState, useEffect } from "react"

const C = { primary:"#E8381A", gray:"#6B7280", dark:"#111111", light:"#F4F4F2", white:"#FFFFFF" }

const APPS = [
  {
    id:"sfa", label:"SFA", emoji:"📊", color:"#E8381A", bg:"#FEF0ED",
    sections:[
      { title:"Getting Started", desc:"Learn how to log in, set up your profile, and navigate the SFA dashboard for the first time. We will walk you through every menu and what each section means.", img:"" },
      { title:"Daily Check-in", desc:"Step-by-step guide for completing your daily visit check-in, recording customer notes, and submitting your activity report before end of day.", img:"" },
      { title:"Target Tracking", desc:"Understand how to view your daily and monthly targets, track progress against KPIs, and read the performance scoring breakdown.", img:"" },
      { title:"Report Generation", desc:"Generate, review, and export your weekly performance reports directly from the SFA dashboard in PDF or Excel format.", img:"" },
    ]
  },
  {
    id:"ficom", label:"Ficom", emoji:"💰", color:"#FB8C00", bg:"#FFF8F0",
    sections:[
      { title:"Dashboard Overview", desc:"Understand the main Ficom dashboard — key modules, navigation structure, and your role-based access permissions explained.", img:"" },
      { title:"Transaction Entry", desc:"How to record daily transactions correctly — select the right outlet, enter amounts, validate, and submit before the daily cutoff.", img:"" },
      { title:"Period Closing", desc:"Full walkthrough of the period-closing procedure: pre-close checklist, validation steps, approval workflow, and post-close archiving.", img:"" },
    ]
  },
  {
    id:"ficom-lite", label:"Ficom Lite", emoji:"📱", color:"#1E88E5", bg:"#EEF7FF",
    sections:[
      { title:"Mobile Setup", desc:"Install and configure Ficom Lite on your Android device — required permissions, initial sync settings, and offline mode activation.", img:"" },
      { title:"Offline Mode", desc:"How Ficom Lite works without internet connection, what data is available offline, and how everything syncs automatically when reconnected.", img:"" },
      { title:"Quick Submit", desc:"Use the Quick Submit feature to speed through your daily submissions — designed specifically for fast-moving field agents.", img:"" },
    ]
  },
]

export default function TutorialsPage() {
  const [appId, setAppId] = useState("sfa")
  const [step, setStep] = useState(0)
  const app = APPS.find(a => a.id === appId)!
  const section = app.sections[step]

  useEffect(() => { setStep(0) }, [appId])
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
        <div style={{ display:"inline-block", background:`${C.primary}12`, borderRadius:"99px", padding:"5px 16px", fontSize:"12px", fontWeight:700, color:C.primary, letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:"16px" }}>📖 Tutorials</div>
        <h1 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(32px,5.5vw,60px)", fontWeight:900, lineHeight:1.05, letterSpacing:"-0.03em", marginBottom:"14px" }}>
          Step-by-Step <span style={{ color:C.primary }}>Guides</span>
        </h1>
        <p style={{ fontSize:"clamp(14px,1.6vw,17px)", color:C.gray, lineHeight:1.8, maxWidth:"460px", margin:"0 auto" }}>
          Interactive walkthroughs for every application — navigate sections on the left, follow along on the right.
        </p>
      </div>

      {/* App selector */}
      <div style={{ padding:"clamp(24px,3vw,36px) clamp(20px,5vw,80px) 0" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <div style={{ display:"flex", gap:"clamp(8px,1.2vw,14px)", flexWrap:"wrap", marginBottom:"clamp(20px,2.5vw,32px)" }}>
            <div style={{ fontSize:"clamp(12px,1.3vw,14px)", fontWeight:600, color:C.gray, display:"flex", alignItems:"center", marginRight:"4px" }}>Select App:</div>
            {APPS.map(a => (
              <button key={a.id} onClick={() => setAppId(a.id)}
                style={{ background:appId===a.id?C.dark:"transparent", color:appId===a.id?"white":C.gray, border:`1.5px solid ${appId===a.id?C.dark:"#e0e0e0"}`, borderRadius:"99px", padding:"clamp(7px,1vw,10px) clamp(14px,2vw,22px)", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontSize:"clamp(12px,1.3vw,14px)", fontWeight:700, display:"flex", alignItems:"center", gap:"6px", transition:"all 0.2s" }}>
                {a.emoji} {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tutorial layout */}
      <div style={{ padding:"0 clamp(20px,5vw,80px) clamp(60px,8vw,100px)" }}>
        <div style={{ maxWidth:"1100px", margin:"0 auto" }}>
          <div style={{ display:"grid", gridTemplateColumns:"clamp(200px,25vw,280px) 1fr", gap:"clamp(16px,2.5vw,28px)", background:C.white, borderRadius:"24px", border:`1px solid rgba(0,0,0,0.08)`, boxShadow:"0 8px 32px rgba(0,0,0,0.06)", overflow:"hidden" }}>
            {/* Sidebar */}
            <div style={{ background:C.light, padding:"clamp(16px,2vw,24px) 0", borderRight:`1px solid rgba(0,0,0,0.06)` }}>
              <div style={{ padding:"0 clamp(14px,1.5vw,20px) clamp(12px,1.5vw,16px)", fontSize:"10px", fontWeight:800, color:C.gray, letterSpacing:"0.15em", textTransform:"uppercase" }}>
                {app.label} Tutorials
              </div>
              {app.sections.map((s,i) => (
                <div key={i} onClick={() => setStep(i)}
                  style={{ padding:"clamp(10px,1.3vw,14px) clamp(14px,1.5vw,20px)", cursor:"pointer", background:step===i?C.white:"transparent", borderRight:step===i?`3px solid ${app.color}`:"3px solid transparent", display:"flex", alignItems:"center", gap:"10px", transition:"all 0.2s" }}
                  onMouseEnter={e => { if(step!==i) e.currentTarget.style.background="rgba(0,0,0,0.03)" }}
                  onMouseLeave={e => { if(step!==i) e.currentTarget.style.background="transparent" }}>
                  <div style={{ width:"clamp(22px,2.5vw,26px)", height:"clamp(22px,2.5vw,26px)", borderRadius:"50%", flexShrink:0, background:step===i?app.color:"#e0e0e0", color:step===i?"white":"#888", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"clamp(10px,1.1vw,12px)", fontWeight:800, transition:"all 0.2s" }}>{i+1}</div>
                  <span style={{ fontSize:"clamp(11px,1.2vw,13px)", fontWeight:step===i?700:400, color:step===i?C.dark:"#555", lineHeight:1.3 }}>{s.title}</span>
                </div>
              ))}
            </div>

            {/* Content */}
            <div style={{ padding:"clamp(24px,3vw,40px)" }}>
              <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", background:`${app.color}12`, borderRadius:"99px", padding:"4px 12px", marginBottom:"16px" }}>
                <span style={{ fontSize:"10px", fontWeight:800, color:app.color, letterSpacing:"0.1em", textTransform:"uppercase" }}>Step {step+1} of {app.sections.length}</span>
              </div>
              <h2 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(20px,2.5vw,28px)", fontWeight:800, marginBottom:"12px" }}>{section.title}</h2>
              <p style={{ fontSize:"clamp(13px,1.4vw,15px)", color:C.gray, lineHeight:1.8, marginBottom:"clamp(20px,2.5vw,28px)" }}>{section.desc}</p>

              {/* Image placeholder */}
              <div style={{ borderRadius:"16px", overflow:"hidden", marginBottom:"clamp(20px,2.5vw,28px)", background:app.bg, padding:"clamp(48px,8vw,80px) clamp(20px,3vw,32px)", textAlign:"center" }}>
                <div style={{ fontSize:"clamp(32px,4vw,48px)", marginBottom:"10px" }}>📸</div>
                <div style={{ fontSize:"clamp(12px,1.3vw,14px)", color:C.gray, fontWeight:500 }}>Screenshot / image for this step</div>
                <div style={{ fontSize:"11px", color:"#aaa", marginTop:"4px" }}>Uploaded via Admin Dashboard</div>
              </div>

              {/* Navigation */}
              <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
                <button onClick={() => setStep(i => Math.max(0, i-1))} disabled={step===0}
                  style={{ background:"transparent", border:`1.5px solid #e0e0e0`, borderRadius:"99px", padding:"clamp(9px,1.2vw,12px) clamp(18px,2.5vw,24px)", cursor:step===0?"not-allowed":"pointer", fontSize:"clamp(12px,1.3vw,14px)", fontWeight:600, color:step===0?"#ccc":C.dark, fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" }}>← Previous</button>
                <button onClick={() => setStep(i => Math.min(app.sections.length-1, i+1))} disabled={step===app.sections.length-1}
                  style={{ background:step===app.sections.length-1?"#e0e0e0":`linear-gradient(135deg, ${app.color}, ${app.color}cc)`, border:"none", borderRadius:"99px", padding:"clamp(9px,1.2vw,12px) clamp(18px,2.5vw,24px)", cursor:step===app.sections.length-1?"not-allowed":"pointer", fontSize:"clamp(12px,1.3vw,14px)", fontWeight:700, color:"white", fontFamily:"'DM Sans',sans-serif", boxShadow:step===app.sections.length-1?"none":`0 6px 20px ${app.color}35`, transition:"all 0.2s" }}>Next →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } @media(max-width:600px) { [style*="grid-template-columns: clamp(200px"] { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}