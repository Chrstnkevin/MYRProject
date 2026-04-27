"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { Plus, Trash2, Upload, Image, BookOpen, Save, X, ChevronDown, GripVertical, Eye, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"
import type { LandingTutorial, TutorialStep } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────
interface Infographic {
  id: string
  title: string
  tag: string
  desc: string
  imageUrl: string
}


// ── Helpers ───────────────────────────────────────────────────
const uid = () => crypto.randomUUID()

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
  type SaveStatus = "idle" | "saving" | "saved" | "error"
  const [apps, setApps] = useState<LandingTutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [openApp, setOpenApp] = useState<string>("")
  const [openImp, setOpenImp] = useState<string>("")

  // ── Load from Supabase ───────────────────────────────────
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("landing_tutorials")
      .select("*")
      .order("app_id")
    if (!error && data) {
      setApps(data as LandingTutorial[])
      if (data.length > 0) {
        setOpenApp(data[0].id)
        const firstImp = data[0].improvements?.[0]
        if (firstImp) setOpenImp(firstImp.id)
      }
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Save single app to Supabase ──────────────────────────
  const saveApp = async (app: LandingTutorial) => {
    setSaveStatus(prev => ({ ...prev, [app.id]: "saving" }))
    const { error } = await supabase
      .from("landing_tutorials")
      .update({
        app_name: app.app_name,
        emoji: app.emoji,
        improvements: app.improvements,
        updated_at: new Date().toISOString(),
      })
      .eq("id", app.id)
    setSaveStatus(prev => ({ ...prev, [app.id]: error ? "error" : "saved" }))
    setTimeout(() => setSaveStatus(prev => ({ ...prev, [app.id]: "idle" })), 2500)
  }

  // ── Save all ─────────────────────────────────────────────
  const saveAll = async () => {
    for (const app of apps) await saveApp(app)
  }

  const anyStatus = (s: SaveStatus) => Object.values(saveStatus).some(v => v === s)

  // ── Helpers ──────────────────────────────────────────────
  const updateApp = (appId: string, field: "app_name" | "emoji", val: string) =>
    setApps(prev => prev.map(a => a.id === appId ? { ...a, [field]: val } : a))

  const addImprovement = (appId: string) => {
    const id = crypto.randomUUID()
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, improvements: [...(a.improvements ?? []), { id, name: "Improvement Baru", steps: [] }]
    } : a))
    setOpenImp(id)
  }
  const updateImprovement = (appId: string, impId: string, val: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, improvements: a.improvements.map(imp => imp.id === impId ? { ...imp, name: val } : imp)
    } : a))
  const removeImprovement = (appId: string, impId: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, improvements: a.improvements.filter(imp => imp.id !== impId)
    } : a))

  const addStep = (appId: string, impId: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, improvements: a.improvements.map(imp => imp.id === impId ? {
        ...imp, steps: [...imp.steps, { id: crypto.randomUUID(), title: "", desc: "", imageUrl: "" }]
      } : imp)
    } : a))
  const updateStep = (appId: string, impId: string, stepId: string, field: keyof TutorialStep, val: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, improvements: a.improvements.map(imp => imp.id === impId ? {
        ...imp, steps: imp.steps.map(s => s.id === stepId ? { ...s, [field]: val } : s)
      } : imp)
    } : a))
  const removeStep = (appId: string, impId: string, stepId: string) =>
    setApps(prev => prev.map(a => a.id === appId ? {
      ...a, improvements: a.improvements.map(imp => imp.id === impId ? {
        ...imp, steps: imp.steps.filter(s => s.id !== stepId)
      } : imp)
    } : a))

  const totalSteps = (app: LandingTutorial) =>
    (app.improvements ?? []).reduce((n, imp) => n + imp.steps.length, 0)

  // ── Render ───────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "32px 0", color: "var(--text3)" }}>
      <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} />
      <span>Memuat data tutorial dari Supabase...</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{apps.length} Aplikasi tersinkron dari Supabase</div>
          <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>
            Alur: Aplikasi → Improvement → Langkah. Perubahan langsung tampil di halaman publik.
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button className="btn btn-ghost" style={{ fontSize: "12px" }} onClick={load}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button
            className="btn btn-primary"
            onClick={saveAll}
            disabled={anyStatus("saving")}
            style={{ opacity: anyStatus("saving") ? 0.7 : 1 }}
          >
            <Save size={14} />
            {anyStatus("saving") ? "Menyimpan..." : "Simpan Semua"}
          </button>
        </div>
      </div>

      {/* App list */}
      {apps.map(app => {
        const status = saveStatus[app.id] ?? "idle"
        return (
        <div key={app.id} className="card" style={{ overflow: "hidden" }}>

          {/* App Header */}
          <div style={{
            padding: "14px 20px",
            display: "flex", alignItems: "center", gap: "10px",
            background: openApp === app.id ? "var(--surface)" : "var(--card)",
            borderBottom: openApp === app.id ? "1px solid var(--border)" : "none",
          }}>
            <input className="input" value={app.emoji}
              onChange={e => updateApp(app.id, "emoji", e.target.value)}
              style={{ width: "46px", textAlign: "center", fontSize: "20px", padding: "4px", flexShrink: 0 }} />
            <input className="input" value={app.app_name}
              onChange={e => updateApp(app.id, "app_name", e.target.value)}
              style={{ fontWeight: 700, fontSize: "15px", flex: 1 }} />

            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto", flexShrink: 0 }}>
              {/* Stats badge */}
              <div style={{ fontSize: "11px", color: "var(--text3)", padding: "3px 8px", background: "var(--surface2)", borderRadius: "6px", whiteSpace: "nowrap" }}>
                {(app.improvements ?? []).length} improvement · {totalSteps(app)} langkah
              </div>

              {/* Per-app save status */}
              {status === "saving" && <RefreshCw size={13} color="var(--text3)" style={{ animation: "spin 1s linear infinite" }} />}
              {status === "saved"  && <CheckCircle2 size={14} color="#16a34a" />}
              {status === "error"  && <AlertCircle  size={14} color="var(--danger)" />}

              {/* Per-app save button */}
              <button
                className="btn btn-ghost"
                style={{ fontSize: "11px", padding: "4px 10px" }}
                onClick={() => saveApp(app)}
                disabled={status === "saving"}
              >
                <Save size={12} /> Simpan
              </button>

              <button className="btn btn-ghost" style={{ fontSize: "12px", padding: "5px 12px" }}
                onClick={() => setOpenApp(openApp === app.id ? "" : app.id)}>
                {openApp === app.id ? "Tutup" : "Buka"}
              </button>
            </div>
          </div>

          {/* App Body */}
          {openApp === app.id && (
            <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>

              {(app.improvements ?? []).map((imp, impIdx) => (
                <div key={imp.id} style={{
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  overflow: "hidden",
                  background: openImp === imp.id ? "var(--card)" : "var(--surface2)",
                }}>
                  {/* Improvement Header */}
                  <div style={{
                    padding: "11px 14px", display: "flex", alignItems: "center", gap: "10px",
                    cursor: "pointer",
                    borderBottom: openImp === imp.id ? "1px solid var(--border)" : "none",
                  }} onClick={() => setOpenImp(openImp === imp.id ? "" : imp.id)}>

                    <div style={{
                      width: "26px", height: "26px", borderRadius: "50%", flexShrink: 0,
                      background: openImp === imp.id ? "var(--accent)" : "var(--border)",
                      color: openImp === imp.id ? "white" : "var(--text3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: 800, transition: "all 0.2s",
                    }}>{impIdx + 1}</div>

                    <input className="input" value={imp.name}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateImprovement(app.id, imp.id, e.target.value)}
                      placeholder="Nama improvement..."
                      style={{ flex: 1, fontWeight: 600, fontSize: "13px" }} />

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                      <span style={{ fontSize: "11px", color: "var(--text3)" }}>{imp.steps.length} langkah</span>
                      <ChevronDown size={14} color="var(--text3)"
                        style={{ transform: openImp === imp.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                      <button onClick={e => { e.stopPropagation(); removeImprovement(app.id, imp.id) }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "2px 4px", borderRadius: "4px" }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Steps */}
                  {openImp === imp.id && (
                    <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>

                      {imp.steps.length === 0 && (
                        <div style={{
                          textAlign: "center", padding: "24px", color: "var(--text3)", fontSize: "13px",
                          border: "2px dashed var(--border2)", borderRadius: "var(--radius-sm)",
                        }}>
                          Belum ada langkah. Klik "+ Tambah Langkah" di bawah untuk mulai.
                        </div>
                      )}

                      {imp.steps.map((step, stepIdx) => (
                        <div key={step.id} style={{
                          background: "var(--surface2)", borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border)", overflow: "hidden",
                        }}>
                          {/* Step header bar */}
                          <div style={{
                            padding: "9px 14px", display: "flex", alignItems: "center", gap: "8px",
                            borderBottom: "1px solid var(--border)", background: "var(--surface)",
                          }}>
                            <GripVertical size={13} color="var(--text3)" />
                            <div style={{
                              width: "22px", height: "22px", borderRadius: "50%",
                              background: "var(--accent)", color: "white",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "10px", fontWeight: 800, flexShrink: 0,
                            }}>{stepIdx + 1}</div>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text2)", flex: 1 }}>
                              Langkah {stepIdx + 1}{step.title ? ` — ${step.title}` : ""}
                            </span>
                            {step.imageUrl && (
                              <span style={{ fontSize: "10px", color: "#16a34a", fontWeight: 600, background: "#f0fdf4", padding: "2px 7px", borderRadius: "99px", border: "1px solid #bbf7d0" }}>
                                📷 Ada gambar
                              </span>
                            )}
                            <button onClick={() => removeStep(app.id, imp.id, step.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}>
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Step body — 2 column */}
                          <div style={{ padding: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                            {/* Left: text fields */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                              <div>
                                <div className="label" style={{ marginBottom: "4px" }}>Judul Langkah</div>
                                <input className="input"
                                  placeholder="Contoh: Buka Halaman Login"
                                  value={step.title}
                                  onChange={e => updateStep(app.id, imp.id, step.id, "title", e.target.value)} />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div className="label" style={{ marginBottom: "4px" }}>Deskripsi</div>
                                <textarea className="input" rows={6}
                                  placeholder="Jelaskan apa yang harus dilakukan pada langkah ini secara detail..."
                                  value={step.desc}
                                  onChange={e => updateStep(app.id, imp.id, step.id, "desc", e.target.value)}
                                  style={{ resize: "vertical", lineHeight: 1.6 }} />
                              </div>
                            </div>

                            {/* Right: image uploader */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <div className="label">Screenshot / Gambar</div>
                              <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "2px" }}>
                                Upload file, drag & drop, atau <strong>Ctrl+V</strong> untuk paste screenshot
                              </div>
                              <ImageUploader
                                value={step.imageUrl}
                                onChange={url => updateStep(app.id, imp.id, step.id, "imageUrl", url)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}

                      <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: "12px" }}
                        onClick={() => addStep(app.id, imp.id)}>
                        <Plus size={13} /> Tambah Langkah
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <button className="btn btn-ghost"
                style={{ alignSelf: "flex-start", fontSize: "12px", border: "1.5px dashed var(--border2)" }}
                onClick={() => addImprovement(app.id)}>
                <Plus size={13} /> Tambah Improvement
              </button>
            </div>
          )}
        </div>
      )})}

      {/* Global save bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", paddingTop: "16px", borderTop: "1px solid var(--border)" }}>
        <button className="btn btn-primary" onClick={saveAll} disabled={anyStatus("saving")}
          style={{ opacity: anyStatus("saving") ? 0.7 : 1 }}>
          <Save size={14} /> {anyStatus("saving") ? "Menyimpan..." : "Simpan Semua ke Supabase"}
        </button>
        {anyStatus("saved") && !anyStatus("saving") && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: "8px",
            padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#065F46",
          }}>
            <CheckCircle2 size={13} /> Semua tersimpan! Halaman tutorial sudah terupdate.
          </div>
        )}
        {anyStatus("error") && (
          <div style={{
            display: "flex", alignItems: "center", gap: "6px",
            background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: "8px",
            padding: "6px 12px", fontSize: "12px", fontWeight: 600, color: "#991B1B",
          }}>
            <AlertCircle size={13} /> Gagal menyimpan. Cek koneksi Supabase.
          </div>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────
const TABS = [
  { id: "tutorials",   label: "Tutorials",   icon: BookOpen },
  { id: "infographics", label: "Infographics", icon: Image },
]

export default function LandingAdminPage() {
  const [tab, setTab] = useState("tutorials")

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <MotivationBanner page="docreq" />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>
            📖 Tutorials Admin
          </h1>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>
            Kelola konten Tutorial dan Infographic untuk halaman publik PHI Support
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
        {tab === "tutorials"    && <TutorialAdmin />}
        {tab === "infographics" && <InfographicsAdmin />}
      </div>
    </div>
  )
}