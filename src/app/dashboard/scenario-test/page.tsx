"use client"

import { useState, useRef, useCallback, useEffect, Fragment } from "react"
import {
  Plus, Trash2, Download, Image as ImageIcon,
  ChevronUp, ChevronDown, X, ClipboardPaste, CheckCircle2,
  AlertCircle, Eye, EyeOff, Loader2, ArrowLeft,
  FolderOpen, FileText, Clock, CheckCircle, XCircle,
  Edit3, Save, RefreshCw, Layers, MessageSquare, Copy, Check
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"

// ── Types ────────────────────────────────────────────────────
interface PastedImage { id: string; dataUrl: string; label: string }

interface SubSection {
  id: string
  deskripsi: string
  tanggal: string
  status: "OK" | "NOT OK" | "IN PROGRESS" | ""
  images: PastedImage[]
}

interface TestEntry {
  id: string; no: number; object: string; keterangan: string
  tanggalTest: string; status: "OK"|"NOT OK"|"IN PROGRESS"|""
  images: PastedImage[]; subKeterangan: string
  subSections: SubSection[]   // ← nested sub-sections
}

interface FormHeader {
  keterangan: string; aplikasi: string; modul: string
  createdBy: string; testedBy: string; targetFinish: string; judulDokumen: string
}

interface ScenarioDoc {
  id: string; judul_dokumen: string; keterangan: string; aplikasi: string
  modul: string; created_by: string; tested_by: string; target_finish: string
  entries: TestEntry[]; doc_status: "OK"|"NOT OK"|"PARTIAL"|"DRAFT"
  created_at: string; updated_at: string
}

// ── Helpers ──────────────────────────────────────────────────
const EMPTY_HEADER: FormHeader = {
  keterangan:"Menu Acting as in PHI", aplikasi:"WFC", modul:"Acting as",
  createdBy:"Kevin", testedBy:"Kevin", targetFinish:"", judulDokumen:""
}

const HEADER_FIELDS: [string, keyof FormHeader, string][] = [
  ["Keterangan","keterangan",""],["Aplikasi","aplikasi","WFC"],["Modul","modul",""],
  ["Created By","createdBy","Kevin"],["Tested By","testedBy","Kevin"],["Target Finish","targetFinish","dd/mm/yyyy"]
]

const newEntry = (no: number): TestEntry => ({
  id: crypto.randomUUID(), no, object:"", keterangan:"",
  tanggalTest: new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric"}),
  status:"", images:[], subKeterangan:"", subSections:[]
})

const newSubSection = (): SubSection => ({
  id: crypto.randomUUID(), deskripsi: "",
  tanggal: new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }),
  status: "", images: []
})

function calcDocStatus(entries: TestEntry[]): ScenarioDoc["doc_status"] {
  const statuses = entries.map(e => e.status).filter(Boolean)
  if (!statuses.length) return "DRAFT"
  if (statuses.every(s => s === "OK")) return "OK"
  if (statuses.some(s => s === "NOT OK")) return "NOT OK"
  return "PARTIAL"
}

const STATUS_CFG = {
  "OK":      { label:"OK",      color:"var(--success)", bg:"var(--success-bg)", Icon: CheckCircle },
  "NOT OK":  { label:"NOT OK",  color:"var(--danger)",  bg:"var(--danger-bg)",  Icon: XCircle    },
  "PARTIAL": { label:"PARTIAL", color:"var(--warning)", bg:"var(--warning-bg)", Icon: Clock      },
  "DRAFT":   { label:"DRAFT",   color:"var(--text3)",   bg:"var(--surface3)",   Icon: FileText   },
} as const

const ENTRY_STATUS_COLOR: Record<string,string> = {
  "OK":"var(--success)","NOT OK":"var(--danger)","IN PROGRESS":"var(--warning)","":"var(--text3)"
}
const ENTRY_STATUS_BG: Record<string,string> = {
  "OK":"var(--success-bg)","NOT OK":"var(--danger-bg)","IN PROGRESS":"var(--warning-bg)","":"var(--surface3)"
}

// ── Main ──────────────────────────────────────────────────────
export default function ScenarioTestPage() {
  const [view, setView]             = useState<"list"|"form">("list")
  const [docs, setDocs]             = useState<ScenarioDoc[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [editingDoc, setEditingDoc] = useState<ScenarioDoc|null>(null)
  const [header, setHeader]         = useState<FormHeader>({...EMPTY_HEADER})
  const [entries, setEntries]       = useState<TestEntry[]>([newEntry(1)])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [preview, setPreview]       = useState(false)
  const [showPesanModal, setShowPesanModal] = useState(false)
  const [pasteTarget, setPasteTarget] = useState<{entryId:string;subId?:string}|null>(null)
  const [toast, setToast]           = useState<{msg:string;type:"ok"|"err"}|null>(null)

  const showToast = (msg: string, type:"ok"|"err"="ok") => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3000)
  }

  const loadDocs = async () => {
    setLoadingList(true)
    const {data} = await supabase.from("scenario_tests").select("*").order("updated_at",{ascending:false})
    if (data) setDocs(data as ScenarioDoc[])
    setLoadingList(false)
  }
  useEffect(()=>{loadDocs()},[])

  // Paste
  const handlePaste = useCallback((e: ClipboardEvent, entryId: string, subId?: string) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault()
        const file = item.getAsFile()
        if (!file) return
        const reader = new FileReader()
        reader.onload = ev => {
          const dataUrl = ev.target?.result as string
          const newImg: PastedImage = { id: crypto.randomUUID(), dataUrl, label: "" }
          if (subId) {
            // Paste to subsection
            setEntries(prev => prev.map(en => en.id !== entryId ? en : {
              ...en, subSections: en.subSections.map(ss => ss.id !== subId ? ss : {
                ...ss, images: [...ss.images, newImg]
              })
            }))
          } else {
            // Paste to main entry
            setEntries(prev => prev.map(en => en.id !== entryId ? en : {
              ...en, images:[...en.images, newImg]
            }))
          }
          showToast("Gambar berhasil ditempel!")
        }
        reader.readAsDataURL(file); return
      }
    }
    showToast("Tidak ada gambar di clipboard.","err")
  },[])

  useEffect(()=>{
    if (!pasteTarget) return
    const h = (e:ClipboardEvent)=>handlePaste(e,pasteTarget.entryId,pasteTarget.subId)
    window.addEventListener("paste",h)
    return ()=>window.removeEventListener("paste",h)
  },[pasteTarget,handlePaste])

  const openNew = () => {
    setEditingDoc(null); setHeader({...EMPTY_HEADER})
    setEntries([newEntry(1)]); setPreview(false); setPasteTarget(null); setView("form")
  }

  const openEdit = (doc: ScenarioDoc) => {
    setEditingDoc(doc)
    setHeader({ judulDokumen:doc.judul_dokumen, keterangan:doc.keterangan||"",
      aplikasi:doc.aplikasi||"", modul:doc.modul||"",
      createdBy:doc.created_by||"", testedBy:doc.tested_by||"", targetFinish:doc.target_finish||"" })
    setEntries(doc.entries?.length ? doc.entries : [newEntry(1)])
    setPreview(false); setPasteTarget(null); setView("form")
  }

  const deleteDoc = async (id:string) => {
    if (!confirm("Hapus dokumen ini?")) return
    await supabase.from("scenario_tests").delete().eq("id",id)
    setDocs(prev=>prev.filter(d=>d.id!==id)); showToast("Dokumen dihapus")
  }

  const saveDoc = async () => {
    if (!header.judulDokumen.trim()) { showToast("Judul dokumen wajib diisi!","err"); return }
    setSaving(true)
    try {
      const payload = {
        judul_dokumen:header.judulDokumen.trim(), keterangan:header.keterangan,
        aplikasi:header.aplikasi, modul:header.modul, created_by:header.createdBy,
        tested_by:header.testedBy, target_finish:header.targetFinish,
        entries, doc_status:calcDocStatus(entries), updated_at:new Date().toISOString()
      }
      if (editingDoc) {
        await supabase.from("scenario_tests").update(payload).eq("id",editingDoc.id)
        showToast("Dokumen diperbarui!")
      } else {
        const {data} = await supabase.from("scenario_tests").insert(payload).select().single()
        if (data) setEditingDoc(data as ScenarioDoc)
        showToast("Dokumen disimpan!")
      }
      await loadDocs()
    } catch { showToast("Gagal menyimpan","err") }
    finally { setSaving(false) }
  }

  const generateXLS = async () => {
    if (!header.judulDokumen.trim()) { showToast("Judul dokumen wajib diisi!", "err"); return }
    setGenerating(true)
    try {
      const res = await fetch("/api/generate-xls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header, entries }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Generate failed")
      }
      const blob  = await res.blob()
      const url   = URL.createObjectURL(blob)
      const a     = document.createElement("a")
      a.href      = url
      a.download  = `${header.judulDokumen.trim().replace(/[\/:*?"<>|]/g, "_")}.xlsx`
      a.click()
      URL.revokeObjectURL(url)
      showToast("File berhasil diunduh!")
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : "Gagal generate", "err")
    } finally {
      setGenerating(false)
    }
  }


  const addEntry = () => {
    const no = entries.length ? Math.max(...entries.map(e=>e.no))+1 : 1
    setEntries(prev=>[...prev,newEntry(no)])
  }
  const removeEntry = (id:string) =>
    setEntries(prev=>prev.filter(e=>e.id!==id).map((e,i)=>({...e,no:i+1})))
  const moveEntry = (id:string, dir:"up"|"down") =>
    setEntries(prev=>{
      const idx=prev.findIndex(e=>e.id===id)
      if(dir==="up"&&idx===0||dir==="down"&&idx===prev.length-1) return prev
      const next=[...prev], swap=dir==="up"?idx-1:idx+1
      ;[next[idx],next[swap]]=[next[swap],next[idx]]
      return next.map((e,i)=>({...e,no:i+1}))
    })
  const updateEntry = (id:string, field:keyof TestEntry, value:unknown) =>
    setEntries(prev=>prev.map(e=>e.id===id?{...e,[field]:value}:e))
  const removeImage = (eId:string, iId:string) =>
    setEntries(prev=>prev.map(e=>e.id===eId?{...e,images:e.images.filter(i=>i.id!==iId)}:e))

  // ── LIST VIEW ─────────────────────────────────────────────
  if (view === "list") {
    const grouped = {
      "NOT OK": docs.filter(d=>d.doc_status==="NOT OK"),
      "PARTIAL": docs.filter(d=>d.doc_status==="PARTIAL"),
      "DRAFT":   docs.filter(d=>d.doc_status==="DRAFT"),
      "OK":      docs.filter(d=>d.doc_status==="OK"),
    }
    return (
      <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
        <MotivationBanner page="docreq"/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
          <div>
            <h1 style={{fontSize:"22px",fontWeight:800,color:"var(--text)",letterSpacing:"-0.02em"}}>📋 Scenario Test</h1>
            <p style={{fontSize:"12px",color:"var(--text3)",marginTop:"2px"}}>{docs.length} dokumen tersimpan</p>
          </div>
          <div style={{display:"flex",gap:"8px"}}>
            <button className="btn btn-ghost" onClick={loadDocs}><RefreshCw size={14}/> Refresh</button>
            <button className="btn btn-primary" onClick={openNew}><Plus size={14}/> Buat Dokumen Baru</button>
          </div>
        </div>

        {loadingList ? (
          <div style={{textAlign:"center",padding:"60px",color:"var(--text3)"}}>
            <Loader2 size={24} style={{marginBottom:"8px",animation:"spin 1s linear infinite"}}/>
            <div>Memuat…</div>
          </div>
        ) : docs.length === 0 ? (
          <div className="card" style={{padding:"60px",textAlign:"center"}}>
            <FolderOpen size={40} color="var(--text3)" style={{margin:"0 auto 12px"}}/>
            <div style={{fontWeight:600,color:"var(--text2)"}}>Belum ada dokumen</div>
            <div style={{fontSize:"12px",color:"var(--text3)",marginTop:"4px"}}>Klik "Buat Dokumen Baru" untuk mulai</div>
          </div>
        ) : (
          (["NOT OK","PARTIAL","DRAFT","OK"] as const).map(status => {
            const group = grouped[status]
            if (!group.length) return null
            const {label,color,bg,Icon} = STATUS_CFG[status]
            return (
              <div key={status}>
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
                  <Icon size={15} color={color}/>
                  <span style={{fontSize:"11px",fontWeight:700,color,textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</span>
                  <span style={{fontSize:"11px",color:"var(--text3)",background:"var(--surface3)",padding:"1px 7px",borderRadius:"99px"}}>{group.length}</span>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
                  {group.map(doc => (
                    <div key={doc.id} className="card card-hover" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:"14px"}}>
                      <div style={{width:"10px",height:"10px",borderRadius:"50%",background:color,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:700,fontSize:"14px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.judul_dokumen}</div>
                        <div style={{fontSize:"11px",color:"var(--text3)",marginTop:"2px",display:"flex",gap:"12px",flexWrap:"wrap"}}>
                          {doc.aplikasi && <span>📱 {doc.aplikasi}</span>}
                          {doc.modul    && <span>🗂 {doc.modul}</span>}
                          {doc.tested_by && <span>👤 {doc.tested_by}</span>}
                          <span>🕒 {new Date(doc.updated_at).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})}</span>
                          <span>{doc.entries?.length||0} entri</span>
                        </div>
                      </div>
                      <span style={{fontSize:"11px",fontWeight:700,color,background:bg,padding:"3px 10px",borderRadius:"99px",flexShrink:0}}>{label}</span>
                      <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                        <button className="btn btn-secondary" style={{padding:"6px 12px",fontSize:"12px"}} onClick={()=>openEdit(doc)}>
                          <Edit3 size={13}/> Edit
                        </button>
                        <button className="btn btn-danger" style={{padding:"6px 10px"}} onClick={()=>deleteDoc(doc.id)}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}
        {toast && <ToastEl msg={toast.msg} type={toast.type}/>}
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  // ── FORM VIEW ─────────────────────────────────────────────
  const docStatus = calcDocStatus(entries)
  const {label:dsLabel, color:dsColor, bg:dsBg} = STATUS_CFG[docStatus]

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"20px"}}>
      <MotivationBanner page="docreq"/>

      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <button className="btn btn-ghost" style={{padding:"7px 10px"}} onClick={()=>setView("list")}><ArrowLeft size={15}/></button>
          <div>
            <h1 style={{fontSize:"18px",fontWeight:800,letterSpacing:"-0.02em"}}>
              {editingDoc ? `✏️ ${editingDoc.judul_dokumen}` : "📋 Dokumen Baru"}
            </h1>
            <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"2px"}}>
              <span style={{fontSize:"11px",fontWeight:700,color:dsColor,background:dsBg,padding:"1px 8px",borderRadius:"99px"}}>{dsLabel}</span>
              <span style={{fontSize:"11px",color:"var(--text3)"}}>{entries.length} entri • {entries.reduce((s,e)=>s+e.images.length,0)} gambar</span>
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:"8px"}}>
          <button className="btn btn-ghost" onClick={()=>setShowPesanModal(true)}>
            <MessageSquare size={14}/> Generate Pesan
          </button>
          <button className="btn btn-ghost" onClick={()=>setPreview(v=>!v)}>
            {preview?<EyeOff size={14}/>:<Eye size={14}/>} Preview
          </button>
          <button className="btn btn-ghost" onClick={saveDoc} disabled={saving}>
            {saving?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Save size={14}/>}
            {saving?"Menyimpan…":editingDoc?"Update":"Simpan"}
          </button>
          <button className="btn btn-primary" onClick={generateXLS} disabled={generating}>
            {generating?<Loader2 size={14} style={{animation:"spin 1s linear infinite"}}/>:<Download size={14}/>}
            {generating?"Generating…":"Download .xlsx"}
          </button>
        </div>
      </div>

      {/* Header info */}
      <div className="card" style={{padding:"20px"}}>
        <div className="label" style={{marginBottom:"14px"}}>INFORMASI DOKUMEN</div>
        <div style={{marginBottom:"16px"}}>
          <label style={{fontSize:"12px",fontWeight:600,color:"var(--text2)",display:"block",marginBottom:"6px"}}>
            Judul Dokumen <span style={{color:"var(--danger)"}}>*</span>
            <span style={{fontWeight:400,color:"var(--text3)",marginLeft:"6px"}}>→ nama file</span>
          </label>
          <input className="input" style={{fontSize:"15px",fontWeight:700}} placeholder="e.g. Compare Data Acting as dengan Real"
            value={header.judulDokumen} onChange={e=>setHeader(h=>({...h,judulDokumen:e.target.value}))}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:"12px"}}>
          {HEADER_FIELDS.map(([label, field, ph]) => (
            <div key={field}>
              <label style={{fontSize:"11px",fontWeight:600,color:"var(--text3)",display:"block",marginBottom:"4px"}}>{label}</label>
              <input className="input" style={{fontSize:"13px"}} placeholder={ph}
                value={header[field]} onChange={e=>setHeader(h=>({...h,[field]:e.target.value}))}/>
            </div>
          ))}
        </div>
      </div>

      {/* Entries */}
      <div style={{display:"flex",flexDirection:"column",gap:"12px"}}>
        {entries.map((entry,idx)=>(
          <EntryCard key={entry.id} entry={entry} idx={idx} total={entries.length}
            activePasteTarget={pasteTarget}
            onUpdate={(f,v)=>updateEntry(entry.id,f,v)}
            onRemove={()=>removeEntry(entry.id)}
            onMoveUp={()=>moveEntry(entry.id,"up")}
            onMoveDown={()=>moveEntry(entry.id,"down")}
            onSetPasteTarget={t=>setPasteTarget(t)}
            onRemoveImage={iId=>removeImage(entry.id,iId)}
          />
        ))}
      </div>

      <button className="btn btn-ghost" onClick={addEntry} style={{alignSelf:"flex-start",borderStyle:"dashed"}}>
        <Plus size={14}/> Tambah Entri Testing
      </button>

      {preview && <PreviewPanel header={header} entries={entries}/>}
      {toast && <ToastEl msg={toast.msg} type={toast.type}/>}
      {showPesanModal && (
        <GeneratePesanModal
          header={header}
          entries={entries}
          onClose={() => setShowPesanModal(false)}
        />
      )}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Paste Zone ────────────────────────────────────────────────
// ── Generate Pesan Grup Modal ────────────────────────────────
function GeneratePesanModal({ header, entries, onClose }: {
  header: FormHeader; entries: TestEntry[]; onClose: () => void
}) {
  const [pic, setPic]           = useState("")
  const [picRole, setPicRole]   = useState("SS")
  const [channel, setChannel]   = useState("whatsapp")
  const [copied, setCopied]     = useState(false)
  const textareaRef             = useRef<HTMLTextAreaElement>(null)

  // Determine overall doc status
  const hasNotOk  = entries.some(e => e.status === "NOT OK")
  const hasInProg = entries.some(e => e.status === "IN PROGRESS")
  const allOk     = entries.every(e => e.status === "OK")
  const docStatus = hasNotOk ? "NOT OK" : hasInProg ? "IN PROGRESS" : allOk ? "OK" : "DRAFT"

  // Build numbered test result lines — group sub-rows under parent
  const buildLines = () => {
    const seen = new Set<number>()
    const lines: string[] = []
    entries.forEach(e => {
      if (!seen.has(e.no)) {
        seen.add(e.no)
        const statusEmoji = e.status === "OK" ? "✅" : e.status === "NOT OK" ? "❌" : e.status === "IN PROGRESS" ? "🔄" : "⬜"
        lines.push(`${e.no}. ${e.object} ${statusEmoji} ${e.status || "-"}`)
      }
    })
    return lines
  }

  const statusLine = docStatus === "NOT OK"
    ? `dengan status *NOT OK* ❌`
    : docStatus === "OK"
    ? `dengan status *OK* ✅`
    : docStatus === "IN PROGRESS"
    ? `dengan status *IN PROGRESS* 🔄`
    : `(DRAFT)`

  const docTitle = header.judulDokumen || `${header.aplikasi}_${header.modul}`
  const lines    = buildLines()

  const pesan = `Dear @${pic}${picRole ? ` ${picRole}` : ""}

Berikut terlampir dokumen testing *${docTitle}* ${statusLine}.

Berikut adalah hasil testingnya:
${lines.join("\n")}

Mohon untuk direview kembali. Terimakasih 🙏`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pesan)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      if (textareaRef.current) {
        textareaRef.current.select()
        document.execCommand("copy")
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    }
  }

  return (
    <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"center", justifyContent:"center", background:"rgba(0,0,0,0.45)", backdropFilter:"blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background:"var(--card)", borderRadius:"var(--radius)", padding:"24px", width:"min(560px,95vw)", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 24px 64px rgba(0,0,0,0.2)", border:"1px solid var(--border)" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"20px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:36, height:36, borderRadius:10, background:"var(--accent-muted)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <MessageSquare size={18} color="var(--accent)"/>
            </div>
            <div>
              <div style={{ fontSize:"15px", fontWeight:700, color:"var(--text)" }}>Generate Pesan Grup</div>
              <div style={{ fontSize:"11px", color:"var(--text3)" }}>Pesan siap kirim ke WhatsApp / Telegram</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--text3)", padding:6, borderRadius:8 }}>
            <X size={16}/>
          </button>
        </div>

        {/* Document preview */}
        <div style={{ background:"var(--surface2)", borderRadius:"var(--radius-sm)", padding:"12px 14px", marginBottom:"18px", border:"1px solid var(--border)" }}>
          <div style={{ fontSize:"11px", fontWeight:700, color:"var(--text3)", textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:8 }}>Dokumen</div>
          <div style={{ fontSize:"13px", fontWeight:700, color:"var(--text)", marginBottom:4 }}>{docTitle || "—"}</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            <span style={{ fontSize:11, background:"var(--surface3)", color:"var(--text3)", padding:"2px 8px", borderRadius:99 }}>{header.aplikasi || "—"}</span>
            <span style={{ fontSize:11, background:"var(--surface3)", color:"var(--text3)", padding:"2px 8px", borderRadius:99 }}>{header.modul || "—"}</span>
            <span style={{ fontSize:11, fontWeight:700, padding:"2px 8px", borderRadius:99, background: docStatus==="OK"?"#dcfce7": docStatus==="NOT OK"?"#fee2e2": docStatus==="IN PROGRESS"?"#fef9c3":"var(--surface3)", color: docStatus==="OK"?"#15803d": docStatus==="NOT OK"?"#b91c1c": docStatus==="IN PROGRESS"?"#854d0e":"var(--text3)" }}>
              {docStatus}
            </span>
          </div>
        </div>

        {/* PIC input */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr auto", gap:10, marginBottom:14 }}>
          <div>
            <div style={{ fontSize:"11px", fontWeight:700, color:"var(--text3)", marginBottom:5 }}>Nama PIC (tanpa @)</div>
            <input className="input" placeholder="Mario MDP" value={pic} onChange={e => setPic(e.target.value)} style={{ fontSize:13 }}/>
          </div>
          <div>
            <div style={{ fontSize:"11px", fontWeight:700, color:"var(--text3)", marginBottom:5 }}>Role</div>
            <select className="input" value={picRole} onChange={e => setPicRole(e.target.value)} style={{ fontSize:13, cursor:"pointer" }}>
              <option value="SS">SS</option>
              <option value="MDP SS">MDP SS</option>
              <option value="SPV">SPV</option>
              <option value="Manager">Manager</option>
              <option value="Team">Team</option>
              <option value="">—</option>
            </select>
          </div>
        </div>

        {/* Test results preview */}
        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:"11px", fontWeight:700, color:"var(--text3)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.1em" }}>Hasil Testing ({entries.length} entri)</div>
          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
            {buildLines().map((line, i) => {
              const isOk    = line.includes("✅")
              const isNotOk = line.includes("❌")
              const isInProg= line.includes("🔄")
              return (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"7px 10px", borderRadius:8, fontSize:13, background: isNotOk?"#fee2e2": isOk?"#dcfce7": isInProg?"#fef9c3":"var(--surface2)", color: isNotOk?"#b91c1c": isOk?"#15803d": isInProg?"#854d0e":"var(--text)" }}>
                  {line}
                </div>
              )
            })}
          </div>
        </div>

        {/* Preview pesan */}
        <div style={{ marginBottom:18 }}>
          <div style={{ fontSize:"11px", fontWeight:700, color:"var(--text3)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.1em" }}>Preview Pesan</div>
          <div style={{ background:"var(--surface2)", borderRadius:"var(--radius-sm)", border:"1px solid var(--border)", overflow:"hidden" }}>
            {/* WhatsApp chat bubble style */}
            <div style={{ padding:"10px 14px", background:"#e5ddd5", borderRadius:"var(--radius-sm) var(--radius-sm) 0 0", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:"#25D366" }}/>
              <span style={{ fontSize:11, color:"#555", fontWeight:600 }}>WhatsApp Preview</span>
            </div>
            <div style={{ padding:"12px 14px", background:"#ece5dd", minHeight:100 }}>
              <div style={{ background:"white", borderRadius:"0 12px 12px 12px", padding:"10px 14px", maxWidth:"90%", boxShadow:"0 1px 2px rgba(0,0,0,0.1)", fontSize:13, lineHeight:1.65, color:"#111", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>
                {pic ? pesan : <span style={{ color:"#aaa", fontStyle:"italic" }}>Isi nama PIC di atas untuk preview pesan...</span>}
              </div>
            </div>
          </div>
          <textarea ref={textareaRef} readOnly value={pesan} style={{ position:"absolute", left:"-9999px", opacity:0 }}/>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost" style={{ fontSize:13 }}>Batal</button>
          <button onClick={handleCopy} disabled={!pic.trim()} className="btn btn-primary" style={{ fontSize:13, gap:8, opacity: !pic.trim()?0.5:1 }}>
            {copied ? <><Check size={14}/> Tersalin!</> : <><Copy size={14}/> Copy Pesan</>}
          </button>
        </div>

        {copied && (
          <div style={{ marginTop:12, padding:"8px 12px", background:"#dcfce7", border:"1px solid #86efac", borderRadius:8, fontSize:12, fontWeight:600, color:"#15803d", textAlign:"center", animation:"fadeIn .2s ease" }}>
            ✅ Pesan berhasil disalin! Tinggal paste ke WhatsApp/Telegram.
          </div>
        )}
      </div>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

function PasteZone({active,imageCount,onActivate}:{active:boolean;imageCount:number;onActivate:()=>void}) {
  return (
    <div onClick={onActivate} style={{border:`2px dashed ${active?"var(--accent)":"var(--border2)"}`,borderRadius:"var(--radius-sm)",padding:"8px 14px",display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",background:active?"var(--accent-muted)":"var(--surface2)",transition:"all 0.15s"}}>
      {active
        ? <><ClipboardPaste size={13} color="var(--accent)"/><span style={{fontSize:"12px",fontWeight:600,color:"var(--accent)"}}>Siap! Tekan <kbd style={{background:"var(--surface3)",padding:"1px 5px",borderRadius:"4px",fontFamily:"monospace"}}>Ctrl+V</kbd></span></>
        : <><ImageIcon size={13} color="var(--text3)"/><span style={{fontSize:"12px",color:"var(--text3)"}}>Klik lalu <kbd style={{background:"var(--surface3)",padding:"1px 5px",borderRadius:"4px",fontFamily:"monospace"}}>Ctrl+V</kbd> untuk paste gambar</span></>
      }
      {imageCount > 0 && <span style={{marginLeft:"auto",fontSize:"11px",fontWeight:700,color:"var(--accent)",background:"var(--accent-light)",padding:"1px 8px",borderRadius:"99px"}}>{imageCount} gambar</span>}
    </div>
  )
}

// ── Image Grid ─────────────────────────────────────────────────
function ImageGrid({images,onRemove}:{images:PastedImage[];onRemove:(id:string)=>void}) {
  if (!images.length) return null
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"10px"}}>
      {images.map(img=>(
        <div key={img.id} style={{border:"1.5px solid var(--border)",borderRadius:"var(--radius-sm)",overflow:"hidden",width:"160px",flexShrink:0}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.dataUrl} alt="" style={{width:"100%",maxHeight:"100px",objectFit:"contain",background:"#fafafa",display:"block"}}/>
          <div style={{padding:"3px 6px",display:"flex",justifyContent:"flex-end",borderTop:"1px solid var(--border)"}}>
            <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)"}} onClick={()=>onRemove(img.id)}><X size={11}/></button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Entry Card ────────────────────────────────────────────────
function EntryCard({entry,idx,total,activePasteTarget,onUpdate,onRemove,onMoveUp,onMoveDown,onSetPasteTarget,onRemoveImage}:{
  entry:TestEntry;idx:number;total:number
  activePasteTarget:{entryId:string;subId?:string}|null
  onUpdate:(f:keyof TestEntry,v:unknown)=>void
  onRemove:()=>void;onMoveUp:()=>void;onMoveDown:()=>void
  onSetPasteTarget:(t:{entryId:string;subId?:string}|null)=>void
  onRemoveImage:(id:string)=>void
}) {
  const isMainPaste = activePasteTarget?.entryId===entry.id && !activePasteTarget?.subId

  const addSubSection = () =>
    onUpdate("subSections", [...(entry.subSections||[]), newSubSection()])

  const removeSubSection = (ssId:string) =>
    onUpdate("subSections", entry.subSections.filter(s=>s.id!==ssId))

  const updateSubSection = (ssId:string, field:keyof SubSection, val:unknown) =>
    onUpdate("subSections", entry.subSections.map(s=>s.id!==ssId?s:{...s,[field]:val}))

  const removeSubImage = (ssId:string, imgId:string) =>
    onUpdate("subSections", entry.subSections.map(s=>s.id!==ssId?s:{
      ...s, images:s.images.filter(i=>i.id!==imgId)
    }))

  return (
    <div className="card" style={{padding:"16px"}}>
      {/* ── Header row ── */}
      <div style={{display:"flex",alignItems:"flex-start",gap:"10px",marginBottom:"12px"}}>
        <div style={{minWidth:"30px",height:"30px",borderRadius:"8px",background:"var(--accent-muted)",color:"var(--accent)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:800,flexShrink:0}}>
          {entry.no}
        </div>
        <input className="input" style={{flex:1,fontWeight:600}} placeholder="Object / nama skenario…"
          value={entry.object} onChange={e=>onUpdate("object",e.target.value)}/>
        <select className="input" style={{width:"145px",flexShrink:0,color:ENTRY_STATUS_COLOR[entry.status],background:ENTRY_STATUS_BG[entry.status],fontWeight:700,fontSize:"12px"}}
          value={entry.status} onChange={e=>onUpdate("status",e.target.value)}>
          <option value="">– Status –</option>
          <option value="OK">✅ OK</option>
          <option value="NOT OK">❌ NOT OK</option>
          <option value="IN PROGRESS">🔄 IN PROGRESS</option>
        </select>
        <div style={{display:"flex",gap:"3px",flexShrink:0}}>
          <button className="btn btn-ghost" style={{padding:"5px 7px"}} onClick={onMoveUp} disabled={idx===0}><ChevronUp size={13}/></button>
          <button className="btn btn-ghost" style={{padding:"5px 7px"}} onClick={onMoveDown} disabled={idx===total-1}><ChevronDown size={13}/></button>
          <button className="btn btn-danger" style={{padding:"5px 7px"}} onClick={onRemove}><Trash2 size={13}/></button>
        </div>
      </div>

      {/* ── Keterangan + Tanggal ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 150px",gap:"10px",marginBottom:"12px"}}>
        <div>
          <label className="label" style={{display:"block",marginBottom:"4px"}}>KETERANGAN</label>
          <textarea className="input" rows={2} placeholder="Deskripsi skenario…"
            value={entry.keterangan} onChange={e=>onUpdate("keterangan",e.target.value)}/>
        </div>
        <div>
          <label className="label" style={{display:"block",marginBottom:"4px"}}>TANGGAL TEST</label>
          <input className="input" placeholder="dd/mm/yyyy"
            value={entry.tanggalTest} onChange={e=>onUpdate("tanggalTest",e.target.value)}/>
        </div>
      </div>

      {/* ── Main entry images ── */}
      <ImageGrid images={entry.images} onRemove={onRemoveImage}/>
      <div style={{marginBottom:"12px"}}>
        <PasteZone active={isMainPaste} imageCount={entry.images.length}
          onActivate={()=>onSetPasteTarget(isMainPaste?null:{entryId:entry.id})}/>
      </div>

      {/* ── Sub-sections ── */}
      {(entry.subSections||[]).length > 0 && (
        <div style={{display:"flex",flexDirection:"column",gap:"8px",marginBottom:"12px"}}>
          {entry.subSections.map((ss,ssIdx)=>{
            const isSubPaste = activePasteTarget?.entryId===entry.id && activePasteTarget?.subId===ss.id
            return (
              <div key={ss.id} style={{
                border:"1.5px solid var(--border)",borderRadius:"var(--radius-sm)",
                padding:"12px",background:"var(--surface2)",
                borderLeft:"3px solid var(--accent2)",
              }}>
                {/* Sub-section header */}
                <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"10px"}}>
                  <span style={{fontSize:"11px",fontWeight:700,color:"var(--accent2)",background:"var(--accent-muted)",padding:"2px 8px",borderRadius:"99px",flexShrink:0}}>
                    Sub {ssIdx+1}
                  </span>
                  <div style={{flex:1}}/>
                  <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",padding:"2px"}}
                    onClick={()=>removeSubSection(ss.id)}>
                    <X size={13}/>
                  </button>
                </div>

                {/* Tanggal + Status row */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 160px",gap:"8px",marginBottom:"8px"}}>
                  <div>
                    <label className="label" style={{display:"block",marginBottom:"4px"}}>TANGGAL TEST</label>
                    <input className="input" placeholder="dd/mm/yyyy"
                      value={ss.tanggal ?? ""}
                      onChange={e=>updateSubSection(ss.id,"tanggal",e.target.value)}/>
                  </div>
                  <div>
                    <label className="label" style={{display:"block",marginBottom:"4px"}}>STATUS</label>
                    <select className="input"
                      style={{
                        color: ENTRY_STATUS_COLOR[ss.status ?? ""],
                        background: ENTRY_STATUS_BG[ss.status ?? ""],
                        fontWeight:700, fontSize:"12px"
                      }}
                      value={ss.status ?? ""}
                      onChange={e=>updateSubSection(ss.id,"status",e.target.value)}>
                      <option value="">– Status –</option>
                      <option value="OK">✅ OK</option>
                      <option value="NOT OK">❌ NOT OK</option>
                      <option value="IN PROGRESS">🔄 IN PROGRESS</option>
                    </select>
                  </div>
                </div>

                {/* Deskripsi */}
                <div style={{marginBottom:"8px"}}>
                  <label className="label" style={{display:"block",marginBottom:"4px"}}>DESKRIPSI</label>
                  <textarea className="input" rows={2} placeholder="Deskripsi sub-section…"
                    value={ss.deskripsi}
                    onChange={e=>updateSubSection(ss.id,"deskripsi",e.target.value)}/>
                </div>

                {/* Sub images */}
                <ImageGrid images={ss.images} onRemove={imgId=>removeSubImage(ss.id,imgId)}/>
                <PasteZone active={isSubPaste} imageCount={ss.images.length}
                  onActivate={()=>onSetPasteTarget(isSubPaste?null:{entryId:entry.id,subId:ss.id})}/>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Add sub-section button ── */}
      <button className="btn btn-ghost" onClick={addSubSection}
        style={{width:"100%",justifyContent:"center",borderStyle:"dashed",fontSize:"12px",padding:"7px"}}>
        <Layers size={13}/> Tambah Sub-Section
      </button>
    </div>
  )
}

// ── Preview ───────────────────────────────────────────────────
function PreviewPanel({header,entries}:{header:FormHeader;entries:TestEntry[]}) {
  return (
    <div className="card" style={{padding:"20px",background:"var(--surface2)"}}>
      <div className="label" style={{marginBottom:"14px"}}>PREVIEW</div>
      <div style={{background:"white",border:"1px solid var(--border)",borderRadius:"var(--radius-sm)",overflow:"hidden",fontSize:"12px"}}>
        <div style={{padding:"8px 12px",fontWeight:800,fontSize:"16px",borderBottom:"1px solid var(--border)",background:"#f9f9f7"}}>FORM SCENARIO TESTING - 2026</div>
        <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border)",display:"grid",gridTemplateColumns:"140px 1fr",gap:"4px 8px"}}>
          {[["Keterangan",header.keterangan],["Aplikasi",header.aplikasi],["Modul",header.modul],["Created By",header.createdBy],["Tested By",header.testedBy],["Target Finish",header.targetFinish]].map(([k,v])=>(
            <Fragment key={k}><span style={{color:"var(--text3)"}}>{k} :</span><span style={{fontWeight:600}}>{v||"–"}</span></Fragment>
          ))}
        </div>
        <div style={{padding:"10px 12px",fontWeight:700,borderBottom:"1px solid var(--border)",background:"#fffde7"}}>{header.judulDokumen||"(Judul belum diisi)"}</div>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#fffde7"}}>
              {["No","Object","Keterangan","Tanggal Test","Status"].map(h=>(
                <th key={h} style={{padding:"6px 10px",borderBottom:"1px solid var(--border)",textAlign:"left",fontWeight:700,fontSize:"11px"}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map(e=>(
              <Fragment key={e.id}>
                <tr style={{borderBottom:"1px solid var(--border)"}}>
                  <td style={{padding:"6px 10px"}}>{e.no}</td>
                  <td style={{padding:"6px 10px",fontWeight:600}}>{e.object||"–"}</td>
                  <td style={{padding:"6px 10px",color:"var(--text2)"}}>{e.keterangan||"–"}</td>
                  <td style={{padding:"6px 10px",whiteSpace:"nowrap"}}>{e.tanggalTest}</td>
                  <td style={{padding:"6px 10px",fontWeight:700,color:ENTRY_STATUS_COLOR[e.status]}}>{e.status||"–"}</td>
                </tr>
                {e.images.length > 0 && (
                  <tr key={`img-${e.id}`} style={{background:"var(--surface2)",borderBottom:"1px solid var(--border)"}}>
                    <td/><td colSpan={4} style={{padding:"8px 10px"}}>
                      <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                        {e.images.map(img=>(
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={img.id} src={img.dataUrl} alt="" style={{maxWidth:"150px",maxHeight:"90px",objectFit:"contain",border:"1px solid var(--border)",borderRadius:"4px"}}/>
                        ))}
                      </div>
                      {e.subKeterangan && <div style={{marginTop:"4px",fontSize:"11px",color:"var(--text2)",fontStyle:"italic"}}>→ {e.subKeterangan}</div>}
                    </td>
                  </tr>
                )}
                {/* Sub-sections in preview */}
                {(e.subSections||[]).map((ss, ssIdx) => (
                  <Fragment key={`ss-${ss.id}`}>
                    <tr style={{borderBottom:"1px solid var(--border)",background:"#fafaf8"}}>
                      <td style={{padding:"5px 10px",color:"var(--text3)",fontSize:"11px"}}>↳</td>
                      <td colSpan={2} style={{padding:"5px 10px",fontSize:"11px",color:"var(--text2)",fontStyle:"italic"}}>
                        <span style={{fontSize:"10px",fontWeight:700,color:"var(--accent2)",background:"var(--accent-muted)",padding:"1px 6px",borderRadius:"99px",marginRight:"6px"}}>Sub {ssIdx+1}</span>
                        {ss.deskripsi||"–"}
                      </td>
                      <td style={{padding:"5px 10px",fontSize:"11px",whiteSpace:"nowrap",color:"var(--text3)"}}>{ss.tanggal||"–"}</td>
                      <td style={{padding:"5px 10px",fontSize:"11px",fontWeight:700,color:ENTRY_STATUS_COLOR[ss.status??""]}}>
                        {ss.status||"–"}
                      </td>
                    </tr>
                    {ss.images.length > 0 && (
                      <tr style={{background:"#fafaf8",borderBottom:"1px solid var(--border)"}}>
                        <td/><td colSpan={4} style={{padding:"6px 10px"}}>
                          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                            {ss.images.map(img=>(
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={img.id} src={img.dataUrl} alt="" style={{maxWidth:"120px",maxHeight:"70px",objectFit:"contain",border:"1px solid var(--border)",borderRadius:"4px"}}/>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Toast ─────────────────────────────────────────────────────
function ToastEl({msg,type}:{msg:string;type:"ok"|"err"}) {
  return (
    <div style={{position:"fixed",bottom:"24px",right:"24px",background:type==="ok"?"var(--accent)":"var(--danger)",color:"white",padding:"11px 16px",borderRadius:"var(--radius-sm)",boxShadow:"var(--shadow-md)",fontSize:"13px",fontWeight:600,display:"flex",alignItems:"center",gap:"8px",zIndex:9999,animation:"fadeUp 0.25s ease"}}>
      {type==="ok"?<CheckCircle2 size={15}/>:<AlertCircle size={15}/>}{msg}
    </div>
  )
}