"use client"
import { useState, useEffect } from "react"

const PASSWORD = "myr"
const STORAGE_KEY = "phi_landing_auth"

function Illustration({ unlocked }: { unlocked: boolean }) {
  return (
    <svg viewBox="0 0 200 180" style={{ width: "clamp(120px,18vw,180px)", display: "block" }}>
      <defs>
        <linearGradient id="rG2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E8381A"/>
          <stop offset="100%" stopColor="#FF6B4A"/>
        </linearGradient>
        <linearGradient id="dG2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a2e"/>
          <stop offset="100%" stopColor="#16213e"/>
        </linearGradient>
      </defs>

      {/* Floating dots */}
      <circle cx="20" cy="30" r="5" fill="#E8381A" opacity="0.5">
        <animate attributeName="cy" values="30;22;30" dur="3s" repeatCount="indefinite"/>
      </circle>
      <circle cx="180" cy="25" r="4" fill="#52b788" opacity="0.6">
        <animate attributeName="cy" values="25;17;25" dur="2.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="170" cy="145" r="4" fill="#FB8C00" opacity="0.5">
        <animate attributeName="cy" values="145;137;145" dur="3.5s" repeatCount="indefinite"/>
      </circle>
      <circle cx="18" cy="130" r="3" fill="#1E88E5" opacity="0.5">
        <animate attributeName="cy" values="130;122;130" dur="2.8s" repeatCount="indefinite"/>
      </circle>

      {/* Building */}
      <rect x="50" y="75" width="100" height="70" rx="6" fill="url(#dG2)"/>
      <rect x="56" y="82" width="20" height="16" rx="2" fill="#1E88E5" opacity="0.8"/>
      <rect x="82" y="82" width="20" height="16" rx="2" fill="#1E88E5" opacity="0.9"/>
      <rect x="108" y="82" width="20" height="16" rx="2" fill="#1E88E5" opacity="0.7"/>
      <rect x="56" y="104" width="20" height="16" rx="2" fill="#1E88E5" opacity="0.6"/>
      <rect x="82" y="104" width="20" height="16" rx="2" fill="#1E88E5" opacity="0.9"/>
      <rect x="108" y="104" width="20" height="16" rx="2" fill="#1E88E5" opacity="0.5"/>
      <rect x="82" y="124" width="24" height="21" rx="3" fill="#0f3460"/>

      {/* Shield */}
      <g style={{ transform: "translate(100px, 58px)" }}>
        <path d="M0,-18 L14,-11 L14,5 Q14,17 0,22 Q-14,17 -14,5 L-14,-11 Z"
          fill={unlocked ? "#43A047" : "url(#rG2)"}
          style={{ transition: "fill 0.4s ease" }}/>
        {unlocked ? (
          <path d="M-5,2 L-1,6 L7,-5" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <animate attributeName="stroke-dasharray" values="0,25;25,25" dur="0.3s" fill="freeze"/>
          </path>
        ) : (
          <>
            <rect x="-5" y="-2" width="10" height="8" rx="2" fill="white" opacity="0.9"/>
            <path d="M-3,-2 L-3,-5 Q0,-9 3,-5 L3,-2" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
            <circle cx="0" cy="3" r="1.5" fill="#E8381A"/>
          </>
        )}
      </g>

      {/* Pulse ring when unlocked */}
      {unlocked && (
        <circle cx="100" cy="58" r="22" fill="none" stroke="#43A047" strokeWidth="2" opacity="0">
          <animate attributeName="r" values="18;32;18" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.7;0;0.7" dur="1.5s" repeatCount="indefinite"/>
        </circle>
      )}

      {/* Ground + people */}
      <line x1="20" y1="145" x2="180" y2="145" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
      <g opacity="0.6">
        <circle cx="72" cy="141" r="4" fill="rgba(255,255,255,0.7)"/>
        <path d="M66,145 L78,145" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round"/>
      </g>
      <g opacity="0.4">
        <circle cx="130" cy="140" r="3" fill="rgba(255,255,255,0.7)"/>
        <path d="M125,145 L135,145" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round"/>
      </g>

      {/* Stars when unlocked */}
      {unlocked && (
        <>
          <text x="28" y="52" fontSize="14" style={{ animation: "popIn 0.3s ease both" }}>✨</text>
          <text x="155" y="48" fontSize="11" style={{ animation: "popIn 0.4s 0.1s ease both" }}>⭐</text>
        </>
      )}
    </svg>
  )
}

const EGLogo = () => (
  <div style={{ width: "36px", height: "36px", borderRadius: "9px", background: "linear-gradient(135deg, #2d6a4f, #52b788)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 10px rgba(45,106,79,0.4)", flexShrink: 0 }}>
    <svg width="36" height="36" viewBox="0 0 32 32" fill="none">
      <text x="4" y="23" fontFamily="Arial,sans-serif" fontWeight="900" fontSize="19" fill="white" letterSpacing="-0.5">EG</text>
      <circle cx="28" cy="6" r="2.5" fill="white" opacity="0.7"/>
    </svg>
  </div>
)

export default function PasswordGate() {
  const [auth, setAuth]       = useState<boolean | null>(null)
  const [input, setInput]     = useState("")
  const [error, setError]     = useState(false)
  const [shake, setShake]     = useState(false)
  const [success, setSuccess] = useState(false)
  const [show, setShow]       = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY)
    if (saved === "true") {
      setAuth(true)
    } else {
      setAuth(false)
      setTimeout(() => setVisible(true), 80)
    }
  }, [])

  const submit = () => {
    if (input.toLowerCase().trim() === PASSWORD) {
      setSuccess(true)
      setTimeout(() => {
        setVisible(false)
        setTimeout(() => {
          sessionStorage.setItem(STORAGE_KEY, "true")
          setAuth(true)
        }, 400)
      }, 900)
    } else {
      setError(true); setShake(true)
      setTimeout(() => setShake(false), 600)
      setTimeout(() => setError(false), 2500)
      setInput("")
    }
  }

  // Authenticated or loading — render nothing (children show through)
  if (auth !== false) return null

  return (
    <>
      {/* Overlay */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "clamp(16px,3vw,32px)",
        opacity: visible ? 1 : 0,
        transition: "opacity 0.3s ease",
      }}>
        {/* Modal card */}
        <div style={{
          background: "rgba(18,18,20,0.95)",
          borderRadius: "clamp(18px,3vw,28px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)",
          overflow: "hidden",
          maxWidth: "800px", width: "100%",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          animation: shake ? "shake 0.5s ease" : "modalIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
        }} className="phi-gate-card">

          {/* Left: dark illustration panel */}
          <div className="gate-illus-panel" style={{
            padding: "clamp(32px,5vw,52px) clamp(20px,3vw,36px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            background: "linear-gradient(135deg, rgba(232,56,26,0.15) 0%, rgba(255,107,74,0.08) 50%, transparent 100%)",
            position: "relative", overflow: "hidden",
            borderRight: "1px solid rgba(255,255,255,0.06)",
          }}>
            {/* Glow */}
            <div style={{ position: "absolute", top: "10%", left: "20%", width: "160px", height: "160px", borderRadius: "50%", background: "radial-gradient(circle, rgba(232,56,26,0.2), transparent 70%)", filter: "blur(30px)", pointerEvents: "none", animation: "glowPulse 3s ease-in-out infinite" }} />

            <Illustration unlocked={success} />

            <div style={{ textAlign: "center", marginTop: "clamp(12px,2vw,20px)" }}>
              <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(15px,1.8vw,18px)", fontWeight: 800, color: "white", marginBottom: "6px" }}>
                {success ? "Welcome! 🎉" : "PHI Support Hub"}
              </div>
              <p style={{ fontSize: "clamp(11px,1.1vw,12px)", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, maxWidth: "160px" }}>
                {success ? "Preparing your workspace..." : "Exclusive hub for the Mayora Philippines team"}
              </p>
            </div>
          </div>

          {/* Right: form */}
          <div style={{ padding: "clamp(28px,4vw,48px) clamp(20px,3.5vw,40px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "clamp(20px,3vw,28px)" }}>
              <EGLogo />
              <div>
                <div style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 800, fontSize: "14px", lineHeight: 1, color: "white" }}>Elite Global</div>
                <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.4)", letterSpacing: "0.1em", textTransform: "uppercase" }}>PHI Support Hub</div>
              </div>
            </div>

            <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(18px,2.2vw,24px)", fontWeight: 900, color: success ? "#52b788" : "white", marginBottom: "8px", letterSpacing: "-0.02em", lineHeight: 1.2, transition: "color 0.3s" }}>
              {success ? "Access Granted ✓" : "Restricted Access"}
            </h2>
            <p style={{ fontSize: "clamp(12px,1.2vw,13px)", color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: "clamp(18px,2.5vw,24px)" }}>
              Authorized Mayora Indah Philippines team members only.
            </p>

            {!success ? (
              <>
                <div style={{ marginBottom: "12px" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "8px" }}>Access Password</div>
                  <div style={{ position: "relative" }}>
                    <input
                      type={show ? "text" : "password"}
                      value={input}
                      onChange={e => { setInput(e.target.value); setError(false) }}
                      onKeyDown={e => e.key === "Enter" && submit()}
                      placeholder="Enter password..."
                      autoFocus
                      style={{
                        width: "100%",
                        padding: "clamp(11px,1.4vw,13px) 48px clamp(11px,1.4vw,13px) clamp(13px,1.5vw,16px)",
                        borderRadius: "12px",
                        fontSize: "clamp(14px,1.4vw,15px)",
                        border: `1.5px solid ${error ? "#E8381A" : "rgba(255,255,255,0.12)"}`,
                        outline: "none",
                        fontFamily: "'DM Sans',sans-serif",
                        background: "rgba(255,255,255,0.07)",
                        color: "white",
                        transition: "border-color 0.2s, background 0.2s",
                        letterSpacing: show ? "normal" : "0.2em",
                        boxSizing: "border-box" as const,
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = "#E8381A"; e.currentTarget.style.background = "rgba(255,255,255,0.1)" }}
                      onBlur={e => { if (!error) { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.background = "rgba(255,255,255,0.07)" } }}
                    />
                    <button onClick={() => setShow(v => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "15px", opacity: 0.6 }}>
                      {show ? "🙈" : "👁️"}
                    </button>
                  </div>
                  {error && <div style={{ fontSize: "11px", color: "#FF6B4A", fontWeight: 600, marginTop: "7px" }}>❌ Incorrect password. Please try again.</div>}
                </div>
                <button onClick={submit}
                  style={{ width: "100%", padding: "clamp(11px,1.4vw,13px)", borderRadius: "12px", background: "linear-gradient(135deg, #E8381A, #FF6B4A)", border: "none", cursor: "pointer", fontSize: "clamp(13px,1.3vw,14px)", fontWeight: 700, color: "white", fontFamily: "'DM Sans',sans-serif", boxShadow: "0 6px 20px rgba(232,56,26,0.4)", transition: "all 0.2s", marginBottom: "14px" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 10px 28px rgba(232,56,26,0.5)" }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(232,56,26,0.4)" }}>
                  Access Hub →
                </button>
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px 16px", background: "rgba(82,183,136,0.15)", borderRadius: "12px", border: "1px solid rgba(82,183,136,0.3)", marginBottom: "14px" }}>
                <div style={{ fontSize: "18px", animation: "spin 1s linear infinite" }}>⏳</div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "#52b788" }}>Loading your workspace...</div>
              </div>
            )}

            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", textAlign: "center" }}>
              © 2026 Mayora Indah · PHI Support Team
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-10px)} 40%{transform:translateX(10px)} 60%{transform:translateX(-7px)} 80%{transform:translateX(7px)} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.88) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes glowPulse { 0%,100%{opacity:0.6;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes popIn { from{opacity:0;transform:scale(0)} to{opacity:1;transform:scale(1)} }
        @media (max-width: 600px) { .phi-gate-card { grid-template-columns: 1fr !important; } .gate-illus-panel { display: none !important; } }
      ` }} />
    </>
  )
}