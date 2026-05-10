"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import {
  Plus, Trash2, Image, BookOpen, Save, X, Eye,
  RefreshCw, AlertCircle, CheckCircle2, Video, User,
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"
import type { LandingTutorial, TutorialStep, TutorialImprovement, LandingInfographic, SharingZoom } from "@/lib/types"

// ── Constants ──────────────────────────────────────────────────────────────────
const PIC_OPTIONS = ["Kevin", "Risky", "Kevin & Risky"]
const uid = () => crypto.randomUUID()

// ── Helpers ────────────────────────────────────────────────────────────────────
function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ── PIC Selector ───────────────────────────────────────────────────────────────
function PicSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <User size={10} style={{ display: "inline", marginRight: 4 }} />PIC
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {PIC_OPTIONS.map(p => (
          <button key={p} onClick={() => onChange(p)}
            style={{
              padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
              cursor: "pointer", transition: "all 0.15s",
              background: value === p ? "var(--accent)" : "var(--surface2)",
              color: value === p ? "white" : "var(--text2)",
              border: value === p ? "1.5px solid var(--accent)" : "1.5px solid var(--border)",
            }}>
            {p}
          </button>
        ))}
        {value && !PIC_OPTIONS.includes(value) && (
          <span style={{ fontSize: 11, color: "var(--text3)", alignSelf: "center" }}>{value}</span>
        )}
      </div>
    </div>
  )
}

// ── Image Uploader (single) ────────────────────────────────────────────────────
function ImageUploader({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const handleFile = async (file: File) => onChange(await fileToBase64(file))
  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"))
    if (item) { const f = item.getAsFile(); if (f) handleFile(f) }
  }, [])
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f?.type.startsWith("image/")) handleFile(f)
  }
  return (
    <div onPaste={handlePaste} tabIndex={0} style={{ outline: "none" }}>
      <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onClick={() => !value && inputRef.current?.click()}
        style={{ border: `2px dashed ${dragging ? "var(--accent)" : value ? "var(--border)" : "var(--border2)"}`, borderRadius: "var(--radius-sm)", overflow: "hidden", height: value ? "auto" : "90px", cursor: value ? "default" : "pointer", background: dragging ? "var(--accent-muted)" : "var(--surface2)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" style={{ width: "100%", maxHeight: "180px", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
              <button onClick={e => { e.stopPropagation(); inputRef.current?.click() }} style={{ background: "rgba(0,0,0,0.6)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "white", fontSize: 10 }}>Replace</button>
              <button onClick={e => { e.stopPropagation(); onChange("") }} style={{ background: "rgba(192,57,43,0.85)", border: "none", borderRadius: 6, padding: "4px 6px", cursor: "pointer", color: "white", display: "flex", alignItems: "center" }}><X size={11} /></button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "14px" }}>
            <Image size={16} color="var(--text3)" style={{ margin: "0 auto 5px", display: "block" }} />
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text2)" }}>Upload / Ctrl+V paste</div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = "" }} />
    </div>
  )
}

// ── Multi Image Uploader (for Zoom screenshots) ────────────────────────────────
function MultiImageUploader({ values, onChange }: { values: string[]; onChange: (urls: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  const addFile = async (file: File) => {
    const b64 = await fileToBase64(file)
    onChange([...values, b64])
  }

  const handlePaste = useCallback(async (e: Event) => {
    const ce = e as ClipboardEvent
    const item = Array.from(ce.clipboardData?.items ?? []).find(i => i.type.startsWith("image/"))
    if (item) { const f = item.getAsFile(); if (f) addFile(f) }
  }, [values])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener("paste", handlePaste)
    return () => el.removeEventListener("paste", handlePaste)
  }, [handlePaste])

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith("image/")) await addFile(file)
    }
  }

  const remove = (idx: number) => onChange(values.filter((_, i) => i !== idx))

  return (
    <div ref={containerRef} tabIndex={0} style={{ outline: "none", display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Screenshot grid */}
      {values.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
          {values.map((url, idx) => (
            <div key={idx} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Screenshot ${idx + 1}`} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", top: 4, left: 6, background: "rgba(0,0,0,0.55)", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>
                #{idx + 1}
              </div>
              <button onClick={() => remove(idx)}
                style={{ position: "absolute", top: 4, right: 4, background: "rgba(192,57,43,0.85)", border: "none", borderRadius: 6, padding: "3px 5px", cursor: "pointer", color: "white", display: "flex", alignItems: "center" }}>
                <X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div onDrop={handleDrop} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        style={{ border: `2px dashed ${dragging ? "var(--accent)" : "var(--border2)"}`, borderRadius: "var(--radius-sm)", padding: "14px", cursor: "pointer", background: dragging ? "var(--accent-muted)" : "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.15s" }}>
        <Image size={14} color="var(--text3)" />
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text2)" }}>
          {values.length > 0 ? "Tambah screenshot lagi" : "Upload / Ctrl+V / Drop screenshot"}
        </div>
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
        onChange={async e => {
          for (const file of Array.from(e.target.files ?? [])) await addFile(file)
          e.target.value = ""
        }} />

      <div style={{ fontSize: 10, color: "var(--text3)" }}>
        💡 Tip: Klik area di atas lalu <strong>Ctrl+V</strong> untuk paste screenshot langsung
      </div>
    </div>
  )
}

// ── Inline editable text ───────────────────────────────────────────────────────
function InlineEdit({ value, onChange, placeholder, bold }: { value: string; onChange: (v: string) => void; placeholder?: string; bold?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  const commit = () => { onChange(draft); setEditing(false) }
  if (editing) return (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false) } }}
      style={{ background: "var(--surface2)", border: "1.5px solid var(--accent)", borderRadius: 5, padding: "2px 7px", fontSize: 12, fontWeight: bold ? 700 : 400, color: "var(--text)", outline: "none", width: "100%" }} />
  )
  return (
    <span onClick={e => { e.stopPropagation(); setDraft(value); setEditing(true) }}
      title="Click to edit"
      style={{ cursor: "text", borderBottom: "1px dashed var(--border2)", paddingBottom: 1, fontWeight: bold ? 700 : 400, minWidth: 40, display: "inline-block" }}>
      {value || <span style={{ color: "var(--text3)", fontStyle: "italic" }}>{placeholder ?? "click to edit"}</span>}
    </span>
  )
}

// ── Tutorial Admin ─────────────────────────────────────────────────────────────
function TutorialAdmin() {
  type SaveStatus = "idle" | "saving" | "saved" | "error"
  const [apps, setApps] = useState<LandingTutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [errorMsg, setErrorMsg] = useState("")
  const [selAppId, setSelAppId] = useState("")
  const [selImpId, setSelImpId] = useState("")
  const [selStepId, setSelStepId] = useState("")

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase.from("landing_tutorials").select("*").order("app_id")
    if (!error && data) {
      setApps(data as LandingTutorial[])
      if (data.length > 0) {
        const a = data[0] as LandingTutorial
        setSelAppId(a.id)
        const fi = a.improvements?.[0]
        if (fi) { setSelImpId(fi.id); setSelStepId(fi.steps?.[0]?.id ?? "") }
      }
    } else if (error) setErrorMsg(error.message)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const selApp = apps.find(a => a.id === selAppId)
  const selImp = selApp?.improvements?.find(i => i.id === selImpId)
  const selStep = selImp?.steps?.find(s => s.id === selStepId)
  const selStepIdx = selImp?.steps?.findIndex(s => s.id === selStepId) ?? -1

  const saveApp = async (app: LandingTutorial) => {
    setSaveStatus(p => ({ ...p, [app.id]: "saving" })); setErrorMsg("")
    const { error } = await supabase.from("landing_tutorials")
      .update({ app_name: app.app_name, emoji: app.emoji, improvements: app.improvements, updated_at: new Date().toISOString() })
      .eq("id", app.id)
    setSaveStatus(p => ({ ...p, [app.id]: error ? "error" : "saved" }))
    if (error) setErrorMsg(error.message)
    setTimeout(() => setSaveStatus(p => ({ ...p, [app.id]: "idle" })), 3000)
  }
  const saveAll = async () => { for (const a of apps) await saveApp(a) }

  const updateApp = (id: string, f: "app_name" | "emoji", v: string) =>
    setApps(p => p.map(a => a.id === id ? { ...a, [f]: v } : a))
  const addImp = (appId: string) => {
    const id = uid()
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: [...(a.improvements ?? []), { id, name: "New Improvement", pic: "", steps: [] }] } : a))
    setSelImpId(id); setSelStepId("")
  }
  const updateImp = (appId: string, impId: string, name: string) =>
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: a.improvements.map(i => i.id === impId ? { ...i, name } : i) } : a))
  const updateImpPic = (appId: string, impId: string, pic: string) =>
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: a.improvements.map(i => i.id === impId ? { ...i, pic } : i) } : a))
  const removeImp = (appId: string, impId: string) => {
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: a.improvements.filter(i => i.id !== impId) } : a))
    if (selImpId === impId) { setSelImpId(""); setSelStepId("") }
  }
  const addStep = (appId: string, impId: string) => {
    const id = uid()
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: a.improvements.map(i => i.id === impId ? { ...i, steps: [...i.steps, { id, title: "", desc: "", imageUrl: "" }] } : i) } : a))
    setSelStepId(id)
  }
  const updateStep = (appId: string, impId: string, stepId: string, f: keyof TutorialStep, v: string) =>
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: a.improvements.map(i => i.id === impId ? { ...i, steps: i.steps.map(s => s.id === stepId ? { ...s, [f]: v } : s) } : i) } : a))
  const removeStep = (appId: string, impId: string, stepId: string) => {
    const imp = apps.find(a => a.id === appId)?.improvements.find(i => i.id === impId)
    const idx = imp?.steps.findIndex(s => s.id === stepId) ?? -1
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: a.improvements.map(i => i.id === impId ? { ...i, steps: i.steps.filter(s => s.id !== stepId) } : i) } : a))
    if (selStepId === stepId) {
      const newSteps = imp?.steps.filter(s => s.id !== stepId) ?? []
      setSelStepId(newSteps[Math.max(0, idx - 1)]?.id ?? "")
    }
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "40px 0", color: "var(--text3)" }}>
      <RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading from Supabase…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
  if (!apps.length) return (
    <div style={{ textAlign: "center", padding: "48px 0" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>📭</div>
      <div style={{ fontWeight: 700, color: "var(--text2)", marginBottom: 6 }}>No apps found</div>
      <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 12 }}>Make sure <code>landing_tutorials</code> table has rows</div>
      {errorMsg && <div style={{ fontSize: 11, color: "var(--danger)", marginBottom: 12 }}>{errorMsg}</div>}
      <button className="btn btn-ghost" onClick={load}><RefreshCw size={13} /> Retry</button>
    </div>
  )

  const PANEL_H = "calc(100vh - 290px)"
  const card: React.CSSProperties = { display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", minHeight: 380, maxHeight: PANEL_H }
  const pHead: React.CSSProperties = { padding: "9px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "var(--surface)" }
  const pBody: React.CSSProperties = { flex: 1, overflowY: "auto", minHeight: 0 }
  const pLabel: React.CSSProperties = { fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase" as const, letterSpacing: "0.09em" }
  const row = (active: boolean): React.CSSProperties => ({
    padding: "9px 11px", cursor: "pointer",
    background: active ? "var(--accent-muted)" : "transparent",
    borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`,
    borderBottom: "1px solid var(--border)",
  })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>{apps.length} apps</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button className="btn btn-primary" onClick={saveAll} disabled={Object.values(saveStatus).some(v => v === "saving")}>
            <Save size={14} /> Save All
          </button>
        </div>
      </div>
      {errorMsg && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 13px", fontSize: 12, color: "#991B1B" }}>
          <AlertCircle size={13} style={{ display: "inline", marginRight: 6 }} />{errorMsg}
        </div>
      )}

      {/* 4-panel layout */}
      <div style={{ display: "grid", gridTemplateColumns: "180px 200px 220px 1fr", gap: 10 }}>
        {/* Panel 1: Apps */}
        <div style={card}>
          <div style={pHead}><span style={pLabel}>Apps</span></div>
          <div style={pBody}>
            {apps.map(a => (
              <div key={a.id} onClick={() => { setSelAppId(a.id); setSelImpId(a.improvements?.[0]?.id ?? ""); setSelStepId(a.improvements?.[0]?.steps?.[0]?.id ?? "") }}
                style={row(selAppId === a.id)}>
                <div style={{ fontSize: 13 }}>{a.emoji} {a.app_name || <span style={{ color: "var(--text3)", fontStyle: "italic" }}>Unnamed</span>}</div>
                {saveStatus[a.id] === "saved" && <CheckCircle2 size={11} color="var(--success)" style={{ display: "inline", marginLeft: 4 }} />}
                {saveStatus[a.id] === "error" && <AlertCircle size={11} color="var(--danger)" style={{ display: "inline", marginLeft: 4 }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Panel 2: App detail + Improvements */}
        <div style={card}>
          <div style={pHead}>
            <span style={pLabel}>Detail</span>
            {selApp && (
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 8px" }} onClick={() => saveApp(selApp)}>
                <Save size={11} />
              </button>
            )}
          </div>
          <div style={{ ...pBody, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {selApp ? (
              <>
                <div>
                  <div style={{ ...pLabel, marginBottom: 4 }}>Emoji</div>
                  <InlineEdit value={selApp.emoji} onChange={v => updateApp(selApp.id, "emoji", v)} placeholder="emoji" />
                </div>
                <div>
                  <div style={{ ...pLabel, marginBottom: 4 }}>App Name</div>
                  <InlineEdit value={selApp.app_name} onChange={v => updateApp(selApp.id, "app_name", v)} placeholder="app name" bold />
                </div>
                <div>
                  <div style={{ ...pLabel, marginBottom: 6 }}>Improvements</div>
                  {selApp.improvements?.map(imp => (
                    <div key={imp.id} onClick={() => { setSelImpId(imp.id); setSelStepId(imp.steps?.[0]?.id ?? "") }}
                      style={{ ...row(selImpId === imp.id), display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2, borderRadius: 6 }}>
                      <div>
                        <span style={{ fontSize: 12 }}>{imp.name}</span>
                        {imp.pic && <div style={{ fontSize: 9, color: "var(--text3)", marginTop: 1 }}>👤 {imp.pic}</div>}
                      </div>
                      <button onClick={e => { e.stopPropagation(); removeImp(selApp.id, imp.id) }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 2 }}><X size={11} /></button>
                    </div>
                  ))}
                  <button className="btn btn-ghost" style={{ fontSize: 11, marginTop: 6, width: "100%" }} onClick={() => addImp(selApp.id)}>
                    <Plus size={12} /> Add Improvement
                  </button>
                </div>
              </>
            ) : <div style={{ fontSize: 12, color: "var(--text3)", padding: "20px 0" }}>Select an app</div>}
          </div>
        </div>

        {/* Panel 3: Steps + PIC per improvement */}
        <div style={card}>
          <div style={pHead}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span style={pLabel}>{selImp ? selImp.name : "Steps"}</span>
              {selImp && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
                  {PIC_OPTIONS.map(p => (
                    <button key={p} onClick={() => { if (selApp) updateImpPic(selApp.id, selImp.id, p) }}
                      style={{
                        padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, cursor: "pointer",
                        background: (selImp.pic ?? "") === p ? "var(--accent)" : "var(--surface2)",
                        color: (selImp.pic ?? "") === p ? "white" : "var(--text3)",
                        border: (selImp.pic ?? "") === p ? "1px solid var(--accent)" : "1px solid var(--border)",
                      }}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selApp && selImp && (
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "2px 8px", flexShrink: 0 }} onClick={() => addStep(selApp.id, selImp.id)}>
                <Plus size={11} />
              </button>
            )}
          </div>
          <div style={pBody}>
            {selImp?.steps?.map((s, i) => (
              <div key={s.id} onClick={() => setSelStepId(s.id)} style={row(selStepId === s.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 2 }}>Step {i + 1}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{s.title || <span style={{ color: "var(--text3)", fontStyle: "italic" }}>Untitled</span>}</div>
                  </div>
                  <button onClick={e => { e.stopPropagation(); if (selApp && selImp) removeStep(selApp.id, selImp.id, s.id) }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 2 }}><X size={11} /></button>
                </div>
              </div>
            ))}
            {!selImp && <div style={{ fontSize: 12, color: "var(--text3)", padding: 12 }}>Select an improvement</div>}
          </div>
        </div>

        {/* Panel 4: Step editor */}
        <div style={card}>
          <div style={pHead}><span style={pLabel}>Step Editor</span></div>
          <div style={{ ...pBody, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
            {selStep && selApp && selImp ? (
              <>
                <div>
                  <div style={{ ...pLabel, marginBottom: 4 }}>Title</div>
                  <input className="input" value={selStep.title} placeholder="Step title"
                    onChange={e => updateStep(selApp.id, selImp.id, selStep.id, "title", e.target.value)} />
                </div>
                <div>
                  <div style={{ ...pLabel, marginBottom: 4 }}>Description</div>
                  <textarea className="input" rows={3} value={selStep.desc} placeholder="Step description"
                    onChange={e => updateStep(selApp.id, selImp.id, selStep.id, "desc", e.target.value)} />
                </div>
                <div>
                  <div style={{ ...pLabel, marginBottom: 4 }}>Image (Upload / Ctrl+V)</div>
                  <ImageUploader value={selStep.imageUrl} onChange={url => updateStep(selApp.id, selImp.id, selStep.id, "imageUrl", url)} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} disabled={selStepIdx <= 0}
                    onClick={() => {
                      const steps = [...selImp.steps]
                      const i = selStepIdx;
                      [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]
                      setApps(p => p.map(a => a.id === selApp.id ? { ...a, improvements: a.improvements.map(im => im.id === selImp.id ? { ...im, steps } : im) } : a))
                    }}>↑ Move Up</button>
                  <button className="btn btn-ghost" style={{ flex: 1 }} disabled={selStepIdx >= (selImp.steps.length - 1)}
                    onClick={() => {
                      const steps = [...selImp.steps]
                      const i = selStepIdx;
                      [steps[i], steps[i + 1]] = [steps[i + 1], steps[i]]
                      setApps(p => p.map(a => a.id === selApp.id ? { ...a, improvements: a.improvements.map(im => im.id === selImp.id ? { ...im, steps } : im) } : a))
                    }}>↓ Move Down</button>
                </div>
                <button className="btn btn-primary" onClick={() => saveApp(selApp)} disabled={saveStatus[selApp.id] === "saving"}>
                  <Save size={14} /> {saveStatus[selApp.id] === "saving" ? "Saving…" : "Save App"}
                </button>
              </>
            ) : <div style={{ fontSize: 12, color: "var(--text3)", padding: "20px 0" }}>Select a step to edit</div>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Infographics Admin ─────────────────────────────────────────────────────────
function InfographicsAdmin() {
  // List state — WITHOUT image_url for fast loading
  const [items, setItems] = useState<LandingInfographic[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [imageCache, setImageCache] = useState<Record<string, string>>({})

  // Form state for new item
  const emptyForm = (): LandingInfographic => ({
    id: uid(), title: "", tag: "", description: "", image_url: "",
    order_index: 0, pic: "", created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  })
  const [form, setForm] = useState<LandingInfographic>(emptyForm())
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load WITHOUT images for speed
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("landing_infographics")
      .select("id, title, tag, description, pic, order_index, created_at, updated_at")
      .order("order_index")
    if (!error && data) setItems(data as LandingInfographic[])
    else if (error) setErrorMsg(error.message)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Lazy load image when row is expanded
  const loadImage = async (id: string) => {
    if (imageCache[id]) return
    const { data } = await supabase.from("landing_infographics").select("image_url").eq("id", id).single()
    if (data?.image_url) setImageCache(p => ({ ...p, [id]: data.image_url }))
  }

  const handleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    loadImage(id)
  }

  const updateForm = (f: keyof LandingInfographic, v: string) =>
    setForm(p => ({ ...p, [f]: v }))

  const saveNew = async () => {
    if (!form.title) { setErrorMsg("Title wajib diisi"); return }
    setSaving(true); setErrorMsg("")
    const payload = { ...form, order_index: items.length, updated_at: new Date().toISOString() }
    const { error } = await supabase.from("landing_infographics").upsert([payload], { onConflict: "id" })
    if (error) { setErrorMsg(error.message); setSaving(false); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setForm(emptyForm())
    setFormOpen(false)
    setSaving(false)
    await load()
  }

  const remove = async (id: string) => {
    await supabase.from("landing_infographics").delete().eq("id", id)
    setItems(p => p.filter(i => i.id !== id))
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "32px 0", color: "var(--text3)" }}>
      <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Loading…
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>{items.length} infographics · gambar dimuat saat dibuka (lebih cepat ⚡)</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => { setForm(emptyForm()); setFormOpen(true) }}><Plus size={14} /> Add</button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 13px", fontSize: 12, color: "#991B1B", display: "flex", justifyContent: "space-between" }}>
          <span><AlertCircle size={13} style={{ display: "inline", marginRight: 6 }} />{errorMsg}</span>
          <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={12} /></button>
        </div>
      )}

      {/* Add form */}
      {formOpen && (
        <div className="card" style={{ padding: 20, border: "1.5px solid var(--accent)", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>🖼️ Tambah Infografis Baru</div>
            <button onClick={() => setFormOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)" }}><X size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Title *</label>
              <input className="input" placeholder="Judul infografis" value={form.title} onChange={e => updateForm("title", e.target.value)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Tag</label>
              <input className="input" placeholder="e.g. SFA, Ficom" value={form.tag} onChange={e => updateForm("tag", e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Description</label>
            <textarea className="input" rows={2} placeholder="Deskripsi singkat" value={form.description} onChange={e => updateForm("description", e.target.value)} />
          </div>
          <PicSelector value={form.pic ?? ""} onChange={v => updateForm("pic", v)} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Image (Upload / Ctrl+V)</label>
            <ImageUploader value={form.image_url} onChange={url => updateForm("image_url", url)} />
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button className="btn btn-primary" onClick={saveNew} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
              <Save size={14} /> {saving ? "Menyimpan…" : "Simpan"}
            </button>
            <button className="btn btn-ghost" onClick={() => setFormOpen(false)}>Batal</button>
            {saved && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#065F46" }}>
                <CheckCircle2 size={13} /> Tersimpan!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      {items.length === 0 && !formOpen ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🖼️</div>
          <div style={{ fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Belum ada infografis</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>Klik "Add" untuk menambahkan</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                {["#", "Title", "Tag", "PIC", "Tanggal", "Aksi"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <>
                  <tr key={item.id}
                    onClick={() => handleExpand(item.id)}
                    style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", background: expandedId === item.id ? "var(--accent-muted)" : idx % 2 === 0 ? "var(--card)" : "var(--surface)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--text3)", fontSize: 11 }}>{idx + 1}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text)" }}>{item.title || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      {item.tag && <span style={{ background: "var(--accent-muted)", color: "var(--accent)", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{item.tag}</span>}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>{item.pic || <span style={{ color: "var(--text3)" }}>—</span>}</td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--text3)" }}>
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={e => { e.stopPropagation(); remove(item.id) }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4, borderRadius: 6 }}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                  {expandedId === item.id && (
                    <tr key={`${item.id}-exp`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={6} style={{ padding: "12px 14px", background: "var(--surface2)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
                          <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>Deskripsi</div>
                            {item.description || <span style={{ color: "var(--text3)", fontStyle: "italic" }}>Tidak ada deskripsi</span>}
                          </div>
                          <div>
                            {imageCache[item.id] ? (
                              <img src={imageCache[item.id]} alt={item.title}
                                style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                            ) : (
                              <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12, gap: 6 }}>
                                <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Memuat gambar…
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Zoom Admin ─────────────────────────────────────────────────────────────────
function ZoomAdmin() {
  const [items, setItems] = useState<SharingZoom[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [expanded, setExpanded] = useState<string | null>(null)

  // Form for new entry
  const [form, setForm] = useState({ title: "", tanggal: "", pic: "", screenshots: [] as string[] })
  const [formOpen, setFormOpen] = useState(false)
  const [formSaving, setFormSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    // Load without screenshots for speed — screenshots loaded on expand
    const { data, error } = await supabase.from("sharing_zoom")
      .select("id, title, tanggal, pic, updated_at, created_at, screenshots")
      .order("tanggal", { ascending: false })
    if (!error && data) setItems(data as SharingZoom[])
    else if (error) setErrorMsg(error.message)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const saveNew = async () => {
    if (!form.title || !form.tanggal || !form.pic) { setErrorMsg("Title, tanggal, dan PIC wajib diisi"); return }
    setFormSaving(true); setErrorMsg("")
    const { error } = await supabase.from("sharing_zoom").insert([{
      title: form.title, tanggal: form.tanggal, pic: form.pic,
      screenshots: form.screenshots, updated_at: new Date().toISOString()
    }])
    if (error) { setErrorMsg(error.message); setFormSaving(false); return }
    setForm({ title: "", tanggal: "", pic: "", screenshots: [] })
    setFormOpen(false)
    setFormSaving(false)
    await load()
  }

  const remove = async (id: string) => {
    await supabase.from("sharing_zoom").delete().eq("id", id)
    setItems(p => p.filter(i => i.id !== id))
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "32px 0", color: "var(--text3)" }}>
      <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Loading…
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>{items.length} sesi zoom terdokumentasi</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button className="btn btn-primary" onClick={() => setFormOpen(true)}><Plus size={14} /> Tambah Sesi</button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 13px", fontSize: 12, color: "#991B1B" }}>
          <AlertCircle size={13} style={{ display: "inline", marginRight: 6 }} />{errorMsg}
          <button onClick={() => setErrorMsg("")} style={{ background: "none", border: "none", cursor: "pointer", marginLeft: 8 }}><X size={11} /></button>
        </div>
      )}

      {/* Form tambah sesi */}
      {formOpen && (
        <div className="card" style={{ padding: 20, border: "1.5px solid var(--accent)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>📹 Tambah Sesi Zoom Baru</div>
            <button onClick={() => { setFormOpen(false); setErrorMsg("") }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)" }}><X size={16} /></button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Nama Sosialisasi *</label>
              <input className="input" placeholder="e.g. Training SFA Q2 2025" value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>Tanggal *</label>
              <input className="input" type="date" value={form.tanggal}
                onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))} />
            </div>
          </div>
          <PicSelector value={form.pic} onChange={v => setForm(p => ({ ...p, pic: v }))} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase" }}>
              Screenshots ({form.screenshots.length} foto)
            </label>
            <MultiImageUploader
              values={form.screenshots}
              onChange={urls => setForm(p => ({ ...p, screenshots: urls }))}
            />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" onClick={saveNew} disabled={formSaving} style={{ opacity: formSaving ? 0.7 : 1 }}>
              <Save size={14} /> {formSaving ? "Menyimpan…" : "Simpan Sesi"}
            </button>
            <button className="btn btn-ghost" onClick={() => { setFormOpen(false); setErrorMsg("") }}>Batal</button>
          </div>
        </div>
      )}

      {/* Table + expand */}
      {items.length === 0 && !formOpen ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📹</div>
          <div style={{ fontWeight: 600, color: "var(--text2)", marginBottom: 4 }}>Belum ada sesi zoom</div>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>Klik "Tambah Sesi" untuk mendokumentasikan zoom pertama</div>
        </div>
      ) : (
        <div className="card" style={{ overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                {["#", "Nama Sosialisasi", "Tanggal", "PIC", "Screenshot", "Aksi"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <>
                  <tr key={item.id}
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                    style={{ cursor: "pointer", borderBottom: "1px solid var(--border)", background: expanded === item.id ? "var(--accent-muted)" : idx % 2 === 0 ? "var(--card)" : "var(--surface)" }}>
                    <td style={{ padding: "10px 14px", color: "var(--text3)", fontSize: 11 }}>{idx + 1}</td>
                    <td style={{ padding: "10px 14px", fontWeight: 600, color: "var(--text)" }}>📹 {item.title}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>
                      {new Date(item.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>{item.pic || "—"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "var(--accent-muted)", color: "var(--accent)", borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                        🖼️ {item.screenshots?.length ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", display: "flex", gap: 6, alignItems: "center" }}>
                      <button onClick={e => { e.stopPropagation(); remove(item.id) }}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: 4, borderRadius: 6 }}>
                        <Trash2 size={13} />
                      </button>
                      <span style={{ color: "var(--text3)", fontSize: 14 }}>{expanded === item.id ? "▲" : "▼"}</span>
                    </td>
                  </tr>
                  {expanded === item.id && (
                    <tr key={`${item.id}-exp`} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td colSpan={6} style={{ padding: "14px 16px", background: "var(--surface2)" }}>
                        {item.screenshots?.length > 0 ? (
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                            {item.screenshots.map((url, i) => (
                              <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1px solid var(--border)" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={url} alt={`SS ${i + 1}`} style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
                                <div style={{ position: "absolute", top: 4, left: 6, background: "rgba(0,0,0,0.55)", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10 }}>#{i + 1}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "var(--text3)", textAlign: "center", padding: "16px 0" }}>Tidak ada screenshot</div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "tutorials",    label: "Tutorials",    icon: BookOpen },
  { id: "infographics", label: "Infographics", icon: Image },
  { id: "zoom",         label: "Zoom",         icon: Video },
]

export default function LandingAdminPage() {
  const [tab, setTab] = useState("tutorials")
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <MotivationBanner page="docreq" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>📚 Sharing Knowledge</h1>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>Kelola Tutorial, Infografis, dan Zoom untuk KPI Sharing Knowledge</p>
        </div>
        
      </div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: "10px 20px", borderRadius: "8px 8px 0 0", fontFamily: "inherit", fontSize: 13, fontWeight: tab === t.id ? 700 : 500, color: tab === t.id ? "var(--accent)" : "var(--text3)", borderBottom: tab === t.id ? "2px solid var(--accent)" : "2px solid transparent", display: "flex", alignItems: "center", gap: 6, transition: "all 0.15s", marginBottom: -1 }}>
              <Icon size={14} /> {t.label}
            </button>
          )
        })}
      </div>
      <div>
        {tab === "tutorials"    && <TutorialAdmin />}
        {tab === "infographics" && <InfographicsAdmin />}
        {tab === "zoom"         && <ZoomAdmin />}
      </div>
    </div>
  )
}