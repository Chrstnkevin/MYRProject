"use client"
import { useState, useCallback } from "react"
import PasswordGate from "../PasswordGate"
import LandingNav from "../components/LandingNav"

const C = { primary: "#E8381A", dark: "#111111", gray: "#6B7280", grayLight: "#F4F4F2", border: "rgba(0,0,0,0.08)", green: "#2d6a4f", red: "#DC2626" }

export default function SkuNewPage() {
  const [file, setFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<{ totalRows: number; changedRows: number; fname: string } | null>(null)

  const process = useCallback(async () => {
    if (!file) return
    setError(""); setResult(null); setProcessing(true)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch("/api/sku-new/generate", { method: "POST", body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Gagal memproses file")
      }
      const totalRows = Number(res.headers.get("X-Total-Rows") || "0")
      const changedRows = Number(res.headers.get("X-Changed-Rows") || "0")
      const disposition = res.headers.get("Content-Disposition") || ""
      const fname = disposition.match(/filename="(.+)"/)?.[1] || "SKU_NEW.xlsx"

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = fname
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setResult({ totalRows, changedRows, fname })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memproses file")
    } finally {
      setProcessing(false)
    }
  }, [file])

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }
  const cardStyle: React.CSSProperties = { background: "white", borderRadius: 18, padding: 24, border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(0,0,0,.04)" }

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: C.dark, background: C.grayLight, minHeight: "100vh" }}>
      <PasswordGate />
      <LandingNav />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "clamp(96px,12vw,120px) clamp(16px,4vw,24px) 60px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "inline-block", background: `${C.primary}12`, borderRadius: 99, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Tools</div>
          <h1 style={{ fontSize: "clamp(24px,3vw,32px)", fontWeight: 800, marginBottom: 8 }}>SKU NEW — Koreksi Stock</h1>
          <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.6 }}>Upload file &quot;Form Request File Set&quot; (harus punya sheet <strong>AS IS</strong>) — sistem otomatis copy semua baris ke sheet baru <strong>SKU NEW</strong>, samakan STOCK2 dengan STOCK, dan highlight sel yang berubah. Sheet asli tidak diubah, tanpa disimpan ke database.</p>
        </div>

        {error && <div style={{ background: "#FEF2F2", border: `1px solid ${C.red}30`, color: C.red, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, fontWeight: 600, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{error}</div>}

        <div style={cardStyle}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, display: "block" }}>File Excel (.xlsx)</label>
          <input type="file" accept=".xlsx" onChange={e => { setFile(e.target.files?.[0] || null); setResult(null); setError("") }} style={inputStyle} />

          <button onClick={process} disabled={!file || processing}
            style={{ marginTop: 16, width: "100%", background: C.green, color: "white", border: "none", borderRadius: 12, padding: "16px", fontSize: 15, fontWeight: 800, cursor: file && !processing ? "pointer" : "not-allowed", opacity: file && !processing ? 1 : 0.5, boxShadow: "0 8px 24px rgba(45,106,79,.3)" }}>
            {processing ? "Memproses..." : "Proses & Download"}
          </button>

          {result && (
            <div style={{ marginTop: 16, background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#166534", marginBottom: 4 }}>✅ {result.fname} sudah didownload</div>
              <div style={{ fontSize: 12, color: "#166534" }}>{result.totalRows} baris disalin ke sheet SKU NEW · {result.changedRows} baris STOCK2-nya dikoreksi &amp; di-highlight</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
