"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { Plus, X, FileText, Sparkles, ChevronRight, ChevronLeft, Trash2, Edit3, Copy, Check, RefreshCw, BookOpen, Upload, Zap } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────
interface Epic {
  id: string
  code: string
  userStory: string
  acceptanceCriteria: string
}

const APLIKASI_OPTIONS = ["Matrix", "SFA", "FiCom", "Ficom Lite", "EDI", "Lainnya"]

interface DocReq {
  id: string
  doc_number: string
  project: string
  modul: string
  aplikasi: string
  type: string
  request_by: string
  pic: string
  date_request: string
  background: string
  current_conditions: string
  product_perspective: string
  product_scope: string
  global_flow: string
  epics: Epic[]
  status: string
  created_at: string
}

interface RefDoc {
  id: string
  name: string
  content: string
  description?: string
  aplikasi?: string
  created_at: string
}

type View = "list" | "generate" | "result" | "detail"

const EMPTY_DOC = {
  doc_number: "", project: "", modul: "", aplikasi: "", type: "New Modul",
  request_by: "", pic: "Christian Kevin",
  date_request: new Date().toISOString().split("T")[0],
  background: "", current_conditions: "", product_perspective: "",
  product_scope: "", global_flow: "", epics: [] as Epic[], status: "draft"
}

// ── Format dokumen jadi teks polos — dipakai buat "Copy Semua" DAN
// buat auto-learn (disimpan sebagai referensi AI baru tiap dokumen disimpan) ──
function formatDocAsText(doc: DocReq | (typeof EMPTY_DOC & { doc_number?: string })): string {
  return `DOCUMENT REQUIREMENT\n${doc.doc_number || ""} – ${doc.modul}\n\nProject: ${doc.project}\nModul: ${doc.modul}\nAplikasi: ${doc.aplikasi || "-"}\nType: ${doc.type}\nRequest By: ${doc.request_by}\nPIC: ${doc.pic}\nDate: ${doc.date_request}\n\nBACKGROUND\n${doc.background}\n\nCURRENT CONDITIONS\n${doc.current_conditions}\n\nPRODUCT PERSPECTIVE\n${doc.product_perspective}\n\nPRODUCT SCOPE\n${doc.product_scope}\n\nGLOBAL FLOW PROCESS\n${doc.global_flow}\n\nUSER REQUIREMENT\n${doc.epics?.map((e, i) => `\n${i + 1}. ${e.code}\nUser Story: ${e.userStory}\nAcceptance Criteria:\n${e.acceptanceCriteria}`).join("\n")}`
}

// ── AI Call — via internal API route (key aman di server) ────
async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userPrompt }),
  })
  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || "AI call failed")
  }
  const data = await response.json()
  return data.text || ""
}

// ── Main ──────────────────────────────────────────────────────
export default function DocRequirementPage() {
  const [docs, setDocs]           = useState<DocReq[]>([])
  const [refDocs, setRefDocs]     = useState<RefDoc[]>([])
  const [view, setView]           = useState<View>("list")
  const [selected, setSelected]   = useState<DocReq | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_DOC })
  const [context, setContext]     = useState("")   // input konteks dari user
  const [numEpics, setNumEpics]   = useState(3)    // berapa epic yang mau di-generate
  const [isGenerating, setIsGenerating] = useState(false)
  const [genStep, setGenStep]     = useState("")   // status teks saat generating
  const [saving, setSaving]       = useState(false)
  const [copied, setCopied]       = useState<string | null>(null)
  const [showRefDocs, setShowRefDocs] = useState(false)
  const [uploadingDoc, setUploadingDoc] = useState(false)
  const [uploadAplikasi, setUploadAplikasi] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    const [{ data: d }, { data: r }] = await Promise.all([
      supabase.from("doc_requirements").select("*").order("created_at", { ascending: false }),
      supabase.from("ai_context").select("*").eq("category", "reference_doc").order("created_at", { ascending: false }),
    ])
    if (d) setDocs(d as DocReq[])
    if (r) setRefDocs(r as RefDoc[])
  }
  useEffect(() => { load() }, [])

  // ── Build system prompt dari referensi dokumen ────────────────
  const buildSystemPrompt = () => {
    const basePrompt = `Kamu adalah AI assistant yang membantu System Support Engineer membuat dokumen requirement teknis untuk sistem SFA (Sales Force Automation).

GAYA BAHASA:
- Tulis dalam bahasa Indonesia yang NATURAL, kayak orang nulis beneran — bukan kaku/textbook/formal berlebihan
- Boleh pakai kata sambung sehari-hari (jadi, karena, akibatnya, dsb), asal tetap jelas dan enak dibaca buat dokumen kerja
- Hindari bahasa robotik atau template AI yang keliatan banget ("dalam rangka", "adapun", dsb)
- Gunakan terminologi yang konsisten: Matrix (web admin), SFA Mobile/HHT (aplikasi mobile salesman), EDI (extract data)

STRUKTUR TIAP SECTION (WAJIB DIIKUTI, JANGAN DICAMPUR):
- "background": CUMA pengenalan singkat aplikasi/modul ini apa dan buat apa, terus disinggung sedikit aja ada masalah di situ (1 kalimat penutup cukup) — JANGAN jelasin masalahnya detail di sini, itu bagian "current_conditions".
- "current_conditions": WAJIB mulai persis dengan kalimat "Saat ini, ..." — setelah itu isinya MURNI penjelasan masalah/kondisi yang terjadi sekarang, sedetail mungkin. JANGAN nyebut solusi atau improvement sama sekali di section ini.
- "product_perspective": WAJIB mulai persis dengan kalimat "Untuk mengatasi masalah tersebut, ..." — setelah itu baru jelasin solusi/improvement apa yang akan dibuat. JANGAN ulang lagi masalahnya, langsung ke solusinya.

FORMAT LAIN:
- Format User Story: "Sebagai seorang [Admin/Sales] Saya ingin [fitur] Sehingga [manfaat]"
- Format Epic code: S26-XXX-[SYSTEM]_[FiturName] (contoh: S26-XXX-SFA_TasklistItem, S26-XXX-MTX_Setting)
- Output harus langsung isi konten tanpa kalimat pembuka
- Acceptance Criteria harus spesifik, testable, dalam bullet points${form.aplikasi ? `
- Dokumen ini KHUSUS untuk aplikasi ${form.aplikasi} — fokuskan istilah, modul, dan flow ke aplikasi ini` : ""}`

    if (refDocs.length === 0) return basePrompt

    // Filter utama: Aplikasi yang dipilih user (Matrix/SFA/FiCom/dst) — jauh
    // lebih akurat daripada nebak dari kemiripan nama project/modul, karena
    // eksplisit ditandai user sendiri. Kalau belum ada referensi ber-tag
    // aplikasi yang sama (misal masih dokumen lama sebelum fitur ini ada),
    // fallback ke seluruh pool biar tetap ada referensi yang dipakai.
    const pool = form.aplikasi
      ? refDocs.filter(r => r.aplikasi === form.aplikasi)
      : refDocs
    const candidates = pool.length > 0 ? pool : refDocs

    // Di dalam pool itu, urutkan lagi berdasarkan kemiripan nama project/modul.
    const q = `${form.project} ${form.modul}`.toLowerCase()
    const scored = candidates.map(r => ({
      r, score: q.split(/\s+/).filter(Boolean).some(w => w.length > 2 && r.name.toLowerCase().includes(w)) ? 1 : 0,
    })).sort((a, b) => b.score - a.score)
    const picked = scored.slice(0, 5).map(s => s.r)

    const refSection = `

DOKUMEN REFERENSI (pelajari gaya penulisan, format, dan terminologi dari dokumen-dokumen ini — termasuk dokumen yang sudah pernah kamu/tim buat sebelumnya di aplikasi ini):
${picked.map(r => `
--- ${r.name} ---
${r.content.slice(0, 1500)}
---`).join("\n")}`

    return basePrompt + refSection
  }

  // ── GENERATE SEMUA DALAM 1 REQUEST (hemat token) ────────────
  const generateAll = async () => {
    if (!form.project || !form.modul || !form.aplikasi || !context.trim()) return

    setIsGenerating(true)
    setView("result")
    setGenStep("\u2728 AI sedang menulis dokumen lengkap...")

    const systemPrompt = buildSystemPrompt()
    const numE = numEpics

    const prompt = `Project: ${form.project}
Modul: ${form.modul}
Type: ${form.type}
Request By: ${form.request_by}

KONTEKS KEBUTUHAN:
${context}

Buatkan dokumen requirement lengkap dalam format JSON. Balas HANYA dengan JSON valid:

{
  "background": "2-3 kalimat pengenalan aplikasi/modul ini + singgung sedikit ada masalah (JANGAN jelasin masalahnya detail di sini)",
  "current_conditions": "WAJIB diawali persis 'Saat ini, ' lalu penjelasan masalah/kondisi sekarang aja, sedetail mungkin, TANPA nyebut solusi",
  "product_perspective": "WAJIB diawali persis 'Untuk mengatasi masalah tersebut, ' lalu solusi/improvement-nya apa",
  "product_scope": "- poin 1\\n- poin 2\\n- poin 3",
  "global_flow": "paragraf alur proses end-to-end min 4 kalimat",
  "epics": [
    {
      "code": "S26-XXX-MTX_FiturName",
      "userStory": "Sebagai seorang Admin Saya ingin fitur Sehingga manfaat",
      "acceptanceCriteria": "- Kriteria 1\\n- Kriteria 2\\n- Kriteria 3"
    }
  ]
}

Buat ${numE} epic. Bahasa Indonesia yang natural kayak orang nulis beneran, jangan kaku/formal berlebihan. MTX untuk web admin Matrix, SFA untuk mobile salesman.`

    try {
      const raw = await callAI(systemPrompt, prompt)
      const clean = raw.replace(/\`\`\`json|\`\`\`/g, "").trim()
      const parsed = JSON.parse(clean)
      const epics: Epic[] = (parsed.epics || []).map((e: Omit<Epic, "id">) => ({
        ...e, id: crypto.randomUUID()
      }))
      setForm(f => ({
        ...f,
        background: parsed.background || "",
        current_conditions: parsed.current_conditions || "",
        product_perspective: parsed.product_perspective || "",
        product_scope: parsed.product_scope || "",
        global_flow: parsed.global_flow || "",
        epics,
      }))
      setGenStep("\u2705 Selesai!")
    } catch {
      setGenStep("\u274c Gagal parse hasil AI. Coba generate ulang.")
    }

    setIsGenerating(false)
  }

  // ── Upload referensi dokumen (multiple files) ────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setUploadingDoc(true)

    let successCount = 0
    let failCount = 0

    for (const file of files) {
      await new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = async (ev) => {
          try {
            const text = ev.target?.result as string
            await supabase.from("ai_context").insert([{
              name: file.name.replace(/\.[^.]+$/, ""),
              description: "Uploaded reference document",
              content: text.slice(0, 8000),
              category: "reference_doc",
              aplikasi: uploadAplikasi || null,
            }])
            successCount++
          } catch {
            failCount++
          }
          resolve()
        }
        reader.onerror = () => { failCount++; resolve() }
        reader.readAsText(file)
      })
    }

    await load()
    setUploadingDoc(false)
    if (failCount === 0) {
      alert(`✅ ${successCount} file berhasil diupload sebagai referensi AI!`)
    } else {
      alert(`✅ ${successCount} berhasil, ❌ ${failCount} gagal.`)
    }
    e.target.value = ""
  }

  // ── Save ──────────────────────────────────────────────────────
  // Setiap dokumen yang disimpan otomatis JUGA ditambahkan sebagai referensi
  // AI baru (ai_context, category reference_doc) — jadi makin banyak dokumen
  // yang dibuat di aplikasi ini, makin banyak juga "contoh gaya" yang AI
  // pelajari buat generate dokumen berikutnya. Nggak perlu upload manual lagi.
  const saveDoc = async () => {
    if (!form.project || !form.modul) return
    setSaving(true)
    await supabase.from("doc_requirements").insert([{ ...form, updated_at: new Date().toISOString() }])
    await supabase.from("ai_context").insert([{
      name: `${form.modul}${form.doc_number ? ` (${form.doc_number})` : ""}`,
      description: "Auto-learned dari dokumen yang kamu simpan",
      content: formatDocAsText(form).slice(0, 8000),
      category: "reference_doc",
      aplikasi: form.aplikasi || null,
    }])
    setSaving(false)
    setView("list")
    setContext("")
    setForm({ ...EMPTY_DOC })
    load()
  }

  const delDoc = async (id: string) => {
    if (!confirm("Hapus dokumen ini?")) return
    await supabase.from("doc_requirements").delete().eq("id", id)
    load()
  }

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  // ──────────────────────────────────────────────────────────────
  // VIEWS
  // ──────────────────────────────────────────────────────────────

  // ── LIST ──────────────────────────────────────────────────────
  if (view === "list") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="animate-fade">

      <MotivationBanner page="docreq" />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "18px", fontWeight: 800 }}>Doc Requirement Generator</h2>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>Kasih konteks → AI generate dokumen lengkap ✨</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-ghost" onClick={() => setShowRefDocs(!showRefDocs)}>
            <BookOpen size={15} /> Referensi AI ({refDocs.length})
          </button>
          <button className="btn btn-primary" onClick={() => { setForm({ ...EMPTY_DOC }); setContext(""); setView("generate") }}>
            <Plus size={16} /> Buat Dokumen
          </button>
        </div>
      </div>

      {/* Referensi dokumen panel */}
      {showRefDocs && (
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Sparkles size={16} color="var(--accent)" /> Referensi Dokumen AI
          </div>
          <p style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "16px", lineHeight: 1.6 }}>
            Upload dokumen requirement lama kamu di sini. AI akan mempelajari gaya penulisan, format, dan terminologi dari dokumen-dokumen tersebut sehingga output-nya lebih sesuai dengan gaya dokumenmu.
            <br /><strong>Format yang didukung: .txt</strong> — untuk .docx, copy paste isi dokumennya ke file .txt dulu.
          </p>

          {/* Upload button */}
          <div style={{ marginBottom: "16px", display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <select className="input" value={uploadAplikasi} onChange={e => setUploadAplikasi(e.target.value)} style={{ width: "auto", minWidth: "160px" }}>
              <option value="">Aplikasi (opsional)</option>
              {APLIKASI_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <input ref={fileInputRef} type="file" accept=".txt" multiple style={{ display: "none" }} onChange={handleFileUpload} />
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadingDoc}>
              {uploadingDoc ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Uploading...</> : <><Upload size={14} /> Upload Dokumen Referensi (.txt) — bisa pilih banyak</>}
            </button>
          </div>
          <p style={{ fontSize: "11px", color: "var(--text3)", marginTop: "-10px", marginBottom: "16px" }}>
            Tandai Aplikasi-nya (Matrix/SFA/FiCom/dst) biar AI cuma pakai referensi yang relevan waktu generate dokumen aplikasi yang sama.
          </p>

          {/* List ref docs */}
          {refDocs.length === 0 ? (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text3)", fontSize: "12px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
              Belum ada dokumen referensi. Upload dokumen requirement lama kamu untuk meningkatkan kualitas output AI.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {refDocs.map(doc => (
                <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px", background: "var(--bg)", borderRadius: "var(--radius-sm)" }}>
                  <FileText size={16} color="var(--accent)" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{doc.name}</span>
                      <span style={{
                        fontSize: "10px", fontWeight: 700, padding: "1px 8px", borderRadius: "99px",
                        background: doc.description?.startsWith("Auto-learned") ? "var(--accent-muted)" : "var(--surface3)",
                        color: doc.description?.startsWith("Auto-learned") ? "var(--accent)" : "var(--text3)",
                      }}>
                        {doc.description?.startsWith("Auto-learned") ? "✨ Auto" : "Upload"}
                      </span>
                      {doc.aplikasi && (
                        <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 8px", borderRadius: "99px", background: "var(--surface3)", color: "var(--text2)" }}>
                          {doc.aplikasi}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text3)" }}>{doc.content.length.toLocaleString()} karakter · {new Date(doc.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                  <button onClick={() => supabase.from("ai_context").delete().eq("id", doc.id).then(() => load())}
                    style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "4px" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Doc list */}
      {docs.length === 0 ? (
        <div className="card" style={{ padding: "60px", textAlign: "center" }}>
          <FileText size={40} color="var(--border2)" style={{ margin: "0 auto 12px", display: "block" }} />
          <p style={{ color: "var(--text3)", fontWeight: 600, fontSize: "14px" }}>Belum ada dokumen requirement</p>
          <p style={{ color: "var(--text3)", fontSize: "12px", marginTop: "6px" }}>Klik &ldquo;Buat Dokumen&rdquo; dan kasih konteks singkat → AI akan generate semuanya.</p>
          <button className="btn btn-primary" style={{ marginTop: "16px" }} onClick={() => { setForm({ ...EMPTY_DOC }); setContext(""); setView("generate") }}>
            <Plus size={16} /> Buat Dokumen Pertama
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {docs.map(doc => (
            <div key={doc.id} className="card card-hover" style={{ padding: "16px 20px", cursor: "pointer" }} onClick={() => { setSelected(doc); setView("detail") }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 700, fontSize: "15px" }}>{doc.modul}</span>
                    {doc.doc_number && <span className="mono" style={{ fontSize: "11px", color: "var(--accent)", background: "var(--accent-muted)", padding: "2px 8px", borderRadius: "99px" }}>{doc.doc_number}</span>}
                    {doc.aplikasi && <span style={{ fontSize: "11px", color: "var(--text3)", background: "var(--surface3)", padding: "2px 8px", borderRadius: "99px" }}>{doc.aplikasi}</span>}
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--text3)" }}>{doc.project} · {doc.request_by} · {new Date(doc.date_request).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</div>
                  {doc.background && <p style={{ fontSize: "12px", color: "var(--text2)", marginTop: "6px", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{doc.background}</p>}
                  <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "6px" }}>{doc.epics?.length || 0} EPICs</div>
                </div>
                <div style={{ display: "flex", gap: "6px", marginLeft: "12px" }}>
                  <button className="btn btn-danger" style={{ padding: "6px 10px" }} onClick={e => { e.stopPropagation(); delDoc(doc.id) }}><Trash2 size={13} /></button>
                  <ChevronRight size={16} color="var(--text3)" style={{ marginTop: "6px" }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── GENERATE FORM ─────────────────────────────────────────────
  if (view === "generate") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button className="btn btn-ghost" onClick={() => setView("list")}><ChevronLeft size={16} /> Kembali</button>
        <span style={{ fontWeight: 800, fontSize: "16px" }}>Buat Dokumen Requirement Baru</span>
      </div>

      {/* Step 1: Header info */}
      <div className="card" style={{ padding: "20px" }}>
        <div style={{ fontWeight: 700, marginBottom: "16px", fontSize: "13px" }}>📋 Info Dokumen</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <div>
            <div className="label" style={{ marginBottom: "6px" }}>No. Dokumen</div>
            <input className="input mono" placeholder="D26-XXX-SFA_..." value={form.doc_number} onChange={e => setForm(f => ({ ...f, doc_number: e.target.value }))} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: "6px" }}>Project *</div>
            <input className="input" placeholder="SFA Gamifikasi" value={form.project} onChange={e => setForm(f => ({ ...f, project: e.target.value }))} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: "6px" }}>Modul *</div>
            <input className="input" placeholder="Tasklist Item" value={form.modul} onChange={e => setForm(f => ({ ...f, modul: e.target.value }))} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: "6px" }}>Aplikasi *</div>
            <select className="input" value={form.aplikasi} onChange={e => setForm(f => ({ ...f, aplikasi: e.target.value }))}>
              <option value="">Pilih Aplikasi...</option>
              {APLIKASI_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div>
            <div className="label" style={{ marginBottom: "6px" }}>Type</div>
            <select className="input" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option>New Modul</option>
              <option>Update Modul</option>
              <option>Bug Fix</option>
              <option>Enhancement</option>
            </select>
          </div>
          <div>
            <div className="label" style={{ marginBottom: "6px" }}>Request By</div>
            <input className="input" placeholder="Team Philippines" value={form.request_by} onChange={e => setForm(f => ({ ...f, request_by: e.target.value }))} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: "6px" }}>PIC Created</div>
            <input className="input" value={form.pic} onChange={e => setForm(f => ({ ...f, pic: e.target.value }))} />
          </div>
          <div>
            <div className="label" style={{ marginBottom: "6px" }}>Date Request</div>
            <input className="input" type="date" value={form.date_request} onChange={e => setForm(f => ({ ...f, date_request: e.target.value }))} />
          </div>
        </div>
      </div>

      {/* Step 2: Context input */}
      <div className="card" style={{ padding: "20px" }}>
        <div style={{ fontWeight: 700, marginBottom: "8px", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Zap size={15} color="var(--accent)" /> Ceritakan Kebutuhan Kamu
        </div>
        <p style={{ fontSize: "12px", color: "var(--text3)", marginBottom: "12px", lineHeight: 1.6 }}>
          Tulis konteks kebutuhan secara bebas — tidak perlu formal. AI akan mengubahnya menjadi dokumen requirement yang lengkap dan terstruktur. Semakin detail konteksmu, semakin akurat hasilnya.
        </p>
        <textarea
          className="input"
          rows={8}
          placeholder={`Contoh:
"Saya perlu membuat modul baru untuk SFA Philippines. Kebutuhannya adalah untuk survey dominasi display produk di toko. Salesman perlu bisa input berapa banyak rak yang dimiliki per brand (SOS - Share of Shelf). Admin setting di Matrix, data dikirim ke HHT salesman. Ada 2 tipe survey: Detail (per brand) dan Survey (pertanyaan umum). Data harus bisa di-extract melalui EDI."`}
          value={context}
          onChange={e => setContext(e.target.value)}
        />
      </div>

      {/* Step 3: EPIC count */}
      <div className="card" style={{ padding: "16px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "13px" }}>⚡ Jumlah EPIC</div>
            <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "2px" }}>Berapa banyak EPIC yang ingin di-generate?</div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {[2, 3, 4, 5, 6, 8].map(n => (
              <button key={n} onClick={() => setNumEpics(n)}
                style={{ width: "36px", height: "36px", borderRadius: "8px", border: "1.5px solid", cursor: "pointer", fontSize: "13px", fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif", transition: "all 0.15s",
                  borderColor: numEpics === n ? "var(--accent)" : "var(--border)",
                  background: numEpics === n ? "var(--accent)" : "transparent",
                  color: numEpics === n ? "white" : "var(--text3)" }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI info */}
      {refDocs.length > 0 && (
        <div style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-light)", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "12px", color: "var(--accent)", display: "flex", gap: "8px", alignItems: "center" }}>
          <Sparkles size={14} />
          <span>AI akan belajar dari <strong>{refDocs.length} dokumen referensi</strong> yang sudah kamu upload untuk menyamakan gaya penulisan.</span>
        </div>
      )}

      {refDocs.length === 0 && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid #fde68a", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "12px", color: "var(--warning)", display: "flex", gap: "8px", alignItems: "flex-start" }}>
          <span>💡</span>
          <span>Belum ada dokumen referensi. Upload dokumen requirement lama kamu di halaman list (tombol &ldquo;Referensi AI&rdquo;) untuk hasil yang lebih akurat sesuai gaya penulisanmu.</span>
        </div>
      )}

      {/* Generate button */}
      <button
        className="btn btn-primary"
        style={{ padding: "14px 24px", fontSize: "15px", justifyContent: "center", borderRadius: "var(--radius)" }}
        onClick={generateAll}
        disabled={!form.project || !form.modul || !form.aplikasi || !context.trim()}>
        <Sparkles size={18} /> Generate Dokumen Lengkap dengan AI
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── RESULT / EDIT ─────────────────────────────────────────────
  if (view === "result") return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={() => setView("generate")} disabled={isGenerating}><ChevronLeft size={16} /> Kembali</button>
        <span style={{ fontWeight: 800, fontSize: "16px", flex: 1 }}>Review & Edit Hasil AI</span>
        <button className="btn btn-primary" onClick={saveDoc} disabled={saving || isGenerating}>
          {saving ? "Menyimpan..." : "💾 Simpan Dokumen"}
        </button>
      </div>

      {/* Generating progress */}
      {isGenerating && (
        <div className="card" style={{ padding: "20px", background: "var(--accent-muted)", border: "1px solid var(--accent-light)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <RefreshCw size={20} color="var(--accent)" style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: "var(--accent)" }}>AI sedang menulis dokumen...</div>
              <div style={{ fontSize: "12px", color: "var(--accent2)", marginTop: "2px" }}>{genStep}</div>
            </div>
          </div>
          <div style={{ marginTop: "12px", height: "4px", background: "var(--accent-light)", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", background: "var(--accent)", borderRadius: "99px", width: "60%", animation: "progress 2s ease-in-out infinite alternate" }} />
          </div>
          <style>{`@keyframes progress { from { width: 20%; } to { width: 90%; } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Description sections - editable */}
      {[
        { key: "background", label: "Background" },
        { key: "current_conditions", label: "Current Conditions" },
        { key: "product_perspective", label: "Product Perspective" },
        { key: "product_scope", label: "Product Scope" },
        { key: "global_flow", label: "Global Flow Process" },
      ].map(({ key, label }) => (
        <div key={key} className="card" style={{ padding: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ fontWeight: 700, fontSize: "13px" }}>{label}</div>
            <div style={{ display: "flex", gap: "6px" }}>
              {(form as unknown as Record<string, string>)[key] && (
                <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: "11px" }}
                  onClick={() => copyText((form as unknown as Record<string, string>)[key], key)}>
                  {copied === key ? <Check size={12} /> : <Copy size={12} />}
                  {copied === key ? "Copied!" : "Copy"}
                </button>
              )}
            </div>
          </div>
          {(form as unknown as Record<string, string>)[key] ? (
            <textarea className="input" rows={5} value={(form as unknown as Record<string, string>)[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              style={{ lineHeight: 1.7, fontSize: "13px" }} />
          ) : (
            <div style={{ height: "80px", background: "var(--bg)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--text3)", fontSize: "12px" }}>
                <RefreshCw size={14} style={{ animation: isGenerating ? "spin 1s linear infinite" : "none" }} />
                {isGenerating ? "Sedang ditulis..." : "Belum ada konten"}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* EPICs */}
      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px" }}>⚡ EPICs & User Stories ({form.epics.length})</div>
          <button className="btn btn-secondary" style={{ fontSize: "12px" }}
            onClick={() => setForm(f => ({ ...f, epics: [...f.epics, { id: crypto.randomUUID(), code: "", userStory: "", acceptanceCriteria: "" }] }))}>
            <Plus size={14} /> Tambah EPIC
          </button>
        </div>

        {form.epics.length === 0 && isGenerating ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text3)", fontSize: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Sedang generate EPICs...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {form.epics.map((epic, i) => (
              <div key={epic.id} style={{ padding: "16px", background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
                  <div className="label">EPIC #{i + 1}</div>
                  <button onClick={() => setForm(f => ({ ...f, epics: f.epics.filter((_, idx) => idx !== i) }))}
                    style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "2px" }}>
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <input className="input mono" placeholder="S26-XXX-SFA_FiturName" value={epic.code}
                    onChange={e => setForm(f => ({ ...f, epics: f.epics.map((ep, idx) => idx === i ? { ...ep, code: e.target.value } : ep) }))} />
                  <textarea className="input" rows={2} placeholder="User Story..." value={epic.userStory}
                    onChange={e => setForm(f => ({ ...f, epics: f.epics.map((ep, idx) => idx === i ? { ...ep, userStory: e.target.value } : ep) }))} />
                  <textarea className="input" rows={3} placeholder="Acceptance Criteria..." value={epic.acceptanceCriteria}
                    onChange={e => setForm(f => ({ ...f, epics: f.epics.map((ep, idx) => idx === i ? { ...ep, acceptanceCriteria: e.target.value } : ep) }))} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button className="btn btn-primary" style={{ padding: "13px 24px", justifyContent: "center" }} onClick={saveDoc} disabled={saving || isGenerating}>
        {saving ? "Menyimpan..." : "💾 Simpan Dokumen"}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── DETAIL VIEW ───────────────────────────────────────────────
  if (view === "detail" && selected) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="animate-fade">
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={() => setView("list")}><ChevronLeft size={16} /> Kembali</button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: "18px", fontWeight: 800 }}>{selected.modul}</h2>
          <p style={{ fontSize: "12px", color: "var(--text3)" }}>{selected.project} {selected.doc_number && `· ${selected.doc_number}`}</p>
        </div>
        <button className="btn btn-primary" onClick={() => copyText(formatDocAsText(selected), "all")}>
          {copied === "all" ? <><Check size={15} /> Tersalin!</> : <><Copy size={15} /> Copy Semua</>}
        </button>
      </div>

      {/* Header table */}
      <div className="card" style={{ padding: "20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "14px" }}>
          {[{ l: "Project", v: selected.project }, { l: "Modul", v: selected.modul }, { l: "Aplikasi", v: selected.aplikasi }, { l: "Type", v: selected.type }, { l: "Request By", v: selected.request_by }, { l: "PIC", v: selected.pic }, { l: "Date", v: new Date(selected.date_request).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) }].map(({ l, v }) => (
            <div key={l}><div className="label" style={{ marginBottom: "3px" }}>{l}</div><div style={{ fontSize: "13px", fontWeight: 600 }}>{v || "-"}</div></div>
          ))}
        </div>
      </div>

      {/* Sections */}
      {[{ k: "background", l: "Background" }, { k: "current_conditions", l: "Current Conditions" }, { k: "product_perspective", l: "Product Perspective" }, { k: "product_scope", l: "Product Scope" }, { k: "global_flow", l: "Global Flow Process" }].map(({ k, l }) => {
        const val = (selected as unknown as Record<string, string>)[k]
        if (!val) return null
        return (
          <div key={k} className="card" style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <div style={{ fontWeight: 700, fontSize: "13px" }}>{l}</div>
              <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: "11px" }} onClick={() => copyText(val, k)}>
                {copied === k ? <Check size={12} /> : <Copy size={12} />} {copied === k ? "Copied!" : "Copy"}
              </button>
            </div>
            <p style={{ fontSize: "13px", lineHeight: 1.8, color: "var(--text2)", whiteSpace: "pre-wrap" }}>{val}</p>
          </div>
        )
      })}

      {/* EPICs table */}
      {(selected.epics?.length || 0) > 0 && (
        <div className="card" style={{ padding: "20px" }}>
          <div style={{ fontWeight: 700, fontSize: "13px", marginBottom: "16px" }}>User Requirement — {selected.epics.length} EPICs</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border)", background: "var(--bg)" }}>
                  {["Epic", "User Stories", "Acceptance Criteria"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "var(--text3)", fontSize: "11px", letterSpacing: "0.05em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selected.epics.map((epic) => (
                  <tr key={epic.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px", verticalAlign: "top" }}>
                      <span className="mono" style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600, whiteSpace: "nowrap", background: "var(--accent-muted)", padding: "3px 8px", borderRadius: "6px", display: "inline-block" }}>{epic.code}</span>
                    </td>
                    <td style={{ padding: "12px", verticalAlign: "top", lineHeight: 1.7, maxWidth: "280px" }}>{epic.userStory}</td>
                    <td style={{ padding: "12px", verticalAlign: "top", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{epic.acceptanceCriteria}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  return null
}