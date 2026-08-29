"use client"
// PATH: src/app/dashboard/mpp-health/page.tsx

import { useEffect, useState } from "react"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type HealthRow = {
  id: number; snapshot_time: string; status: string
  subdist_issue: number; impacted_salesman: number
  rdm_active_zero: number; adm_active_zero: number; ads_active_zero: number
  subdist_list: any[]; message: string
}
type AlertSnapshot = {
  total_not_update: number; total_rdm: number; total_adm: number; total_ads: number
  top_rdm: string; top_rdm_count: number; top_ads: string; top_ads_count: number
  snapshot_time: string
}
type AlertDetail = {
  rdm_name: string; adm_name: string; ads_name: string
  salesman_name: string; last_date: string
}
type MasterADP = {
  adp_code: number; depot: string; distributor_name: string
  server: number; server_name: string; area_name: string
  ads_name: string; adm_name: string
}
type FicomPassword = {
  user_login: string; sales_name: string; password: string; position: string
}
type SubdistCard = {
  wf: string; name: string; impacted_salesman: number
  adp_code: number|null; distributor_name: string|null
  server: number|null; server_name: string|null
  depot: string|null; area_name: string|null
  // ADS ficom
  ficom_ads_user: string|null; ficom_ads_pass: string|null; ficom_ads_pic: string|null
  // ADM ficom
  ficom_adm_user: string|null; ficom_adm_pass: string|null; ficom_adm_pic: string|null
}
type RDMGroup = {
  rdm_name: string; total: number
  adms: { adm_name: string; salesman: {name:string; last_date:string}[] }[]
}

export default function MPPHealthPage() {
  const [tab, setTab]               = useState<"health"|"activity">("health")
  const [health, setHealth]         = useState<HealthRow|null>(null)
  const [alertSnap, setAlertSnap]   = useState<AlertSnapshot|null>(null)
  const [subdistCards, setSubdistCards] = useState<SubdistCard[]>([])
  const [rdmGroups, setRdmGroups]   = useState<RDMGroup[]>([])
  const [histHealth, setHistHealth] = useState<{date:string; val:number; snapshots:{time:string;val:number}[]}[]>([])
  const [selectedDay, setSelectedDay] = useState<typeof histHealth[0]|null>(null)
  const [loading, setLoading]       = useState(true)
  const [showPassMap, setShowPassMap] = useState<Record<string,boolean>>({})
  const [expandedRDM, setExpandedRDM] = useState<Set<string>>(new Set())
  const [search, setSearch]         = useState("")
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState("")
  const [loadError, setLoadError]   = useState("")

  useEffect(() => {
    loadData()
    const t = setInterval(loadData, 5*60*1000)
    return () => clearInterval(t)
  }, [])

  async function loadData() {
    setLoading(true)
    setLoadError("")
    // try/catch: kalau ada kegagalan JARINGAN (bukan cuma "0 baris" —
    // itu ditangani wajar oleh maybeSingle di bawah, resolve null tanpa
    // reject), Promise.all bisa reject dan bikin setLoading(false) di
    // bawah tidak kepanggil, halaman stuck loading selamanya.
    // .single()->.maybeSingle(): tabel BISA genuinely kosong sekarang
    // (percobaan pertama sebelum sync API pertama jalan, sebelum ini
    // n8n yang selalu isi duluan) — .single() nganggep 0 baris sbg error
    // (walau tidak throw, cuma bikin field error keisi & data null,
    // padahal itu bukan error beneran di kondisi awal).
    let h, snap, det, master, ficom, hist
    try {
      ;({ data: h } = await supabase.from("m_dashboard_health").select("*").order("id",{ascending:false}).limit(1).maybeSingle())
      ;({ data: snap } = await supabase.from("mpp_alert_snapshot").select("*").order("id",{ascending:false}).limit(1).maybeSingle())
      ;[{ data: det }, { data: master }, { data: ficom }, { data: hist }] = await Promise.all([
        supabase.from("mpp_alert_detail").select("rdm_name,adm_name,ads_name,salesman_name,last_date").order("snapshot_time",{ascending:false}).limit(500),
        supabase.from("master_data_adp").select("adp_code,depot,distributor_name,server,server_name,area_name,adm_name,ads_name"),
        supabase.from("ficom_passwords").select("user_login,sales_name,password,position").in("position",["ADM","ADS"]),
        supabase.from("m_dashboard_health").select("snapshot_time,subdist_issue").order("id",{ascending:false}).limit(200),
      ])
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Gagal memuat data")
      setLoading(false)
      return
    }

    if (h) {
      setHealth(h)
      const cards: SubdistCard[] = (h.subdist_list||[]).map((s:any) => {
        const wfCode = s.wf?.toUpperCase()||""
        const adpMatch = (master||[]).find((m:MasterADP) => m.adm_name?.toUpperCase().startsWith(wfCode+"-"))
        // ADM login = subdist WF code e.g. "WF2103" -> ficom user_login="WF2103" position="ADM"
        const admWf    = s.wf?.toUpperCase()||""
        const ficomADM = (ficom||[]).find((f:FicomPassword) =>
          f.user_login?.toUpperCase() === admWf && f.position?.toUpperCase() === "ADM"
        )
        // ADS login = WF prefix of ads_name e.g. "WF0204-BPE SUR-..." -> "WF0204"
        const adsNameRaw = adpMatch?.ads_name || ""
        const dashIdx    = adsNameRaw.indexOf("-")
        const adsWf      = dashIdx > 0 ? adsNameRaw.slice(0, dashIdx).toUpperCase() : ""
        const ficomADS   = adsWf ? (ficom||[]).find((f:FicomPassword) =>
          f.user_login?.toUpperCase() === adsWf && f.position?.toUpperCase() === "ADS"
        ) : null
        return {
          wf: s.wf||"—", name: s.name||"—", impacted_salesman: s.impacted_salesman??0,
          adp_code:         adpMatch?.adp_code         ?? null,
          distributor_name: adpMatch?.distributor_name  ?? null,
          server:           adpMatch?.server            ?? null,
          server_name:      adpMatch?.server_name       ?? null,
          depot:            adpMatch?.depot             ?? null,
          area_name:        adpMatch?.area_name         ?? null,
          ficom_ads_user:   ficomADS?.user_login  ?? null,
          ficom_ads_pass:   ficomADS?.password    ?? null,
          ficom_ads_pic:    ficomADS?.sales_name  ?? null,
          ficom_adm_user:   ficomADM?.user_login  ?? null,
          ficom_adm_pass:   ficomADM?.password    ?? null,
          ficom_adm_pic:    ficomADM?.sales_name  ?? null,
        }
      })
      setSubdistCards(cards)
    }

    if (snap) setAlertSnap(snap)

    if (det) {
      // Group by RDM
      const rdmMap: Record<string, Record<string, {name:string;last_date:string}[]>> = {}
      ;(det as AlertDetail[]).forEach(d => {
        if (!rdmMap[d.rdm_name]) rdmMap[d.rdm_name] = {}
        if (!rdmMap[d.rdm_name][d.adm_name]) rdmMap[d.rdm_name][d.adm_name] = []
        rdmMap[d.rdm_name][d.adm_name].push({name:d.salesman_name, last_date:d.last_date})
      })
      const groups: RDMGroup[] = Object.entries(rdmMap)
        .map(([rdm_name, adms]) => ({
          rdm_name,
          total: Object.values(adms).reduce((s,a)=>s+a.length,0),
          adms: Object.entries(adms).map(([adm_name,salesman])=>({adm_name,salesman}))
            .sort((a,b)=>b.salesman.length-a.salesman.length),
        }))
        .sort((a,b)=>b.total-a.total)
      setRdmGroups(groups)
    }

    if (hist) {
      const byDate: Record<string,{val:number;snapshots:{time:string;val:number}[]}> = {}
      for (const row of [...hist].reverse()) { // oldest first so snapshots are chronological
        const date = new Date(row.snapshot_time).toLocaleDateString("id-ID",{day:"2-digit",month:"short"})
        const time = new Date(row.snapshot_time).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
        const val  = row.subdist_issue||0
        if (!byDate[date]) byDate[date] = {val, snapshots:[]}
        byDate[date].snapshots.push({time, val})
        byDate[date].val = val // last value of the day
      }
      setHistHealth(Object.entries(byDate).slice(-30).map(([date,d])=>({date,...d})))
    }
    setLoading(false)
  }

  async function handleSync() {
    setSyncing(true); setSyncMsg("")
    try {
      const res = await fetch("/api/mpp-health-sync", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Sync gagal")
      setSyncMsg(`✅ Sync selesai — ${data.subdistIssue} subdist bermasalah, ${data.totalNotUpdate} salesman tanpa aktivitas`)
      await loadData()
    } catch (e) {
      setSyncMsg("❌ " + (e instanceof Error ? e.message : String(e)))
    }
    setSyncing(false)
  }

  const isHealthy   = (health?.subdist_issue||0) === 0
  const statusColor = isHealthy ? "#16A34A" : "#DC2626"
  const fmtTime = (s:string) => s ? new Date(s).toLocaleString("id-ID",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "—"

  const filteredCards = subdistCards.filter(c =>
    !search || [c.wf,c.name,c.distributor_name||"",c.depot||"",c.area_name||""].some(v=>v.toLowerCase().includes(search.toLowerCase()))
  )
  const filteredRDMs = rdmGroups.filter(r =>
    !search || r.rdm_name.toLowerCase().includes(search.toLowerCase()) ||
    r.adms.some(a => a.adm_name.toLowerCase().includes(search.toLowerCase()))
  )

  const maxRDM = Math.max(...rdmGroups.map(r=>r.total), 1)

  if (loading && !health) return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"60vh",flexDirection:"column",gap:12}}>
      <div style={{width:32,height:32,border:"3px solid #1E3A5F",borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <p style={{fontSize:13,color:"var(--text3)"}}>Memuat data...</p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{padding:"20px 24px",fontFamily:"'Plus Jakarta Sans',sans-serif",background:"var(--bg)",minHeight:"100%",display:"flex",flexDirection:"column",gap:14}}>

      {/* Banner */}
      <div style={{background:isHealthy?"linear-gradient(135deg,#052e16,#14532d)":"linear-gradient(135deg,#450a0a,#7f1d1d)",borderRadius:14,padding:"18px 22px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",right:-30,top:-30,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,0.04)"}}/>
        <div style={{position:"relative",zIndex:1,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{width:42,height:42,borderRadius:12,background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>🏥</div>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                <h1 style={{fontSize:17,fontWeight:800,color:"white"}}>MPP Health Monitoring</h1>
                <div style={{display:"flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:99,background:isHealthy?"rgba(34,197,94,0.2)":"rgba(239,68,68,0.2)",border:`1px solid ${isHealthy?"rgba(34,197,94,0.4)":"rgba(239,68,68,0.4)"}`}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:statusColor,animation:isHealthy?"none":"pulse 1.5s infinite"}}/>
                  <span style={{fontSize:10,fontWeight:700,color:statusColor}}>{isHealthy?"HEALTHY":"WARNING"}</span>
                </div>
              </div>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.5)"}}>Last update: {fmtTime(health?.snapshot_time||"")} · Auto-sync tiap jam (Vercel Cron) · Auto-refresh tampilan 5 menit</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {!isHealthy&&<div style={{padding:"6px 12px",borderRadius:8,background:"rgba(239,68,68,0.2)",border:"1px solid rgba(239,68,68,0.4)",fontSize:11,fontWeight:700,color:"#FCA5A5"}}>🚨 {health?.subdist_issue} Subdist Issue</div>}
            <div style={{padding:"6px 12px",borderRadius:8,background:"rgba(251,146,60,0.2)",border:"1px solid rgba(251,146,60,0.4)",fontSize:11,fontWeight:700,color:"#FED7AA"}}>📵 {alertSnap?.total_not_update||0} Tanpa Aktivitas</div>
            <button onClick={handleSync} disabled={syncing}
              title="Login Ficom & hitung ulang MPP Health langsung dari API (ganti n8n)"
              style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,0.25)",background:syncing?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.18)",cursor:syncing?"not-allowed":"pointer",fontSize:11,fontWeight:700,color:"white",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
              <span style={{animation:syncing?"spin 0.8s linear infinite":"none",display:"inline-block"}}>⚡</span> {syncing?"Sync...":"Sync dari Ficom"}
            </button>
            <button onClick={loadData} disabled={loading} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,0.2)",background:"rgba(255,255,255,0.1)",cursor:"pointer",fontSize:11,color:"white",fontFamily:"inherit",display:"flex",alignItems:"center",gap:5}}>
              <span style={{animation:loading?"spin 0.8s linear infinite":"none",display:"inline-block"}}>↻</span> Refresh
            </button>
          </div>
        </div>
      </div>

      {syncMsg && (
        <div style={{background:syncMsg.startsWith("✅")?"#DCFCE7":"#FEE2E2",border:`1px solid ${syncMsg.startsWith("✅")?"#BBF7D0":"#FECACA"}`,borderRadius:8,padding:"10px 14px",fontSize:12,color:syncMsg.startsWith("✅")?"#166534":"#991B1B"}}>
          {syncMsg}
        </div>
      )}
      {loadError && (
        <div style={{background:"#FEE2E2",border:"1px solid #FECACA",borderRadius:8,padding:"10px 14px",fontSize:12,color:"#991B1B"}}>
          ❌ Gagal memuat data: {loadError}
        </div>
      )}

      {/* KPI row */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
        {[
          {label:"Subdist Bermasalah",    value:health?.subdist_issue||0,      color:"#DC2626",icon:"🚨"},
          {label:"Salesman Berisiko",     value:health?.impacted_salesman||0,   color:"#EA580C",icon:"👥"},
          {label:"Tanpa Aktivitas Hari Ini", value:alertSnap?.total_not_update||0, color:"#CA8A04",icon:"📵"},
          {label:"RDM Terdampak",         value:alertSnap?.total_rdm||0,        color:"#7C3AED",icon:"📍"},
          {label:"ADM Terdampak",         value:alertSnap?.total_adm||0,        color:"#1E3A5F",icon:"🏢"},
          {label:"ADS Terdampak",         value:alertSnap?.total_ads||0,        color:"#0891B2",icon:"📦"},
        ].map((c,i)=>(
          <div key={i} style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden"}}>
            <div style={{height:2,background:c.color}}/>
            <div style={{padding:"10px 12px"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:4}}>
                <span style={{fontSize:9,color:"var(--text3)",fontWeight:600,lineHeight:1.3}}>{c.label}</span>
                <span style={{fontSize:14}}>{c.icon}</span>
              </div>
              <div style={{fontSize:22,fontWeight:800,color:c.color,letterSpacing:"-0.03em"}}>{c.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",gap:0,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,overflow:"hidden",width:"fit-content"}}>
        {([
          {id:"health"  as const, icon:"🚨", label:"MPP Health",    sub:`${health?.subdist_issue||0} subdist bermasalah`},
          {id:"activity"as const, icon:"📵", label:"SFA Activity",  sub:`${alertSnap?.total_not_update||0} tanpa aktivitas`},
        ]).map((t,i)=>(
          <button key={t.id} onClick={()=>{setTab(t.id);setSearch("")}}
            style={{display:"flex",alignItems:"center",gap:8,padding:"10px 18px",border:"none",cursor:"pointer",fontFamily:"inherit",background:tab===t.id?(t.id==="health"?"#DC2626":"#1E3A5F"):"transparent",color:tab===t.id?"white":"var(--text3)",borderRight:i===0?"1px solid var(--border)":"none",transition:"all 0.15s"}}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <div style={{textAlign:"left"}}>
              <div style={{fontSize:12,fontWeight:700}}>{t.label}</div>
              <div style={{fontSize:10,opacity:0.7}}>{t.sub}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ══ TAB 1: MPP HEALTH ══ */}
      {tab==="health" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Trend mini */}
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"14px 18px"}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
              <span style={{fontSize:12,fontWeight:700}}>📈 Trend Subdist Bermasalah (30 hari)</span>
            </div>
            {histHealth.length>0 ? (
              <>
                <div style={{display:"flex",alignItems:"flex-end",gap:3,height:60}}>
                  {histHealth.map((h,i)=>{
                    const max=Math.max(...histHealth.map(x=>x.val),1)
                    const bh=Math.max((h.val/max)*50,3)
                    const ok=h.val===0
                    const isSel=selectedDay?.date===h.date
                    return <div key={i} onClick={()=>setSelectedDay(isSel?null:h)}
                      title={`${h.date}: klik untuk detail`}
                      style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-end",gap:2,height:"100%",cursor:"pointer"}}>
                      <div style={{fontSize:7,fontWeight:700,color:ok?"#16A34A":"#DC2626"}}>{h.val>0?h.val:""}</div>
                      <div style={{width:"100%",height:bh,borderRadius:"2px 2px 0 0",
                        background:ok?"#16A34A":"#DC2626",
                        opacity:isSel?1:0.75,
                        outline:isSel?`2px solid ${ok?"#16A34A":"#DC2626"}`:"none",
                        outlineOffset:1,
                        transition:"all 0.15s"}}/>
                    </div>
                  })}
                </div>
                <div style={{display:"flex",gap:3,marginTop:3}}>
                  {histHealth.map((h,i)=>(
                    <div key={i} style={{flex:1,fontSize:7,textAlign:"center",overflow:"hidden",
                      fontWeight:selectedDay?.date===h.date?700:"normal",
                      color:selectedDay?.date===h.date?"var(--text)":"var(--text3)"}}>
                      {i%Math.max(1,Math.floor(histHealth.length/6))===0?h.date:""}
                    </div>
                  ))}
                </div>
                <p style={{fontSize:10,color:"var(--text3)",textAlign:"center",marginTop:6}}>
                  Klik bar untuk lihat detail per jam
                </p>

                {/* Expanded day timeline */}
                {selectedDay && (
                  <div style={{marginTop:10,borderTop:"1px solid var(--border)",paddingTop:10}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                      <span style={{fontSize:12,fontWeight:700}}>
                        📅 {selectedDay.date} — {selectedDay.snapshots.length} snapshot
                      </span>
                      <button onClick={()=>setSelectedDay(null)}
                        style={{fontSize:11,border:"none",background:"none",cursor:"pointer",color:"var(--text3)",padding:0}}>✕ tutup</button>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                      {selectedDay.snapshots.map((s,i)=>{
                        const ok=s.val===0
                        return (
                          <div key={i} style={{
                            display:"flex",alignItems:"center",gap:5,
                            padding:"4px 10px",borderRadius:8,
                            background:ok?"#F0FDF4":"#FEF2F2",
                            border:`1px solid ${ok?"#BBF7D0":"#FECACA"}`,
                            fontSize:11,
                          }}>
                            <span style={{fontFamily:"monospace",color:"var(--text3)",fontSize:10}}>{s.time}</span>
                            <span style={{fontWeight:700,color:ok?"#16A34A":"#DC2626"}}>
                              {ok?"✓":"⚠️"} {s.val}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    {/* Mini summary */}
                    <div style={{display:"flex",gap:12,marginTop:8,fontSize:11,color:"var(--text3)"}}>
                      <span>Max: <strong style={{color:"#DC2626"}}>{Math.max(...selectedDay.snapshots.map(s=>s.val))}</strong></span>
                      <span>Min: <strong style={{color:"#16A34A"}}>{Math.min(...selectedDay.snapshots.map(s=>s.val))}</strong></span>
                      <span>Snapshots: <strong>{selectedDay.snapshots.length}</strong></span>
                    </div>
                  </div>
                )}
              </>
            ) : <p style={{fontSize:11,color:"var(--text3)",textAlign:"center"}}>Belum ada data historis</p>}
          </div>

          {/* Search + count */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <div>
              <span style={{fontSize:13,fontWeight:700}}>
                {isHealthy ? "✅ Semua Subdist Healthy" : `🚨 ${subdistCards.length} Subdist Tanpa Salesman Aktif`}
              </span>
              <span style={{fontSize:11,color:"var(--text3)",marginLeft:8}}>active = 0 & MPP &gt; 0</span>
            </div>
            {!isHealthy && (
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari WF, nama, distributor..."
                style={{fontSize:12,border:"1px solid var(--border)",borderRadius:8,padding:"6px 12px",background:"var(--surface2)",color:"var(--text)",outline:"none",width:220,fontFamily:"inherit"}}/>
            )}
          </div>

          {/* Cards grid */}
          {isHealthy ? (
            <div style={{textAlign:"center",padding:"48px",background:"linear-gradient(135deg,#F0FDF4,#DCFCE7)",borderRadius:16,border:"1.5px solid #BBF7D0"}}>
              <div style={{fontSize:52,marginBottom:10}}>✅</div>
              <p style={{fontSize:15,fontWeight:800,color:"#16A34A"}}>Semua Subdist HEALTHY</p>
              <p style={{fontSize:12,color:"#166534",marginTop:4}}>Tidak ada subdist dengan issue saat ini</p>
            </div>
          ) : (
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
              {filteredCards.map((card,i)=>{
                // wf bisa fallback "—" (belum ketemu padanan) buat lebih dari
                // 1 kartu — kalau cuma pakai card.wf sbg key, state per-kartu
                // (showPassMap, React key) bisa tabrakan/nyasar antar kartu
                // yang tidak berhubungan. Gabung sama index biar selalu unik.
                const cardKey = `${card.wf}-${i}`
                return (
                <div key={cardKey} style={{background:"var(--surface)",border:"1.5px solid var(--border)",borderRadius:12,overflow:"hidden",transition:"box-shadow 0.15s"}}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.boxShadow="0 4px 16px rgba(220,38,38,0.12)"}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.boxShadow="none"}>
                  {/* Card header */}
                  <div style={{background:"#FEF2F2",borderBottom:"1px solid #FECACA",padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:11,fontWeight:800,background:"#DC2626",color:"white",padding:"2px 8px",borderRadius:6}}>{card.wf}</span>
                      <span style={{fontSize:12,fontWeight:700,color:"#7F1D1D"}}>{card.name}</span>
                    </div>
                    <span style={{fontSize:11,fontWeight:800,color:"#DC2626"}}>⚠️ {card.impacted_salesman}</span>
                  </div>
                  {/* Card body */}
                  <div style={{padding:"10px 14px",display:"flex",flexDirection:"column",gap:6}}>
                    {/* Distributor + ADP */}
                    <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11}}>
                      <span style={{color:"var(--text3)",flexShrink:0}}>🏢</span>
                      <span style={{color:"var(--text2)",fontWeight:500,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                        {card.distributor_name||<em style={{color:"var(--text3)"}}>Distributor tidak ditemukan</em>}
                      </span>
                      {card.adp_code&&<span style={{fontSize:10,background:"var(--surface2)",border:"1px solid var(--border)",padding:"1px 6px",borderRadius:4,fontWeight:700,flexShrink:0}}>{card.adp_code}</span>}
                    </div>
                    {/* Server + Depot */}
                    <div style={{display:"flex",gap:6}}>
                      {card.server&&(
                        <span style={{fontSize:10,background:"#EFF6FF",border:"1px solid #BFDBFE",color:"#1E3A5F",padding:"2px 8px",borderRadius:6,fontWeight:700}}>
                          Server {card.server}{card.server_name?` · ${card.server_name}`:""}
                        </span>
                      )}
                      {card.depot&&<span style={{fontSize:10,background:"var(--surface2)",border:"1px solid var(--border)",color:"var(--text3)",padding:"2px 8px",borderRadius:6}}>{card.depot}</span>}
                    </div>
                    {/* Area */}
                    {card.area_name&&(
                      <div style={{fontSize:10,color:"var(--text3)"}}>📍 {card.area_name}</div>
                    )}
                    {/* Ficom passwords - ADM + ADS */}
                    <div style={{borderTop:"1px solid var(--border)",paddingTop:8,marginTop:2,display:"flex",flexDirection:"column",gap:5}}>
                      {[
                        {role:"ADM", user:card.ficom_adm_user, pass:card.ficom_adm_pass, pic:card.ficom_adm_pic, key:cardKey+"_adm"},
                        {role:"ADS", user:card.ficom_ads_user, pass:card.ficom_ads_pass, pic:card.ficom_ads_pic, key:cardKey+"_ads"},
                      ].map(({role,user,pass,pic,key})=>(
                        <div key={key}>
                          {user ? (
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontSize:9,fontWeight:700,background:role==="ADM"?"#EFF6FF":"#F0FDF4",color:role==="ADM"?"#1E3A5F":"#16A34A",border:`1px solid ${role==="ADM"?"#BFDBFE":"#BBF7D0"}`,padding:"1px 6px",borderRadius:4,flexShrink:0}}>{role}</span>
                              <span style={{fontSize:10,color:"var(--text3)",flexShrink:0}}>{user}{pic?` · ${pic}`:""}</span>
                              <span style={{fontSize:10,fontFamily:"monospace",background:"var(--surface2)",border:"1px solid var(--border)",padding:"1px 6px",borderRadius:4,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                {showPassMap[key] ? pass : "••••••••"}
                              </span>
                              <button onClick={()=>setShowPassMap(p=>({...p,[key]:!p[key]}))}
                                style={{fontSize:11,border:"none",background:"none",cursor:"pointer",color:"var(--text3)",padding:0,lineHeight:1,flexShrink:0}}>
                                {showPassMap[key]?"🙈":"👁️"}
                              </button>
                              <button onClick={()=>navigator.clipboard.writeText(pass||"")}
                                title={`Copy password ${role}`} style={{fontSize:11,border:"none",background:"none",cursor:"pointer",color:"var(--text3)",padding:0,lineHeight:1,flexShrink:0}}>📋</button>
                            </div>
                          ) : (
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontSize:9,fontWeight:700,background:"var(--surface2)",color:"var(--text3)",border:"1px solid var(--border)",padding:"1px 6px",borderRadius:4}}>{role}</span>
                              <span style={{fontSize:10,color:"var(--text3)",fontStyle:"italic"}}>tidak ditemukan</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )})}
              {filteredCards.length===0&&search&&(
                <p style={{fontSize:12,color:"var(--text3)",gridColumn:"1/-1",textAlign:"center",padding:"20px"}}>Tidak ada hasil untuk "{search}"</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 2: SFA ACTIVITY ══ */}
      {tab==="activity" && (
        <div style={{display:"flex",flexDirection:"column",gap:12}}>

          {/* Summary + top */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div style={{background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#DC2626",letterSpacing:"0.08em",marginBottom:5}}>🔴 TOP RDM — PALING BANYAK TIDAK AKTIF</div>
              <div style={{fontSize:15,fontWeight:800,color:"var(--text)",marginBottom:3}}>{alertSnap?.top_rdm||"—"}</div>
              <div style={{fontSize:12,color:"#DC2626",fontWeight:600}}>{alertSnap?.top_rdm_count||0} salesman tanpa aktivitas</div>
            </div>
            <div style={{background:"#FFF7ED",border:"1px solid #FED7AA",borderRadius:12,padding:"14px 16px"}}>
              <div style={{fontSize:10,fontWeight:700,color:"#EA580C",letterSpacing:"0.08em",marginBottom:5}}>🟠 TOP ADS — PALING BANYAK TIDAK AKTIF</div>
              <div style={{fontSize:15,fontWeight:800,color:"var(--text)",marginBottom:3}}>{alertSnap?.top_ads||"—"}</div>
              <div style={{fontSize:12,color:"#EA580C",fontWeight:600}}>{alertSnap?.top_ads_count||0} salesman tanpa aktivitas</div>
            </div>
          </div>

          {/* Search */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <span style={{fontSize:13,fontWeight:700}}>📵 {rdmGroups.length} RDM · {alertSnap?.total_not_update||0} Salesman Tanpa Aktivitas Hari Ini</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari RDM atau ADM..."
              style={{fontSize:12,border:"1px solid var(--border)",borderRadius:8,padding:"6px 12px",background:"var(--surface2)",color:"var(--text)",outline:"none",width:200,fontFamily:"inherit"}}/>
          </div>

          {/* Bar chart per RDM */}
          <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:12,padding:"16px 18px"}}>
            <p style={{fontSize:12,fontWeight:700,marginBottom:12}}>Salesman Tanpa Aktivitas per RDM</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {rdmGroups.map((r,i)=>{
                const pct = Math.round(r.total/maxRDM*100)
                const isExp = expandedRDM.has(r.rdm_name)
                return (
                  <div key={i}>
                    <div onClick={()=>setExpandedRDM(prev=>{const n=new Set(prev);n.has(r.rdm_name)?n.delete(r.rdm_name):n.add(r.rdm_name);return n})}
                      style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",padding:"4px 6px",borderRadius:8,transition:"background 0.15s"}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background="var(--surface2)"}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background="transparent"}>
                      <span style={{fontSize:10,color:"var(--text3)",width:16,textAlign:"right",flexShrink:0}}>{i+1}</span>
                      <div style={{width:170,fontSize:11,color:"var(--text2)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flexShrink:0}}>{r.rdm_name}</div>
                      <div style={{flex:1,height:8,background:"var(--surface2)",borderRadius:99,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${pct}%`,background:"#DC2626",borderRadius:99,transition:"width 0.4s"}}/>
                      </div>
                      <span style={{fontSize:12,fontWeight:800,color:"#DC2626",width:28,textAlign:"right",flexShrink:0}}>{r.total}</span>
                      <span style={{fontSize:11,color:"var(--text3)",transition:"transform 0.2s",transform:isExp?"rotate(180deg)":"none"}}>▾</span>
                    </div>
                    {/* Expanded ADM list */}
                    {isExp && (
                      <div style={{marginLeft:32,marginTop:4,marginBottom:8,display:"flex",flexDirection:"column",gap:4}}>
                        {r.adms.map((a,j)=>(
                          <div key={j} style={{background:"var(--surface2)",borderRadius:8,padding:"8px 12px"}}>
                            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                              <span style={{fontSize:11,fontWeight:600,color:"var(--text)"}}>{a.adm_name}</span>
                              <span style={{fontSize:11,fontWeight:800,background:"#FEE2E2",color:"#DC2626",padding:"1px 8px",borderRadius:99}}>{a.salesman.length}</span>
                            </div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                              {a.salesman.map((s,k)=>(
                                <span key={k} title={`Last: ${s.last_date}`}
                                  style={{fontSize:9,background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text3)",padding:"2px 7px",borderRadius:4,cursor:"default"}}>
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {filteredRDMs.length===0&&search&&(
                <p style={{fontSize:12,color:"var(--text3)",textAlign:"center",padding:"12px"}}>Tidak ada hasil untuk "{search}"</p>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin  { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}