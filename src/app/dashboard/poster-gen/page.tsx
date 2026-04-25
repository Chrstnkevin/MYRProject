"use client"

import { useState, useRef, useCallback } from "react"
import {
  Sparkles, Download, RefreshCw, Upload, X, FileText,
  Loader2, AlertCircle, CheckCircle2, Monitor, Smartphone, Square
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

type Orientation = "portrait" | "landscape" | "square"
type StylePreset  = "minimalist" | "corporate" | "bold" | "editorial"

const ORIENTATIONS: { key: Orientation; label: string; icon: typeof Monitor; desc: string }[] = [
  { key: "portrait",  label: "Portrait",  icon: Smartphone, desc: "A4 · Laporan" },
  { key: "landscape", label: "Landscape", icon: Monitor,    desc: "16:9 · Presentasi" },
  { key: "square",    label: "Square",    icon: Square,     desc: "1:1 · Sosmed" },
]

const STYLES: { key: StylePreset; label: string; desc: string }[] = [
  { key: "minimalist", label: "Minimalist", desc: "Clean, putih, elegan" },
  { key: "corporate",  label: "Corporate",  desc: "Biru profesional" },
  { key: "bold",       label: "Bold Dark",  desc: "Dark mode, oranye" },
  { key: "editorial",  label: "Editorial",  desc: "Ungu artistik" },
]

const ORI_SIZE = {
  portrait:  { w: 794,  h: 1123 },
  landscape: { w: 1280, h: 720  },
  square:    { w: 1080, h: 1080 },
}

export default function PosterGenPage() {
  const [text, setText]               = useState("")
  const [file, setFile]               = useState<File | null>(null)
  const [orientation, setOrientation] = useState<Orientation>("portrait")
  const [style, setStyle]             = useState<StylePreset>("minimalist")
  const [generating, setGenerating]   = useState(false)
  const [posterHtml, setPosterHtml]   = useState<string | null>(null)
  const [posterTitle, setPosterTitle] = useState("poster")
  const [error, setError]             = useState<string | null>(null)
  const [toast, setToast]             = useState<string | null>(null)
  const iframeRef                     = useRef<HTMLIFrameElement>(null)
  const fileRef                       = useRef<HTMLInputElement>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }

  const handleFile = useCallback((f: File) => {
    setFile(f); setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const readFileAsBase64 = (f: File): Promise<string> =>
    new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = ev => resolve((ev.target?.result as string).split(",")[1] || "")
      reader.readAsDataURL(f)
    })

  const generate = async () => {
    if (!text.trim() && !file) { setError("Masukkan teks atau upload dokumen."); return }
    setGenerating(true); setError(null); setPosterHtml(null)

    try {
      let fileBase64 = null, fileType = null, fileName = null
      if (file) {
        fileBase64 = await readFileAsBase64(file)
        fileType   = file.type
        fileName   = file.name
      }

      const res = await fetch("/api/generate-poster", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docContent: text, fileBase64, fileType, fileName, orientation, style }),
      })

      const data = await res.json()
      if (!res.ok || !data.html) throw new Error(data.error || "Gagal generate poster")

      setPosterHtml(data.html)
      setPosterTitle(data.title || "poster")
      showToast("Poster berhasil digenerate! ✅")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal generate poster")
    } finally {
      setGenerating(false)
    }
  }

  const downloadPng = async () => {
    if (!iframeRef.current?.contentDocument) return
    try {
      const html2canvas = (await import("html2canvas")).default
      const body        = iframeRef.current.contentDocument.body
      const canvas      = await html2canvas(body, {
        scale: 2, useCORS: true, allowTaint: true,
        width:  ORI_SIZE[orientation].w,
        height: ORI_SIZE[orientation].h,
      })
      const url  = canvas.toDataURL("image/png")
      const a    = document.createElement("a")
      a.href     = url
      a.download = `${posterTitle.replace(/[^a-z0-9]/gi, "_")}-poster.png`
      a.click()
      showToast("Poster diunduh!")
    } catch {
      // Fallback: download HTML
      const blob = new Blob([posterHtml!], { type: "text/html" })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement("a")
      a.href     = url; a.download = `${posterTitle}-poster.html`; a.click()
      URL.revokeObjectURL(url)
      showToast("Diunduh sebagai HTML (buka di browser lalu print/save as PDF)")
    }
  }

  const ori = ORI_SIZE[orientation]

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <MotivationBanner page="docreq" />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>🎨 Poster Generator</h1>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>Upload dokumen → AI generate poster clean & terbaca</p>
        </div>
        {posterHtml && (
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-ghost" onClick={generate} disabled={generating}><RefreshCw size={14}/> Regenerate</button>
            <button className="btn btn-primary" onClick={downloadPng}><Download size={14}/> Download PNG</button>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: posterHtml ? "380px 1fr" : "1fr", gap: "20px", alignItems: "start" }}>
        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div className="card" style={{ padding: "18px" }}>
            <div className="label" style={{ marginBottom: "10px" }}>KONTEN DOKUMEN</div>
            <div
              onDrop={handleDrop} onDragOver={e => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              style={{ border: `2px dashed ${file ? "var(--accent)" : "var(--border2)"}`, borderRadius: "var(--radius-sm)", padding: "16px", textAlign: "center", cursor: "pointer", marginBottom: "10px", background: file ? "var(--accent-muted)" : "var(--surface2)", transition: "all 0.15s" }}>
              {file ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <FileText size={16} color="var(--accent)"/>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--accent)" }}>{file.name}</span>
                  <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)" }} onClick={e => { e.stopPropagation(); setFile(null) }}><X size={13}/></button>
                </div>
              ) : (
                <>
                  <Upload size={18} color="var(--text3)" style={{ margin: "0 auto 6px" }}/>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text2)" }}>Upload Dokumen</div>
                  <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>PDF, Word (.docx), TXT</div>
                </>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.txt,.md" style={{ display: "none" }}
                onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}/>
            </div>
            <textarea className="input" rows={4} placeholder="Atau paste teks / tambahan konteks…" value={text} onChange={e => setText(e.target.value)}/>
          </div>

          <div className="card" style={{ padding: "16px" }}>
            <div className="label" style={{ marginBottom: "10px" }}>ORIENTASI</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "6px" }}>
              {ORIENTATIONS.map(o => {
                const Icon = o.icon; const active = orientation === o.key
                return (
                  <button key={o.key} onClick={() => setOrientation(o.key)}
                    style={{ padding: "10px 6px", borderRadius: "var(--radius-sm)", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-muted)" : "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", transition: "all 0.15s" }}>
                    <Icon size={16} color={active ? "var(--accent)" : "var(--text3)"}/>
                    <span style={{ fontSize: "11px", fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text)" }}>{o.label}</span>
                    <span style={{ fontSize: "10px", color: "var(--text3)" }}>{o.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="card" style={{ padding: "16px" }}>
            <div className="label" style={{ marginBottom: "10px" }}>TEMA WARNA</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {STYLES.map(s => {
                const active = style === s.key
                return (
                  <button key={s.key} onClick={() => setStyle(s.key)}
                    style={{ padding: "9px 12px", borderRadius: "var(--radius-sm)", border: `1.5px solid ${active ? "var(--accent)" : "var(--border)"}`, background: active ? "var(--accent-muted)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.15s", textAlign: "left" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: active ? "var(--accent)" : "var(--border2)", flexShrink: 0 }}/>
                    <div>
                      <div style={{ fontSize: "12px", fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text)" }}>{s.label}</div>
                      <div style={{ fontSize: "10px", color: "var(--text3)" }}>{s.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {error && (
            <div style={{ display: "flex", gap: "8px", padding: "11px 13px", background: "var(--danger-bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--danger)" }}>
              <AlertCircle size={14} color="var(--danger)" style={{ flexShrink: 0, marginTop: "1px" }}/>
              <span style={{ fontSize: "12px", color: "var(--danger)" }}>{error}</span>
            </div>
          )}

          <button className="btn btn-primary" onClick={generate} disabled={generating}
            style={{ padding: "13px", fontSize: "14px", fontWeight: 700, justifyContent: "center" }}>
            {generating
              ? <><Loader2 size={15} style={{ animation: "spin 1s linear infinite" }}/> Generating…</>
              : <><Sparkles size={15}/> Generate Poster</>}
          </button>
        </div>

        {/* Poster Preview */}
        {posterHtml && (
          <div className="card" style={{ padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
              <div className="label">HASIL POSTER</div>
              <span style={{ fontSize: "11px", color: "var(--text3)" }}>{ori.w}×{ori.h}px</span>
            </div>
            {/* Scale iframe to fit container */}
            <div style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", background: "#f5f5f5" }}>
              <div style={{ transform: `scale(${Math.min(1, (typeof window !== "undefined" ? window.innerWidth * 0.55 : 700) / ori.w)})`, transformOrigin: "top left", width: ori.w, height: ori.h }}>
                <iframe
                  ref={iframeRef}
                  srcDoc={posterHtml}
                  style={{ width: ori.w, height: ori.h, border: "none", display: "block" }}
                  title="Poster Preview"
                />
              </div>
            </div>
            <p style={{ fontSize: "11px", color: "var(--text3)", marginTop: "10px", textAlign: "center" }}>
              💡 Download PNG untuk kualitas terbaik
            </p>
          </div>
        )}
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", background: "var(--accent)", color: "white", padding: "11px 16px", borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-md)", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "8px", zIndex: 9999 }}>
          <CheckCircle2 size={14}/>{toast}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}