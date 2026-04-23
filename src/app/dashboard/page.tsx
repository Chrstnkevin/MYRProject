"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { KanbanTask, Notulensi } from "@/lib/types"
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from "recharts"
import {
  CheckCircle2, Clock, Ban, ListTodo, Database,
  FileText, ArrowUpRight, AlertTriangle, ShieldCheck
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { useRouter } from "next/navigation"

const PIE_COLORS = ["#6b7280", "#b45309", "#2d6a4f", "#c0392b"]
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
const MONTHLY_TARGET = 8
const WEEKLY_TARGET  = 2

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

  useEffect(() => {
    const load = async () => {
      const [t, n, r] = await Promise.all([
        supabase.from("kanban_tasks").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("notulensi").select("*").order("date", { ascending: false }).limit(5),
        supabase.from("restore_phi").select("*").eq("year", currentYear),
      ])
      if (t.data) setTasks(t.data)
      if (n.data) setNotulensi(n.data)
      if (r.data) setRestores(r.data)
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

      {/* KPI Cards — Task */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }} className="stagger">
        {[
          { label: "To Do",       val: taskStats.todo,       icon: ListTodo,     color: "#6b7280", bg: "#f3f4f6" },
          { label: "In Progress", val: taskStats.inprogress, icon: Clock,        color: "#b45309", bg: "#fef3c7" },
          { label: "Selesai",     val: taskStats.done,       icon: CheckCircle2, color: "#2d6a4f", bg: "#d8f3dc" },
          { label: "Blocked",     val: taskStats.blocked,    icon: Ban,          color: "#c0392b", bg: "#fde8e8" },
        ].map(({ label, val, icon: Icon, color, bg }) => (
          <div key={label} className="card card-hover" style={{ padding: "18px 16px", cursor: "pointer" }} onClick={() => router.push("/dashboard/kanban")}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: "28px", fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: "12px", color: "var(--text3)", fontWeight: 500, marginTop: "4px" }}>{label}</div>
              </div>
              <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon size={17} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <MotivationBanner page="home" />

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