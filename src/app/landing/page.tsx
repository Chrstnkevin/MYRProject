"use client"
import PasswordGate from "./PasswordGate"
import LandingNav from "./components/LandingNav"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { LandingTutorial, LandingInfographic } from "@/lib/types"

const C = {
  primary: "#E8381A",
  primaryLight: "#FF6B4A",
  primaryDark: "#C02E12",
  accent: "#FFB800",
  dark: "#111111",
  gray: "#6B7280",
  grayLight: "#F4F4F2",
  white: "#FFFFFF",
  border: "rgba(0,0,0,0.08)",
}

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.15) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if(!ref.current) return
    const obs = new IntersectionObserver(([e]) => {
      if(e.isIntersecting) {
        setInView(true)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const anime = (window as any).anime
        if(anime && e.target.getAttribute("data-anime")) {
          const targets = e.target.querySelectorAll("[data-stagger]")
          if(targets.length > 0) {
            anime({ targets, translateY:[30,0], opacity:[0,1], delay:anime.stagger(80), duration:700, easing:"easeOutExpo" })
          }
        }
      }
    }, { threshold })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref, threshold])
  return inView
}

// ── Hero ──────────────────────────────────────────────────────
function Hero() {
  const [typed, setTyped]   = useState("")
  const words = ["Efficiency","Clarity","Growth","Excellence"]
  const [wi,   setWi]   = useState(0)
  const [ci,   setCi]   = useState(0)
  const [del,  setDel]  = useState(false)
  const [mounted, setMounted] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    // Anime.js hero entrance
    const tryAnimate = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anime = (window as any).anime
      if(!anime) { setTimeout(tryAnimate, 100); return }
      anime({
        targets: ".hero-content",
        translateY: [40, 0], opacity: [0, 1],
        duration: 900, easing: "easeOutExpo",
      })
      anime({
        targets: ".hero-btn",
        translateY: [20, 0], opacity: [0, 1],
        delay: anime.stagger(100, { start: 400 }),
        duration: 700, easing: "easeOutBack",
      })
      anime({
        targets: ".floating-card",
        translateY: [30, 0], opacity: [0, 1],
        delay: anime.stagger(150, { start: 600 }),
        duration: 700, easing: "easeOutBack",
      })
      // Continuous float for cards after entrance
      setTimeout(() => {
        document.querySelectorAll(".floating-card").forEach((el, i) => {
          anime({
            targets: el,
            translateY: [0, -10, 0],
            loop: true,
            duration: 3000 + i * 500,
            easing: "easeInOutSine",
            delay: i * 400,
          })
        })
      }, 1200)
    }
    tryAnimate()
  }, [])

  useEffect(() => {
    const w = words[wi]
    const t = setTimeout(() => {
      if(!del){
        if(ci<w.length){ setTyped(w.slice(0,ci+1)); setCi(c=>c+1) }
        else setTimeout(()=>setDel(true), 1800)
      } else {
        if(ci>0){ setTyped(w.slice(0,ci-1)); setCi(c=>c-1) }
        else { setDel(false); setWi(i=>(i+1)%words.length) }
      }
    }, del?55:85)
    return () => clearTimeout(t)
  },[ci,del,wi])

  return (
    <section id="hero" ref={heroRef} style={{minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"100px clamp(20px,5vw,80px) 60px",position:"relative",overflow:"hidden",background:`radial-gradient(ellipse 80% 50% at 50% 0%, ${C.primary}12 0%, transparent 65%), #FAFAF8`}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(circle, ${C.dark}08 1px, transparent 1px)`,backgroundSize:"28px 28px",maskImage:"radial-gradient(ellipse 70% 70% at 50% 50%, black 40%, transparent 100%)",pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:"8%",right:"5%",width:"clamp(180px,25vw,380px)",height:"clamp(180px,25vw,380px)",borderRadius:"50%",background:`radial-gradient(circle,${C.primary}18,transparent 70%)`,filter:"blur(40px)",animation:"float 8s ease-in-out infinite",pointerEvents:"none"}}/>
      <div style={{position:"absolute",bottom:"10%",left:"5%",width:"clamp(150px,20vw,300px)",height:"clamp(150px,20vw,300px)",borderRadius:"50%",background:`radial-gradient(circle,${C.accent}15,transparent 70%)`,filter:"blur(40px)",animation:"floatR 10s ease-in-out infinite",pointerEvents:"none"}}/>

      {mounted && (
        <div className="floating-cards">
          {[
            {emoji:"📊",label:"SFA Dashboard",sub:"98.2% uptime",color:"#E8F5E9",accent:"#43A047",x:"4%",y:"25%"},
            {emoji:"💰",label:"Ficom Module",sub:"Live tracking",color:"#FFF3E0",accent:"#FB8C00",x:"78%",y:"20%"},
            {emoji:"🎯",label:"Target Hit",sub:"↑ 24% this month",color:"#FCE4EC",accent:"#E91E63",x:"80%",y:"65%"},
          ].map((card,i)=>(
            <div key={i} className="floating-card" style={{position:"absolute",left:card.x,top:card.y,background:"white",borderRadius:"16px",padding:"12px 16px",boxShadow:"0 8px 32px rgba(0,0,0,0.09)",border:`1.5px solid ${card.color}`,opacity:0,minWidth:"150px",zIndex:2,display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"36px",height:"36px",borderRadius:"10px",background:card.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px",flexShrink:0}}>{card.emoji}</div>
              <div>
                <div style={{fontSize:"12px",fontWeight:700}}>{card.label}</div>
                <div style={{fontSize:"11px",color:card.accent,fontWeight:600}}>{card.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="hero-content" style={{textAlign:"center",maxWidth:"720px",position:"relative",zIndex:3,opacity:0}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:"8px",background:`${C.primary}12`,border:`1.5px solid ${C.primary}30`,borderRadius:"99px",padding:"6px 16px",marginBottom:"28px"}}>
          <span style={{width:"7px",height:"7px",borderRadius:"50%",background:C.primary,animation:"pulse 2s infinite",display:"block",flexShrink:0}}/>
          <span style={{fontSize:"13px",fontWeight:600,color:C.primary}}>PHI Team Digital Hub — Mayora Indah</span>
        </div>

        <h1 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(38px,7vw,80px)",fontWeight:900,lineHeight:1.05,letterSpacing:"-0.03em",marginBottom:"20px"}}>
          Drive{" "}
          <span style={{background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
            {typed}<span style={{animation:"blink 1s infinite",WebkitTextFillColor:C.primary}}>|</span>
          </span>
          <br/>with Every Tool
        </h1>

        <p style={{fontSize:"clamp(15px,2vw,18px)",color:C.gray,lineHeight:1.7,maxWidth:"540px",margin:"0 auto 36px"}}>
          Your all-in-one support hub for <strong style={{color:C.dark}}>SFA</strong>, <strong style={{color:C.dark}}>Ficom</strong>, and <strong style={{color:C.dark}}>Ficom Lite</strong> — built to empower the Philippines team with resources and insights.
        </p>

        <div style={{display:"flex",gap:"12px",justifyContent:"center",flexWrap:"wrap"}}>
          <button className="hero-btn" onClick={()=>document.getElementById("applications")?.scrollIntoView({behavior:"smooth"})}
            style={{opacity:0,background:C.primary,border:"none",cursor:"pointer",padding:"clamp(12px,2vw,16px) clamp(24px,4vw,36px)",borderRadius:"99px",fontSize:"clamp(13px,1.5vw,16px)",fontWeight:700,color:"white",boxShadow:`0 8px 24px ${C.primary}40`,transition:"all 0.2s",fontFamily:"'DM Sans',sans-serif"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 12px 32px ${C.primary}55`}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow=`0 8px 24px ${C.primary}40`}}>
            Explore Applications ↓
          </button>
          <button className="hero-btn" onClick={()=>document.getElementById("supporting")?.scrollIntoView({behavior:"smooth"})}
            style={{opacity:0,background:"white",border:`1.5px solid ${C.border}`,cursor:"pointer",padding:"clamp(12px,2vw,16px) clamp(24px,4vw,36px)",borderRadius:"99px",fontSize:"clamp(13px,1.5vw,16px)",fontWeight:500,color:C.dark,transition:"all 0.2s",fontFamily:"'DM Sans',sans-serif",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor=C.primary;e.currentTarget.style.color=C.primary}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.dark}}>
            View Resources →
          </button>
        </div>
      </div>

      <div style={{position:"absolute",bottom:"32px",left:"50%",transform:"translateX(-50%)",display:"flex",flexDirection:"column",alignItems:"center",gap:"6px",animation:"bounce 2s ease-in-out infinite"}}>
        <div style={{fontSize:"11px",color:C.gray,letterSpacing:"0.1em",textTransform:"uppercase",fontWeight:600}}>Scroll</div>
        <div style={{width:"1px",height:"32px",background:`linear-gradient(to bottom,${C.gray},transparent)`}}/>
      </div>
    </section>
  )
}

// ── About ─────────────────────────────────────────────────────
function About() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  return (
    <section id="about" ref={ref} style={{padding:"clamp(60px,10vw,120px) clamp(20px,5vw,80px)",background:C.white}}>
      <div style={{maxWidth:"1100px",margin:"0 auto",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))",gap:"clamp(32px,5vw,80px)",alignItems:"center"}}>
        <div style={{opacity:inView?1:0,transform:inView?"none":"translateX(-30px)",transition:"all 0.7s ease"}}>
          <div style={{display:"inline-block",background:`${C.primary}12`,borderRadius:"99px",padding:"5px 16px",fontSize:"12px",fontWeight:700,color:C.primary,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"20px"}}>About This Hub</div>
          <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:800,lineHeight:1.1,letterSpacing:"-0.02em",marginBottom:"20px"}}>
            Built for the{" "}<span style={{color:C.primary}}>Philippines</span>{" "}Support Team
          </h2>
          <p style={{fontSize:"clamp(14px,1.5vw,16px)",color:C.gray,lineHeight:1.8,marginBottom:"16px"}}>
            PHI Support Hub is the central digital platform designed specifically for the Mayora Philippines team — providing real-time access to system resources, utilisation data, and training materials.
          </p>
          <p style={{fontSize:"clamp(14px,1.5vw,16px)",color:C.gray,lineHeight:1.8}}>
            From sales force tracking with <strong style={{color:C.dark}}>SFA</strong> to financial management with <strong style={{color:C.dark}}>Ficom</strong> and mobile operations with <strong style={{color:C.dark}}>Ficom Lite</strong>.
          </p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",opacity:inView?1:0,transform:inView?"none":"translateX(30px)",transition:"all 0.7s 0.2s ease"}}>
          {[
            {icon:"🎯",title:"Goal-Oriented",desc:"Built around team targets and performance metrics"},
            {icon:"📱",title:"Mobile Ready",desc:"Fully responsive — works on any device, anywhere"},
            {icon:"🔄",title:"Always Updated",desc:"Admin team keeps content fresh and relevant"},
            {icon:"🛡️",title:"Secure Access",desc:"Role-based access for team members and admins"},
          ].map((item,i)=>(
            <div key={i} style={{background:C.grayLight,borderRadius:"20px",padding:"clamp(16px,2vw,24px)",transition:"all 0.2s"}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-4px)";e.currentTarget.style.boxShadow="0 12px 32px rgba(0,0,0,0.1)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="none"}}>
              <div style={{fontSize:"clamp(24px,3vw,32px)",marginBottom:"10px"}}>{item.icon}</div>
              <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.5vw,16px)",fontWeight:700,marginBottom:"6px"}}>{item.title}</div>
              <div style={{fontSize:"clamp(12px,1.2vw,13px)",color:C.gray,lineHeight:1.5}}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Applications ──────────────────────────────────────────────
function Applications() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const apps = [
    {emoji:"📊",name:"SFA",full:"Sales Force Automation",color:C.primary,bg:"#FEF0ED",desc:"Track daily visits, monitor outlet targets, and manage sales team performance across all regions in the Philippines.",tags:["Visit Tracking","Target Monitoring","Performance Reports"],stat:{num:"92%",label:"Target Achievement"}},
    {emoji:"💰",name:"Ficom",full:"Finance & Commerce",color:"#FB8C00",bg:"#FFF8F0",desc:"Complete financial transaction management, outlet coverage tracking, and automated period-closing reports.",tags:["Transaction Mgmt","Period Closing","Outlet Coverage"],stat:{num:"99%",label:"Report Accuracy"}},
    {emoji:"📱",name:"Ficom Lite",full:"Mobile Finance",color:"#1E88E5",bg:"#EEF7FF",desc:"Lightweight mobile version of Ficom designed for field agents — with offline capability and fast sync when reconnected.",tags:["Offline Mode","Fast Sync","Mobile First"],stat:{num:"98%",label:"Sync Success"}},
  ]
  return (
    <section id="applications" ref={ref} style={{padding:"clamp(60px,10vw,120px) clamp(20px,5vw,80px)",background:C.grayLight}}>
      <div style={{maxWidth:"1100px",margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"clamp(40px,6vw,64px)",opacity:inView?1:0,transform:inView?"none":"translateY(20px)",transition:"all 0.6s ease"}}>
          <div style={{display:"inline-block",background:`${C.primary}12`,borderRadius:"99px",padding:"5px 16px",fontSize:"12px",fontWeight:700,color:C.primary,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>Our Applications</div>
          <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:800,lineHeight:1.1,letterSpacing:"-0.02em"}}>
            Three Powerful Tools,<br/><span style={{color:C.primary}}>One Unified Hub</span>
          </h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:"clamp(16px,2vw,24px)"}}>
          {apps.map((app,i)=>(
            <div key={i}
              style={{background:C.white,borderRadius:"24px",overflow:"hidden",boxShadow:"0 4px 20px rgba(0,0,0,0.06)",transition:"all 0.3s",opacity:inView?1:0,transform:inView?"none":"translateY(30px)",transitionDelay:`${i*0.1}s`}}
              onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-6px)";e.currentTarget.style.boxShadow="0 20px 48px rgba(0,0,0,0.12)"}}
              onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,0.06)"}}>
              <div style={{background:app.bg,padding:"clamp(24px,3vw,32px)",display:"flex",alignItems:"flex-start",justifyContent:"space-between"}}>
                <div style={{width:"clamp(48px,6vw,64px)",height:"clamp(48px,6vw,64px)",borderRadius:"18px",background:C.white,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"clamp(24px,3vw,32px)",boxShadow:`0 4px 16px ${app.color}20`}}>{app.emoji}</div>
                <div style={{background:app.color,color:"white",fontSize:"clamp(20px,2.5vw,28px)",fontWeight:900,padding:"clamp(8px,1.5vw,14px) clamp(12px,2vw,20px)",borderRadius:"12px",fontFamily:"'Bricolage Grotesque',sans-serif",lineHeight:1}}>{app.stat.num}</div>
              </div>
              <div style={{padding:"clamp(20px,2.5vw,28px)"}}>
                <div style={{marginBottom:"4px"}}>
                  <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(20px,2.5vw,26px)",fontWeight:800,color:C.dark}}>{app.name}</span>
                  <span style={{fontSize:"clamp(11px,1.2vw,13px)",color:C.gray,marginLeft:"8px",fontWeight:500}}>{app.full}</span>
                </div>
                <div style={{fontSize:"10px",color:app.color,fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:"14px"}}>{app.stat.label}</div>
                <p style={{fontSize:"clamp(13px,1.4vw,14px)",color:C.gray,lineHeight:1.7,marginBottom:"20px"}}>{app.desc}</p>
                <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                  {app.tags.map((tag,j)=>(
                    <span key={j} style={{background:app.bg,color:app.color,fontSize:"11px",fontWeight:700,padding:"4px 12px",borderRadius:"99px"}}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Stats ─────────────────────────────────────────────────────
function Stats() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const stats = [
    {num:"120+",label:"Active Users",icon:"👥",desc:"Team members across PHI"},
    {num:"99.1%",label:"System Uptime",icon:"⚡",desc:"Reliable 24/7 availability"},
    {num:"3",label:"Applications",icon:"📦",desc:"SFA, Ficom & Ficom Lite"},
    {num:"15k+",label:"Monthly Transactions",icon:"💳",desc:"Processed through Ficom"},
  ]
  return (
    <section id="stats" ref={ref} style={{padding:"clamp(60px,10vw,120px) clamp(20px,5vw,80px)",background:C.dark,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,backgroundImage:`radial-gradient(circle,${C.white}05 1px,transparent 1px)`,backgroundSize:"28px 28px",pointerEvents:"none"}}/>
      <div style={{position:"absolute",top:"-20%",right:"-10%",width:"500px",height:"500px",borderRadius:"50%",background:`radial-gradient(circle,${C.primary}20,transparent 70%)`,filter:"blur(60px)",pointerEvents:"none"}}/>
      <div style={{maxWidth:"1100px",margin:"0 auto",textAlign:"center"}}>
        <div style={{marginBottom:"clamp(40px,6vw,64px)",opacity:inView?1:0,transition:"all 0.6s"}}>
          <div style={{display:"inline-block",background:`${C.primary}25`,borderRadius:"99px",padding:"5px 16px",fontSize:"12px",fontWeight:700,color:C.primaryLight,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>By The Numbers</div>
          <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:800,color:C.white,lineHeight:1.1,letterSpacing:"-0.02em"}}>
            Impact That Speaks<br/><span style={{color:C.primaryLight}}>for Itself</span>
          </h2>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:"clamp(16px,2vw,24px)"}}>
          {stats.map((s,i)=>(
            <div key={i}
              style={{background:"rgba(255,255,255,0.06)",borderRadius:"24px",padding:"clamp(24px,3vw,36px) clamp(16px,2vw,24px)",border:"1px solid rgba(255,255,255,0.08)",backdropFilter:"blur(10px)",transition:"all 0.25s",opacity:inView?1:0,transform:inView?"none":"translateY(24px)",transitionDelay:`${i*0.1}s`}}
              onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.1)";e.currentTarget.style.transform="translateY(-4px)"}}
              onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.transform="none"}}>
              <div style={{fontSize:"clamp(28px,4vw,36px)",marginBottom:"12px"}}>{s.icon}</div>
              <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(32px,5vw,52px)",fontWeight:900,color:C.white,lineHeight:1,marginBottom:"6px"}}>{s.num}</div>
              <div style={{fontSize:"clamp(13px,1.5vw,15px)",color:C.primaryLight,fontWeight:700,marginBottom:"6px"}}>{s.label}</div>
              <div style={{fontSize:"clamp(11px,1.2vw,12px)",color:"rgba(255,255,255,0.4)"}}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Supporting ────────────────────────────────────────────────
function SupportingPreview() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const [tutorials, setTutorials] = useState<LandingTutorial[]>([])
  const [infographics, setInfographics] = useState<LandingInfographic[]>([])

  useEffect(() => {
    supabase.from("landing_tutorials").select("app_id,app_name,emoji,improvements").order("app_id")
      .then(({ data }) => { if (data) setTutorials(data as LandingTutorial[]) })
    supabase.from("landing_infographics").select("*").order("order_index")
      .then(({ data }) => { if (data) setInfographics(data as LandingInfographic[]) })
  }, [])

  const APP_COLORS: Record<string, string> = {
    matrix: "#7C3AED", sfa: "#E8381A", ficom: "#FB8C00", "ficom-lite": "#1E88E5"
  }
  const APP_BG: Record<string, string> = {
    matrix: "#EDE9FE", sfa: "#FEF0ED", ficom: "#FFF3E0", "ficom-lite": "#E3F2FD"
  }

  return (
    <section id="supporting" ref={ref} style={{padding:"clamp(60px,10vw,120px) clamp(20px,5vw,80px)",background:C.white}}>
      <div style={{maxWidth:"1100px",margin:"0 auto"}}>
        <div style={{textAlign:"center",marginBottom:"clamp(40px,6vw,64px)",opacity:inView?1:0,transition:"all 0.6s"}}>
          <div style={{display:"inline-block",background:`${C.primary}12`,borderRadius:"99px",padding:"5px 16px",fontSize:"12px",fontWeight:700,color:C.primary,letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"16px"}}>Supporting Materials</div>
          <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(28px,4vw,48px)",fontWeight:800,lineHeight:1.1,letterSpacing:"-0.02em",marginBottom:"14px"}}>
            Learn, Reference,<br/><span style={{color:C.primary}}>and Grow</span>
          </h2>
          <p style={{fontSize:"clamp(14px,1.5vw,16px)",color:C.gray,maxWidth:"480px",margin:"0 auto",lineHeight:1.7}}>Visual references and step-by-step tutorials — everything your team needs, in one place.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,440px),1fr))",gap:"clamp(16px,2vw,24px)",marginBottom:"clamp(32px,4vw,48px)"}}>

          {/* Infographics card */}
          <div style={{background:C.grayLight,borderRadius:"24px",padding:"clamp(24px,3vw,32px)",opacity:inView?1:0,transition:"all 0.6s 0.1s"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px"}}>
              <div>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(18px,2vw,22px)",fontWeight:800}}>🖼️ Infographics</div>
                <div style={{fontSize:"12px",color:C.gray,marginTop:"2px"}}>{infographics.length > 0 ? `${infographics.length} visual tersedia` : "Visual reference materials"}</div>
              </div>
              <a href="/landing/infographics" style={{background:C.primary,color:"white",textDecoration:"none",padding:"8px 16px",borderRadius:"99px",fontSize:"12px",fontWeight:700}}>View All →</a>
            </div>
            {infographics.length > 0 ? (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px"}}>
                {infographics.slice(0,3).map((inf,i)=>(
                  <div key={inf.id} style={{background:"white",borderRadius:"14px",padding:"clamp(12px,1.5vw,16px)",textAlign:"center",transition:"all 0.2s",overflow:"hidden"}}
                    onMouseEnter={e=>{e.currentTarget.style.transform="scale(1.04)"}}
                    onMouseLeave={e=>{e.currentTarget.style.transform="none"}}>
                    {inf.image_url
                      ? <img src={inf.image_url} alt={inf.title} style={{width:"100%",height:"60px",objectFit:"cover",borderRadius:"8px",marginBottom:"6px"}}/>
                      : <div style={{fontSize:"clamp(20px,3vw,28px)",marginBottom:"6px"}}>🖼️</div>
                    }
                    <div style={{fontSize:"10px",fontWeight:700,color:C.primary,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px"}}>{inf.tag}</div>
                    <div style={{fontSize:"clamp(10px,1.2vw,11px)",fontWeight:600,color:C.dark,lineHeight:1.3}}>{inf.title}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px"}}>
                {[{emoji:"🗺️",title:"SFA User Flow",tag:"SFA"},{emoji:"📊",title:"Ficom Report",tag:"Ficom"},{emoji:"📱",title:"Ficom Lite",tag:"Lite"}].map((inf,i)=>(
                  <div key={i} style={{background:"#E8F5E9",borderRadius:"14px",padding:"clamp(12px,1.5vw,16px)",textAlign:"center"}}>
                    <div style={{fontSize:"clamp(20px,3vw,28px)",marginBottom:"6px"}}>{inf.emoji}</div>
                    <div style={{fontSize:"10px",fontWeight:700,color:"#43A047",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px"}}>{inf.tag}</div>
                    <div style={{fontSize:"clamp(10px,1.2vw,11px)",fontWeight:600,color:C.dark,lineHeight:1.3}}>{inf.title}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tutorials card */}
          <div style={{background:C.dark,borderRadius:"24px",padding:"clamp(24px,3vw,32px)",color:"white",position:"relative",overflow:"hidden",opacity:inView?1:0,transition:"all 0.6s 0.2s"}}>
            <div style={{position:"absolute",top:"-20px",right:"-20px",width:"150px",height:"150px",borderRadius:"50%",background:`${C.primary}25`,filter:"blur(30px)",pointerEvents:"none"}}/>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"20px"}}>
              <div>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(18px,2vw,22px)",fontWeight:800}}>📖 Tutorial System</div>
                <div style={{fontSize:"12px",color:"rgba(255,255,255,0.5)",marginTop:"2px"}}>{tutorials.length > 0 ? `${tutorials.length} aplikasi tersedia` : "Step-by-step guides"}</div>
              </div>
              <a href="/landing/tutorials" style={{background:"rgba(255,255,255,0.15)",color:"white",textDecoration:"none",padding:"8px 16px",borderRadius:"99px",fontSize:"12px",fontWeight:700,border:"1px solid rgba(255,255,255,0.2)"}}>View All →</a>
            </div>
            {(tutorials.length > 0 ? tutorials : [
              {app_id:"sfa",app_name:"SFA",emoji:"📊",improvements:[{steps:[{},{},{}]},{steps:[{}]}]},
              {app_id:"ficom",app_name:"Ficom",emoji:"💰",improvements:[{steps:[{},{}]},{steps:[{}]}]},
              {app_id:"ficom-lite",app_name:"Ficom Lite",emoji:"📱",improvements:[{steps:[{},{},{}]}]},
            ] as LandingTutorial[]).map((t,i)=>{
              const totalSteps = (t.improvements??[]).reduce((n,imp)=>n+(imp.steps?.length??0),0)
              const totalImps  = (t.improvements??[]).length
              const color = APP_COLORS[t.app_id] ?? "#6B7280"
              const bg    = APP_BG[t.app_id]    ?? "#F4F4F2"
              return (
                <a key={t.app_id} href={`/landing/tutorials?app=${t.app_id}`} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"clamp(10px,1.5vw,14px) clamp(12px,1.5vw,16px)",background:"rgba(255,255,255,0.07)",borderRadius:"12px",marginBottom:"8px",border:"1px solid rgba(255,255,255,0.08)",textDecoration:"none",transition:"all 0.2s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.12)"}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    <span style={{fontSize:"18px"}}>{t.emoji}</span>
                    <span style={{fontSize:"clamp(13px,1.4vw,14px)",fontWeight:600,color:"white"}}>{t.app_name}</span>
                  </div>
                  <span style={{fontSize:"11px",color:"rgba(255,255,255,0.4)",fontWeight:600}}>
                    {totalImps} improvement · {totalSteps} langkah →
                  </span>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{background:"#0A0A0A",color:"white",padding:"clamp(40px,6vw,64px) clamp(20px,5vw,80px) clamp(24px,3vw,32px)"}}>
      <div style={{maxWidth:"1100px",margin:"0 auto"}}>
        <div style={{display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:"clamp(32px,4vw,48px)",marginBottom:"clamp(32px,4vw,48px)"}}>
          <div style={{maxWidth:"280px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"14px"}}>
              <div style={{width:"36px",height:"36px",borderRadius:"10px",background:`linear-gradient(135deg,${C.primary},${C.primaryLight})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"18px"}}>🍃</div>
              <div>
                <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontWeight:800,fontSize:"15px"}}>PHI Support</div>
                <div style={{fontSize:"10px",color:"#666",letterSpacing:"0.1em",textTransform:"uppercase"}}>Mayora Indah</div>
              </div>
            </div>
            <p style={{fontSize:"13px",color:"#666",lineHeight:1.7}}>Digital hub for the Philippines Support Team — SFA, Ficom & Ficom Lite, all in one place.</p>
          </div>
          <div style={{display:"flex",gap:"clamp(32px,5vw,64px)",flexWrap:"wrap"}}>
            {[
              {title:"Platform",links:["SFA","Ficom","Ficom Lite"]},
              {title:"Resources",links:["Infographics","Tutorials","Updates"]},
              {title:"Company",links:["About","Contact","Admin Login"]},
            ].map(col=>(
              <div key={col.title}>
                <div style={{fontSize:"11px",fontWeight:700,color:"#555",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:"14px"}}>{col.title}</div>
                {col.links.map(l=><div key={l} style={{fontSize:"13px",color:"#777",marginBottom:"8px",cursor:"pointer",transition:"color 0.2s"}} onMouseEnter={e=>e.currentTarget.style.color=C.primaryLight} onMouseLeave={e=>e.currentTarget.style.color="#777"}>{l}</div>)}
              </div>
            ))}
          </div>
        </div>
        <div style={{borderTop:"1px solid #1a1a1a",paddingTop:"clamp(20px,3vw,28px)",display:"flex",flexWrap:"wrap",justifyContent:"space-between",gap:"12px"}}>
          <div style={{fontSize:"12px",color:"#444"}}>© 2026 Mayora Indah · PHI Support Team. All rights reserved.</div>
          <div style={{fontSize:"12px",color:"#444"}}>Built with ❤️ for the Philippines team</div>
        </div>
      </div>
    </footer>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function LandingPage() {
  useEffect(() => {
    // Fonts
    const link = document.createElement("link")
    link.rel = "stylesheet"
    link.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600&display=swap"
    document.head.appendChild(link)

    // Load Anime.js
    const script = document.createElement("script")
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"
    script.async = true
    document.head.appendChild(script)
  }, [])

  return (
    <div style={{fontFamily:"'DM Sans',sans-serif",color:C.dark,overflowX:"hidden"}}>
      <PasswordGate/>
      <LandingNav/>
      <Hero/>
      <About/>
      <Applications/>
      <Stats/>
      <SupportingPreview/>
      <Footer/>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
        @keyframes floatR { 0%,100%{transform:translateY(0) rotate(2deg)} 50%{transform:translateY(-8px) rotate(-2deg)} }
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.95)} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-8px)} }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-menu-btn { display: flex !important; flex-direction: column; }
          .floating-cards { display: none !important; }
        }
        @media (min-width: 769px) { .mobile-menu-btn { display: none !important; } }
      `}</style>
    </div>
  )
}