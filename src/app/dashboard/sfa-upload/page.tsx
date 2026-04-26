"use client"
import { useState, useRef, useCallback } from "react"
import { Upload, CheckCircle, AlertCircle, RefreshCw, FileSpreadsheet, Eye, Trash2, ArrowRight, Database, Globe } from "lucide-react"
import { supabase } from "@/lib/supabase"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ── Types ─────────────────────────────────────────────────────
interface ParsedData {
  snapshots: SnapshotRow[]
  branches: BranchRow[]
  salesman: SalesmanRow[]
  summary: { cutoffs: string[]; totalRows: number; latestCutoff: string; totalSalesman: number }
}
interface SnapshotRow { cutoff_date:string; total:number; done_training:number; active:number; updated:number; pct_done:number; pct_active:number; pct_updated:number }
interface BranchRow { cutoff_date:string; branch_name:string; area:string; total:number; done:number; active:number; inactive:number; updated:number; not_updated:number; pct:number; pct_updated:number }
interface SalesmanRow {
  cutoff_date:string; branch_name:string; area:string;
  sls_no:string; sls_name:string;
  salesforce:string   // mapped from SALESFORCENAME
  team:string         // mapped from TEAMNAME
  flag_blok:string; done_training:number; done_update:number; active:number;
  sfa_version:string; last_order_date:string|null
}

// ── Excel parser ───────────────────────────────────────────────
async function parseExcel(file: File): Promise<ParsedData> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX = (await import("xlsx")) as any
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: "array", cellDates: true })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { raw: false, dateNF: "yyyy-mm-dd" })

  const fmtDate = (v: unknown): string | null => {
    if (!v) return null
    // Handle JS Date objects from cellDates:true
    if (v instanceof Date) {
      if (isNaN(v.getTime())) return null
      return v.toISOString().split("T")[0]
    }
    const d = new Date(v as string)
    if (isNaN(d.getTime())) return null
    return d.toISOString().split("T")[0]
  }
  const n = (v: unknown) => Number(v) || 0
  const s = (v: unknown) => String(v || "").trim()

  // Parse SFA version from numeric code (e.g. 260200 → v26.02.00)
  const parseVer = (v: unknown): string => {
    const raw = String(v || "").replace(".0","").trim()
    if (!raw || raw === "nan" || raw === "undefined" || raw === "0") return "Unknown"
    // 6-digit numeric: 260200 → v26.02.00
    if (/^\d{6}$/.test(raw)) return `v${raw.slice(0,2)}.${raw.slice(2,4)}.${raw.slice(4,6)}`
    // Already formatted
    return raw
  }

  // Filter: only 2026 active salesman (last order in 2026)
  // Based on actual Excel: LAST ORDERDATE
  const filtered = rows.filter(r => {
    const lo = fmtDate(r["LAST ORDERDATE"])
    return lo && lo.startsWith("2026")
  })

  if (filtered.length === 0) {
    throw new Error("Tidak ada data 2026 ditemukan. Pastikan kolom 'LAST ORDERDATE' ada dan berisi tanggal 2026.")
  }

  // Group by cutoff for snapshots
  const cutoffMap = new Map<string, typeof filtered>()
  filtered.forEach(r => {
    const c = fmtDate(r["CUTOFF"]) || ""
    if (!c) return
    if (!cutoffMap.has(c)) cutoffMap.set(c, [])
    cutoffMap.get(c)!.push(r)
  })

  const snapshots: SnapshotRow[] = []
  cutoffMap.forEach((rows, cutoff) => {
    const total = rows.length
    const done = rows.filter(r => n(r["DONE TRAINING"]) === 1).length
    const active = rows.filter(r => s(r["FLAG BLOK"]) === "T").length
    const updated = rows.filter(r => n(r["DONE UPDATE"]) === 1).length
    snapshots.push({
      cutoff_date: cutoff,
      total, done_training: done, active, updated,
      pct_done:    total ? Math.round(done   / total * 1000) / 10 : 0,
      pct_active:  total ? Math.round(active / total * 1000) / 10 : 0,
      pct_updated: total ? Math.round(updated/ total * 1000) / 10 : 0,
    })
  })

  // Branch summary grouped by cutoff + branch
  const branchMap = new Map<string, typeof filtered>()
  filtered.forEach(r => {
    const key = `${fmtDate(r["CUTOFF"])}|||${s(r["NAMA CABANG"])}`
    if (!branchMap.has(key)) branchMap.set(key, [])
    branchMap.get(key)!.push(r)
  })

  const VALID_AREAS = new Set(["GMA","MIN","NOL","SOL","VIS"])

  const branches: BranchRow[] = []
  branchMap.forEach((rows, key) => {
    const [cutoff, branch] = key.split("|||")
    const area = s(rows[0]["AREA"])
    // ✅ FIX: Filter invalid areas like '#N/A', 'Unknown', empty
    if (!area || !VALID_AREAS.has(area)) return
    const total   = rows.length
    const done    = rows.filter(r => n(r["DONE TRAINING"]) === 1).length
    const active  = rows.filter(r => s(r["FLAG BLOK"]) === "T").length
    const inactive= rows.filter(r => s(r["FLAG BLOK"]) === "Y").length
    const updated = rows.filter(r => n(r["DONE UPDATE"]) === 1).length
    branches.push({
      cutoff_date: cutoff, branch_name: branch, area,
      total, done, active, inactive,
      updated, not_updated: total - updated,
      pct:         total ? Math.round(done   / total * 1000) / 10 : 0,
      pct_updated: total ? Math.round(updated/ total * 1000) / 10 : 0,
    })
  })

  // Salesman — latest cutoff only
  const sortedCutoffs = [...cutoffMap.keys()].sort()
  const latestCutoff  = sortedCutoffs[sortedCutoffs.length - 1]
  const latestRows    = cutoffMap.get(latestCutoff) || []

  // ✅ FIX: Deduplicate by sls_no (same salesman can appear in 2 branches)
  // UNIQUE(cutoff_date, sls_no) constraint = 1 row per salesman per cutoff
  const slsMap = new Map<string, Record<string, unknown>>()
  latestRows.forEach(r => {
    const key = s(r["SLSNO"])
    if (!slsMap.has(key)) {
      slsMap.set(key, r)
    } else {
      // Prefer row where DONE UPDATE = 1
      const existing = slsMap.get(key)!
      if (n(existing["DONE UPDATE"]) === 0 && n(r["DONE UPDATE"]) === 1) {
        slsMap.set(key, r)
      }
    }
  })
  const dedupedLatestRows = [...slsMap.values()]

  const salesman: SalesmanRow[] = dedupedLatestRows.map(r => ({
    cutoff_date:    latestCutoff,
    branch_name:    s(r["NAMA CABANG"]),
    area:           s(r["AREA"]),
    sls_no:         s(r["SLSNO"]),
    sls_name:       s(r["SLSNAME"]),
    // ✅ FIXED: Use SALESFORCENAME (text) not SALESFORCE (number code)
    salesforce:     s(r["SALESFORCENAME"]),
    // ✅ FIXED: Use TEAMNAME (text) not TEAM (number code)
    team:           s(r["TEAMNAME"]),
    flag_blok:      s(r["FLAG BLOK"]),
    done_training:  n(r["DONE TRAINING"]),
    done_update:    n(r["DONE UPDATE"]),
    active:         n(r["ACTIVE"]),
    sfa_version:    parseVer(r["RELEASE SFA"]),
    last_order_date: fmtDate(r["LAST ORDERDATE"]),
  }))

  return {
    snapshots: snapshots.sort((a,b) => a.cutoff_date.localeCompare(b.cutoff_date)),
    branches,
    salesman,
    summary: {
      cutoffs: sortedCutoffs,
      latestCutoff,
      totalRows: filtered.length,
      totalSalesman: dedupedLatestRows.length, // ✅ use deduped count
    }
  }
}

// ── Upload to Supabase ─────────────────────────────────────────
async function uploadToSupabase(data: ParsedData, onProgress: (msg: string) => void) {
  const { snapshots, branches, salesman, summary } = data
  const lc = summary.latestCutoff
  const chunkSize = 500

  // 1. Upsert snapshots (conflict on cutoff_date)
  onProgress("⏳ Uploading snapshots...")
  const { error: e1 } = await supabase
    .from("sfa_snapshots")
    .upsert(snapshots, { onConflict: "cutoff_date" })
  if (e1) throw new Error(`Snapshots error: ${e1.message}`)
  onProgress(`✅ Snapshots: ${snapshots.length} records`)

  // 2. Delete then re-insert branches for those cutoffs
  onProgress("⏳ Clearing old branch data...")
  const { error: del2 } = await supabase
    .from("sfa_branches")
    .delete()
    .in("cutoff_date", summary.cutoffs)
  if (del2) throw new Error(`Branch delete error: ${del2.message}`)

  for (let i = 0; i < branches.length; i += chunkSize) {
    const chunk = branches.slice(i, i + chunkSize)
    const { error: e2 } = await supabase.from("sfa_branches").insert(chunk)
    if (e2) throw new Error(`Branches error: ${e2.message}`)
    onProgress(`⏳ Branches: ${Math.min(i + chunkSize, branches.length)}/${branches.length}`)
  }
  onProgress(`✅ Branches: ${branches.length} records`)

  // 3. Delete then re-insert salesman (latest cutoff only)
  onProgress("⏳ Clearing old salesman data...")
  const { error: del3 } = await supabase
    .from("sfa_salesman")
    .delete()
    .eq("cutoff_date", lc)
  if (del3) throw new Error(`Salesman delete error: ${del3.message}`)

  for (let i = 0; i < salesman.length; i += chunkSize) {
    const chunk = salesman.slice(i, i + chunkSize)
    const { error: e3 } = await supabase.from("sfa_salesman").insert(chunk)
    if (e3) throw new Error(`Salesman error: ${e3.message}`)
    onProgress(`⏳ Salesman: ${Math.min(i + chunkSize, salesman.length)}/${salesman.length}`)
  }
  onProgress(`✅ Salesman: ${salesman.length} records`)
  onProgress("🎉 All data uploaded successfully!")
}

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function SFAUploadPage() {
  const fileRef   = useRef<HTMLInputElement>(null)
  const [file,      setFile]     = useState<File|null>(null)
  const [parsed,    setParsed]   = useState<ParsedData|null>(null)
  const [parsing,   setParsing]  = useState(false)
  const [uploading, setUploading]= useState(false)
  const [progress,  setProgress] = useState<string[]>([])
  const [error,     setError]    = useState("")
  const [done,      setDone]     = useState(false)
  const [dragOver,  setDragOver] = useState(false)

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      setError("File harus berformat .xlsx atau .xls"); return
    }
    setFile(f); setError(""); setParsed(null); setDone(false); setProgress([])
    setParsing(true)
    try {
      const data = await parseExcel(f)
      setParsed(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal parse file")
    } finally { setParsing(false) }
  }, [])

  const handleUpload = async () => {
    if (!parsed) return
    setUploading(true); setProgress([]); setError(""); setDone(false)
    try {
      await uploadToSupabase(parsed, msg => setProgress(p => [...p, msg]))
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal")
    } finally { setUploading(false) }
  }

  const reset = () => { setFile(null); setParsed(null); setProgress([]); setError(""); setDone(false) }

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"20px" }}>
      <MotivationBanner page="docreq" />

      {/* Header */}
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"4px" }}>
            <div style={{ width:"32px", height:"32px", borderRadius:"8px", background:"linear-gradient(135deg,#E8381A,#FF6B4A)", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <FileSpreadsheet size={16} color="white" />
            </div>
            <h1 style={{ fontSize:"20px", fontWeight:800, color:"var(--text)", letterSpacing:"-0.02em" }}>SFA Data Upload</h1>
          </div>
          <p style={{ fontSize:"12px", color:"var(--text3)", marginLeft:"42px" }}>
            Upload MasterDataSFA.xlsx → otomatis update 3 tabel Supabase → landing page terupdate
          </p>
        </div>
        <a href="/landing/utilisation" target="_blank">
          <button className="btn btn-ghost"><Eye size={14}/> Preview Landing</button>
        </a>
      </div>

      {/* Flow */}
      <div className="card" style={{ padding:"16px 20px" }}>
        <div style={{ display:"flex", gap:"0", alignItems:"center", flexWrap:"wrap" }}>
          {[
            { icon:<FileSpreadsheet size={20} color="#E8381A"/>, label:"Upload Excel",   sub:"MasterDataSFA.xlsx" },
            { icon:<ArrowRight size={18} color="var(--text3)"/>, label:"",              sub:"" },
            { icon:"⚙️",                                          label:"Parse & Filter",sub:"2026 active only" },
            { icon:<ArrowRight size={18} color="var(--text3)"/>, label:"",              sub:"" },
            { icon:<Database size={20} color="#1E88E5"/>,        label:"Supabase",      sub:"3 tables upsert" },
            { icon:<ArrowRight size={18} color="var(--text3)"/>, label:"",              sub:"" },
            { icon:<Globe size={20} color="#43A047"/>,           label:"Landing Page",  sub:"Real-time update" },
          ].map((s,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px", padding:"8px 12px" }}>
              {typeof s.icon === "string" && s.icon === "⚙️"
                ? <div style={{ textAlign:"center" }}><div style={{ fontSize:"22px" }}>{s.icon}</div><div style={{ fontSize:"11px", fontWeight:700, color:"var(--text)" }}>{s.label}</div><div style={{ fontSize:"10px", color:"var(--text3)" }}>{s.sub}</div></div>
                : s.label === ""
                  ? <span>{s.icon}</span>
                  : <div style={{ textAlign:"center" }}><div style={{ display:"flex", justifyContent:"center", marginBottom:"3px" }}>{s.icon}</div><div style={{ fontSize:"11px", fontWeight:700, color:"var(--text)" }}>{s.label}</div><div style={{ fontSize:"10px", color:"var(--text3)" }}>{s.sub}</div></div>
              }
            </div>
          ))}
        </div>
      </div>

      {/* Column mapping info */}
      <div className="card" style={{ padding:"14px 16px", background:"var(--accent-muted)", border:"1px solid var(--accent)" }}>
        <div style={{ fontSize:"12px", fontWeight:700, color:"var(--accent)", marginBottom:"8px" }}>📋 Mapping Kolom Excel → Database</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"6px", fontSize:"11px", color:"var(--text2)" }}>
          {[
            ["NAMA CABANG","→","branch_name"],["AREA","→","area"],["SLSNO","→","sls_no"],
            ["SLSNAME","→","sls_name"],["SALESFORCENAME","→","salesforce"],["TEAMNAME","→","team"],
            ["FLAG BLOK","→","flag_blok"],["DONE TRAINING","→","done_training"],
            ["DONE UPDATE","→","done_update"],["RELEASE SFA","→","sfa_version (v26.xx.xx)"],
            ["LAST ORDERDATE","→","last_order_date"],["CUTOFF","→","cutoff_date"],
          ].map(([from,,to],i)=>(
            <div key={i} style={{ display:"flex", gap:"4px", alignItems:"center", padding:"3px 0" }}>
              <code style={{ background:"rgba(0,0,0,0.07)", padding:"1px 5px", borderRadius:"4px", fontSize:"10px", fontWeight:700 }}>{from}</code>
              <span style={{ color:"var(--text3)" }}>→</span>
              <code style={{ fontSize:"10px" }}>{to}</code>
            </div>
          ))}
        </div>
        <div style={{ marginTop:"8px", fontSize:"10px", color:"var(--text3)" }}>
          ⚠️ Filter aktif: hanya baris dengan <strong>LAST ORDERDATE ∈ 2026</strong> yang di-upload
        </div>
      </div>

      {/* Upload area */}
      <div className="card" style={{ padding:"20px" }}>
        <div style={{ fontWeight:700, fontSize:"14px", marginBottom:"16px" }}>1. Upload File Excel</div>

        <div
          onDrop={e=>{ e.preventDefault(); setDragOver(false); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
          onDragOver={e=>{ e.preventDefault(); setDragOver(true) }}
          onDragLeave={()=>setDragOver(false)}
          onClick={()=>fileRef.current?.click()}
          style={{ border:`2px dashed ${dragOver?"var(--accent)":file?"var(--border)":"var(--border2)"}`, borderRadius:"var(--radius-sm)", padding:"clamp(32px,5vw,48px)", textAlign:"center", cursor:"pointer", background:dragOver?"var(--accent-muted)":"var(--surface2)", transition:"all 0.2s" }}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display:"none" }} onChange={e=>{ if(e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value="" }}/>
          {parsing ? (
            <div>
              <RefreshCw size={32} color="var(--accent)" style={{ margin:"0 auto 12px", display:"block", animation:"spin 1s linear infinite" }}/>
              <div style={{ fontWeight:600, color:"var(--text)" }}>Membaca file Excel...</div>
              <div style={{ fontSize:"11px", color:"var(--text3)", marginTop:"4px" }}>Parsing & filtering data 2026...</div>
            </div>
          ) : file ? (
            <div>
              <FileSpreadsheet size={32} color="var(--accent)" style={{ margin:"0 auto 12px", display:"block" }}/>
              <div style={{ fontWeight:700, color:"var(--text)", marginBottom:"4px" }}>{file.name}</div>
              <div style={{ fontSize:"12px", color:"var(--text3)" }}>{(file.size/1024/1024).toFixed(2)} MB · Klik untuk ganti file</div>
            </div>
          ) : (
            <div>
              <Upload size={32} color="var(--text3)" style={{ margin:"0 auto 12px", display:"block" }}/>
              <div style={{ fontWeight:600, color:"var(--text)", marginBottom:"4px" }}>Drop file di sini atau klik untuk pilih</div>
              <div style={{ fontSize:"12px", color:"var(--text3)" }}>Mendukung: MasterDataSFA.xlsx · kolom CUTOFF, NAMA CABANG, SLSNO, FLAG BLOK, dst.</div>
            </div>
          )}
        </div>

        {error && (
          <div style={{ marginTop:"12px", background:"var(--danger-bg)", border:"1px solid var(--danger)", borderRadius:"8px", padding:"10px 14px", fontSize:"12px", color:"var(--danger)", display:"flex", gap:"8px", alignItems:"flex-start" }}>
            <AlertCircle size={14} style={{ flexShrink:0, marginTop:"1px" }}/><div>{error}</div>
          </div>
        )}
      </div>

      {/* Preview */}
      {parsed && !done && (
        <div className="card" style={{ padding:"20px" }}>
          <div style={{ fontWeight:700, fontSize:"14px", marginBottom:"16px" }}>2. Preview Data Hasil Parse</div>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:"12px", marginBottom:"16px" }}>
            {[
              { l:"Total Rows (2026)", v:parsed.summary.totalRows.toLocaleString(),          c:"var(--text)" },
              { l:"Cutoff Dates",      v:parsed.summary.cutoffs.length.toString(),            c:"var(--accent)" },
              { l:"Latest Cutoff",     v:parsed.summary.latestCutoff,                         c:"var(--accent)" },
              { l:"Salesman (Latest)", v:parsed.summary.totalSalesman.toLocaleString(),        c:"#43A047" },
              { l:"Branches",          v:[...new Set(parsed.branches.filter(b=>b.cutoff_date===parsed.summary.latestCutoff).map(b=>b.branch_name))].length.toString(), c:"#1E88E5" },
              { l:"Snapshots to Save", v:parsed.snapshots.length.toString(),                  c:"#FB8C00" },
            ].map((s,i)=>(
              <div key={i} style={{ background:"var(--surface2)", borderRadius:"12px", padding:"14px" }}>
                <div style={{ fontSize:"10px", color:"var(--text3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:"6px" }}>{s.l}</div>
                <div style={{ fontSize:"22px", fontWeight:900, color:s.c, fontFamily:"'Bricolage Grotesque',sans-serif", lineHeight:1 }}>{s.v}</div>
              </div>
            ))}
          </div>

          {/* Cutoff chips */}
          <div style={{ marginBottom:"16px" }}>
            <div style={{ fontSize:"12px", fontWeight:600, color:"var(--text2)", marginBottom:"8px" }}>Cutoff dates yang akan di-upload:</div>
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
              {parsed.summary.cutoffs.map((c,i)=>(
                <span key={i} style={{ background:"var(--accent-muted)", color:"var(--accent)", fontSize:"11px", fontWeight:700, padding:"3px 10px", borderRadius:"99px" }}>{c}</span>
              ))}
            </div>
          </div>

          {/* Snapshot preview table */}
          <div style={{ overflowX:"auto", marginBottom:"16px" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"500px" }}>
              <thead>
                <tr style={{ borderBottom:"1px solid var(--border)" }}>
                  {["Cutoff","Total","Trained","Active","Updated","% Trained","% Active","% Updated"].map(h=>(
                    <th key={h} className="label" style={{ padding:"7px 10px", textAlign:"left", whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.snapshots.map((s,i)=>(
                  <tr key={i} style={{ borderBottom:"1px solid var(--border)", background:i===parsed.snapshots.length-1?"var(--accent-muted)":"transparent" }}>
                    <td style={{ padding:"8px 10px", fontWeight:700, color:"var(--accent)", fontSize:"12px" }}>{s.cutoff_date}</td>
                    <td style={{ padding:"8px 10px", fontSize:"12px" }}>{s.total.toLocaleString()}</td>
                    <td style={{ padding:"8px 10px", fontSize:"12px", color:"#E8381A", fontWeight:600 }}>{s.done_training.toLocaleString()}</td>
                    <td style={{ padding:"8px 10px", fontSize:"12px", color:"#1E88E5", fontWeight:600 }}>{s.active.toLocaleString()}</td>
                    <td style={{ padding:"8px 10px", fontSize:"12px", color:"#43A047", fontWeight:600 }}>{s.updated.toLocaleString()}</td>
                    <td style={{ padding:"8px 10px" }}><span style={{ fontWeight:800, color:s.pct_done===100?"#43A047":"#E8381A" }}>{s.pct_done}%</span></td>
                    <td style={{ padding:"8px 10px" }}><span style={{ fontWeight:800, color:"#1E88E5" }}>{s.pct_active}%</span></td>
                    <td style={{ padding:"8px 10px" }}><span style={{ fontWeight:800, color:s.pct_updated>=80?"#43A047":s.pct_updated>=60?"#FB8C00":"#E8381A" }}>{s.pct_updated}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Sample salesman */}
          {parsed.salesman.length > 0 && (
            <div style={{ marginBottom:"16px" }}>
              <div style={{ fontSize:"12px", fontWeight:600, color:"var(--text2)", marginBottom:"8px" }}>
                Sample salesman (3 pertama dari {parsed.salesman.length.toLocaleString()} total):
              </div>
              <div style={{ overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"600px" }}>
                  <thead>
                    <tr style={{ borderBottom:"1px solid var(--border)" }}>
                      {["SLS No","Name","Branch","Salesforce","Team","Flag","SFA Ver","Last Order"].map(h=>(
                        <th key={h} className="label" style={{ padding:"6px 8px", textAlign:"left", whiteSpace:"nowrap", fontSize:"9px" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.salesman.slice(0,3).map((s,i)=>(
                      <tr key={i} style={{ borderBottom:"1px solid var(--border)" }}>
                        <td style={{ padding:"6px 8px", fontSize:"11px", fontFamily:"monospace", color:"var(--text3)" }}>{s.sls_no}</td>
                        <td style={{ padding:"6px 8px", fontSize:"11px", fontWeight:600, color:"var(--text)" }}>{s.sls_name}</td>
                        <td style={{ padding:"6px 8px", fontSize:"10px", color:"var(--text2)", maxWidth:"120px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.branch_name}</td>
                        <td style={{ padding:"6px 8px", fontSize:"10px", color:"var(--text2)", maxWidth:"120px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.salesforce}</td>
                        <td style={{ padding:"6px 8px", fontSize:"10px", color:"var(--text2)" }}>{s.team}</td>
                        <td style={{ padding:"6px 8px" }}>
                          <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 6px", borderRadius:"99px", background:s.flag_blok==="T"?"#E8F5E9":"#FEF0ED", color:s.flag_blok==="T"?"#43A047":"#E8381A" }}>{s.flag_blok}</span>
                        </td>
                        <td style={{ padding:"6px 8px", fontSize:"10px", fontFamily:"monospace", color:"var(--text3)" }}>{s.sfa_version}</td>
                        <td style={{ padding:"6px 8px", fontSize:"10px", fontFamily:"monospace", color:"var(--text3)" }}>{s.last_order_date||"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div style={{ display:"flex", gap:"10px" }}>
            <button className="btn btn-primary" onClick={handleUpload} disabled={uploading} style={{ fontSize:"14px", padding:"12px 28px" }}>
              {uploading
                ? <><RefreshCw size={15} style={{ animation:"spin 1s linear infinite" }}/> Uploading...</>
                : <><Upload size={15}/> Upload ke Supabase</>}
            </button>
            <button className="btn btn-ghost" onClick={reset}>
              <Trash2 size={14}/> Reset
            </button>
          </div>
        </div>
      )}

      {/* Progress */}
      {progress.length > 0 && (
        <div className="card" style={{ padding:"20px" }}>
          <div style={{ fontWeight:700, fontSize:"14px", marginBottom:"12px" }}>3. Progress Upload</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
            {progress.map((p,i)=>(
              <div key={i} style={{ display:"flex", alignItems:"center", gap:"8px", fontSize:"12px",
                color:p.startsWith("✅")||p.startsWith("🎉")?"#43A047":p.startsWith("❌")?"#E8381A":"var(--text2)" }}>
                {p.startsWith("✅")||p.startsWith("🎉")
                  ? <CheckCircle size={13} color="#43A047"/>
                  : p.startsWith("❌")
                    ? <AlertCircle size={13} color="#E8381A"/>
                    : <RefreshCw size={13} color="var(--accent)" style={{ animation:"spin 1s linear infinite" }}/>
                }
                {p}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Success */}
      {done && (
        <div className="card" style={{ padding:"24px", background:"var(--success-bg)", border:"1px solid var(--success)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
            <CheckCircle size={28} color="var(--success)"/>
            <div>
              <div style={{ fontWeight:800, fontSize:"16px", color:"var(--success)", marginBottom:"4px" }}>Data berhasil diupload ke Supabase! 🎉</div>
              <div style={{ fontSize:"12px", color:"var(--text2)" }}>
                Landing page utilisation sekarang menampilkan data terbaru dari cutoff <strong>{parsed?.summary.latestCutoff}</strong>.<br/>
                <span style={{ color:"var(--text3)" }}>Realtime listener di landing page akan auto-refresh dalam beberapa detik.</span>
              </div>
            </div>
          </div>
          <div style={{ display:"flex", gap:"10px", marginTop:"16px" }}>
            <a href="/landing/utilisation" target="_blank">
              <button className="btn btn-primary"><Eye size={14}/> Lihat Landing Page</button>
            </a>
            <button className="btn btn-ghost" onClick={reset}>
              Upload File Baru
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}