"use client"
// PATH: src/app/dashboard/edi/page.tsx
// Hub tarik EDI Ficom Lite — 1 halaman, beberapa tab, tiap tab punya
// tombol "Tarik EDI" sendiri buat EDI yang berbeda. Tab MASA SFA &
// Productivity numpang ke sync route yang SUDAH ADA (dipakai juga oleh
// halaman Data Transfer & Productivity Compare) — di sini cuma nambah
// cara lain buat memicu + preview datanya. Tab Visit & Hirarki SD-Salesman
// pakai sync route BARU (api/ficom-edi-visit-sync, api/ficom-edi-hirarki-sync).
// Tab Salesman SPV & Trace Target Omzet Dashboard masih placeholder —
// belum ada detail query/params EDI-nya dari Ficom.

import { useState, useEffect, useCallback, useMemo } from "react"
import { RefreshCw, Zap, Calendar, Info, Search, X } from "lucide-react"
import { supabase } from "@/lib/supabase"

type TabKey = "masa-sfa" | "productivity" | "visit" | "hirarki" | "salesman-spv" | "trace-target-omzet"

interface TabConfig {
  key: TabKey
  label: string
  ediId: string
  ediNm: string
  desc: string
  ready: boolean
  table?: string
  syncEndpoint?: string
}

const TABS: TabConfig[] = [
  { key: "masa-sfa",           label: "MASA SFA",              ediId: "EDI200001",  ediNm: "EDI OMSET DASHBOARD",         desc: "Sumber data Data Transfer Web Ficom (tgl gudang, HKA/HKE, release). Auto-refresh tiap jam lewat cron, bisa juga ditarik manual di sini.", ready: true, table: "edi_transfer_staging", syncEndpoint: "/api/ficom-edi-sync" },
  { key: "productivity",       label: "Productivity",          ediId: "EDI2600006", ediNm: "EDI FICOM LITE PRODUCTIVITY", desc: "Sumber data Productivity Compare (target vs realisasi per komponen). Auto-refresh tiap jam lewat cron (awal bulan s.d. hari ini), atau tarik manual dengan Date From/To sendiri di sini — termasuk buat tarik ulang bulan lampau.", ready: true, table: "ficom_productivity_staging", syncEndpoint: "/api/ficom-productivity-sync" },
  { key: "visit",               label: "Visit",                 ediId: "EDI2600008", ediNm: "EDI FICOM LITE VISIT",        desc: "Data kunjungan salesman per outlet. Date From/To diketik manual — default disarankan hari ini (maxday).", ready: true, table: "edi_visit_staging", syncEndpoint: "/api/ficom-edi-visit-sync" },
  { key: "hirarki",             label: "Hirarki SD-Salesman",   ediId: "EDI260001",  ediNm: "EDI Hirarki SD - Salesman",   desc: "Snapshot lengkap hierarki SD → NSM → GRSM → RSM → SS → Salesman per distributor. Tidak ada parameter tanggal.", ready: true, table: "edi_hirarki_staging", syncEndpoint: "/api/ficom-edi-hirarki-sync" },
  { key: "salesman-spv",        label: "Salesman SPV",          ediId: "—",          ediNm: "EDI Salesman SPV",            desc: "Belum ada detail EDI ID/query/params dari Ficom — kirim capture Network tab (GET template + POST ekstrak) biar bisa diimplementasikan.", ready: false },
  { key: "trace-target-omzet",  label: "Trace Target Omzet",    ediId: "—",          ediNm: "EDI Trace Target Omzet Dashboard", desc: "Belum ada detail EDI ID/query/params dari Ficom — kirim capture Network tab (GET template + POST ekstrak) biar bisa diimplementasikan.", ready: false },
]

function ficomDateNoPad(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
  return `${d.getDate()} ${month} ${d.getFullYear()}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// Tab yang punya input Date From/To manual — tiap tab punya default beda
// (Visit: hari ini s.d. hari ini/maxday; Productivity: awal bulan s.d.
// hari ini, sama seperti perilaku auto lama), jadi state-nya dipisah per
// tab, bukan 1 dateFrom/dateTo yang dishare.
const DATE_RANGE_TABS: TabKey[] = ["visit", "productivity"]

export default function EdiPage() {
  const [tab, setTab] = useState<TabKey>("masa-sfa")
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState("")
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [search, setSearch] = useState("")
  const [filterCol, setFilterCol] = useState("")
  const [filterVal, setFilterVal] = useState("")

  const today = ficomDateNoPad(new Date())
  const [visitFrom, setVisitFrom] = useState(today)
  const [visitTo, setVisitTo] = useState(today)
  const [prodFrom, setProdFrom] = useState(ficomDateNoPad(startOfMonth(new Date())))
  const [prodTo, setProdTo] = useState(today)

  const active = TABS.find(t => t.key === tab)!
  const [dateFrom, setDateFrom] = tab === "visit" ? [visitFrom, setVisitFrom] : [prodFrom, setProdFrom]
  const [dateTo, setDateTo] = tab === "visit" ? [visitTo, setVisitTo] : [prodTo, setProdTo]

  const loadPreview = useCallback(async (table: string) => {
    setLoadingPreview(true)
    const { data } = await supabase.from(table).select("*").order("fetched_at", { ascending: false }).limit(300)
    setRows((data as Record<string, unknown>[]) || [])
    setLoadingPreview(false)
  }, [])

  useEffect(() => {
    setMsg(""); setSearch(""); setFilterCol(""); setFilterVal("")
    if (active.table) loadPreview(active.table)
    else setRows([])
  }, [tab, active.table, loadPreview])

  const handleSync = async () => {
    if (!active.syncEndpoint) return
    setSyncing(true); setMsg("")
    try {
      const opts: RequestInit = { method: "POST" }
      if (DATE_RANGE_TABS.includes(tab)) {
        opts.headers = { "Content-Type": "application/json" }
        opts.body = JSON.stringify({ dateFrom, dateTo })
      }
      const res = await fetch(active.syncEndpoint, opts)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Sync gagal")
      setMsg(`✅ ${data.rows} baris tersinkron dari Ficom`)
      if (active.table) await loadPreview(active.table)
    } catch (e) {
      setMsg("❌ " + (e instanceof Error ? e.message : String(e)))
    }
    setSyncing(false)
  }

  const columns = useMemo(() => rows.length ? Object.keys(rows[0]).filter(k => k !== "id") : [], [rows])

  // Nilai unik kolom yang lagi dipilih buat filter dropdown "Nilai" —
  // dihitung dari rows yang sudah ditarik (bukan query baru ke Supabase),
  // jadi filter ini murni client-side di atas 300 baris terbaru yang di-preview.
  const filterOptions = useMemo(() => {
    if (!filterCol) return []
    const set = new Set<string>()
    rows.forEach(r => { const v = r[filterCol]; if (v !== null && v !== undefined && v !== "") set.add(String(v)) })
    return Array.from(set).sort()
  }, [rows, filterCol])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (filterCol && filterVal && String(r[filterCol] ?? "") !== filterVal) return false
      if (q && !columns.some(c => String(r[c] ?? "").toLowerCase().includes(q))) return false
      return true
    })
  }, [rows, search, filterCol, filterVal, columns])

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg,#0891B2,#0369A1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Zap size={20} color="white" />
          </div>
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>EDI Ficom</h1>
            <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>Hub tarik data EDI Ficom Lite — pilih tab, klik tarik</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", background: "var(--surface2)", borderRadius: "10px", padding: "4px", border: "1px solid var(--border)" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: "8px 14px", borderRadius: "7px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 700, fontFamily: "inherit",
              background: tab === t.key ? "white" : "transparent",
              color: tab === t.key ? "var(--text)" : "var(--text3)",
              boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
            {t.label}
            {!t.ready && <span style={{ fontSize: "9px", background: "#F59E0B", color: "white", padding: "1px 6px", borderRadius: "99px", fontWeight: 700 }}>Soon</span>}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", fontWeight: 800 }}>{active.ediNm}</span>
              <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--text3)", background: "var(--surface2)", padding: "2px 7px", borderRadius: "6px" }}>{active.ediId}</span>
            </div>
            <p style={{ fontSize: "12px", color: "var(--text3)", margin: "4px 0 0", maxWidth: "560px" }}>{active.desc}</p>
          </div>

          {active.ready && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {DATE_RANGE_TABS.includes(tab) && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px" }}>
                    <Calendar size={12} color="var(--text3)" />
                    <span style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 600 }}>From:</span>
                    <input value={dateFrom} onChange={e => setDateFrom(e.target.value)} placeholder="1 OCT 2025"
                      style={{ border: "none", outline: "none", fontSize: "11px", fontWeight: 700, color: "#0369A1", background: "transparent", fontFamily: "inherit", width: "100px" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "5px 10px" }}>
                    <Calendar size={12} color="var(--text3)" />
                    <span style={{ fontSize: "11px", color: "var(--text3)", fontWeight: 600 }}>To:</span>
                    <input value={dateTo} onChange={e => setDateTo(e.target.value)} placeholder="5 OCT 2025"
                      style={{ border: "none", outline: "none", fontSize: "11px", fontWeight: 700, color: "#0369A1", background: "transparent", fontFamily: "inherit", width: "100px" }} />
                  </div>
                </>
              )}
              <button onClick={handleSync} disabled={syncing}
                style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px", borderRadius: "8px", border: "none", background: syncing ? "#94A3B8" : "#166534", color: "white", fontSize: "12px", fontWeight: 700, cursor: syncing ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                <RefreshCw size={13} style={{ animation: syncing ? "spin 1s linear infinite" : "none" }} />
                {syncing ? "Sync..." : "Tarik EDI"}
              </button>
            </div>
          )}
        </div>

        {!active.ready && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: "#92400E" }}>
            <Info size={14} />
            Belum bisa ditarik — kirim capture Network tab Ficom (GET template EDI + POST ekstrak/brt) buat tab ini biar bisa dibuatkan sync-nya.
          </div>
        )}

        {msg && (
          <div style={{ background: msg.startsWith("✅") ? "#DCFCE7" : "#FEE2E2", border: `1px solid ${msg.startsWith("✅") ? "#BBF7D0" : "#FECACA"}`, borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: msg.startsWith("✅") ? "#166534" : "#991B1B", marginTop: "12px" }}>
            {msg}
          </div>
        )}

        {active.table && (
          <div style={{ marginTop: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", marginBottom: "8px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Preview data terbaru {loadingPreview ? "· memuat..." : `· ${filteredRows.length}/${rows.length} baris`}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: "8px", padding: "6px 10px" }}>
                  <Search size={12} color="var(--text3)" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari di semua kolom..."
                    style={{ border: "none", outline: "none", fontSize: "11px", color: "var(--text)", background: "transparent", fontFamily: "inherit", width: "150px" }} />
                  {search && (
                    <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0, display: "flex" }}><X size={12} /></button>
                  )}
                </div>

                <select value={filterCol} onChange={e => { setFilterCol(e.target.value); setFilterVal("") }}
                  style={{ fontSize: "11px", padding: "6px 8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontFamily: "inherit" }}>
                  <option value="">Filter kolom...</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>

                {filterCol && (
                  <select value={filterVal} onChange={e => setFilterVal(e.target.value)}
                    style={{ fontSize: "11px", padding: "6px 8px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text)", fontFamily: "inherit", maxWidth: "160px" }}>
                    <option value="">Semua nilai</option>
                    {filterOptions.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                )}

                {(search || (filterCol && filterVal)) && (
                  <button onClick={() => { setSearch(""); setFilterCol(""); setFilterVal("") }}
                    style={{ fontSize: "11px", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--border)", background: "var(--surface2)", color: "var(--text3)", cursor: "pointer", fontFamily: "inherit" }}>
                    Reset
                  </button>
                )}
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "auto", maxHeight: "440px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
                <thead>
                  <tr style={{ background: "var(--surface2)" }}>
                    {columns.map(c => (
                      <th key={c} style={{ padding: "8px 10px", fontSize: "10px", fontWeight: 700, color: "var(--text3)", textAlign: "left", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", position: "sticky", top: 0, background: "var(--surface2)" }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr><td colSpan={columns.length || 1} style={{ padding: "30px", textAlign: "center", color: "var(--text3)" }}>
                      {rows.length === 0 ? "Belum ada data — klik “Tarik EDI”" : "Tidak ada baris yang cocok dengan pencarian/filter"}
                    </td></tr>
                  ) : filteredRows.map((r, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                      {columns.map(c => (
                        <td key={c} style={{ padding: "7px 10px", whiteSpace: "nowrap", color: "var(--text2)" }}>{String(r[c] ?? "—")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}