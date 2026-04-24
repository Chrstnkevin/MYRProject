"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { KanbanTask } from "@/lib/types"
import { Plus, X, ChevronLeft, ChevronRight, LayoutGrid, Calendar, FileText, Copy, Check, RefreshCw, Edit3, GripVertical } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import ModalOverlay from "@/components/layout/ModalOverlay"

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
type ColKey = "todo" | "inprogress" | "done" | "blocked"

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate() }
function getFirstDayOfMonth(year: number, month: number) { return new Date(year, month, 1).getDay() }
const MONTHS_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
const DAYS_ID   = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"]

// ── Greeting helper ──────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours()
  if (h < 11) return "Selamat pagi"
  if (h < 15) return "Selamat siang"
  if (h < 18) return "Selamat sore"
  return "Selamat malam"
}

export default function KanbanPage() {
  const [allTasks, setAllTasks]     = useState<KanbanTask[]>([])
  const [dateTasks, setDateTasks]   = useState<KanbanTask[]>([])
  const [calTasks, setCalTasks]     = useState<KanbanTask[]>([])
  const [date, setDate]             = useState(new Date().toISOString().split("T")[0])
  const [tab, setTab]               = useState<TabView>("board")
  const [modal, setModal]           = useState(false)
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null)
  const [longPressTask, setLongPressTask] = useState<string | null>(null)
  const [form, setForm]             = useState({ ...EMPTY, date })
  const [tagInput, setTagInput]     = useState("")
  const [saving, setSaving]         = useState(false)
  const [dragging, setDragging]     = useState<string | null>(null)
  const [calYear, setCalYear]       = useState(new Date().getFullYear())
  const [calMonth, setCalMonth]     = useState(new Date().getMonth())
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null)

  // ── Daily Report state ────────────────────────────────────
  const [showReport, setShowReport]   = useState(false)
  const [reportText, setReportText]   = useState("")
  const [generating, setGenerating]   = useState(false)
  const [copied, setCopied]           = useState(false)
  const textareaRef                   = useRef<HTMLTextAreaElement>(null)

  // ── Data ─────────────────────────────────────────────────
  const loadBoard = async () => {
    const [{ data: todoData }, { data: dateData }] = await Promise.all([
      supabase.from("kanban_tasks").select("*").eq("status", "todo").order("order_index"),
      supabase.from("kanban_tasks").select("*").eq("date", date).in("status", ["inprogress","done","blocked"]).order("order_index"),
    ])
    if (todoData) setAllTasks(todoData)
    if (dateData) setDateTasks(dateData)
  }

  const loadCalendar = async () => {
    const start = new Date(calYear, calMonth - 1, 1).toISOString().split("T")[0]
    const end   = new Date(calYear, calMonth + 2, 0).toISOString().split("T")[0]
    const { data } = await supabase.from("kanban_tasks").select("*").gte("date", start).lte("date", end).order("date")
    if (data) setCalTasks(data)
  }

  useEffect(() => { loadBoard() }, [date])
  useEffect(() => { if (tab === "calendar") loadCalendar() }, [tab, calYear, calMonth])

  // ── Helpers ───────────────────────────────────────────────
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
    if (editingTask) {
      // Update existing task
      await supabase.from("kanban_tasks").update({
        title: form.title, description: form.description,
        status: form.status, priority: form.priority,
        date: form.date, due_date: form.due_date, tags: form.tags,
        updated_at: new Date().toISOString()
      }).eq("id", editingTask.id)
    } else {
      // Create new task
      const col = getColumnTasks(form.status || "todo")
      const maxOrder = col.length > 0 ? Math.max(...col.map(t => t.order_index)) + 1 : 0
      await supabase.from("kanban_tasks").insert([{ ...form, date, order_index: maxOrder, updated_at: new Date().toISOString() }])
    }
    setModal(false); setEditingTask(null); setForm({ ...EMPTY, date }); setSaving(false)
    if (tab === "board") loadBoard(); else loadCalendar()
  }

  const openEdit = (task: KanbanTask) => {
    setEditingTask(task)
    setForm({
      title: task.title, description: task.description || "",
      status: task.status, priority: task.priority,
      date: task.date, due_date: task.due_date || "", tags: task.tags || []
    })
    setModal(true)
  }

  const del = async (id: string) => {
    await supabase.from("kanban_tasks").delete().eq("id", id)
    setAllTasks(p => p.filter(t => t.id !== id))
    setDateTasks(p => p.filter(t => t.id !== id))
    setCalTasks(p => p.filter(t => t.id !== id))
  }

  const moveTask = async (taskId: string, _from: string, newStatus: ColKey) => {
    await supabase.from("kanban_tasks").update({
      status: newStatus,
      ...(newStatus !== "todo" ? { date } : {}),
      updated_at: new Date().toISOString()
    }).eq("id", taskId)
    loadBoard()
    if (tab === "calendar") loadCalendar()
  }

  const addTag = () => {
    if (!tagInput.trim()) return
    setForm(f => ({ ...f, tags: [...(f.tags || []), tagInput.trim()] }))
    setTagInput("")
  }

  // ── Generate Daily Report ─────────────────────────────────
  const generateReport = async () => {
    setGenerating(true)
    setShowReport(true)

    // Fetch done tasks for selected date
    const { data: doneTasks } = await supabase
      .from("kanban_tasks")
      .select("*")
      .eq("date", date)
      .eq("status", "done")
      .order("order_index")

    // Todo tasks (all, no date filter)
    const { data: todoTasks } = await supabase
      .from("kanban_tasks")
      .select("*")
      .eq("status", "todo")
      .order("order_index")

    const fmtDate = new Date(date).toLocaleDateString("id-ID", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    })

    const greeting = getGreeting()

    // Build achievement list
    const doneList = doneTasks && doneTasks.length > 0
      ? doneTasks.map(t => {
          const desc = t.description ? `\n   ${t.description}` : ""
          return `* ${t.title}${desc}`
        }).join("\n")
      : "* (Belum ada task yang selesai di tanggal ini)"

    // Build plan list
    const todoList = todoTasks && todoTasks.length > 0
      ? todoTasks.map(t => {
          const desc = t.description ? `\n   ${t.description}` : ""
          return `* ${t.title}${desc}`
        }).join("\n")
      : "* (Belum ada task yang direncanakan)"

    const report = `${greeting} pak Risky dan pak Tedy, berikut list kerjaan saya hari ini (${fmtDate}):

1. Apa Pencapaian Hari Ini:
${doneList}

2. Plan yang Dikerjakan Besok:
${todoList}`

    setReportText(report)
    setGenerating(false)
  }

  const copyReport = () => {
    navigator.clipboard.writeText(reportText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Calendar ──────────────────────────────────────────────
  const prevMonth = () => { if (calMonth === 0) { setCalYear(y => y-1); setCalMonth(11) } else setCalMonth(m => m-1) }
  const nextMonth = () => { if (calMonth === 11) { setCalYear(y => y+1); setCalMonth(0) } else setCalMonth(m => m+1) }

  const tasksByDate = useMemo(() => {
    const map: Record<string, KanbanTask[]> = {}
    calTasks.forEach(t => { if (!map[t.date]) map[t.date] = []; map[t.date].push(t) })
    return map
  }, [calTasks])

  const daysInMonth    = getDaysInMonth(calYear, calMonth)
  const firstDay       = getFirstDayOfMonth(calYear, calMonth)
  const today          = new Date().toISOString().split("T")[0]
  const isToday        = date === today
  const fmtDate        = (d: string) => new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const selectedDateTasks = selectedCalDate ? (tasksByDate[selectedCalDate] || []) : []

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade">
      <MotivationBanner page="kanban" />

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "4px", background: "var(--surface3)", borderRadius: "var(--radius-sm)", padding: "4px" }}>
          {([{ key: "board" as TabView, icon: LayoutGrid, label: "Board" }, { key: "calendar" as TabView, icon: Calendar, label: "Kalender" }]).map(({ key, icon: Icon, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "7px 14px",
              borderRadius: "7px", border: "none", cursor: "pointer",
              fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13px", fontWeight: 600,
              background: tab === key ? "var(--surface)" : "transparent",
              color: tab === key ? "var(--text)" : "var(--text3)",
              boxShadow: tab === key ? "var(--shadow-xs)" : "none", transition: "all 0.15s",
            }}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>

        {/* Board date nav */}
        {tab === "board" && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button className="btn btn-ghost" style={{ padding: "7px" }} onClick={() => moveDate(-1)}><ChevronLeft size={16} /></button>
            <div style={{ fontWeight: 700, fontSize: "14px", minWidth: "80px", textAlign: "center" }}>
              {isToday ? "Hari Ini" : new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
            </div>
            <button className="btn btn-ghost" style={{ padding: "7px" }} onClick={() => moveDate(1)}><ChevronRight size={16} /></button>
            <input className="input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "140px", fontSize: "12px" }} />
          </div>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          {tab === "board" && (
            <button className="btn btn-secondary" onClick={generateReport} style={{ fontSize: "13px" }}>
              <FileText size={15} /> Generate Report
            </button>
          )}
          <button className="btn btn-primary" onClick={() => { setEditingTask(null); setForm({ ...EMPTY, date }); setModal(true) }}>
            <Plus size={16} /> Task
          </button>
        </div>
      </div>

      {/* ── BOARD VIEW ───────────────────────────────────── */}
      {tab === "board" && (
        <>
          <div style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-light)", borderRadius: "var(--radius-sm)", padding: "8px 14px", fontSize: "12px", color: "var(--accent)" }}>
            💡 <strong>To Do</strong> = semua task. Kolom lain = <strong>{fmtDate(date)}</strong>.
          </div>

          <div style={{ display: "flex", gap: "12px", overflowX: "auto", paddingBottom: "8px" }}>
            {COLUMNS.map(col => {
              const colTasks = getColumnTasks(col.key)
              return (
                <div key={col.key}
                  style={{ flex: "0 0 260px", display: "flex", flexDirection: "column", gap: "8px" }}
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

                  {/* Tasks — no min-height to avoid whitespace */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {colTasks.map(task => {
                      const isLongPress = longPressTask === task.id
                      let pressTimer: ReturnType<typeof setTimeout>
                      return (
                        <div key={task.id}
                          draggable={isLongPress}
                          onDragStart={() => { if (isLongPress) setDragging(task.id) }}
                          onDragEnd={() => { setDragging(null); setLongPressTask(null) }}
                          className="card"
                          onClick={() => { if (!isLongPress) openEdit(task) }}
                          onMouseDown={() => { pressTimer = setTimeout(() => setLongPressTask(task.id), 500) }}
                          onMouseUp={() => { clearTimeout(pressTimer); if (!isLongPress) setLongPressTask(null) }}
                          onMouseLeave={() => { clearTimeout(pressTimer) }}
                          onTouchStart={() => { pressTimer = setTimeout(() => setLongPressTask(task.id), 500) }}
                          onTouchEnd={() => { clearTimeout(pressTimer) }}
                          style={{
                            padding: "12px 14px", cursor: isLongPress ? "grab" : "pointer",
                            opacity: dragging === task.id ? 0.4 : 1,
                            transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
                            outline: isLongPress ? "2px solid var(--accent)" : "none",
                            transform: isLongPress ? "scale(1.02)" : "scale(1)",
                            userSelect: "none",
                          }}
                        >
                          {/* Top row: tag kiri | priority kanan */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", flex: 1 }}>
                              {(task.tags?.length || 0) > 0
                                ? task.tags?.map(tag => (
                                    <span key={tag} style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "99px", background: "var(--accent-muted)", color: "var(--accent)", fontWeight: 600 }}>#{tag}</span>
                                  ))
                                : <span style={{ fontSize: "10px", color: "var(--border2)" }}>—</span>
                              }
                            </div>
                            <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "99px", fontWeight: 700, background: PRIO_BG[task.priority], color: PRIO_COLOR[task.priority], flexShrink: 0, marginLeft: "6px" }}>
                              {task.priority === "critical" ? "🔥 " : ""}{task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
                            </span>
                          </div>

                          {/* Title */}
                          <div style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.4, color: "var(--text)", marginBottom: task.description ? "6px" : "0" }}>
                            {task.title}
                          </div>

                          {/* Description */}
                          {task.description && (
                            <p style={{ fontSize: "12px", color: "var(--text3)", lineHeight: 1.5, margin: "0 0 8px" }}>{task.description}</p>
                          )}

                          {/* Bottom row: date (todo) | delete | drag hint */}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              {col.key === "todo" && (
                                <span className="mono" style={{ fontSize: "10px", color: "var(--text3)", background: "var(--bg)", padding: "2px 7px", borderRadius: "99px", border: "1px solid var(--border)" }}>
                                  {new Date(task.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                                </span>
                              )}
                              <span style={{ fontSize: "10px", color: "var(--text3)", opacity: isLongPress ? 1 : 0.4, transition: "opacity 0.2s", display: "flex", alignItems: "center", gap: "2px" }}>
                                <GripVertical size={11} /> {isLongPress ? "lepas untuk pindah" : "tahan untuk pindah"}
                              </span>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); del(task.id) }}
                              style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "2px 4px", borderRadius: "4px", transition: "color 0.15s" }}
                              onMouseEnter={e => (e.currentTarget.style.color = "var(--danger)")}
                              onMouseLeave={e => (e.currentTarget.style.color = "var(--text3)")}
                            >
                              <X size={13} />
                            </button>
                          </div>

                          {/* Move buttons — only show when long pressed */}
                          <div style={{
                            display: "flex", gap: "4px", flexWrap: "wrap",
                            maxHeight: isLongPress ? "40px" : "0px",
                            overflow: "hidden",
                            marginTop: isLongPress ? "8px" : "0",
                            transition: "all 0.2s cubic-bezier(0.22,1,0.36,1)",
                            opacity: isLongPress ? 1 : 0,
                          }}>
                            {COLUMNS.filter(c => c.key !== col.key).map(c => (
                              <button key={c.key}
                                onClick={e => { e.stopPropagation(); moveTask(task.id, task.status, c.key); setLongPressTask(null) }}
                                style={{ fontSize: "10px", padding: "3px 9px", borderRadius: "4px", cursor: "pointer", background: STATUS_BG[c.key], border: `1px solid ${c.color}40`, color: c.color, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, transition: "all 0.15s" }}>
                                → {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {/* Drop zone - only show when dragging */}
                    {colTasks.length === 0 && (
                      <div style={{ minHeight: "80px", border: "2px dashed var(--border2)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)", fontSize: "12px" }}>
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

      {/* ── CALENDAR VIEW ────────────────────────────────── */}
      {tab === "calendar" && (
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <div className="card" style={{ flex: "1 1 500px", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
              <button className="btn btn-ghost" style={{ padding: "7px" }} onClick={prevMonth}><ChevronLeft size={16} /></button>
              <div style={{ fontWeight: 800, fontSize: "16px" }}>{MONTHS_ID[calMonth]} {calYear}</div>
              <button className="btn btn-ghost" style={{ padding: "7px" }} onClick={nextMonth}><ChevronRight size={16} /></button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", marginBottom: "8px" }}>
              {DAYS_ID.map(d => <div key={d} className="label" style={{ textAlign: "center", padding: "4px" }}>{d}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
              {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1
                const ds = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`
                const dayTasks = tasksByDate[ds] || []
                const isT2 = ds === today, isSel = selectedCalDate === ds
                return (
                  <div key={ds} onClick={() => setSelectedCalDate(isSel ? null : ds)}
                    style={{ minHeight: "60px", padding: "5px", borderRadius: "var(--radius-sm)", cursor: "pointer", transition: "all 0.15s",
                      border: `1.5px solid ${isSel ? "var(--accent)" : isT2 ? "var(--accent-light)" : "var(--border)"}`,
                      background: isSel ? "var(--accent-muted)" : isT2 ? "#f0fdf4" : "var(--surface)" }}>
                    <div style={{ fontSize: "12px", fontWeight: isT2 ? 800 : 600, color: (isT2 || isSel) ? "var(--accent)" : "var(--text)", marginBottom: "3px" }}>{day}</div>
                    {dayTasks.slice(0, 2).map(t => (
                      <div key={t.id} style={{ fontSize: "9px", padding: "1px 4px", borderRadius: "3px", background: STATUS_BG[t.status], color: STATUS_COLOR[t.status], fontWeight: 600, marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {t.title}
                      </div>
                    ))}
                    {dayTasks.length > 2 && <div style={{ fontSize: "9px", color: "var(--text3)", fontWeight: 600 }}>+{dayTasks.length - 2}</div>}
                  </div>
                )
              })}
            </div>
          </div>
          <div style={{ flex: "0 0 280px", display: "flex", flexDirection: "column", gap: "10px" }}>
            {selectedCalDate ? (
              <>
                <div className="card" style={{ padding: "14px 16px" }}>
                  <div className="label" style={{ marginBottom: "4px" }}>Tasks untuk</div>
                  <div style={{ fontWeight: 800, fontSize: "15px" }}>{new Date(selectedCalDate).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}</div>
                  <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>{selectedDateTasks.length} task</div>
                </div>
                {selectedDateTasks.length === 0 ? (
                  <div className="card" style={{ padding: "30px", textAlign: "center" }}>
                    <p style={{ fontSize: "12px", color: "var(--text3)" }}>Tidak ada task di tanggal ini</p>
                  </div>
                ) : selectedDateTasks.map(task => (
                  <div key={task.id} className="card" style={{ padding: "12px 14px" }}>
                    <div style={{ display: "flex", gap: "8px", marginBottom: "6px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600, flex: 1 }}>{task.title}</span>
                      <button onClick={() => openEdit(task)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }} title="Edit task"><Edit3 size={12} /></button>
                      <button onClick={() => del(task.id)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><X size={12} /></button>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "99px", fontWeight: 600, background: STATUS_BG[task.status], color: STATUS_COLOR[task.status] }}>
                        {task.status === "inprogress" ? "In Progress" : task.status === "todo" ? "To Do" : task.status === "done" ? "Done" : "Blocked"}
                      </span>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="card" style={{ padding: "30px", textAlign: "center" }}>
                <Calendar size={32} color="var(--border2)" style={{ margin: "0 auto 10px", display: "block" }} />
                <p style={{ fontSize: "12px", color: "var(--text3)" }}>Klik tanggal untuk lihat task</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DAILY REPORT MODAL ───────────────────────────── */}
      {showReport && (
        <ModalOverlay onClose={() => setShowReport(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "600px" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: "16px" }}>📋 Daily Report</div>
                <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>
                  {new Date(date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </div>
              </div>
              <button onClick={() => setShowReport(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {generating ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", padding: "40px", color: "var(--accent)" }}>
                  <RefreshCw size={20} style={{ animation: "spin 1s linear infinite" }} />
                  <span style={{ fontWeight: 600 }}>Menyusun report...</span>
                </div>
              ) : (
                <>
                  <div style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-light)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "12px", color: "var(--accent)" }}>
                    💡 Edit teks di bawah sesuai kebutuhan, lalu copy ke grup.
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={reportText}
                    onChange={e => setReportText(e.target.value)}
                    className="input mono"
                    rows={16}
                    style={{ fontSize: "13px", lineHeight: 1.7, resize: "vertical" }}
                  />
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="btn btn-ghost" onClick={() => setShowReport(false)} style={{ flex: 1 }}>Tutup</button>
                    <button className="btn btn-primary" onClick={copyReport} style={{ flex: 2, justifyContent: "center" }}>
                      {copied ? <><Check size={15} /> Tersalin!</> : <><Copy size={15} /> Copy ke Clipboard</>}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── TASK MODAL ────────────────────────────────────── */}
      {modal && (
        <ModalOverlay onClose={() => { setModal(false); setEditingTask(null); setForm({ ...EMPTY, date }) }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "480px", width: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontWeight: 800, fontSize: "16px" }}>{editingTask ? "✏️ Edit Task" : "Buat Task Baru"}</span>
              <button onClick={() => { setModal(false); setEditingTask(null); setForm({ ...EMPTY, date }) }} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: 6, borderRadius: "var(--radius-xs)" }}><X size={18} /></button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" }}>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Judul Task *</div>
                <input className="input" placeholder="Apa yang perlu dikerjakan?" value={form.title || ""} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Deskripsi</div>
                <textarea className="input" rows={2} placeholder="Detail task..." value={form.description || ""} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Status</div>
                  <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ColKey }))}>
                    {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Prioritas</div>
                  <select className="input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as KanbanTask["priority"] }))}>
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
                  <input className="input" type="date" value={form.date || date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Deadline</div>
                  <input className="input" type="date" value={form.due_date || ""} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: "8px" }}>Tags</div>
                <select className="input" value={(form.tags?.[0]) || ""} onChange={e => setForm(f => ({ ...f, tags: e.target.value ? [e.target.value] : [] }))}>
                  <option value="">— Pilih Tag —</option>
                  <option value="Supporting PHI">Supporting PHI</option>
                  <option value="Supporting Lokal">Supporting Lokal</option>
                  <option value="Discuss">Discuss</option>
                  <option value="Document">Document</option>
                  <option value="Weekly Task">Weekly Task</option>
                </select>
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => { setModal(false); setEditingTask(null); setForm({ ...EMPTY, date }) }} style={{ flex: 1 }}>Batal</button>
              <button className="btn btn-primary" onClick={save} disabled={saving || !form.title} style={{ flex: 2, opacity: !form.title ? 0.6 : 1 }}>
                {saving ? "Menyimpan..." : editingTask ? "Simpan Perubahan" : "Buat Task"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}