"use client"
import { useState } from "react"

const APPS = [
  {
    id: "sfa", label: "SFA", emoji: "📊", color: "#43A047", bg: "#E8F5E9",
    desc: "Sales Force Automation — track targets, visits, and performance across all channels.",
    metrics: [
      { label: "Daily Active Users", value: 87, unit: "%", color: "#43A047" },
      { label: "Target Achievement", value: 92, unit: "%", color: "#66BB6A" },
      { label: "Visit Completion", value: 78, unit: "%", color: "#A5D6A7" },
    ],
    chartData: [65, 72, 68, 81, 75, 88, 92, 87, 90, 85, 94, 92],
    stats: [{ icon: "👤", num: "45+", label: "Users" }, { icon: "📍", num: "1.2k", label: "Visits/mo" }, { icon: "🎯", num: "92%", label: "Target hit" }],
  },
  {
    id: "ficom", label: "Ficom", emoji: "💰", color: "#FB8C00", bg: "#FFF3E0",
    desc: "Finance & Commerce module — manage transactions, outlets, and financial reporting in real time.",
    metrics: [
      { label: "Transaction Success", value: 96, unit: "%", color: "#FB8C00" },
      { label: "Outlet Coverage", value: 84, unit: "%", color: "#FFA726" },
      { label: "Report Accuracy", value: 99, unit: "%", color: "#FFCC02" },
    ],
    chartData: [78, 82, 79, 91, 88, 93, 96, 94, 97, 95, 98, 96],
    stats: [{ icon: "🏪", num: "320+", label: "Outlets" }, { icon: "💳", num: "15k", label: "Trans/mo" }, { icon: "📈", num: "99%", label: "Accuracy" }],
  },
  {
    id: "ficom-lite", label: "Ficom Lite", emoji: "📱", color: "#1E88E5", bg: "#E3F2FD",
    desc: "Lightweight mobile-first version of Ficom — designed for field agents on the go.",
    metrics: [
      { label: "Mobile Adoption", value: 71, unit: "%", color: "#1E88E5" },
      { label: "Sync Success Rate", value: 98, unit: "%", color: "#42A5F5" },
      { label: "Offline Capability", value: 85, unit: "%", color: "#90CAF9" },
    ],
    chartData: [45, 52, 58, 63, 61, 68, 71, 74, 72, 78, 75, 71],
    stats: [{ icon: "📱", num: "30+", label: "Agents" }, { icon: "🔄", num: "98%", label: "Sync rate" }, { icon: "⚡", num: "< 2s", label: "Load time" }],
  },
]

function MiniChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const h = 60; const w = 280
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / (max - min || 1)) * h * 0.85 - 4
    return `${x},${y}`
  }).join(" ")
  const area = `0,${h} ${pts} ${w},${h}`

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={`g-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#g-${color.replace("#","")})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      {data.map((v, i) => {
        const x = (i / (data.length - 1)) * w
        const y = h - ((v - min) / (max - min || 1)) * h * 0.85 - 4
        return i === data.length - 1
          ? <circle key={i} cx={x} cy={y} r="4" fill={color} stroke="white" strokeWidth="2"/>
          : null
      })}
    </svg>
  )
}

function CircleProgress({ value, color, label, unit }: { value: number; color: string; label: string; unit: string }) {
  const r = 32; const circ = 2 * Math.PI * r
  const dash = (value / 100) * circ
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      <svg width="80" height="80" style={{ flexShrink: 0 }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#F0F0F0" strokeWidth="7"/>
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1s ease" }}
        />
        <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="800" fill="#1a1a1a">{value}{unit}</text>
      </svg>
      <div style={{ fontSize: "13px", fontWeight: 600, color: "#444", lineHeight: 1.4 }}>{label}</div>
    </div>
  )
}

export default function UtilisationSection() {
  const [active, setActive] = useState("sfa")
  const app = APPS.find(a => a.id === active)!
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

  return (
    <div style={{ padding: "100px 5%", background: "white" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "60px" }}>
        <div style={{
          display: "inline-block", background: "rgba(255,75,38,0.08)", borderRadius: "99px",
          padding: "5px 16px", fontSize: "12px", fontWeight: 700, color: "#FF4B26",
          letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "16px",
        }}>📊 System Utilisation</div>
        <h2 style={{
          fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(32px,5vw,52px)",
          fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: "14px",
        }}>
          Real-time Performance<br/>
          <span style={{ background: "linear-gradient(135deg,#FF4B26,#FF8C42)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            at a Glance
          </span>
        </h2>
        <p style={{ color: "#666", fontSize: "16px", maxWidth: "500px", margin: "0 auto" }}>
          Live utilisation data across all three platforms — updated daily by the admin team.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "48px" }}>
        {APPS.map(a => (
          <button key={a.id} onClick={() => setActive(a.id)}
            style={{
              background: active === a.id ? a.color : "transparent",
              color: active === a.id ? "white" : "#666",
              border: `2px solid ${active === a.id ? a.color : "#e0e0e0"}`,
              borderRadius: "99px", padding: "10px 28px", cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", fontSize: "14px", fontWeight: 600,
              transition: "all 0.25s", display: "flex", alignItems: "center", gap: "8px",
              boxShadow: active === a.id ? `0 6px 20px ${a.color}40` : "none",
            }}>
            <span>{a.emoji}</span> {a.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>

          {/* Left: chart card */}
          <div style={{
            background: "#FAFAF8", borderRadius: "24px", padding: "28px",
            border: "1px solid rgba(0,0,0,0.06)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
              <div>
                <div style={{ fontSize: "12px", color: "#888", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px" }}>
                  Monthly Trend
                </div>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "22px", fontWeight: 800 }}>
                  {app.label} Usage
                </div>
              </div>
              <div style={{
                background: app.bg, color: app.color, fontSize: "11px", fontWeight: 700,
                padding: "5px 12px", borderRadius: "99px",
              }}>
                ↑ {app.chartData[app.chartData.length-1]}%
              </div>
            </div>

            <MiniChart data={app.chartData} color={app.color} />

            {/* Month labels */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}>
              {months.map((m, i) => (
                <span key={i} style={{ fontSize: "10px", color: "#aaa", fontWeight: 500 }}>{m}</span>
              ))}
            </div>

            {/* Stats row */}
            <div style={{ display: "flex", gap: "12px", marginTop: "24px" }}>
              {app.stats.map((s, i) => (
                <div key={i} style={{
                  flex: 1, background: "white", borderRadius: "14px", padding: "14px 12px",
                  textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}>
                  <div style={{ fontSize: "18px", marginBottom: "4px" }}>{s.icon}</div>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "20px", fontWeight: 800, color: app.color }}>{s.num}</div>
                  <div style={{ fontSize: "10px", color: "#888", fontWeight: 600 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: metrics + desc */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Desc */}
            <div style={{
              background: app.bg, borderRadius: "20px", padding: "22px",
              display: "flex", alignItems: "flex-start", gap: "14px",
            }}>
              <div style={{
                fontSize: "28px", width: "52px", height: "52px", borderRadius: "14px",
                background: "white", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)", flexShrink: 0,
              }}>{app.emoji}</div>
              <div>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "18px", fontWeight: 800, marginBottom: "6px" }}>{app.label}</div>
                <p style={{ fontSize: "14px", color: "#555", lineHeight: 1.6 }}>{app.desc}</p>
              </div>
            </div>

            {/* Circle metrics */}
            <div style={{
              background: "white", borderRadius: "20px", padding: "22px",
              border: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: "16px", flex: 1,
            }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Key Metrics
              </div>
              {app.metrics.map((m, i) => (
                <CircleProgress key={i} value={m.value} color={m.color} label={m.label} unit={m.unit} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}