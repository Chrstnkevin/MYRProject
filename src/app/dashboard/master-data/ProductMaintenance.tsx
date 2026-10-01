"use client"
// PATH: src/app/dashboard/master-data/ProductMaintenance.tsx
//
// Tab "Maintenance Produk" di halaman Master Data — katalog SKU (reguler
// & promo) dari file pricelist Ficom "GENERAL_PRICE_PER_SKU ..." (sheet
// "ALL SKU" + "PROMO SKU"). Komponen ini SELF-CONTAINED (state & fetch
// sendiri, tidak nerima props dari page.tsx) soalnya datanya independen
// dari tabel master_data_adp yang dipakai tab lain.

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Package, Tag, CheckCircle2, XCircle, Upload, Search, RefreshCw,
  AlertCircle, ToggleLeft, ToggleRight,
} from "lucide-react"
import { supabase } from "@/lib/supabase"

interface SkuRow {
  id: string
  sku_code: string
  sku_description: string | null
  is_promo: boolean
  price_large: number | null
  price_medium: number | null
  price_small: number | null
  is_active: boolean
  updated_at: string
}

function fmtPrice(n: number | null): string {
  return n == null ? "-" : n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Cari baris header "SKU CODE" di kolom B (index 1 di array-of-array dari
// XLSX {header:1}) — posisi barisnya beda2 tiap sheet (ALL SKU vs PROMO
// SKU), jadi dicari otomatis daripada hardcode nomor baris.
// ALL SKU punya 1 baris sub-header tambahan (LARGE/MEDIUM/SMALL) sebelum
// baris data, PROMO SKU nggak — dideteksi otomatis: kalau baris setelah
// header kolom D-nya (index 3) teks bukan angka, berarti itu sub-header,
// dilewat. Kolom SKU CODE/DESCRIPTION/LARGE/MEDIUM/SMALL (B,C,D,E,F)
// posisinya SAMA di kedua sheet, cuma ALL SKU punya kolom tambahan
// setelahnya (jack-up price dll) yang sengaja tidak dipakai di sini,
// sesuai yang diminta user (cuma SKU/Deskripsi/List Price).
function parseSkuSheet(aoa: unknown[][]): { code: string; desc: string; large: number | null; medium: number | null; small: number | null }[] {
  let headerIdx = -1
  for (let i = 0; i < aoa.length; i++) {
    const cell = aoa[i]?.[1]
    if (typeof cell === "string" && cell.trim().toUpperCase() === "SKU CODE") { headerIdx = i; break }
  }
  if (headerIdx === -1) return []

  let dataStart = headerIdx + 1
  if (typeof aoa[dataStart]?.[3] === "string") dataStart += 1

  const numOrNull = (v: unknown): number | null => {
    if (v == null || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }

  const out: { code: string; desc: string; large: number | null; medium: number | null; small: number | null }[] = []
  for (let i = dataStart; i < aoa.length; i++) {
    const row = aoa[i]
    const codeRaw = row?.[1]
    if (codeRaw == null || codeRaw === "" || isNaN(Number(codeRaw))) continue
    out.push({
      code: String(Number(codeRaw)),
      desc: String(row[2] ?? "").trim(),
      large: numOrNull(row[3]),
      medium: numOrNull(row[4]),
      small: numOrNull(row[5]),
    })
  }
  return out
}

export default function ProductMaintenance() {
  const [rows, setRows] = useState<SkuRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [importing, setImporting] = useState(false)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PRODUCT" | "PROMO">("ALL")
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL")
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase.from("master_data_sku").select("*").order("sku_code", { ascending: true })
    if (err) setError(err.message)
    else setRows((data || []) as SkuRow[])
    setLoading(false)
  }

  async function importExcel(file: File) {
    setImporting(true); setError(""); setSuccess("")
    try {
      const XLSX = await import("xlsx")
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf, { type: "array" })

      const allSkuSheetName = wb.SheetNames.find(n => n.trim().toUpperCase() === "ALL SKU")
      const promoSkuSheetName = wb.SheetNames.find(n => n.trim().toUpperCase() === "PROMO SKU")
      if (!allSkuSheetName && !promoSkuSheetName) {
        throw new Error('File ini tidak punya sheet "ALL SKU" atau "PROMO SKU" — pastikan upload file pricelist yang benar')
      }

      const toUpsert: { sku_code: string; sku_description: string; is_promo: boolean; price_large: number | null; price_medium: number | null; price_small: number | null; updated_at: string }[] = []
      const now = new Date().toISOString()

      if (allSkuSheetName) {
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[allSkuSheetName], { header: 1 })
        for (const r of parseSkuSheet(aoa)) {
          toUpsert.push({ sku_code: r.code, sku_description: r.desc, is_promo: false, price_large: r.large, price_medium: r.medium, price_small: r.small, updated_at: now })
        }
      }
      if (promoSkuSheetName) {
        const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[promoSkuSheetName], { header: 1 })
        for (const r of parseSkuSheet(aoa)) {
          toUpsert.push({ sku_code: r.code, sku_description: r.desc, is_promo: true, price_large: r.large, price_medium: r.medium, price_small: r.small, updated_at: now })
        }
      }
      if (toUpsert.length === 0) throw new Error("Tidak ada baris SKU valid ditemukan di sheet ALL SKU / PROMO SKU")

      // is_active SENGAJA tidak di-include di sini — biar re-import harga
      // nggak nge-reset toggle Active/Inactive yang sudah di-set manual
      // (lihat catatan di migration 20261001_master_data_sku.sql).
      const { error: upErr } = await supabase.from("master_data_sku").upsert(toUpsert, { onConflict: "sku_code,is_promo" })
      if (upErr) throw upErr

      setSuccess(`✅ ${toUpsert.length} SKU berhasil di-import/update`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setImporting(false)
  }

  async function toggleActive(row: SkuRow) {
    const next = !row.is_active
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: next } : r))
    const { error: err } = await supabase.from("master_data_sku").update({ is_active: next }).eq("id", row.id)
    if (err) {
      setError(err.message)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: row.is_active } : r))
    }
  }

  const stats = useMemo(() => ({
    total: rows.length,
    product: rows.filter(r => !r.is_promo).length,
    promo: rows.filter(r => r.is_promo).length,
    active: rows.filter(r => r.is_active).length,
    inactive: rows.filter(r => !r.is_active).length,
  }), [rows])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (q && !r.sku_code.toLowerCase().includes(q) && !(r.sku_description || "").toLowerCase().includes(q)) return false
      if (typeFilter === "PRODUCT" && r.is_promo) return false
      if (typeFilter === "PROMO" && !r.is_promo) return false
      if (statusFilter === "ACTIVE" && !r.is_active) return false
      if (statusFilter === "INACTIVE" && r.is_active) return false
      return true
    })
  }, [rows, search, typeFilter, statusFilter])

  return (
    <div>
      {/* Header + Import */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "16px", fontWeight: 800, color: "var(--text)", margin: 0 }}>Maintenance Produk</h2>
          <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>Katalog SKU reguler & promo, dari file pricelist Ficom (sheet &quot;ALL SKU&quot; + &quot;PROMO SKU&quot;)</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={load} disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text3)", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) { importExcel(f); e.target.value = "" } }} />
          <button onClick={() => fileRef.current?.click()} disabled={importing}
            title='Upload file pricelist Ficom (harus ada sheet "ALL SKU" dan/atau "PROMO SKU")'
            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 14px", borderRadius: "9px", border: "1px solid #166534", background: "#166534", color: "white", fontSize: "12px", fontWeight: 700, cursor: importing ? "not-allowed" : "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: importing ? 0.6 : 1 }}>
            <Upload size={13} /> {importing ? "Mengimpor..." : "Import Pricelist Excel"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: "10px", padding: "12px 16px", marginBottom: "14px", color: "#991B1B", fontSize: "13px" }}>
          <AlertCircle size={15} />{error}
        </div>
      )}
      {success && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: "10px", padding: "12px 16px", marginBottom: "14px", color: "#166534", fontSize: "13px" }}>
          <CheckCircle2 size={15} />{success}
        </div>
      )}

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        {([
          ["Total SKU",     stats.total,    "#0369A1", Package],
          ["Produk Reguler",stats.product,  "#7C3AED", Package],
          ["Promo SKU",     stats.promo,    "#92400E", Tag],
          ["Active",        stats.active,   "#166534", CheckCircle2],
          ["Inactive",      stats.inactive, "#991B1B", XCircle],
        ] as const).map(([label, value, color, Icon]) => (
          <div key={label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 600 }}>{label}</span>
              <Icon size={15} color={color} />
            </div>
            <div style={{ fontSize: "24px", fontWeight: 800, color, letterSpacing: "-0.02em" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari SKU code / deskripsi..."
            style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "'Plus Jakarta Sans', sans-serif", boxSizing: "border-box" }} />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
          style={{ padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <option value="ALL">Semua Tipe</option>
          <option value="PRODUCT">Produk Reguler</option>
          <option value="PROMO">Promo SKU</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{ padding: "9px 12px", borderRadius: "9px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: "12px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          <option value="ALL">Semua Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <span style={{ alignSelf: "center", fontSize: "11px", color: "var(--text3)" }}>{filtered.length}/{rows.length} SKU</span>
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", overflow: "hidden" }}>
        {loading && rows.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
            {rows.length === 0 ? 'Belum ada SKU — klik "Import Pricelist Excel" buat narik data pertama kali' : "Tidak ada SKU yang cocok dengan filter"}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
                  <th style={{ padding: "10px 14px" }}>SKU Code</th>
                  <th style={{ padding: "10px 14px" }}>SKU Description</th>
                  <th style={{ padding: "10px 14px" }}>Tipe</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>List Price — Large</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Medium</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>Small</th>
                  <th style={{ padding: "10px 14px" }}>Status</th>
                  <th style={{ padding: "10px 14px" }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)", opacity: r.is_active ? 1 : 0.55 }}>
                    <td style={{ padding: "9px 14px", fontWeight: 700, color: "var(--text)", fontFamily: "monospace" }}>{r.sku_code}</td>
                    <td style={{ padding: "9px 14px", color: "var(--text)" }}>{r.sku_description || "-"}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: r.is_promo ? "#FEF3C7" : "#EDE9FE", color: r.is_promo ? "#92400E" : "#7C3AED" }}>
                        {r.is_promo ? "PROMO" : "PRODUK"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px", textAlign: "right", color: "var(--text2)" }}>{fmtPrice(r.price_large)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", color: "var(--text2)" }}>{fmtPrice(r.price_medium)}</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", color: "var(--text2)" }}>{fmtPrice(r.price_small)}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontWeight: 700, background: r.is_active ? "#DCFCE7" : "#FEE2E2", color: r.is_active ? "#166534" : "#991B1B" }}>
                        {r.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: "9px 14px" }}>
                      <button onClick={() => toggleActive(r)}
                        title={r.is_active ? "Nonaktifkan SKU ini" : "Aktifkan SKU ini"}
                        style={{ display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface)", color: r.is_active ? "#991B1B" : "#166534", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {r.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        {r.is_active ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
