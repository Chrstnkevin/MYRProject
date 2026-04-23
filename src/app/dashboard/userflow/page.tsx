"use client"

import { useState, useRef, useCallback } from "react"
import { ImageIcon, Sparkles, Copy, Check, RefreshCw, Trash2, Upload, ClipboardPaste } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import ModalOverlay from "@/components/layout/ModalOverlay"

const SYSTEM_PROMPT = `Kamu adalah analis proses bisnis yang ahli membaca diagram alur (flowchart).
Tugasmu adalah mendeskripsikan flowchart yang diberikan dalam bentuk narasi yang mengalir, bukan poin-poin atau bullet list.
Gunakan bahasa Indonesia yang lugas dan langsung pada inti alur prosesnya.
Narasi harus singkat (2–4 paragraf), menjelaskan alur dari awal hingga akhir termasuk percabangan keputusan jika ada.
Jangan memulai dengan "Flowchart ini menggambarkan..." — langsung mulai dengan deskripsi prosesnya.
Jangan gunakan bullet point, numbering, atau heading.`

const USER_PROMPT = `Deskripsikan flowchart atau diagram alur pada gambar ini dalam bentuk narasi yang mengalir dan langsung pada intinya.`

function fileToBase64(file: File): Promise<{ base64: string; type: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => {
      const dataUrl = r.result as string
      const base64 = dataUrl.split(",")[1]
      res({ base64, type: file.type })
    }
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

export default function UserFlowPage() {
  const [image, setImage]         = useState<string | null>(null)   // base64
  const [imgType, setImgType]     = useState("image/png")
  const [imgPreview, setImgPreview] = useState<string | null>(null) // data URL
  const [result, setResult]       = useState("")
  const [loading, setLoading]     = useState(false)
  const [copied, setCopied]       = useState(false)
  const [error, setError]         = useState("")
  const [previewOpen, setPreviewOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadImage = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar (PNG, JPG, WebP, dll)")
      return
    }
    setError("")
    setResult("")
    fileToBase64(file).then(({ base64, type }) => {
      setImage(base64)
      setImgType(type)
      setImgPreview(`data:${type};base64,${base64}`)
    })
  }, [])

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) loadImage(f)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0]
    if (f) loadImage(f)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"))
    if (!item) return
    const f = item.getAsFile()
    if (f) loadImage(f)
  }

  const handleAnalyze = async () => {
    if (!image) return
    setLoading(true)
    setError("")
    setResult("")
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt:   USER_PROMPT,
          imageBase64:  image,
          imageType:    imgType,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan pada server")
      setResult(data.text)
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan. Coba lagi.")
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    setImage(null)
    setImgPreview(null)
    setResult("")
    setError("")
  }

  return (
    <div className="animate-fade">
      <MotivationBanner page="userflow" />

      <div style={{ marginBottom: 20 }} />

      <div className="uf-grid" style={{ display: "grid", gridTemplateColumns: image ? "1fr 1fr" : "1fr", gap: 20 }}>

        {/* Upload Area */}
        <div>
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onPaste={handlePaste}
            tabIndex={0}
            onClick={() => !image && fileRef.current?.click()}
            style={{
              border: `2px dashed ${image ? "var(--accent)" : "var(--border2)"}`,
              borderRadius: "var(--radius-lg)",
              background: image ? "var(--accent-muted)" : "var(--surface)",
              minHeight: 280,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              cursor: image ? "default" : "pointer",
              transition: "all 0.2s",
              position: "relative",
              overflow: "hidden",
              outline: "none",
            }}
            onMouseEnter={e => { if (!image) (e.currentTarget as HTMLElement).style.borderColor = "var(--accent2)" }}
            onMouseLeave={e => { if (!image) (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)" }}
          >
            {image && imgPreview ? (
              <>
                <img
                  src={imgPreview}
                  alt="Flowchart"
                  style={{ width: "100%", height: 280, objectFit: "contain", padding: 12 }}
                />
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); setPreviewOpen(true) }}
                    style={{ background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 7, padding: "5px 10px", color: "white", cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <ImageIcon size={12} /> Lihat
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleClear() }}
                    style={{ background: "rgba(192,57,43,0.8)", border: "none", borderRadius: 7, padding: "5px 10px", color: "white", cursor: "pointer", fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                    <Trash2 size={12} /> Hapus
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ width: 56, height: 56, borderRadius: "var(--radius)", background: "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ImageIcon size={26} color="var(--text3)" />
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Drop gambar di sini</div>
                  <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 4 }}>atau klik untuk upload</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "6px 12px", fontSize: 11, color: "var(--text2)", display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                    <Upload size={12} /> Upload file
                  </div>
                  <div style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "6px 12px", fontSize: 11, color: "var(--text2)", display: "flex", alignItems: "center", gap: 5, fontWeight: 600 }}>
                    <ClipboardPaste size={12} /> Ctrl+V paste
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text3)" }}>PNG · JPG · WebP · GIF</div>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />

          <button
            className="btn btn-primary"
            onClick={handleAnalyze}
            disabled={!image || loading}
            style={{ width: "100%", marginTop: 14, justifyContent: "center", opacity: !image ? 0.5 : 1, padding: "12px" }}
          >
            {loading
              ? <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Menganalisis...</>
              : <><Sparkles size={16} /> Analisis Flowchart</>
            }
          </button>

          {error && (
            <div style={{ marginTop: 10, background: "var(--danger-bg)", border: "1px solid #f8d4d4", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: 12, color: "var(--danger)" }}>
              ⚠️ {error}
            </div>
          )}
        </div>

        {/* Result */}
        {image && (
          <div className="card" style={{ padding: 20, minHeight: 280, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Sparkles size={14} color="var(--accent)" />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Narasi Flowchart</span>
              </div>
              {result && (
                <button onClick={handleCopy} className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12 }}>
                  {copied ? <><Check size={13} /> Tersalin!</> : <><Copy size={13} /> Copy</>}
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "var(--text3)" }}>
                <RefreshCw size={28} style={{ animation: "spin 1s linear infinite", color: "var(--accent)" }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>AI sedang membaca flowchart...</div>
                <div style={{ fontSize: 11 }}>Biasanya 5–10 detik</div>
              </div>
            ) : result ? (
              <div style={{ flex: 1, fontSize: 14, lineHeight: 1.8, color: "var(--text)", whiteSpace: "pre-wrap" }}>
                {result}
              </div>
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--text3)" }}>
                <Sparkles size={28} color="var(--border2)" />
                <div style={{ fontSize: 13 }}>Klik <strong style={{ color: "var(--text2)" }}>Analisis Flowchart</strong> untuk mulai</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewOpen && imgPreview && (
        <ModalOverlay onClose={() => setPreviewOpen(false)}>
          <div style={{ background: "var(--surface)", borderRadius: "var(--radius-lg)", padding: 8 }}>
            <img src={imgPreview} alt="Preview" style={{ maxWidth: "80vw", maxHeight: "80vh", display: "block", borderRadius: "var(--radius)" }} />
          </div>
        </ModalOverlay>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 768px) {
          .uf-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}