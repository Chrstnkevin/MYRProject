"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { LandingTutorial, TutorialImprovement, TutorialStep } from "@/lib/types"
import LandingNav from "../components/LandingNav"

/* ─── Types ─────────────────────────────────────────────────── */
interface TutorialApp {
  id: string
  appName: string
  emoji: string
  improvements: TutorialImprovement[]
}

function fromDB(row: LandingTutorial): TutorialApp {
  return { id: row.app_id, appName: row.app_name, emoji: row.emoji, improvements: row.improvements ?? [] }
}

const APP_STYLES: Record<string, { color: string; light: string; grad: string }> = {
  "matrix":      { color: "#7C3AED", light: "#EDE9FE", grad: "linear-gradient(135deg,#7C3AED,#A855F7)" },
  "sfa":         { color: "#E8381A", light: "#FEF0ED", grad: "linear-gradient(135deg,#E8381A,#F97316)" },
  "ficom":       { color: "#FB8C00", light: "#FFF3E0", grad: "linear-gradient(135deg,#FB8C00,#FFA726)" },
  "ficom-lite":  { color: "#1E88E5", light: "#E3F2FD", grad: "linear-gradient(135deg,#1E88E5,#42A5F5)" },
}
const gs = (appId: string) => APP_STYLES[appId] ?? { color: "#6B7280", light: "#F4F4F2", grad: "linear-gradient(135deg,#6B7280,#9CA3AF)" }

/* ════════════════════════════════════════════════════
   PART 1 — SELECTOR PAGE (no ?app param)
════════════════════════════════════════════════════ */
function AppCard({ app, idx }: { app: TutorialApp; idx: number }) {
  const [hovered, setHovered] = useState(false)
  const s = gs(app.id)
  const totalSteps = app.improvements.reduce((n, imp) => n + (imp.steps?.length ?? 0), 0)
  const totalImps  = app.improvements.length

  return (
    <a
      href={`/landing/tutorials?app=${app.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: "white", borderRadius: 24, overflow: "hidden",
        border: `1.5px solid ${hovered ? s.color + "40" : "rgba(0,0,0,0.07)"}`,
        boxShadow: hovered ? `0 20px 48px ${s.color}18, 0 4px 16px rgba(0,0,0,0.06)` : "0 2px 12px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-6px)" : "none",
        transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
        animationDelay: `${idx * 0.08}s`,
        animation: "card-in 0.45s ease both",
      }}>
        {/* Color header */}
        <div style={{ background: s.light, padding: "28px 28px 22px", position: "relative", overflow: "hidden" }}>
          <div style={{
            position: "absolute", right: -24, top: -24, width: 100, height: 100,
            borderRadius: "50%", background: s.grad, opacity: hovered ? 0.18 : 0.10,
            transform: hovered ? "scale(1.4)" : "scale(1)", transition: "all 0.5s ease",
          }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{
                fontSize: 44, display: "block",
                filter: hovered ? "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" : "none",
                transform: hovered ? "scale(1.1)" : "scale(1)",
                transition: "all 0.3s",
              }}>{app.emoji}</span>
              <div style={{
                background: s.grad, color: "white", borderRadius: 99,
                padding: "4px 12px", fontSize: 11, fontWeight: 700,
                boxShadow: `0 4px 12px ${s.color}30`,
                whiteSpace: "nowrap",
              }}>
                {totalImps > 0 ? `${totalImps} Improvement` : "Segera Hadir"}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111", fontFamily: "'Bricolage Grotesque',sans-serif", marginBottom: 6 }}>
              {app.appName}
            </div>
            {totalSteps > 0 && (
              <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>
                {totalSteps} langkah tersedia
              </div>
            )}
          </div>
        </div>

        {/* Improvement list */}
        <div style={{ padding: "16px 28px" }}>
          {totalImps > 0 ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#D1D5DB", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                Materi Tersedia
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {app.improvements.slice(0, 4).map((imp, j) => (
                  <div key={imp.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                      background: hovered ? s.grad : "#E5E7EB",
                      color: hovered ? "white" : "#9CA3AF",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 800, transition: "all 0.3s",
                      transitionDelay: `${j * 0.05}s`,
                    }}>{j + 1}</div>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imp.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>
                      {imp.steps?.length ?? 0} langkah
                    </span>
                  </div>
                ))}
                {app.improvements.length > 4 && (
                  <div style={{ fontSize: 12, color: "#9CA3AF", paddingLeft: 26 }}>
                    +{app.improvements.length - 4} improvement lainnya
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#9CA3AF", fontSize: 13 }}>
              Konten belum ditambahkan
            </div>
          )}
        </div>

        {/* CTA */}
        <div style={{ padding: "0 28px 28px" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            background: hovered ? s.grad : s.light,
            color: hovered ? "white" : s.color,
            padding: "12px 20px", borderRadius: 14,
            fontSize: 14, fontWeight: 700,
            transition: "all 0.3s",
            boxShadow: hovered ? `0 8px 24px ${s.color}35` : "none",
            border: `1.5px solid ${hovered ? "transparent" : s.color + "30"}`,
          }}>
            {totalImps > 0 ? (hovered ? "Mulai Tutorial →" : `📖 Buka ${app.appName}`) : "Segera Hadir"}
          </div>
        </div>
      </div>
    </a>
  )
}

function SelectorPage({ apps, loading }: { apps: TutorialApp[]; loading: boolean }) {
  useEffect(() => {
    const l = document.createElement("link"); l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600;700&display=swap"
    document.head.appendChild(l)
  }, [])

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", minHeight: "100vh", background: "white" }}>
      <LandingNav />

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg,#FEF0ED,#FFF8F5,#F8F4FF,white)",
        padding: "clamp(100px,12vw,140px) clamp(20px,5vw,80px) clamp(48px,6vw,72px)",
        textAlign: "center",
      }}>
        <div style={{ display: "inline-block", background: "#E8381A12", borderRadius: 99, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: "#E8381A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
          📖 Tutorial System
        </div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(34px,6vw,64px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 16, color: "#111" }}>
          Pilih Aplikasi<br /><span style={{ color: "#E8381A" }}>yang Ingin Dipelajari</span>
        </h1>
        <p style={{ fontSize: "clamp(14px,1.6vw,17px)", color: "#6B7280", lineHeight: 1.8, maxWidth: 480, margin: "0 auto" }}>
          Tutorial interaktif step-by-step untuk setiap aplikasi — pilih satu dan mulai belajar.
        </p>
      </div>

      {/* App grid */}
      <div style={{ padding: "clamp(40px,6vw,72px) clamp(20px,5vw,80px) clamp(60px,8vw,100px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0", gap: 12, alignItems: "center", color: "#9CA3AF" }}>
              <div style={{ width: 28, height: 28, border: "3px solid #E5E7EB", borderTopColor: "#9CA3AF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Memuat tutorial...
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
              gap: "clamp(16px,2.5vw,24px)",
            }}>
              {apps.map((app, i) => <AppCard key={app.id} app={app} idx={i} />)}
            </div>
          )}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes card-in { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   PART 2 — VIEWER (with ?app=xxx param)
════════════════════════════════════════════════════ */
function Placeholder({ imageUrl, emoji, color, light }: { imageUrl:string; emoji:string; color:string; light:string }) {
  const [t, setT] = useState(0)
  useEffect(() => {
    if (imageUrl) return
    const id = setInterval(() => setT(v => v + 1), 60)
    return () => clearInterval(id)
  }, [imageUrl])

  if (imageUrl) return (
    <div style={{ flex:1, minHeight:0, borderRadius:16, overflow:"hidden" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imageUrl} alt="Tutorial screenshot" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
    </div>
  )

  const p = 0.72 + Math.sin(t * 0.11) * 0.14
  return (
    <div style={{ flex:1, minHeight:0, borderRadius:16, background:light, border:`2px solid ${color}18`, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", position:"relative", overflow:"hidden", gap:12 }}>
      <div style={{ position:"absolute", width:180, height:180, borderRadius:"50%", background:color, opacity:0.06*p, top:-40, right:-40, transform:`scale(${p})`, transition:"all 0.06s linear" }} />
      <div style={{ position:"absolute", width:100, height:100, borderRadius:"50%", background:color, opacity:0.04, bottom:20, left:20 }} />
      <div style={{ background:"white", borderRadius:12, boxShadow:`0 8px 28px ${color}20`, width:"min(300px,70%)", zIndex:1 }}>
        <div style={{ background:"#f0f0f0", padding:"6px 10px", display:"flex", gap:4, borderRadius:"12px 12px 0 0" }}>
          {["#FF5F57","#FFC22A","#29CB40"].map((c,i) => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:c }} />)}
          <div style={{ flex:1, height:12, borderRadius:3, background:"white", marginLeft:6 }} />
        </div>
        <div style={{ padding:"12px 12px 14px", display:"flex", flexDirection:"column", gap:7 }}>
          <div style={{ height:9, borderRadius:3, background:`${color}40`, width:"58%" }} />
          <div style={{ height:7, borderRadius:3, background:"#f0f0f0", width:"88%" }} />
          <div style={{ height:7, borderRadius:3, background:"#f0f0f0", width:"70%" }} />
          <div style={{ height:26, borderRadius:6, background:color, width:"42%", marginTop:4, opacity:p, transition:"opacity 0.06s linear" }} />
        </div>
      </div>
      <div style={{ zIndex:1, textAlign:"center" }}>
        <div style={{ fontSize:22, marginBottom:3 }}>{emoji}</div>
        <div style={{ fontSize:11, color, fontWeight:600, opacity:0.8 }}>Screenshot tersedia via Admin Dashboard</div>
      </div>
    </div>
  )
}

function SlideView({ children, id, dir }: { children: React.ReactNode; id: string; dir: "fwd"|"back" }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    setShow(false)
    const t = setTimeout(() => setShow(true), 16)
    return () => clearTimeout(t)
  }, [id])
  return (
    <div style={{
      flex:1, minHeight:0, display:"flex", flexDirection:"column",
      opacity: show ? 1 : 0,
      transform: show ? "translateX(0)" : `translateX(${dir==="fwd"?40:-40}px)`,
      transition: "opacity 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)",
    }}>{children}</div>
  )
}

function ViewerPage({ app }: { app: TutorialApp }) {
  const [impIdx, setImpIdx]   = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const [dir, setDir]         = useState<"fwd"|"back">("fwd")
  const [dropOpen, setDropOpen]     = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const wheelLock = useRef(false)
  const inTransit = useRef(false)

  const s    = gs(app.id)
  const imps = app.improvements
  const imp  = imps[impIdx]
  const step = imp?.steps?.[stepIdx]
  const totalSteps = imp?.steps?.length ?? 0
  const prog = totalSteps ? ((stepIdx+1)/totalSteps)*100 : 0

  const goStep = useCallback((next: number) => {
    if (inTransit.current || next === stepIdx || next < 0 || next >= totalSteps) return
    inTransit.current = true
    setDir(next > stepIdx ? "fwd" : "back")
    setStepIdx(next)
    setTimeout(() => { inTransit.current = false }, 340)
  }, [stepIdx, totalSteps])

  const goImp = useCallback((i: number) => {
    if (i === impIdx) { setDropOpen(false); return }
    setDropOpen(false); setDir("fwd"); setImpIdx(i); setStepIdx(0)
  }, [impIdx])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (wheelLock.current) return
    wheelLock.current = true
    setTimeout(() => { wheelLock.current = false }, 650)
    if (e.deltaY > 20) goStep(stepIdx+1)
    if (e.deltaY < -20) goStep(stepIdx-1)
  }, [stepIdx, goStep])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (["ArrowDown","ArrowRight"].includes(e.key)) goStep(stepIdx+1)
      if (["ArrowUp","ArrowLeft"].includes(e.key))    goStep(stepIdx-1)
      if (e.key === "Escape") { setDropOpen(false); setDrawerOpen(false) }
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [stepIdx, goStep])

  const ty = useRef<number|null>(null)
  const onTS = (e: React.TouchEvent) => { ty.current = e.touches[0].clientY }
  const onTE = (e: React.TouchEvent) => {
    if (ty.current===null) return
    const d = ty.current - e.changedTouches[0].clientY
    if (Math.abs(d)>44) d>0 ? goStep(stepIdx+1) : goStep(stepIdx-1)
    ty.current = null
  }

  useEffect(() => {
    if (!dropOpen) return
    const fn = () => setDropOpen(false)
    setTimeout(() => window.addEventListener("click", fn), 0)
    return () => window.removeEventListener("click", fn)
  }, [dropOpen])

  if (!imp || !step) return (
    <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#FAFAFA", flexDirection:"column", gap:12, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:32 }}>📭</div>
      <div style={{ fontSize:14, fontWeight:600, color:"#374151" }}>Improvement ini belum memiliki langkah</div>
      <a href="/landing/tutorials" style={{ fontSize:13, color:"#E8381A", fontWeight:600 }}>← Kembali</a>
    </div>
  )

  return (
    <div onWheel={onWheel} onTouchStart={onTS} onTouchEnd={onTE}
      style={{ fontFamily:"'DM Sans',sans-serif", position:"fixed", inset:0, display:"flex", flexDirection:"column", background:"#FAFAFA", userSelect:"none" }}>

      {/* Topbar */}
      <div style={{ height:54, flexShrink:0, background:"white", borderBottom:"1px solid rgba(0,0,0,0.07)", display:"flex", alignItems:"center", padding:"0 16px", gap:10, zIndex:20 }}>
        <a href="/landing/tutorials" style={{ fontSize:13, fontWeight:600, color:"#9CA3AF", textDecoration:"none", padding:"5px 9px", borderRadius:8, transition:"all 0.15s" }}
          onMouseEnter={e=>{e.currentTarget.style.background="#F4F4F2";e.currentTarget.style.color="#111"}}
          onMouseLeave={e=>{e.currentTarget.style.background="transparent";e.currentTarget.style.color="#9CA3AF"}}>
          ←
        </a>
        <div style={{ display:"flex", alignItems:"center", gap:6, padding:"5px 10px", borderRadius:8, background:s.light, border:`1px solid ${s.color}25` }}>
          <span style={{ fontSize:15 }}>{app.emoji}</span>
          <span style={{ fontSize:13, fontWeight:700, color:s.color }}>{app.appName}</span>
        </div>
        <div style={{ width:1, height:20, background:"rgba(0,0,0,0.1)" }} />

        {/* Mobile hamburger */}
        <button id="ham-btn" onClick={() => setDrawerOpen(v=>!v)} style={{ background:"none", border:"1px solid rgba(0,0,0,0.1)", borderRadius:8, padding:"5px 10px", cursor:"pointer", fontSize:12, fontWeight:600, color:"#6B7280", display:"none", alignItems:"center", gap:5 }}>
          ☰ Langkah
        </button>
        <div id="mob-prog" style={{ flex:1, height:4, background:"#E5E7EB", borderRadius:99, overflow:"hidden", display:"none" }}>
          <div style={{ height:"100%", width:`${prog}%`, background:s.grad, borderRadius:99, transition:"width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
        </div>

        <div style={{ flex:1 }} />
        <span id="imp-label" style={{ fontSize:12, color:"#9CA3AF" }}>Improvement:</span>

        {/* Improvement dropdown */}
        <div style={{ position:"relative" }} onClick={e=>e.stopPropagation()}>
          <button onClick={()=>setDropOpen(v=>!v)} style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:10, border:`1.5px solid ${s.color}35`, background:s.light, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, color:s.color, transition:"all 0.2s", whiteSpace:"nowrap", maxWidth:"clamp(160px,30vw,340px)" }}>
            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{imp.name}</span>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" style={{ flexShrink:0, transform:dropOpen?"rotate(180deg)":"none", transition:"transform 0.2s" }}>
              <path d="M2 4l4 4 4-4" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {dropOpen && (
            <div style={{ position:"absolute", top:"calc(100% + 8px)", right:0, background:"white", borderRadius:14, border:"1px solid rgba(0,0,0,0.09)", boxShadow:"0 16px 48px rgba(0,0,0,0.13)", overflow:"hidden", zIndex:50, minWidth:"clamp(220px,35vw,400px)", animation:"dd-in 0.15s ease" }}>
              <div style={{ padding:"10px 14px 8px", borderBottom:"1px solid rgba(0,0,0,0.06)", fontSize:10, fontWeight:800, color:"#9CA3AF", textTransform:"uppercase", letterSpacing:"0.1em" }}>
                {imps.length} Improvement — {app.appName}
              </div>
              {imps.map((im, i) => (
                <button key={im.id} onClick={()=>goImp(i)} style={{ display:"flex", alignItems:"center", gap:11, width:"100%", padding:"12px 14px", border:"none", cursor:"pointer", textAlign:"left", background:i===impIdx?s.light:"white", borderLeft:i===impIdx?`3px solid ${s.color}`:"3px solid transparent", fontFamily:"inherit", transition:"background 0.15s" }}
                  onMouseEnter={e=>{if(i!==impIdx)e.currentTarget.style.background="#F9FAFB"}}
                  onMouseLeave={e=>{if(i!==impIdx)e.currentTarget.style.background="white"}}>
                  <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background:i===impIdx?s.color:"#E5E7EB", color:i===impIdx?"white":"#9CA3AF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800 }}>{i+1}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13, fontWeight:i===impIdx?700:500, color:i===impIdx?s.color:"#111" }}>{im.name}</div>
                    <div style={{ fontSize:11, color:"#9CA3AF", marginTop:1 }}>{im.steps?.length??0} langkah</div>
                  </div>
                  {i===impIdx && <div style={{ fontSize:11, fontWeight:700, color:s.color, background:`${s.color}15`, borderRadius:99, padding:"2px 8px", whiteSpace:"nowrap" }}>Aktif ✓</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, display:"flex", overflow:"hidden", position:"relative", minHeight:0 }}>
        {drawerOpen && <div onClick={()=>setDrawerOpen(false)} style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.4)", zIndex:30, backdropFilter:"blur(2px)", animation:"fade-in 0.2s ease" }} />}

        {/* Sidebar */}
        <div id="sidebar" style={{ width:248, flexShrink:0, background:"white", borderRight:"1px solid rgba(0,0,0,0.07)", display:"flex", flexDirection:"column", overflow:"hidden", zIndex:31 }}>
          <div style={{ padding:"14px 16px 10px", flexShrink:0 }}>
            <div style={{ background:s.light, borderRadius:10, padding:"9px 12px", border:`1px solid ${s.color}20` }}>
              <div style={{ fontSize:10, fontWeight:700, color:s.color, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:2 }}>Improvement {impIdx+1} dari {imps.length}</div>
              <div style={{ fontSize:13, fontWeight:700, color:"#111", lineHeight:1.3 }}>{imp.name}</div>
            </div>
          </div>
          <div style={{ padding:"0 16px 8px", fontSize:10, fontWeight:800, color:"#D1D5DB", letterSpacing:"0.12em", textTransform:"uppercase", flexShrink:0 }}>Langkah-Langkah</div>
          <div style={{ flex:1, overflowY:"auto", minHeight:0 }}>
            {imp.steps?.map((st, i) => {
              const active=i===stepIdx, past=i<stepIdx
              return (
                <div key={st.id} onClick={()=>{ goStep(i); setDrawerOpen(false) }}
                  style={{ display:"flex", alignItems:"center", gap:10, padding:"11px 16px", background:active?s.light:"transparent", borderRight:active?`3px solid ${s.color}`:"3px solid transparent", borderLeft:"3px solid transparent", cursor:"pointer", transition:"all 0.2s" }}
                  onMouseEnter={e=>{if(!active)e.currentTarget.style.background="#F9FAFB"}}
                  onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent"}}>
                  <div style={{ width:26, height:26, borderRadius:"50%", flexShrink:0, background:active?s.color:past?`${s.color}25`:"#E5E7EB", color:active?"white":past?s.color:"#9CA3AF", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:800, transition:"all 0.3s", boxShadow:active?`0 4px 12px ${s.color}35`:"none" }}>
                    {past?"✓":i+1}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, fontWeight:active?700:400, color:active?"#111":"#4B5563", lineHeight:1.35, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{st.title}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding:"12px 16px 14px", borderTop:"1px solid rgba(0,0,0,0.06)", flexShrink:0 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
              <span style={{ fontSize:11, color:"#9CA3AF" }}>Progress</span>
              <span style={{ fontSize:11, fontWeight:700, color:s.color }}>{Math.round(prog)}%</span>
            </div>
            <div style={{ height:5, background:"#E5E7EB", borderRadius:99, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${prog}%`, background:s.grad, borderRadius:99, transition:"width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
            </div>
            <div style={{ fontSize:10, color:"#D1D5DB", textAlign:"center", marginTop:6 }}>Scroll / ↑↓ / swipe untuk navigasi</div>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minHeight:0 }}>
          <div style={{ height:3, flexShrink:0, background:s.grad, width:`${prog}%`, transition:"width 0.4s cubic-bezier(0.4,0,0.2,1)", alignSelf:"flex-start" }} />
          <div style={{ flex:1, minHeight:0, display:"flex", flexDirection:"column", padding:"clamp(14px,2.5vh,28px) clamp(16px,3vw,48px) clamp(10px,2vh,20px)", overflow:"hidden" }}>
            <SlideView id={`${impIdx}-${stepIdx}`} dir={dir}>
              {/* Badge + dots */}
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", marginBottom:"clamp(8px,1.5vh,14px)", flexShrink:0 }}>
                <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:s.light, borderRadius:99, padding:"4px 11px", border:`1px solid ${s.color}22` }}>
                  <div style={{ width:5, height:5, borderRadius:"50%", background:s.color }} />
                  <span style={{ fontSize:10, fontWeight:800, color:s.color, letterSpacing:"0.08em", textTransform:"uppercase" }}>Langkah {stepIdx+1} / {totalSteps}</span>
                </div>
                <div style={{ display:"flex", gap:5 }}>
                  {imp.steps?.map((_,i) => (
                    <div key={i} onClick={()=>goStep(i)} style={{ height:6, width:i===stepIdx?20:6, borderRadius:99, background:i===stepIdx?s.color:i<stepIdx?`${s.color}45`:"#E5E7EB", cursor:"pointer", transition:"all 0.35s cubic-bezier(0.4,0,0.2,1)" }} />
                  ))}
                </div>
              </div>
              {/* Title */}
              <h1 style={{ fontFamily:"'Bricolage Grotesque',sans-serif", fontSize:"clamp(18px,3.2vh,34px)", fontWeight:900, lineHeight:1.1, letterSpacing:"-0.025em", color:"#111", marginBottom:"clamp(6px,1vh,10px)", flexShrink:0 }}>{step.title}</h1>
              <p style={{ fontSize:"clamp(12px,1.8vh,15px)", color:"#6B7280", lineHeight:1.7, marginBottom:"clamp(8px,1.5vh,16px)", flexShrink:0, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>{step.desc}</p>
              {/* Placeholder */}
              <Placeholder imageUrl={step.imageUrl} emoji={app.emoji} color={s.color} light={s.light} />
              {/* Nav */}
              <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", flexShrink:0, marginTop:"clamp(8px,1.5vh,16px)" }}>
                <button onClick={()=>goStep(stepIdx-1)} disabled={stepIdx===0} style={{ padding:"8px 18px", borderRadius:99, border:"1.5px solid #E5E7EB", background:"white", cursor:stepIdx===0?"not-allowed":"pointer", fontSize:13, fontWeight:600, color:stepIdx===0?"#D1D5DB":"#374151", fontFamily:"inherit", transition:"all 0.2s" }}
                  onMouseEnter={e=>{if(stepIdx>0){e.currentTarget.style.background="#F9FAFB";e.currentTarget.style.borderColor="#9CA3AF"}}}
                  onMouseLeave={e=>{e.currentTarget.style.background="white";e.currentTarget.style.borderColor="#E5E7EB"}}>← Sebelumnya</button>
                {stepIdx < totalSteps-1 ? (
                  <button onClick={()=>goStep(stepIdx+1)} style={{ padding:"8px 20px", borderRadius:99, background:s.grad, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:"white", fontFamily:"inherit", boxShadow:`0 5px 18px ${s.color}30`, transition:"all 0.2s" }}
                    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 9px 24px ${s.color}40`}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 5px 18px ${s.color}30`}}>Selanjutnya →</button>
                ) : impIdx < imps.length-1 ? (
                  <button onClick={()=>goImp(impIdx+1)} style={{ padding:"8px 20px", borderRadius:99, background:s.grad, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:"white", fontFamily:"inherit", boxShadow:`0 5px 18px ${s.color}30`, transition:"all 0.2s" }}>Improvement Berikutnya →</button>
                ) : (
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={()=>{setImpIdx(0);setStepIdx(0)}} style={{ padding:"8px 16px", borderRadius:99, background:s.light, border:`1.5px solid ${s.color}35`, cursor:"pointer", fontSize:13, fontWeight:700, color:s.color, fontFamily:"inherit" }}>🔄 Ulang</button>
                    <a href="/landing/tutorials" style={{ padding:"8px 16px", borderRadius:99, background:"#F4F4F2", border:"1.5px solid #E5E7EB", textDecoration:"none", fontSize:13, fontWeight:700, color:"#6B7280", fontFamily:"inherit", display:"inline-flex", alignItems:"center" }}>✅ Selesai</a>
                  </div>
                )}
                <span style={{ marginLeft:"auto", fontSize:12, color:"#D1D5DB" }}>{stepIdx+1}/{totalSteps}</span>
              </div>
            </SlideView>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div id="mob-nav" style={{ display:"none", borderTop:"1px solid rgba(0,0,0,0.08)", background:"white", padding:"10px 14px", flexDirection:"row", gap:8, alignItems:"center", flexShrink:0, zIndex:19 }}>
        <button onClick={()=>goStep(stepIdx-1)} disabled={stepIdx===0} style={{ flex:1, padding:"10px", borderRadius:12, border:"1.5px solid #E5E7EB", background:"white", cursor:stepIdx===0?"not-allowed":"pointer", fontSize:13, fontWeight:600, color:stepIdx===0?"#D1D5DB":"#374151", fontFamily:"inherit" }}>← Prev</button>
        <button onClick={()=>setDrawerOpen(true)} style={{ padding:"10px 12px", borderRadius:12, border:`1.5px solid ${s.color}30`, background:s.light, cursor:"pointer", fontSize:13, fontWeight:700, color:s.color, fontFamily:"inherit", whiteSpace:"nowrap" }}>{stepIdx+1}/{totalSteps}</button>
        {stepIdx<totalSteps-1 ? (
          <button onClick={()=>goStep(stepIdx+1)} style={{ flex:1, padding:"10px", borderRadius:12, background:s.grad, border:"none", cursor:"pointer", fontSize:13, fontWeight:700, color:"white", fontFamily:"inherit", boxShadow:`0 4px 14px ${s.color}30` }}>Next →</button>
        ) : (
          <a href="/landing/tutorials" style={{ flex:1, padding:"10px", borderRadius:12, background:s.light, border:`1.5px solid ${s.color}30`, textDecoration:"none", fontSize:13, fontWeight:700, color:s.color, fontFamily:"inherit", textAlign:"center" }}>✅ Done</a>
        )}
      </div>

      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes dd-in   { from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:none;} }
        @keyframes fade-in { from{opacity:0;}to{opacity:1;} }
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#E5E7EB;border-radius:4px;}
        @media(max-width:768px){
          #sidebar{position:absolute!important;top:0;left:0;bottom:0;transform:${drawerOpen?"translateX(0)":"translateX(-100%)"};box-shadow:4px 0 24px rgba(0,0,0,0.14);transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);}
          #ham-btn{display:flex!important;}
          #mob-prog{display:block!important;}
          #mob-nav{display:flex!important;}
          #imp-label{display:none!important;}
        }
        @media(min-width:769px){
          #sidebar{transform:none!important;transition:none!important;}
        }
      `}</style>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   ROOT — decides which view to show
════════════════════════════════════════════════════ */
export default function TutorialsPage() {
  const [apps, setApps]     = useState<TutorialApp[]>([])
  const [loading, setLoading] = useState(true)
  const [appParam, setAppParam] = useState<string | null>(null)

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("app")
    setAppParam(param)
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from("landing_tutorials")
        .select("*")
        .order("app_id")
      if (!error && data) setApps((data as LandingTutorial[]).map(fromDB))
      setLoading(false)
    }
    load()

    const l = document.createElement("link"); l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600;700&display=swap"
    document.head.appendChild(l)
  }, [])

  // Show selector if no ?app param
  if (!appParam) return <SelectorPage apps={apps} loading={loading} />

  // Show loading spinner while fetching
  if (loading) return (
    <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#FAFAFA", flexDirection:"column", gap:12, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ width:36, height:36, border:"3px solid #E5E7EB", borderTopColor:"#6B7280", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <div style={{ fontSize:13, color:"#9CA3AF" }}>Memuat tutorial...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  )

  const app = apps.find(a => a.id === appParam || a.appName.toLowerCase() === appParam.toLowerCase())

  if (!app) return (
    <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#FAFAFA", flexDirection:"column", gap:12, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:32 }}>🔍</div>
      <div style={{ fontSize:14, fontWeight:600, color:"#374151" }}>Aplikasi tidak ditemukan</div>
      <a href="/landing/tutorials" style={{ fontSize:13, color:"#E8381A", fontWeight:600 }}>← Kembali ke Tutorials</a>
    </div>
  )

  // If app has no improvements yet, show empty state on selector
  if (!app.improvements || app.improvements.length === 0) return (
    <div style={{ position:"fixed", inset:0, display:"flex", alignItems:"center", justifyContent:"center", background:"#FAFAFA", flexDirection:"column", gap:12, fontFamily:"'DM Sans',sans-serif" }}>
      <div style={{ fontSize:40 }}>{app.emoji}</div>
      <div style={{ fontSize:16, fontWeight:700, color:"#374151" }}>{app.appName}</div>
      <div style={{ fontSize:13, color:"#9CA3AF" }}>Konten tutorial belum ditambahkan</div>
      <div style={{ fontSize:12, color:"#D1D5DB", marginTop:4 }}>Tambahkan melalui Dashboard → Tutorials Admin</div>
      <a href="/landing/tutorials" style={{ marginTop:8, fontSize:13, color:"#E8381A", fontWeight:600 }}>← Pilih Aplikasi Lain</a>
    </div>
  )

  return <ViewerPage app={app} />
}