"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { CheckCircle2, Circle, RefreshCw, ChevronLeft, ChevronRight, Save } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Master ADP List (85 ADP)
// ─────────────────────────────────────────────────────────────
const PHI_MASTER = [
  { area: "GMA", server: "138", adp_code: "100018", adp_name: "MAGIS I-RIZAL",                     support: "JC"     },
  { area: "GMA", server: "138", adp_code: "100019", adp_name: "MAGIS II-PASIG",                    support: "JC"     },
  { area: "GMA", server: "138", adp_code: "100020", adp_name: "MAGIS I-QUEZON CITY",               support: "JC"     },
  { area: "GMA", server: "138", adp_code: "100024", adp_name: "ARMATURE-MANILA",                   support: "Lindon" },
  { area: "GMA", server: "138", adp_code: "100025", adp_name: "ARMATURE-VALENZUELA",               support: "Lindon" },
  { area: "NOL", server: "138", adp_code: "200012", adp_name: "BUY PINOY-ILOCOS NORTE",            support: "Van"    },
  { area: "NOL", server: "138", adp_code: "200018", adp_name: "GIALOGO-AURORA",                    support: "Van"    },
  { area: "NOL", server: "138", adp_code: "200020", adp_name: "TRES MARIAS-LA UNION",              support: "Van"    },
  { area: "NOL", server: "138", adp_code: "200025", adp_name: "TPCI-BATAAN",                       support: "Van"    },
  { area: "NOL", server: "138", adp_code: "200029", adp_name: "DRDI-NUEVA ECIJA",                  support: "Van"    },
  { area: "NOL", server: "138", adp_code: "200030", adp_name: "MEN2-PANGASINAN",                   support: "Van"    },
  { area: "SOL", server: "138", adp_code: "300005", adp_name: "SPARK-UPPER LAGUNA",                support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300013", adp_name: "ACC-CATANDUANES",                   support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300015", adp_name: "SOLIDCORE-MASBATE",                 support: "Lindon" },
  { area: "GMA", server: "138", adp_code: "300016", adp_name: "TOP PERFORMANCE-PALAWAN",           support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300018", adp_name: "KIMLEDA-OCCIDENTAL MINDORO",        support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300020", adp_name: "CASCALLA-ROMBLON",                  support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300021", adp_name: "PEARL GAB-MARINDUQUE",              support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300022", adp_name: "SPARK-LOWER LAGUNA",                support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300023", adp_name: "TOP PERFORMANCE-ORIENTAL MINDORO",  support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300025", adp_name: "CHASE-SORSOGON",                    support: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300027", adp_name: "AIMRAM-EASTERN QUEZON",             support: "Lindon" },
  { area: "VIS", server: "138", adp_code: "400016", adp_name: "BERTAHAN-CALBAYOG",                 support: "Darren" },
  { area: "VIS", server: "138", adp_code: "400017", adp_name: "BERTAHAN-BORONGAN",                 support: "Darren" },
  { area: "VIS", server: "138", adp_code: "400018", adp_name: "BERTAHAN-TACLOBAN",                 support: "Darren" },
  { area: "VIS", server: "138", adp_code: "400019", adp_name: "TRIPLE FIVE-ILOILO",                support: "Darren" },
  { area: "VIS", server: "138", adp_code: "400025", adp_name: "APEX FOODS-SAN FERNANDO",           support: "Darren" },
  { area: "VIS", server: "138", adp_code: "400027", adp_name: "TRIPLE FIVE-SAN JOSE",              support: "Darren" },
  { area: "MIN", server: "138", adp_code: "500017", adp_name: "NS DISTRIBUTION-TANDAG",            support: "JC"     },
  { area: "NOL", server: "228", adp_code: "200003", adp_name: "TPCI-PAMPANGA",                     support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200005", adp_name: "TPCI-ZAMBALES",                     support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200006", adp_name: "TPCI-BULACAN",                      support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200007", adp_name: "PRONTO-CENTRAL PANGASINAN",         support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200008", adp_name: "NL AZAP-CAR",                       support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200009", adp_name: "NCT-ABRA",                          support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200011", adp_name: "JEZREEL-WEST PANGASINAN",           support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200013", adp_name: "BUY PINOY-ILOCOS SUR",             support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200014", adp_name: "SOARINGHIGH-LAL-LO",               support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200015", adp_name: "STARCHIME-ISABELA",                 support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200027", adp_name: "COMLAI-NUEVA VIZCAYA",              support: "Van"    },
  { area: "NOL", server: "228", adp_code: "200028", adp_name: "DRDI-TARLAC",                       support: "Van"    },
  { area: "SOL", server: "228", adp_code: "300007", adp_name: "STANCE-CAMSUR",                     support: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300008", adp_name: "STANCE-CAMNORTE",                   support: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300010", adp_name: "MSA-EAST BATANGAS",                 support: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300011", adp_name: "CHASE-ALBAY",                       support: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300012", adp_name: "MSA-UPPER QUEZON",                  support: "Lindon" },
  { area: "VIS", server: "228", adp_code: "400010", adp_name: "APEX FOODS-BOGO",                   support: "Darren" },
  { area: "VIS", server: "228", adp_code: "400014", adp_name: "BERTAHAN-SOGOD",                    support: "Darren" },
  { area: "VIS", server: "228", adp_code: "400015", adp_name: "BERTAHAN-ORMOC",                    support: "Darren" },
  { area: "VIS", server: "228", adp_code: "400021", adp_name: "XCEED GLOBAL-KALIBO",               support: "Darren" },
  { area: "VIS", server: "228", adp_code: "400023", adp_name: "TRIPLE FIVE-GUIMARAS",              support: "Darren" },
  { area: "VIS", server: "228", adp_code: "400026", adp_name: "XCEED GLOBAL-ESTANCIA",             support: "Darren" },
  { area: "MIN", server: "228", adp_code: "500010", adp_name: "CIMEM-TAGUM",                       support: "JC"     },
  { area: "MIN", server: "228", adp_code: "500011", adp_name: "DAVAO REACH-KIDAPAWAN",             support: "JC"     },
  { area: "MIN", server: "228", adp_code: "500013", adp_name: "GDMC-ZAMBOANGA",                    support: "JC"     },
  { area: "MIN", server: "228", adp_code: "500014", adp_name: "888 SOCSARGEN-DIGOS",               support: "JC"     },
  { area: "MIN", server: "228", adp_code: "500015", adp_name: "GDMC-IPIL",                         support: "JC"     },
  { area: "MIN", server: "228", adp_code: "500028", adp_name: "KGD-OZAMIS",                        support: "JC"     },
  { area: "MIN", server: "228", adp_code: "500030", adp_name: "EIGHTCHAMS-SAN FRANCISCO",          support: "JC"     },
  { area: "GMA", server: "252", adp_code: "100021", adp_name: "MAGIS II-PARANAQUE",                support: "JC"     },
  { area: "NOL", server: "252", adp_code: "200024", adp_name: "COMLAI-TUGUEGARAO",                 support: "Van"    },
  { area: "SOL", server: "252", adp_code: "300001", adp_name: "MSA-LOWER CAVITE",                  support: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300002", adp_name: "TOPTRADER-UPPER CAVITE",            support: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300006", adp_name: "CONSUMERPLUS-WEST BATANGAS",        support: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300009", adp_name: "PAKYAHDA-LOWER QUEZON",             support: "Lindon" },
  { area: "VIS", server: "252", adp_code: "400001", adp_name: "APEX FOODS-CEBU",                   support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400002", adp_name: "CGM-BACOLOD",                       support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400003", adp_name: "BROLLEE-CEBU",                      support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400005", adp_name: "SEMIGI-DUMAGUETE",                  support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400006", adp_name: "CGM-CADIZ",                         support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400007", adp_name: "CGM-KABANKALAN",                    support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400020", adp_name: "XCEED GLOBAL-ROXAS",                support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400024", adp_name: "XCEED GLOBAL-BORACAY",              support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400028", adp_name: "NETMAN-TAGBILARAN",                 support: "Darren" },
  { area: "VIS", server: "252", adp_code: "400029", adp_name: "NETMAN-UBAY",                       support: "Darren" },
  { area: "MIN", server: "252", adp_code: "500007", adp_name: "CIMEM-MATI",                        support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500008", adp_name: "DAVAO REACH-GENSAN",                support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500009", adp_name: "SOUTHMIN-DAVAO",                    support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500020", adp_name: "JOSCHAM-CDO",                       support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500021", adp_name: "JOSCHAM-ILIGAN",                    support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500022", adp_name: "EIGHTCHAMS-SURIGAO",                support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500023", adp_name: "EIGHTCHAMS-BUTUAN",                 support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500024", adp_name: "EIGHTCHAMS-BUKIDNON",               support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500025", adp_name: "JOSCHAM-PAGADIAN",                  support: "JC"     },
  { area: "MIN", server: "252", adp_code: "500027", adp_name: "KGD-DIPOLOG",                       support: "JC"     },
] as const

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
function getISOWeek(d: Date) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7))
  const y0 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1))
  return Math.ceil(((dt.getTime() - y0.getTime()) / 86400000 + 1) / 7)
}
function getWeeksInYear(year: number) {
  const dec28 = new Date(year, 11, 28)
  return getISOWeek(dec28)
}

const AREA_COLOR: Record<string, { bg: string; text: string }> = {
  GMA: { bg: "#ede9fe", text: "#6d28d9" },
  NOL: { bg: "#dbeafe", text: "#1d4ed8" },
  SOL: { bg: "#d1fae5", text: "#065f46" },
  VIS: { bg: "#fef3c7", text: "#92400e" },
  MIN: { bg: "#fee2e2", text: "#991b1b" },
}

type BackupRecord = { adp_code: string; week: number; year: number; done: boolean }

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function BackupPhiPage() {
  const now       = new Date()
  const curYear   = now.getFullYear()
  const curWeek   = getISOWeek(now)

  const [year, setYear]       = useState(curYear)
  const [week, setWeek]       = useState(curWeek)
  const [records, setRecords] = useState<BackupRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState<Record<string, boolean>>({})
  const [saved,  setSaved]    = useState<Record<string, boolean>>({})
  const [filterArea, setFilterArea] = useState("ALL")
  const [filterServer, setFilterServer] = useState("ALL")
  const [search, setSearch]   = useState("")

  const totalWeeks = getWeeksInYear(year)

  // ── Load records for current year ──────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from("backup_phi_records")
      .select("adp_code, week, year, done")
      .eq("year", year)
    if (data) setRecords(data as BackupRecord[])
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  // ── Lookup done status ──────────────────────────────────────
  const isDone = useCallback((adp_code: string, w: number) =>
    records.some(r => r.adp_code === adp_code && r.week === w && r.done)
  , [records])

  // ── Toggle a cell ───────────────────────────────────────────
  const toggle = async (adp_code: string, w: number) => {
    const key = `${adp_code}-${w}`
    const current = isDone(adp_code, w)
    setSaving(p => ({ ...p, [key]: true }))

    // Optimistic update
    setRecords(prev => {
      const exists = prev.find(r => r.adp_code === adp_code && r.week === w)
      if (exists) return prev.map(r => r.adp_code === adp_code && r.week === w ? { ...r, done: !current } : r)
      return [...prev, { adp_code, week: w, year, done: true }]
    })

    const { error } = await supabase.from("backup_phi_records").upsert(
      { adp_code, week: w, year, done: !current, updated_at: new Date().toISOString() },
      { onConflict: "adp_code,year,week" }
    )

    if (error) {
      // Revert on error
      setRecords(prev => prev.map(r =>
        r.adp_code === adp_code && r.week === w ? { ...r, done: current } : r
      ))
    } else {
      setSaved(p => ({ ...p, [key]: true }))
      setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 1500)
    }
    setSaving(p => ({ ...p, [key]: false }))
  }

  // ── Filtered master ─────────────────────────────────────────
  const filtered = useMemo(() => PHI_MASTER.filter(m => {
    if (filterArea !== "ALL" && m.area !== filterArea) return false
    if (filterServer !== "ALL" && m.server !== filterServer) return false
    if (search && !m.adp_name.toLowerCase().includes(search.toLowerCase()) &&
        !m.adp_code.includes(search)) return false
    return true
  }), [filterArea, filterServer, search])

  // ── Summary stats ───────────────────────────────────────────
  const weekDone  = records.filter(r => r.week === week && r.done).length
  const weekTotal = PHI_MASTER.length
  const weekPct   = Math.round((weekDone / weekTotal) * 100)

  // Per-area stats for this week
  const areaStats = ["GMA","NOL","SOL","VIS","MIN"].map(area => {
    const adps = PHI_MASTER.filter(m => m.area === area)
    const done = adps.filter(m => isDone(m.adp_code, week)).length
    return { area, done, total: adps.length, pct: Math.round((done / adps.length) * 100) }
  })

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg, #1a3a2a, #2d5a3d)", padding: "24px 32px", color: "white" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.6, marginBottom: 4 }}>
                Elite Global — PHI Team
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>
                💾 PHI DRP Backup Checklist
              </h1>
              <p style={{ fontSize: 13, opacity: 0.65, marginTop: 4 }}>
                {year} · {weekTotal} ADP · Klik sel untuk toggle status backup
              </p>
            </div>

            {/* Year selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setYear(y => y - 1)}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "white", display: "flex", alignItems: "center" }}>
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 700, minWidth: 50, textAlign: "center" }}>{year}</span>
              <button onClick={() => setYear(y => y + 1)}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "white", display: "flex", alignItems: "center" }}>
                <ChevronRight size={16} />
              </button>
              <button onClick={load} disabled={loading}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, padding: "6px 10px", cursor: "pointer", color: "white", display: "flex", alignItems: "center", gap: 5, marginLeft: 4 }}>
                <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
                <span style={{ fontSize: 12 }}>Refresh</span>
              </button>
            </div>
          </div>

          {/* Summary row */}
          <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
            {/* Overall week stat */}
            <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 12, padding: "12px 20px", minWidth: 160 }}>
              <div style={{ fontSize: 11, opacity: 0.65, marginBottom: 2 }}>Week {week} — Done</div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>{weekDone}<span style={{ fontSize: 14, opacity: 0.6 }}>/{weekTotal}</span></div>
              <div style={{ marginTop: 6, background: "rgba(255,255,255,0.15)", borderRadius: 99, height: 6, overflow: "hidden" }}>
                <div style={{ height: 6, borderRadius: 99, background: weekPct === 100 ? "#4ade80" : weekPct >= 80 ? "#86efac" : "#fbbf24", width: `${weekPct}%`, transition: "width 0.4s" }}/>
              </div>
              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 3 }}>{weekPct}% selesai</div>
            </div>
            {/* Per-area */}
            {areaStats.map(a => (
              <div key={a.area} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 16px", minWidth: 100 }}>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>{a.area}</div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{a.done}<span style={{ fontSize: 11, opacity: 0.6 }}>/{a.total}</span></div>
                <div style={{ marginTop: 4, background: "rgba(255,255,255,0.15)", borderRadius: 99, height: 4, overflow: "hidden" }}>
                  <div style={{ height: 4, borderRadius: 99, background: a.pct === 100 ? "#4ade80" : "#fbbf24", width: `${a.pct}%` }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WEEK NAVIGATION ────────────────────────────────── */}
      <div style={{ background: "white", borderBottom: "1px solid #e5e7eb", padding: "12px 32px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginRight: 4 }}>WEEK:</span>

          {/* Prev */}
          <button onClick={() => setWeek(w => Math.max(1, w - 1))} disabled={week === 1}
            style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #e5e7eb", background: "white", cursor: week === 1 ? "not-allowed" : "pointer", opacity: week === 1 ? 0.4 : 1, display: "flex", alignItems: "center" }}>
            <ChevronLeft size={14} />
          </button>

          {/* Week pills — show range around current */}
          {Array.from({ length: totalWeeks }, (_, i) => i + 1).map(w => {
            const wDone  = records.filter(r => r.week === w && r.done).length
            const wPct   = Math.round((wDone / weekTotal) * 100)
            const isNow  = w === curWeek && year === curYear
            const isSel  = w === week
            return (
              <button key={w} onClick={() => setWeek(w)}
                style={{
                  padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: isSel ? 700 : 500,
                  border: isSel ? "2px solid #1a3a2a" : "1.5px solid #e5e7eb",
                  background: isSel ? "#1a3a2a" : wPct === 100 ? "#d1fae5" : wPct > 0 ? "#fef3c7" : "white",
                  color: isSel ? "white" : wPct === 100 ? "#065f46" : wPct > 0 ? "#92400e" : "#374151",
                  cursor: "pointer", position: "relative",
                  outline: isNow && !isSel ? "2px solid #6ee7b7" : "none",
                  outlineOffset: 1,
                }}>
                {w}
                {isNow && <span style={{ position: "absolute", top: -4, right: -4, width: 7, height: 7, background: "#22c55e", borderRadius: "50%", border: "1.5px solid white" }}/>}
              </button>
            )
          })}

          {/* Next */}
          <button onClick={() => setWeek(w => Math.min(totalWeeks, w + 1))} disabled={week === totalWeeks}
            style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #e5e7eb", background: "white", cursor: week === totalWeeks ? "not-allowed" : "pointer", opacity: week === totalWeeks ? 0.4 : 1, display: "flex", alignItems: "center" }}>
            <ChevronRight size={14} />
          </button>

          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
            Week {week} · {year} {week === curWeek && year === curYear ? "← Minggu ini" : ""}
          </span>
        </div>
      </div>

      {/* ── FILTER BAR ─────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: "16px auto", padding: "0 32px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {/* Search */}
        <input
          placeholder="🔍 Cari ADP name / code..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: "7px 14px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, width: 220, outline: "none", fontFamily: "inherit" }}
        />
        {/* Area filter */}
        <div style={{ display: "flex", gap: 5 }}>
          {["ALL","GMA","NOL","SOL","VIS","MIN"].map(a => (
            <button key={a} onClick={() => setFilterArea(a)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: filterArea === a ? (AREA_COLOR[a]?.bg ?? "#1a3a2a") : "white",
                color: filterArea === a ? (AREA_COLOR[a]?.text ?? "white") : "#6b7280",
                border: `1.5px solid ${filterArea === a ? (AREA_COLOR[a]?.bg ?? "#1a3a2a") : "#e5e7eb"}`,
              }}>
              {a}
            </button>
          ))}
        </div>
        {/* Server filter */}
        <div style={{ display: "flex", gap: 5 }}>
          {["ALL","138","228","252"].map(s => (
            <button key={s} onClick={() => setFilterServer(s)}
              style={{
                padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: filterServer === s ? "#1a3a2a" : "white",
                color: filterServer === s ? "white" : "#6b7280",
                border: `1.5px solid ${filterServer === s ? "#1a3a2a" : "#e5e7eb"}`,
              }}>
              {s === "ALL" ? "All Server" : `SRV ${s}`}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{filtered.length} ADP</span>
      </div>

      {/* ── TABLE ──────────────────────────────────────────── */}
      <div style={{ maxWidth: 1400, margin: "0 auto 32px", padding: "0 32px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
            <RefreshCw size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 14 }}>Memuat data...</p>
          </div>
        ) : (
          <div style={{ background: "white", borderRadius: 16, border: "1px solid #e5e7eb", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "linear-gradient(135deg, #1a3a2a, #2d5a3d)", color: "white" }}>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", whiteSpace: "nowrap", position: "sticky", left: 0, background: "#1a3a2a" }}>NO</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>AREA</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>SERVER</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>ADP CODE</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", minWidth: 220 }}>ADP NAME</th>
                  <th style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, fontSize: 11, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>SUPPORT</th>
                  <th style={{ padding: "12px 14px", textAlign: "center", fontWeight: 700, fontSize: 12, background: "#0f5132", minWidth: 80 }}>
                    WEEK {week}
                    <div style={{ fontSize: 10, fontWeight: 400, opacity: 0.75, marginTop: 2 }}>{weekDone}/{weekTotal}</div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, idx) => {
                  const key    = `${m.adp_code}-${week}`
                  const done   = isDone(m.adp_code, week)
                  const isSvg  = saving[key]
                  const isOk   = saved[key]
                  const area   = AREA_COLOR[m.area] ?? { bg: "#f3f4f6", text: "#374151" }

                  return (
                    <tr key={m.adp_code}
                      style={{ borderBottom: "1px solid #f3f4f6", background: idx % 2 === 0 ? "white" : "#fafafa", transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f0fdf4")}
                      onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? "white" : "#fafafa")}>

                      <td style={{ padding: "10px 14px", color: "#9ca3af", fontSize: 11, fontWeight: 600 }}>{idx + 1}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ background: area.bg, color: area.text, borderRadius: 20, padding: "3px 9px", fontSize: 11, fontWeight: 700 }}>{m.area}</span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>SRV {m.server}</td>
                      <td style={{ padding: "10px 14px", color: "#6b7280", fontFamily: "monospace", fontSize: 12 }}>{m.adp_code}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#111827" }}>{m.adp_name}</td>
                      <td style={{ padding: "10px 14px", color: "#6b7280", fontSize: 12 }}>{m.support}</td>

                      {/* Checklist cell */}
                      <td style={{ padding: "10px 14px", textAlign: "center" }}>
                        <button
                          onClick={() => toggle(m.adp_code, week)}
                          disabled={isSvg}
                          title={done ? "Klik untuk batalkan" : "Klik untuk tandai selesai"}
                          style={{
                            background: "none", border: "none", cursor: isSvg ? "wait" : "pointer",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            padding: 4, borderRadius: 8,
                            transition: "transform 0.15s",
                            transform: isSvg ? "scale(0.9)" : "scale(1)",
                          }}>
                          {isSvg ? (
                            <RefreshCw size={22} color="#9ca3af" style={{ animation: "spin 0.6s linear infinite" }} />
                          ) : done ? (
                            <CheckCircle2 size={26} color={isOk ? "#16a34a" : "#22c55e"}
                              style={{ filter: "drop-shadow(0 1px 2px rgba(34,197,94,0.3))", transition: "color 0.3s" }} />
                          ) : (
                            <Circle size={26} color="#d1d5db" />
                          )}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {filtered.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#6b7280" }}>Tidak ada ADP yang sesuai filter</p>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  )
}