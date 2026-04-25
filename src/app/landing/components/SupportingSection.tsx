"use client"
import { useState } from "react"

// ── DUMMY DATA ─────────────────────────────────────────────────
const INFOGRAPHICS = [
  { id: 1, title: "SFA User Flow", tag: "SFA", emoji: "🗺️", color: "#E8F5E9", tagColor: "#43A047", desc: "Complete user journey map for SFA daily operations" },
  { id: 2, title: "Ficom Finance Report", tag: "Ficom", emoji: "📊", color: "#FFF3E0", tagColor: "#FB8C00", desc: "Monthly financial reporting infographic" },
  { id: 3, title: "Outlet Coverage Map", tag: "SFA", emoji: "📍", color: "#FCE4EC", tagColor: "#E91E63", desc: "PHI outlet distribution and coverage visualization" },
  { id: 4, title: "Ficom Lite Guide", tag: "Ficom Lite", emoji: "📱", color: "#E3F2FD", tagColor: "#1E88E5", desc: "Quick reference guide for mobile agents" },
  { id: 5, title: "Q1 Performance", tag: "Ficom", emoji: "📈", color: "#F3E5F5", tagColor: "#8E24AA", desc: "Q1 2026 performance summary by region" },
  { id: 6, title: "Training Roadmap", tag: "General", emoji: "🎓", color: "#E0F7FA", tagColor: "#00ACC1", desc: "System training roadmap for new team members" },
]

const APPS_TUTORIAL = [
  {
    id: "sfa", label: "SFA", emoji: "📊",
    sections: [
      { title: "Getting Started", desc: "Learn how to log in, set up your profile, and navigate the SFA dashboard for the first time.", img: "https://placehold.co/600x380/E8F5E9/43A047?text=SFA+Getting+Started" },
      { title: "Daily Check-in", desc: "Step-by-step guide for completing your daily visit check-in, recording notes, and submitting activity reports.", img: "https://placehold.co/600x380/E8F5E9/43A047?text=Daily+Check-in" },
      { title: "Target Tracking", desc: "How to view your daily and monthly targets, track progress, and understand the scoring system.", img: "https://placehold.co/600x380/E8F5E9/43A047?text=Target+Tracking" },
      { title: "Report Generation", desc: "Generate and export your weekly performance reports directly from the dashboard.", img: "https://placehold.co/600x380/E8F5E9/43A047?text=Report+Generation" },
    ]
  },
  {
    id: "ficom", label: "Ficom", emoji: "💰",
    sections: [
      { title: "Dashboard Overview", desc: "Understand the main Ficom dashboard — key modules, navigation, and your role-based access.", img: "https://placehold.co/600x380/FFF3E0/FB8C00?text=Ficom+Dashboard" },
      { title: "Transaction Entry", desc: "How to record daily transactions, select the correct outlet, and validate entries before submission.", img: "https://placehold.co/600x380/FFF3E0/FB8C00?text=Transaction+Entry" },
      { title: "Period Closing", desc: "Step-by-step for period closing procedures including validation, approval workflow, and archiving.", img: "https://placehold.co/600x380/FFF3E0/FB8C00?text=Period+Closing" },
    ]
  },
  {
    id: "ficom-lite", label: "Ficom Lite", emoji: "📱",
    sections: [
      { title: "Mobile Setup", desc: "Install and configure Ficom Lite on your Android device — permissions, sync settings, and offline mode.", img: "https://placehold.co/600x380/E3F2FD/1E88E5?text=Mobile+Setup" },
      { title: "Offline Mode", desc: "How to use Ficom Lite without internet connection and how data syncs when you reconnect.", img: "https://placehold.co/600x380/E3F2FD/1E88E5?text=Offline+Mode" },
      { title: "Quick Submit", desc: "Speed through your daily submissions using the quick submit feature designed for field agents.", img: "https://placehold.co/600x380/E3F2FD/1E88E5?text=Quick+Submit" },
    ]
  },
]

// ── INFOGRAPHICS SECTION ──────────────────────────────────────
function InfographicsGrid() {
  const [popup, setPopup] = useState<number | null>(null)
  const selected = INFOGRAPHICS.find(i => i.id === popup)

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
        {INFOGRAPHICS.map(inf => (
          <div key={inf.id}
            onClick={() => setPopup(inf.id)}
            style={{
              background: inf.color, borderRadius: "20px", padding: "24px",
              cursor: "pointer", transition: "all 0.25s",
              border: "1.5px solid transparent",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-4px)"
              e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.12)"
              e.currentTarget.style.borderColor = inf.tagColor + "40"
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "none"
              e.currentTarget.style.borderColor = "transparent"
            }}
          >
            <div style={{ fontSize: "32px", marginBottom: "12px" }}>{inf.emoji}</div>
            <div style={{
              display: "inline-block", background: inf.tagColor + "20",
              color: inf.tagColor, fontSize: "10px", fontWeight: 700,
              padding: "3px 10px", borderRadius: "99px", marginBottom: "10px",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>{inf.tag}</div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>
              {inf.title}
            </div>
            <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.5 }}>{inf.desc}</div>
            <div style={{ marginTop: "14px", fontSize: "12px", color: inf.tagColor, fontWeight: 600 }}>
              Click to view →
            </div>
          </div>
        ))}
      </div>

      {/* Popup */}
      {popup && selected && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999,
            display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setPopup(null)}
        >
          <div
            style={{
              background: "white", borderRadius: "24px", padding: "0",
              maxWidth: "700px", width: "100%", overflow: "hidden",
              boxShadow: "0 32px 80px rgba(0,0,0,0.3)",
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ background: selected.color, padding: "32px", position: "relative" }}>
              <button onClick={() => setPopup(null)}
                style={{
                  position: "absolute", top: "16px", right: "16px",
                  background: "rgba(0,0,0,0.1)", border: "none", cursor: "pointer",
                  width: "32px", height: "32px", borderRadius: "50%",
                  fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
                }}>×</button>
              <div style={{ fontSize: "40px", marginBottom: "12px" }}>{selected.emoji}</div>
              <div style={{
                display: "inline-block", background: selected.tagColor,
                color: "white", fontSize: "10px", fontWeight: 700,
                padding: "3px 10px", borderRadius: "99px", marginBottom: "10px",
                letterSpacing: "0.1em", textTransform: "uppercase",
              }}>{selected.tag}</div>
              <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "24px", fontWeight: 800 }}>
                {selected.title}
              </div>
            </div>
            {/* Content */}
            <div style={{ padding: "28px 32px" }}>
              <p style={{ fontSize: "15px", color: "#555", lineHeight: 1.7, marginBottom: "20px" }}>{selected.desc}</p>
              <div style={{
                background: "#F5F5F5", borderRadius: "16px", padding: "80px 20px",
                textAlign: "center", color: "#aaa", fontSize: "14px",
              }}>
                📎 Infographic image will display here<br/>
                <span style={{ fontSize: "12px" }}>Uploaded via admin dashboard</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── TUTORIAL SYSTEM ───────────────────────────────────────────
function TutorialSystem() {
  const [selectedApp, setSelectedApp] = useState("sfa")
  const [activeSection, setActiveSection] = useState(0)
  const app = APPS_TUTORIAL.find(a => a.id === selectedApp)!
  const section = app.sections[activeSection]

  return (
    <div>
      {/* App dropdown */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "32px", flexWrap: "wrap" }}>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#888", display: "flex", alignItems: "center", marginRight: "8px" }}>
          Select App:
        </div>
        {APPS_TUTORIAL.map(a => (
          <button key={a.id}
            onClick={() => { setSelectedApp(a.id); setActiveSection(0) }}
            style={{
              background: selectedApp === a.id ? "#1a1a1a" : "white",
              color: selectedApp === a.id ? "white" : "#444",
              border: "1.5px solid " + (selectedApp === a.id ? "#1a1a1a" : "#E0E0E0"),
              borderRadius: "99px", padding: "8px 20px", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 600,
              transition: "all 0.2s", display: "flex", alignItems: "center", gap: "6px",
            }}>
            {a.emoji} {a.label}
          </button>
        ))}
      </div>

      {/* Tutorial layout */}
      <div style={{
        display: "grid", gridTemplateColumns: "260px 1fr", gap: "24px",
        background: "white", borderRadius: "24px", overflow: "hidden",
        border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.06)",
      }}>
        {/* Left: section list */}
        <div style={{ background: "#FAFAF8", padding: "24px 0", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
          <div style={{ padding: "0 20px 16px", fontSize: "11px", fontWeight: 700, color: "#999", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {app.label} Tutorials
          </div>
          {app.sections.map((s, i) => (
            <div key={i}
              onClick={() => setActiveSection(i)}
              style={{
                padding: "12px 20px", cursor: "pointer",
                background: activeSection === i ? "white" : "transparent",
                borderRight: activeSection === i ? "3px solid #FF4B26" : "3px solid transparent",
                transition: "all 0.2s",
                display: "flex", alignItems: "center", gap: "10px",
              }}
              onMouseEnter={e => { if (activeSection !== i) e.currentTarget.style.background = "rgba(0,0,0,0.03)" }}
              onMouseLeave={e => { if (activeSection !== i) e.currentTarget.style.background = "transparent" }}
            >
              <div style={{
                width: "24px", height: "24px", borderRadius: "50%", flexShrink: 0,
                background: activeSection === i ? "#FF4B26" : "#E0E0E0",
                color: activeSection === i ? "white" : "#888",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "11px", fontWeight: 700, transition: "all 0.2s",
              }}>{i + 1}</div>
              <span style={{
                fontSize: "13px", fontWeight: activeSection === i ? 700 : 400,
                color: activeSection === i ? "#1a1a1a" : "#555",
              }}>{s.title}</span>
            </div>
          ))}
        </div>

        {/* Right: content */}
        <div style={{ padding: "32px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            background: "rgba(255,75,38,0.08)", borderRadius: "99px",
            padding: "4px 12px", marginBottom: "16px",
          }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#FF4B26", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Step {activeSection + 1} of {app.sections.length}
            </span>
          </div>
          <h3 style={{
            fontFamily: "'Bricolage Grotesque', sans-serif",
            fontSize: "24px", fontWeight: 800, marginBottom: "12px",
          }}>{section.title}</h3>
          <p style={{ fontSize: "15px", color: "#555", lineHeight: 1.7, marginBottom: "24px" }}>
            {section.desc}
          </p>
          {/* Image */}
          <div style={{ borderRadius: "16px", overflow: "hidden", marginBottom: "24px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={section.img} alt={section.title} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
          {/* Navigation */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => setActiveSection(i => Math.max(0, i - 1))}
              disabled={activeSection === 0}
              style={{
                background: "transparent", border: "1.5px solid #E0E0E0", borderRadius: "99px",
                padding: "10px 24px", cursor: activeSection === 0 ? "not-allowed" : "pointer",
                fontSize: "14px", fontWeight: 600, color: activeSection === 0 ? "#ccc" : "#444",
                transition: "all 0.2s",
              }}>← Previous</button>
            <button
              onClick={() => setActiveSection(i => Math.min(app.sections.length - 1, i + 1))}
              disabled={activeSection === app.sections.length - 1}
              style={{
                background: activeSection === app.sections.length - 1 ? "#E0E0E0" : "linear-gradient(135deg,#FF4B26,#FF8C42)",
                border: "none", borderRadius: "99px",
                padding: "10px 24px", cursor: activeSection === app.sections.length - 1 ? "not-allowed" : "pointer",
                fontSize: "14px", fontWeight: 600, color: "white",
                boxShadow: activeSection === app.sections.length - 1 ? "none" : "0 6px 20px rgba(255,75,38,0.35)",
                transition: "all 0.2s",
              }}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN SUPPORTING SECTION ───────────────────────────────────
export default function SupportingSection() {
  const [tab, setTab] = useState<"infographics" | "tutorial">("infographics")

  return (
    <div style={{ padding: "100px 5%", background: "#FAFAF8" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "60px" }}>
        <div style={{
          display: "inline-block", background: "rgba(255,75,38,0.08)", borderRadius: "99px",
          padding: "5px 16px", fontSize: "12px", fontWeight: 700, color: "#FF4B26",
          letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "16px",
        }}>🎓 Supporting Materials</div>
        <h2 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(32px,5vw,52px)",
          fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "14px",
        }}>
          Learn, Reference,<br/>
          <span style={{ background: "linear-gradient(135deg,#FF4B26,#FF8C42)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            and Grow
          </span>
        </h2>
        <p style={{ color: "#666", fontSize: "16px", maxWidth: "480px", margin: "0 auto" }}>
          Visual references and step-by-step tutorials — everything your team needs, in one place.
        </p>
      </div>

      {/* Tab toggle */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "48px" }}>
        <div style={{ display: "flex", background: "white", borderRadius: "14px", padding: "4px", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          {[
            { key: "infographics", label: "🖼️ Infographics" },
            { key: "tutorial", label: "📖 Tutorial System" },
          ].map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key as "infographics" | "tutorial")}
              style={{
                background: tab === t.key ? "linear-gradient(135deg,#FF4B26,#FF8C42)" : "transparent",
                color: tab === t.key ? "white" : "#666",
                border: "none", borderRadius: "10px", padding: "10px 28px",
                cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px", fontWeight: 600, transition: "all 0.25s",
                boxShadow: tab === t.key ? "0 4px 12px rgba(255,75,38,0.3)" : "none",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {tab === "infographics" ? <InfographicsGrid /> : <TutorialSystem />}
      </div>
    </div>
  )
}