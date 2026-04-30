"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import {
  Plus, Trash2, Image, BookOpen, Save, X, Eye,
  RefreshCw, AlertCircle, CheckCircle2, ChevronRight,
  Pencil, Upload
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"
import type { LandingTutorial, TutorialStep, TutorialImprovement, LandingInfographic } from "@/lib/types"

// ── Types ──────────────────────────────────────────────────────────────────────
// (LandingInfographic is now from lib/types — has id, title, tag, description, image_url, order_index)

const uid = () => crypto.randomUUID()

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

// ── Image Uploader ─────────────────────────────────────────────────────────────
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
            <Upload size={16} color="var(--text3)" style={{ margin: "0 auto 5px", display: "block" }} />
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text2)" }}>Upload / Ctrl+V paste</div>
          </div>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = "" }} />
    </div>
  )
}

// ── Inline editable text ───────────────────────────────────────────────────────
function InlineEdit({ value, onChange, placeholder, bold }: { value: string; onChange: (v: string) => void; placeholder?: string; bold?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value)
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
      style={{ cursor: "text", borderRadius: 4, padding: "2px 3px", display: "inline-flex", alignItems: "center", gap: 4, maxWidth: "100%", transition: "background 0.1s" }}
      onMouseEnter={e => e.currentTarget.style.background = "var(--surface3)"}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <span style={{ fontSize: 12, fontWeight: bold ? 700 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {value || <span style={{ color: "var(--text3)", fontStyle: "italic", fontWeight: 400 }}>{placeholder}</span>}
      </span>
      <Pencil size={9} color="var(--text3)" style={{ flexShrink: 0 }} />
    </span>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TUTORIAL ADMIN — 3-Panel Layout (no more accordion scroll hell)
// [Apps] | [Improvements] | [Step mini-nav + Editor]
// ══════════════════════════════════════════════════════════════════════════════
function TutorialAdmin() {
  type SaveStatus = "idle" | "saving" | "saved" | "error"

  const [apps, setApps]           = useState<LandingTutorial[]>([])
  const [loading, setLoading]     = useState(true)
  const [saveStatus, setSaveStatus] = useState<Record<string, SaveStatus>>({})
  const [errorMsg, setErrorMsg]   = useState("")
  const [selAppId, setSelAppId]   = useState("")
  const [selImpId, setSelImpId]   = useState("")
  const [selStepId, setSelStepId] = useState("")

  // Load
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

  const selApp  = apps.find(a => a.id === selAppId)
  const selImp  = selApp?.improvements?.find(i => i.id === selImpId)
  const selStep = selImp?.steps?.find(s => s.id === selStepId)
  const selStepIdx = selImp?.steps?.findIndex(s => s.id === selStepId) ?? -1

  // Save
  const saveApp = async (app: LandingTutorial) => {
    setSaveStatus(p => ({ ...p, [app.id]: "saving" })); setErrorMsg("")
    const { error } = await supabase.from("landing_tutorials")
      .update({ app_name: app.app_name, emoji: app.emoji, improvements: app.improvements, updated_at: new Date().toISOString() })
      .eq("id", app.id)
    setSaveStatus(p => ({ ...p, [app.id]: error ? "error" : "saved" }))
    if (error) setErrorMsg(error.message)
    setTimeout(() => setSaveStatus(p => ({ ...p, [app.id]: "idle" })), 3000)
  }
  const saveAll    = async () => { for (const a of apps) await saveApp(a) }
  const anyStatus  = (s: SaveStatus) => Object.values(saveStatus).some(v => v === s)

  // Mutations
  const updateApp  = (id: string, f: "app_name" | "emoji", v: string) =>
    setApps(p => p.map(a => a.id === id ? { ...a, [f]: v } : a))
  const addImp = (appId: string) => {
    const id = uid()
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: [...(a.improvements ?? []), { id, name: "New Improvement", steps: [] }] } : a))
    setSelImpId(id); setSelStepId("")
  }
  const updateImp  = (appId: string, impId: string, name: string) =>
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: a.improvements.map(i => i.id === impId ? { ...i, name } : i) } : a))
  const removeImp  = (appId: string, impId: string) => {
    setApps(p => p.map(a => a.id === appId ? { ...a, improvements: a.improvements.filter(i => i.id !== impId) } : a))
    if (selImpId === impId) { setSelImpId(""); setSelStepId("") }
  }
  const addStep    = (appId: string, impId: string) => {
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

  // Shared panel styles
  const PANEL_H = "calc(100vh - 290px)"
  const card: React.CSSProperties    = { display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--card)", borderRadius: "var(--radius)", border: "1px solid var(--border)", minHeight: 380, maxHeight: PANEL_H }
  const pHead: React.CSSProperties   = { padding: "9px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, background: "var(--surface)" }
  const pBody: React.CSSProperties   = { flex: 1, overflowY: "auto", minHeight: 0 }
  const pLabel: React.CSSProperties  = { fontSize: 10, fontWeight: 800, color: "var(--text3)", textTransform: "uppercase" as const, letterSpacing: "0.09em" }
  const row = (active: boolean): React.CSSProperties => ({
    padding: "9px 11px", cursor: "pointer",
    background: active ? "var(--accent-muted)" : "transparent",
    borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}`,
    borderBottom: "1px solid var(--border)",
    transition: "all 0.12s",
  })
  const addBtn = (onClick: () => void, label: string) => (
    <button onClick={onClick} style={{ background: "var(--accent)", border: "none", borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: "white", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
      <Plus size={10} /> {label}
    </button>
  )

  const totalImps  = apps.reduce((n, a) => n + (a.improvements?.length ?? 0), 0)
  const totalSteps = apps.reduce((n, a) => n + (a.improvements?.reduce((m, i) => m + i.steps.length, 0) ?? 0), 0)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: "var(--text3)" }}>
          {apps.length} apps · {totalImps} improvements · {totalSteps} steps
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button className="btn btn-primary" onClick={saveAll} disabled={anyStatus("saving")} style={{ opacity: anyStatus("saving") ? 0.7 : 1 }}>
            <Save size={14} /> {anyStatus("saving") ? "Saving…" : "Save All"}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ display: "flex", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 13px", fontSize: 12, color: "#991B1B" }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <div><strong>Error:</strong> {errorMsg} <br /><span style={{ opacity: 0.75, fontSize: 11 }}>Check RLS policy: allow UPDATE for your role.</span></div>
        </div>
      )}

      {/* ══ 3-PANEL GRID ══ */}
      <div style={{ display: "grid", gridTemplateColumns: "190px 210px 1fr", gap: 10, alignItems: "start" }}>

        {/* ── PANEL 1: Apps ─────────────────────────────────────── */}
        <div style={card}>
          <div style={pHead}>
            <span style={pLabel}>Apps ({apps.length})</span>
          </div>
          <div style={pBody}>
            {apps.map(app => {
              const active = app.id === selAppId
              const st     = saveStatus[app.id] ?? "idle"
              return (
                <div key={app.id} style={row(active)}
                  onClick={() => {
                    setSelAppId(app.id)
                    const fi = app.improvements?.[0]
                    setSelImpId(fi?.id ?? ""); setSelStepId(fi?.steps?.[0]?.id ?? "")
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface2)" }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <input value={app.emoji} onClick={e => e.stopPropagation()}
                      onChange={e => updateApp(app.id, "emoji", e.target.value)}
                      style={{ width: 26, textAlign: "center", fontSize: 15, background: "none", border: "none", outline: "none", cursor: "text", padding: 0, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {app.app_name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text3)" }}>
                        {app.improvements?.length ?? 0} impr · {app.improvements?.reduce((n, i) => n + i.steps.length, 0) ?? 0} steps
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                      {st === "saving" && <RefreshCw size={10} color="var(--text3)" style={{ animation: "spin 1s linear infinite" }} />}
                      {st === "saved"  && <CheckCircle2 size={10} color="#16a34a" />}
                      {st === "error"  && <AlertCircle  size={10} color="var(--danger)" />}
                      <ChevronRight size={11} color="var(--text3)" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {selApp && (
            <div style={{ padding: "7px 9px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
              <button className="btn btn-ghost" style={{ width: "100%", fontSize: 11, justifyContent: "center" }}
                onClick={() => saveApp(selApp)} disabled={saveStatus[selApp.id] === "saving"}>
                <Save size={11} /> Save "{selApp.app_name}"
              </button>
            </div>
          )}
        </div>

        {/* ── PANEL 2: Improvements ─────────────────────────────── */}
        <div style={card}>
          <div style={pHead}>
            <span style={pLabel}>{selApp ? `${selApp.emoji} Improvements` : "Improvements"}</span>
            {selApp && addBtn(() => addImp(selApp.id), "Add")}
          </div>
          <div style={pBody}>
            {!selApp ? (
              <div style={{ padding: "32px 14px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>← Select an app first</div>
            ) : (selApp.improvements ?? []).length === 0 ? (
              <div style={{ padding: "32px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🗂️</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginBottom: 10 }}>No improvements yet</div>
                <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={() => addImp(selApp.id)}><Plus size={11} /> Add first improvement</button>
              </div>
            ) : (selApp.improvements ?? []).map((imp, idx) => {
              const active = imp.id === selImpId
              return (
                <div key={imp.id} style={row(active)}
                  onClick={() => { setSelImpId(imp.id); setSelStepId(imp.steps?.[0]?.id ?? "") }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface2)" }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                    <div style={{ width: 19, height: 19, borderRadius: "50%", flexShrink: 0, background: active ? "var(--accent)" : "var(--border2)", color: active ? "white" : "var(--text3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, marginTop: 1 }}>{idx + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div onClick={e => e.stopPropagation()}>
                        <InlineEdit value={imp.name} placeholder="Improvement name…" bold={active}
                          onChange={v => updateImp(selApp.id, imp.id, v)} />
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 2, paddingLeft: 3 }}>
                        {imp.steps.length} step{imp.steps.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); removeImp(selApp.id, imp.id) }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "2px", flexShrink: 0, opacity: 0.5 }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}>
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── PANEL 3: Steps + Editor ───────────────────────────── */}
        <div style={card}>
          <div style={pHead}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0 }}>
              <span style={pLabel}>Steps</span>
              {selImp && <span style={{ fontSize: 11, color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>— {selImp.name}</span>}
            </div>
            {selImp && addBtn(() => addStep(selApp!.id, selImp.id), "Add Step")}
          </div>

          {!selImp ? (
            <div style={{ padding: "48px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>← Select an improvement</div>
          ) : (
            <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>

              {/* Step list mini-sidebar */}
              <div style={{ width: 150, flexShrink: 0, borderRight: "1px solid var(--border)", overflowY: "auto", display: "flex", flexDirection: "column" }}>
                {selImp.steps.length === 0 ? (
                  <div style={{ padding: "24px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 8 }}>No steps yet</div>
                    <button className="btn btn-ghost" style={{ fontSize: 10, width: "100%" }} onClick={() => addStep(selApp!.id, selImp.id)}><Plus size={10} /> Add first step</button>
                  </div>
                ) : selImp.steps.map((step, si) => {
                  const active = step.id === selStepId
                  return (
                    <div key={step.id} onClick={() => setSelStepId(step.id)}
                      style={{ ...row(active), borderLeft: `3px solid ${active ? "var(--accent)" : "transparent"}` }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--surface2)" }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 17, height: 17, borderRadius: "50%", flexShrink: 0, background: active ? "var(--accent)" : "var(--border2)", color: active ? "white" : "var(--text3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 800 }}>{si + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? "var(--accent)" : "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {step.title || <span style={{ color: "var(--text3)", fontStyle: "italic" }}>Untitled</span>}
                          </div>
                          {step.imageUrl && <div style={{ fontSize: 9, color: "#16a34a" }}>📷</div>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Step editor */}
              {!selStep ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: 12 }}>← Select a step</div>
              ) : (
                <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>

                  {/* Step header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ ...pLabel, color: "var(--accent)" }}>
                      Step {selStepIdx + 1} / {selImp.steps.length}
                    </span>
                    <button onClick={() => removeStep(selApp!.id, selImp.id, selStep.id)}
                      style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, padding: "3px 9px", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>

                  {/* Title */}
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>Step Title</div>
                    <input className="input" placeholder="e.g. Open Login Page"
                      value={selStep.title}
                      onChange={e => updateStep(selApp!.id, selImp.id, selStep.id, "title", e.target.value)} />
                  </div>

                  {/* Description */}
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>Description</div>
                    <textarea className="input" rows={5} placeholder="Explain what to do in this step…"
                      value={selStep.desc}
                      onChange={e => updateStep(selApp!.id, selImp.id, selStep.id, "desc", e.target.value)}
                      style={{ resize: "vertical", lineHeight: 1.6 }} />
                  </div>

                  {/* Image */}
                  <div>
                    <div className="label" style={{ marginBottom: 4 }}>Screenshot</div>
                    <div style={{ fontSize: 10, color: "var(--text3)", marginBottom: 5 }}>
                      Upload, drag & drop, atau <kbd style={{ background: "var(--surface3)", border: "1px solid var(--border2)", borderRadius: 3, padding: "0 4px", fontFamily: "monospace", fontSize: 9 }}>Ctrl+V</kbd> paste — disimpan langsung ✅
                    </div>
                    <ImageUploader value={selStep.imageUrl}
                      onChange={url => updateStep(selApp!.id, selImp.id, selStep.id, "imageUrl", url)} />
                  </div>

                  {/* Prev / Next step navigation */}
                  <div style={{ display: "flex", gap: 8, paddingTop: 4, borderTop: "1px solid var(--border)" }}>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11, justifyContent: "center" }}
                      disabled={selStepIdx <= 0}
                      onClick={() => setSelStepId(selImp.steps[selStepIdx - 1].id)}>← Prev</button>
                    <button className="btn btn-ghost" style={{ flex: 1, fontSize: 11, justifyContent: "center" }}
                      disabled={selStepIdx >= selImp.steps.length - 1}
                      onClick={() => setSelStepId(selImp.steps[selStepIdx + 1].id)}>Next →</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom save bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--border)" }}>
        <button className="btn btn-primary" onClick={saveAll} disabled={anyStatus("saving")} style={{ opacity: anyStatus("saving") ? 0.7 : 1 }}>
          <Save size={14} /> {anyStatus("saving") ? "Saving…" : "Save All to Supabase"}
        </button>
        {anyStatus("saved") && !anyStatus("saving") && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#065F46" }}>
            <CheckCircle2 size={13} /> All saved! Public tutorial page updated.
          </div>
        )}
        {anyStatus("error") && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#991B1B" }}>
            <AlertCircle size={13} /> Save failed — check error above.
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── TAB: Infographics — Supabase-backed ───────────────────────────────────────
function InfographicsAdmin() {
  const [items, setItems]     = useState<LandingInfographic[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [errorMsg, setErrorMsg] = useState("")

  // Load from Supabase
  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("landing_infographics")
      .select("*")
      .order("order_index")
    if (!error && data) setItems(data as LandingInfographic[])
    else if (error) setErrorMsg(error.message)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const update = (id: string, f: keyof LandingInfographic, v: string | number) =>
    setItems(p => p.map(i => i.id === id ? { ...i, [f]: v } : i))

  const add = () => {
    const newItem: LandingInfographic = {
      id: uid(), title: "", tag: "", description: "", image_url: "",
      order_index: items.length, created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
    setItems(p => [...p, newItem])
  }

  const remove = async (id: string) => {
    // Delete from Supabase if it's a real UUID (not local-only)
    const item = items.find(i => i.id === id)
    if (item) {
      await supabase.from("landing_infographics").delete().eq("id", id)
    }
    setItems(p => p.filter(i => i.id !== id))
  }

  // Upsert all to Supabase — handles both new + existing rows
  const saveAll = async () => {
    setSaving(true); setErrorMsg(""); setSaved(false)
    const payload = items.map((item, idx) => ({
      ...item,
      order_index: idx,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from("landing_infographics")
      .upsert(payload, { onConflict: "id" })
    if (error) setErrorMsg(error.message)
    else { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    setSaving(false)
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "32px 0", color: "var(--text3)" }}>
      <RefreshCw size={15} style={{ animation: "spin 1s linear infinite" }} /> Loading…
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ fontSize: 12, color: "var(--text3)" }}>{items.length} infographics — data persists on refresh ✅</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={load}><RefreshCw size={13} /> Refresh</button>
          <button className="btn btn-primary" onClick={add}><Plus size={14} /> Add</button>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "9px 13px", fontSize: 12, color: "#991B1B" }}>
          <AlertCircle size={13} style={{ display: "inline", marginRight: 6 }} />{errorMsg}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {items.map((item, idx) => (
          <div key={item.id} className="card" style={{ padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em" }}>#{idx + 1}</div>
              <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }}><Trash2 size={14} /></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="input" placeholder="Title" value={item.title}
                onChange={e => update(item.id, "title", e.target.value)} />
              <input className="input" placeholder="Tag (e.g. SFA, Ficom)" value={item.tag}
                onChange={e => update(item.id, "tag", e.target.value)} />
              <textarea className="input" rows={2} placeholder="Description" value={item.description}
                onChange={e => update(item.id, "description", e.target.value)} />
              {/* Image — base64 saved directly to Supabase like restore-phi ✅ */}
              <div>
                <div className="label" style={{ marginBottom: 4 }}>Image (Upload / Ctrl+V paste)</div>
                <ImageUploader value={item.image_url} onChange={url => update(item.id, "image_url", url)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button className="btn btn-primary" onClick={saveAll} disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
          <Save size={14} /> {saving ? "Saving…" : "Save All to Supabase"}
        </button>
        {saved && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ECFDF5", border: "1px solid #6EE7B7", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#065F46" }}>
            <CheckCircle2 size={13} /> Saved! Refresh won't lose your data.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
const TABS = [
  { id: "tutorials",    label: "Tutorials",    icon: BookOpen },
  { id: "infographics", label: "Infographics", icon: Image },
]

export default function LandingAdminPage() {
  const [tab, setTab] = useState("tutorials")
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <MotivationBanner page="docreq" />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>📖 Tutorials Admin</h1>
          <p style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>Manage Tutorial and Infographic content for the public landing page</p>
        </div>
        <a href="/landing" target="_blank" rel="noopener noreferrer">
          <button className="btn btn-ghost"><Eye size={14} /> Preview Landing</button>
        </a>
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
      </div>
    </div>
  )
}