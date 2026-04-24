"use client"

import { useState, useRef, useCallback, useEffect, Fragment } from "react"
import {
  Plus, Trash2, Download, Image as ImageIcon,
  ChevronUp, ChevronDown, X, ClipboardPaste, CheckCircle2,
  AlertCircle, Eye, EyeOff, Loader2, ArrowLeft,
  FolderOpen, FileText, Clock, CheckCircle, XCircle,
  Edit3, Save, RefreshCw
} from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"
import { supabase } from "@/lib/supabase"

// ── Types ────────────────────────────────────────────────────
interface PastedImage { id: string; dataUrl: string; label: string }

interface TestEntry {
  id: string; no: number; object: string; keterangan: string
  tanggalTest: string; status: "OK"|"NOT OK"|"IN PROGRESS"|""
  images: PastedImage[]; subKeterangan: string
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
  status:"", images:[], subKeterangan:""
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
  const [pasteTarget, setPasteTarget] = useState<string|null>(null)
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
  const handlePaste = useCallback((e: ClipboardEvent, entryId: string) => {
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
          setEntries(prev => prev.map(en => en.id !== entryId ? en : {
            ...en, images:[...en.images,{id:crypto.randomUUID(),dataUrl,label:`Screenshot ${en.images.length+1}`}]
          }))
          showToast("Gambar berhasil ditempel!")
        }
        reader.readAsDataURL(file); return
      }
    }
    showToast("Tidak ada gambar di clipboard.","err")
  },[])

  useEffect(()=>{
    if (!pasteTarget) return
    const h = (e:ClipboardEvent)=>handlePaste(e,pasteTarget)
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
    if (!header.judulDokumen.trim()) { showToast("Judul dokumen wajib diisi!","err"); return }
    setGenerating(true)
    try {
      const res = await fetch("/api/generate-xls",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({header,entries})})
      if (!res.ok) throw new Error((await res.json()).error||"Generate failed")
      const blob=await res.blob(), url=URL.createObjectURL(blob), a=document.createElement("a")
      a.href=url; a.download=`${header.judulDokumen.trim().replace(/[\\/:*?"<>|]/g,"_")}.xlsx`; a.click()
      URL.revokeObjectURL(url); showToast("File berhasil diunduh!")
    } catch(err:unknown){ showToast(err instanceof Error?err.message:"Gagal generate","err") }
    finally { setGenerating(false) }
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
            isPasteTarget={pasteTarget===entry.id}
            onUpdate={(f,v)=>updateEntry(entry.id,f,v)}
            onRemove={()=>removeEntry(entry.id)}
            onMoveUp={()=>moveEntry(entry.id,"up")}
            onMoveDown={()=>moveEntry(entry.id,"down")}
            onActivatePaste={()=>setPasteTarget(p=>p===entry.id?null:entry.id)}
            onRemoveImage={iId=>removeImage(entry.id,iId)}
          />
        ))}
      </div>

      <button className="btn btn-ghost" onClick={addEntry} style={{alignSelf:"flex-start",borderStyle:"dashed"}}>
        <Plus size={14}/> Tambah Entri Testing
      </button>

      {preview && <PreviewPanel header={header} entries={entries}/>}
      {toast && <ToastEl msg={toast.msg} type={toast.type}/>}
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Entry Card ────────────────────────────────────────────────
function EntryCard({entry,idx,total,isPasteTarget,onUpdate,onRemove,onMoveUp,onMoveDown,onActivatePaste,onRemoveImage}:{
  entry:TestEntry;idx:number;total:number;isPasteTarget:boolean
  onUpdate:(f:keyof TestEntry,v:unknown)=>void
  onRemove:()=>void;onMoveUp:()=>void;onMoveDown:()=>void
  onActivatePaste:()=>void;onRemoveImage:(id:string)=>void
}) {
  return (
    <div className="card" style={{padding:"16px"}}>
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

      <div style={{display:"grid",gridTemplateColumns:"1fr 150px",gap:"10px",marginBottom:"12px"}}>
        <div>
          <label className="label" style={{display:"block",marginBottom:"4px"}}>KETERANGAN</label>
          <textarea className="input" rows={2} placeholder="Deskripsi skenario…" value={entry.keterangan} onChange={e=>onUpdate("keterangan",e.target.value)}/>
        </div>
        <div>
          <label className="label" style={{display:"block",marginBottom:"4px"}}>TANGGAL TEST</label>
          <input className="input" placeholder="dd/mm/yyyy" value={entry.tanggalTest} onChange={e=>onUpdate("tanggalTest",e.target.value)}/>
        </div>
      </div>

      {entry.images.length > 0 && (
        <div style={{marginBottom:"12px"}}>
          <label className="label" style={{display:"block",marginBottom:"8px"}}>GAMBAR ({entry.images.length})</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:"10px"}}>
            {entry.images.map(img=>(
              <div key={img.id} style={{border:"1.5px solid var(--border)",borderRadius:"var(--radius-sm)",overflow:"hidden",width:"180px"}}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt={img.label} style={{width:"100%",maxHeight:"110px",objectFit:"contain",background:"#fafafa",display:"block"}}/>
                <div style={{padding:"4px 8px",display:"flex",gap:"4px",alignItems:"center",borderTop:"1px solid var(--border)"}}>
                  <span style={{fontSize:"11px",color:"var(--text3)",flex:1}}>{img.label}</span>
                  <button style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)"}} onClick={()=>onRemoveImage(img.id)}><X size={12}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(entry.images.length > 0 || entry.subKeterangan) && (
        <div style={{marginBottom:"12px"}}>
          <label className="label" style={{display:"block",marginBottom:"4px"}}>KETERANGAN TAMBAHAN</label>
          <input className="input" style={{fontSize:"13px"}} placeholder="Teks setelah gambar…"
            value={entry.subKeterangan} onChange={e=>onUpdate("subKeterangan",e.target.value)}/>
        </div>
      )}

      <div onClick={onActivatePaste} style={{border:`2px dashed ${isPasteTarget?"var(--accent)":"var(--border2)"}`,borderRadius:"var(--radius-sm)",padding:"9px 14px",display:"flex",alignItems:"center",gap:"8px",cursor:"pointer",background:isPasteTarget?"var(--accent-muted)":"var(--surface2)",transition:"all 0.15s"}}>
        {isPasteTarget
          ? <><ClipboardPaste size={14} color="var(--accent)"/><span style={{fontSize:"12px",fontWeight:600,color:"var(--accent)"}}>Siap! Tekan <kbd style={{background:"var(--surface3)",padding:"1px 5px",borderRadius:"4px",fontFamily:"monospace"}}>Ctrl+V</kbd> untuk paste screenshot</span></>
          : <><ImageIcon size={14} color="var(--text3)"/><span style={{fontSize:"12px",color:"var(--text3)"}}>Klik di sini lalu <kbd style={{background:"var(--surface3)",padding:"1px 5px",borderRadius:"4px",fontFamily:"monospace"}}>Ctrl+V</kbd> untuk paste gambar</span></>
        }
        {entry.images.length > 0 && (
          <span style={{marginLeft:"auto",fontSize:"11px",fontWeight:700,color:"var(--accent)",background:"var(--accent-light)",padding:"1px 8px",borderRadius:"99px"}}>
            {entry.images.length} gambar
          </span>
        )}
      </div>
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