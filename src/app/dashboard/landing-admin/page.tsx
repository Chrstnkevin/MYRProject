"use client"
import { useState, useRef, useCallback } from "react"
import { Plus, Trash2, Upload, Image, BookOpen, BarChart2, Save, X, ChevronDown, GripVertical, Eye } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Types ─────────────────────────────────────────────────────
interface Infographic {
  id: string
  title: string
  tag: string
  desc: string
  imageUrl: string
}

interface TutorialStep {
  id: string
  title: string
  desc: string
  imageUrl: string
}

interface TutorialApp {
  id: string
  appName: string
  emoji: string
  steps: TutorialStep[]
}

interface UtilMetric {
  label: string
  value: number
}

interface UtilApp {
  id: string
  appName: string
  emoji: string
  color: string
  desc: string
  metrics: UtilMetric[]
  monthlyData: number[]
  stats: { icon: string; num: string; label: string }[]
}

// ── Helpers ───────────────────────────────────────────────────
const uid = () => crypto.randomUUID()
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

// ── Image upload with paste support ──────────────────────────
function ImageUploader({
  value, onChange, label
}: { value: string; onChange: (url: string) => void; label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => onChange(e.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"))
    if (item) handleFile(item.getAsFile()!)
  }, [])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith("image/")) handleFile(file)
  }

  return (
    <div onPaste={handlePaste} tabIndex={0}
      style={{ outline: "none" }}>
      {label && <div className="label" style={{ marginBottom: "6px" }}>{label}</div>}
      <div
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onClick={() => !value && inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? "var(--accent)" : value ? "var(--border)" : "var(--border2)"}`,
          borderRadius: "var(--radius-sm)", overflow: "hidden",
          minHeight: "120px", cursor: value ? "default" : "pointer",
          background: dragging ? "var(--accent-muted)" : "var(--surface2)",
          position: "relative", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.15s",
        }}
      >
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" style={{ width: "100%", height: "160px", objectFit: "cover", display: "block" }} />
            <button onClick={e => { e.stopPropagation(); onChange("") }}
              style={{
                position: "absolute", top: "8px", right: "8px",
                background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                width: "28px", height: "28px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", color: "white",
              }}>
              <X size={14} />
            </button>
            <button onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
              style={{
                position: "absolute", bottom: "8px", right: "8px",
                background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "8px",
                padding: "4px 10px", cursor: "pointer", color: "white", fontSize: "11px",
              }}>
              Replace
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <Upload size={22} color="var(--text3)" style={{ margin: "0 auto 8px", display: "block" }} />
            <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text2)" }}>Upload or Ctrl+V to paste</div>
            <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>PNG, JPG, GIF supported</div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }}
        onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = "" }} />
    </div>
  )
}

// ── TAB: Utilisation ──────────────────────────────────────────
function UtilisationAdmin() {
  const [apps, setApps] = useState<UtilApp[]>([
    {
      id: uid(), appName: "SFA", emoji: "📊", color: "#43A047", desc: "Sales Force Automation — track targets, visits, and performance.",
      metrics: [{ label: "Daily Active Users", value: 87 }, { label: "Target Achievement", value: 92 }, { label: "Visit Completion", value: 78 }],
      monthlyData: [65,72,68,81,75,88,92,87,90,85,94,92],
      stats: [{ icon: "👤", num: "45+", label: "Users" }, { icon: "📍", num: "1.2k", label: "Visits/mo" }, { icon: "🎯", num: "92%", label: "Target hit" }],
    },
    {
      id: uid(), appName: "Ficom", emoji: "💰", color: "#FB8C00", desc: "Finance & Commerce module — manage transactions and reporting.",
      metrics: [{ label: "Transaction Success", value: 96 }, { label: "Outlet Coverage", value: 84 }, { label: "Report Accuracy", value: 99 }],
      monthlyData: [78,82,79,91,88,93,96,94,97,95,98,96],
      stats: [{ icon: "🏪", num: "320+", label: "Outlets" }, { icon: "💳", num: "15k", label: "Trans/mo" }, { icon: "📈", num: "99%", label: "Accuracy" }],
    },
    {
      id: uid(), appName: "Ficom Lite", emoji: "📱", color: "#1E88E5", desc: "Lightweight mobile-first version for field agents.",
      metrics: [{ label: "Mobile Adoption", value: 71 }, { label: "Sync Success Rate", value: 98 }, { label: "Offline Capability", value: 85 }],
      monthlyData: [45,52,58,63,61,68,71,74,72,78,75,71],
      stats: [{ icon: "📱", num: "30+", label: "Agents" }, { icon: "🔄", num: "98%", label: "Sync rate" }, { icon: "⚡", num: "< 2s", label: "Load time" }],
    },
  ])
  const [open, setOpen] = useState<string | null>(apps[0]?.id)

  const update = (id: string, field: keyof UtilApp, val: unknown) =>
    setApps(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a))

  const updateMetric = (appId: string, i: number, field: keyof UtilMetric, val: string | number) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, metrics: a.metrics.map((m, j) => j === i ? { ...m, [field]: val } : m)
    } : a))

  const updateMonthly = (appId: string, i: number, val: number) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, monthlyData: a.monthlyData.map((v, j) => j === i ? val : v)
    } : a))

  const updateStat = (appId: string, i: number, field: string, val: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, stats: a.stats.map((s, j) => j === i ? { ...s, [field]: val } : s)
    } : a))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ fontSize: "13px", color: "var(--text3)", marginBottom: "4px" }}>
        Edit utilisation data for each application. Changes will reflect on the landing page.
      </div>
      {apps.map(app => (
        <div key={app.id} className="card">
          {/* App header */}
          <div
            style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
            onClick={() => setOpen(open === app.id ? null : app.id)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "22px" }}>{app.emoji}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px" }}>{app.appName}</div>
                <div style={{ fontSize: "11px", color: "var(--text3)" }}>{app.metrics.length} metrics · {app.stats.length} stats</div>
              </div>
            </div>
            <ChevronDown size={16} color="var(--text3)"
              style={{ transform: open === app.id ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
          </div>

          {open === app.id && (
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                {/* Basic info */}
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div>
                    <div className="label" style={{ marginBottom: "5px" }}>App Name</div>
                    <input className="input" value={app.appName} onChange={e => update(app.id, "appName", e.target.value)} />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: "5px" }}>Description</div>
                    <textarea className="input" rows={3} value={app.desc} onChange={e => update(app.id, "desc", e.target.value)} />
                  </div>
                  <div>
                    <div className="label" style={{ marginBottom: "5px" }}>Accent Color</div>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <input type="color" value={app.color} onChange={e => update(app.id, "color", e.target.value)}
                        style={{ width: "40px", height: "36px", borderRadius: "8px", border: "1px solid var(--border)", cursor: "pointer" }} />
                      <input className="input" value={app.color} onChange={e => update(app.id, "color", e.target.value)} style={{ flex: 1 }} />
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div>
                  <div className="label" style={{ marginBottom: "10px" }}>Key Metrics (%)</div>
                  {app.metrics.map((m, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px", gap: "8px", marginBottom: "8px" }}>
                      <input className="input" placeholder="Metric label" value={m.label}
                        onChange={e => updateMetric(app.id, i, "label", e.target.value)} />
                      <input className="input" type="number" min={0} max={100} value={m.value}
                        onChange={e => updateMetric(app.id, i, "value", Number(e.target.value))} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Monthly data */}
              <div style={{ marginTop: "16px" }}>
                <div className="label" style={{ marginBottom: "10px" }}>Monthly Usage Data (%) — {MONTHS.join(" · ")}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: "6px" }}>
                  {app.monthlyData.map((v, i) => (
                    <div key={i} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: "10px", color: "var(--text3)", marginBottom: "3px" }}>{MONTHS[i]}</div>
                      <input className="input" type="number" min={0} max={100} value={v}
                        onChange={e => updateMonthly(app.id, i, Number(e.target.value))}
                        style={{ padding: "6px 4px", textAlign: "center", fontSize: "12px" }} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ marginTop: "16px" }}>
                <div className="label" style={{ marginBottom: "10px" }}>Quick Stats</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                  {app.stats.map((s, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      <input className="input" placeholder="Emoji" value={s.icon}
                        onChange={e => updateStat(app.id, i, "icon", e.target.value)} style={{ fontSize: "16px", textAlign: "center" }} />
                      <input className="input" placeholder="Number (e.g. 45+)" value={s.num}
                        onChange={e => updateStat(app.id, i, "num", e.target.value)} />
                      <input className="input" placeholder="Label" value={s.label}
                        onChange={e => updateStat(app.id, i, "label", e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        <Save size={14} /> Save Utilisation Data
      </button>
    </div>
  )
}

// ── TAB: Infographics ─────────────────────────────────────────
function InfographicsAdmin() {
  const [items, setItems] = useState<Infographic[]>([
    { id: uid(), title: "SFA User Flow", tag: "SFA", desc: "Complete user journey map for SFA daily operations", imageUrl: "" },
    { id: uid(), title: "Ficom Finance Report", tag: "Ficom", desc: "Monthly financial reporting infographic", imageUrl: "" },
  ])

  const add = () => setItems(prev => [...prev, { id: uid(), title: "", tag: "", desc: "", imageUrl: "" }])
  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id))
  const update = (id: string, field: keyof Infographic, val: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: val } : i))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "13px", color: "var(--text3)" }}>{items.length} infographics</div>
        <button className="btn btn-primary" onClick={add}><Plus size={14} /> Add Infographic</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
        {items.map(item => (
          <div key={item.id} className="card" style={{ padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text2)" }}>Infographic</div>
              <button onClick={() => remove(item.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                <Trash2 size={14} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input className="input" placeholder="Title" value={item.title}
                onChange={e => update(item.id, "title", e.target.value)} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <input className="input" placeholder="Tag (e.g. SFA)" value={item.tag}
                  onChange={e => update(item.id, "tag", e.target.value)} />
              </div>
              <textarea className="input" rows={2} placeholder="Description" value={item.desc}
                onChange={e => update(item.id, "desc", e.target.value)} />
              <ImageUploader
                label="Image (Upload or Ctrl+V)"
                value={item.imageUrl}
                onChange={url => update(item.id, "imageUrl", url)}
              />
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        <Save size={14} /> Save Infographics
      </button>
    </div>
  )
}

// ── TAB: Tutorial System ──────────────────────────────────────
function TutorialAdmin() {
  const [apps, setApps] = useState<TutorialApp[]>([
    {
      id: uid(), appName: "SFA", emoji: "📊",
      steps: [
        { id: uid(), title: "Getting Started", desc: "Learn how to log in and navigate SFA.", imageUrl: "" },
        { id: uid(), title: "Daily Check-in", desc: "Complete your daily visit check-in.", imageUrl: "" },
      ],
    },
    {
      id: uid(), appName: "Ficom", emoji: "💰",
      steps: [
        { id: uid(), title: "Dashboard Overview", desc: "Understand the main Ficom dashboard.", imageUrl: "" },
      ],
    },
  ])
  const [openApp, setOpenApp] = useState<string>(apps[0]?.id)

  const addApp = () => {
    const id = uid()
    setApps(prev => [...prev, { id, appName: "New App", emoji: "📦", steps: [] }])
    setOpenApp(id)
  }

  const updateApp = (id: string, field: keyof TutorialApp, val: unknown) =>
    setApps(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a))

  const removeApp = (id: string) => setApps(prev => prev.filter(a => a.id !== id))

  const addStep = (appId: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, steps: [...a.steps, { id: uid(), title: "New Step", desc: "", imageUrl: "" }]
    } : a))

  const updateStep = (appId: string, stepId: string, field: keyof TutorialStep, val: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, steps: a.steps.map(s => s.id === stepId ? { ...s, [field]: val } : s)
    } : a))

  const removeStep = (appId: string, stepId: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, steps: a.steps.filter(s => s.id !== stepId)
    } : a))

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: "13px", color: "var(--text3)" }}>{apps.length} applications</div>
        <button className="btn btn-primary" onClick={addApp}><Plus size={14} /> Add Application</button>
      </div>

      {apps.map(app => (
        <div key={app.id} className="card">
          {/* App header */}
          <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
              <input className="input" value={app.emoji} onChange={e => updateApp(app.id, "emoji", e.target.value)}
                style={{ width: "50px", textAlign: "center", fontSize: "18px", padding: "6px" }} />
              <input className="input" value={app.appName} onChange={e => updateApp(app.id, "appName", e.target.value)}
                style={{ fontWeight: 700, fontSize: "15px", flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: "8px", marginLeft: "12px" }}>
              <button className="btn btn-ghost" style={{ fontSize: "12px" }}
                onClick={() => setOpenApp(openApp === app.id ? "" : app.id)}>
                {openApp === app.id ? "Collapse" : "Expand"}
              </button>
              <button onClick={() => removeApp(app.id)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {openApp === app.id && (
            <div style={{ padding: "0 20px 20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {app.steps.map((step, idx) => (
                  <div key={step.id} style={{
                    background: "var(--surface2)", borderRadius: "var(--radius-sm)", padding: "16px",
                    border: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <GripVertical size={14} color="var(--text3)" />
                        <div style={{
                          width: "24px", height: "24px", borderRadius: "50%",
                          background: "var(--accent)", color: "white",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "11px", fontWeight: 700,
                        }}>{idx + 1}</div>
                        <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text2)" }}>Step {idx + 1}</span>
                      </div>
                      <button onClick={() => removeStep(app.id, step.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <input className="input" placeholder="Step title" value={step.title}
                          onChange={e => updateStep(app.id, step.id, "title", e.target.value)} />
                        <textarea className="input" rows={4} placeholder="Step description..." value={step.desc}
                          onChange={e => updateStep(app.id, step.id, "desc", e.target.value)} />
                      </div>
                      <ImageUploader
                        label="Screenshot / Image"
                        value={step.imageUrl}
                        onChange={url => updateStep(app.id, step.id, "imageUrl", url)}
                      />
                    </div>
                  </div>
                ))}
                <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: "12px" }}
                  onClick={() => addStep(app.id)}>
                  <Plus size={13} /> Add Step
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      <button className="btn btn-primary" style={{ alignSelf: "flex-start" }}>
        <Save size={14} /> Save Tutorials
      </button>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
const TABS = [
  { id: "utilisation", label: "Utilisation", icon: BarChart2 },
  { id: "infographics", label: "Infographics", icon: Image },
  { id: "tutorials", label: "Tutorials", icon: BookOpen },
]

export default function LandingAdminPage() {
  const [tab, setTab] = useState("utilisation")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <MotivationBanner page="docreq" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            🌐 Landing Page Admin
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>
            Manage content for the public PHI Support landing page
          </p>
        </div>
        <a href="/landing" target="_blank" rel="noopener noreferrer">
          <button className="btn btn-ghost">
            <Eye size={14} /> Preview Landing Page
          </button>
        </a>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid var(--border)", paddingBottom: "0" }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "10px 20px", borderRadius: "8px 8px 0 0",
                fontFamily: "inherit", fontSize: "13px", fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? "var(--accent)" : "var(--text3)",
                borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent",
                display: "flex", alignItems: "center", gap: "6px", transition: "all 0.15s",
                marginBottom: "-1px",
              }}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div>
        {tab === "utilisation" && <UtilisationAdmin />}
        {tab === "infographics" && <InfographicsAdmin />}
        {tab === "tutorials" && <TutorialAdmin />}
      </div>
    </div>
  )
}