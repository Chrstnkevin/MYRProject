"use client"
import { useState, useCallback } from "react"
import PasswordGate from "../PasswordGate"
import LandingNav from "../components/LandingNav"
import { parseMainTxt, parseTambahanTxt, parseVanTxt, scanMinusMain, scanMinusTambahan, scanMinusKanvas, type ClassifiedRow as Row, type GudangType } from "@/lib/reqFileSetCore"

const C = { primary: "#E8381A", dark: "#111111", gray: "#6B7280", grayLight: "#F4F4F2", border: "rgba(0,0,0,0.08)", green: "#2d6a4f", red: "#DC2626" }

const TYPE_LABEL: Record<GudangType, string> = { MAIN: "WH MAIN", TAMBAHAN: "WH TAMBAHAN", KANVAS: "WH KANVAS", UNKNOWN: "? Tidak dikenali" }
const TYPE_COLOR: Record<GudangType, string> = { MAIN: "#1E88E5", TAMBAHAN: "#FB8C00", KANVAS: "#8B5CF6", UNKNOWN: "#DC2626" }

const DEFAULT_KETERANGAN = `Negative Stocks
  - Negative stocks upon EOD Report

Tolong buat update tipe 1 menjadi tipe 2 karena kepentok stock minus. Samakan stock yang ada di tipe 2 menjadi sama dengan tipe 1. buat dalam NON VM`

function todayIso() { return new Date().toISOString().slice(0, 10) }

export default function ReqFilesetPage() {
  const [mainFile, setMainFile] = useState<File | null>(null)
  const [tambahanFile, setTambahanFile] = useState<File | null>(null)
  const [vanFile, setVanFile] = useState<File | null>(null)

  const [tanggalRequest, setTanggalRequest] = useState(todayIso())
  const [picRequest, setPicRequest] = useState("")
  const [kodeSubdist, setKodeSubdist] = useState("")
  const [tanggalGudang, setTanggalGudang] = useState(todayIso())
  const [keterangan, setKeterangan] = useState(DEFAULT_KETERANGAN)

  const [rows, setRows] = useState<Row[]>([])
  const [scanning, setScanning] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [scanned, setScanned] = useState(false)

  const scan = useCallback(async () => {
    if (!mainFile || !tambahanFile || !vanFile) { setError("Upload ketiga file txt dulu (Main, Tambahan, Van)"); return }
    setError(""); setScanning(true)
    try {
      const [mainTxt, tambahanTxt, vanTxt] = await Promise.all([mainFile.text(), tambahanFile.text(), vanFile.text()])
      const mainRows = scanMinusMain(parseMainTxt(mainTxt))
      const tambahanRows = scanMinusTambahan(parseTambahanTxt(tambahanTxt))
      const kanvasRows = scanMinusKanvas(parseVanTxt(vanTxt))
      setRows([...mainRows, ...tambahanRows, ...kanvasRows])
      setScanned(true)
    } catch {
      setError("Gagal scan file txt — pastikan format & header kolomnya sesuai (PCODE|TIPE|BEGDATE|STOCK|...)")
    } finally {
      setScanning(false)
    }
  }, [mainFile, tambahanFile, vanFile])

  const updateRow = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const removeRow = (i: number) => setRows(rs => rs.filter((_, idx) => idx !== i))
  const addRow = () => setRows(rs => [...rs, { gudang: "", pcode: "", minus: 0, type: "MAIN" }])

  const generate = useCallback(async () => {
    if (!mainFile || !tambahanFile || !vanFile) { setError("Upload ketiga file txt dulu (Main, Tambahan, Van)"); return }
    if (!rows.length) { setError("Belum ada baris stock minus untuk diproses — klik \"Scan Stock Minus\" dulu"); return }
    setError(""); setGenerating(true)
    try {
      const [mainTxt, tambahanTxt, vanTxt] = await Promise.all([mainFile.text(), tambahanFile.text(), vanFile.text()])
      const res = await fetch("/api/req-fileset/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          header: { tanggalRequest, picRequest, kodeSubdist, tanggalGudang, keterangan },
          rows, mainTxt, tambahanTxt, vanTxt,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Gagal generate Excel")
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Form_Request_Fileset_${kodeSubdist || "ADP"}_${tanggalGudang.replaceAll("-", "")}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal generate Excel")
    } finally {
      setGenerating(false)
    }
  }, [mainFile, tambahanFile, vanFile, rows, tanggalRequest, picRequest, kodeSubdist, tanggalGudang, keterangan])

  const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", boxSizing: "border-box" }
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" }
  const cardStyle: React.CSSProperties = { background: "white", borderRadius: 18, padding: 24, border: `1px solid ${C.border}`, boxShadow: "0 2px 12px rgba(0,0,0,.04)" }

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", color: C.dark, background: C.grayLight, minHeight: "100vh" }}>
      <PasswordGate />
      <LandingNav />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "clamp(96px,12vw,120px) clamp(16px,4vw,24px) 60px" }}>
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "inline-block", background: `${C.primary}12`, borderRadius: 99, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: C.primary, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Tools</div>
          <h1 style={{ fontSize: "clamp(24px,3vw,32px)", fontWeight: 800, marginBottom: 8 }}>Form Request File Set (FS)</h1>
          <p style={{ color: C.gray, fontSize: 14, lineHeight: 1.6 }}>Upload 3 file txt EDI Stock Begin (Main, Tambahan, Van) — otomatis di-scan cari semua PCODE yang STOCK tipe 2-nya lebih kecil dari tipe 1 (stock minus), lalu langsung diolah jadi 1 file Excel Form Request Fileset. Tanpa AI, tanpa disimpan ke database.</p>
        </div>

        {error && <div style={{ background: "#FEF2F2", border: `1px solid ${C.red}30`, color: C.red, borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, fontWeight: 600, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{error}</div>}

        {/* Header form */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>1. Data Request</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Tanggal Request</label>
              <input type="date" value={tanggalRequest} onChange={e => setTanggalRequest(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>PIC Request</label>
              <input value={picRequest} onChange={e => setPicRequest(e.target.value)} placeholder="mis. JKT" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Kode Subdist (ADP)</label>
              <input value={kodeSubdist} onChange={e => setKodeSubdist(e.target.value)} placeholder="mis. 200015" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Tanggal Gudang (WH Date)</label>
              <input type="date" value={tanggalGudang} onChange={e => setTanggalGudang(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Keterangan</label>
            <textarea value={keterangan} onChange={e => setKeterangan(e.target.value)} rows={5} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </div>
        </div>

        {/* Txt uploads + scan */}
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>2. File EDI Stock Begin (.txt)</div>
          <p style={{ color: C.gray, fontSize: 13, marginBottom: 14 }}>Upload ketiga file, lalu klik &quot;Scan Stock Minus&quot; — sistem cari otomatis semua PCODE(+lokasi) yang STOCK tipe 2 &lt; tipe 1 di tanggal yang sama.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16, marginBottom: 16 }}>
            <div>
              <label style={labelStyle}>Main (WH MAIN)</label>
              <input type="file" accept=".txt" onChange={e => { setMainFile(e.target.files?.[0] || null); setScanned(false) }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Gd Tambahan (WH TAMBAHAN)</label>
              <input type="file" accept=".txt" onChange={e => { setTambahanFile(e.target.files?.[0] || null); setScanned(false) }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Van (WH KANVAS)</label>
              <input type="file" accept=".txt" onChange={e => { setVanFile(e.target.files?.[0] || null); setScanned(false) }} style={inputStyle} />
            </div>
          </div>
          <button onClick={scan} disabled={!mainFile || !tambahanFile || !vanFile || scanning}
            style={{ background: C.primary, color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 14, fontWeight: 700, cursor: mainFile && tambahanFile && vanFile && !scanning ? "pointer" : "not-allowed", opacity: mainFile && tambahanFile && vanFile && !scanning ? 1 : 0.5 }}>
            {scanning ? "Scanning..." : "Scan Stock Minus"}
          </button>

          {scanned && (
            <div style={{ marginTop: 20, overflowX: "auto" }}>
              <p style={{ fontSize: 13, color: C.gray, marginBottom: 10 }}>Ditemukan <strong>{rows.length}</strong> baris stock minus. Cek/koreksi manual kalau perlu sebelum generate.</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Gudang</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>PCODE</th>
                    <th style={{ textAlign: "right", padding: "6px 8px" }}>Minus</th>
                    <th style={{ textAlign: "left", padding: "6px 8px" }}>Tab Tujuan</th>
                    <th style={{ padding: "6px 8px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: "4px 8px" }}><input value={r.gudang} onChange={e => updateRow(i, { gudang: e.target.value })} style={{ ...inputStyle, padding: "6px 8px" }} /></td>
                      <td style={{ padding: "4px 8px" }}><input value={r.pcode} onChange={e => updateRow(i, { pcode: e.target.value })} style={{ ...inputStyle, padding: "6px 8px" }} /></td>
                      <td style={{ padding: "4px 8px" }}><input type="number" value={r.minus} onChange={e => updateRow(i, { minus: Number(e.target.value) })} style={{ ...inputStyle, padding: "6px 8px", textAlign: "right" }} /></td>
                      <td style={{ padding: "4px 8px" }}>
                        <select value={r.type} onChange={e => updateRow(i, { type: e.target.value as GudangType })}
                          style={{ ...inputStyle, padding: "6px 8px", color: TYPE_COLOR[r.type], fontWeight: 700 }}>
                          {(["MAIN", "TAMBAHAN", "KANVAS", "UNKNOWN"] as GudangType[]).map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "4px 8px" }}>
                        <button onClick={() => removeRow(i)} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16 }} title="Hapus baris">✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addRow} style={{ marginTop: 10, background: "none", border: `1.5px dashed ${C.border}`, borderRadius: 10, padding: "8px 16px", fontSize: 13, fontWeight: 600, color: C.gray, cursor: "pointer" }}>+ Tambah baris manual</button>
            </div>
          )}
        </div>

        {/* Generate */}
        <button onClick={generate} disabled={generating || !rows.length}
          style={{ width: "100%", background: C.green, color: "white", border: "none", borderRadius: 12, padding: "16px", fontSize: 15, fontWeight: 800, cursor: !generating && rows.length ? "pointer" : "not-allowed", opacity: !generating && rows.length ? 1 : 0.5, boxShadow: "0 8px 24px rgba(45,106,79,.3)" }}>
          {generating ? "Menyusun file Excel..." : "Generate & Download Excel"}
        </button>
      </div>
    </div>
  )
}
