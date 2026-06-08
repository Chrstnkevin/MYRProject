"use client"
// PATH: src/app/dashboard/our-system/page.tsx

import { useEffect, useState, useRef } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
const STORAGE_BUCKET = "our-system-images"

const APPS = [
  { name:"Matrix",     icon:"ti-table",          color:"#378ADD", bg:"#E6F1FB", desc:"Sistem manajemen distribusi dan monitoring PHI" },
  { name:"Ficom Lite", icon:"ti-file-invoice",   color:"#1D9E75", bg:"#E1F5EE", desc:"Versi ringkas Ficom untuk input data lapangan" },
  { name:"Ficom",      icon:"ti-building-store", color:"#BA7517", bg:"#FAEEDA", desc:"Sistem keuangan dan operasional distributor" },
  { name:"SFA",        icon:"ti-map-pin",        color:"#D4537E", bg:"#FBEAF0", desc:"Sales Force Automation untuk tim penjualan lapangan" },
]
const APP_COLORS: Record<string,string> = { "Matrix":"#378ADD","Ficom Lite":"#1D9E75","Ficom":"#BA7517","SFA":"#D4537E" }
const APP_BG:     Record<string,string> = { "Matrix":"#E6F1FB","Ficom Lite":"#E1F5EE","Ficom":"#FAEEDA","SFA":"#FBEAF0" }
const APP_ICONS:  Record<string,string> = { "Matrix":"ti-table","Ficom Lite":"ti-file-invoice","Ficom":"ti-building-store","SFA":"ti-map-pin" }

const DIKW_LEVELS = [
  { key:"data",        label:"Data",        sub:"Raw facts & angka",   bg:"#E6F1FB", color:"#185FA5" },
  { key:"information", label:"Information", sub:"Data yang diolah",     bg:"#E1F5EE", color:"#0F6E56" },
  { key:"knowledge",   label:"Knowledge",   sub:"Cara pakai & SOP",     bg:"#FAEEDA", color:"#854F0B" },
  { key:"wisdom",      label:"Wisdom",      sub:"Best practice & tips", bg:"#FBEAF0", color:"#72243E" },
]
const DIKW_TITLES: Record<string,string> = {
  data:"Raw facts", information:"Data yang diolah", knowledge:"Cara pakai & SOP", wisdom:"Best practice & tips"
}

type Node    = { id:string; parent_id:string|null; app_name:string; title:string; icon:string; order_index:number; children?:Node[] }
type Content = { level:string; text_content:string; image_urls:string[]; updated_by:string|null; updated_at:string }
type Relation= { related_id:string; description:string; detected_by:string; related_node?:Node }
type Message = { role:"user"|"ai"; text:string }
type AppStats= { modules:number; sections:number; subsections:number; contentFilled:number }

async function compressImage(file: File, maxPx=1200, quality=0.85): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let {width,height} = img
      if (width>maxPx||height>maxPx) {
        if (width>height){height=Math.round(height*maxPx/width);width=maxPx}
        else{width=Math.round(width*maxPx/height);height=maxPx}
      }
      const canvas=document.createElement("canvas")
      canvas.width=width;canvas.height=height
      canvas.getContext("2d")!.drawImage(img,0,0,width,height)
      canvas.toBlob(blob=>{
        if(!blob){resolve(file);return}
        resolve(new File([blob],file.name.replace(/\.[^.]+$/,".jpg"),{type:"image/jpeg"}))
      },"image/jpeg",quality)
    }
    img.src=url
  })
}

// ── PDF export (no setOpacity) ────────────────────────────
async function exportToPDF(appName:string, nodes:Node[], allContents:Record<string,Content[]>) {
  const jspdfModule = await import("jspdf")
  const jsPDF = (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || (jspdfModule as any).default
  const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"a4"})

  const W=210, margin=20, lineW=W-margin*2
  let y=margin, pageNum=1

  const ac = APP_COLORS[appName]||"#378ADD"
  const hexRGB = (hex:string):[number,number,number] => [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)]
  const [cr,cg,cb] = hexRGB(ac)

  const newPage = () => {
    doc.addPage(); pageNum++; y=margin
    doc.setFontSize(8); doc.setTextColor(180,180,180)
    doc.text(`${appName} — Our System PHI`, margin, 290)
    doc.text(String(pageNum), W-margin, 290, {align:"right"})
    doc.setTextColor(40,40,40)
  }
  const check = (needed=20) => { if (y+needed>277) newPage() }

  // COVER
  doc.setFillColor(cr,cg,cb)
  doc.rect(0,0,W,70,"F")
  doc.setFontSize(30); doc.setTextColor(255,255,255); doc.setFont("helvetica","bold")
  doc.text(appName, margin, 36)
  doc.setFontSize(13); doc.setFont("helvetica","normal")
  doc.text("Knowledge Base — Our System PHI", margin, 48)
  doc.setFontSize(9)
  doc.text(`Diekspor: ${new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"})}`, margin, 58)
  y=86; doc.setTextColor(40,40,40)

  // DAFTAR ISI
  doc.setFontSize(16); doc.setFont("helvetica","bold"); doc.setTextColor(cr,cg,cb)
  doc.text("Daftar Isi", margin, y); y+=7
  doc.setDrawColor(cr,cg,cb); doc.setLineWidth(0.4)
  doc.line(margin,y,margin+lineW,y); y+=8
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.setTextColor(60,60,60)
  let tocN=1
  function printTOC(ns:Node[], depth=0) {
    for (const n of ns) {
      if (!n.parent_id){printTOC(n.children||[],depth);continue}
      check(7)
      if(depth===0){doc.setFont("helvetica","bold");doc.text(`${tocN}. ${n.title}`,margin+depth*5,y);tocN++}
      else{doc.setFont("helvetica","normal");doc.text(`${"   ".repeat(depth)}${n.title}`,margin+depth*5,y)}
      y+=5.5
      printTOC(n.children||[],depth+1)
    }
  }
  printTOC(nodes); y+=8

  // CONTENT
  let chapN=1
  async function renderNode(node:Node, depth:number) {
    if (!node.parent_id){for(const c of node.children||[])await renderNode(c,0);return}
    if (depth===0) {
      newPage()
      doc.setFillColor(cr,cg,cb)
      doc.rect(0,y-4,W,14,"F")
      doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont("helvetica","bold")
      doc.text(`${chapN}. ${node.title}`, margin, y+6)
      chapN++; y+=18; doc.setTextColor(40,40,40)
    } else {
      check(14)
      doc.setFontSize(12); doc.setFont("helvetica","bold"); doc.setTextColor(cr,cg,cb)
      doc.text(node.title, margin+(depth-1)*4, y)
      y+=7; doc.setTextColor(40,40,40)
    }
    const nc = allContents[node.id]||[]
    for (const lv of DIKW_LEVELS) {
      const c = nc.find(x=>x.level===lv.key)
      if (!c?.text_content && !c?.image_urls?.length) continue
      check(12)
      const [lr,lg,lb] = hexRGB(lv.color)
      doc.setFillColor(lr,lg,lb)
      doc.roundedRect(margin,y-3,26,7,1.5,1.5,"F")
      doc.setFontSize(7); doc.setFont("helvetica","bold"); doc.setTextColor(255,255,255)
      doc.text(lv.label.toUpperCase(), margin+2, y+1.5)
      y+=8
      if (c?.text_content) {
        doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.setTextColor(60,60,60)
        const lines = doc.splitTextToSize(c.text_content, lineW) as string[]
        for (const line of lines){check(6);doc.text(line,margin,y);y+=5.5}
        y+=3
      }
      for (const imgUrl of (c?.image_urls||[])) {
        try {
          const resp = await fetch(imgUrl)
          const blob = await resp.blob()
          const b64  = await new Promise<string>(res=>{const r=new FileReader();r.onload=()=>res((r.result as string).split(",")[1]);r.readAsDataURL(blob)})
          const imgType = blob.type.includes("png")?"PNG":"JPEG"
          const tmp = new Image()
          await new Promise(res=>{tmp.onload=res;tmp.src=URL.createObjectURL(blob)})
          const aspect=tmp.width/tmp.height
          let iW=lineW, iH=lineW/aspect
          if(iH>75){iH=75;iW=75*aspect}
          check(iH+6)
          doc.addImage(b64,imgType,margin,y,iW,iH)
          y+=iH+5
        } catch{}
      }
    }
    for (const child of node.children||[]) await renderNode(child,depth+1)
  }
  for (const node of nodes) await renderNode(node,0)
  doc.setFontSize(8); doc.setTextColor(180,180,180)
  doc.text(`${appName} — Our System PHI`, margin, 290)
  doc.text(String(pageNum), W-margin, 290, {align:"right"})
  doc.save(`${appName.replace(/ /g,"_")}_Knowledge_Base.pdf`)
}

export default function OurSystemPage() {
  const [screen, setScreen]               = useState<"home"|"app">("home")
  const [activeApp, setActiveApp]         = useState("")
  const [tree, setTree]                   = useState<Node[]>([])
  const [flatNodes, setFlatNodes]         = useState<Node[]>([])
  const [selectedNode, setSelectedNode]   = useState<Node|null>(null)
  const [contents, setContents]           = useState<Content[]>([])
  const [allContents, setAllContents]     = useState<Record<string,Content[]>>({})
  const [relations, setRelations]         = useState<Relation[]>([])
  const [openNodes, setOpenNodes]         = useState<Set<string>>(new Set())
  const [openDikw, setOpenDikw]           = useState<Set<string>>(new Set(["data"]))
  const [isAdmin, setIsAdmin]             = useState(false)
  const [editingContent, setEditingContent] = useState<Record<string,string>>({})
  const [isSaving, setIsSaving]           = useState(false)
  const [isLoadingTree, setIsLoadingTree] = useState(false)
  const [uploadingImg, setUploadingImg]   = useState<string|null>(null)
  const [isExporting, setIsExporting]     = useState(false)
  const [appStats, setAppStats]           = useState<Record<string,AppStats>>({})

  // Add / Edit node modal
  const [showAddModal, setShowAddModal]   = useState(false)
  const [addParentId, setAddParentId]     = useState<string|null>(null)
  const [addParentLabel, setAddParentLabel] = useState("")
  const [addTitle, setAddTitle]           = useState("")
  const [addIcon, setAddIcon]             = useState("ti-file")
  const [isAdding, setIsAdding]           = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<Node|null>(null)
  // Edit node
  const [editNode, setEditNode]           = useState<Node|null>(null)
  const [editTitle, setEditTitle]         = useState("")
  const [editIcon, setEditIcon]           = useState("ti-file")
  const [isSavingEdit, setIsSavingEdit]   = useState(false)

  // AI
  const [homeMessages, setHomeMessages]   = useState<Message[]>([{ role:"ai", text:"Halo! Saya Aria 👋 Saya bisa menjawab pertanyaan tentang semua sistem PHI — Matrix, Ficom Lite, Ficom, dan SFA. Silakan tanya apa saja! 😊" }])
  const [homeInput, setHomeInput]         = useState("")
  const [homeLoading, setHomeLoading]     = useState(false)
  const [appMessages, setAppMessages]     = useState<Message[]>([])
  const [appInput, setAppInput]           = useState("")
  const [appLoading, setAppLoading]       = useState(false)
  const [detectedLang, setDetectedLang]   = useState<"ID"|"EN">("ID")
  const homeMsgsRef = useRef<HTMLDivElement>(null)
  const appMsgsRef  = useRef<HTMLDivElement>(null)

  useEffect(() => { if(localStorage.getItem("our_system_admin")==="true") setIsAdmin(true); loadAppStats() }, [])
  useEffect(() => { if(homeMsgsRef.current) homeMsgsRef.current.scrollTop=homeMsgsRef.current.scrollHeight }, [homeMessages])
  useEffect(() => { if(appMsgsRef.current)  appMsgsRef.current.scrollTop=appMsgsRef.current.scrollHeight  }, [appMessages])

  // ── Load stats for home cards ──────────────────────────
  async function loadAppStats() {
    const { data: nodes } = await supabase.from("our_system_nodes").select("id,app_name,parent_id,title")
    const { data: conts } = await supabase.from("our_system_content").select("node_id,text_content,image_urls")
    if (!nodes) return

    // Build parent map untuk hitung depth
    const parentMap: Record<string, string|null> = {}
    nodes.forEach((n:any) => { parentMap[n.id] = n.parent_id })

    function getDepth(id: string): number {
      let depth = 0; let cur = id
      while (parentMap[cur] !== null && parentMap[cur] !== undefined) {
        depth++; cur = parentMap[cur]!
        if (depth > 10) break // safety
      }
      return depth
    }

    const stats: Record<string,AppStats> = {}
    APPS.forEach(a => { stats[a.name] = { modules:0, sections:0, subsections:0, contentFilled:0 } })

    console.log("🔍 All nodes from Supabase:", nodes.map((n:any) => ({
      title: n.title, app_name: n.app_name, parent_id: n.parent_id, depth: getDepth(n.id)
    })))

    nodes.forEach((n:any) => {
      const s = stats[n.app_name]; if (!s) return
      const depth = getDepth(n.id)
      if (depth === 0) return        // root app node (Matrix, SFA dll) — skip
      else if (depth === 1) s.modules++
      else if (depth === 2) s.sections++
      else s.subsections++
    })

    console.log("📊 Stats result:", stats)

    const filledNodes = new Set(
      conts?.filter((c:any) => c.text_content || (c.image_urls?.length > 0))
           .map((c:any) => c.node_id) || []
    )
    nodes.forEach((n:any) => {
      if (filledNodes.has(n.id) && stats[n.app_name]) stats[n.app_name].contentFilled++
    })
    setAppStats(stats)
  }

  function buildTree(nodes:Node[]): Node[] {
    const map:Record<string,Node>={}
    nodes.forEach(n=>{map[n.id]={...n,children:[]}})
    const roots:Node[]=[]
    nodes.forEach(n=>{if(n.parent_id&&map[n.parent_id])map[n.parent_id].children!.push(map[n.id]);else if(!n.parent_id)roots.push(map[n.id])})
    return roots
  }
  function flatten(nodes:Node[]):Node[]{const r:Node[]=[];function w(ns:Node[]){ns.forEach(n=>{r.push(n);if(n.children)w(n.children)})};w(nodes);return r}

  async function enterApp(appName:string) {
    setActiveApp(appName);setScreen("app");setSelectedNode(null);setTree([]);setIsLoadingTree(true)
    const {data} = await supabase.from("our_system_nodes").select("*").eq("app_name",appName).order("order_index")
    if(!data){setIsLoadingTree(false);return}
    const roots=buildTree(data); setTree(roots); setFlatNodes(flatten(roots)); setIsLoadingTree(false)
    setAppMessages([{role:"ai",text:`Halo! Saya Aria 👋 Pilih topik dari sidebar atau tanya langsung tentang ${appName} 😊`}])
    // Load all contents
    // Get all node IDs for this app first, then fetch their content
    const appNodeIds = (data||[]).map((n:any)=>n.id)
    let allC: any[] = []
    if (appNodeIds.length > 0) {
      const {data:cData} = await supabase.from("our_system_content").select("*").in("node_id", appNodeIds)
      allC = cData || []
    }
    const grouped:Record<string,Content[]>={}
    allC.forEach((c:any)=>{if(!grouped[c.node_id])grouped[c.node_id]=[];grouped[c.node_id].push(c)})
    setAllContents(grouped)
    // auto-select
    const first=roots[0]
    if(first){
      setOpenNodes(new Set([first.id]))
      const child=first.children?.[0]
      if(child){if(!child.children?.length)doSelect(child,data);else{setOpenNodes(new Set([first.id,child.id]));if(child.children[0])doSelect(child.children[0],data)}}
    }
  }

  async function reloadTree() {
    const {data}=await supabase.from("our_system_nodes").select("*").eq("app_name",activeApp).order("order_index")
    if(!data)return data
    const roots=buildTree(data);setTree(roots);setFlatNodes(flatten(roots));return data
  }

  function doSelect(node:Node,allRaw:Node[]){
    setSelectedNode(node)
    setAppMessages([{role:"ai",text:`Halo! Saya Aria 👋 Siap bantu soal **${node.title}** di ${node.app_name}. Tanya apa saja 😊`}])
    setAppInput("")
    loadContent(node.id)
    loadRelations(node.id,allRaw)
  }
  function selectNode(node:Node){
    setSelectedNode(node)
    setAppMessages([{role:"ai",text:`Halo! Saya Aria 👋 Siap bantu soal **${node.title}** di ${node.app_name}. Tanya apa saja 😊`}])
    setAppInput("")
    loadContent(node.id)
    supabase.from("our_system_nodes").select("*").eq("app_name",activeApp).then(({data})=>{if(data)loadRelations(node.id,data)})
  }

  async function loadContent(nodeId:string){
    const {data}=await supabase.from("our_system_content").select("*").eq("node_id",nodeId)
    setContents(data||[])
    const e:Record<string,string>={}
    DIKW_LEVELS.forEach(l=>{e[l.key]=data?.find(c=>c.level===l.key)?.text_content||""})
    setEditingContent(e)
  }
  async function loadRelations(nodeId:string,allRaw:Node[]){
    const {data}=await supabase.from("our_system_relations").select("*").eq("node_id",nodeId)
    if(!data){setRelations([]);return}
    const m:Record<string,Node>={};allRaw.forEach(n=>{m[n.id]=n})
    setRelations(data.map(r=>({...r,related_node:m[r.related_id]})))
  }
  async function saveContent(level:string){
    if(!selectedNode)return
    setIsSaving(true)
    await supabase.from("our_system_content").upsert({node_id:selectedNode.id,level,text_content:editingContent[level]||"",updated_by:"admin",updated_at:new Date().toISOString()},{onConflict:"node_id,level"})
    await loadContent(selectedNode.id)
    await loadAppStats()
    setIsSaving(false)
  }
  async function uploadImage(level:string,file:File){
    if(!selectedNode)return
    setUploadingImg(level)
    try{
      const c=await compressImage(file)
      const path=`${selectedNode.id}/${level}/${Date.now()}.jpg`
      const {error}=await supabase.storage.from(STORAGE_BUCKET).upload(path,c)
      if(error)throw error
      const {data:u}=supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
      const ex=contents.find(c=>c.level===level)
      await supabase.from("our_system_content").upsert({node_id:selectedNode.id,level,text_content:editingContent[level]||"",image_urls:[...(ex?.image_urls||[]),u.publicUrl],updated_by:"admin",updated_at:new Date().toISOString()},{onConflict:"node_id,level"})
      await loadContent(selectedNode.id)
    }catch(e){console.error(e)}
    setUploadingImg(null)
  }
  // ── Paste image (Ctrl+V) ─────────────────────────────
  function usePasteUpload(level: string) {
    return (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) uploadImage(level, file)
          break
        }
      }
    }
  }

  async function deleteImage(level:string,url:string){
    if(!selectedNode)return
    const ex=contents.find(c=>c.level===level)
    await supabase.from("our_system_content").upsert({node_id:selectedNode.id,level,text_content:editingContent[level]||"",image_urls:(ex?.image_urls||[]).filter(u=>u!==url),updated_by:"admin",updated_at:new Date().toISOString()},{onConflict:"node_id,level"})
    await loadContent(selectedNode.id)
  }

  // ── Add / Delete node ──────────────────────────────────
  function openAddModal(parentId:string|null, parentLabel="") {
    setAddParentId(parentId); setAddParentLabel(parentLabel); setAddTitle(""); setAddIcon("ti-file"); setShowAddModal(true)
  }
  async function submitAddNode(){
    if(!addTitle.trim())return
    setIsAdding(true)
    const {data:siblings}=await supabase.from("our_system_nodes").select("order_index").eq("app_name",activeApp).eq("parent_id",addParentId||null).order("order_index",{ascending:false}).limit(1)
    await supabase.from("our_system_nodes").insert({app_name:activeApp,title:addTitle.trim(),icon:addIcon,parent_id:addParentId,order_index:((siblings?.[0]?.order_index||0)+1)})
    setShowAddModal(false);setIsAdding(false)
    const data=await reloadTree()
    await loadAppStats()
    // if parent was open, keep it open
    if(addParentId) setOpenNodes(prev=>{const n=new Set(prev);n.add(addParentId!);return n})
  }
  async function deleteNode(node:Node){
    await supabase.from("our_system_nodes").delete().eq("id",node.id)
    if(selectedNode?.id===node.id)setSelectedNode(null)
    setDeleteConfirm(null)
    await reloadTree()
    await loadAppStats()
  }

  function openEditModal(node:Node){
    setEditNode(node)
    setEditTitle(node.title)
    setEditIcon(node.icon||"ti-file")
  }

  async function saveEditNode(){
    if(!editNode||!editTitle.trim())return
    setIsSavingEdit(true)
    await supabase.from("our_system_nodes").update({title:editTitle.trim(),icon:editIcon,updated_at:new Date().toISOString()}).eq("id",editNode.id)
    setEditNode(null)
    setIsSavingEdit(false)
    await reloadTree()
    // update selectedNode title if it was the edited one
    if(selectedNode?.id===editNode.id) setSelectedNode(prev=>prev?{...prev,title:editTitle.trim(),icon:editIcon}:prev)
  }

  // ── Export ─────────────────────────────────────────────
  async function handleExport(){
    setIsExporting(true)
    try{ await exportToPDF(activeApp,tree,allContents) }catch(e){console.error(e)}
    setIsExporting(false)
  }

  // ── AI ─────────────────────────────────────────────────
  function detectLang(t:string):"EN"|"ID"{
    const en=["how","what","why","when","where","who","is","are","can","does","do","tell","explain","show","help","please","give","list"]
    return en.some(w=>t.toLowerCase().split(/\s+/).includes(w))?"EN":"ID"
  }
  async function sendHomeMessage(){
    if(!homeInput.trim()||homeLoading)return
    const msg=homeInput.trim()
    setHomeMessages(prev=>[...prev,{role:"user",text:msg}]);setHomeInput("");setHomeLoading(true)
    const {data:allNodes}=await supabase.from("our_system_nodes").select("id,title,app_name")
    const {data:allC}=await supabase.from("our_system_content").select("node_id,level,text_content")
    const nodeMap:Record<string,any>={}
    allNodes?.forEach((n:any)=>{nodeMap[n.id]=n})
    const byApp:Record<string,string[]>={};APPS.forEach(a=>{byApp[a.name]=[]})
    allC?.forEach((c:any)=>{
      const node=nodeMap[c.node_id]
      if(node?.app_name&&c.text_content)byApp[node.app_name]?.push(`[${node.title}-${c.level}]:${c.text_content}`)
    })
    const ctx=APPS.map(a=>byApp[a.name].length?`=== ${a.name} ===\n${byApp[a.name].join("\n")}`:`=== ${a.name} ===\n(Belum ada konten)`).join("\n\n")
    const lang=detectLang(msg)
    try{
      const res=await fetch("/api/aria",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:`You are Aria, PHI's assistant. Knowledge:\n${ctx}\nRespond in same language as user, be friendly, never make up info.`,messages:[{role:"user",content:msg}]})})
      const d=await res.json()
      setHomeMessages(prev=>[...prev,{role:"ai",text:d.content?.[0]?.text||(lang==="EN"?"Sorry.":"Maaf.")}])
    }catch{setHomeMessages(prev=>[...prev,{role:"ai",text:"Error. Coba lagi."}])}
    setHomeLoading(false)
  }
  async function sendAppMessage(){
    if(!appInput.trim()||!selectedNode||appLoading)return
    const msg=appInput.trim();const lang=detectLang(msg)
    setDetectedLang(lang);setAppMessages(prev=>[...prev,{role:"user",text:msg}]);setAppInput("");setAppLoading(true)
    const ctx=DIKW_LEVELS.map(l=>{const c=contents.find(x=>x.level===l.key);return c?.text_content?`[${l.label}]\n${c.text_content}`:null}).filter(Boolean).join("\n\n")
    const relCtx=relations.length>0?"\nRelated:\n"+relations.map(r=>`- ${r.related_node?.app_name}/${r.related_node?.title}: ${r.description}`).join("\n"):""
    try{
      const res=await fetch("/api/aria",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({system:`You are Aria for PHI's ${activeApp}.\nTopic: "${selectedNode.title}".\nKnowledge:\n${ctx||"No content."}${relCtx}\nRespond in same language, focus on ${activeApp}, never make up info.`,messages:[{role:"user",content:msg}]})})
      const d=await res.json()
      setAppMessages(prev=>[...prev,{role:"ai",text:d.content?.[0]?.text||(lang==="EN"?"Sorry.":"Maaf.")}])
    }catch{setAppMessages(prev=>[...prev,{role:"ai",text:"Error. Coba lagi."}])}
    setAppLoading(false)
  }

  function toggleOpen(id:string){setOpenNodes(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n})}
  function toggleDikw(key:string){setOpenDikw(prev=>{const n=new Set(prev);n.has(key)?n.delete(key):n.add(key);return n})}
  function getBreadcrumb(node:Node):string[]{
    const p=[node.title];let cur=node
    while(cur.parent_id){const par=flatNodes.find(n=>n.id===cur.parent_id);if(!par)break;if(par.parent_id!==null)p.unshift(par.title);cur=par}
    return p
  }

  // ── Tree render ────────────────────────────────────────
  function renderTree(nodes:Node[], depth=0): React.ReactNode {
    return nodes.map(node=>{
      const hasChildren=(node.children?.length||0)>0
      const isOpen=openNodes.has(node.id)
      const isSel=selectedNode?.id===node.id
      const isRoot=node.parent_id===null
      const ac=APP_COLORS[activeApp]||"#888"

      // ── ROOT node (Matrix, SFA, dll) ──
      if(isRoot) return (
        <div key={node.id}>
          <div style={{display:"flex",alignItems:"center",padding:"2px 6px 2px 0"}}>
            <div onClick={()=>toggleOpen(node.id)} style={{flex:1,display:"flex",alignItems:"center",gap:6,padding:"6px 4px 6px 14px",fontSize:12,fontWeight:700,color:"var(--text)",cursor:"pointer",userSelect:"none",borderRadius:6,minWidth:0}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="var(--surface2)"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent"}}>
              <span style={{fontSize:10,color:"var(--text3)",display:"inline-block",transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.2s",flexShrink:0,userSelect:"none"}}>▶</span>
              <span style={{width:8,height:8,borderRadius:"50%",background:ac,flexShrink:0,display:"inline-block"}}/>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{node.title}</span>
            </div>
            {isAdmin&&(
              <div style={{display:"flex",gap:2,flexShrink:0}}>
                <button onClick={e=>{e.stopPropagation();openAddModal(node.id,node.title)}}
                  title={`+ Tambah di ${node.title}`}
                  style={{width:26,height:26,borderRadius:6,background:ac+"18",border:`1px solid ${ac}40`,cursor:"pointer",color:ac,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",fontSize:12,fontWeight:700}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=ac+"35"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=ac+"18"}}>+</button>
                <button onClick={e=>{e.stopPropagation();openEditModal(node)}}
                  title={`Edit ${node.title}`}
                  style={{width:26,height:26,borderRadius:6,background:"#FEF3C7",border:"1px solid #FDE68A",cursor:"pointer",color:"#92400E",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",fontSize:11}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#FDE68A"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#FEF3C7"}}>✏️</button>
                <button onClick={e=>{e.stopPropagation();setDeleteConfirm(node)}}
                  title={`Hapus ${node.title}`}
                  style={{width:26,height:26,borderRadius:6,background:"#FEE2E2",border:"1px solid #FECACA",cursor:"pointer",color:"#EF4444",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",fontSize:11}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#FECACA"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#FEE2E2"}}>🗑️</button>
              </div>
            )}
          </div>
          {isOpen&&<div style={{paddingLeft:10}}>{renderTree(node.children||[],depth+1)}</div>}
        </div>
      )

      // ── CHILD node ──
      const fs=depth>=2?11:12
      return (
        <div key={node.id}>
          <div style={{display:"flex",alignItems:"center",margin:"1px 4px",gap:2}}>
            <div onClick={()=>{if(hasChildren)toggleOpen(node.id);else selectNode(node)}}
              style={{flex:1,display:"flex",alignItems:"center",gap:5,padding:`${depth>=2?4:5}px 6px`,fontSize:fs,cursor:"pointer",borderRadius:6,position:"relative",color:isSel?ac:"var(--text2)",fontWeight:isSel?600:400,background:isSel?(APP_BG[activeApp]+"80"):"transparent",transition:"background 0.15s",minWidth:0}}
              onMouseEnter={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background="var(--surface2)"}}
              onMouseLeave={e=>{if(!isSel)(e.currentTarget as HTMLElement).style.background="transparent"}}>
              {isSel&&<span style={{position:"absolute",left:-4,top:"50%",transform:"translateY(-50%)",width:3,height:14,borderRadius:2,background:ac}}/>}
              <i className={`ti ${node.icon||"ti-file"}`} style={{fontSize:fs-1,opacity:0.7,flexShrink:0}}/>
              <span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{node.title}</span>
              {hasChildren&&<span style={{fontSize:9,color:"var(--text3)",display:"inline-block",transform:isOpen?"rotate(90deg)":"none",transition:"transform 0.2s",flexShrink:0,userSelect:"none"}}>▶</span>}
            </div>
            {isAdmin&&(
              <div style={{display:"flex",gap:2,flexShrink:0}}>
                <button onClick={e=>{e.stopPropagation();openAddModal(node.id,node.title)}}
                  title={`+ Tambah sub di ${node.title}`}
                  style={{width:22,height:22,borderRadius:5,background:ac+"18",border:`1px solid ${ac}40`,cursor:"pointer",color:ac,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",fontSize:12,fontWeight:700}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=ac+"35"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background=ac+"18"}}>+</button>
                <button onClick={e=>{e.stopPropagation();openEditModal(node)}}
                  title={`Edit ${node.title}`}
                  style={{width:22,height:22,borderRadius:5,background:"#FEF3C7",border:"1px solid #FDE68A",cursor:"pointer",color:"#92400E",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",fontSize:11}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#FDE68A"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#FEF3C7"}}>✏️</button>
                <button onClick={e=>{e.stopPropagation();setDeleteConfirm(node)}}
                  title={`Hapus ${node.title}`}
                  style={{width:22,height:22,borderRadius:5,background:"#FEE2E2",border:"1px solid #FECACA",cursor:"pointer",color:"#EF4444",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s",fontSize:11}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="#FECACA"}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="#FEE2E2"}}>🗑️</button>
              </div>
            )}
          </div>
          {hasChildren&&isOpen&&<div style={{paddingLeft:12}}>{renderTree(node.children||[],depth+1)}</div>}
        </div>
      )
    })
  }

  const appColor=APP_COLORS[activeApp]||"#888"
  const breadcrumb=selectedNode?getBreadcrumb(selectedNode):[]

  // ════════════════ SCREEN 1 — HOME ════════════════════
  if(screen==="home") return (
    <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 64px)",background:"var(--bg)",fontFamily:"'Plus Jakarta Sans', sans-serif",overflow:"hidden"}}>
      <div style={{padding:"18px 28px 12px",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#534AB7,#7C6FD4)",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:15}}>📚</span>
          </div>
          <div>
            <h1 style={{fontSize:18,fontWeight:800,color:"var(--text)",letterSpacing:"-0.02em"}}>Our System</h1>
            <p style={{fontSize:11,color:"var(--text3)"}}>Knowledge base sistem PHI</p>
          </div>
          <label style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8,fontSize:11,cursor:"pointer",background:isAdmin?"#FEF3C7":"var(--surface2)",border:`1px solid ${isAdmin?"#FDE68A":"var(--border)"}`,borderRadius:99,padding:"5px 12px",color:isAdmin?"#92400E":"var(--text3)",fontWeight:isAdmin?700:400,transition:"all 0.2s"}}>
            <input type="checkbox" checked={isAdmin} style={{width:12,height:12}} onChange={e=>{setIsAdmin(e.target.checked);localStorage.setItem("our_system_admin",String(e.target.checked))}}/>
            {isAdmin?"✏️ Mode Edit Aktif":"Mode Edit"}
          </label>
        </div>
      </div>

      <div style={{flex:1,display:"flex",gap:14,padding:"0 28px 18px",minHeight:0,overflow:"hidden"}}>
        {/* 2x2 app cards */}
        <div style={{flex:1,display:"grid",gridTemplateColumns:"1fr 1fr",gridTemplateRows:"1fr 1fr",gap:12,minWidth:0}}>
          {APPS.map(app=>{
            const st=appStats[app.name]
            const total=(st?.modules||0)+(st?.sections||0)+(st?.subsections||0)
            const filled=st?.contentFilled||0
            const pct=total>0?Math.round(filled/total*100):0
            return (
              <div key={app.name} onClick={()=>enterApp(app.name)}
                style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"16px 18px",cursor:"pointer",transition:"all 0.2s",position:"relative",overflow:"hidden",display:"flex",flexDirection:"column",gap:10}}
                onMouseEnter={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor=app.color;el.style.transform="translateY(-2px)";el.style.boxShadow=`0 8px 24px ${app.color}22`}}
                onMouseLeave={e=>{const el=e.currentTarget as HTMLElement;el.style.borderColor="var(--border)";el.style.transform="translateY(0)";el.style.boxShadow="none"}}>
                <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:app.color,borderRadius:"14px 14px 0 0"}}/>

                {/* Top: icon + name + arrow */}
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:10,background:app.bg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <i className={`ti ${app.icon}`} style={{fontSize:19,color:app.color}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:15,fontWeight:700,color:"var(--text)"}}>{app.name}</div>
                    <div style={{fontSize:11,color:"var(--text3)",marginTop:1}}>{app.desc}</div>
                  </div>
                  <span style={{fontSize:13,color:app.color}}>→</span>
                </div>

                {/* Stats row */}
                <div style={{display:"flex",gap:8}}>
                  {[
                    {label:"Modul",    val:st?.modules||0},
                    {label:"Bab",      val:st?.sections||0},
                    {label:"Sub-bab",  val:st?.subsections||0},
                  ].map(s=>(
                    <div key={s.label} style={{flex:1,background:app.bg,borderRadius:8,padding:"6px 8px",textAlign:"center"}}>
                      <div style={{fontSize:16,fontWeight:800,color:app.color,lineHeight:1}}>{s.val}</div>
                      <div style={{fontSize:10,color:app.color,opacity:0.7,marginTop:2}}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Progress bar */}
                <div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                    <span style={{fontSize:10,color:"var(--text3)"}}>Konten terisi</span>
                    <span style={{fontSize:10,fontWeight:700,color:app.color}}>{pct}%</span>
                  </div>
                  <div style={{height:5,borderRadius:99,background:"var(--surface2)",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:app.color,borderRadius:99,transition:"width 0.6s ease"}}/>
                  </div>
                  <div style={{fontSize:10,color:"var(--text3)",marginTop:3}}>{filled}/{total} node sudah ada konten</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Aria home */}
        <div style={{width:330,flexShrink:0,border:"1px solid var(--border)",borderRadius:14,overflow:"hidden",background:"var(--surface)",display:"flex",flexDirection:"column",boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
          <div style={{padding:"13px 16px",background:"linear-gradient(135deg,#F0EFFE,#E8F4FD)",borderBottom:"1px solid var(--border)",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
            <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#534AB7,#7C6FD4)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(83,74,183,0.3)"}}>
              <span style={{fontSize:13}}>✨</span>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:"#3C3489",display:"flex",alignItems:"center",gap:6}}>Aria<span style={{background:"#534AB7",color:"white",fontSize:9,padding:"2px 7px",borderRadius:99,fontWeight:700}}>AI</span></div>
              <div style={{fontSize:11,color:"#6B63C4"}}>Matrix · Ficom · Ficom Lite · SFA</div>
            </div>
          </div>
          <div ref={homeMsgsRef} style={{flex:1,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8,background:"var(--bg)"}}>
            {homeMessages.map((m,i)=>(
              <div key={i} style={{maxWidth:"88%",fontSize:12,lineHeight:1.7,padding:"8px 11px",borderRadius:10,alignSelf:m.role==="user"?"flex-end":"flex-start",background:m.role==="user"?"#534AB7":"var(--surface)",color:m.role==="user"?"white":"var(--text)",border:m.role==="ai"?"1px solid var(--border)":"none",whiteSpace:"pre-wrap"}}>
                {m.text.replace(/\*\*(.*?)\*\*/g,"$1")}
              </div>
            ))}
            {homeLoading&&<div style={{alignSelf:"flex-start",fontSize:12,padding:"8px 11px",borderRadius:10,background:"var(--surface)",color:"var(--text3)",border:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}><span style={{width:11,height:11,border:"2px solid #534AB7",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>Aria sedang mengetik...</div>}
          </div>
          <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)",background:"var(--surface)",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <input value={homeInput} onChange={e=>setHomeInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendHomeMessage()} placeholder="Tanya tentang sistem PHI..." style={{flex:1,fontSize:12,border:"1px solid var(--border)",borderRadius:8,padding:"7px 11px",background:"var(--surface2)",color:"var(--text)",outline:"none",fontFamily:"inherit"}} onFocus={e=>(e.target.style.borderColor="#534AB7")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
            <button onClick={sendHomeMessage} disabled={homeLoading||!homeInput.trim()} style={{width:34,height:34,borderRadius:8,flexShrink:0,background:homeLoading||!homeInput.trim()?"var(--surface3)":"#534AB7",color:homeLoading||!homeInput.trim()?"var(--text3)":"white",border:"none",cursor:homeLoading||!homeInput.trim()?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:12}}>➤</span></button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ════════════════ SCREEN 2 — APP DETAIL ══════════════
  return (
    <div style={{display:"flex",height:"calc(100vh - 64px)",background:"var(--bg)",fontFamily:"'Plus Jakarta Sans', sans-serif"}}>
      {/* Sidebar */}
      <div style={{width:264,flexShrink:0,display:"flex",flexDirection:"column",borderRight:"1px solid var(--border)",background:"var(--surface)",overflow:"hidden"}}>
        <div style={{borderBottom:"1px solid var(--border)"}}>
          <button onClick={()=>{setScreen("home");setSelectedNode(null);setTree([]);loadAppStats()}} style={{display:"flex",alignItems:"center",gap:6,width:"100%",padding:"10px 14px",background:"none",border:"none",fontSize:11,color:"var(--text3)",cursor:"pointer",fontFamily:"inherit",borderBottom:"1px solid var(--border)"}}>
            ← Our System</button>
          <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:8,justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:8,flexShrink:0,background:APP_BG[activeApp]||"#eee",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <i className={`ti ${APP_ICONS[activeApp]||"ti-apps"}`} style={{fontSize:14,color:appColor}}/>
              </div>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:"var(--text)"}}>{activeApp}</div>
                <div style={{fontSize:10,color:"var(--text3)"}}>Knowledge Base</div>
              </div>
            </div>
            <button onClick={handleExport} disabled={isExporting} title="Export PDF"
              style={{display:"flex",alignItems:"center",gap:4,fontSize:10,padding:"4px 8px",borderRadius:6,background:isExporting?"var(--surface2)":appColor+"15",color:appColor,border:`1px solid ${appColor}40`,cursor:isExporting?"not-allowed":"pointer",fontWeight:600,flexShrink:0}}>
              {isExporting?<><span style={{width:10,height:10,border:`2px solid ${appColor}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>...</>:<><span style={{fontSize:10}}>📄</span> PDF</>}</button>
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"8px 0"}}>
          {isLoadingTree?<p style={{fontSize:12,color:"var(--text3)",padding:"12px 16px"}}>Loading...</p>
            :tree.length===0?<div style={{padding:"12px 14px"}}><p style={{fontSize:12,color:"var(--text3)",marginBottom:8}}>Belum ada konten.</p>{isAdmin&&<button onClick={()=>openAddModal(null,activeApp)} style={{fontSize:12,padding:"5px 12px",borderRadius:6,background:appColor,color:"white",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>+ Tambah Modul</button>}</div>
            :renderTree(tree)}
        </div>

        {isAdmin&&tree.length>0&&(
          <div style={{padding:"8px 10px",borderTop:"1px solid var(--border)"}}>
            <button onClick={()=>openAddModal(null,activeApp)}
              style={{width:"100%",display:"flex",alignItems:"center",gap:6,fontSize:11,padding:"7px 10px",borderRadius:8,background:"transparent",border:`1px dashed ${appColor}60`,cursor:"pointer",color:appColor,fontFamily:"inherit",justifyContent:"center",fontWeight:600,transition:"all 0.15s"}}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background=appColor+"10"}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent"}}>
              + Tambah Modul Baru</button>
          </div>
        )}

        <div style={{padding:"10px 12px",borderTop:"1px solid var(--border)"}}>
          <label style={{display:"flex",alignItems:"center",gap:8,fontSize:11,cursor:"pointer",background:isAdmin?"#FEF3C7":"var(--surface2)",border:`1px solid ${isAdmin?"#FDE68A":"var(--border)"}`,borderRadius:8,padding:"8px 10px",color:isAdmin?"#92400E":"var(--text3)",fontWeight:isAdmin?700:400,transition:"all 0.2s"}}>
            <input type="checkbox" checked={isAdmin} onChange={e=>{setIsAdmin(e.target.checked);localStorage.setItem("our_system_admin",String(e.target.checked))}}/>
            {isAdmin?"✏️ Mode Edit Aktif":"🔒 Mode Edit"}
          </label>
        </div>
      </div>

      {/* Main */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
        <div style={{padding:"10px 20px",borderBottom:"1px solid var(--border)",background:"var(--surface)",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:"var(--text3)",flexWrap:"wrap"}}>
            <span style={{cursor:"pointer"}} onClick={()=>{setScreen("home");loadAppStats()}}>Our System</span>
            <span style={{fontSize:9,opacity:0.4,margin:"0 1px"}}>/</span>
            <span style={{color:appColor,fontWeight:600}}>{activeApp}</span>
            {breadcrumb.map((part,i)=>(
              <span key={i} style={{display:"flex",alignItems:"center",gap:4}}>
                <span style={{fontSize:9,opacity:0.4,margin:"0 1px"}}>/</span>
                <span style={i===breadcrumb.length-1?{color:"var(--text)",fontWeight:600}:{}}>{part}</span>
              </span>
            ))}
          </div>
        </div>

        {!selectedNode?(
          <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:8}}>
            <div style={{width:52,height:52,borderRadius:14,background:APP_BG[activeApp],display:"flex",alignItems:"center",justifyContent:"center"}}>
              <i className={`ti ${APP_ICONS[activeApp]||"ti-books"}`} style={{fontSize:24,color:appColor}}/>
            </div>
            <p style={{fontSize:13,color:"var(--text3)",marginTop:4}}>Pilih topik dari sidebar</p>
            {isAdmin&&<p style={{fontSize:11,color:"var(--text3)"}}>Gunakan tombol <strong>+</strong> di sidebar untuk menambah konten</p>}
          </div>
        ):(
          <div style={{flex:1,overflowY:"auto",padding:"20px 24px",display:"flex",flexDirection:"column",gap:14}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                  <span style={{width:10,height:10,borderRadius:"50%",background:appColor,display:"inline-block",flexShrink:0}}/>
                  <h1 style={{fontSize:20,fontWeight:800,color:"var(--text)",letterSpacing:"-0.02em"}}>{selectedNode.title}</h1>
                </div>
                <p style={{fontSize:12,color:"var(--text3)",marginLeft:18}}>{activeApp} · {breadcrumb.slice(0,-1).join(" / ")}</p>
              </div>
              {isAdmin&&<span style={{fontSize:10,background:"#FEF3C7",color:"#92400E",border:"1px solid #FDE68A",padding:"3px 10px",borderRadius:99,fontWeight:700,flexShrink:0}}>✏️ Mode Edit</span>}
            </div>

            {/* DIKW */}
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {DIKW_LEVELS.map(lv=>{
                const content=contents.find(c=>c.level===lv.key)
                const isOpen=openDikw.has(lv.key)
                const hasText=!!content?.text_content
                const hasImgs=(content?.image_urls?.length||0)>0
                const isUploading=uploadingImg===lv.key
                return (
                  <div key={lv.key} style={{border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",background:"var(--surface)",boxShadow:isOpen?"0 1px 4px rgba(0,0,0,0.06)":"none"}}>
                    <div onClick={()=>toggleDikw(lv.key)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",cursor:"pointer",borderBottom:isOpen?"1px solid var(--border)":"none"}}>
                      <span style={{fontSize:10,fontWeight:700,padding:"3px 10px",borderRadius:99,background:lv.bg,color:lv.color,flexShrink:0}}>{lv.label}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:"var(--text)"}}>{DIKW_TITLES[lv.key]}</div>
                        <div style={{fontSize:11,color:"var(--text3)"}}>{lv.sub}</div>
                      </div>
                      {!isOpen&&(hasText||hasImgs)&&<span style={{fontSize:10,color:"var(--text3)",background:"var(--surface2)",padding:"2px 8px",borderRadius:99}}>Ada konten</span>}
                      <span style={{fontSize:11,color:"var(--text3)",display:"inline-block",transform:isOpen?"rotate(180deg)":"none",transition:"transform 0.2s",flexShrink:0}}>▾</span>
                    </div>
                    {isOpen&&(
                      <div style={{padding:"12px 14px 14px"}}>
                        {isAdmin?(
                          <>
                            <textarea value={editingContent[lv.key]||""} onChange={e=>setEditingContent(prev=>({...prev,[lv.key]:e.target.value}))} placeholder={`Tulis konten ${lv.label}...`} rows={5}
                              style={{width:"100%",fontSize:12,lineHeight:1.8,padding:"10px 12px",border:"1px solid var(--border)",borderRadius:8,background:"var(--surface2)",color:"var(--text)",resize:"vertical",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
                            {/* Paste zone */}
                            <div
                              onPaste={usePasteUpload(lv.key)}
                              tabIndex={0}
                              style={{marginTop:8,border:`1.5px dashed ${uploadingImg===lv.key?"#534AB7":"var(--border)"}`,borderRadius:8,padding:"10px 14px",background:uploadingImg===lv.key?"#F0EFFE":"var(--surface2)",cursor:"text",outline:"none",display:"flex",alignItems:"center",gap:8,transition:"all 0.2s"}}
                              onFocus={e=>(e.currentTarget.style.borderColor="#534AB7")}
                              onBlur={e=>(e.currentTarget.style.borderColor="var(--border)")}
                            >
                              {uploadingImg===lv.key
                                ? <><span style={{width:12,height:12,border:"2px solid #534AB7",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block",flexShrink:0}}/>
                                    <span style={{fontSize:11,color:"#534AB7"}}>Mengupload gambar...</span></>
                                : <><span style={{fontSize:14,opacity:0.5}}>📋</span>
                                    <span style={{fontSize:11,color:"var(--text3)"}}>Klik di sini lalu <strong style={{color:"var(--text2)"}}>Ctrl+V</strong> untuk paste gambar dari clipboard</span></>
                              }
                            </div>
                            {hasImgs&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>
                              {content!.image_urls.map((url,i)=>(
                                <div key={i} style={{position:"relative"}}>
                                  <img src={url} alt="" style={{width:120,height:80,objectFit:"cover",borderRadius:8,border:"1px solid var(--border)",display:"block"}}/>
                                  <button onClick={()=>deleteImage(lv.key,url)} style={{position:"absolute",top:4,right:4,width:20,height:20,borderRadius:"50%",background:"#EF4444",color:"white",border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                    ×</button>
                                </div>
                              ))}
                            </div>}
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:10,gap:8}}>
                              <div>
                                <input type="file" id={`img-${lv.key}`} accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadImage(lv.key,f);e.target.value=""}}/>
                                <label htmlFor={`img-${lv.key}`} style={{display:"inline-flex",alignItems:"center",gap:5,fontSize:11,color:isUploading?"var(--text3)":"var(--text2)",border:"1px solid var(--border)",borderRadius:6,padding:"5px 12px",cursor:isUploading?"not-allowed":"pointer",background:"var(--surface2)"}}>
                                  {isUploading?<><span style={{width:11,height:11,border:"2px solid #534AB7",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>Mengupload...</>:<>🖼️Tambah gambar</>}
                                </label>
                              </div>
                              <button onClick={()=>saveContent(lv.key)} disabled={isSaving} style={{fontSize:11,padding:"5px 16px",borderRadius:6,background:"var(--accent)",color:"white",border:"none",cursor:"pointer",fontWeight:600,opacity:isSaving?0.6:1,fontFamily:"inherit"}}>
                                {isSaving?"Menyimpan...":"Simpan"}</button>
                            </div>
                          </>
                        ):(
                          <>
                            {hasText?<p style={{fontSize:13,color:"var(--text2)",lineHeight:1.8,margin:0}}>{content!.text_content}</p>:<p style={{fontSize:12,color:"var(--text3)",fontStyle:"italic",margin:0}}>Belum ada konten.</p>}
                            {hasImgs&&<div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:10}}>{content!.image_urls.map((url,i)=><img key={i} src={url} alt="" style={{width:120,height:80,objectFit:"cover",borderRadius:8,border:"1px solid var(--border)"}}/>)}</div>}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Relations */}
            {relations.length>0&&(
              <div style={{border:"1px solid var(--border)",borderRadius:10,padding:"12px 14px",background:"var(--surface2)"}}>
                <p style={{fontSize:11,fontWeight:700,color:"var(--text3)",marginBottom:8,display:"flex",alignItems:"center",gap:6}}>🔗TERHUBUNG DENGAN</p>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {relations.map(r=>(
                    <button key={r.related_id} onClick={()=>{const n=flatNodes.find(x=>x.id===r.related_id);if(n)selectNode(n)}} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,padding:"4px 12px",borderRadius:99,border:"1px solid var(--border)",color:"var(--text2)",background:"var(--surface)",cursor:"pointer",fontWeight:500}}>
                      <span style={{width:6,height:6,borderRadius:"50%",background:APP_COLORS[r.related_node?.app_name||""]||"#888",display:"inline-block"}}/>
                      {r.related_node?.app_name}/{r.related_node?.title}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Aria */}
            <div style={{border:"1px solid var(--border)",borderRadius:12,overflow:"hidden",background:"var(--surface)",boxShadow:"0 2px 8px rgba(0,0,0,0.06)"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"linear-gradient(135deg,#F0EFFE,#E8F4FD)",borderBottom:"1px solid var(--border)"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:"linear-gradient(135deg,#534AB7,#7C6FD4)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 2px 8px rgba(83,74,183,0.3)"}}>
                  <span style={{fontSize:13}}>✨</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:700,color:"#3C3489",display:"flex",alignItems:"center",gap:6}}>Aria<span style={{background:"#534AB7",color:"white",fontSize:9,padding:"2px 7px",borderRadius:99,fontWeight:700}}>AI</span><span style={{fontSize:10,background:APP_BG[activeApp],color:appColor,padding:"2px 8px",borderRadius:99,fontWeight:600}}>{activeApp}</span></div>
                  <div style={{fontSize:11,color:"#6B63C4"}}>Konteks: {selectedNode.title}</div>
                </div>
                <span style={{fontSize:10,padding:"3px 10px",borderRadius:99,fontWeight:700,border:"1px solid",color:detectedLang==="EN"?"#185FA5":"#0F6E56",background:detectedLang==="EN"?"#E6F1FB":"#E1F5EE",borderColor:detectedLang==="EN"?"#BFDBFE":"#BBF7D0"}}>{detectedLang}</span>
              </div>
              <div ref={appMsgsRef} style={{minHeight:80,maxHeight:220,overflowY:"auto",padding:"12px 14px",display:"flex",flexDirection:"column",gap:8,background:"var(--bg)"}}>
                {appMessages.map((m,i)=>(
                  <div key={i} style={{maxWidth:"85%",fontSize:12,lineHeight:1.7,padding:"8px 11px",borderRadius:10,alignSelf:m.role==="user"?"flex-end":"flex-start",background:m.role==="user"?"#534AB7":"var(--surface)",color:m.role==="user"?"white":"var(--text)",border:m.role==="ai"?"1px solid var(--border)":"none",whiteSpace:"pre-wrap"}}>
                    {m.text.replace(/\*\*(.*?)\*\*/g,"$1")}
                  </div>
                ))}
                {appLoading&&<div style={{alignSelf:"flex-start",fontSize:12,padding:"8px 11px",borderRadius:10,background:"var(--surface)",color:"var(--text3)",border:"1px solid var(--border)",display:"flex",alignItems:"center",gap:8}}><span style={{width:11,height:11,border:"2px solid #534AB7",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>Aria sedang mengetik...</div>}
              </div>
              <div style={{display:"flex",gap:8,padding:"10px 12px",borderTop:"1px solid var(--border)",background:"var(--surface)",alignItems:"center"}}>
                <input value={appInput} onChange={e=>setAppInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendAppMessage()} placeholder={`Tanya tentang ${selectedNode.title}... (Indo / English)`} style={{flex:1,fontSize:12,border:"1px solid var(--border)",borderRadius:8,padding:"8px 11px",background:"var(--surface2)",color:"var(--text)",outline:"none",fontFamily:"inherit"}} onFocus={e=>(e.target.style.borderColor="#534AB7")} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
                <button onClick={sendAppMessage} disabled={appLoading||!appInput.trim()} style={{width:36,height:36,borderRadius:8,flexShrink:0,background:appLoading||!appInput.trim()?"var(--surface3)":"#534AB7",color:appLoading||!appInput.trim()?"var(--text3)":"white",border:"none",cursor:appLoading||!appInput.trim()?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:12}}>➤</span></button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Modal */}
      {showAddModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowAddModal(false)}>
          <div style={{background:"var(--surface)",borderRadius:14,padding:"24px",width:380,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <h3 style={{fontSize:16,fontWeight:700,marginBottom:4}}>Tambah Node Baru</h3>
            <p style={{fontSize:12,color:"var(--text3)",marginBottom:16}}>
              {addParentId?`Di dalam: "${addParentLabel}"`:`Modul baru di ${activeApp}`}
            </p>
            <div style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:5}}>Nama</label>
              <input value={addTitle} onChange={e=>setAddTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submitAddNode()} placeholder="Contoh: Territory, Product Focus..." autoFocus
                style={{width:"100%",fontSize:13,border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px",background:"var(--surface2)",color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
                onFocus={e=>(e.target.style.borderColor=appColor)} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:11,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:5}}>Icon</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {([["ti-file","📄"],["ti-folder","📁"],["ti-map","🗺️"],["ti-package","📦"],["ti-user","👤"],["ti-building-store","🏪"],["ti-chart-bar","📊"],["ti-settings","⚙️"],["ti-database","🗄️"],["ti-list","📋"],["ti-clipboard","📝"],["ti-calendar","📅"],["ti-truck","🚚"],["ti-cash","💰"],["ti-tag","🏷️"],["ti-tool","🔧"],["ti-eye","👁️"],["ti-bell","🔔"],["ti-lock","🔒"],["ti-star","⭐"]] as [string,string][]).map(([ic,em])=>(
                  <button key={ic} onClick={()=>setAddIcon(ic)} title={ic.replace("ti-","")}
                    style={{width:38,height:38,borderRadius:8,border:`2px solid ${addIcon===ic?appColor:"var(--border)"}`,background:addIcon===ic?(APP_BG[activeApp]||"#eee"):"var(--surface2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all 0.15s"}}>
                    {em}</button>
                ))}
              </div>
              <div style={{fontSize:10,color:"var(--text3)",marginTop:4}}>Hover untuk lihat nama</div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAddModal(false)} style={{padding:"7px 16px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text3)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Batal</button>
              <button onClick={submitAddNode} disabled={!addTitle.trim()||isAdding}
                style={{padding:"7px 18px",borderRadius:8,background:!addTitle.trim()||isAdding?"var(--surface3)":appColor,color:!addTitle.trim()||isAdding?"var(--text3)":"white",border:"none",cursor:!addTitle.trim()||isAdding?"not-allowed":"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                {isAdding?<><span style={{width:11,height:11,border:"2px solid white",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>Menyimpan...</>:<>+ Tambah</>}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {/* Edit Node Modal */}
      {editNode&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setEditNode(null)}>
          <div style={{background:"var(--surface)",borderRadius:14,padding:"24px",width:400,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
              <div style={{width:36,height:36,borderRadius:10,background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:20}}>✏️</span>
              </div>
              <div>
                <h3 style={{fontSize:15,fontWeight:700}}>Edit Node</h3>
                <p style={{fontSize:11,color:"var(--text3)"}}>Ubah nama dan icon</p>
              </div>
            </div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:11,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:5}}>Nama</label>
              <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveEditNode()} autoFocus
                style={{width:"100%",fontSize:13,border:"1px solid var(--border)",borderRadius:8,padding:"8px 12px",background:"var(--surface2)",color:"var(--text)",outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}
                onFocus={e=>(e.target.style.borderColor=appColor)} onBlur={e=>(e.target.style.borderColor="var(--border)")}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontSize:11,fontWeight:600,color:"var(--text2)",display:"block",marginBottom:5}}>Icon</label>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {([["ti-file","📄"],["ti-folder","📁"],["ti-map","🗺️"],["ti-package","📦"],["ti-user","👤"],["ti-building-store","🏪"],["ti-chart-bar","📊"],["ti-settings","⚙️"],["ti-database","🗄️"],["ti-list","📋"],["ti-clipboard","📝"],["ti-calendar","📅"],["ti-truck","🚚"],["ti-cash","💰"],["ti-tag","🏷️"],["ti-tool","🔧"],["ti-eye","👁️"],["ti-bell","🔔"],["ti-lock","🔒"],["ti-star","⭐"]] as [string,string][]).map(([ic,em])=>(
                  <button key={ic} onClick={()=>setEditIcon(ic)} title={ic.replace("ti-","")}
                    style={{width:38,height:38,borderRadius:8,border:`2px solid ${editIcon===ic?appColor:"var(--border)"}`,background:editIcon===ic?(APP_BG[activeApp]||"#eee"):"var(--surface2)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,transition:"all 0.15s"}}>
                    {em}</button>
                ))}
              </div>
              <div style={{fontSize:10,color:"var(--text3)",marginTop:4}}>Hover untuk lihat nama icon</div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setEditNode(null)} style={{padding:"7px 16px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text3)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Batal</button>
              <button onClick={saveEditNode} disabled={!editTitle.trim()||isSavingEdit}
                style={{padding:"7px 18px",borderRadius:8,background:!editTitle.trim()||isSavingEdit?"var(--surface3)":appColor,color:!editTitle.trim()||isSavingEdit?"var(--text3)":"white",border:"none",cursor:!editTitle.trim()||isSavingEdit?"not-allowed":"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit",display:"flex",alignItems:"center",gap:6}}>
                {isSavingEdit?<><span style={{width:11,height:11,border:"2px solid white",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.7s linear infinite",display:"inline-block"}}/>Menyimpan...</>:<>✓ Simpan</>}</button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirm&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setDeleteConfirm(null)}>
          <div style={{background:"var(--surface)",borderRadius:14,padding:"24px",width:340,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
            <div style={{width:44,height:44,borderRadius:12,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12}}>
              <span style={{fontSize:24}}>🗑️</span>
            </div>
            <h3 style={{fontSize:15,fontWeight:700,marginBottom:6}}>Hapus "{deleteConfirm.title}"?</h3>
            <p style={{fontSize:12,color:"var(--text3)",marginBottom:20,lineHeight:1.5}}>Semua sub-node dan konten di dalamnya akan ikut terhapus. Tidak bisa dibatalkan.</p>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setDeleteConfirm(null)} style={{padding:"7px 16px",borderRadius:8,border:"1px solid var(--border)",background:"var(--surface2)",color:"var(--text3)",cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Batal</button>
              <button onClick={()=>deleteNode(deleteConfirm)} style={{padding:"7px 18px",borderRadius:8,background:"#EF4444",color:"white",border:"none",cursor:"pointer",fontSize:12,fontWeight:600,fontFamily:"inherit"}}>Hapus</button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}