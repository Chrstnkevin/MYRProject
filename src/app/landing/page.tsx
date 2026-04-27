"use client"
import PasswordGate from "./PasswordGate"
import LandingNav from "./components/LandingNav"
import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import type { LandingTutorial, LandingInfographic } from "@/lib/types"

const C = {
  primary: "#E8381A",
  primaryLight: "#FF6B4A",
  accent: "#FFB800",
  dark: "#111111",
  gray: "#6B7280",
  light: "#F7F4EE",
  white: "#FFFFFF",
  green: "#2d6a4f",
  greenLight: "#52b788",
  greenPale: "#d8f3dc",
  border: "rgba(0,0,0,0.08)",
}

function useInView(ref: React.RefObject<HTMLElement | null>, threshold = 0.12) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    obs.observe(ref.current)
    return () => obs.disconnect()
  }, [ref, threshold])
  return inView
}

/* ─── HERO ─────────────────────────────────────────────────── */
function Hero() {
  const [typed, setTyped] = useState("")
  const words = ["Efficiency", "Clarity", "Growth", "Excellence"]
  const [wi, setWi] = useState(0)
  const [ci, setCi] = useState(0)
  const [del, setDel] = useState(false)
  const [mounted, setMounted] = useState(false)
  const heroRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)

    // Load fonts + GSAP + ScrollTrigger
    const fonts = document.createElement("link")
    fonts.rel = "stylesheet"
    fonts.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600&display=swap"
    document.head.appendChild(fonts)

    const loadGSAP = () => {
      const s1 = document.createElement("script")
      s1.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"
      s1.onload = () => {
        const s2 = document.createElement("script")
        s2.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"
        s2.onload = () => initGSAP()
        document.head.appendChild(s2)
      }
      document.head.appendChild(s1)
    }
    loadGSAP()
  }, [])

  const initGSAP = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gsap = (window as any).gsap
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ST = (window as any).ScrollTrigger
    if (!gsap || !ST) { setTimeout(initGSAP, 100); return }
    gsap.registerPlugin(ST)

    // Hero entrance
    const tl = gsap.timeline({ delay: 0.2 })
    tl.from(".hero-badge",   { y: 24, opacity: 0, duration: 0.65, ease: "back.out(1.7)" })
      .from(".hero-title",   { y: 60, opacity: 0, duration: 0.9,  ease: "back.out(1.2)" }, "-=0.3")
      .from(".hero-sub",     { y: 24, opacity: 0, duration: 0.7,  ease: "power3.out"    }, "-=0.4")
      .from(".hero-btn",     { y: 16, opacity: 0, duration: 0.6,  stagger: 0.1, ease: "power3.out" }, "-=0.3")
      .from(".floating-card",{ y: 28, opacity: 0, duration: 0.65, stagger: 0.12, ease: "back.out(1.5)" }, "-=0.3")

    // Floating cards loop
    setTimeout(() => {
      document.querySelectorAll(".floating-card").forEach((el, i) => {
        gsap.to(el, { y: -10, duration: 2.5 + i * 0.5, repeat: -1, yoyo: true, ease: "sine.inOut", delay: i * 0.4 })
      })
    }, 1400)

    // PARALLAX SCROLL — multi-layer depth
    const heroEl = document.getElementById("phi-hero")
    if (heroEl) {
      const pCfg = { trigger: heroEl, start: "top top", end: "bottom top", scrub: 0.8 }

      gsap.to("#para-sky",    { y: 50,  ease: "none", scrollTrigger: pCfg })
      gsap.to("#para-sun",    { y: -80, scale: 1.15, ease: "none", scrollTrigger: { ...pCfg, scrub: 0.6 } })
      gsap.to("#para-clouds1",{ y: 30,  x: -60, ease: "none", scrollTrigger: pCfg })
      gsap.to("#para-clouds2",{ y: 50,  x: 40,  ease: "none", scrollTrigger: { ...pCfg, scrub: 1 } })
      gsap.to("#para-m4",     { y: -25, ease: "none", scrollTrigger: { ...pCfg, scrub: 1 } })
      gsap.to("#para-m3",     { y: -50, ease: "none", scrollTrigger: { ...pCfg, scrub: 1.1 } })
      gsap.to("#para-m2",     { y: -85, ease: "none", scrollTrigger: { ...pCfg, scrub: 1.3 } })
      gsap.to("#para-m1",     { y: -130,ease: "none", scrollTrigger: { ...pCfg, scrub: 1.6 } })
      gsap.to("#para-fg",     { y: -160,ease: "none", scrollTrigger: { ...pCfg, scrub: 1.8 } })
      gsap.to("#para-fog",    { y: -170,ease: "none", scrollTrigger: { ...pCfg, scrub: 2 } })
      gsap.to(".hero-content",{ y: -90, opacity: 0, ease: "none", scrollTrigger: { ...pCfg, scrub: 0.5 } })
    }

    // Section reveals via GSAP
    document.querySelectorAll("[data-gsap-reveal]").forEach((el) => {
      gsap.from(el, {
        y: 50, opacity: 0, duration: 0.9, ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 85%", once: true }
      })
    })
  }

  // Typewriter
  useEffect(() => {
    const w = words[wi]
    const t = setTimeout(() => {
      if (!del) {
        if (ci < w.length) { setTyped(w.slice(0, ci + 1)); setCi(c => c + 1) }
        else setTimeout(() => setDel(true), 1800)
      } else {
        if (ci > 0) { setTyped(w.slice(0, ci - 1)); setCi(c => c - 1) }
        else { setDel(false); setWi(i => (i + 1) % words.length) }
      }
    }, del ? 55 : 85)
    return () => clearTimeout(t)
  }, [ci, del, wi])

  // Mouse parallax on hero
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gsap = (window as any).gsap
    if (!gsap || !heroRef.current) return
    const { left, top, width, height } = heroRef.current.getBoundingClientRect()
    const mx = (e.clientX - left) / width - 0.5
    const my = (e.clientY - top) / height - 0.5
    gsap.to("#para-m1",     { x: mx * 28,  duration: 0.9, ease: "power1.out", overwrite: "auto" })
    gsap.to("#para-m2",     { x: mx * 16,  duration: 1.0, ease: "power1.out", overwrite: "auto" })
    gsap.to("#para-m3",     { x: mx * 9,   duration: 1.1, ease: "power1.out", overwrite: "auto" })
    gsap.to("#para-clouds1",{ x: mx * 20 - 60, duration: 1.2, ease: "power1.out", overwrite: "auto" })
    gsap.to("#para-clouds2",{ x: mx * 32 + 40, duration: 1.0, ease: "power1.out", overwrite: "auto" })
    gsap.to("#para-sun",    { x: mx * 12, y: my * 8, duration: 1.3, ease: "power1.out", overwrite: "auto" })
    gsap.to(".hero-content",{ x: mx * 10, y: my * 6, duration: 0.8, ease: "power1.out", overwrite: "auto" })
  }

  return (
    <section
      id="phi-hero"
      ref={heroRef}
      onMouseMove={handleMouseMove}
      style={{ position: "relative", height: "100vh", minHeight: 640, overflow: "hidden" }}
    >
      {/* Sky */}
      <div id="para-sky" style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(180deg, #b8dff0 0%, #d6eef9 25%, #e8f5f0 55%, #f0ece0 80%, #e8dcc8 100%)"
      }} />

      {/* Sun */}
      <div id="para-sun" style={{
        position: "absolute", top: "7%", left: "50%", transform: "translateX(-50%)",
        width: 110, height: 110, borderRadius: "50%",
        background: "radial-gradient(circle, #fff9c4 20%, #ffe566 50%, #ffcc02 70%, rgba(255,200,0,0) 100%)",
        boxShadow: "0 0 80px 30px rgba(255,230,80,.35), 0 0 160px 60px rgba(255,200,0,.12)",
      }} />
      {/* Sun halo */}
      <div style={{
        position: "absolute", top: "3.5%", left: "50%", transform: "translateX(-50%)",
        width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,240,100,.15) 20%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Clouds layer 1 — far */}
      <div id="para-clouds1" style={{ position: "absolute", top: "6%", width: "200%", left: 0, pointerEvents: "none" }}>
        <svg viewBox="0 0 2400 160" preserveAspectRatio="none" style={{ width: "100%", height: 160, display: "block" }}>
          <g>
            <ellipse cx="180" cy="80" rx="160" ry="38" fill="white" opacity=".75"/>
            <ellipse cx="290" cy="68" rx="110" ry="30" fill="white" opacity=".75"/>
            <ellipse cx="100" cy="88" rx="90"  ry="24" fill="white" opacity=".6"/>
            <ellipse cx="850" cy="70" rx="180" ry="44" fill="white" opacity=".7"/>
            <ellipse cx="980" cy="58" rx="130" ry="34" fill="white" opacity=".7"/>
            <ellipse cx="730" cy="80" rx="100" ry="28" fill="white" opacity=".55"/>
            <ellipse cx="1650" cy="75" rx="170" ry="40" fill="white" opacity=".72"/>
            <ellipse cx="1780" cy="62" rx="120" ry="32" fill="white" opacity=".65"/>
            <ellipse cx="2180" cy="68" rx="160" ry="42" fill="white" opacity=".7"/>
            <ellipse cx="2310" cy="55" rx="110" ry="28" fill="white" opacity=".6"/>
          </g>
        </svg>
      </div>

      {/* Clouds layer 2 — near */}
      <div id="para-clouds2" style={{ position: "absolute", top: "14%", width: "200%", left: 0, pointerEvents: "none" }}>
        <svg viewBox="0 0 2400 140" preserveAspectRatio="none" style={{ width: "100%", height: 140, display: "block" }}>
          <g>
            <ellipse cx="460" cy="72" rx="200" ry="48" fill="white" opacity=".5"/>
            <ellipse cx="620" cy="60" rx="150" ry="36" fill="white" opacity=".5"/>
            <ellipse cx="340" cy="80" rx="120" ry="30" fill="white" opacity=".4"/>
            <ellipse cx="1350" cy="65" rx="180" ry="44" fill="white" opacity=".48"/>
            <ellipse cx="1500" cy="52" rx="140" ry="34" fill="white" opacity=".45"/>
            <ellipse cx="2000" cy="70" rx="160" ry="40" fill="white" opacity=".5"/>
            <ellipse cx="2140" cy="56" rx="100" ry="26" fill="white" opacity=".4"/>
          </g>
        </svg>
      </div>

      {/* Mountain layer 4 — FARTHEST pale */}
      <div id="para-m4" style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}>
        <svg viewBox="0 0 1440 340" preserveAspectRatio="none" style={{ width: "100%", height: 340, display: "block" }}>
          <path d="M0,340 L0,210 Q80,140 200,190 Q340,240 460,155 Q560,80 680,120 Q800,160 900,90 Q1010,20 1130,100 Q1240,175 1340,130 Q1400,105 1440,125 L1440,340 Z" fill="#b8cfe0" opacity=".55"/>
          <path d="M0,340 L0,260 Q200,200 420,240 Q640,275 820,220 Q1000,168 1200,240 Q1340,290 1440,260 L1440,340 Z" fill="#c8d8e8" opacity=".35"/>
        </svg>
      </div>

      {/* Mountain layer 3 — mid */}
      <div id="para-m3" style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}>
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" style={{ width: "100%", height: 320, display: "block" }}>
          <path d="M0,320 L0,195 Q90,115 230,175 Q380,238 500,135 Q600,55 720,105 Q840,155 960,80 Q1080,8 1200,95 Q1310,175 1400,135 L1440,118 L1440,320 Z" fill="#7ab89a"/>
          <path d="M0,320 L0,250 Q220,188 460,228 Q680,262 900,215 Q1100,172 1320,228 L1440,240 L1440,320 Z" fill="#5a9e7a" opacity=".6"/>
          {/* pine trees far */}
          <g fill="#2d7a55" opacity=".8">
            {[60,130,210,310,420,540,660,780,900,1040,1180,1310,1400].map((x, i) => (
              <g key={i} transform={`translate(${x},${155 + (i % 3) * 8})`}>
                <polygon points="0,-28 6,0 -6,0" />
                <polygon points="0,-38 8,4 -8,4" opacity=".7"/>
                <rect x="-2" y="0" width="4" height="8" fill="#1d5a3a"/>
              </g>
            ))}
          </g>
          {/* river */}
          <path d="M700,320 Q715,240 725,195 Q735,160 750,175 Q765,190 775,320" fill="#7ac8e8" opacity=".4"/>
        </svg>
      </div>

      {/* Hill layer 2 — lush green */}
      <div id="para-m2" style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}>
        <svg viewBox="0 0 1440 290" preserveAspectRatio="none" style={{ width: "100%", height: 290, display: "block" }}>
          <path d="M0,290 L0,155 Q100,75 260,145 Q420,208 580,115 Q700,42 840,105 Q980,168 1100,100 Q1210,40 1320,120 Q1390,165 1440,140 L1440,290 Z" fill="#3a8c5c"/>
          {/* Realistic trees — mid distance, layered trunks + canopy */}
          <g>
            {[40,115,195,290,410,530,640,740,860,970,1080,1190,1310,1400].map((x, i) => {
              const h = 28 + (i % 4) * 6
              const y = 120 + (i % 3) * 10
              const dark = i % 2 === 0
              return (
                <g key={i}>
                  {/* trunk */}
                  <rect x={x - 2} y={y + h * 0.55} width={4} height={h * 0.55} fill={dark ? "#2d4a1e" : "#3d5a2a"} rx="1"/>
                  {/* bottom canopy */}
                  <ellipse cx={x} cy={y + h * 0.45} rx={h * 0.42} ry={h * 0.35} fill={dark ? "#1e5c32" : "#2d7a3e"}/>
                  {/* mid canopy */}
                  <ellipse cx={x} cy={y + h * 0.28} rx={h * 0.34} ry={h * 0.28} fill={dark ? "#267040" : "#38924e"}/>
                  {/* top canopy */}
                  <ellipse cx={x} cy={y + h * 0.12} rx={h * 0.22} ry={h * 0.2} fill={dark ? "#2e8050" : "#40a860"}/>
                  {/* highlight */}
                  <ellipse cx={x - h * 0.08} cy={y + h * 0.1} rx={h * 0.08} ry={h * 0.07} fill="rgba(255,255,255,.12)"/>
                </g>
              )
            })}
          </g>
          {/* wildflowers */}
          <g opacity=".9">
            {[160, 350, 520, 680, 830, 980, 1140, 1280].map((x, i) => (
              <g key={i}>
                <circle cx={x} cy={148 + (i % 3) * 8} r="3.5" fill={["#f8bbd0","#fff9c4","#e1bee7","#bbdefb"][i % 4]}/>
                <circle cx={x + 6} cy={143 + (i % 3) * 8} r="3" fill={["#fff9c4","#c8e6c9","#f8bbd0","#ffe0b2"][i % 4]}/>
                <circle cx={x - 5} cy={145 + (i % 3) * 8} r="2.5" fill={["#c8e6c9","#f8bbd0","#fff9c4","#e1bee7"][i % 4]}/>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Foreground layer 1 — CLOSEST dark trees */}
      <div id="para-m1" style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}>
        <svg viewBox="0 0 1440 260" preserveAspectRatio="none" style={{ width: "100%", height: 260, display: "block" }}>
          <path d="M0,260 L0,120 Q90,50 240,115 Q380,172 520,80 Q640,15 760,75 Q880,132 1010,65 Q1130,8 1260,88 Q1360,148 1440,110 L1440,260 Z" fill="#1a4a2e"/>
          {/* BIG realistic foreground trees */}
          <g>
            {[-20, 60, 155, 265, 390, 510, 640, 765, 900, 1030, 1150, 1280, 1400].map((x, i) => {
              const h = 55 + (i % 5) * 14
              const y = 95 + (i % 4) * 8
              const isDark = i % 3 !== 1
              return (
                <g key={i}>
                  {/* Root/base shadow */}
                  <ellipse cx={x} cy={y + h * 0.9} rx={h * 0.18} ry={h * 0.06} fill="rgba(0,0,0,.2)"/>
                  {/* Trunk — tapered */}
                  <path
                    d={`M${x - 4},${y + h * 0.85} Q${x - 3},${y + h * 0.6} ${x - 2},${y + h * 0.45} L${x + 2},${y + h * 0.45} Q${x + 3},${y + h * 0.6} ${x + 4},${y + h * 0.85} Z`}
                    fill={isDark ? "#1c3014" : "#2a4a1c"}
                  />
                  {/* Bottom canopy layer */}
                  <ellipse cx={x} cy={y + h * 0.5} rx={h * 0.48} ry={h * 0.38} fill={isDark ? "#143d22" : "#1a5228"}/>
                  {/* Mid canopy */}
                  <ellipse cx={x} cy={y + h * 0.32} rx={h * 0.38} ry={h * 0.3} fill={isDark ? "#1a5230" : "#22683c"}/>
                  {/* Upper canopy */}
                  <ellipse cx={x} cy={y + h * 0.16} rx={h * 0.26} ry={h * 0.22} fill={isDark ? "#1e6038" : "#287848"}/>
                  {/* Top */}
                  <ellipse cx={x} cy={y + h * 0.04} rx={h * 0.14} ry={h * 0.12} fill={isDark ? "#256845" : "#2e8850"}/>
                  {/* Light catch */}
                  <ellipse cx={x - h * 0.1} cy={y + h * 0.13} rx={h * 0.1} ry={h * 0.08} fill="rgba(255,255,255,.1)"/>
                  {/* Dark shadow side */}
                  <ellipse cx={x + h * 0.15} cy={y + h * 0.35} rx={h * 0.12} ry={h * 0.22} fill="rgba(0,0,0,.18)"/>
                </g>
              )
            })}
          </g>
          {/* Ground grass detail */}
          <path d="M0,245 Q360,225 720,235 Q1080,245 1440,230 L1440,260 L0,260 Z" fill="#0f2e1a"/>
          {/* Grass blades */}
          <g stroke="#1a4a2e" strokeWidth="1.5" fill="none" opacity=".6">
            {[20,60,110,170,230,290,360,440,520,600,690,780,880,980,1080,1180,1290,1380].map((x, i) => (
              <g key={i}>
                <path d={`M${x},255 Q${x + 3},240 ${x - 2},228`}/>
                <path d={`M${x + 8},255 Q${x + 12},238 ${x + 14},224`}/>
                <path d={`M${x - 4},255 Q${x - 8},242 ${x - 6},230`}/>
              </g>
            ))}
          </g>
        </svg>
      </div>

      {/* Ground strip */}
      <div id="para-fg" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 100 }}>
        <svg viewBox="0 0 1440 100" preserveAspectRatio="none" style={{ width: "100%", height: 100, display: "block" }}>
          <rect width="1440" height="100" fill="#0d2516"/>
          <path d="M0,30 Q360,10 720,20 Q1080,30 1440,15 L1440,0 L0,0 Z" fill="#142e1c"/>
        </svg>
      </div>

      {/* Fog fade */}
      <div id="para-fog" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 200, pointerEvents: "none" }}>
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none" style={{ width: "100%", height: 200, display: "block" }}>
          <defs>
            <linearGradient id="fogG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.light} stopOpacity="0"/>
              <stop offset="65%" stopColor={C.light} stopOpacity=".6"/>
              <stop offset="100%" stopColor={C.light} stopOpacity="1"/>
            </linearGradient>
          </defs>
          <rect width="1440" height="200" fill="url(#fogG)"/>
        </svg>
      </div>

      {/* Floating cards */}
      {mounted && (
        <div className="floating-cards-wrap" style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 8 }}>
          {[
            { emoji: "📊", label: "SFA Dashboard", sub: "98.2% uptime",      color: "#E8F5E9", accent: "#43A047", x: "3%",  y: "28%", show: true },
            { emoji: "💰", label: "Ficom Module",  sub: "Live tracking",      color: "#FFF3E0", accent: "#FB8C00", x: "76%", y: "22%", show: true },
            { emoji: "🎯", label: "Target Hit",    sub: "↑ 24% this month",   color: "#FCE4EC", accent: "#E91E63", x: "78%", y: "62%", show: true },
          ].map((card, i) => (
            <div key={i} className="floating-card" style={{
              position: "absolute", left: card.x, top: card.y,
              background: "white", borderRadius: 16, padding: "12px 16px",
              boxShadow: "0 8px 32px rgba(0,0,0,.1)", border: `1.5px solid ${card.color}`,
              minWidth: 160, display: "flex", alignItems: "center", gap: 10,
              opacity: 0,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: card.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{card.emoji}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>{card.label}</div>
                <div style={{ fontSize: 11, color: card.accent, fontWeight: 600 }}>{card.sub}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* HERO TEXT */}
      <div className="hero-content" style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "100px clamp(20px,5vw,80px) 120px", textAlign: "center" }}>
        <div className="hero-badge" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,255,255,.72)", border: `1.5px solid rgba(45,106,79,.25)`,
          borderRadius: 99, padding: "7px 18px", marginBottom: 24,
          backdropFilter: "blur(12px)",
        }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.green, animation: "pulse 2s infinite", display: "block", flexShrink: 0 }}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.green }}>PHI Team Digital Hub — Mayora Indah</span>
        </div>

        <h1 className="hero-title" style={{
          fontFamily: "'Bricolage Grotesque',sans-serif",
          fontSize: "clamp(44px,7.5vw,88px)", fontWeight: 900,
          lineHeight: 1.0, letterSpacing: "-0.035em", marginBottom: 20,
          color: C.dark, textShadow: "0 2px 32px rgba(255,255,255,.5)",
        }}>
          Drive{" "}
          <span style={{ background: `linear-gradient(135deg,${C.primary},${C.primaryLight})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            {typed}<span style={{ animation: "blink 1s infinite", WebkitTextFillColor: C.primary }}>|</span>
          </span>
          <br />with Every Tool
        </h1>

        <p className="hero-sub" style={{ fontSize: "clamp(15px,1.8vw,18px)", color: "rgba(26,26,46,.6)", lineHeight: 1.75, maxWidth: 540, margin: "0 auto 36px" }}>
          Your all-in-one support hub for <strong style={{ color: C.dark }}>SFA</strong>, <strong style={{ color: C.dark }}>Ficom</strong>, and <strong style={{ color: C.dark }}>Ficom Lite</strong> — built to empower the Philippines team with resources and insights.
        </p>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <button className="hero-btn" onClick={() => document.getElementById("applications")?.scrollIntoView({ behavior: "smooth" })}
            style={{ background: C.primary, border: "none", cursor: "pointer", padding: "clamp(13px,2vw,16px) clamp(28px,4vw,40px)", borderRadius: 99, fontSize: "clamp(14px,1.5vw,16px)", fontWeight: 700, color: "white", boxShadow: `0 8px 28px ${C.primary}45`, transition: "all .25s", fontFamily: "'DM Sans',sans-serif" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 14px 36px ${C.primary}55` }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 8px 28px ${C.primary}45` }}>
            Explore Applications ↓
          </button>
          <button className="hero-btn" onClick={() => document.getElementById("supporting")?.scrollIntoView({ behavior: "smooth" })}
            style={{ background: "rgba(255,255,255,.75)", border: "1.5px solid rgba(45,106,79,.3)", cursor: "pointer", padding: "clamp(13px,2vw,15px) clamp(24px,4vw,36px)", borderRadius: 99, fontSize: "clamp(14px,1.5vw,16px)", fontWeight: 600, color: C.green, transition: "all .25s", fontFamily: "'DM Sans',sans-serif", backdropFilter: "blur(8px)" }}
            onMouseEnter={e => { e.currentTarget.style.background = "white"; e.currentTarget.style.borderColor = C.green }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.75)"; e.currentTarget.style.borderColor = "rgba(45,106,79,.3)" }}>
            View Resources →
          </button>
        </div>
      </div>

      {/* Scroll hint */}
      <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", zIndex: 15, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, animation: "bounce 2s ease-in-out infinite" }}>
        <div style={{ fontSize: 11, color: "rgba(45,106,79,.5)", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Scroll</div>
        <div style={{ width: 1, height: 32, background: `linear-gradient(to bottom,${C.green},transparent)` }}/>
      </div>
    </section>
  )
}

/* ─── ABOUT ─────────────────────────────────────────────────── */
function About() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  return (
    <section id="about" ref={ref} style={{ padding: "clamp(60px,10vw,120px) clamp(20px,5vw,80px)", background: C.white }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "clamp(32px,5vw,80px)", alignItems: "center" }}>
        <div style={{ opacity: inView ? 1 : 0, transform: inView ? "none" : "translateX(-32px)", transition: "all .7s ease" }}>
          <div style={{ display: "inline-block", background: `${C.primary}12`, borderRadius: 99, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>About This Hub</div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 20 }}>
            Built for the{" "}<span style={{ color: C.primary }}>Philippines</span>{" "}Support Team
          </h2>
          <p style={{ fontSize: "clamp(14px,1.5vw,16px)", color: C.gray, lineHeight: 1.8, marginBottom: 16 }}>
            PHI Support Hub is the central digital platform designed specifically for the Mayora Philippines team — providing real-time access to system resources, utilisation data, and training materials.
          </p>
          <p style={{ fontSize: "clamp(14px,1.5vw,16px)", color: C.gray, lineHeight: 1.8 }}>
            From sales force tracking with <strong style={{ color: C.dark }}>SFA</strong> to financial management with <strong style={{ color: C.dark }}>Ficom</strong> and mobile operations with <strong style={{ color: C.dark }}>Ficom Lite</strong>.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, opacity: inView ? 1 : 0, transform: inView ? "none" : "translateX(32px)", transition: "all .7s .2s ease" }}>
          {[
            { icon: "🎯", title: "Goal-Oriented",  desc: "Built around team targets and performance metrics" },
            { icon: "📱", title: "Mobile Ready",    desc: "Fully responsive — works on any device, anywhere" },
            { icon: "🔄", title: "Always Updated",  desc: "Admin team keeps content fresh and relevant" },
            { icon: "🛡️", title: "Secure Access",   desc: "Role-based access for team members and admins" },
          ].map((item, i) => (
            <div key={i} style={{ background: C.light, borderRadius: 20, padding: "clamp(16px,2vw,24px)", transition: "all .2s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,.08)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none" }}>
              <div style={{ fontSize: "clamp(24px,3vw,32px)", marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(14px,1.5vw,16px)", fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: "clamp(12px,1.2vw,13px)", color: C.gray, lineHeight: 1.5 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── NATURE DIVIDER ────────────────────────────────────────── */
function NatureDivider() {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} style={{ position: "relative", height: "clamp(300px,40vw,520px)", overflow: "hidden", background: "linear-gradient(180deg,#c4e0f0 0%,#d8eef5 30%,#e0f0e8 65%,#c8e4c8 100%)" }}>
      {/* Far hills */}
      <div className="n-para" data-depth="0.15" style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}>
        <svg viewBox="0 0 1440 280" preserveAspectRatio="none" style={{ width: "100%", height: 280, display: "block" }}>
          <path d="M0,280 L0,160 Q240,70 500,145 Q760,215 1000,100 Q1220,8 1440,140 L1440,280 Z" fill="#8cbca8" opacity=".65"/>
        </svg>
      </div>
      <div className="n-para" data-depth="0.3" style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}>
        <svg viewBox="0 0 1440 250" preserveAspectRatio="none" style={{ width: "100%", height: 250, display: "block" }}>
          <path d="M0,250 L0,130 Q200,50 430,125 Q660,195 880,95 Q1100,5 1320,125 Q1400,160 1440,130 L1440,250 Z" fill="#4a9c70"/>
          <g fill="#2d7a4a" opacity=".7">
            {[80,220,390,560,730,900,1080,1250,1390].map((x, i) => (
              <g key={i} transform={`translate(${x},${100 + i % 3 * 10})`}>
                <polygon points="0,-22 5,0 -5,0"/>
                <polygon points="0,-32 7,4 -7,4" opacity=".65"/>
                <rect x="-2" y="0" width="4" height="7" fill="#1a5230"/>
              </g>
            ))}
          </g>
        </svg>
      </div>
      <div className="n-para" data-depth="0.55" style={{ position: "absolute", bottom: 0, left: 0, width: "100%" }}>
        <svg viewBox="0 0 1440 220" preserveAspectRatio="none" style={{ width: "100%", height: 220, display: "block" }}>
          <path d="M0,220 L0,105 Q180,35 380,105 Q580,170 800,82 Q1020,0 1240,110 Q1370,165 1440,125 L1440,220 Z" fill="#1e6e40"/>
          <g>
            {[30,120,215,330,460,580,700,830,960,1090,1210,1330,1420].map((x, i) => {
              const h = 32 + i % 4 * 7; const y = 80 + i % 3 * 9
              return (
                <g key={i}>
                  <path d={`M${x-2},${y+h*.82} Q${x-1.5},${y+h*.55} ${x-1},${y+h*.42} L${x+1},${y+h*.42} Q${x+1.5},${y+h*.55} ${x+2},${y+h*.82} Z`} fill="#1c3a14"/>
                  <ellipse cx={x} cy={y+h*.46} rx={h*.4} ry={h*.32} fill="#1a4e28"/>
                  <ellipse cx={x} cy={y+h*.3}  rx={h*.32} ry={h*.26} fill="#226038"/>
                  <ellipse cx={x} cy={y+h*.15} rx={h*.2} ry={h*.18} fill="#287040"/>
                  <ellipse cx={x-h*.08} cy={y+h*.13} rx={h*.07} ry={h*.06} fill="rgba(255,255,255,.1)"/>
                </g>
              )
            })}
          </g>
        </svg>
      </div>
      <div className="n-para" data-depth="0.8" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 110 }}>
        <svg viewBox="0 0 1440 110" preserveAspectRatio="none" style={{ width: "100%", height: 110, display: "block" }}>
          <rect width="1440" height="110" fill="#0d2516"/>
          <path d="M0,30 Q720,8 1440,22 L1440,0 L0,0 Z" fill="#142e1c"/>
        </svg>
      </div>
      {/* fog at bottom */}
      <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 120, pointerEvents: "none" }}>
        <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ width: "100%", height: 120, display: "block" }}>
          <defs>
            <linearGradient id="nFog" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="0"/>
              <stop offset="100%" stopColor="white" stopOpacity="1"/>
            </linearGradient>
          </defs>
          <rect width="1440" height="120" fill="url(#nFog)"/>
        </svg>
      </div>

      {/* Text overlay */}
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10, textAlign: "center", padding: "0 24px" }}>
        <div style={{ display: "inline-block", background: "rgba(255,255,255,.55)", border: "1px solid rgba(45,106,79,.25)", borderRadius: 99, padding: "6px 18px", fontSize: 12, fontWeight: 700, color: C.green, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14, backdropFilter: "blur(10px)" }}>
          Supporting Materials
        </div>
        <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(32px,5vw,60px)", fontWeight: 900, color: C.dark, lineHeight: 1.0, letterSpacing: "-0.03em", textShadow: "0 2px 20px rgba(255,255,255,.6)" }}>
          Learn, Reference,<br/><span style={{ color: C.green }}>and Grow</span>
        </h2>
      </div>
    </div>
  )
}

/* ─── APPLICATIONS ──────────────────────────────────────────── */
function Applications() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const apps = [
    { emoji: "📊", name: "SFA",        full: "Sales Force Automation", color: C.primary,  bg: "#FEF0ED", desc: "Track daily visits, monitor outlet targets, and manage sales team performance across all regions in the Philippines.", tags: ["Visit Tracking","Target Monitoring","Performance Reports"], stat: { num: "92%",  label: "Target Achievement" } },
    { emoji: "💰", name: "Ficom",      full: "Finance & Commerce",      color: "#FB8C00",  bg: "#FFF8F0", desc: "Complete financial transaction management, outlet coverage tracking, and automated period-closing reports.",           tags: ["Transaction Mgmt","Period Closing","Outlet Coverage"],    stat: { num: "99%",  label: "Report Accuracy" } },
    { emoji: "📱", name: "Ficom Lite", full: "Mobile Finance",           color: "#1E88E5",  bg: "#EEF7FF", desc: "Lightweight mobile version of Ficom designed for field agents — with offline capability and fast sync.",            tags: ["Offline Mode","Fast Sync","Mobile First"],                  stat: { num: "98%",  label: "Sync Success" } },
  ]
  return (
    <section id="applications" ref={ref} style={{ padding: "clamp(60px,10vw,120px) clamp(20px,5vw,80px)", background: C.light }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)", opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(20px)", transition: "all .6s ease" }}>
          <div style={{ display: "inline-block", background: `${C.primary}12`, borderRadius: 99, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Our Applications</div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Three Powerful Tools,<br/><span style={{ color: C.primary }}>One Unified Hub</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: "clamp(16px,2vw,24px)" }}>
          {apps.map((app, i) => (
            <div key={i}
              style={{ background: C.white, borderRadius: 24, overflow: "hidden", boxShadow: "0 4px 20px rgba(0,0,0,.06)", transition: "all .3s", opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(30px)", transitionDelay: `${i * 0.1}s` }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-6px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(0,0,0,.12)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,.06)" }}>
              <div style={{ background: app.bg, padding: "clamp(24px,3vw,32px)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ width: "clamp(48px,6vw,64px)", height: "clamp(48px,6vw,64px)", borderRadius: 18, background: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "clamp(24px,3vw,32px)", boxShadow: `0 4px 16px ${app.color}20` }}>{app.emoji}</div>
                <div style={{ background: app.color, color: "white", fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 900, padding: "clamp(8px,1.5vw,14px) clamp(12px,2vw,20px)", borderRadius: 12, fontFamily: "'Bricolage Grotesque',sans-serif", lineHeight: 1 }}>{app.stat.num}</div>
              </div>
              <div style={{ padding: "clamp(20px,2.5vw,28px)" }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(20px,2.5vw,26px)", fontWeight: 800, color: C.dark }}>{app.name}</span>
                  <span style={{ fontSize: "clamp(11px,1.2vw,13px)", color: C.gray, marginLeft: 8, fontWeight: 500 }}>{app.full}</span>
                </div>
                <div style={{ fontSize: 10, color: app.color, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>{app.stat.label}</div>
                <p style={{ fontSize: "clamp(13px,1.4vw,14px)", color: C.gray, lineHeight: 1.7, marginBottom: 20 }}>{app.desc}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {app.tags.map((tag, j) => <span key={j} style={{ background: app.bg, color: app.color, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 99 }}>{tag}</span>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── STATS ─────────────────────────────────────────────────── */
function Stats() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref)
  const stats = [
    { num: "120+",  label: "Active Users",          icon: "👥", desc: "Team members across PHI" },
    { num: "99.1%", label: "System Uptime",          icon: "⚡", desc: "Reliable 24/7 availability" },
    { num: "3",     label: "Applications",           icon: "📦", desc: "SFA, Ficom & Ficom Lite" },
    { num: "15k+",  label: "Monthly Transactions",   icon: "💳", desc: "Processed through Ficom" },
  ]
  return (
    <section id="stats" ref={ref} style={{ padding: "clamp(60px,10vw,120px) clamp(20px,5vw,80px)", background: C.dark, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, backgroundImage: `radial-gradient(circle,${C.white}05 1px,transparent 1px)`, backgroundSize: "28px 28px", pointerEvents: "none" }}/>
      <div style={{ position: "absolute", top: "-20%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: `radial-gradient(circle,${C.primary}20,transparent 70%)`, filter: "blur(60px)", pointerEvents: "none" }}/>
      <div style={{ maxWidth: 1100, margin: "0 auto", textAlign: "center" }}>
        <div style={{ marginBottom: "clamp(40px,6vw,64px)", opacity: inView ? 1 : 0, transition: "all .6s" }}>
          <div style={{ display: "inline-block", background: `${C.primary}25`, borderRadius: 99, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: C.primaryLight, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>By The Numbers</div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, color: C.white, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
            Impact That Speaks<br/><span style={{ color: C.primaryLight }}>for Itself</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "clamp(16px,2vw,24px)" }}>
          {stats.map((s, i) => (
            <div key={i}
              style={{ background: "rgba(255,255,255,.06)", borderRadius: 24, padding: "clamp(24px,3vw,36px) clamp(16px,2vw,24px)", border: "1px solid rgba(255,255,255,.08)", backdropFilter: "blur(10px)", transition: "all .25s", opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(24px)", transitionDelay: `${i * 0.1}s` }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,.1)"; e.currentTarget.style.transform = "translateY(-4px)" }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,.06)"; e.currentTarget.style.transform = "none" }}>
              <div style={{ fontSize: "clamp(28px,4vw,36px)", marginBottom: 12 }}>{s.icon}</div>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(32px,5vw,52px)", fontWeight: 900, color: C.white, lineHeight: 1, marginBottom: 6 }}>{s.num}</div>
              <div style={{ fontSize: "clamp(13px,1.5vw,15px)", color: C.primaryLight, fontWeight: 700, marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: "clamp(11px,1.2vw,12px)", color: "rgba(255,255,255,.4)" }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── SUPPORTING PREVIEW ────────────────────────────────────── */
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

  const fallbackInfos = [
    { emoji: "🗺️", title: "SFA User Flow",        tag: "SFA",        color: "#E8F5E9", accent: "#43A047" },
    { emoji: "📊", title: "Ficom Finance Report",  tag: "Ficom",      color: "#FFF3E0", accent: "#FB8C00" },
    { emoji: "📱", title: "Ficom Lite Guide",       tag: "Ficom Lite", color: "#E3F2FD", accent: "#1E88E5" },
  ]
  const fallbackTuts = [
    { app: "SFA",        steps: 4, emoji: "📊" },
    { app: "Ficom",      steps: 3, emoji: "💰" },
    { app: "Ficom Lite", steps: 3, emoji: "📱" },
  ]

  return (
    <section id="supporting" ref={ref} style={{ padding: "clamp(60px,10vw,120px) clamp(20px,5vw,80px)", background: C.white }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "clamp(40px,6vw,64px)", opacity: inView ? 1 : 0, transition: "all .6s" }}>
          <div style={{ display: "inline-block", background: `${C.primary}12`, borderRadius: 99, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Supporting Materials</div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(28px,4vw,48px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 14 }}>
            Learn, Reference,<br/><span style={{ color: C.primary }}>and Grow</span>
          </h2>
          <p style={{ fontSize: "clamp(14px,1.5vw,16px)", color: C.gray, maxWidth: 480, margin: "0 auto", lineHeight: 1.7 }}>Visual references and step-by-step tutorials — everything your team needs, in one place.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,440px),1fr))", gap: "clamp(16px,2vw,24px)", marginBottom: "clamp(32px,4vw,48px)" }}>
          {/* Infographics */}
          <div style={{ background: C.light, borderRadius: 24, padding: "clamp(24px,3vw,32px)", opacity: inView ? 1 : 0, transition: "all .6s .1s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(18px,2vw,22px)", fontWeight: 800 }}>🖼️ Infographics</div>
                <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{infographics.length > 0 ? `${infographics.length} visual tersedia` : "Visual reference materials"}</div>
              </div>
              <a href="/landing/infographics" style={{ background: C.primary, color: "white", textDecoration: "none", padding: "8px 16px", borderRadius: 99, fontSize: 12, fontWeight: 700 }}>View All →</a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
              {(infographics.length > 0 ? infographics.slice(0, 3).map(inf => ({ emoji: "🖼️", title: inf.title, tag: inf.tag, color: "#E8F5E9", accent: "#43A047" })) : fallbackInfos).map((inf, i) => (
                <div key={i} style={{ background: inf.color, borderRadius: 14, padding: "clamp(12px,1.5vw,16px)", textAlign: "center", transition: "all .2s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.04)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none" }}>
                  <div style={{ fontSize: "clamp(20px,3vw,28px)", marginBottom: 6 }}>{inf.emoji}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: inf.accent, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{inf.tag}</div>
                  <div style={{ fontSize: "clamp(10px,1.2vw,11px)", fontWeight: 600, color: C.dark, lineHeight: 1.3 }}>{inf.title}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Tutorials */}
          <div style={{ background: C.dark, borderRadius: 24, padding: "clamp(24px,3vw,32px)", color: "white", position: "relative", overflow: "hidden", opacity: inView ? 1 : 0, transition: "all .6s .2s" }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 150, height: 150, borderRadius: "50%", background: `${C.primary}25`, filter: "blur(30px)", pointerEvents: "none" }}/>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(18px,2vw,22px)", fontWeight: 800 }}>📖 Tutorial System</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2 }}>Step-by-step guides</div>
              </div>
              <a href="/landing/tutorials" style={{ background: "rgba(255,255,255,.15)", color: "white", textDecoration: "none", padding: "8px 16px", borderRadius: 99, fontSize: 12, fontWeight: 700, border: "1px solid rgba(255,255,255,.2)" }}>View All →</a>
            </div>
            {(tutorials.length > 0
              ? tutorials.map(t => ({ app: t.app_name, steps: (t.improvements ?? []).reduce((n, imp) => n + (imp.steps?.length ?? 0), 0), emoji: t.emoji }))
              : fallbackTuts
            ).map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "clamp(10px,1.5vw,14px) clamp(12px,1.5vw,16px)", background: "rgba(255,255,255,.07)", borderRadius: 12, marginBottom: 8, border: "1px solid rgba(255,255,255,.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{t.emoji}</span>
                  <span style={{ fontSize: "clamp(13px,1.4vw,14px)", fontWeight: 600 }}>{t.app}</span>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,.4)", fontWeight: 600 }}>{t.steps} steps →</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── FOOTER ────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{ background: "#0A0A0A", color: "white", padding: "clamp(40px,6vw,64px) clamp(20px,5vw,80px) clamp(24px,3vw,32px)" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "clamp(32px,4vw,48px)", marginBottom: "clamp(32px,4vw,48px)" }}>
          <div style={{ maxWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg,${C.green},${C.greenLight})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🌿</div>
              <div>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: 15 }}>PHI Support</div>
                <div style={{ fontSize: 10, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mayora Indah</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#666", lineHeight: 1.7 }}>Digital hub for the Philippines Support Team — SFA, Ficom & Ficom Lite, all in one place.</p>
          </div>
          <div style={{ display: "flex", gap: "clamp(32px,5vw,64px)", flexWrap: "wrap" }}>
            {[
              { title: "Platform",  links: ["SFA","Ficom","Ficom Lite"] },
              { title: "Resources", links: ["Infographics","Tutorials","Updates"] },
              { title: "Company",   links: ["About","Contact","Admin Login"] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>{col.title}</div>
                {col.links.map(l => <div key={l} style={{ fontSize: 13, color: "#777", marginBottom: 8, cursor: "pointer", transition: "color .2s" }} onMouseEnter={e => e.currentTarget.style.color = C.greenLight} onMouseLeave={e => e.currentTarget.style.color = "#777"}>{l}</div>)}
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: "clamp(20px,3vw,28px)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 12 }}>
          <div style={{ fontSize: 12, color: "#444" }}>© 2026 Mayora Indah · PHI Support Team. All rights reserved.</div>
          <div style={{ fontSize: 12, color: "#444" }}>Built with ❤️ for the Philippines team</div>
        </div>
      </div>
    </footer>
  )
}

/* ─── MAIN ───────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: C.dark, overflowX: "hidden", background: C.light }}>
      <PasswordGate/>
      <LandingNav/>
      <Hero/>
      <About/>
      <Applications/>
      <NatureDivider/>
      <Stats/>
      <SupportingPreview/>
      <Footer/>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @keyframes pulse  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(.9)} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(-8px)} }
        @media (max-width: 768px) {
          .floating-cards-wrap { display: none !important; }
          #para-clouds1, #para-clouds2 { display: none; }
        }
        @media (min-width: 769px) { }
      `}</style>
    </div>
  )
}