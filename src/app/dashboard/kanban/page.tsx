"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { KanbanTask } from "@/lib/types"
import { Plus, X, ChevronLeft, ChevronRight, LayoutGrid, Calendar } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Constants ────────────────────────────────────────────────
const COLUMNS = [
  { key: "todo",       label: "To Do",      color: "#6b7280" },
  { key: "inprogress", label: "In Progress", color: "#b45309" },
  { key: "done",       label: "Done",        color: "#2d6a4f" },
  { key: "blocked",    label: "Blocked",     color: "#c0392b" },
] as const

const STATUS_COLOR: Record<string, string> = {
  todo: "#6b7280", inprogress: "#b45309", done: "#2d6a4f", blocked: "#c0392b"
}
const STATUS_BG: Record<string, string> = {
  todo: "#f3f4f6", inprogress: "#fef3c7", done: "#d8f3dc", blocked: "#fde8e8"
}
const PRIO_COLOR: Record<string, string> = {
  low: "#6b7280", medium: "#1e40af", high: "#b45309", critical: "#c0392b"
}
const PRIO_BG: Record<string, string> = {
  low: "#f3f4f6", medium: "#dbeafe", high: "#fef3c7", critical: "#fde8e8"
}

const EMPTY: Partial<KanbanTask> = { title: "", description: "", status: "todo", priority: "medium", tags: [] }
type TabView = "board" | "calendar"

// ── Helpers ─────────────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}
const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
const DAYS_ID   = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"]

// ── Component ────────────────────────────────────────────────
export default function KanbanPage() {
  const [allTasks, setAllTasks]     = useState<KanbanTask[]>([])
  const [dateTasks, setDateTasks]   = useState<KanbanTask[]>([])
  const [calTasks, setCalTasks]     = useState<KanbanTask[]>([])    // all tasks for calendar
  const [date, setDate]             = useState(new Date().toISOString().split("T")[0])
  const [tab, setTab]               = useState<TabView>("board")
  const [modal, setModal]           = useState(false)
  const [form, setForm]             = useState({ ...EMPTY, date })
  const [tagInput, setTagInput]     = useState("")
  const [saving, setSaving]         = useState(false)
  const [dragging, setDragging]     = useState<string | null>(null)
  const [calYear, setCalYear]       = useState(new Date().getFullYear())
  const [calMonth, setCalMonth]     = useState(new Date().getMonth())
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null)

  // ── Data loading ─────────────────────────────────────────
  const loadBoard = async () => {
    const [{ data: todoData }, { data: dateData }] = await Promise.all([
      supabase.from("kanban_tasks").select("*").eq("status", "todo").order("order_index"),
      supabase.from("kanban_tasks").select("*").eq("date", date).in("status", ["inprogress","done","blocked"]).order("order_index"),
    ])
    if (todoData) setAllTasks(todoData)
    if (dateData) setDateTasks(dateData)
  }

  const loadCalendar = async () => {
    // Load semua task bulan ini ± 1 bulan
    const start = new Date(calYear, calMonth - 1, 1).toISOString().split("T")[0]
    const end   = new Date(calYear, calMonth + 2, 0).toISOString().split("T")[0]
    const { data } = await supabase
      .from("kanban_tasks")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date")
    if (data) setCalTasks(data)
  }

  useEffect(() => { loadBoard() }, [date])
  useEffect(() => { if (tab === "calendar") loadCalendar() }, [tab, calYear, calMonth])

  // ── Board helpers ────────────────────────────────────────
  const getColumnTasks = (status: string) => {
    if (status === "todo") return allTasks
    return dateTasks.filter(t => t.status === status)
  }

  const moveDate = (days: number) => {
    const d = new Date(date); d.setDate(d.getDate() + days)
    setDate(d.toISOString().split("T")[0])
  }

  const save = async () => {
    if (!form.title) return
    setSaving(true)
    const col = getColumnTasks(form.status || "todo")
    const maxOrder = col.length > 0 ? Math.max(...col.map(t => t.order_index)) + 1 : 0
    await supabase.from("kanban_tasks").insert([{ ...form, date, order_index: maxOrder, updated_at: new Date().toISOString() }])
    setModal(false); setForm({ ...EMPTY, date }); setSaving(false)
    if (tab === "board") loadBoard(); else loadCalendar()
  }

  const del = async (id: string) => {
    await supabase.from("kanban_tasks").delete().eq("id", id)
    setAllTasks(p => p.filter(t => t.id !== id))
    setDateTasks(p => p.filter(t => t.id !== id))
    setCalTasks(p => p.filter(t => t.id !== id))
  }

  const moveTask = async (taskId: string, oldStatus: string, newStatus: KanbanTask["status"]) => {
    await supabase.from("kanban_tasks").update({ status: newStatus, ...(newStatus !== "todo" ? { date } : {}), updated_at: new Date().toISOString() }).eq("id", taskId)
    loadBoard()
  }

  const addTag = () => {
    if (!tagInput.trim()) return
    setForm(f => ({ ...f, tags: [...(f.tags || []), tagInput.trim()] }))
    setTagInput("")
  }

  // ── Calendar helpers ─────────────────────────────────────
  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11) } else setCalMonth(m => m-1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0) } else setCalMonth(m => m+1) }

  const tasksByDate = useMemo(() => {
    const map: Record<string, KanbanTask[]> = {}
    calTasks.forEach(t => { if (!map[t.date]) map[t.date] = []; map[t.date].push(t) })
    return map
  }, [calTasks])

  const selectedDateTasks = selectedCalDate ? (tasksByDate[selectedCalDate] || []) : []

  const daysInMonth = getDaysInMonth(calYear, calMonth)
  const firstDay    = getFirstDayOfMonth(calYear, calMonth)
  const today       = new Date().toISOString().split("T")[0]
  const isToday     = date === today

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  // ── Render ─────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade">
      <MotivationBanner page="kanban" />

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "4px" }}>
          {([
            { key: "board",    icon: LayoutGrid, label: "Board" },
            { key: "calendar", icon: Calendar,   label: "Kalender" },
          ] as const).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 14px", borderRadius: "7px", border: "none", cursor: "pointer",
                fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13px", fontWeight: 600,
                background: tab === key ? "var(--surface)" : "transparent",
                color: tab === key ? "var(--text)" : "var(--text3)",
                boxShadow: tab === key ? "var(--shadow-xs)" : "none",
                transition: "all 0.15s",
              }}
            >
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* Board date nav */}
        {tab === "board" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button className="btn btn-ghost" style={{ padding: "7px" }} onClick={() => moveDate(-1)}><ChevronLeft size={16} /></button>
              <div style={{ fontWeight: 700, fontSize: "14px", minWidth: "80px", textAlign: "center" }}>
                {isToday ? "Hari Ini" : new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
              </div>
              <button className="btn btn-ghost" style={{ padding: "7px" }} onClick={() => moveDate(1)}><ChevronRight size={16} /></button>
            </div>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "140px", fontSize: "12px" }} />
          </div>
        )}

        <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY, date }); setModal(true) }}>
          <Plus size={16} /> Task
        </button>
      </div>

      {/* ── BOARD VIEW ─────────────────────────────────── */}
      {tab === "board" && (
        <>
          <div style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-light)", borderRadius: "var(--radius-sm)", padding: "8px 14px", fontSize: "12px", color: "var(--accent)" }}>
            💡 <strong>To Do</strong> menampilkan semua task tanpa filter tanggal. Kolom lain hanya untuk <strong>{fmtDate(date)}</strong>.
          </div>

          <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px", minHeight: "480px" }}>
            {COLUMNS.map(col => {
              const colTasks = getColumnTasks(col.key)
              return (
                <div key={col.key} style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", gap: "8px" }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    if (dragging) {
                      const task = [...allTasks, ...dateTasks].find(t => t.id === dragging)
                      if (task) moveTask(dragging, task.status, col.key)
                    }
                    setDragging(null)
                  }}
                >
                  {/* Column header */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", background: "var(--surface)",
                    border: "1px solid var(--border)", borderTopColor: col.color, borderTopWidth: "3px",
                    borderRadius: "var(--radius-sm)", boxShadow: "var(--shadow-xs)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: col.color, display: "inline-block" }} />
                      <span style={{ fontSize: "12px", fontWeight: 700 }}>{col.label}</span>
                      {col.key === "todo" && (
                        <span style={{ fontSize: "10px", background: "var(--accent-light)", color: "var(--accent)", padding: "1px 6px", borderRadius: "99px", fontWeight: 600 }}>All</span>
                      )}
                    </div>
                    <span className="mono" style={{ fontSize: "11px", color: "var(--text3)" }}>{colTasks.length}</span>
                  </div>

                  {/* Tasks */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                    {colTasks.map(task => (
                      <div key={task.id} draggable
                        onDragStart={() => setDragging(task.id)}
                        onDragEnd={() => setDragging(null)}
                        className="card"
                        style={{ padding: "14px", cursor: "grab", opacity: dragging === task.id ? 0.4 : 1, transition: "opacity 0.15s" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{task.title}</span>
                          <button onClick={() => del(task.id)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "0 0 0 8px", flexShrink: 0 }}>
                            <X size={13} />
                          </button>
                        </div>
                        {task.description && <p style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "10px", lineHeight: 1.5 }}>{task.description}</p>}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "99px", fontWeight: 600, background: PRIO_BG[task.priority], color: PRIO_COLOR[task.priority] }}>
                            {task.priority === "critical" ? "🔥 " : ""}{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                          {col.key === "todo" && (
                            <span className="mono" style={{ fontSize: "10px", color: "var(--text3)", background: "var(--bg)", padding: "2px 7px", borderRadius: "99px", border: "1px solid var(--border)" }}>
                              {new Date(task.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                        {(task.tags?.length || 0) > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "8px" }}>
                            {task.tags?.map(tag => (
                              <span key={tag} style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "99px", background: "var(--accent-muted)", color: "var(--accent)" }}>#{tag}</span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: "4px", marginTop: "10px", flexWrap: "wrap" }}>
                          {COLUMNS.filter(c => c.key !== col.key).map(c => (
                            <button key={c.key} onClick={() => moveTask(task.id, task.status, c.key)}
                              style={{ fontSize: "10px", padding: "2px 7px", borderRadius: "4px", cursor: "pointer", background: "transparent", border: `1px solid ${c.color}40`, color: c.color, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                              → {c.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {colTasks.length === 0 && (
                      <div style={{ flex: 1, minHeight: "100px", border: "2px dashed var(--border2)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px" }}>
                        Drop task di sini
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* ── CALENDAR VIEW ──────────────────────────────── */}
      {tab === "calendar" && (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>

          {/* Calendar grid */}
          <div className="card" style={{ flex: "1 1 500px", padding: "20px" }}>
            {/* Month nav */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <button className="btn btn-ghost" style={{ padding: "7px" }} onClick={prevMonth}><ChevronLeft size={16} /></button>
              <div style={{ fontWeight: 800, fontSize: "16px", letterSpacing: "-0.02em" }}>
                {MONTHS_ID[calMonth]} {calYear}
              </div>
              <button className="btn btn-ghost" style={{ padding: "7px" }} onClick={nextMonth}><ChevronRight size={16} /></button>
            </div>

            {/* Day headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "8px" }}>
              {DAYS_ID.map(d => (
                <div key={d} className="label" style={{ textAlign: "center", padding: "4px" }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
              {/* Empty cells for offset */}
              {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}

              {/* Day cells */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const dayTasks = tasksByDate[dateStr] || []
                const isToday2 = dateStr === today
                const isSelected = selectedCalDate === dateStr

                // Summarize statuses
                const hasDone       = dayTasks.some(t => t.status === "done")
                const hasInProgress = dayTasks.some(t => t.status === "inprogress")
                const hasBlocked    = dayTasks.some(t => t.status === "blocked")
                const hasTodo       = dayTasks.some(t => t.status === "todo")

                return (
                  <div
                    key={dateStr}
                    onClick={() => setSelectedCalDate(isSelected ? null : dateStr)}
                    style={{
                      minHeight: "68px", padding: "6px", borderRadius: "var(--radius-sm)",
                      border: `1.5px solid ${isSelected ? "var(--accent)" : isToday2 ? "var(--accent-light)" : "var(--border)"}`,
                      background: isSelected ? "var(--accent-muted)" : isToday2 ? "#f0fdf4" : "var(--surface)",
                      cursor: "pointer", transition: "all 0.15s",
                    }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--border2)" }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = isToday2 ? "var(--accent-light)" : "var(--border)" }}
                  >
                    <div style={{
                      fontSize: "12px", fontWeight: isToday2 ? 800 : 600,
                      color: isToday2 ? "var(--accent)" : isSelected ? "var(--accent)" : "var(--text)",
                      marginBottom: "4px",
                    }}>{day}</div>

                    {/* Task dots / mini pills */}
                    {dayTasks.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        {dayTasks.slice(0, 2).map(t => (
                          <div key={t.id} style={{
                            fontSize: "9px", padding: "1px 5px", borderRadius: "3px",
                            background: STATUS_BG[t.status], color: STATUS_COLOR[t.status],
                            fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}>
                            {t.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <div style={{ fontSize: "9px", color: "var(--text3)", fontWeight: 600 }}>+{dayTasks.length - 2} lainnya</div>
                        )}
                      </div>
                    )}

                    {/* Status indicator dots */}
                    {dayTasks.length > 0 && (
                      <div style={{ display: "flex", gap: "2px", marginTop: "4px" }}>
                        {hasTodo       && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: STATUS_COLOR.todo }} />}
                        {hasInProgress && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: STATUS_COLOR.inprogress }} />}
                        {hasDone       && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: STATUS_COLOR.done }} />}
                        {hasBlocked    && <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: STATUS_COLOR.blocked }} />}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ display: "flex", gap: "12px", marginTop: "16px", flexWrap: "wrap" }}>
              {COLUMNS.map(c => (
                <div key={c.key} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: c.color }} />
                  <span style={{ fontSize: "11px", color: "var(--text3)" }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Side panel: selected date tasks */}
          <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {selectedCalDate ? (
              <>
                <div className="card" style={{ padding: "14px 16px" }}>
                  <div className="label" style={{ marginBottom: "4px" }}>Tasks untuk</div>
                  <div style={{ fontWeight: 800, fontSize: "15px" }}>
                    {new Date(selectedCalDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>{selectedDateTasks.length} task</div>
                </div>

                {selectedDateTasks.length === 0 ? (
                  <div className="card" style={{ padding: "30px", textAlign: "center" }}>
                    <div style={{ fontSize: "28px", marginBottom: "8px" }}>📭</div>
                    <p style={{ fontSize: "12px", color: "var(--text3)" }}>Tidak ada task di tanggal ini</p>
                    <button className="btn btn-secondary" style={{ marginTop: "12px", fontSize: "12px" }}
                      onClick={() => { setDate(selectedCalDate); setTab("board") }}>
                      Buka di Board →
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedDateTasks.map(task => (
                      <div key={task.id} className="card" style={{ padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, flex: 1, lineHeight: 1.4 }}>{task.title}</span>
                          <button onClick={() => del(task.id)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "0", flexShrink: 0 }}>
                            <X size={12} />
                          </button>
                        </div>
                        <div style={{ display: "flex", gap: "6px", marginTop: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "99px", fontWeight: 600, background: STATUS_BG[task.status], color: STATUS_COLOR[task.status] }}>
                            {task.status === "inprogress" ? "In Progress" : task.status === "todo" ? "To Do" : task.status === "done" ? "Done" : "Blocked"}
                          </span>
                          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "99px", fontWeight: 600, background: PRIO_BG[task.priority], color: PRIO_COLOR[task.priority] }}>
                            {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                          </span>
                        </div>
                        {task.description && <p style={{ fontSize: "11px", color: "var(--text3)", marginTop: "6px", lineHeight: 1.5 }}>{task.description}</p>}
                      </div>
                    ))}
                    <button className="btn btn-ghost" style={{ fontSize: "12px", justifyContent: "center" }}
                      onClick={() => { setDate(selectedCalDate); setTab("board") }}>
                      Buka di Board →
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="card" style={{ padding: "30px", textAlign: "center" }}>
                <Calendar size={32} color="var(--border2)" style={{ margin: "0 auto 10px", display: "block" }} />
                <p style={{ fontSize: "12px", color: "var(--text3)", lineHeight: 1.6 }}>
                  Klik tanggal di kalender untuk melihat task
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MODAL ──────────────────────────────────────── */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: "16px" }}>Buat Task Baru</span>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Judul Task *</div>
                <input className="input" placeholder="Apa yang perlu dikerjakan?" value={form.title || ""}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Deskripsi</div>
                <textarea className="input" rows={2} placeholder="Detail task..." value={form.description || ""}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Status</div>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                    {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Prioritas</div>
                  <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as any }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical 🔥</option>
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Tanggal</div>
                  <input className="input" type="date" value={form.date || date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Deadline</div>
                  <input className="input" type="date" value={form.due_date || ""}
                    onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Tags</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="input" placeholder="Tambah tag..." value={tagInput}
                    onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addTag()} />
                  <button className="btn btn-ghost" type="button" onClick={addTag}><Plus size={14} /></button>
                </div>
                {(form.tags?.length || 0) > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                    {form.tags?.map(tag => (
                      <span key={tag} style={{ background: "var(--accent-muted)", color: "var(--accent)", fontSize: "12px", padding: "2px 9px", borderRadius: "99px", cursor: "pointer" }}
                        onClick={() => setForm(f => ({ ...f, tags: f.tags?.filter(t => t !== tag) }))}>
                        #{tag} ×
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-ghost" onClick={() => setModal(false)} style={{ flex: 1 }}>Batal</button>
                <button className="btn btn-primary" onClick={save} disabled={saving || !form.title} style={{ flex: 2, opacity: !form.title ? 0.6 : 1 }}>
                  {saving ? "Menyimpan..." : "Buat Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}