"use client"
import LandingNav from "../components/LandingNav"
import { useState, useEffect } from "react"

const C = { primary: "#E8381A", gray: "#6B7280", dark: "#111111", light: "#F4F4F2", white: "#FFFFFF" }

/* ─── TUTORIAL APPS ─────────────────────────────────────── */
const TUTORIALS = [
  {
    id: "matrix",
    label: "Matrix",
    emoji: "🧮",
    color: "#7C3AED",
    colorLight: "#EDE9FE",
    gradient: "linear-gradient(135deg, #7C3AED, #A855F7)",
    tagline: "Sistem Manajemen Data",
    desc: "Panduan lengkap penggunaan Matrix — dari login, entri data, generate laporan, hingga manajemen user dan permission untuk admin.",
    steps: 4,
    topics: ["Login & Onboarding", "Data Input & Validasi", "Laporan & Export", "Admin & Permission"],
    badge: "4 Panduan",
    badgeColor: "#7C3AED",
  },
  {
    id: "sfa",
    label: "SFA",
    emoji: "📊",
    color: "#E8381A",
    colorLight: "#FEF0ED",
    gradient: "linear-gradient(135deg, #E8381A, #F97316)",
    tagline: "Sales Force Automation",
    desc: "Tutorial SFA untuk field agent — login, daily check-in kunjungan, pantau target & KPI harian, dan cara generate laporan mingguan.",
    steps: 4,
    topics: ["Login SFA", "Daily Check-in", "Target & KPI", "Generate Laporan"],
    badge: "4 Panduan",
    badgeColor: "#E8381A",
  },
  {
    id: "ficom",
    label: "Ficom",
    emoji: "💰",
    color: "#FB8C00",
    colorLight: "#FFF3E0",
    gradient: "linear-gradient(135deg, #FB8C00, #FFA726)",
    tagline: "Financial Commerce System",
    desc: "Panduan Ficom untuk tim keuangan — memahami dashboard, entri transaksi harian yang benar, dan prosedur tutup periode bulanan.",
    steps: 3,
    topics: ["Dashboard Overview", "Entri Transaksi", "Period Closing"],
    badge: "3 Panduan",
    badgeColor: "#FB8C00",
  },
  {
    id: "ficom-lite",
    label: "Ficom Lite",
    emoji: "📱",
    color: "#1E88E5",
    colorLight: "#E3F2FD",
    gradient: "linear-gradient(135deg, #1E88E5, #42A5F5)",
    tagline: "Mobile Field App",
    desc: "Tutorial Ficom Lite untuk pengguna mobile — instalasi & setup, cara kerja mode offline, dan fitur Quick Submit untuk field agent.",
    steps: 3,
    topics: ["Instalasi & Setup", "Mode Offline", "Quick Submit"],
    badge: "3 Panduan",
    badgeColor: "#1E88E5",
  },
]

/* ─── SUPPORTING SECTIONS ───────────────────────────────── */
const SECTIONS = [
  {
    icon: "🖼️", title: "Infographics", href: "/landing/infographics",
    desc: "Visual reference materials — quick summaries, process flows, and key information in easy-to-understand graphic format.",
    items: ["SFA User Flow", "Ficom Finance Report", "Outlet Coverage Map", "Ficom Lite Guide", "Q1 Performance Summary", "Training Roadmap"],
    color: C.primary, bg: "#FEF0ED", cta: "Browse Infographics",
  },
]

/* ─── ANIMATED MINI PREVIEW ────────────────────────────── */
function MiniPreview({ app, hovered }: { app: typeof TUTORIALS[0], hovered: boolean }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 8), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{
      background: "white",
      borderRadius: 10,
      overflow: "hidden",
      boxShadow: hovered ? `0 8px 24px ${app.color}25` : "0 2px 8px rgba(0,0,0,0.08)",
      transition: "box-shadow 0.3s",
    }}>
      {/* Fake toolbar */}
      <div style={{ background: "#f5f5f5", padding: "5px 8px", display: "flex", gap: 4, alignItems: "center" }}>
        {["#FF5F57", "#FFC22A", "#29CB40"].map((c, i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: c }} />
        ))}
        <div style={{ flex: 1, height: 10, borderRadius: 3, background: "white", margin: "0 6px" }} />
      </div>
      {/* Fake content */}
      <div style={{ padding: "10px 10px", display: "flex", gap: 8 }}>
        {/* Sidebar */}
        <div style={{ width: 36, display: "flex", flexDirection: "column", gap: 4 }}>
          {app.topics.slice(0, 4).map((_, i) => (
            <div key={i} style={{
              height: 8, borderRadius: 3,
              background: tick % app.topics.length === i ? app.color : "#eee",
              transition: "background 0.3s",
            }} />
          ))}
        </div>
        {/* Content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          <div style={{ height: 10, borderRadius: 3, background: `${app.color}30`, width: "70%" }} />
          <div style={{ height: 7, borderRadius: 3, background: "#f0f0f0", width: "90%" }} />
          <div style={{ height: 7, borderRadius: 3, background: "#f0f0f0", width: "75%" }} />
          <div style={{
            height: 22, borderRadius: 5, background: app.gradient, width: "45%",
            marginTop: 4, opacity: hovered ? 1 : 0.7, transition: "opacity 0.3s",
          }} />
        </div>
      </div>
    </div>
  )
}

/* ─── TUTORIAL CARD ─────────────────────────────────────── */
function TutorialCard({ app, idx }: { app: typeof TUTORIALS[0], idx: number }) {
  const [hovered, setHovered] = useState(false)

  return (
    <a
      href={`/landing/tutorials?app=${app.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: "white",
        borderRadius: 24,
        overflow: "hidden",
        border: `1.5px solid ${hovered ? app.color + "40" : "rgba(0,0,0,0.07)"}`,
        boxShadow: hovered ? `0 20px 48px ${app.color}18, 0 4px 16px rgba(0,0,0,0.06)` : "0 2px 12px rgba(0,0,0,0.05)",
        transform: hovered ? "translateY(-6px)" : "none",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        animation: `card-in 0.5s ease ${idx * 0.1}s both`,
      }}>
        {/* Top strip with gradient */}
        <div style={{
          background: app.colorLight,
          padding: "28px 28px 20px",
          borderBottom: `1px solid ${app.color}15`,
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Decorative circles */}
          <div style={{
            position: "absolute", right: -20, top: -20,
            width: 100, height: 100, borderRadius: "50%",
            background: app.gradient, opacity: 0.12,
            transform: hovered ? "scale(1.3)" : "scale(1)",
            transition: "transform 0.5s ease",
          }} />
          <div style={{
            position: "absolute", right: 20, bottom: -30,
            width: 60, height: 60, borderRadius: "50%",
            background: app.gradient, opacity: 0.08,
          }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{
                fontSize: 42,
                filter: hovered ? "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" : "none",
                transition: "filter 0.3s, transform 0.3s",
                transform: hovered ? "scale(1.1)" : "scale(1)",
              }}>
                {app.emoji}
              </div>
              <div style={{
                background: app.gradient,
                color: "white", borderRadius: 99,
                padding: "4px 12px",
                fontSize: 11, fontWeight: 700,
                boxShadow: `0 4px 12px ${app.color}30`,
              }}>
                {app.badge}
              </div>
            </div>

            <div style={{ fontSize: 10, fontWeight: 700, color: app.color, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>
              {app.tagline}
            </div>
            <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 900, color: C.dark, marginBottom: 8 }}>
              {app.label}
            </div>
            <p style={{ fontSize: 13, color: C.gray, lineHeight: 1.65 }}>{app.desc}</p>
          </div>
        </div>

        {/* Mini preview animation */}
        <div style={{ padding: "16px 28px 0" }}>
          <MiniPreview app={app} hovered={hovered} />
        </div>

        {/* Topics list */}
        <div style={{ padding: "16px 28px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            Yang Dipelajari
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {app.topics.map((topic, j) => (
              <div key={j} style={{
                display: "flex", alignItems: "center", gap: 8,
                fontSize: 13, color: C.dark, fontWeight: 400,
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                  background: hovered ? app.gradient : "#eee",
                  color: hovered ? "white" : "#999",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800,
                  transition: "all 0.3s",
                  transitionDelay: `${j * 0.05}s`,
                }}>
                  {j + 1}
                </div>
                {topic}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Button */}
        <div style={{ padding: "0 28px 28px" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: hovered ? app.gradient : app.colorLight,
            color: hovered ? "white" : app.color,
            padding: "13px 20px", borderRadius: 14,
            fontSize: 14, fontWeight: 700,
            transition: "all 0.3s",
            boxShadow: hovered ? `0 8px 24px ${app.color}35` : "none",
            border: `1.5px solid ${hovered ? "transparent" : app.color + "30"}`,
          }}>
            {hovered ? "Mulai Tutorial →" : `📖 Buka Tutorial ${app.label}`}
          </div>
        </div>
      </div>
    </a>
  )
}

/* ─── MAIN PAGE ─────────────────────────────────────────── */
export default function SupportingPage() {
  useEffect(() => {
    const l = document.createElement("link"); l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600;700&display=swap"
    document.head.appendChild(l)
  }, [])

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.dark, background: C.white, minHeight: "100vh" }}>
      <LandingNav />

      {/* ── HERO ── */}
      <div style={{
        background: "linear-gradient(135deg, #FEF0ED, #FFF8F5, #F8F4FF, white)",
        padding: "clamp(100px,12vw,140px) clamp(20px,5vw,80px) clamp(48px,6vw,72px)",
        textAlign: "center",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Decorative background shapes */}
        <div style={{ position: "absolute", top: "10%", left: "5%", width: 200, height: 200, borderRadius: "50%", background: "linear-gradient(135deg, #FEF0ED, #FEF0ED00)", opacity: 0.6 }} />
        <div style={{ position: "absolute", top: "20%", right: "8%", width: 140, height: 140, borderRadius: "50%", background: "linear-gradient(135deg, #EDE9FE, #EDE9FE00)", opacity: 0.5 }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-block", background: `${C.primary}12`, borderRadius: "99px", padding: "5px 16px", fontSize: "12px", fontWeight: 700, color: C.primary, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "16px" }}>
            Supporting Materials
          </div>
          <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(34px,6vw,68px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: "16px" }}>
            Learn, Reference, <span style={{ color: C.primary }}>and Grow</span>
          </h1>
          <p style={{ fontSize: "clamp(14px,1.6vw,17px)", color: C.gray, lineHeight: 1.8, maxWidth: "520px", margin: "0 auto" }}>
            Semua yang dibutuhkan tim Anda untuk memaksimalkan penggunaan aplikasi — infografis visual dan tutorial interaktif dalam satu tempat.
          </p>
        </div>
      </div>

      {/* ── TUTORIAL SECTION ── */}
      <div style={{ padding: "clamp(48px,6vw,80px) clamp(20px,5vw,80px) 0" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>

          {/* Section header */}
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "clamp(28px,3.5vw,40px)", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 24 }}>📖</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#1E88E5", textTransform: "uppercase", letterSpacing: "0.12em" }}>Tutorial System</div>
              </div>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(24px,3.5vw,38px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
                Pilih Tutorial Aplikasi
              </h2>
              <p style={{ fontSize: 15, color: C.gray, marginTop: 8, maxWidth: 480, lineHeight: 1.6 }}>
                Klik aplikasi di bawah untuk memulai tutorial interaktif dengan panduan step-by-step.
              </p>
            </div>
            <a href="/landing/tutorials" style={{
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 14, fontWeight: 600, color: "#1E88E5",
              textDecoration: "none", padding: "8px 16px",
              borderRadius: 10, border: "1.5px solid #1E88E520",
              background: "#EEF7FF", transition: "all 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "#1E88E5"; e.currentTarget.style.color = "white" }}
              onMouseLeave={e => { e.currentTarget.style.background = "#EEF7FF"; e.currentTarget.style.color = "#1E88E5" }}>
              Lihat Semua →
            </a>
          </div>

          {/* 4 tutorial cards in 2x2 grid */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "clamp(16px, 2.5vw, 24px)",
            marginBottom: "clamp(40px,5vw,64px)",
          }}>
            {TUTORIALS.map((app, i) => (
              <TutorialCard key={app.id} app={app} idx={i} />
            ))}
          </div>
        </div>
      </div>

      {/* ── INFOGRAPHICS SECTION ── */}
      <div style={{ padding: "0 clamp(20px,5vw,80px) clamp(60px,8vw,100px)" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
          {/* Section header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 24 }}>🖼️</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, textTransform: "uppercase", letterSpacing: "0.12em" }}>Infographics</div>
          </div>
          <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(24px,3vw,34px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 24 }}>
            Visual Reference Materials
          </h2>

          {SECTIONS.map((s, i) => (
            <div key={i} style={{
              background: C.light, borderRadius: 28, overflow: "hidden",
              border: "1px solid rgba(0,0,0,0.06)",
              transition: "all 0.3s",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(0,0,0,0.1)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none" }}>
              <div style={{ background: s.bg, padding: "clamp(24px,3vw,36px)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <div style={{ fontSize: "clamp(40px,5vw,52px)", marginBottom: 14 }}>{s.icon}</div>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: "clamp(20px,2.5vw,26px)", fontWeight: 900, marginBottom: 10 }}>{s.title}</div>
                <p style={{ fontSize: "clamp(13px,1.4vw,15px)", color: C.gray, lineHeight: 1.7 }}>{s.desc}</p>
              </div>
              <div style={{ padding: "clamp(20px,2.5vw,28px)" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>Yang Tersedia</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8, marginBottom: "clamp(20px,2.5vw,28px)" }}>
                  {s.items.map((item, j) => (
                    <div key={j} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.white, borderRadius: 12, fontSize: "clamp(12px,1.3vw,14px)", fontWeight: 500 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                      {item}
                    </div>
                  ))}
                </div>
                <a href={s.href} style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  background: s.color, color: "white", textDecoration: "none",
                  padding: "12px 24px", borderRadius: 14, fontSize: 14, fontWeight: 700,
                  transition: "all 0.2s", boxShadow: `0 6px 20px ${s.color}35`,
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 10px 28px ${s.color}45` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 6px 20px ${s.color}35` }}>
                  {s.cta} →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes card-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  )
}