"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { KanbanTask, FinanceTransaction } from "@/lib/types"
import MotivationBanner from "@/components/layout/MotivationBanner"
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell, Legend
} from "recharts"
import { CheckCircle2, Clock, Ban, ListTodo, TrendingUp, TrendingDown, Wallet, ArrowUpRight } from "lucide-react"

const PIE_COLORS = ["#6b7280", "#b45309", "#2d6a4f", "#c0392b"]

export default function HomePage() {
  const [tasks, setTasks]         = useState<KanbanTask[]>([])
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const load = async () => {
      const [t, f] = await Promise.all([
        supabase.from("kanban_tasks").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("finance_transactions").select("*").order("date", { ascending: false }).limit(60),
      ])
      if (t.data) setTasks(t.data)
      if (f.data) setTransactions(f.data)
      setLoading(false)
    }
    load()
  }, [])

  const taskStats = {
    todo:       tasks.filter(t => t.status === "todo").length,
    inprogress: tasks.filter(t => t.status === "inprogress").length,
    done:       tasks.filter(t => t.status === "done").length,
    blocked:    tasks.filter(t => t.status === "blocked").length,
  }

  const totalIncome  = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
  const balance      = totalIncome - totalExpense

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().split("T")[0]
    return {
      day: d.toLocaleDateString("id-ID", { weekday: "short" }),
      Pemasukan:   transactions.filter(t => t.date === key && t.type === "income").reduce((s,t) => s+t.amount,0)/1000,
      Pengeluaran: transactions.filter(t => t.date === key && t.type === "expense").reduce((s,t) => s+t.amount,0)/1000,
    }
  })

  const taskPieData = [
    { name: "To Do", value: taskStats.todo },
    { name: "In Progress", value: taskStats.inprogress },
    { name: "Done", value: taskStats.done },
    { name: "Blocked", value: taskStats.blocked },
  ].filter(d => d.value > 0)

  const expByCategory: Record<string, number> = {}
  transactions.filter(t => t.type === "expense").forEach(t => {
    expByCategory[t.category] = (expByCategory[t.category] || 0) + t.amount
  })
  const catData = Object.entries(expByCategory).sort((a,b) => b[1]-a[1])

  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(n)
  const fmtFull = (n: number) => new Intl.NumberFormat("id-ID").format(n)

  const hour = new Date().getHours()
  const greet = hour < 12 ? "Selamat pagi" : hour < 17 ? "Selamat siang" : "Selamat malam"

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh" }}>
      <div style={{ color: "var(--text3)", fontSize: "14px" }}>Memuat dashboard...</div>
    </div>
  )

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="card" style={{ padding: "10px 14px", fontSize: "12px" }}>
        <div style={{ fontWeight: 700, marginBottom: "6px", color: "var(--text)" }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.color, display: "flex", gap: "8px", justifyContent: "space-between" }}>
            <span>{p.name}</span><span style={{ fontWeight: 600 }}>Rp {p.value}k</span>
          </div>
        ))}
      </div>
    )
  }

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
            {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div style={{ fontSize: "22px", fontWeight: 800, color: "white", letterSpacing: "-0.02em" }}>
            {greet}! 👋
          </div>
          <div style={{ fontSize: "13px", color: "rgba(255,255,255,0.65)", marginTop: "4px" }}>
            Kamu punya <strong style={{ color: "white" }}>{taskStats.todo + taskStats.inprogress}</strong> tugas yang perlu diselesaikan hari ini.
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }} className="stagger">
        {[
          { label: "To Do",        val: taskStats.todo,       icon: ListTodo,     color: "#6b7280", bg: "#f3f4f6" },
          { label: "In Progress",  val: taskStats.inprogress, icon: Clock,        color: "#b45309", bg: "#fef3c7" },
          { label: "Selesai",      val: taskStats.done,       icon: CheckCircle2, color: "#2d6a4f", bg: "#d8f3dc" },
          { label: "Blocked",      val: taskStats.blocked,    icon: Ban,          color: "#c0392b", bg: "#fde8e8" },
        ].map(({ label, val, icon: Icon, color, bg }) => (
          <div key={label} className="card card-hover" style={{ padding: "18px 16px" }}>
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

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>

        {/* Cashflow chart */}
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div>
              <div className="label">Cashflow</div>
              <div style={{ fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>7 Hari Terakhir</div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={last7} barGap={4} barSize={10}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fill: "var(--text3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Pemasukan"   fill="#2d6a4f" radius={[4,4,0,0]} />
              <Bar dataKey="Pengeluaran" fill="#c0392b" radius={[4,4,0,0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: "flex", gap: "16px", marginTop: "12px", justifyContent: "center" }}>
            {[["Pemasukan","#2d6a4f"],["Pengeluaran","#c0392b"]].map(([l,c]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "2px", background: c }} />
                <span style={{ fontSize: "11px", color: "var(--text3)" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Finance summary */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="label" style={{ marginBottom: "4px" }}>Keuangan</div>
          <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "20px" }}>Ringkasan</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {[
              { label: "Saldo",       val: balance,      color: balance >= 0 ? "#2d6a4f" : "#c0392b", icon: Wallet,       bg: balance >= 0 ? "#d8f3dc" : "#fde8e8" },
              { label: "Pemasukan",   val: totalIncome,  color: "#2d6a4f",  icon: TrendingUp,   bg: "#d8f3dc" },
              { label: "Pengeluaran", val: totalExpense, color: "#c0392b",  icon: TrendingDown, bg: "#fde8e8" },
            ].map(({ label, val, color, icon: Icon, bg }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Icon size={15} color={color} />
                  </div>
                  <span style={{ fontSize: "13px", fontWeight: 500 }}>{label}</span>
                </div>
                <span className="mono" style={{ fontSize: "14px", fontWeight: 700, color }}>
                  Rp {fmt(Math.abs(val))}
                </span>
              </div>
            ))}
          </div>
          {catData.length > 0 && (
            <div style={{ marginTop: "18px" }}>
              <div className="label" style={{ marginBottom: "10px" }}>Top Pengeluaran</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {catData.slice(0, 3).map(([name, val], i) => {
                  const pct = Math.round((val / totalExpense) * 100)
                  const colors = ["#2d6a4f","#b45309","#1e40af"]
                  return (
                    <div key={name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 500 }}>{name}</span>
                        <span className="mono" style={{ fontSize: "11px", color: "var(--text3)" }}>{pct}%</span>
                      </div>
                      <div style={{ height: "5px", background: "var(--bg2)", borderRadius: "99px" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: colors[i % colors.length], borderRadius: "99px", transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Task Status Pie */}
        <div className="card" style={{ padding: "20px" }}>
          <div className="label" style={{ marginBottom: "4px" }}>Tugas</div>
          <div style={{ fontSize: "16px", fontWeight: 800, marginBottom: "16px" }}>Status Overview</div>
          {taskPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={taskPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} dataKey="value">
                  {taskPieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px", fontSize: "12px", boxShadow: "var(--shadow)" }} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "var(--text3)" }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "13px", flexDirection: "column", gap: "8px" }}>
              <ListTodo size={32} color="var(--border2)" />
              <span>Belum ada task</span>
            </div>
          )}
        </div>
      </div>

      {/* Recent tasks */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "18px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="label">Tugas</div>
            <div style={{ fontSize: "15px", fontWeight: 800, marginTop: "1px" }}>Terbaru</div>
          </div>
          <span style={{ fontSize: "12px", color: "var(--text3)", fontWeight: 500 }}>{tasks.length} total</span>
        </div>
        {tasks.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)" }}>Belum ada tugas.</div>
        ) : (
          <div>
            {tasks.slice(0, 6).map((task, i) => (
              <div key={task.id} style={{
                display: "flex", alignItems: "center", gap: "14px", padding: "13px 20px",
                borderBottom: i < 5 && i < tasks.length - 1 ? "1px solid var(--border)" : "none",
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