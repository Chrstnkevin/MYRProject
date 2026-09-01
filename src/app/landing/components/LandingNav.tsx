"use client"
import { useState, useEffect } from "react"

const C = { primary: "#E8381A", dark: "#111111", gray: "#6B7280", grayLight: "#F4F4F2", border: "rgba(0,0,0,0.08)" }

const NAV_LINKS = [
  { label: "Home",          href: "/landing" },
  { label: "About",         href: "/landing/about" },
  { label: "Applications",  href: "/landing/applications" },
  { label: "Utilisation",   href: "/landing/utilisation" },
  { label: "Data Transfer", href: "/landing/data-transfer" },
  { label: "Req Fileset",   href: "/landing/req-fileset" },
  { label: "Tutorials",     href: "/landing/tutorials" },
  { label: "Infographic",   href: "/landing/infographics" },
]

export default function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pathname, setPathname] = useState("")

  useEffect(() => {
    setPathname(window.location.pathname)
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener("scroll", fn, { passive: true })
    return () => window.removeEventListener("scroll", fn)
  }, [])

  const isActive = (href: string) =>
    href === "/landing" ? pathname === "/landing" : pathname.startsWith(href)

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        height: "64px",
        background: scrolled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(16px)",
        borderBottom: `1px solid ${scrolled ? C.border : "transparent"}`,
        transition: "all 0.3s",
        padding: "0 clamp(16px,5vw,80px)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo */}
        <a href="/landing" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: "linear-gradient(135deg, #2d6a4f, #52b788)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(45,106,79,0.3)", flexShrink: 0 }}>
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none"><text x="4" y="23" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="19" fill="white" letterSpacing="-0.5">EG</text><circle cx="28" cy="6" r="2.5" fill="white" opacity="0.7"/></svg>
          </div>
          <div>
            <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "14px", lineHeight: 1, color: C.dark }}>Elite Global</div>
            <div style={{ fontSize: "9px", color: C.gray, letterSpacing: "0.1em", textTransform: "uppercase" }}>PHI Support Hub</div>
          </div>
        </a>

        {/* Desktop nav */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }} className="landing-desktop-nav">
          {NAV_LINKS.map(n => (
            <a key={n.href} href={n.href}
              style={{
                padding: "7px 14px", borderRadius: "8px", fontSize: "14px",
                fontWeight: isActive(n.href) ? 700 : 500,
                color: isActive(n.href) ? C.primary : C.dark,
                background: isActive(n.href) ? `${C.primary}10` : "transparent",
                textDecoration: "none", transition: "all 0.15s", display: "inline-block",
                fontFamily: "'DM Sans',sans-serif",
              }}
              onMouseEnter={e => { if (!isActive(n.href)) e.currentTarget.style.background = C.grayLight }}
              onMouseLeave={e => { if (!isActive(n.href)) e.currentTarget.style.background = "transparent" }}>
              {n.label}
            </a>
          ))}
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMenuOpen(v => !v)} className="landing-mobile-btn"
          style={{ background: "none", border: `1.5px solid ${C.border}`, borderRadius: "8px", padding: "6px 10px", cursor: "pointer", display: "none", flexDirection: "column", gap: "4px" }}>
          <div style={{ width: "18px", height: "2px", background: C.dark, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(3px, 3px)" : "none" }} />
          <div style={{ width: "18px", height: "2px", background: C.dark, opacity: menuOpen ? 0 : 1, transition: "all 0.2s" }} />
          <div style={{ width: "18px", height: "2px", background: C.dark, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(3px, -3px)" : "none" }} />
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{ position: "fixed", top: "64px", left: 0, right: 0, zIndex: 99, background: "white", borderBottom: `1px solid ${C.border}`, padding: "12px 24px 20px", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
          {NAV_LINKS.map(n => (
            <a key={n.href} href={n.href}
              style={{ display: "block", padding: "12px 0", fontSize: "16px", fontWeight: isActive(n.href) ? 700 : 500, color: isActive(n.href) ? C.primary : C.dark, borderBottom: `1px solid ${C.border}`, textDecoration: "none", fontFamily: "'DM Sans',sans-serif" }}>
              {n.label}
            </a>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .landing-desktop-nav { display: none !important; }
          .landing-mobile-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .landing-mobile-btn { display: none !important; }
        }
      `}</style>
    </>
  )
}