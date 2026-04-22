"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Plus, FileText, Trash2, X, ChevronRight, Check, MapPin, Clock, Users, Upload, RefreshCw } from "lucide-react"
import { useRef } from "react"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Types ──────────────────────────────────────────────────────
interface ActionRow {
  id: string
  text: string
  pic: string
  deadline: string
  done: boolean
}

interface MainPoint {
  id: string
  text: string
}

interface NotulensiDoc {
  id: string
  title: string
  date: string
  time: string
  location: string
  attendees: string[]
  // Structured sections
  topic: string
  background: string
  tujuan: string
  main_points: MainPoint[]
  kendala: MainPoint[]
  action_items: ActionRow[]
  catatan_tambahan: string
  created_at: string
  updated_at: string
}

type Step = 1 | 2

const newDoc = (): Omit<NotulensiDoc, "id"|"created_at"|"updated_at"> => ({
  title: "", date: new Date().toISOString().split("T")[0], time: "", location: "",
  attendees: [],
  topic: "", background: "", tujuan: "",
  main_points: [{ id: crypto.randomUUID(), text: "" }],
  kendala: [],
  action_items: [{ id: crypto.randomUUID(), text: "", pic: "", deadline: "", done: false }],
  catatan_tambahan: "",
})

export default function NotulensiPage() {
  const [list, setList]       = useState<NotulensiDoc[]>([])
  const [view, setView]       = useState<"list" | "form" | "detail">("list")
  const [step, setStep]       = useState<Step>(1)
  const [form, setForm]       = useState(newDoc())
  const [selected, setSelected] = useState<NotulensiDoc | null>(null)
  const [attendeeInput, setAttendeeInput] = useState("")
  const [saving, setSaving]   = useState(false)
  const [numAttendees, setNumAttendees] = useState(1)
  const [uploading, setUploading]     = useState(false)
  const [parseError, setParseError]   = useState("")
  const [uploadQueue, setUploadQueue] = useState<string[]>([])  // list nama file dalam antrian
  const fileInputRef                  = useRef<HTMLInputElement>(null)

  const load = async () => {
    const { data } = await supabase.from("notulensi").select("*").order("date", { ascending: false })
    if (data) setList(data as NotulensiDoc[])
  }

  useEffect(() => { load() }, [])

  // ── Helpers ─────────────────────────────────────────────────
  const addAttendee = () => {
    if (!attendeeInput.trim()) return
    setForm(f => ({ ...f, attendees: [...f.attendees, attendeeInput.trim()] }))
    setAttendeeInput("")
  }

  const addMainPoint = () => setForm(f => ({ ...f, main_points: [...f.main_points, { id: crypto.randomUUID(), text: "" }] }))
  const updateMainPoint = (id: string, text: string) => setForm(f => ({ ...f, main_points: f.main_points.map(p => p.id === id ? { ...p, text } : p) }))
  const removeMainPoint = (id: string) => setForm(f => ({ ...f, main_points: f.main_points.filter(p => p.id !== id) }))

  const addKendala = () => setForm(f => ({ ...f, kendala: [...f.kendala, { id: crypto.randomUUID(), text: "" }] }))
  const updateKendala = (id: string, text: string) => setForm(f => ({ ...f, kendala: f.kendala.map(p => p.id === id ? { ...p, text } : p) }))
  const removeKendala = (id: string) => setForm(f => ({ ...f, kendala: f.kendala.filter(p => p.id !== id) }))

  const addActionRow = () => setForm(f => ({ ...f, action_items: [...f.action_items, { id: crypto.randomUUID(), text: "", pic: "", deadline: "", done: false }] }))
  const updateAction = (id: string, field: keyof ActionRow, val: string | boolean) =>
    setForm(f => ({ ...f, action_items: f.action_items.map(a => a.id === id ? { ...a, [field]: val } : a) }))
  const removeAction = (id: string) => setForm(f => ({ ...f, action_items: f.action_items.filter(a => a.id !== id) }))

  const toggleActionDone = async (noteId: string, items: ActionRow[], itemId: string) => {
    const updated = items.map(a => a.id === itemId ? { ...a, done: !a.done } : a)
    await supabase.from("notulensi").update({ action_items: updated }).eq("id", noteId)
    setList(prev => prev.map(n => n.id === noteId ? { ...n, action_items: updated } : n))
    setSelected(s => s?.id === noteId ? { ...s, action_items: updated } : s)
  }


  // ── Handle multiple file upload — process one by one ──────────
  const handleMultipleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    e.target.value = ""
    if (files.length === 1) {
      parseTxtToForm(files[0])
      return
    }
    // Multiple: show queue info and process first
    setUploadQueue(files.map(f => f.name))
    parseTxtToForm(files[0], files.slice(1))
  }

  // ── Parse .txt file to notulensi form ────────────────────────
  const parseTxtToForm = async (file: File, remaining: File[] = []) => {
    setUploading(true)
    setParseError("")
    try {
      const text = await file.text()
      const lines = text.split("\n")

      const get = (label: string) => {
        const line = lines.find(l => l.toLowerCase().startsWith(label.toLowerCase() + ":"))
        return line ? line.slice(label.length + 1).trim() : ""
      }

      const getSection = (startLabel: string, endLabels: string[]): string => {
        const startIdx = lines.findIndex(l => l.toLowerCase().includes(startLabel.toLowerCase()))
        if (startIdx === -1) return ""
        let endIdx = lines.length
        for (const end of endLabels) {
          const idx = lines.findIndex((l, i) => i > startIdx && l.toLowerCase().includes(end.toLowerCase()))
          if (idx !== -1 && idx < endIdx) endIdx = idx
        }
        return lines.slice(startIdx + 1, endIdx)
          .filter(l => l.trim())
          .map(l => l.replace(/^[-*•\d+\.]+\s*/, "").trim())
          .filter(Boolean)
          .join("\n")
      }

      const getBullets = (startLabel: string, endLabels: string[]): MainPoint[] => {
        const section = getSection(startLabel, endLabels)
        return section.split("\n").filter(Boolean).map(text => ({ id: crypto.randomUUID(), text }))
      }

      // Parse action items section
      const getActionItems = (): ActionRow[] => {
        const startIdx = lines.findIndex(l => l.toLowerCase().includes("action item"))
        if (startIdx === -1) return [{ id: crypto.randomUUID(), text: "", pic: "", deadline: "", done: false }]
        const rows: ActionRow[] = []
        for (let i = startIdx + 1; i < lines.length; i++) {
          const l = lines[i].trim()
          if (!l) continue
          if (l.toLowerCase().includes("catatan tambahan")) break
          // Try parse format: "- Teks | PIC: xxx | Deadline: xxx"
          const cleaned = l.replace(/^[-*•\d+\.]+\s*/, "")
          const picMatch = cleaned.match(/pic[:\s]+([^|\n]+)/i)
          const dlMatch  = cleaned.match(/deadline[:\s]+([^|\n]+)/i)
          const textPart = cleaned.split(/\|/)[0].replace(/pic[:\s]+.*/i,"").replace(/deadline[:\s]+.*/i,"").trim()
          rows.push({
            id: crypto.randomUUID(),
            text: textPart || cleaned,
            pic: picMatch?.[1]?.trim() || "",
            deadline: dlMatch?.[1]?.trim() || "",
            done: false,
          })
        }
        return rows.length > 0 ? rows : [{ id: crypto.randomUUID(), text: "", pic: "", deadline: "", done: false }]
      }

      const parsed = {
        title:     get("judul") || get("title") || file.name.replace(/\.txt$/, ""),
        date:      (() => {
          const raw = get("tanggal") || get("date")
          if (!raw) return new Date().toISOString().split("T")[0]
          const d = new Date(raw)
          return isNaN(d.getTime()) ? new Date().toISOString().split("T")[0] : d.toISOString().split("T")[0]
        })(),
        time:      get("waktu") || get("time") || "",
        location:  get("lokasi") || get("location") || get("tempat") || "",
        attendees: (() => {
          const raw = get("peserta") || get("attendees")
          return raw ? raw.split(/[,;]/).map(s => s.trim()).filter(Boolean) : []
        })(),
        topic:     get("topik") || get("topic") || get("agenda") || "",
        background: getSection("background", ["kondisi saat ini","current","main point","point penting","kendala","action"]),
        tujuan:    get("tujuan") || get("tujuan rapat") || "",
        main_points: getBullets("main point", ["kendala","action item","catatan"]).length > 0
          ? getBullets("main point", ["kendala","action item","catatan"])
          : [{ id: crypto.randomUUID(), text: "" }],
        kendala:   getBullets("kendala", ["action item","catatan"]),
        action_items: getActionItems(),
        catatan_tambahan: getSection("catatan tambahan", []),
      }

      setForm(parsed)
      setUploadQueue(remaining.map(f => f.name))
      setView("form")
      setStep(2)
    } catch (err) {
      setParseError("Gagal membaca file. Pastikan format .txt sudah sesuai.")
      console.error(err)
    }
    setUploading(false)
  }

  const save = async () => {
    if (!form.title || !form.date) return
    setSaving(true)
    const now = new Date().toISOString()
    // Build attendees from count if none added manually
    const finalAttendees = form.attendees.length > 0 ? form.attendees : Array.from({ length: numAttendees }, (_, i) => `Peserta ${i+1}`)
    await supabase.from("notulensi").insert([{ ...form, attendees: finalAttendees, updated_at: now }])
    setView("list")
    setForm(newDoc())
    setStep(1)
    setSaving(false)
    load()
  }

  const del = async (id: string) => {
    if (!confirm("Hapus notulensi ini?")) return
    await supabase.from("notulensi").delete().eq("id", id)
    load()
    if (selected?.id === id) { setSelected(null); setView("list") }
  }

  const openNew = () => { setForm(newDoc()); setStep(1); setView("form") }
  const openDetail = (n: NotulensiDoc) => { setSelected(n); setView("detail") }

  // ── Render ───────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="animate-fade">
      <MotivationBanner page="notulensi" />

      {parseError && (
        <div style={{ background: "#fde8e8", border: "1px solid #fca5a5", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "12px", color: "#c0392b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          ❌ {parseError}
          <button onClick={() => setParseError("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#c0392b" }}>×</button>
        </div>
      )}

      {uploadQueue.length > 0 && (
        <div style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-light)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "12px", color: "var(--accent)" }}>
          <div style={{ fontWeight: 700, marginBottom: "6px" }}>📂 Antrian Upload ({uploadQueue.length} file tersisa)</div>
          {uploadQueue.map((name, i) => (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
              <span style={{ opacity: 0.6 }}>{i + 1}.</span> {name}
            </div>
          ))}
          <div style={{ marginTop: "8px", fontSize: "11px", opacity: 0.8 }}>
            Simpan notulensi saat ini, lalu klik <strong>Upload .txt</strong> lagi untuk lanjut ke file berikutnya. Atau klik tombol di bawah untuk proses file selanjutnya langsung.
          </div>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: "18px", fontWeight: 800 }}>Notulensi Rapat</div>
          <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>{list.length} catatan tersimpan</div>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input ref={fileInputRef} type="file" accept=".txt" multiple style={{ display: "none" }} onChange={handleMultipleUpload} />
          <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Membaca...</> : <><Upload size={14} /> Upload .txt</>}
          </button>
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Buat Notulensi</button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <FileText size={40} color="var(--border2)" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "var(--text3)" }}>Belum ada notulensi. Mulai dengan membuat yang baru.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {list.map(n => (
            <div key={n.id} className="card card-hover" style={{ padding: "16px 20px", cursor: "pointer" }}
              onClick={() => openDetail(n)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "15px" }}>{n.title}</div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "6px", flexWrap: "wrap" }}>
                    <span className="mono" style={{ fontSize: "11px", color: "var(--accent)", background: "var(--accent-muted)", padding: "2px 8px", borderRadius: "99px" }}>
                      {new Date(n.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    </span>
                    {n.time && <span style={{ fontSize: "11px", color: "var(--text3)", display: "flex", alignItems: "center", gap: "3px" }}><Clock size={11} />{n.time}</span>}
                    {n.location && <span style={{ fontSize: "11px", color: "var(--text3)", display: "flex", alignItems: "center", gap: "3px" }}><MapPin size={11} />{n.location}</span>}
                    {(n.attendees?.length || 0) > 0 && <span style={{ fontSize: "11px", color: "var(--text3)", display: "flex", alignItems: "center", gap: "3px" }}><Users size={11} />{n.attendees?.length} peserta</span>}
                  </div>
                  {n.topic && <p style={{ fontSize: "12px", color: "var(--text2)", marginTop: "6px" }}>{n.topic}</p>}
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "12px" }}>
                  <button className="btn btn-danger" style={{ padding: "5px 8px" }}
                    onClick={e => { e.stopPropagation(); del(n.id) }}>
                    <Trash2 size={13} />
                  </button>
                  <ChevronRight size={16} color="var(--text3)" />
                </div>
              </div>
              {(n.action_items?.length || 0) > 0 && (
                <div style={{ marginTop: "10px", display: "flex", gap: "6px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text3)" }}>Action items:</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: n.action_items.filter(a => a.done).length === n.action_items.length ? "var(--success)" : "var(--warning)" }}>
                    {n.action_items.filter(a => a.done).length}/{n.action_items.length} selesai
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── STEP FORM ────────────────────────────────────────────────
  if (view === "form") return (
    <div className="animate-fade">
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn btn-ghost" style={{ fontSize: "13px" }} onClick={() => setView("list")}>← Kembali</button>
          <span style={{ fontSize: "16px", fontWeight: 800 }}>{step === 1 ? "Informasi Rapat" : form.title || "Pencatatan Rapat"}</span>
        </div>
        <div className="card" style={{ padding: "5px 14px", fontSize: "12px", fontWeight: 700, color: "var(--accent)" }}>
          Langkah {step} dari 2
        </div>
      </div>

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
          {/* Detail Rapat */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>📋</span> Detail Rapat
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div className="label" style={{ marginBottom: "5px" }}>Nama Notulensi / Agenda *</div>
                <input className="input" placeholder="Rapat Bulanan Tim, Evaluasi Q3..." value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <div className="label" style={{ marginBottom: "5px" }}>Hari & Tanggal *</div>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: "5px" }}>Pukul</div>
                  <input className="input" type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: "5px" }}>Ruangan / Lokasi</div>
                <input className="input" placeholder="Ruang Rapat A, Meeting Room 3, Zoom..." value={form.location}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Peserta */}
          <div className="card" style={{ padding: "20px" }}>
            <div style={{ fontWeight: 700, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
              <span>👥</span> Peserta Rapat
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div className="label" style={{ marginBottom: "5px" }}>Jumlah Peserta</div>
                <input className="input" type="number" min={1} value={numAttendees}
                  onChange={e => setNumAttendees(Number(e.target.value))} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "5px" }}>Tambah Nama Peserta (Opsional)</div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input className="input" placeholder="Nama peserta..." value={attendeeInput}
                    onChange={e => setAttendeeInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addAttendee()} />
                  <button className="btn btn-ghost" type="button" onClick={addAttendee}><Plus size={14} /></button>
                </div>
              </div>
              {form.attendees.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {form.attendees.map(a => (
                    <span key={a} style={{ background: "var(--accent-muted)", color: "var(--accent)", fontSize: "12px", padding: "3px 10px", borderRadius: "99px", cursor: "pointer" }}
                      onClick={() => setForm(f => ({ ...f, attendees: f.attendees.filter(x => x !== a) }))}>
                      {a} ×
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

          {/* Header info */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {[
              { icon: "📅", label: new Date(form.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) },
              ...(form.time ? [{ icon: "🕐", label: form.time }] : []),
              ...(form.location ? [{ icon: "📍", label: form.location }] : []),
              { icon: "👥", label: `${form.attendees.length > 0 ? form.attendees.length : numAttendees} peserta` },
            ].map((b, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "99px", padding: "4px 12px", fontSize: "12px" }}>
                <span>{b.icon}</span><span style={{ color: "var(--text2)" }}>{b.label}</span>
              </span>
            ))}
          </div>

          {/* Daftar Hadir */}
          {form.attendees.length > 0 && (
            <div className="card" style={{ padding: "16px 20px" }}>
              <div className="label" style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span>👥</span> DAFTAR HADIR
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {form.attendees.map(a => (
                  <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--accent-muted)", color: "var(--accent)", fontSize: "12px", padding: "4px 12px", borderRadius: "99px", fontWeight: 600 }}>
                    <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800 }}>
                      {a[0]?.toUpperCase()}
                    </span>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 0. Topik Utama */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div className="label" style={{ marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>🎯</span> TOPIK UTAMA RAPAT
            </div>
            <input className="input" placeholder="Contoh: Transisi Kalender 4-4-5 ke Kalender Masehi untuk Reporting"
              value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
          </div>

          {/* 1. Ringkasan Diskusi */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>1.</span> RINGKASAN DISKUSI
              <span style={{ fontWeight: 400, color: "var(--text3)", fontSize: "11px" }}>(Executive Summary)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text2)", marginBottom: "6px" }}>Latar Belakang</div>
                <textarea className="input" rows={3} placeholder="Kebutuhan / permasalahan yang melatarbelakangi rapat ini..."
                  value={form.background} onChange={e => setForm(f => ({ ...f, background: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text2)", marginBottom: "6px" }}>Tujuan Rapat</div>
                <textarea className="input" rows={3} placeholder="Apa yang ingin dicapai dari rapat ini..."
                  value={form.tujuan} onChange={e => setForm(f => ({ ...f, tujuan: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* 2. Poin Utama & Analisis */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>2.</span> POIN UTAMA & ANALISIS
              <span style={{ fontWeight: 400, color: "var(--text3)", fontSize: "11px" }}>(Main Points)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {form.main_points.map((p, i) => (
                <div key={p.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0, marginTop: "9px" }}>{i+1}</span>
                  <textarea className="input" rows={2} placeholder={`Poin ${i+1}...`} value={p.text}
                    onChange={e => updateMainPoint(p.id, e.target.value)} style={{ flex: 1 }} />
                  <button onClick={() => removeMainPoint(p.id)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "8px", marginTop: "2px" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: "12px" }} onClick={addMainPoint}>
                <Plus size={14} /> Tambah Poin
              </button>
            </div>
          </div>

          {/* 3. Kendala & Risiko */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>3.</span> KENDALA & RISIKO
              <span style={{ fontWeight: 400, color: "var(--text3)", fontSize: "11px" }}>(Pain Points)</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {form.kendala.map((p, i) => (
                <div key={p.id} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#fde8e8", color: "#c0392b", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0, marginTop: "9px" }}>{i+1}</span>
                  <textarea className="input" rows={2} placeholder={`Kendala ${i+1}...`} value={p.text}
                    onChange={e => updateKendala(p.id, e.target.value)} style={{ flex: 1 }} />
                  <button onClick={() => removeKendala(p.id)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "8px", marginTop: "2px" }}>
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: "12px" }} onClick={addKendala}>
                <Plus size={14} /> Tambah Kendala
              </button>
            </div>
          </div>

          {/* 4. Keputusan & Tindak Lanjut */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>4.</span> KEPUTUSAN & TINDAK LANJUT
              <span style={{ fontWeight: 400, color: "var(--text3)", fontSize: "11px" }}>(Action Items)</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    {["#", "Tindakan (Action)", "Penanggung Jawab", "Deadline", ""].map((h, i) => (
                      <th key={i} className="label" style={{ padding: "6px 8px", textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.action_items.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td style={{ padding: "8px", width: "30px" }}>
                        <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--accent-muted)", color: "var(--accent)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700 }}>{i+1}</span>
                      </td>
                      <td style={{ padding: "8px" }}>
                        <input className="input" style={{ minWidth: "200px" }} placeholder="Deskripsi tindakan..." value={a.text}
                          onChange={e => updateAction(a.id, "text", e.target.value)} />
                      </td>
                      <td style={{ padding: "8px" }}>
                        <input className="input" style={{ minWidth: "130px" }} placeholder="Nama PIC..." value={a.pic}
                          onChange={e => updateAction(a.id, "pic", e.target.value)} />
                      </td>
                      <td style={{ padding: "8px" }}>
                        <input className="input" type="date" style={{ minWidth: "130px" }} value={a.deadline}
                          onChange={e => updateAction(a.id, "deadline", e.target.value)} />
                      </td>
                      <td style={{ padding: "8px" }}>
                        <button onClick={() => removeAction(a.id)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}>
                          <X size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-ghost" style={{ marginTop: "10px", fontSize: "12px" }} onClick={addActionRow}>
                <Plus size={14} /> Tambah Baris
              </button>
            </div>
          </div>

          {/* 5. Catatan Tambahan */}
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>5.</span> CATATAN TAMBAHAN
              <span style={{ fontWeight: 400, color: "var(--text3)", fontSize: "11px" }}>(Opsional)</span>
            </div>
            <textarea className="input" rows={4} placeholder="Lampiran, log teknis, hal lain yang perlu dicatat..."
              value={form.catatan_tambahan} onChange={e => setForm(f => ({ ...f, catatan_tambahan: e.target.value }))} />
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ display: "flex", gap: "10px", marginTop: "20px", justifyContent: "space-between" }}>
        <button className="btn btn-ghost" onClick={() => step === 1 ? setView("list") : setStep(1)}>
          {step === 1 ? "Batal" : "← Edit Info"}
        </button>
        {step === 1 ? (
          <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!form.title || !form.date}>
            Lanjut ke Pencatatan →
          </button>
        ) : (
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Menyimpan..." : "💾 Simpan Notulensi"}
          </button>
        )}
      </div>
    </div>
  )

  // ── DETAIL VIEW ───────────────────────────────────────────────
  if (view === "detail" && selected) return (
    <div className="animate-fade">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button className="btn btn-ghost" style={{ fontSize: "13px" }} onClick={() => { setView("list"); setSelected(null) }}>← Kembali</button>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>{selected.title}</div>
            <div style={{ fontSize: "12px", color: "var(--text3)" }}>
              {new Date(selected.date).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              {selected.time && ` · ${selected.time}`}
              {selected.location && ` · ${selected.location}`}
            </div>
          </div>
        </div>
        <button className="btn btn-danger" onClick={() => del(selected.id)}><Trash2 size={15} /> Hapus</button>
      </div>

      {/* Tags row */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
        {[
          { icon: "📅", label: new Date(selected.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) },
          ...(selected.time ? [{ icon: "🕐", label: selected.time }] : []),
          ...(selected.location ? [{ icon: "📍", label: selected.location }] : []),
          { icon: "👥", label: `${selected.attendees?.length || 0} peserta` },
        ].map((b, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "99px", padding: "4px 12px", fontSize: "12px" }}>
            <span>{b.icon}</span><span style={{ color: "var(--text2)" }}>{b.label}</span>
          </span>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

        {/* Daftar Hadir */}
        {(selected.attendees?.length || 0) > 0 && (
          <div className="card" style={{ padding: "16px 20px" }}>
            <div className="label" style={{ marginBottom: "10px" }}>👥 DAFTAR HADIR</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {selected.attendees?.map(a => (
                <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--accent-muted)", color: "var(--accent)", fontSize: "12px", padding: "4px 12px", borderRadius: "99px", fontWeight: 600 }}>
                  <span style={{ width: "20px", height: "20px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800 }}>
                    {a[0]?.toUpperCase()}
                  </span>
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Topik */}
        {selected.topic && (
          <div className="card" style={{ padding: "16px 20px" }}>
            <div className="label" style={{ marginBottom: "8px" }}>🎯 TOPIK UTAMA</div>
            <p style={{ fontSize: "14px", fontWeight: 600 }}>{selected.topic}</p>
          </div>
        )}

        {/* Ringkasan */}
        {(selected.background || selected.tujuan) && (
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>1. RINGKASAN DISKUSI</div>
            {selected.background && (
              <div style={{ marginBottom: "12px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text3)", marginBottom: "6px" }}>Latar Belakang</div>
                <p style={{ fontSize: "13px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.background}</p>
              </div>
            )}
            {selected.tujuan && (
              <div>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text3)", marginBottom: "6px" }}>Tujuan Rapat</div>
                <p style={{ fontSize: "13px", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{selected.tujuan}</p>
              </div>
            )}
          </div>
        )}

        {/* Poin Utama */}
        {(selected.main_points?.length || 0) > 0 && (
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>2. POIN UTAMA & ANALISIS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {selected.main_points?.filter(p => p.text).map((p, i) => (
                <div key={p.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "var(--accent)", color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0, marginTop: "2px" }}>{i+1}</span>
                  <p style={{ fontSize: "13px", lineHeight: 1.7 }}>{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Kendala */}
        {(selected.kendala?.filter(k => k.text).length || 0) > 0 && (
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>3. KENDALA & RISIKO</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {selected.kendala?.filter(k => k.text).map((k, i) => (
                <div key={k.id} style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
                  <span style={{ width: "22px", height: "22px", borderRadius: "50%", background: "#fde8e8", color: "#c0392b", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 700, flexShrink: 0, marginTop: "2px" }}>{i+1}</span>
                  <p style={{ fontSize: "13px", lineHeight: 1.7 }}>{k.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Items */}
        {(selected.action_items?.length || 0) > 0 && (
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "14px" }}>4. KEPUTUSAN & TINDAK LANJUT</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    {["#", "Tindakan", "PIC", "Deadline", "Status"].map((h, i) => (
                      <th key={i} className="label" style={{ padding: "8px 10px", textAlign: "left" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.action_items.map((a, i) => (
                    <tr key={a.id} style={{ borderBottom: "1px solid var(--border)", background: a.done ? "var(--accent-muted)" : "transparent" }}>
                      <td style={{ padding: "10px" }}>
                        <button onClick={() => toggleActionDone(selected.id, selected.action_items, a.id)}
                          style={{ width: "20px", height: "20px", borderRadius: "5px", border: `2px solid ${a.done ? "var(--accent)" : "var(--border2)"}`, background: a.done ? "var(--accent)" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {a.done && <Check size={11} color="white" />}
                        </button>
                      </td>
                      <td style={{ padding: "10px", fontSize: "13px", textDecoration: a.done ? "line-through" : "none", color: a.done ? "var(--text3)" : "var(--text)" }}>{a.text}</td>
                      <td style={{ padding: "10px", fontSize: "12px", color: "var(--accent)", fontWeight: 600 }}>{a.pic || "-"}</td>
                      <td style={{ padding: "10px", fontSize: "12px", color: "var(--text3)" }} className="mono">
                        {a.deadline ? new Date(a.deadline).toLocaleDateString("id-ID", { day: "numeric", month: "short" }) : "-"}
                      </td>
                      <td style={{ padding: "10px" }}>
                        <span className="badge" style={{ background: a.done ? "var(--success-bg)" : "#f3f4f6", color: a.done ? "var(--success)" : "var(--text3)" }}>
                          {a.done ? "✓ Selesai" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Catatan Tambahan */}
        {selected.catatan_tambahan && (
          <div className="card" style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>5. CATATAN TAMBAHAN</div>
            <p style={{ fontSize: "13px", lineHeight: 1.7, color: "var(--text2)", whiteSpace: "pre-wrap" }}>{selected.catatan_tambahan}</p>
          </div>
        )}
      </div>
    </div>
  )

  return null
}