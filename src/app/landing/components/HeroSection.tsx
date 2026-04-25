"use client"
import { useEffect, useState } from "react"

const FLOATING_CARDS = [
  { emoji: "📊", label: "SFA Dashboard", sub: "98.2% uptime", color: "#E8F5E9", accent: "#43A047", x: "8%", y: "22%", delay: "0s" },
  { emoji: "💰", label: "Ficom Finance", sub: "Live tracking", color: "#FFF3E0", accent: "#FB8C00", x: "80%", y: "18%", delay: "0.8s" },
  { emoji: "📱", label: "Ficom Lite", sub: "Mobile ready", color: "#E3F2FD", accent: "#1E88E5", x: "75%", y: "62%", delay: "1.4s" },
  { emoji: "🎯", label: "Target Hit", sub: "↑ 24% this month", color: "#FCE4EC", accent: "#E91E63", x: "6%", y: "65%", delay: "0.4s" },
]

const STATS = [
  { num: "3", label: "Apps Supported", icon: "📦" },
  { num: "120+", label: "Active Users", icon: "👥" },
  { num: "99.1%", label: "System Uptime", icon: "⚡" },
  { num: "24/7", label: "Support Ready", icon: "🛡️" },
]

const MARQUEE_ITEMS = ["SFA", "Ficom", "Ficom Lite", "PHI Team", "Mayora Indah", "Sales Force", "Finance Module", "Utilisation"]

export default function HeroSection() {
  const [mounted, setMounted] = useState(false)
  const [typed, setTyped] = useState("")
  const words = ["Efficiency", "Clarity", "Momentum", "Excellence"]
  const [wordIdx, setWordIdx] = useState(0)
  const [charIdx, setCharIdx] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const word = words[wordIdx]
    const timer = setTimeout(() => {
      if (!deleting) {
        if (charIdx < word.length) { setTyped(word.slice(0, charIdx + 1)); setCharIdx(c => c + 1) }
        else { setTimeout(() => setDeleting(true), 1800) }
      } else {
        if (charIdx > 0) { setTyped(word.slice(0, charIdx - 1)); setCharIdx(c => c - 1) }
        else { setDeleting(false); setWordIdx(i => (i + 1) % words.length) }
      }
    }, deleting ? 60 : 90)
    return () => clearTimeout(timer)
  }, [charIdx, deleting, wordIdx])

  return (
    <div style={{
      minHeight: "100vh", position: "relative",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "100px 5% 60px",
      background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(255,140,66,0.12) 0%, rgba(255,75,38,0.06) 40%, transparent 70%), #FAFAF8",
      overflow: "hidden",
    }}>
      {/* Grid pattern */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(circle, rgba(0,0,0,0.05) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
        maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
      }}/>

      {/* Floating blob */}
      <div style={{
        position: "absolute", top: "10%", left: "20%",
        width: "500px", height: "500px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,140,66,0.15) 0%, transparent 70%)",
        filter: "blur(40px)", animation: "float 8s ease-in-out infinite", pointerEvents: "none",
      }}/>
      <div style={{
        position: "absolute", bottom: "15%", right: "15%",
        width: "400px", height: "400px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,75,38,0.1) 0%, transparent 70%)",
        filter: "blur(40px)", animation: "floatR 10s ease-in-out infinite", pointerEvents: "none",
      }}/>

      {/* Floating cards */}
      {mounted && FLOATING_CARDS.map((card, i) => (
        <div key={i} style={{
          position: "absolute", left: card.x, top: card.y,
          background: "white", borderRadius: "16px", padding: "14px 18px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
          border: `1.5px solid ${card.color}`,
          animation: `float 6s ease-in-out ${card.delay} infinite`,
          minWidth: "160px", zIndex: 2,
          display: "flex", alignItems: "center", gap: "10px",
        }}>
          <div style={{
            width: "38px", height: "38px", borderRadius: "10px",
            background: card.color, display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "18px", flexShrink: 0,
          }}>{card.emoji}</div>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a1a" }}>{card.label}</div>
            <div style={{ fontSize: "11px", color: card.accent, fontWeight: 600 }}>{card.sub}</div>
          </div>
        </div>
      ))}

      {/* Main content */}
      <div style={{ textAlign: "center", maxWidth: "780px", position: "relative", zIndex: 3 }}>
        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "8px",
          background: "rgba(255,75,38,0.08)", border: "1.5px solid rgba(255,75,38,0.2)",
          borderRadius: "99px", padding: "6px 16px", marginBottom: "28px",
          animation: mounted ? "fadeUp 0.6s ease forwards" : "none",
        }}>
          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FF4B26", animation: "pulse 2s infinite", display: "block" }}/>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#FF4B26" }}>PHI Team Digital Hub — Mayora Indah</span>
        </div>

        <h1 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: "clamp(42px, 7vw, 84px)", fontWeight: 800, lineHeight: 1.05,
          letterSpacing: "-0.03em", marginBottom: "16px",
          animation: mounted ? "fadeUp 0.7s 0.1s ease both" : "none",
        }}>
          Drive{" "}
          <span style={{
            background: "linear-gradient(135deg, #FF4B26, #FF8C42)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            {typed}<span style={{ animation: "blink 1s infinite", WebkitTextFillColor: "#FF4B26" }}>|</span>
          </span>
          <br />with Every Tool
        </h1>

        <p style={{
          fontSize: "18px", color: "#666", lineHeight: 1.7, maxWidth: "560px", margin: "0 auto 36px",
          animation: mounted ? "fadeUp 0.7s 0.2s ease both" : "none",
        }}>
          Your all-in-one support hub for <strong style={{ color: "#1a1a1a" }}>SFA</strong>,{" "}
          <strong style={{ color: "#1a1a1a" }}>Ficom</strong>, and{" "}
          <strong style={{ color: "#1a1a1a" }}>Ficom Lite</strong> — built to empower the Philippines team
          with real-time insights, tutorials, and resources.
        </p>

        <div style={{
          display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap",
          animation: mounted ? "fadeUp 0.7s 0.3s ease both" : "none",
        }}>
          <button style={{
            background: "linear-gradient(135deg, #FF4B26, #FF8C42)",
            border: "none", cursor: "pointer",
            padding: "14px 32px", borderRadius: "99px",
            fontSize: "15px", fontWeight: 600, color: "white",
            boxShadow: "0 8px 24px rgba(255,75,38,0.4)",
            transition: "all 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(255,75,38,0.5)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(255,75,38,0.4)" }}
            onClick={() => document.getElementById("utilisation")?.scrollIntoView({ behavior: "smooth" })}
          >
            Explore Utilisation ↓
          </button>
          <button style={{
            background: "white", border: "1.5px solid rgba(0,0,0,0.1)", cursor: "pointer",
            padding: "14px 32px", borderRadius: "99px",
            fontSize: "15px", fontWeight: 500, color: "#333",
            transition: "all 0.2s", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = "#FF4B26"; e.currentTarget.style.color = "#FF4B26" }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,0,0,0.1)"; e.currentTarget.style.color = "#333" }}
            onClick={() => document.getElementById("supporting")?.scrollIntoView({ behavior: "smooth" })}
          >
            View Tutorials →
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px",
        maxWidth: "900px", width: "100%", marginTop: "80px", position: "relative", zIndex: 3,
        animation: mounted ? "fadeUp 0.7s 0.4s ease both" : "none",
      }}>
        {STATS.map((s, i) => (
          <div key={i} style={{
            background: "white", borderRadius: "20px", padding: "20px 16px",
            textAlign: "center", boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            border: "1px solid rgba(0,0,0,0.05)",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.1)" }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.06)" }}
          >
            <div style={{ fontSize: "22px", marginBottom: "6px" }}>{s.icon}</div>
            <div style={{
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: "28px", fontWeight: 800, color: "#1a1a1a", lineHeight: 1,
            }}>{s.num}</div>
            <div style={{ fontSize: "12px", color: "#888", marginTop: "4px", fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Marquee */}
      <div style={{ width: "100%", overflow: "hidden", marginTop: "60px", opacity: 0.35 }}>
        <div style={{ display: "flex", animation: "marquee 20s linear infinite", whiteSpace: "nowrap", width: "max-content" }}>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} style={{
              padding: "0 32px", fontSize: "13px", fontWeight: 700,
              letterSpacing: "0.15em", textTransform: "uppercase", color: "#1a1a1a",
            }}>
              {item} <span style={{ color: "#FF4B26", marginLeft: "32px" }}>✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}