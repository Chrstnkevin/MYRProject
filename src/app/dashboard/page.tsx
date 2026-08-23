"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { KanbanTask, Notulensi } from "@/lib/types"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts"
import {
  CheckCircle2, Clock, Ban, ListTodo, Database,
  FileText, ArrowUpRight, AlertTriangle, ShieldCheck,
  Users, Shield, KeyRound, Building2,
  Ticket, ClipboardList, Activity, Target,
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { useRouter } from "next/navigation"

const PIE_COLORS = ["#6b7280", "#b45309", "#2d6a4f", "#c0392b"]
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
const MONTHLY_TARGET = 8
const WEEKLY_TARGET  = 2

function fmtCompact(n: number): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M"
  if (Math.abs(n) >= 1e6) return (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " Jt"
  if (Math.abs(n) >= 1e3) return (n / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " Rb"
  return n.toLocaleString("id-ID")
}

function diffPct(val: number, base: number): number {
  return Math.abs(val - base) / (base || 1) * 100
}

function getWeekNumber(d: Date) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export default function HomePage() {
  const router = useRouter()
  const now          = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear  = now.getFullYear()
  const currentWeek  = getWeekNumber(now)

  const [tasks,     setTasks]     = useState<KanbanTask[]>([])
  const [notulensi, setNotulensi] = useState<Notulensi[]>([])
  const [restores,  setRestores]  = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [ficomStats, setFicomStats] = useState({ rdm: 0, adm: 0, ads: 0, depot: 0 })

  // ── Ringkasan fitur lain (Logix, Backlog PHI, MPP Health, Compare Target) ──
  const [logixSummary, setLogixSummary] = useState<{ total: number; open: number; appsR1: number; openBr: number; solved: number } | null>(null)
  const [logixLoading, setLogixLoading] = useState(true)
  const [backlogSummary, setBacklogSummary] = useState<{ total: number; open: number; progress: number; done: number; hold: number } | null>(null)
  const [mppHealth, setMppHealth] = useState<{ subdist_issue: number; impacted_salesman: number; snapshot_time: string } | null>(null)
    const [compareSummary, setCompareSummary] = useState<{
    periodMonth: string; excelAmount: number; ediAmount: number
    ficomMainAmount: number | null; ficomDashAmount: number | null
  } | null>(null)

  useEffect(() => {
    supabase.from("backlog_phi").select("status").then(({ data }: { data: { status: string }[] | null }) => {
      if (!data) return
      const open     = data.filter(r => ["OPEN", "OPEN DEV", "OPEN DR"].includes(r.status)).length
      const progress = data.filter(r => ["ON PROGRESS", "REVIEW BR", "PILOT"].includes(r.status)).length
      const done     = data.filter(r => r.status === "DONE").length
      const hold     = data.filter(r => ["HOLD", "CANCELLED"].includes(r.status)).length
      setBacklogSummary({ total: data.length, open, progress, done, hold })
    })

    supabase.from("m_dashboard_health").select("subdist_issue,impacted_salesman,snapshot_time")
      .order("id", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setMppHealth(data) })

        supabase.from("target_excel_detail").select("period_month")
      .order("period_month", { ascending: false }).limit(1).maybeSingle()
      .then(async ({ data: latest }) => {
        if (!latest?.period_month) return
        const periodMonth = latest.period_month as string
        const [{ data: sumRows }, { data: ficomSd }, { data: ficomDashSd }] = await Promise.all([
          supabase.rpc("target_compare_home_summary", { p_period_month: periodMonth }),
          supabase.from("ficom_target_nodes").select("target").eq("level", "SD").order("period_date", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("ficom_target_nodes_category").select("target").eq("level", "SD").order("period_date", { ascending: false }).limit(1).maybeSingle(),
        ])
        const sums = (sumRows as { excel_amount: number; edi_amount: number }[] | null)?.[0]
        setCompareSummary({
          periodMonth,
          excelAmount: sums?.excel_amount ?? 0,
          ediAmount: sums?.edi_amount ?? 0,
          ficomMainAmount: ficomSd?.target ?? null,
          ficomDashAmount: ficomDashSd?.target ?? null,
        })
      })

    fetch("/api/logix-tickets").then(res => res.json().then(json => ({ ok: res.ok, json })))
      .then(({ ok, json }) => {
        if (ok && json.data) {
          const tickets = json.data as { nm_status?: string }[]
          const count = (s: string) => tickets.filter(t => (t.nm_status || "").toUpperCase() === s).length
          setLogixSummary({ total: tickets.length, open: count("OPEN"), appsR1: count("APPS R1"), openBr: count("OPEN BR"), solved: count("SOLVED") })
        }
        setLogixLoading(false)
      })
      .catch(() => setLogixLoading(false))
  }, [])

  useEffect(() => {
    const load = async () => {
      const [t, n, r, fc, dp] = await Promise.all([
        supabase.from("kanban_tasks").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("notulensi").select("*").order("date", { ascending: false }).limit(5),
        supabase.from("restore_phi").select("*").eq("year", currentYear),
        supabase.from("ficom_passwords").select("position"),
        supabase.from("master_data_adp").select("id"),
      ])
      if (t.data) setTasks(t.data)
      if (n.data) setNotulensi(n.data)
      if (r.data) setRestores(r.data)
      if (fc.data && dp.data) setFicomStats({
        rdm:   fc.data.filter((u: any) => u.position === "RDM").length,
        adm:   fc.data.filter((u: any) => u.position === "ADM").length,
        ads:   fc.data.filter((u: any) => u.position === "ADS").length,
        depot: dp.data.length,
      })
      setLoading(false)
    }
    load()
  }, [])

  // Task stats
  const taskStats = {
    todo:       tasks.filter(t => t.status === "todo").length,
    inprogress: tasks.filter(t => t.status === "inprogress").length,
    done:       tasks.filter(t => t.status === "done").length,
    blocked:    tasks.filter(t => t.status === "blocked").length,
  }
  const taskPieData = [
    { name: "To Do",       value: taskStats.todo },
    { name: "In Progress", value: taskStats.inprogress },
    { name: "Done",        value: taskStats.done },
    { name: "Blocked",     value: taskStats.blocked },
  ].filter(d => d.value > 0)

  // Restore stats
  const doneThisMonth = restores.filter(r => r.done_restore && r.month === currentMonth).length
  const doneThisWeek  = restores.filter(r => {
    if (!r.done_restore || !r.restore_date) return false
    return getWeekNumber(new Date(r.restore_date)) === currentWeek
  }).length
  const doneThisYear = restores.filter(r => r.done_restore).length
  const totalMaster  = 85
  const monthlyOk    = doneThisMonth >= MONTHLY_TARGET
  const weeklyOk     = doneThisWeek  >= WEEKLY_TARGET

  // Annual bar data
  const annualData = Array.from({ length: 12 }, (_, i) =>
    restores.filter(r => r.done_restore && r.month === i + 1).length
  )

  const hour   = now.getHours()
  const greet  = hour < 12 ? "Selamat pagi" : hour < 17 ? "Selamat siang" : "Selamat malam"

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ color: "var(--text3)", fontSize: "14px" }}>Memuat dashboard...</div>
    </div>
  )

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="animate-fade">

      {/* Greeting banner */}
      <div style={{
        background: "var(--accent)", borderRadius: "var(--radius-lg)",
        padding: "24px 28px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", right: "-20px", top: "-20px", width: "160px", height: "160px", borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", right: "40px", bottom: "-40px", width: "120px", height: "120px", borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <div style={{ position: "relative" }}>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.7)", fontWeight: 500, marginBottom: "4px" }}>
            {now.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
            {greet}! 👋
          </div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginTop: "4px" }}>
            Kamu punya <strong style={{ color: "white" }}>{taskStats.todo + taskStats.inprogress}</strong> tugas aktif
            {" · "}Restore bulan ini <strong style={{ color: monthlyOk ? "#86efac" : "#fde68a" }}>{doneThisMonth}/{MONTHLY_TARGET}</strong>
          </div>
        </div>
      </div>



      <MotivationBanner page="home" />

      {/* Unified Stats Panel */}
      <div className="card" style={{ padding: "20px", overflow: "hidden" }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ fontSize: "15px", fontWeight: 800, color: "var(--text)" }}>Overview</div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => router.push("/dashboard/kanban")}
              style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600, background: "var(--accent-muted)", border: "none", padding: "4px 10px", borderRadius: "99px", cursor: "pointer", fontFamily: "inherit" }}>
              Kanban →
            </button>
            <button onClick={() => router.push("/dashboard/ficom-password")}
              style={{ fontSize: "11px", color: "#7C3AED", fontWeight: 600, background: "#F5F3FF", border: "none", padding: "4px 10px", borderRadius: "99px", cursor: "pointer", fontFamily: "inherit" }}>
              Ficom →
            </button>
            <button onClick={() => router.push("/dashboard/master-data")}
              style={{ fontSize: "11px", color: "#0369A1", fontWeight: 600, background: "#EFF6FF", border: "none", padding: "4px 10px", borderRadius: "99px", cursor: "pointer", fontFamily: "inherit" }}>
              Master Data →
            </button>
          </div>
        </div>

        {/* Two-section divider */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", gap: "0", minHeight: "90px" }}>

          {/* Left: Task stats */}
          <div style={{ paddingRight: "20px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
              📋 Tugas
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
              {[
                { label: "To Do",    val: taskStats.todo,       color: "#6b7280" },
                { label: "Progress", val: taskStats.inprogress, color: "#b45309" },
                { label: "Selesai",  val: taskStats.done,       color: "#2d6a4f" },
                { label: "Blocked",  val: taskStats.blocked,    color: "#c0392b" },
              ].map(({ label, val, color }) => (
                <div key={label} onClick={() => router.push("/dashboard/kanban")}
                  style={{ textAlign: "center", padding: "10px 6px", borderRadius: "10px", background: "var(--surface3)", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--surface2)"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "var(--surface3)"}>
                  <div style={{ fontSize: "22px", fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "3px", fontWeight: 500 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div style={{ background: "var(--border)", margin: "0 4px" }} />

          {/* Right: Ficom + Depot stats */}
          <div style={{ paddingLeft: "20px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "10px" }}>
              🗂️ Ficom & Depot
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
              {[
                { label: "RDM",   val: ficomStats.rdm,   color: "#92400E", bg: "#FEF3C7", path: "/dashboard/ficom-password" },
                { label: "ADM",   val: ficomStats.adm,   color: "#7C3AED", bg: "#F5F3FF", path: "/dashboard/ficom-password" },
                { label: "ADS",   val: ficomStats.ads,   color: "#0369A1", bg: "#EFF6FF", path: "/dashboard/ficom-password" },
                { label: "Depot", val: ficomStats.depot, color: "#166534", bg: "#F0FDF4", path: "/dashboard/master-data"     },
              ].map(({ label, val, color, bg, path }) => (
                <div key={label} onClick={() => router.push(path)}
                  style={{ textAlign: "center", padding: "10px 6px", borderRadius: "10px", background: bg, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.8"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}>
                  <div style={{ fontSize: "22px", fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{loading ? "—" : val}</div>
                  <div style={{ fontSize: "10px", color, marginTop: "3px", fontWeight: 600, opacity: 0.8 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

            {/* Main 3-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>

        {/* Restore DB PHI Summary */}
        <div className="card card-hover" style={{ padding: "20px", cursor: "pointer" }} onClick={() => router.push("/dashboard/restore-phi")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <div>
              <div className="label">Restore DB PHI</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>Progress {MONTHS[currentMonth - 1]} {currentYear}</div>
            </div>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Database size={18} color="var(--accent)" />
            </div>
          </div>

          {/* Monthly progress bar */}
          <div style={{ marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "var(--text2)", fontWeight: 600 }}>Bulan ini</span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: monthlyOk ? "var(--success)" : "var(--warning)" }}>
                {doneThisMonth}/{MONTHLY_TARGET}
              </span>
            </div>
            <div style={{ height: "8px", background: "var(--surface3)", borderRadius: "99px", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.min(doneThisMonth / MONTHLY_TARGET * 100, 100)}%`, background: monthlyOk ? "var(--success)" : "var(--accent3)", borderRadius: "99px", transition: "width 0.8s ease" }} />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {[
              { label: "Minggu ini", val: doneThisWeek, target: WEEKLY_TARGET, ok: weeklyOk },
              { label: "Tahun ini",  val: doneThisYear, target: null, ok: true },
              { label: "Belum done", val: totalMaster - doneThisMonth, target: null, ok: (totalMaster - doneThisMonth) === 0 },
            ].map(({ label, val, target, ok }) => (
              <div key={label} style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "10px", textAlign: "center" }}>
                <div style={{ fontSize: "18px", fontWeight: 800, color: ok ? "var(--accent)" : "var(--warning)", letterSpacing: "-0.03em" }}>
                  {val}{target ? `/${target}` : ""}
                </div>
                <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Annual mini bars */}
          <div style={{ marginTop: "16px", display: "flex", gap: "3px", alignItems: "flex-end" }}>
            {annualData.map((v, i) => (
              <div key={i} title={`${MONTHS[i]}: ${v}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: "100%", background: i + 1 === currentMonth ? "var(--accent)" : v > 0 ? "var(--accent3)" : "var(--surface3)", borderRadius: 3, height: Math.max(3, v * 2.5), transition: "height 0.3s" }} />
                <div style={{ fontSize: "7px", color: "var(--text3)" }}>{MONTHS[i][0]}</div>
              </div>
            ))}
          </div>

          {/* Reminder */}
          {(!monthlyOk || !weeklyOk) && (
            <div style={{ marginTop: "12px", background: "var(--warning-bg)", borderRadius: "var(--radius-xs)", padding: "8px 10px", display: "flex", alignItems: "center", gap: "7px" }}>
              <AlertTriangle size={13} color="var(--warning)" />
              <span style={{ fontSize: "11px", color: "var(--warning)", fontWeight: 600 }}>
                {!monthlyOk ? `Kurang ${MONTHLY_TARGET - doneThisMonth}x lagi bulan ini` : `Minggu ini baru ${doneThisWeek}/${WEEKLY_TARGET}`}
              </span>
            </div>
          )}
          {monthlyOk && weeklyOk && (
            <div style={{ marginTop: "12px", background: "var(--success-bg)", borderRadius: "var(--radius-xs)", padding: "8px 10px", display: "flex", alignItems: "center", gap: "7px" }}>
              <ShieldCheck size={13} color="var(--success)" />
              <span style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600 }}>Target minggu ini & bulan ini terpenuhi 🎉</span>
            </div>
          )}
        </div>

        {/* Task Status Pie */}
        <div className="card card-hover" style={{ padding: "20px", cursor: "pointer" }} onClick={() => router.push("/dashboard/kanban")}>
          <div className="label" style={{ marginBottom: "4px" }}>Tugas</div>
          <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "16px" }}>Status Overview</div>
          {taskPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                  {taskPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text3)" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "13px", flexDirection: "column", gap: "8px" }}>
              <ListTodo size={32} color="var(--border2)" />
              <span>Belum ada task</span>
            </div>
          )}
          <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <div style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--warning)" }}>{taskStats.inprogress}</div>
              <div style={{ fontSize: "10px", color: "var(--text3)" }}>Sedang dikerjakan</div>
            </div>
            <div style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "8px 12px" }}>
              <div style={{ fontSize: "16px", fontWeight: 800, color: "var(--accent)" }}>{taskStats.done}</div>
              <div style={{ fontSize: "10px", color: "var(--text3)" }}>Selesai</div>
            </div>
          </div>
        </div>

        {/* Notulensi terbaru */}
        <div className="card card-hover" style={{ padding: "20px", cursor: "pointer" }} onClick={() => router.push("/dashboard/notulensi")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div className="label">Notulensi</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>Rapat Terbaru</div>
            </div>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={18} color="var(--accent)" />
            </div>
          </div>
          {notulensi.length === 0 ? (
            <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "13px", flexDirection: "column", gap: "8px" }}>
              <FileText size={28} color="var(--border2)" />
              <span>Belum ada notulensi</span>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {notulensi.slice(0, 4).map((n, i) => (
                <div key={n.id} style={{
                  display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px",
                  background: "var(--surface3)", borderRadius: "var(--radius-sm)",
                  borderLeft: "3px solid var(--accent)"
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</div>
                    <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "2px" }}>
                      {new Date(n.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      {n.location ? ` · ${n.location}` : ""}
                    </div>
                  </div>
                  <ArrowUpRight size={14} color="var(--text3)" style={{ flexShrink: 0, marginTop: 2 }} />
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: "14px", textAlign: "center" }}>
            <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600, cursor: "pointer" }}>
              Lihat semua notulensi →
            </span>
          </div>
        </div>
      </div>

      {/* Ringkasan fitur lain */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>

        {/* Ticket Logix */}
        <div className="card card-hover" style={{ padding: "20px", cursor: "pointer" }} onClick={() => router.push("/dashboard/logix-tickets")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div className="label">Ticket Logix</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>Log Support Excellent</div>
            </div>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Ticket size={18} color="#DC2626" />
            </div>
          </div>
          {logixLoading ? (
            <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px" }}>Memuat...</div>
          ) : logixSummary ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {[
                  { label: "Open", val: logixSummary.open, color: "#991B1B" },
                  { label: "APPS R1", val: logixSummary.appsR1, color: "#92400E" },
                  { label: "Open BR", val: logixSummary.openBr, color: "#C2410C" },
                  { label: "Solved", val: logixSummary.solved, color: "#166534" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: "18px", fontWeight: 800, color, letterSpacing: "-0.03em" }}>{val}</div>
                    <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text3)" }}>Total {logixSummary.total} tiket</div>
            </>
          ) : (
            <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px", textAlign: "center" }}>Gagal memuat / kredensial belum diisi</div>
          )}
        </div>

        {/* Backlog PHI */}
        <div className="card card-hover" style={{ padding: "20px", cursor: "pointer" }} onClick={() => router.push("/dashboard/backlog-phi")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div className="label">Backlog PHI</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>Concern & Request</div>
            </div>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={18} color="#92400E" />
            </div>
          </div>
          {backlogSummary ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "8px" }}>
                {[
                  { label: "Open",     val: backlogSummary.open,     color: "#6b7280" },
                  { label: "Progress", val: backlogSummary.progress, color: "#3b82f6" },
                  { label: "Done",     val: backlogSummary.done,     color: "#10b981" },
                  { label: "Hold",     val: backlogSummary.hold,     color: "#ef4444" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "8px 4px", textAlign: "center" }}>
                    <div style={{ fontSize: "16px", fontWeight: 800, color, letterSpacing: "-0.03em" }}>{val}</div>
                    <div style={{ fontSize: "9px", color: "var(--text3)", marginTop: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "12px", fontSize: "11px", color: "var(--text3)" }}>Total {backlogSummary.total} item</div>
            </>
          ) : (
            <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px" }}>Memuat...</div>
          )}
        </div>

        {/* MPP Health */}
        <div className="card card-hover" style={{ padding: "20px", cursor: "pointer" }} onClick={() => router.push("/dashboard/mpp-health")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div className="label">MPP Health</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>Monitoring Subdist</div>
            </div>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: mppHealth && mppHealth.subdist_issue === 0 ? "#DCFCE7" : "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Activity size={18} color={mppHealth && mppHealth.subdist_issue === 0 ? "#16A34A" : "#DC2626"} />
            </div>
          </div>
          {mppHealth ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "14px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: mppHealth.subdist_issue === 0 ? "#16A34A" : "#DC2626" }} />
                <span style={{ fontSize: "11px", fontWeight: 700, color: mppHealth.subdist_issue === 0 ? "#16A34A" : "#DC2626" }}>
                  {mppHealth.subdist_issue === 0 ? "HEALTHY" : "WARNING"}
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: mppHealth.subdist_issue === 0 ? "var(--accent)" : "#DC2626", letterSpacing: "-0.03em" }}>{mppHealth.subdist_issue}</div>
                  <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>Subdist Bermasalah</div>
                </div>
                <div style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "var(--text)", letterSpacing: "-0.03em" }}>{mppHealth.impacted_salesman}</div>
                  <div style={{ fontSize: "10px", color: "var(--text3)", marginTop: "2px" }}>Salesman Terdampak</div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px" }}>Memuat...</div>
          )}
        </div>

        {/* Compare Target */}
        <div className="card card-hover" style={{ padding: "20px", cursor: "pointer" }} onClick={() => router.push("/dashboard/target-compare")}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <div className="label">Compare Target</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>Excel vs Ficom vs EDI</div>
            </div>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Target size={18} color="#0369A1" />
            </div>
          </div>
                    {compareSummary ? (
            <>
              <div style={{ fontSize: "12px", color: "var(--text2)", fontWeight: 600, marginBottom: "10px" }}>
                Periode: <span style={{ color: "var(--text)" }}>{compareSummary.periodMonth}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {([
                  { label: "Excel (STT)", val: compareSummary.excelAmount as number | null, diff: null as number | null, color: "#0369A1" },
                  { label: "Ficom Main", val: compareSummary.ficomMainAmount, diff: compareSummary.ficomMainAmount != null ? diffPct(compareSummary.ficomMainAmount, compareSummary.excelAmount) : null, color: "#7C3AED" },
                  { label: "Ficom Dash. Cat", val: compareSummary.ficomDashAmount, diff: compareSummary.ficomDashAmount != null ? diffPct(compareSummary.ficomDashAmount, compareSummary.excelAmount) : null, color: "#0891B2" },
                  { label: "Matrix (EDI)", val: compareSummary.ediAmount as number | null, diff: diffPct(compareSummary.ediAmount, compareSummary.excelAmount), color: "#166534" },
                ]).map(({ label, val, diff, color }) => (
                  <div key={label} style={{ background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "8px 10px" }}>
                    <div style={{ fontSize: "9px", color: "var(--text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</div>
                    <div style={{ fontSize: "15px", fontWeight: 800, color, letterSpacing: "-0.02em", marginTop: "2px" }}>
                      {val == null ? "—" : fmtCompact(val)}
                    </div>
                    {diff != null && (
                      <div style={{ fontSize: "9px", fontWeight: 700, marginTop: "2px", color: diff <= 1 ? "#16A34A" : "#DC2626" }}>
                        {diff <= 1 ? "✓ Match" : `⚠ beda ${diff.toFixed(1)}%`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 90, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px", textAlign: "center" }}>Belum ada data periode</div>
          )}
        </div>
      </div>

      {/* Recent tasks list */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="label">Tugas</div>
            <div style={{ fontSize: "15px", fontWeight: 800, marginTop: "1px" }}>Terbaru</div>
          </div>
          <button onClick={() => router.push("/dashboard/kanban")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "var(--accent)", fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
            Lihat semua <ArrowUpRight size={13} />
          </button>
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>Belum ada tugas.</div>
        ) : (
          <div>
            {tasks.slice(0, 6).map((task, i) => (
              <div key={task.id} style={{
                display: "flex", alignItems: "center", gap: "14px", padding: "13px 20px",
                borderBottom: i < Math.min(5, tasks.length - 1) ? "1px solid var(--border)" : "none",
              }}>
                <span className={`badge badge-${task.status}`}>
                  {task.status === "inprogress" ? "In Progress" : task.status === "todo" ? "To Do" : task.status === "done" ? "Done" : "Blocked"}
                </span>
                <span style={{ flex: 1, fontSize: "13px", fontWeight: 500 }}>{task.title}</span>
                <span className="mono" style={{ fontSize: "11px", color: "var(--text3)" }}>
                  {new Date(task.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}