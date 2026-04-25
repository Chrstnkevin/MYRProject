"use client"
import { useState, useEffect } from "react"

const NAV = [
  { id: "home", label: "Home" },
  { id: "utilisation", label: "Utilisation" },
  { id: "supporting", label: "Supporting" },
]

export default function NavBar({ active, onNav }: { active: string; onNav: (id: string) => void }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      padding: "0 5%",
      background: scrolled ? "rgba(250,250,248,0.92)" : "transparent",
      backdropFilter: scrolled ? "blur(12px)" : "none",
      borderBottom: scrolled ? "1px solid rgba(0,0,0,0.06)" : "none",
      transition: "all 0.3s ease",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "68px",
    }}>
      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => onNav("home")}>
        <div style={{
          width: "34px", height: "34px", borderRadius: "10px",
          background: "linear-gradient(135deg, #FF4B26, #FF8C42)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 12px rgba(255,75,38,0.35)",
        }}>
          <span style={{ fontSize: "16px" }}>🍃</span>
        </div>
        <div>
          <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "15px", lineHeight: 1 }}>PHI Support</div>
          <div style={{ fontSize: "9px", color: "#888", letterSpacing: "0.12em", textTransform: "uppercase" }}>Mayora Indah</div>
        </div>
      </div>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        {NAV.map(n => (
          <button key={n.id} onClick={() => onNav(n.id)}
            style={{
              background: active === n.id ? "rgba(255,75,38,0.1)" : "transparent",
              border: "none", cursor: "pointer",
              padding: "7px 16px", borderRadius: "99px",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: "14px", fontWeight: active === n.id ? 600 : 400,
              color: active === n.id ? "#FF4B26" : "#444",
              transition: "all 0.2s",
            }}>
            {n.label}
          </button>
        ))}
        <button style={{
          marginLeft: "8px",
          background: "linear-gradient(135deg, #FF4B26, #FF8C42)",
          border: "none", cursor: "pointer",
          padding: "8px 20px", borderRadius: "99px",
          fontFamily: "'DM Sans', sans-serif",
          fontSize: "13px", fontWeight: 600, color: "white",
          boxShadow: "0 4px 14px rgba(255,75,38,0.3)",
          transition: "all 0.2s",
        }}
          onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-1px)")}
          onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
          onClick={() => onNav("supporting")}
        >
          Get Started →
        </button>
      </div>
    </nav>
  )
}