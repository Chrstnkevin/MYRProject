"use client"
// PATH: src/app/dashboard/knowledge-base/page.tsx
// Mind Map Knowledge Base — Matrix / Ficom / SFA

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { Search, X, Plus, Edit3, Trash2, ZoomIn, ZoomOut, RotateCcw, ChevronDown, ChevronRight, Image as Img, Tag } from "lucide-react"
import { supabase } from "@/lib/supabase"

// ── Types ──────────────────────────────────────────────────────
interface KbApp       { id:string; name:string; description:string; color:string; icon:string; sort_order:number }
interface KbModule    { id:string; app_id:string; name:string; description:string; image_url?:string; image_base64?:string; sort_order:number }
interface KbSubmodule { id:string; module_id:string; app_id:string; name:string; description:string; image_url?:string; image_base64?:string; sort_order:number }
interface KbFeature   { id:string; submodule_id:string; module_id:string; app_id:string; name:string; description:string; tags:string[]; image_url:string; image_base64:string }

// Node position (free drag)
interface NodePos { x:number; y:number }
type PosMap = Record<string, NodePos>

// ── Constants ──────────────────────────────────────────────────
const NODE_SIZE = { app:{w:120,h:48}, module:{w:110,h:56}, submodule:{w:96,h:44}, feature:{w:88,h:40} }
const DIRECTIONS = [
  { label:"↑", dx:0,  dy:-1, angle:-90  },
  { label:"↓", dx:0,  dy:1,  angle:90   },
  { label:"←", dx:-1, dy:0,  angle:180  },
  { label:"→", dx:1,  dy:0,  angle:0    },
]

function hexToRgb(hex:string){ const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return `${r},${g},${b}` }
function alpha(hex:string,a:number){ return `rgba(${hexToRgb(hex)},${a})` }

// ── Initial layout: radial from center ────────────────────────
function getInitialPositions(app:KbApp, modules:KbModule[], submodules:KbSubmodule[], features:KbFeature[]): PosMap {
  const pos: PosMap = {}
  const appMods = modules.filter(m=>m.app_id===app.id)

  pos[app.id] = { x:0, y:0 }

  appMods.forEach((mod, mi) => {
    const total = appMods.length
    const angle = (mi/total)*2*Math.PI - Math.PI/2
    const r = total <= 3 ? 260 : total <= 6 ? 300 : 340
    const mx = r * Math.cos(angle), my = r * Math.sin(angle)
    pos[mod.id] = { x:mx, y:my }

    const modSubs = submodules.filter(s=>s.module_id===mod.id)
    modSubs.forEach((sub,si) => {
      const spread = Math.min(0.7, 0.2 + modSubs.length*0.12)
      const sa = angle + (si-(modSubs.length-1)/2)*spread
      const sr = 200
      pos[sub.id] = { x:mx+sr*Math.cos(sa), y:my+sr*Math.sin(sa) }

      const subFeats = features.filter(f=>f.submodule_id===sub.id)
      subFeats.forEach((feat,fi) => {
        const spread2 = Math.min(0.5, 0.15+subFeats.length*0.1)
        const fa = sa + (fi-(subFeats.length-1)/2)*spread2
        const fr = 170
        pos[feat.id] = { x:pos[sub.id].x+fr*Math.cos(fa), y:pos[sub.id].y+fr*Math.sin(fa) }
      })
    })
  })
  return pos
}

// Compute new child position relative to parent by direction
function childPos(parentPos:NodePos, dir:{dx:number;dy:number}, siblings:number, sibIdx:number): NodePos {
  const DIST = 190
  const SPREAD = 90
  const perpX = dir.dy, perpY = -dir.dx
  const offset = siblings > 1 ? (sibIdx-(siblings-1)/2)*SPREAD : 0
  return {
    x: parentPos.x + dir.dx*DIST + perpX*offset,
    y: parentPos.y + dir.dy*DIST + perpY*offset,
  }
}

// ── Curved edge path ───────────────────────────────────────────
function curvePath(x1:number,y1:number,x2:number,y2:number): string {
  const cx = (x1+x2)/2, cy = (y1+y2)/2
  const dx = x2-x1, dy = y2-y1
  const bx = cx - dy*0.08, by = cy + dx*0.08
  return `M ${x1} ${y1} Q ${bx} ${by} ${x2} ${y2}`
}

// ── Image storage ──────────────────────────────────────────────
async function uploadImg(file:File): Promise<{url:string;b64:string}> {
  const reader = new FileReader()
  const b64 = await new Promise<string>(res => { reader.onload=e=>res(e.target?.result as string||""); reader.readAsDataURL(file) })
  try {
    const path = `kb/${Date.now()}-${file.name.replace(/\s/g,"_")}`
    const { error } = await supabase.storage.from("knowledge-base").upload(path,file,{upsert:true})
    if (!error) {
      const { data } = supabase.storage.from("knowledge-base").getPublicUrl(path)
      return { url:data.publicUrl, b64:"" }
    }
  } catch {}
  return { url:"", b64 }
}

// ── Quick Add Popover ──────────────────────────────────────────
function QuickAdd({ x,y,zoom,pan,color,onAdd,onClose }:{
  x:number; y:number; zoom:number; pan:{x:number;y:number}; color:string
  onAdd:(name:string,desc:string,dir:{dx:number;dy:number;label:string})=>void
  onClose:()=>void
}) {
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [dir,  setDir]  = useState(DIRECTIONS[3])
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(()=>{ inputRef.current?.focus() },[])

  // Convert canvas coords to screen
  const sx = x*zoom + pan.x + window.innerWidth/2
  const sy = y*zoom + pan.y + window.innerHeight/2

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:150 }}/>
      <div style={{
        position:"fixed", left:sx, top:sy, transform:"translate(-50%,-110%)",
        background:"var(--surface)", borderRadius:"14px", padding:"14px", width:"240px",
        boxShadow:`0 8px 32px ${alpha(color,0.25)}, 0 2px 8px rgba(0,0,0,0.15)`,
        border:`1.5px solid ${color}`, zIndex:160
      }}>
        {/* Direction picker */}
        <div style={{ display:"flex",justifyContent:"center",gap:"5px",marginBottom:"10px" }}>
          {DIRECTIONS.map(d=>(
            <button key={d.label} onClick={()=>setDir(d)}
              style={{ width:"32px",height:"32px",borderRadius:"8px",border:`1.5px solid ${dir.label===d.label?color:"var(--border)"}`,background:dir.label===d.label?alpha(color,0.12):"var(--surface2)",cursor:"pointer",fontSize:"14px",fontWeight:700,color:dir.label===d.label?color:"var(--text3)",transition:"all 0.12s" }}>
              {d.label}
            </button>
          ))}
        </div>
        <input ref={inputRef} value={name} onChange={e=>setName(e.target.value)}
          placeholder="Nama node..." onKeyDown={e=>{if(e.key==="Enter"&&name.trim())onAdd(name,desc,dir);if(e.key==="Escape")onClose()}}
          style={{ width:"100%",padding:"8px 10px",borderRadius:"8px",border:`1.5px solid ${color}40`,background:"var(--surface2)",color:"var(--text)",fontSize:"13px",fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:"6px" }}/>
        <input value={desc} onChange={e=>setDesc(e.target.value)}
          placeholder="Deskripsi (opsional)..." onKeyDown={e=>{if(e.key==="Enter"&&name.trim())onAdd(name,desc,dir);if(e.key==="Escape")onClose()}}
          style={{ width:"100%",padding:"6px 10px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:"12px",fontFamily:"inherit",outline:"none",boxSizing:"border-box",marginBottom:"8px" }}/>
        <div style={{ display:"flex",gap:"6px" }}>
          <button onClick={()=>name.trim()&&onAdd(name,desc,dir)} disabled={!name.trim()}
            style={{ flex:1,padding:"7px",borderRadius:"8px",border:"none",background:name.trim()?color:"#94A3B8",color:"white",fontSize:"12px",fontWeight:700,cursor:name.trim()?"pointer":"not-allowed",fontFamily:"inherit" }}>
            Tambah ↵
          </button>
          <button onClick={onClose} style={{ padding:"7px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text3)",fontSize:"12px",cursor:"pointer",fontFamily:"inherit" }}>✕</button>
        </div>
      </div>
    </>
  )
}

// ── Detail / Edit Modal ────────────────────────────────────────
function DetailModal({ node,type,color,breadcrumb,onClose,onSave,onDelete }:{
  node:any; type:string; color:string; breadcrumb:string
  onClose:()=>void; onSave:(updates:any)=>void; onDelete:()=>void
}) {
  const [name,     setName]     = useState(node.name||"")
  const [desc,     setDesc]     = useState(node.description||"")
  const [tagInput, setTagInput] = useState("")
  const [tags,     setTags]     = useState<string[]>(node.tags||[])
  const [imgUrl,   setImgUrl]   = useState(node.image_url||"")
  const [imgB64,   setImgB64]   = useState(node.image_base64||"")
  const [saving,   setSaving]   = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)
  const img = imgUrl||imgB64

  const addTag = () => {
    const t=tagInput.trim().toLowerCase().replace(/\s+/g,"-")
    if(t&&!tags.includes(t)) setTags(p=>[...p,t])
    setTagInput("")
  }
  const handleImg = async (file:File) => {
    const {url,b64} = await uploadImg(file)
    setImgUrl(url); setImgB64(b64)
  }
  const save = async () => {
    setSaving(true)
    await onSave({ name:name.trim(), description:desc.trim(), tags, image_url:imgUrl, image_base64:imgB64 })
    setSaving(false)
  }

  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose()}}
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(5px)" }}>
      <div style={{ background:"var(--surface)",borderRadius:"16px",width:"540px",maxWidth:"92vw",maxHeight:"90vh",overflow:"auto",boxShadow:`0 24px 80px rgba(0,0,0,0.3), 0 0 0 1px ${color}30`,border:`1px solid var(--border)` }}>
        {img && <div style={{ height:"200px",overflow:"hidden",borderRadius:"16px 16px 0 0" }}><img src={img} style={{ width:"100%",height:"100%",objectFit:"cover" }}/></div>}
        <div style={{ padding:"22px" }}>
          <div style={{ fontSize:"10px",color:"var(--text3)",marginBottom:"8px",fontWeight:600 }}>{breadcrumb}</div>
          <input value={name} onChange={e=>setName(e.target.value)}
            style={{ width:"100%",fontSize:"20px",fontWeight:800,color:"var(--text)",background:"transparent",border:"none",outline:"none",fontFamily:"inherit",padding:0,marginBottom:"10px",boxSizing:"border-box" }}/>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Deskripsi..." rows={3}
            style={{ width:"100%",fontSize:"13px",color:"var(--text3)",background:"var(--surface2)",border:"1px solid var(--border)",borderRadius:"8px",outline:"none",fontFamily:"inherit",padding:"8px 10px",resize:"vertical",boxSizing:"border-box",lineHeight:1.6,marginBottom:"12px" }}/>

          {/* Tags — only for feature */}
          {type==="feature" && (
            <div style={{ marginBottom:"12px" }}>
              <div style={{ fontSize:"11px",fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px" }}>Tags</div>
              <div style={{ display:"flex",gap:"4px",flexWrap:"wrap",marginBottom:"6px" }}>
                {tags.map(t=>(
                  <span key={t} style={{ display:"inline-flex",alignItems:"center",gap:"3px",fontSize:"11px",fontWeight:600,background:alpha(color,0.12),color,padding:"2px 8px",borderRadius:"99px" }}>
                    #{t}<button onClick={()=>setTags(p=>p.filter(x=>x!==t))} style={{ background:"none",border:"none",cursor:"pointer",color,padding:0,fontSize:"13px",lineHeight:1 }}>×</button>
                  </span>
                ))}
              </div>
              <div style={{ display:"flex",gap:"6px" }}>
                <input value={tagInput} onChange={e=>setTagInput(e.target.value)} placeholder="Tag (Enter)" onKeyDown={e=>{if(e.key==="Enter"||e.key===","){e.preventDefault();addTag()}}}
                  style={{ flex:1,padding:"6px 10px",borderRadius:"7px",border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:"12px",fontFamily:"inherit",outline:"none" }}/>
                <button onClick={addTag} style={{ padding:"6px 12px",borderRadius:"7px",border:"none",background:color,color:"white",fontSize:"12px",fontWeight:700,cursor:"pointer",fontFamily:"inherit" }}>+</button>
              </div>
            </div>
          )}

          {/* Image */}
          <div style={{ marginBottom:"16px" }}>
            <div style={{ fontSize:"11px",fontWeight:700,color:"var(--text3)",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"6px" }}>Gambar</div>
            <div style={{ display:"flex",gap:"7px" }}>
              <input ref={imgRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>{const f=e.target.files?.[0];if(f)handleImg(f)}}/>
              <button onClick={()=>imgRef.current?.click()} style={{ display:"flex",alignItems:"center",gap:"5px",padding:"6px 12px",borderRadius:"7px",border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text3)",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit" }}>
                <Img size={12}/>Upload
              </button>
              <input value={imgUrl} onChange={e=>setImgUrl(e.target.value)} placeholder="atau paste URL..."
                style={{ flex:1,padding:"6px 10px",borderRadius:"7px",border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text)",fontSize:"12px",fontFamily:"inherit",outline:"none" }}/>
              {img && <button onClick={()=>{setImgUrl("");setImgB64("")}} style={{ padding:"6px",borderRadius:"7px",border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",cursor:"pointer",display:"flex",alignItems:"center" }}><X size={12}/></button>}
            </div>
          </div>

          <div style={{ display:"flex",gap:"8px" }}>
            <button onClick={save} disabled={saving}
              style={{ flex:1,padding:"9px",borderRadius:"9px",border:"none",background:saving?"#94A3B8":color,color:"white",fontSize:"13px",fontWeight:700,cursor:saving?"not-allowed":"pointer",fontFamily:"inherit" }}>
              {saving?"Menyimpan...":"Simpan"}
            </button>
            <button onClick={onDelete} style={{ padding:"9px 14px",borderRadius:"9px",border:"1px solid #FECACA",background:"#FEF2F2",color:"#DC2626",fontSize:"12px",fontWeight:600,cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"4px" }}>
              <Trash2 size={12}/>Hapus
            </button>
            <button onClick={onClose} style={{ padding:"9px 14px",borderRadius:"9px",border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text3)",fontSize:"13px",cursor:"pointer",fontFamily:"inherit" }}>✕</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Search Suggest ─────────────────────────────────────────────
function SearchBox({ apps,modules,submodules,features,onNavigate,onClose }:{
  apps:KbApp[]; modules:KbModule[]; submodules:KbSubmodule[]; features:KbFeature[]
  onNavigate:(id:string)=>void; onClose:()=>void
}) {
  const [q, setQ] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(()=>{ inputRef.current?.focus() },[])

  const results = useMemo(()=>{
    if (!q.trim()) return []
    const lq = q.toLowerCase()
    const hits: Array<{id:string;name:string;type:string;path:string;icon:string;color:string}> = []

    modules.forEach(m=>{
      if (m.name.toLowerCase().includes(lq)||m.description?.toLowerCase().includes(lq)){
        const a=apps.find(x=>x.id===m.app_id)
        hits.push({id:m.id,name:m.name,type:"Module",path:a?.name||"",icon:a?.icon||"📦",color:a?.color||"#6366F1"})
      }
    })
    submodules.forEach(s=>{
      if (s.name.toLowerCase().includes(lq)||s.description?.toLowerCase().includes(lq)){
        const a=apps.find(x=>x.id===s.app_id)
        const m=modules.find(x=>x.id===s.module_id)
        hits.push({id:s.id,name:s.name,type:"Sub-module",path:`${a?.name} › ${m?.name}`,icon:a?.icon||"📦",color:a?.color||"#6366F1"})
      }
    })
    features.forEach(f=>{
      const nameMatch = f.name.toLowerCase().includes(lq)
      const descMatch = f.description?.toLowerCase().includes(lq)
      const tagMatch  = f.tags?.some(t=>t.toLowerCase().includes(lq))
      if (nameMatch||descMatch||tagMatch){
        const a=apps.find(x=>x.id===f.app_id)
        const m=modules.find(x=>x.id===f.module_id)
        const s=submodules.find(x=>x.id===f.submodule_id)
        hits.push({id:f.id,name:f.name,type:"Fitur",path:`${a?.name} › ${m?.name} › ${s?.name}`,icon:a?.icon||"📦",color:a?.color||"#6366F1"})
      }
    })
    return hits.slice(0,10)
  },[q,apps,modules,submodules,features])

  const Highlight = ({text}:{text:string})=>{
    const i=text.toLowerCase().indexOf(q.toLowerCase())
    if(i<0) return <>{text}</>
    return <>{text.slice(0,i)}<mark style={{background:"#FDE68A",borderRadius:"2px",padding:"0 1px"}}>{text.slice(i,i+q.length)}</mark>{text.slice(i+q.length)}</>
  }

  return (
    <>
      <div onClick={onClose} style={{ position:"fixed",inset:0,zIndex:200 }}/>
      <div style={{ position:"fixed",top:"58px",left:"50%",transform:"translateX(-50%)",width:"480px",maxWidth:"92vw",zIndex:201 }}>
        <div style={{ background:"var(--surface)",borderRadius:"14px",border:"1.5px solid #6366F1",boxShadow:"0 8px 40px rgba(99,102,241,0.2),0 2px 8px rgba(0,0,0,0.15)",overflow:"hidden" }}>
          <div style={{ display:"flex",alignItems:"center",gap:"10px",padding:"12px 14px",borderBottom:"1px solid var(--border)" }}>
            <Search size={15} color="#6366F1"/>
            <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari fitur, module, deskripsi, tag..."
              style={{ flex:1,border:"none",outline:"none",fontSize:"14px",fontWeight:500,color:"var(--text)",background:"transparent",fontFamily:"inherit" }}
              onKeyDown={e=>{if(e.key==="Escape")onClose()}}/>
            {q && <button onClick={()=>setQ("")} style={{ background:"none",border:"none",cursor:"pointer",color:"var(--text3)" }}><X size={13}/></button>}
          </div>
          {q.trim() && (
            <div>
              {results.length === 0 ? (
                <div style={{ padding:"24px",textAlign:"center",color:"var(--text3)",fontSize:"13px" }}>
                  Tidak ditemukan untuk "<strong>{q}</strong>"
                </div>
              ) : results.map(r=>(
                <button key={r.id} onClick={()=>{onNavigate(r.id);onClose()}}
                  style={{ width:"100%",padding:"10px 14px",border:"none",borderBottom:"1px solid var(--border)",background:"transparent",cursor:"pointer",textAlign:"left",fontFamily:"inherit",display:"flex",alignItems:"center",gap:"10px",transition:"background 0.1s" }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--surface2)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
                  <div style={{ width:"32px",height:"32px",borderRadius:"8px",background:alpha(r.color,0.12),display:"flex",alignItems:"center",justifyContent:"center",fontSize:"15px",flexShrink:0 }}>{r.icon}</div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:"13px",fontWeight:700,color:"var(--text)" }}><Highlight text={r.name}/></div>
                    <div style={{ fontSize:"10px",color:"var(--text3)",marginTop:"1px" }}>
                      <span style={{ background:alpha(r.color,0.1),color:r.color,padding:"0 5px",borderRadius:"4px",fontWeight:600,marginRight:"5px" }}>{r.type}</span>
                      {r.path}
                    </div>
                  </div>
                  <ChevronRight size={13} color="var(--text3)"/>
                </button>
              ))}
              {results.length > 0 && <div style={{ padding:"8px 14px",fontSize:"10px",color:"var(--text3)",textAlign:"center" }}>Klik untuk navigasi ke node</div>}
            </div>
          )}
          {!q.trim() && (
            <div style={{ padding:"16px 14px",display:"flex",gap:"8px",flexWrap:"wrap" }}>
              {["Good Receive","Transfer","Invoice","Report","Dashboard"].map(s=>(
                <button key={s} onClick={()=>setQ(s)} style={{ padding:"4px 10px",borderRadius:"99px",border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text3)",fontSize:"11px",cursor:"pointer",fontFamily:"inherit" }}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ── MIND MAP CANVAS ────────────────────────────────────────────
function MindMapCanvas({ app,modules,submodules,features,onAdd,onUpdate,onDelete,reload }:{
  app:KbApp; modules:KbModule[]; submodules:KbSubmodule[]; features:KbFeature[]
  onAdd:(type:string,parentId:string,name:string,desc:string,pos:NodePos)=>Promise<string|null>
  onUpdate:(type:string,id:string,updates:any)=>Promise<void>
  onDelete:(type:string,id:string)=>Promise<void>
  reload:()=>void
}) {
  const [positions, setPositions] = useState<PosMap>({})
  const [zoom,    setZoom]    = useState(0.85)
  const [pan,     setPan]     = useState({x:0,y:0})
  const [draggingNode, setDraggingNode] = useState<string|null>(null)
  const [dragOffset,   setDragOffset]   = useState({x:0,y:0})
  const [isPanning,    setIsPanning]    = useState(false)
  const [panStart,     setPanStart]     = useState({x:0,y:0})
  const [collapsed,    setCollapsed]    = useState<Set<string>>(new Set())
  const [quickAdd,     setQuickAdd]     = useState<{parentId:string;parentType:string;pos:NodePos}|null>(null)
  const [detail,       setDetail]       = useState<{node:any;type:string}|null>(null)
  const [highlighted,  setHighlighted]  = useState<string|null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  // Init positions
  useEffect(() => {
    if (!app || !modules.length) {
      const init: PosMap = {}; init[app.id]={x:0,y:0}; setPositions(init); return
    }
    const init = getInitialPositions(app, modules, submodules, features)
    setPositions(prev => {
      const merged = {...init}
      Object.keys(prev).forEach(id => { if(prev[id]) merged[id]=prev[id] })
      return merged
    })
  }, [app.id, modules.length, submodules.length, features.length])

  // Highlight + navigate
  const navigateTo = useCallback((id:string) => {
    setHighlighted(id)
    const pos = positions[id]
    if (pos) setPan({x:-pos.x*zoom, y:-pos.y*zoom})
    setTimeout(()=>setHighlighted(null), 2500)
  }, [positions, zoom])

  // Canvas coords from screen
  const toCanvas = (screenX:number,screenY:number): NodePos => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = rect.width/2+pan.x, cy = rect.height/2+pan.y
    return { x:(screenX-rect.left-cx)/zoom, y:(screenY-rect.top-cy)/zoom }
  }

  // Mouse handlers
  const onMouseDown = (e:React.MouseEvent, nodeId?:string) => {
    if (nodeId) {
      e.stopPropagation()
      const pos = positions[nodeId]||{x:0,y:0}
      setDraggingNode(nodeId)
      setDragOffset({x:e.clientX/zoom - pos.x, y:e.clientY/zoom - pos.y})
    } else {
      setIsPanning(true)
      setPanStart({x:e.clientX-pan.x, y:e.clientY-pan.y})
    }
  }
  const onMouseMove = (e:React.MouseEvent) => {
    if (draggingNode) {
      setPositions(p=>({...p,[draggingNode]:{x:e.clientX/zoom-dragOffset.x, y:e.clientY/zoom-dragOffset.y}}))
    } else if (isPanning) {
      setPan({x:e.clientX-panStart.x, y:e.clientY-panStart.y})
    }
  }
  const onMouseUp = () => { setDraggingNode(null); setIsPanning(false) }
  const onWheel = (e:React.WheelEvent) => {
    e.preventDefault()
    setZoom(z=>Math.max(0.2,Math.min(3,z*(1-e.deltaY*0.001))))
  }

  // Collapse toggle
  const toggleCollapse = (id:string) => setCollapsed(p=>{ const n=new Set(p); n.has(id)?n.delete(id):n.add(id); return n })

  // Get visible ids (respecting collapse)
  const visibleIds = useMemo(()=>{
    const vis = new Set<string>([app.id])
    const appMods = modules.filter(m=>m.app_id===app.id)
    appMods.forEach(m=>{
      vis.add(m.id)
      if(!collapsed.has(m.id)){
        submodules.filter(s=>s.module_id===m.id).forEach(s=>{
          vis.add(s.id)
          if(!collapsed.has(s.id)){
            features.filter(f=>f.submodule_id===s.id).forEach(f=>vis.add(f.id))
          }
        })
      }
    })
    return vis
  },[app,modules,submodules,features,collapsed])

  // Edges
  const edges = useMemo(()=>{
    const list: Array<{from:string;to:string}> = []
    modules.filter(m=>m.app_id===app.id).forEach(m=>{
      list.push({from:app.id,to:m.id})
      if(!collapsed.has(m.id)){
        submodules.filter(s=>s.module_id===m.id).forEach(s=>{
          list.push({from:m.id,to:s.id})
          if(!collapsed.has(s.id)){
            features.filter(f=>f.submodule_id===s.id).forEach(f=>list.push({from:s.id,to:f.id}))
          }
        })
      }
    })
    return list
  },[app,modules,submodules,features,collapsed])

  // Handle quick add
  const handleQuickAdd = async (name:string, desc:string, dir:{dx:number;dy:number;label:string}) => {
    if (!quickAdd) return
    const {parentId,parentType} = quickAdd
    const childType = parentType==="app"?"module":parentType==="module"?"submodule":"feature"
    const siblings = childType==="module" ? modules.filter(m=>m.app_id===app.id).length
                   : childType==="submodule" ? submodules.filter(s=>s.module_id===parentId).length
                   : features.filter(f=>f.submodule_id===parentId).length
    const parentPos = positions[parentId]||{x:0,y:0}
    const newPos = childPos(parentPos, dir, siblings+1, siblings)
    await onAdd(childType, parentId, name, desc, newPos)
    setQuickAdd(null)
    reload()
  }

  // Node click → show detail or quick add
  const handleNodeClick = (id:string, type:string, data:any, e:React.MouseEvent) => {
    e.stopPropagation()
    if ((e.target as Element).closest(".node-action")) return
    setDetail({node:data,type})
  }

  const handleSave = async (type:string,id:string,updates:any) => {
    await onUpdate(type,id,updates)
    setDetail(null)
    reload()
  }
  const handleDelete = async (type:string,id:string) => {
    if(!confirm("Hapus node ini?")) return
    await onDelete(type,id)
    setDetail(null)
    reload()
  }

  const getNodeType = (id:string) => {
    if(id===app.id) return "app"
    if(modules.find(m=>m.id===id)) return "module"
    if(submodules.find(s=>s.id===id)) return "submodule"
    return "feature"
  }
  const getNodeData = (id:string) => {
    if(id===app.id) return app
    return modules.find(m=>m.id===id)||submodules.find(s=>s.id===id)||features.find(f=>f.id===id)
  }

  const getBreadcrumb = (id:string,type:string) => {
    if(type==="module") return app.name
    if(type==="submodule"){ const d=getNodeData(id) as KbSubmodule|undefined; const m=modules.find(x=>x.id===d?.module_id); return `${app.name} › ${m?.name||""}` }
    if(type==="feature"){ const f=getNodeData(id) as KbFeature|undefined; const m=modules.find(x=>x.id===f?.module_id); const s=submodules.find(x=>x.id===f?.submodule_id); return `${app.name} › ${m?.name||""} › ${s?.name||""}` }
    return ""
  }

  const W_THRESH = 800
  const cx = "50%", cy = "50%"

  // Node render helper
  const renderNode = (id:string) => {
    if (!visibleIds.has(id)) return null
    const type = getNodeType(id)
    const data = getNodeData(id)
    if (!data) return null
    const pos = positions[id]||{x:0,y:0}
    const isApp = type==="app"
    const isHigh = highlighted===id
    const isCollapsed = collapsed.has(id)
    const sz = NODE_SIZE[type as keyof typeof NODE_SIZE]||NODE_SIZE.feature
    const img = (data as any).image_url||(data as any).image_base64
    const hasImg = !!img && !isApp
    const nodeH = hasImg ? sz.h+52 : sz.h

    const childCount = type==="module" ? submodules.filter(s=>s.module_id===id).length
                     : type==="submodule" ? features.filter(f=>f.submodule_id===id).length : 0

    return (
      <g key={id} transform={`translate(${pos.x},${pos.y})`} style={{cursor:draggingNode===id?"grabbing":"grab"}}
        onMouseDown={e=>{ if(isApp) return; onMouseDown(e,id) }}>
        {/* Highlight pulse */}
        {isHigh && <ellipse cx={0} cy={0} rx={sz.w/2+18} ry={nodeH/2+18} fill={app.color} fillOpacity={0.18}>
          <animate attributeName="rx" values={`${sz.w/2+10};${sz.w/2+22};${sz.w/2+10}`} dur="1s" repeatCount="indefinite"/>
        </ellipse>}

        {/* Shadow */}
        <ellipse cx={2} cy={4} rx={sz.w/2-4} ry={nodeH/2-2} fill="rgba(0,0,0,0.12)"/>

        {/* Node box */}
        <rect x={-sz.w/2} y={-nodeH/2} width={sz.w} height={nodeH}
          rx={isApp?22:type==="module"?14:10}
          fill={isApp?app.color:isHigh?"white":type==="module"?alpha(app.color,0.12):"var(--surface)"}
          stroke={isHigh?app.color:isApp?alpha(app.color,0.6):type==="module"?alpha(app.color,0.4):alpha(app.color,0.2)}
          strokeWidth={isHigh?2.5:isApp?2:1.5}
          onClick={e=>{ if(!isApp)handleNodeClick(id,type,data,e) }}/>

        {/* Thumbnail image */}
        {hasImg && (
          <>
            <clipPath id={`clip-${id}`}><rect x={-sz.w/2+3} y={-nodeH/2+3} width={sz.w-6} height={52} rx={8}/></clipPath>
            <image href={img} x={-sz.w/2+3} y={-nodeH/2+3} width={sz.w-6} height={52} clipPath={`url(#clip-${id})`} preserveAspectRatio="xMidYMid slice"/>
          </>
        )}

        {/* App: icon + name */}
        {isApp && (<>
          <text x={0} y={-7} textAnchor="middle" dominantBaseline="middle" fontSize={18}>{(data as KbApp).icon}</text>
          <text x={0} y={9} textAnchor="middle" dominantBaseline="middle" fontSize={12} fontWeight="800" fill="white" fontFamily="inherit">{(data as KbApp).name}</text>
        </>)}

        {/* Module/Sub/Feature: name */}
        {!isApp && (
          <text x={0} y={hasImg?nodeH/2-18:0} textAnchor="middle" dominantBaseline="middle"
            fontSize={type==="module"?12:11} fontWeight={type==="module"?"700":"600"}
            fill={type==="module"?app.color:type==="submodule"?alpha(app.color,0.85):"var(--text)"}
            fontFamily="inherit">
            {(data.name||"").length>15?(data.name||"").slice(0,14)+"…":data.name}
          </text>
        )}

        {/* Collapse toggle */}
        {!isApp && childCount>0 && (
          <g className="node-action" transform={`translate(${sz.w/2-8},${-nodeH/2+8})`}
            onClick={e=>{e.stopPropagation();toggleCollapse(id)}} style={{cursor:"pointer"}}>
            <circle r={8} fill={app.color} fillOpacity={0.15} stroke={app.color} strokeWidth={1}/>
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="700" fill={app.color}>{isCollapsed?childCount:"−"}</text>
          </g>
        )}

        {/* Add child button */}
        {!isApp && type!=="feature" && (
          <g className="node-action" transform={`translate(0,${nodeH/2+14})`}
            onClick={e=>{e.stopPropagation();setQuickAdd({parentId:id,parentType:type,pos})}} style={{cursor:"pointer"}}>
            <circle r={10} fill={app.color} fillOpacity={0.12} stroke={alpha(app.color,0.4)} strokeWidth={1.2}/>
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight="700" fill={app.color}>+</text>
          </g>
        )}

        {/* App add module button */}
        {isApp && (
          <g className="node-action" transform="translate(0,34)"
            onClick={e=>{e.stopPropagation();setQuickAdd({parentId:id,parentType:"app",pos:{x:0,y:0}})}} style={{cursor:"pointer"}}>
            <rect x={-28} y={-9} width={56} height={18} rx={9} fill={alpha(app.color,0.2)} stroke={alpha(app.color,0.5)} strokeWidth={1}/>
            <text x={0} y={0} textAnchor="middle" dominantBaseline="middle" fontSize={9} fontWeight="700" fill="white">+ Module</text>
          </g>
        )}
      </g>
    )
  }

  const allNodeIds = [app.id, ...modules.filter(m=>m.app_id===app.id).map(m=>m.id),
    ...submodules.filter(s=>s.app_id===app.id).map(s=>s.id),
    ...features.filter(f=>f.app_id===app.id).map(f=>f.id)]

  // Expose navigateTo
  useEffect(() => { (window as any).__mmNavigateTo = navigateTo },[navigateTo])

  return (
    <div ref={canvasRef} style={{ width:"100%",height:"100%",overflow:"hidden",background:"radial-gradient(circle at 50% 50%, var(--surface2) 0%, var(--bg) 70%)",position:"relative",cursor:isPanning?"grabbing":"default" }}
      onMouseDown={e=>{ if(!(e.target as Element).closest(".mm-node"))onMouseDown(e) }}
      onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
      onWheel={onWheel}>

      {/* Grid dots background */}
      <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none" }}>
        <defs>
          <pattern id="dots" x={pan.x%30} y={pan.y%30} width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="15" cy="15" r="1" fill="var(--border)" fillOpacity="0.6"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)"/>
      </svg>

      {/* Controls */}
      <div style={{ position:"absolute",top:"14px",right:"14px",zIndex:10,display:"flex",flexDirection:"column",gap:"4px" }}>
        {[{i:<ZoomIn size={13}/>,a:()=>setZoom(z=>Math.min(3,z+0.15))},{i:<ZoomOut size={13}/>,a:()=>setZoom(z=>Math.max(0.2,z-0.15))},{i:<RotateCcw size={13}/>,a:()=>{setZoom(0.85);setPan({x:0,y:0})}}].map((b,i)=>(
          <button key={i} onClick={b.a} style={{ width:"28px",height:"28px",borderRadius:"7px",border:"1px solid var(--border)",background:"var(--surface)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:"var(--text3)",boxShadow:"0 1px 4px rgba(0,0,0,0.08)" }}>{b.i}</button>
        ))}
        <div style={{ height:"1px",background:"var(--border)",margin:"2px 0" }}/>
        <div style={{ fontSize:"10px",color:"var(--text3)",textAlign:"center",fontWeight:600 }}>{Math.round(zoom*100)}%</div>
      </div>

      {/* Hint */}
      <div style={{ position:"absolute",bottom:"12px",left:"12px",fontSize:"10px",color:"var(--text3)",zIndex:10,background:"var(--surface)",padding:"4px 10px",borderRadius:"99px",border:"1px solid var(--border)" }}>
        Scroll=zoom · Drag=pan · Klik node=detail · + di bawah node=tambah child
      </div>

      {/* SVG canvas */}
      <svg width="100%" height="100%" style={{ position:"absolute",inset:0 }}>
        <g transform={`translate(${parseInt(cx.replace("%",""))*0.01*800+pan.x}, ${parseInt(cy.replace("%",""))*0.01*600+pan.y}) scale(${zoom})`}
           transform-origin="0 0">
          <g transform="translate(400, 300)">
            {/* Edges */}
            {edges.map((e,i)=>{
              const f=positions[e.from], t=positions[e.to]
              if(!f||!t) return null
              return <path key={i} d={curvePath(f.x,f.y,t.x,t.y)} fill="none" stroke={app.color} strokeWidth={1.8} strokeOpacity={0.3} strokeLinecap="round"/>
            })}
            {/* Nodes */}
            {allNodeIds.map(id=>renderNode(id))}
          </g>
        </g>
      </svg>

      {/* QuickAdd popover */}
      {quickAdd && positions[quickAdd.parentId] && (
        <QuickAdd
          x={positions[quickAdd.parentId].x} y={positions[quickAdd.parentId].y}
          zoom={zoom} pan={{x:pan.x+400*zoom+(canvasRef.current?.getBoundingClientRect().left||0),y:pan.y+300*zoom+(canvasRef.current?.getBoundingClientRect().top||0)}}
          color={app.color}
          onAdd={handleQuickAdd} onClose={()=>setQuickAdd(null)}/>
      )}

      {/* Detail modal */}
      {detail && (
        <DetailModal
          node={detail.node} type={detail.type} color={app.color}
          breadcrumb={getBreadcrumb(detail.node.id,detail.type)}
          onClose={()=>setDetail(null)}
          onSave={(updates)=>handleSave(detail.type,detail.node.id,updates)}
          onDelete={()=>handleDelete(detail.type,detail.node.id)}/>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ── MAIN PAGE ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function KnowledgeBasePage() {
  const [apps,       setApps]       = useState<KbApp[]>([])
  const [modules,    setModules]    = useState<KbModule[]>([])
  const [submodules, setSubmodules] = useState<KbSubmodule[]>([])
  const [features,   setFeatures]   = useState<KbFeature[]>([])
  const [loading,    setLoading]    = useState(true)
  const [activeApp,  setActiveApp]  = useState<string>("")
  const [searchOpen, setSearchOpen] = useState(false)

  const load = useCallback(async()=>{
    setLoading(true)
    const [a,m,s,f] = await Promise.all([
      supabase.from("kb_apps").select("*").order("sort_order"),
      supabase.from("kb_modules").select("*").order("sort_order"),
      supabase.from("kb_submodules").select("*").order("sort_order"),
      supabase.from("kb_features").select("*").order("created_at"),
    ])
    if(a.data){ setApps(a.data); if(!activeApp&&a.data.length)setActiveApp(a.data[0].id) }
    if(m.data)setModules(m.data)
    if(s.data)setSubmodules(s.data)
    if(f.data)setFeatures(f.data)
    setLoading(false)
  },[])
  useEffect(()=>{ load() },[load])

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(()=>{
    const handler = (e:KeyboardEvent)=>{ if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setSearchOpen(true)} }
    window.addEventListener("keydown",handler)
    return ()=>window.removeEventListener("keydown",handler)
  },[])

  const app = apps.find(a=>a.id===activeApp)

  const addNode = async (type:string,parentId:string,name:string,desc:string,pos:NodePos): Promise<string|null>=>{
    let newId: string|null = null
    if(type==="module"){ const {data}=await supabase.from("kb_modules").insert({app_id:app!.id,name,description:desc}).select().single(); newId=data?.id||null }
    else if(type==="submodule"){ const {data}=await supabase.from("kb_submodules").insert({app_id:app!.id,module_id:parentId,name,description:desc}).select().single(); newId=data?.id||null }
    else if(type==="feature"){ const sub=submodules.find(s=>s.id===parentId); const {data}=await supabase.from("kb_features").insert({app_id:app!.id,module_id:sub?.module_id,submodule_id:parentId,name,description:desc,tags:[],image_url:"",image_base64:""}).select().single(); newId=data?.id||null }
    return newId
  }

  const updateNode = async (type:string,id:string,updates:any)=>{
    const table = type==="module"?"kb_modules":type==="submodule"?"kb_submodules":type==="app"?"kb_apps":"kb_features"
    await supabase.from(table).update(updates).eq("id",id)
  }

  const deleteNode = async (type:string,id:string)=>{
    const table = type==="module"?"kb_modules":type==="submodule"?"kb_submodules":type==="app"?"kb_apps":"kb_features"
    await supabase.from(table).delete().eq("id",id)
  }

  const navigateTo = (id:string) => {
    // Find which app this node belongs to
    const mod = modules.find(m=>m.id===id)
    const sub = submodules.find(s=>s.id===id)
    const feat = features.find(f=>f.id===id)
    const appId = mod?.app_id || sub?.app_id || feat?.app_id
    if (appId && appId !== activeApp) setActiveApp(appId)
    setTimeout(()=>{ (window as any).__mmNavigateTo?.(id) }, 200)
  }

  return (
    <div style={{ height:"100vh",display:"flex",flexDirection:"column",fontFamily:"'Plus Jakarta Sans',sans-serif",background:"var(--bg)",overflow:"hidden" }}>

      {/* ── TOP BAR ── */}
      <div style={{ background:"var(--surface)",borderBottom:"1px solid var(--border)",padding:"0 16px",display:"flex",alignItems:"center",gap:"10px",height:"50px",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
          <div style={{ width:"28px",height:"28px",borderRadius:"7px",background:"linear-gradient(135deg,#6366F1,#8B5CF6)",display:"flex",alignItems:"center",justifyContent:"center" }}>
            <span style={{ fontSize:"13px" }}>🧠</span>
          </div>
          <span style={{ fontSize:"13px",fontWeight:800,color:"var(--text)" }}>Knowledge Base</span>
        </div>

        {/* App tabs */}
        <div style={{ display:"flex",gap:"3px",marginLeft:"8px" }}>
          {apps.map(a=>(
            <button key={a.id} onClick={()=>setActiveApp(a.id)}
              style={{ display:"flex",alignItems:"center",gap:"5px",padding:"5px 13px",borderRadius:"7px",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:"12px",fontWeight:700,transition:"all 0.15s",
                background:activeApp===a.id?a.color:"transparent",
                color:activeApp===a.id?"white":"var(--text3)",
                boxShadow:activeApp===a.id?`0 2px 8px ${alpha(a.color,0.35)}`:"none" }}>
              <span style={{ fontSize:"13px" }}>{a.icon}</span>{a.name}
            </button>
          ))}
        </div>

        {/* Search button */}
        <button onClick={()=>setSearchOpen(true)}
          style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:"7px",padding:"6px 14px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text3)",fontSize:"12px",cursor:"pointer",fontFamily:"inherit",transition:"all 0.15s" }}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.borderColor="#6366F1"}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.borderColor="var(--border)"}>
          <Search size={13}/>
          <span>Cari fitur...</span>
          <span style={{ fontSize:"10px",background:"var(--surface3)",padding:"1px 6px",borderRadius:"5px",fontWeight:600 }}>⌘K</span>
        </button>
      </div>

      {/* ── CANVAS ── */}
      <div style={{ flex:1,overflow:"hidden",position:"relative" }}>
        {loading ? (
          <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"var(--text3)",fontSize:"14px",gap:"10px" }}>
            <div style={{ width:"18px",height:"18px",border:"2px solid #6366F1",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite" }}/>
            Memuat...
          </div>
        ) : app ? (
          <MindMapCanvas
            app={app}
            modules={modules.filter(m=>m.app_id===app.id)}
            submodules={submodules.filter(s=>s.app_id===app.id)}
            features={features.filter(f=>f.app_id===app.id)}
            onAdd={addNode} onUpdate={updateNode} onDelete={deleteNode}
            reload={load}/>
        ) : null}
      </div>

      {/* ── SEARCH ── */}
      {searchOpen && (
        <SearchBox apps={apps} modules={modules} submodules={submodules} features={features}
          onNavigate={navigateTo} onClose={()=>setSearchOpen(false)}/>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}