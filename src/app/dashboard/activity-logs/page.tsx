"use client"

import { useEffect, useState } from "react"
import { Activity, Download, ShieldAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { FEATURES } from "@/lib/features"

interface LogRow {
  id: string
  user_label: string
  feature_key: string | null
  path: string
  started_at: string
  ended_at: string | null
  duration_seconds: number | null
}

const FEATURE_LABEL = new Map(FEATURES.map(f => [f.key, f.label]))
function featureLabel(key: string | null): string {
  if (!key) return "Home"
  return FEATURE_LABEL.get(key) || key
}
function fmtDuration(sec: number | null): string {
  if (sec == null) return "—"
  if (sec < 60) return `${sec}d`
  const m = Math.floor(sec / 60), s = sec % 60
  if (m < 60) return `${m}m ${s}d`
  const h = Math.floor(m / 60)
  return `${h}j ${m % 60}m`
}

// Halaman admin-only buat lihat/export log "siapa buka fitur apa, jam
// berapa, berapa lama" (diminta user) — ditulis ActivityTracker di tiap
// kunjungan halaman dashboard, disimpen di tabel activity_logs.
export default function ActivityLogsPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const [rows, setRows] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [userQuery, setUserQuery] = useState("")

  const hasFallbackCookie = typeof document !== "undefined" && document.cookie.split("; ").some(c => c.startsWith("sb-session-manual="))

  useEffect(() => {
    (async () => {
      if (hasFallbackCookie) { setIsAdmin(true); loadLogs(); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsAdmin(false); setLoading(false); return }
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
      setIsAdmin(!!profile?.is_admin)
      if (profile?.is_admin) loadLogs()
      else setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase.from("activity_logs")
      .select("id,user_label,feature_key,path,started_at,ended_at,duration_seconds")
      .order("started_at", { ascending: false })
      .limit(2000)
    setRows(data || [])
    setLoading(false)
  }

  const filtered = rows.filter(r => {
    if (userQuery && !r.user_label.toLowerCase().includes(userQuery.toLowerCase())) return false
    const d = r.started_at.slice(0, 10)
    if (dateFrom && d < dateFrom) return false
    if (dateTo && d > dateTo) return false
    return true
  })

  async function exportExcel() {
    const XLSX = await import("xlsx")
    const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
      Tanggal: new Date(r.started_at).toLocaleDateString("id-ID"),
      Jam: new Date(r.started_at).toLocaleTimeString("id-ID"),
      User: r.user_label,
      Fitur: featureLabel(r.feature_key),
      Path: r.path,
      "Durasi (detik)": r.duration_seconds ?? "",
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Activity Logs")
    XLSX.writeFile(wb, `Activity_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  if (isAdmin === null || loading) return <p style={{ fontSize: 13, color: "var(--text3)" }}>Memuat...</p>
  if (!isAdmin) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 60 }}>
        <ShieldAlert size={32} color="var(--text3)" />
        <p style={{ fontSize: 13, color: "var(--text3)" }}>Halaman ini cuma buat admin.</p>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Activity size={18} color="var(--accent)" />
        </div>
        <div>
          <h1 style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>Log Aktivitas User</h1>
          <p style={{ fontSize: 11, color: "var(--text3)" }}>Siapa buka fitur apa, jam berapa, berapa lama — {rows.length} baris (2000 terbaru)</p>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }} />
        <span style={{ fontSize: 12, color: "var(--text3)" }}>s/d</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit" }} />
        <input type="text" value={userQuery} onChange={e => setUserQuery(e.target.value)} placeholder="Cari user..."
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 12, fontFamily: "inherit", minWidth: 160 }} />
        <button onClick={loadLogs}
          style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface2)", cursor: "pointer", fontSize: 12, color: "var(--text2)", fontFamily: "inherit" }}>
          Refresh
        </button>
        <button onClick={exportExcel} disabled={filtered.length === 0}
          style={{ marginLeft: "auto", padding: "7px 12px", borderRadius: 8, border: "none", background: "var(--accent)", cursor: filtered.length ? "pointer" : "not-allowed", opacity: filtered.length ? 1 : 0.5, fontSize: 12, color: "white", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, fontWeight: 700 }}>
          <Download size={13} /> Export Excel ({filtered.length})
        </button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--text3)", padding: 20 }}>Nggak ada data.</p>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: 600, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text3)", borderBottom: "1px solid var(--border)", background: "var(--surface2)", position: "sticky", top: 0 }}>
                  <th style={{ padding: "8px 10px" }}>Tanggal</th>
                  <th style={{ padding: "8px 10px" }}>Jam</th>
                  <th style={{ padding: "8px 10px" }}>User</th>
                  <th style={{ padding: "8px 10px" }}>Fitur</th>
                  <th style={{ padding: "8px 10px" }}>Durasi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>{new Date(r.started_at).toLocaleDateString("id-ID")}</td>
                    <td style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>{new Date(r.started_at).toLocaleTimeString("id-ID")}</td>
                    <td style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>{r.user_label}</td>
                    <td style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>{featureLabel(r.feature_key)}</td>
                    <td style={{ padding: "7px 10px", color: "var(--text2)", whiteSpace: "nowrap" }}>{fmtDuration(r.duration_seconds)}</td>
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
