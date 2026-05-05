"use client"
// PATH: src/app/landing/ficom-lite/page.tsx
// Utilisasi = siapa yang sudah LOGIN ke Ficom Lite (dari access log)
// vs total user di master (ADM + RDM + SS dari productivity data)
import { useState, useEffect, useRef, useMemo } from "react"
import LandingNav from "../components/LandingNav"
import { supabase } from "@/lib/supabase"

// ── Types ─────────────────────────────────────────────────────
interface FLSnapshot {
  period_label: string; period_month: string; as_of_date: string; selling_days: number
  total_users: number; active_users: number; utilisation_pct: number
  total_adm: number; active_adm: number; pct_adm: number
  total_rdm: number; active_rdm: number; pct_rdm: number
  total_ss: number;  active_ss: number;  pct_ss: number
}
interface FLArea {
  period_month: string; aor: string
  total_users: number; active_users: number; utilisation_pct: number
  total_adm: number; active_adm: number
  total_rdm: number; active_rdm: number
  total_ss: number;  active_ss: number
}
interface FLUser {
  period_month: string; user_id: string; username: string
  role: string          // ADM | RDM | SS
  aor: string; rdm_name: string; sub_aor: string
  active_days: number; selling_days: number; compliance_pct: number
  last_access_date: string | null; is_active: number
  pages_accessed: string // comma-separated pages
}

const AOR_COLORS: Record<string,string> = {
  GMA:"#F97316", MIN:"#3B82F6", NOL:"#22C55E", SOL:"#EF4444", VIS:"#A855F7"
}
const AOR_NAMES = ["GMA","MIN","NOL","SOL","VIS"] as const
const FL_GREEN  = "#22C55E"
const FL_TEAL   = "#06B6D4"

const utilColor = (p:number) => p>=80?"#22C55E":p>=60?"#10B981":p>=40?"#F97316":"#EF4444"
const compColor = (p:number) => p>=80?"#22C55E":p>=60?"#84CC16":p>=40?"#F97316":"#EF4444"

const LITE_LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCABCAEoDASIAAhEBAxEB/8QAGwABAAIDAQEAAAAAAAAAAAAAAAUGAQMHBAj/xAAtEAABAwQBAwQBAgcAAAAAAAABAgMEAAUGERIHEyEiMUFRMiNhCBQVJkJx4f/EABoBAQEBAQEBAQAAAAAAAAAAAAADBAIBBQb/xAApEQABBAADBwQDAAAAAAAAAAABAAIDESExQQQSIjKRwdEFE2GBcaHw/9oADAMBAAIRAxEAPwD7LpSlESlDXludxt9rhLm3OdGhRW9c3pDqW0J2dDalEAeSBXoBJoIvVSuXXLqLkGRznoPSuzRruiG4tMy6TwpMIlKNhpohSStZJA37DwfKVchLYn1PsN0lvWe9/wBtX+M4ll+23FxKFczrXbWdJcB3414y5YGbITGaouJrXhsD9FZ5C0SDeF3Q6mu6v0iXZ8fsIkEsQ7ZGQlCey3+m2nYSkJSge2yB4FQGXrwC/WdDuRR4Fxi9sBC1x1OOMB1II0Ujm0VADz6T4H1VRyW9KuthulghyFyVhlpLMZtrkXFh1sq4EDaiNL2PobGxvXlssKfepDtitDxDLzUdNzk6Cm0BtASEJI/Lzy8g+o61pIKj+eZ6qXML4+esBqXa65dFvlZs42QyB1v3i0DO6rycVGXrH8QxudiV96dv3C3Jl5RDts1LEyQG321EqUhaXDs+yf20T713yuM3rH2LZ1MwLFv5pUmCu5TLqWiRzSpqOjsqXr6Wlej7H2rs1fbdJNJBE6fnIJPUjssEAIuxSUpSoLQlKUoiwa+fcRh3Zgy+mcHtCfYZ8hlpSnAlwQHyHEOq0fOwtXIpHpCkJIBVo/QRqmdRsLXf3Yt9sUxNqym2AmDO4+lY87ZdGvU2dn747JAOyDVobLG+B7i0O1Gh8EEg/BUJ4t8LTK6aWhywMwGXltTW1cjM47KydcgU7/Hx4G/H35O7XYLRCsdtRAgN8GkeVKPlS1fKlH5J/4NAAVT8I6kwrgHLPlraMbyaEhapkKWrttqS2CVPNLJ4qbIBV7nQCj5SORiLhkt66lXCZj2CvKg4+z+jcci0f1Cfyaij5Vr3X8b2NegqnD6QyGQuDA2hidK778YleN9pvE0Yrdg7yMq60ZHl0N1ty12qEixRXW0kpkL5B11XI/KFHj4GiFAg/fUKjcastuxywxLJamAzDiN8G0/J+SSfkkkkn5JNSQqs8gkfw5DAfXnNVY0tGOaUpSortKUpRFg1Fv5JjsdbyH79amlMcu8lcxtJb4/ly2fGvnftUqa50On0+PasgehXNtq83Bc9cNYbaQiMp95xbaw8loPhQSoA+pQG1AbATq0TGO5zS5cSMgp/McdwzLnmLLkcWBOlNoMhlhT3CQhGwCpJSQsJJAB14JA37VYYcaNDitRIjDUeOygIaaaQEoQkDQAA8AAfAqkHD57dtuzzVvsTt/kTpciFdJB7jjJV3FRnCVNKIU2VIbCfICU7B/wATpawzJErgQ0ZDcGbWhcZ2YlV5fekuKDMhEgB5SQritS4+gOAHBSkhtWqoWgt3d/Af2C5sg3S6DWao3TjGcrsMtC75f13Npy1stSEuTHX9y0Lc5LQFgBKS2pCfGiop2QT5N5qEjQ11A2u2kkWUpSlcL1KUpREpSlESlKURKUpREpSlEX//2Q=="

async function fetchFLData() {
  const [snap, areas, users, master] = await Promise.all([
    supabase.from("fl_snapshots").select("*").order("period_month"),
    supabase.from("fl_areas").select("*").order("aor"),
    supabase.from("fl_users").select("*").order("username"),
    supabase.from("utilisasi_master_users").select("user_login, aor, sub_aor"),
  ])
  if(snap.error) throw snap.error

  // Enrich fl_users with correct AOR from master
  const masterAOR = new Map<string,{aor:string;sub_aor:string}>()
  for (const m of master.data ?? []) {
    masterAOR.set(m.user_login.toUpperCase(), { aor: m.aor ?? "", sub_aor: m.sub_aor ?? "" })
  }
  const enrichedUsers = (users.data ?? []).map(u => {
    const m = masterAOR.get((u.user_id ?? "").toUpperCase())
    return {
      ...u,
      aor:     (m?.aor     && m.aor     !== "") ? m.aor     : (u.aor     ?? ""),
      sub_aor: (m?.sub_aor && m.sub_aor !== "") ? m.sub_aor : (u.sub_aor ?? ""),
    }
  // Exclude ADS/SS — tidak masuk denominator Ficom Lite
  }).filter(u => u.role !== "SS" && u.role !== "ADS")

  return {
    snapshots: (snap.data||[]) as FLSnapshot[],
    areas:     (areas.data||[]) as FLArea[],
    users:     enrichedUsers as FLUser[],
  }
}

function RoleBreakdown({ snap }:{ snap:FLSnapshot }) {
  const roles = [
    { label:"ADM",  total:snap.total_adm, active:snap.active_adm, pct:snap.pct_adm,  col:"#F97316" },
    { label:"RDM",  total:snap.total_rdm, active:snap.active_rdm, pct:snap.pct_rdm,  col:"#A855F7" },
    { label:"ADS/SS",total:snap.total_ss,  active:snap.active_ss,  pct:snap.pct_ss,   col:"#06B6D4" },
  ]
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"10px",minWidth:"180px"}}>
      {roles.map((r,i)=>(
        <div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:"12px",padding:"10px 14px",border:`1px solid ${r.col}20`}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"7px"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:r.col,boxShadow:`0 0 6px ${r.col}80`}}/>
              <span style={{fontSize:"11px",fontWeight:700,color:"white"}}>{r.label}</span>
            </div>
            <span style={{fontSize:"13px",fontWeight:900,color:utilColor(r.pct),fontFamily:"'Bricolage Grotesque',sans-serif"}}>{r.pct.toFixed(0)}%</span>
          </div>
          <div style={{height:"4px",background:"rgba(255,255,255,0.06)",borderRadius:"99px",overflow:"hidden",marginBottom:"5px"}}>
            <div style={{height:"100%",width:`${Math.min(r.pct,100)}%`,background:r.col,borderRadius:"99px",boxShadow:`0 0 6px ${r.col}40`}}/>
          </div>
          <div style={{fontSize:"9px",color:"rgba(255,255,255,0.35)"}}>{r.active}/{r.total} users aktif</div>
        </div>
      ))}
    </div>
  )
}

// ── User Detail Popup ─────────────────────────────────────────
function UserDetailPopup({ user, onClose }:{ user:FLUser; onClose:()=>void }) {
  const col = AOR_COLORS[user.aor]||"#888"
  const cp  = user.compliance_pct
  const r   = 30; const circ=2*Math.PI*r; const dash=Math.min(cp,100)/100*circ
  const pages = user.pages_accessed ? user.pages_accessed.split(',') : []
  return (
    <div className="fl-popup-bd" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:10000,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(14px)"}} onClick={onClose}>
      <div className="fl-popup-inner" style={{background:"#0A1A0D",border:`1px solid ${col}40`,borderRadius:"clamp(16px,4vw,24px)",maxWidth:"480px",width:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:`0 40px 100px rgba(0,0,0,0.6)`,animation:"flPopUp 0.3s cubic-bezier(0.34,1.56,0.64,1)"}} onClick={e=>e.stopPropagation()}>
        <div style={{height:"4px",background:`linear-gradient(90deg,${FL_GREEN},${FL_TEAL},transparent)`}}/>
        <div style={{padding:"22px"}}>
          {/* Header */}
          <div style={{display:"flex",gap:"14px",alignItems:"flex-start",marginBottom:"20px"}}>
            <div style={{flexShrink:0}}>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
                <circle cx="36" cy="36" r={r} fill="none" stroke={compColor(cp)} strokeWidth="5"
                  strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" transform="rotate(-90 36 36)"
                  style={{filter:`drop-shadow(0 0 5px ${compColor(cp)}80)`}}>
                  <animate attributeName="stroke-dasharray" from={`0 ${circ}`} to={`${dash} ${circ}`} dur="1s" fill="freeze"/>
                </circle>
                <text x="36" y="33" textAnchor="middle" fontSize="11" fontWeight="900" fill="white" fontFamily="'Bricolage Grotesque',sans-serif">{cp.toFixed(0)}%</text>
                <text x="36" y="44" textAnchor="middle" fontSize="7.5" fill="rgba(255,255,255,0.4)">compliance</text>
              </svg>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"16px",fontWeight:800,color:"white",marginBottom:"6px",lineHeight:1.2}}>{user.username}</div>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                <span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",
                  background:user.role==="RDM"?"rgba(168,85,247,0.2)":user.role==="SS"?"rgba(6,182,212,0.2)":"rgba(249,115,22,0.2)",
                  color:user.role==="RDM"?"#C084FC":user.role==="SS"?"#22D3EE":"#FB923C"}}>
                  {user.role}
                </span>
                <span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",background:`${col}20`,color:col}}>{user.aor}</span>
                <span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",
                  background:user.is_active?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.12)",
                  color:user.is_active?"#4ADE80":"#F87171"}}>
                  {user.is_active?"✅ Aktif":"❌ Belum Aktif"}
                </span>
              </div>
              <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",fontFamily:"monospace",marginTop:"5px"}}>{user.user_id}</div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",cursor:"pointer",width:"28px",height:"28px",borderRadius:"50%",fontSize:"15px",color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>×</button>
          </div>
          {/* Stats grid */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px",marginBottom:"16px"}}>
            {[
              {i:"📅",l:"Active Days",   v:`${user.active_days} / ${user.selling_days} hari`,   c:compColor(cp)},
              {i:"📊",l:"Compliance",    v:`${cp.toFixed(1)}%`,                                  c:compColor(cp)},
              {i:"👤",l:"RDM",          v:user.rdm_name||"—",                                   c:"rgba(255,255,255,0.7)"},
              {i:"📍",l:"Sub-Area",     v:user.sub_aor||"—",                                    c:"rgba(255,255,255,0.6)"},
              {i:"🕐",l:"Last Access",  v:user.last_access_date||"Never",                       c:user.last_access_date?"rgba(255,255,255,0.6)":"#EF4444"},
              {i:"📱",l:"Features Used",v:`${pages.length} feature`,                            c:FL_GREEN},
            ].map((s,i)=>(
              <div key={i} style={{background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"10px 12px",border:"1px solid rgba(255,255,255,0.06)"}}>
                <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"4px"}}>{s.i} {s.l}</div>
                <div style={{fontSize:"12px",fontWeight:700,color:s.c,wordBreak:"break-word",lineHeight:1.3}}>{s.v}</div>
              </div>
            ))}
          </div>
          {/* Pages accessed */}
          {pages.length > 0 && (
            <div style={{background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"12px 14px",border:"1px solid rgba(255,255,255,0.06)",marginBottom:"12px"}}>
              <div style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"8px"}}>🖥️ Fitur yang Diakses</div>
              <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
                {pages.map((p,i)=>(
                  <span key={i} style={{fontSize:"10px",padding:"3px 10px",borderRadius:"99px",background:"rgba(34,197,94,0.12)",color:"#4ADE80",border:"1px solid rgba(34,197,94,0.2)",fontWeight:600}}>{p.trim()}</span>
                ))}
              </div>
            </div>
          )}
          {/* Compliance bar */}
          <div style={{background:"rgba(255,255,255,0.04)",borderRadius:"10px",padding:"12px 14px",border:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:"8px"}}>
              <span style={{fontSize:"10px",color:"rgba(255,255,255,0.4)",fontWeight:600}}>📈 Login Compliance</span>
              <span style={{fontSize:"12px",fontWeight:800,color:compColor(cp)}}>{cp.toFixed(1)}%</span>
            </div>
            <div style={{height:"6px",background:"rgba(255,255,255,0.06)",borderRadius:"99px",overflow:"hidden",marginBottom:"6px"}}>
              <div style={{height:"100%",width:`${Math.min(cp,100)}%`,background:compColor(cp),borderRadius:"99px"}}/>
            </div>
            <div style={{textAlign:"center"}}>
              <span style={{fontSize:"10px",fontWeight:700,padding:"3px 12px",borderRadius:"99px",
                background:cp>=80?"rgba(34,197,94,0.15)":cp>=60?"rgba(132,204,22,0.15)":cp>=40?"rgba(249,115,22,0.15)":"rgba(239,68,68,0.15)",
                color:compColor(cp),border:`1px solid ${compColor(cp)}40`}}>
                {cp>=80?"🏆 Power User":cp>=60?"✅ Regular User":cp>=40?"🟡 Occasional":"🔴 Rarely Used"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Area Popup ────────────────────────────────────────────────
function AreaPopup({ aor, areaData, areaUsers, onUserClick, onClose }:{
  aor:string; areaData:FLArea; areaUsers:FLUser[]
  onUserClick:(u:FLUser)=>void; onClose:()=>void
}) {
  const col = AOR_COLORS[aor]||"#888"
  const [roleFilter, setRoleFilter] = useState<"all"|"ADM"|"RDM"|"SS">("all")
  const [search, setSearch] = useState("")
  const [showInactive, setShowInactive] = useState(false)

  const filtered = useMemo(()=>areaUsers
    .filter(u=>{
      if(roleFilter!=="all"&&u.role!==roleFilter) return false
      if(!showInactive&&!u.is_active) return false
      return u.username.toLowerCase().includes(search.toLowerCase())||u.user_id.includes(search)
    })
    .sort((a,b)=>b.compliance_pct-a.compliance_pct)
  ,[areaUsers,roleFilter,search,showInactive])

  const inactiveCount = areaUsers.filter(u=>!u.is_active).length

  return (
    <div className="fl-popup-bd" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(12px)"}} onClick={onClose}>
      <div className="fl-popup-inner" style={{background:"#0A1A0D",border:`1px solid ${col}40`,borderRadius:"clamp(16px,4vw,24px)",maxWidth:"680px",width:"100%",maxHeight:"90vh",display:"flex",flexDirection:"column",boxShadow:"0 40px 100px rgba(0,0,0,0.6)",animation:"flPopUp 0.3s cubic-bezier(0.34,1.56,0.64,1)"}} onClick={e=>e.stopPropagation()}>
        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${col}15,transparent)`,padding:"18px 22px 14px",borderBottom:`2px solid ${col}25`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"36px",height:"36px",borderRadius:"10px",background:`linear-gradient(135deg,${col},${col}99)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:900,color:"white",boxShadow:`0 0 16px ${col}40`}}>{aor}</div>
              <div>
                <div style={{fontSize:"17px",fontWeight:800,color:"white"}}>Ficom Lite — {aor}</div>
                <div style={{fontSize:"11px",color:"rgba(255,255,255,0.4)"}}>
                  {areaData.active_users}/{areaData.total_users} aktif · {areaData.utilisation_pct.toFixed(1)}% utilisasi
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{background:"rgba(255,255,255,0.08)",border:"none",cursor:"pointer",width:"30px",height:"30px",borderRadius:"50%",fontSize:"16px",color:"rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
          </div>
          {/* Role stats */}
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
            {[
              {l:"ADM",  a:areaData.active_adm,  t:areaData.total_adm,  c:"#F97316"},
              {l:"RDM",  a:areaData.active_rdm,  t:areaData.total_rdm,  c:"#A855F7"},
              {l:"ADS",  a:areaData.active_ss,   t:areaData.total_ss,   c:"#06B6D4"},
            ].map((s,i)=>(
              <div key={i} style={{background:`${s.c}15`,borderRadius:"9px",padding:"5px 10px",border:`1px solid ${s.c}25`}}>
                <div style={{fontSize:"13px",fontWeight:900,color:s.c,lineHeight:1}}>{s.a}/{s.t}</div>
                <div style={{fontSize:"8px",color:"rgba(255,255,255,0.35)",marginTop:"1px"}}>{s.l}</div>
              </div>
            ))}
            {inactiveCount>0&&(
              <button onClick={()=>setShowInactive(v=>!v)}
                style={{marginLeft:"auto",padding:"4px 10px",borderRadius:"8px",border:`1px solid ${showInactive?"#EF4444":"rgba(255,255,255,0.12)"}`,background:showInactive?"rgba(239,68,68,0.12)":"transparent",color:showInactive?"#F87171":"rgba(255,255,255,0.4)",cursor:"pointer",fontFamily:"inherit",fontSize:"10px",fontWeight:700,transition:"all 0.15s"}}>
                {showInactive?"Hide":"Show"} {inactiveCount} belum aktif
              </button>
            )}
          </div>
          {/* Filters */}
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",alignItems:"center"}}>
            <input placeholder="🔍 Name / ID..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{padding:"5px 10px",border:`1.5px solid ${col}40`,borderRadius:"9px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(110px,30%,160px)",background:"rgba(255,255,255,0.05)",color:"white"}}/>
            <div style={{display:"flex",background:"rgba(255,255,255,0.06)",borderRadius:"9px",padding:"2px"}}>
              {(["all","ADM","RDM","SS"] as const).map(r=>(
                <button key={r} onClick={()=>setRoleFilter(r)} style={{padding:"3px 8px",borderRadius:"7px",border:"none",cursor:"pointer",fontSize:"9px",fontWeight:700,fontFamily:"inherit",background:roleFilter===r?"rgba(255,255,255,0.12)":"transparent",color:roleFilter===r?"white":"rgba(255,255,255,0.35)",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                  {r==="all"?"Semua":r==="SS"?"ADS":r}
                </button>
              ))}
            </div>
            <span style={{fontSize:"10px",color:"rgba(255,255,255,0.3)",marginLeft:"auto"}}>{filtered.length} user</span>
          </div>
        </div>
        {/* User list */}
        <div style={{overflowY:"auto",flex:1}}>
          {filtered.map((u,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 20px",borderBottom:"1px solid rgba(255,255,255,0.04)",cursor:"pointer",transition:"background 0.15s"}}
              onClick={()=>onUserClick(u)}
              onMouseEnter={e=>{e.currentTarget.style.background=`${col}0C`}}
              onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
              <div style={{width:"22px",fontSize:"11px",color:"rgba(255,255,255,0.2)",fontWeight:700,textAlign:"center",flexShrink:0}}>
                {!u.is_active?"—":i===0?"🥇":i===1?"🥈":i===2?"🥉":`${i+1}`}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"12px",fontWeight:600,color:u.is_active?"white":"rgba(255,255,255,0.35)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.username}</div>
                <div style={{fontSize:"9px",color:"rgba(255,255,255,0.25)",fontFamily:"monospace",marginTop:"1px"}}>{u.user_id} · {u.role}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0,minWidth:"60px"}}>
                {u.is_active
                  ? <><div style={{fontSize:"12px",fontWeight:800,color:compColor(u.compliance_pct)}}>{u.compliance_pct.toFixed(0)}%</div><div style={{fontSize:"9px",color:"rgba(255,255,255,0.25)"}}>{u.active_days}/{u.selling_days} hari</div></>
                  : <span style={{fontSize:"10px",color:"rgba(239,68,68,0.7)",fontWeight:600}}>Belum aktif</span>
                }
              </div>
              <div style={{width:"48px",flexShrink:0}}>
                <div style={{height:"4px",background:"rgba(255,255,255,0.06)",borderRadius:"99px",overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${Math.min(u.compliance_pct,100)}%`,background:u.is_active?compColor(u.compliance_pct):"rgba(239,68,68,0.3)",borderRadius:"99px"}}/>
                </div>
              </div>
              <span style={{fontSize:"14px",color:"rgba(255,255,255,0.15)",flexShrink:0}}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────

// ── Animated Counter ──────────────────────────────────────────
function AnimCount({ to, suffix="", dec=0, delay=0 }:{ to:number; suffix?:string; dec?:number; delay?:number }) {
  const [v, setV] = useState(0)
  useEffect(()=>{
    const t=setTimeout(()=>{
      let f=0; const frames=55
      const tick=()=>{ f++; const e=1-Math.pow(1-f/frames,4); setV(e*to); if(f<frames) requestAnimationFrame(tick) }
      requestAnimationFrame(tick)
    },delay)
    return ()=>clearTimeout(t)
  },[to,delay])
  return <>{v.toFixed(dec)}{suffix}</>
}

// ── Utilisation Ring ──────────────────────────────────────────
function UtilRing({ pct, size=160, label="utilisasi" }:{ pct:number; size?:number; label?:string }) {
  const r=size*0.38; const c=2*Math.PI*r; const dash=Math.min(pct,100)/100*c
  const col = utilColor(pct)
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{overflow:"visible"}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={size*0.09}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth={size*0.09}
        strokeDasharray={`${dash} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{filter:`drop-shadow(0 0 8px ${col}80)`,transition:"stroke-dasharray 1.4s"}}>
        <animate attributeName="stroke-dasharray" from={`0 ${c}`} to={`${dash} ${c}`} dur="1.4s" fill="freeze" calcMode="spline" keySplines="0.4 0 0.2 1"/>
      </circle>
      <text x={size/2} y={size/2-4} textAnchor="middle" fontSize={size*0.19} fontWeight="900" fill="white" fontFamily="'Bricolage Grotesque',sans-serif">{pct}%</text>
      <text x={size/2} y={size/2+size*0.14} textAnchor="middle" fontSize={size*0.09} fill="rgba(255,255,255,0.4)">{label}</text>
    </svg>
  )
}

// ── Role Breakdown Bar ────────────────────────────────────────
// ── Line Chart for Ficom Lite ─────────────────────────────────
export default function FicomLitePage() {
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState("")
  const [snapshots,   setSnapshots]   = useState<FLSnapshot[]>([])
  const [areas,       setAreas]       = useState<FLArea[]>([])
  const [users,       setUsers]       = useState<FLUser[]>([])
  const [areaPopup,   setAreaPopup]   = useState<string|null>(null)
  const [detailUser,  setDetailUser]  = useState<FLUser|null>(null)
  const [areaFilter,  setAreaFilter]  = useState("ALL")
  const [roleFilter,  setRoleFilter]  = useState<"all"|"ADM"|"RDM"|"SS">("all")
  const [search,      setSearch]      = useState("")
  const [sortCol,     setSortCol]     = useState<"username"|"compliance_pct"|"active_days">("compliance_pct")
  const [sortDir,     setSortDir]     = useState<1|-1>(-1)
  const [showInactive,setShowInactive]= useState(true)
  const [heroMounted, setHeroMounted] = useState(false)
  const animeRef = useRef(false)

  useEffect(()=>{
    fetchFLData().then(d=>{
      setSnapshots(d.snapshots); setAreas(d.areas); setUsers(d.users)
    }).catch(e=>setError(e.message)).finally(()=>setLoading(false))
    const ch=supabase.channel("fl-live")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"fl_snapshots"},async()=>{
        fetchFLData().then(d=>{ setSnapshots(d.snapshots); setAreas(d.areas); setUsers(d.users) })
      }).subscribe()
    return ()=>{ supabase.removeChannel(ch) }
  },[])

  useEffect(()=>{
    if(loading||animeRef.current) return; animeRef.current=true
    const s=document.createElement("script"); s.src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.1/anime.min.js"
    s.onload=()=>{
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anime=(window as any).anime; if(!anime) return
      anime({targets:".fl-kpi",translateY:[24,0],opacity:[0,1],delay:anime.stagger(70),duration:650,easing:"easeOutExpo"})
      anime({targets:".fl-area-card",translateY:[20,0],opacity:[0,1],delay:anime.stagger(80),duration:600,easing:"easeOutBack"})
      anime({targets:".live-dot",scale:[1,1.6,1],loop:true,duration:1200,easing:"easeInOutSine"})
      anime({targets:".fl-logo",rotate:[-2,2,-2],loop:true,duration:3500,easing:"easeInOutSine"})
    }
    document.head.appendChild(s)
    const link=document.createElement("link"); link.rel="stylesheet"
    link.href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
    document.head.appendChild(link)
    setTimeout(()=>setHeroMounted(true),100)
  },[loading])

  const latest    = snapshots[snapshots.length-1]
  const latestPM  = latest?.period_month||""

  // Period selector — default to April if available, else latest
  const DEFAULT_PERIOD = "2026-04"
  const [selPeriod, setSelPeriod] = useState("")
  useEffect(()=>{
    if(!snapshots.length) return
    // Filter bulan dengan selling_days >= 3 (skip cut-off months)
    const validSnaps = snapshots.filter(s => s.selling_days >= 3)
    const months = validSnaps.map(s=>s.period_month)
    // Default: April jika ada, jika tidak ambil bulan valid terbaru
    const def = months.includes(DEFAULT_PERIOD)
      ? DEFAULT_PERIOD
      : months.sort().reverse()[0] ?? snapshots[snapshots.length-1].period_month
    setSelPeriod(def)
  },[snapshots])

  // selSnap: gunakan periode terpilih, JANGAN fallback ke latest jika selling_days < 3
  const selSnap = snapshots.find(s=>s.period_month===selPeriod)
    ?? snapshots.filter(s=>s.selling_days>=3).sort((a,b)=>b.period_month.localeCompare(a.period_month))[0]
    ?? latest
  const selPM    = selSnap?.period_month ?? latestPM

  const latestAreas = useMemo(()=>areas.filter(a=>a.period_month===selPM),[areas,selPM])
  const latestUsers = useMemo(()=>users.filter(u=>u.period_month===selPM),[users,selPM])

  const filteredUsers = useMemo(()=>latestUsers
    .filter(u=>{
      if(areaFilter!=="ALL"&&u.aor!==areaFilter) return false
      if(roleFilter!=="all"&&u.role!==roleFilter) return false
      if(!showInactive&&!u.is_active) return false
      const q=search.toLowerCase()
      return u.username.toLowerCase().includes(q)||u.user_id.includes(q)
    })
    .sort((a,b)=>{
      if(sortCol==="username") return sortDir*a.username.localeCompare(b.username)
      return sortDir*((a[sortCol]as number)-(b[sortCol]as number))
    })
  ,[latestUsers,areaFilter,roleFilter,search,showInactive,sortCol,sortDir])

  const popupArea  = useMemo(()=>latestAreas.find(a=>a.aor===areaPopup),[latestAreas,areaPopup])
  const popupUsers = useMemo(()=>areaPopup?latestUsers.filter(u=>u.aor===areaPopup):[],[latestUsers,areaPopup])
  const sortToggle = (col:typeof sortCol)=>{ if(sortCol===col) setSortDir(d=>d===1?-1:1); else{setSortCol(col);setSortDir(-1)} }

  if(loading) return (
    <div style={{background:"#030D06",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <LandingNav/>
      <div style={{textAlign:"center",color:"white"}}>
        <div style={{width:"52px",height:"52px",margin:"0 auto 16px",borderRadius:"50%",border:"3px solid rgba(34,197,94,0.15)",borderTopColor:"#22C55E",animation:"spin 0.9s linear infinite"}}/>
        <div style={{fontSize:"13px",color:"rgba(255,255,255,0.4)"}}>Loading Ficom Lite...</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const aktivePct = selSnap?.utilisation_pct ? Math.round(selSnap.utilisation_pct) : 0

  return (
    <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",color:"#111",background:"#030D06",minHeight:"100vh"}}>
      <LandingNav/>

      {/* Tab Bar */}
      <div style={{position:"sticky",top:"64px",zIndex:90,background:"rgba(3,13,6,0.97)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"0 clamp(12px,4vw,80px)"}}>
        <div style={{maxWidth:"1200px",margin:"0 auto",display:"flex",overflowX:"auto"}}>
          {[
            {id:"sfa",  href:"/landing/utilisation", active:false, label:"SFA"},
            {id:"ficom",href:"/landing/ficom",        active:false, label:"Ficom"},
            {id:"lite", href:"#",                     active:true,  label:"Ficom Lite"},
          ].map(tab=>(
            <a key={tab.id} href={tab.href}
              style={{padding:"12px 18px",border:"none",fontFamily:"inherit",fontSize:"13px",fontWeight:tab.active?700:500,color:tab.active?FL_GREEN:"rgba(255,255,255,0.4)",background:"transparent",borderBottom:tab.active?`2px solid ${FL_GREEN}`:"2px solid transparent",transition:"all 0.2s",display:"flex",alignItems:"center",gap:"7px",whiteSpace:"nowrap",textDecoration:"none",cursor:"pointer"}}>
              {tab.id==="lite"&&<img src={LITE_LOGO} alt="Ficom Lite" style={{height:"20px",width:"20px",objectFit:"cover",borderRadius:"5px"}}/>}
              {tab.label}
            </a>
          ))}
        </div>
      </div>

      {/* ══ HERO ══ */}
      <div style={{position:"relative",overflow:"hidden",display:"flex",alignItems:"flex-start",padding:"clamp(60px,9vw,100px) clamp(16px,4vw,80px) clamp(36px,5vw,70px)"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(145deg,#020A04 0%,#041408 40%,#020A08 100%)"}}/>
        <div style={{position:"absolute",inset:0,backgroundImage:`linear-gradient(rgba(34,197,94,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(34,197,94,0.04) 1px,transparent 1px)`,backgroundSize:"40px 40px",animation:"flGrid 18s linear infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:"-15%",right:"-8%",width:"clamp(200px,40vw,560px)",height:"clamp(200px,40vw,560px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(34,197,94,0.2),rgba(16,185,129,0.05) 50%,transparent 70%)",filter:"blur(70px)",animation:"flOrb1 9s ease-in-out infinite",pointerEvents:"none"}}/>
        <div style={{position:"absolute",bottom:"-10%",left:"-5%",width:"clamp(180px,30vw,420px)",height:"clamp(180px,30vw,420px)",borderRadius:"50%",background:"radial-gradient(circle,rgba(6,182,212,0.12),transparent 65%)",filter:"blur(60px)",animation:"flOrb2 11s ease-in-out infinite",pointerEvents:"none"}}/>
        {heroMounted&&Array.from({length:14},(_,i)=>(
          <div key={i} style={{position:"absolute",left:`${6+i*7}%`,top:`${15+Math.sin(i*0.8)*35}%`,width:`${2+i%3}px`,height:`${2+i%3}px`,borderRadius:"50%",background:["#22C55E","#10B981","#06B6D4","#34D399","#6EE7B7"][i%5],opacity:0,animation:`flParticle ${2.5+i*0.2}s ease-in-out ${i*0.18}s infinite`,pointerEvents:"none"}}/>
        ))}

        <div style={{maxWidth:"1200px",margin:"0 auto",width:"100%",position:"relative",zIndex:2}}>
          <div className="fl-hero-layout" style={{display:"flex",gap:"clamp(24px,4vw,64px)",alignItems:"center",flexWrap:"wrap"}}>
            {/* LEFT */}
            <div style={{flex:1,minWidth:"min(100%,300px)"}}>
              <div style={{display:"inline-flex",alignItems:"center",gap:"10px",background:"rgba(34,197,94,0.1)",border:"1px solid rgba(34,197,94,0.3)",borderRadius:"99px",padding:"6px 18px",marginBottom:"clamp(16px,3vw,26px)",backdropFilter:"blur(8px)"}}>
                <div className="live-dot" style={{width:"8px",height:"8px",borderRadius:"50%",background:FL_GREEN,boxShadow:`0 0 10px ${FL_GREEN}`}}/>
                <span style={{fontSize:"clamp(9px,2.5vw,11px)",fontWeight:700,color:"#4ADE80",letterSpacing:"0.08em",textTransform:"uppercase"}}>
                  Live · Ficom Lite PHI · {selSnap?.period_label||"—"} · as of {selSnap?.as_of_date||"—"}
                </span>
              </div>

              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"clamp(10px,2vw,16px)"}}>
                <h1 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(28px,7vw,62px)",fontWeight:900,lineHeight:1.04,letterSpacing:"-0.03em",color:"white",margin:0}}>
                  Ficom Lite<br/>
                  <span style={{background:"linear-gradient(135deg,#22C55E 0%,#10B981 40%,#06B6D4 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",filter:"drop-shadow(0 0 24px rgba(34,197,94,0.4))"}}>
                    Utilisation
                  </span>
                </h1>
                <div className="fl-logo" style={{flexShrink:0,marginTop:"4px"}}>
                  <div style={{width:"clamp(56px,9vw,76px)",height:"clamp(56px,9vw,76px)",borderRadius:"18px",overflow:"hidden",boxShadow:"0 0 40px rgba(34,197,94,0.4),0 0 80px rgba(34,197,94,0.15)",border:"2px solid rgba(34,197,94,0.3)"}}>
                    <img src={LITE_LOGO} alt="Ficom Lite" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  </div>
                </div>
              </div>

              <p style={{fontSize:"clamp(11px,3vw,14px)",color:"rgba(255,255,255,0.35)",marginBottom:"clamp(18px,4vw,36px)",lineHeight:1.7}}>
                <strong style={{color:"rgba(255,255,255,0.6)"}}>{selSnap?.active_users||"—"}</strong> dari{" "}
                <strong style={{color:"rgba(255,255,255,0.6)"}}>{selSnap?.total_users||"—"}</strong> user (ADM+RDM) sudah menggunakan Ficom Lite ·{" "}
                <strong style={{color:"rgba(255,255,255,0.6)"}}>{selSnap?.selling_days||"—"}</strong> selling days
              </p>

              {/* KPI 3×2 */}
              <div className="fl-kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"clamp(6px,1.5vw,10px)",width:"100%",maxWidth:"520px"}}>
                {[
                  {n:<AnimCount to={aktivePct} suffix="%" delay={0}/>,         l:"Utilisasi",   i:"📊",c:utilColor(aktivePct), bg:`rgba(34,197,94,0.1)`,bo:`rgba(34,197,94,0.25)`},
                  {n:<AnimCount to={selSnap?.active_users||0} delay={80}/>,      l:"Aktif Login", i:"✅",c:"white",             bg:"rgba(255,255,255,0.05)",bo:"rgba(255,255,255,0.1)"},
                  {n:<AnimCount to={selSnap?.total_users||0} delay={160}/>,      l:"Total User",  i:"👥",c:"rgba(255,255,255,0.4)",bg:"rgba(255,255,255,0.03)",bo:"rgba(255,255,255,0.07)"},
                  {n:<AnimCount to={selSnap?.pct_adm||0} suffix="%" dec={0} delay={240}/>,l:"ADM Util.",i:"🏢",c:"#FB923C",bg:"rgba(249,115,22,0.1)",bo:"rgba(249,115,22,0.2)"},
                  {n:<AnimCount to={selSnap?.pct_rdm||0} suffix="%" dec={0} delay={320}/>,l:"RDM Util.",i:"👔",c:"#C084FC",bg:"rgba(168,85,247,0.1)",bo:"rgba(168,85,247,0.2)"},
                  {n:<AnimCount to={selSnap?.pct_ss||0} suffix="%" dec={0} delay={400}/>, l:"ADS Util.",i:"🧑",c:"#22D3EE",bg:"rgba(6,182,212,0.1)", bo:"rgba(6,182,212,0.2)"},
                ].map((s,i)=>(
                  <div key={i} className="fl-kpi" style={{background:s.bg,borderRadius:"clamp(10px,1.5vw,13px)",padding:"clamp(8px,2.5vw,14px)",border:`1px solid ${s.bo}`,textAlign:"center",backdropFilter:"blur(12px)",position:"relative",overflow:"hidden",animation:"flFadeUp 0.6s ease both",animationDelay:`${i*0.08}s`}}>
                    <div style={{position:"absolute",top:0,left:0,right:0,height:"1px",background:`linear-gradient(90deg,transparent,${s.bo},transparent)`}}/>
                    <div style={{fontSize:"clamp(14px,2.5vw,20px)",marginBottom:"4px"}}>{s.i}</div>
                    <div style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,4vw,19px)",fontWeight:900,color:s.c,lineHeight:1,marginBottom:"4px"}}>{s.n}</div>
                    <div style={{fontSize:"clamp(8px,1.8vw,9px)",color:"rgba(255,255,255,0.3)",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.03em"}}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT */}
            <div className="fl-hero-right" style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:"16px",minWidth:"200px"}}>
              <UtilRing pct={aktivePct} size={170}/>
              {selSnap && <RoleBreakdown snap={selSnap}/>}
            </div>
          </div>
        </div>
      </div>
      {/* ══ TREN UTILISASI ══ */}
      {snapshots.length > 0 && (
        <div style={{padding:"clamp(28px,5vw,56px) clamp(16px,5vw,80px)",background:"#060C1A",borderTop:"1px solid rgba(255,255,255,0.06)"}}>
          <div style={{maxWidth:"1200px",margin:"0 auto"}}>

            {/* Header + period selector */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12,marginBottom:24}}>
              <div>
                <div style={{fontSize:"clamp(18px,3vw,26px)",fontWeight:900,color:"white",fontFamily:"'Bricolage Grotesque',sans-serif",letterSpacing:"-0.02em",marginBottom:4}}>
                  📈 Tren Utilisasi
                </div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.35)"}}>
                  Ficom Lite · {snapshots.length} periode tersedia · berbasis login (access log)
                </div>
              </div>
              {/* Period selector */}
              <select value={selPeriod} onChange={e=>setSelPeriod(e.target.value)}
                style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:10,padding:"8px 14px",color:"white",fontSize:13,fontWeight:700,outline:"none",cursor:"pointer"}}>
                {[...snapshots].filter(s=>s.selling_days>=3).reverse().map(s=>(
                  <option key={s.period_month} value={s.period_month} style={{background:"#0F172A"}}>
                    {s.period_label}
                  </option>
                ))}
              </select>
            </div>

            {/* Trend line chart — utilisasi % per bulan */}
            {snapshots.length >= 2 && (
              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:16,padding:"20px 24px",marginBottom:16}}>
                <div style={{fontSize:13,fontWeight:700,color:"rgba(255,255,255,0.5)",marginBottom:16}}>Utilisasi % per Bulan</div>
                <svg viewBox="0 0 700 160" style={{width:"100%",height:160,display:"block"}}>
                  <defs>
                    <linearGradient id="fl-trend-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22C55E" stopOpacity="0.3"/>
                      <stop offset="100%" stopColor="#22C55E" stopOpacity="0.02"/>
                    </linearGradient>
                  </defs>
                  {(() => {
                    const W=700,H=160,PAD={t:20,r:20,b:36,l:44}
                    const sorted = [...snapshots].filter(s=>s.selling_days>=3).sort((a,b)=>a.period_month.localeCompare(b.period_month))
                    const vals = sorted.map(s=>s.utilisation_pct)
                    const maxV = Math.max(...vals,1)
                    const pts = sorted.map((s,i)=>({
                      x: PAD.l+(i/(sorted.length-1||1))*(W-PAD.l-PAD.r),
                      y: PAD.t+(1-s.utilisation_pct/(maxV||1))*(H-PAD.t-PAD.b),
                      s,
                    }))
                    const polyline = pts.map(p=>`${p.x},${p.y}`).join(" ")
                    const area = `M${pts[0].x},${H-PAD.b} `+pts.map(p=>`L${p.x},${p.y}`).join(" ")+` L${pts[pts.length-1].x},${H-PAD.b} Z`
                    return <>
                      {[0,25,50,75,100].map(t=>{
                        const y=PAD.t+(1-t/(maxV||1))*(H-PAD.t-PAD.b)
                        return <g key={t}>
                          <line x1={PAD.l} y1={y} x2={W-PAD.r} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1}/>
                          <text x={PAD.l-6} y={y+4} textAnchor="end" fontSize={9} fill="rgba(255,255,255,0.3)">{t}%</text>
                        </g>
                      })}
                      <path d={area} fill="url(#fl-trend-grad)"/>
                      <polyline points={polyline} fill="none" stroke="#22C55E" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round"/>
                      {pts.map((p,i)=>{
                        const isSelected = p.s.period_month === selPeriod
                        return <g key={i} onClick={()=>setSelPeriod(p.s.period_month)} style={{cursor:"pointer"}}>
                          <circle cx={p.x} cy={p.y} r={isSelected?8:5} fill={isSelected?"#22C55E":"#22C55E"} stroke={isSelected?"white":"rgba(6,12,26,0.9)"} strokeWidth={isSelected?2.5:2}/>
                          <text x={p.x} y={H-PAD.b+14} textAnchor="middle" fontSize={9} fill={isSelected?"white":"rgba(255,255,255,0.4)"} fontWeight={isSelected?"700":"400"}>
                            {p.s.period_month.slice(5).replace("0","")+"/"+p.s.period_month.slice(2,4)}
                          </text>
                          <text x={p.x} y={p.y-11} textAnchor="middle" fontSize={10} fontWeight="800" fill={isSelected?"white":"#22C55E"}>
                            {p.s.utilisation_pct.toFixed(1)}%
                          </text>
                        </g>
                      })}
                    </>
                  })()}
                </svg>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.2)",marginTop:4}}>💡 Klik titik untuk ganti periode yang ditampilkan</div>
              </div>
            )}

            {/* Per-role trend bars */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
              {(["ADM","RDM","ADS"] as const).map(role=>{
                const roleKey = role==="ADS" ? "ss" : role.toLowerCase()
                const color = role==="ADM"?"#F97316":role==="RDM"?"#A855F7":"#06B6D4"
                const sorted = [...snapshots].filter(s=>s.selling_days>=3).sort((a,b)=>a.period_month.localeCompare(b.period_month))
                return (
                  <div key={role} style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${color}20`,borderRadius:14,padding:"14px 18px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <span style={{fontSize:12,fontWeight:800,color,textTransform:"uppercase",letterSpacing:"0.06em"}}>{role}</span>
                      <span style={{fontSize:16,fontWeight:900,color,fontFamily:"'Bricolage Grotesque',sans-serif"}}>
                        {(selSnap as any)?.[`pct_${roleKey}`]?.toFixed(1) ?? 0}%
                      </span>
                    </div>
                    {/* Mini bar chart per month */}
                    <div style={{display:"flex",gap:4,alignItems:"flex-end",height:40}}>
                      {sorted.map((s,i)=>{
                        const pct = (s as any)[`pct_${roleKey}`] ?? 0
                        const isSelected = s.period_month === selPeriod
                        return (
                          <div key={i} onClick={()=>setSelPeriod(s.period_month)}
                            style={{flex:1,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                            <div style={{width:"100%",height:`${Math.max(pct/100*36,2)}px`,background:isSelected?color:`${color}50`,borderRadius:"3px 3px 0 0",transition:"all 0.3s"}}/>
                            <div style={{fontSize:8,color:isSelected?"white":"rgba(255,255,255,0.3)",fontWeight:isSelected?700:400}}>
                              {s.period_month.slice(5)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div style={{marginTop:8,fontSize:10,color:"rgba(255,255,255,0.3)"}}>
                      {(selSnap as any)?.[`active_${roleKey}`] ?? 0}/{(selSnap as any)?.[`total_${roleKey}`] ?? 0} aktif bulan ini
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── WHITE CONTENT ── */}
      <div style={{background:"#F0FDF4",borderRadius:"28px 28px 0 0",marginTop:"-6px"}}>
        <div style={{maxWidth:"1200px",margin:"0 auto",padding:"clamp(16px,3vw,36px) clamp(12px,4vw,80px)"}}>

          {/* Glossary */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(12px,1.5vw,18px)",marginBottom:"clamp(12px,2vw,20px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{fontWeight:700,fontSize:"12px",color:"#333",marginBottom:"10px"}}>📖 Definisi Utilisasi Ficom Lite</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,160px),1fr))",gap:"8px"}}>
              {[
                {term:"Utilisasi",       def:"% user (ADM+RDM) yang pernah login ke Ficom Lite minimal 1x dalam periode",       c:FL_GREEN},
                {term:"Compliance %",    def:"Jumlah hari unik login ÷ selling days × 100 (seberapa sering pakai)",                   c:"#10B981"},
                {term:"ADM",             def:"Area Distribution Manager — target pengguna utama Ficom Lite",                           c:"#F97316"},
                {term:"RDM",             def:"Regional Distribution Manager — monitor via Ficom Lite",                                 c:"#A855F7"},
                {term:"ADS (SS)",        def:"Area Distributor Supervisor — juga bisa akses Ficom Lite dashboard",                    c:"#06B6D4"},
              ].map((g,i)=>(
                <div key={i} style={{padding:"8px 12px",background:"#F0FDF4",borderRadius:"10px",borderLeft:`3px solid ${g.c}`}}>
                  <div style={{fontSize:"10px",fontWeight:700,color:g.c,marginBottom:"3px"}}>{g.term}</div>
                  <div style={{fontSize:"10px",color:"#555",lineHeight:1.5}}>{g.def}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(10px,1.5vw,14px)",marginBottom:"clamp(12px,2vw,20px)",display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <span style={{fontWeight:700,fontSize:"12px",color:"#333",flexShrink:0}}>🗺️ Area:</span>
            <div style={{display:"flex",gap:"5px",flexWrap:"wrap"}}>
              {["ALL",...AOR_NAMES].map(a=>{
                const col=AOR_COLORS[a]||FL_GREEN; const active=areaFilter===a
                return(<button key={a} onClick={()=>setAreaFilter(a)} style={{padding:"5px 13px",borderRadius:"10px",border:`1.5px solid ${active?col:"#E5E7EB"}`,background:active?`${col}15`:"transparent",color:active?col:"#555",cursor:"pointer",fontFamily:"inherit",fontSize:"11px",fontWeight:700,transition:"all 0.18s"}}>{a}</button>)
              })}
            </div>
          </div>

          {/* Area Cards */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,22px)",marginBottom:"clamp(12px,2vw,20px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:800,marginBottom:"4px",color:"#111"}}>🗺️ Utilisasi per Area</h2>
            <p style={{fontSize:"10px",color:"#bbb",marginBottom:"14px"}}>Click area → lihat breakdown ADM/RDM/ADS yang sudah & belum aktif</p>
            <div className="fl-area-grid" style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,170px),1fr))",gap:"clamp(8px,1.2vw,12px)"}}>
              {latestAreas.filter(a=>areaFilter==="ALL"||a.aor===areaFilter).map((a,i)=>{
                const col=AOR_COLORS[a.aor]||"#888"
                return (
                  <div key={i} className="fl-area-card"
                    style={{borderRadius:"16px",padding:"clamp(12px,1.8vw,18px)",border:`2px solid ${col}20`,background:"white",cursor:"pointer",boxShadow:"0 2px 8px rgba(0,0,0,0.04)",animation:"flFadeUp 0.5s ease both",animationDelay:`${i*0.1}s`,position:"relative",overflow:"hidden",transition:"border-color 0.25s,transform 0.25s,box-shadow 0.25s"}}
                    onClick={()=>setAreaPopup(a.aor)}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=col;e.currentTarget.style.transform="translateY(-5px)";e.currentTarget.style.boxShadow=`0 14px 32px ${col}22`}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=`${col}20`;e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 2px 8px rgba(0,0,0,0.04)"}}>
                    <div style={{position:"absolute",top:"-25%",right:"-10%",width:"70px",height:"70px",borderRadius:"50%",background:`${col}12`,filter:"blur(18px)",pointerEvents:"none"}}/>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"8px"}}>
                      <div>
                        <span style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(17px,2vw,21px)",fontWeight:900,color:col}}>{a.aor}</span>
                        <div style={{fontSize:"9px",color:"#aaa",marginTop:"1px"}}>{a.total_users} total user</div>
                      </div>
                      <div style={{textAlign:"right"}}>
                        <div style={{fontSize:"clamp(17px,2vw,21px)",fontWeight:900,color:utilColor(a.utilisation_pct),fontFamily:"'Bricolage Grotesque',sans-serif"}}>{a.utilisation_pct.toFixed(0)}%</div>
                        <div style={{fontSize:"9px",color:"#aaa"}}>{a.active_users} aktif</div>
                      </div>
                    </div>
                    <div style={{height:"5px",background:`${col}12`,borderRadius:"99px",marginBottom:"10px",overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${a.utilisation_pct}%`,background:`linear-gradient(90deg,${col},${col}88)`,borderRadius:"99px"}}/>
                    </div>
                    {/* ADM / RDM / ADS breakdown */}
                    <div style={{display:"flex",gap:"4px",marginBottom:"8px"}}>
                      {[
                        {l:"ADM",a:a.active_adm,t:a.total_adm,c:"#F97316"},
                        {l:"RDM",a:a.active_rdm,t:a.total_rdm,c:"#A855F7"},
                        {l:"ADS",a:a.active_ss, t:a.total_ss, c:"#06B6D4"},
                      ].map((b,bi)=>(
                        <div key={bi} style={{flex:1,background:`${b.c}10`,borderRadius:"7px",padding:"4px 0",textAlign:"center"}}>
                          <div style={{fontSize:"11px",fontWeight:800,color:b.c}}>{b.a}/{b.t}</div>
                          <div style={{fontSize:"8px",color:"#aaa"}}>{b.l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:"9px",fontWeight:700,color:col,textAlign:"center",opacity:0.8}}>Tap → lihat user detail →</div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* User Table */}
          <div style={{background:"white",borderRadius:"16px",border:"1px solid rgba(0,0,0,0.07)",padding:"clamp(14px,2vw,22px)",boxShadow:"0 2px 10px rgba(0,0,0,0.04)"}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:"10px",marginBottom:"14px"}}>
              <div>
                <h2 style={{fontFamily:"'Bricolage Grotesque',sans-serif",fontSize:"clamp(14px,1.8vw,18px)",fontWeight:800,color:"#111"}}>
                  👤 User Detail <span style={{fontSize:"12px",fontWeight:400,color:"#bbb"}}>({filteredUsers.length}/{latestUsers.length})</span>
                </h2>
                <p style={{fontSize:"10px",color:"#bbb",marginTop:"3px"}}>Click header → sort · Click row → detail · {selSnap?.period_label}</p>
              </div>
              <div style={{display:"flex",gap:"7px",flexWrap:"wrap",alignItems:"center"}}>
                <input placeholder="🔍 Name / ID..." value={search} onChange={e=>setSearch(e.target.value)}
                  style={{padding:"7px 12px",border:"1.5px solid #E5E7EB",borderRadius:"10px",fontSize:"12px",fontFamily:"inherit",outline:"none",width:"clamp(120px,22vw,180px)",background:"#F0FDF4"}}
                  onFocus={e=>{e.currentTarget.style.borderColor=FL_GREEN}} onBlur={e=>{e.currentTarget.style.borderColor="#E5E7EB"}}/>
                <div style={{display:"flex",background:"#F4F4F2",borderRadius:"10px",padding:"3px"}}>
                  {(["all","ADM","RDM","SS"] as const).map(r=>(
                    <button key={r} onClick={()=>setRoleFilter(r)} style={{padding:"4px 8px",borderRadius:"8px",border:"none",cursor:"pointer",fontSize:"9px",fontWeight:700,fontFamily:"inherit",background:roleFilter===r?"white":"transparent",color:roleFilter===r?"#111":"#888",boxShadow:roleFilter===r?"0 1px 4px rgba(0,0,0,0.1)":"none",transition:"all 0.15s",whiteSpace:"nowrap"}}>
                      {r==="all"?"Semua":r==="SS"?"ADS":r}
                    </button>
                  ))}
                </div>
                <button onClick={()=>setShowInactive(v=>!v)}
                  style={{padding:"5px 10px",borderRadius:"9px",border:`1.5px solid ${showInactive?"#E5E7EB":"#EF4444"}`,background:showInactive?"transparent":"rgba(239,68,68,0.08)",color:showInactive?"#888":"#EF4444",cursor:"pointer",fontFamily:"inherit",fontSize:"10px",fontWeight:700,transition:"all 0.15s",whiteSpace:"nowrap"}}>
                  {showInactive?"Sembunyikan":"Tampilkan"} Belum Aktif
                </button>
              </div>
            </div>
            <div style={{overflowX:"auto",WebkitOverflowScrolling:"touch" as React.CSSProperties["WebkitOverflowScrolling"]}}>
              <table style={{width:"100%",borderCollapse:"collapse",minWidth:"560px"}}>
                <thead>
                  <tr style={{borderBottom:"2px solid #F0FDF4"}}>
                    {[
                      {l:"User ID",    c:null},
                      {l:"Nama",       c:"username"as const},
                      {l:"Role",       c:null},
                      {l:"Area",       c:null},
                      {l:"RDM",        c:null},
                      {l:"Hari Aktif", c:"active_days"as const},
                      {l:"Compliance", c:"compliance_pct"as const},
                      {l:"Status",     c:null},
                      {l:"Last Login", c:null},
                    ].map((h,i)=>(
                      <th key={i} onClick={()=>h.c&&sortToggle(h.c)}
                        style={{padding:"8px 10px",textAlign:"left",fontSize:"9px",fontWeight:700,color:"#aaa",textTransform:"uppercase",letterSpacing:"0.06em",cursor:h.c?"pointer":"default",userSelect:"none",whiteSpace:"nowrap"}}>
                        {h.l}{h.c&&<span style={{marginLeft:"3px",opacity:sortCol===h.c?1:0.25}}>{sortDir===1?"↑":"↓"}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u,i)=>{
                    const col=AOR_COLORS[u.aor]||"#888"
                    return(
                      <tr key={i} style={{borderBottom:"1px solid #F0FDF4",cursor:"pointer",transition:"background 0.12s",opacity:u.is_active?1:0.6}}
                        onClick={()=>setDetailUser(u)}
                        onMouseEnter={e=>{e.currentTarget.style.background="#F0FDF4"}}
                        onMouseLeave={e=>{e.currentTarget.style.background="transparent"}}>
                        <td style={{padding:"9px 10px",fontSize:"11px",color:"#aaa",fontFamily:"monospace"}}>{u.user_id}</td>
                        <td style={{padding:"9px 10px",fontSize:"12px",fontWeight:600,color:"#111",maxWidth:"170px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.username}</td>
                        <td style={{padding:"9px 10px"}}>
                          <span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",
                            background:u.role==="RDM"?"#EEF7FF":u.role==="SS"?"#ECFEFF":"#FFF7ED",
                            color:u.role==="RDM"?"#1E88E5":u.role==="SS"?"#0891B2":"#EA580C"}}>
                            {u.role==="SS"?"ADS":u.role}
                          </span>
                        </td>
                        <td style={{padding:"9px 10px"}}>
                          <span style={{background:`${col}15`,color:col,fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px"}}>{u.aor}</span>
                        </td>
                        <td style={{padding:"9px 10px",fontSize:"11px",color:"#555",maxWidth:"140px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.rdm_name}</td>
                        <td style={{padding:"9px 10px",fontSize:"12px",fontWeight:700,color:"#111",textAlign:"center"}}>
                          {u.is_active?<>{u.active_days}<span style={{fontSize:"9px",color:"#aaa",fontWeight:400}}>/{u.selling_days}</span></>:"—"}
                        </td>
                        <td style={{padding:"9px 10px"}}>
                          {u.is_active?(
                            <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                              <div style={{width:"44px",height:"5px",background:"#F0F0F0",borderRadius:"99px",overflow:"hidden",flexShrink:0}}>
                                <div style={{height:"100%",width:`${Math.min(u.compliance_pct,100)}%`,background:compColor(u.compliance_pct),borderRadius:"99px"}}/>
                              </div>
                              <span style={{fontSize:"11px",fontWeight:800,color:compColor(u.compliance_pct),minWidth:"34px"}}>{u.compliance_pct.toFixed(0)}%</span>
                            </div>
                          ):<span style={{fontSize:"10px",color:"#bbb"}}>—</span>}
                        </td>
                        <td style={{padding:"9px 10px"}}>
                          <span style={{fontSize:"10px",fontWeight:700,padding:"2px 8px",borderRadius:"99px",
                            background:u.is_active?"#DCFCE7":"#FEF2F2",color:u.is_active?"#16A34A":"#DC2626"}}>
                            {u.is_active?"✅ Aktif":"❌ Belum"}
                          </span>
                        </td>
                        <td style={{padding:"9px 10px",fontSize:"11px",color:"#aaa",fontFamily:"monospace",whiteSpace:"nowrap"}}>{u.last_access_date||"—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {filteredUsers.length===0&&<div style={{textAlign:"center",padding:"48px",color:"#bbb"}}><div style={{fontSize:"28px",marginBottom:"10px"}}>🔍</div>No users found.</div>}
            </div>
          </div>
        </div>
      </div>

      {areaPopup&&popupArea&&(
        <AreaPopup aor={areaPopup} areaData={popupArea} areaUsers={popupUsers}
          onUserClick={u=>{setAreaPopup(null);setDetailUser(u)}} onClose={()=>setAreaPopup(null)}/>
      )}
      {detailUser&&<UserDetailPopup user={detailUser} onClose={()=>setDetailUser(null)}/>}

      <style dangerouslySetInnerHTML={{__html:`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes spin       { to{transform:rotate(360deg)} }
        @keyframes flFadeUp   { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes flPopUp    { from{opacity:0;transform:scale(0.88) translateY(20px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes flOrb1     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-25px,18px) scale(1.06)} }
        @keyframes flOrb2     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(22px,-22px)} }
        @keyframes flGrid     { from{backgroundPosition:0 0} to{backgroundPosition:40px 40px} }
        @keyframes flParticle { 0%,100%{opacity:0;transform:translateY(0) scale(0)} 40%,60%{opacity:0.55;transform:translateY(-18px) scale(1)} }
        @media(max-width:640px){
          .fl-kpi-grid  { grid-template-columns: repeat(2,1fr) !important; }
          .fl-area-grid { grid-template-columns: repeat(2,1fr) !important; }
          .fl-hero-right{ width:100% !important; }
          .fl-hero-layout{ gap:18px !important; }
          .fl-popup-bd  { align-items:flex-end !important; padding:0 !important; }
          .fl-popup-inner{ border-bottom-left-radius:0 !important; border-bottom-right-radius:0 !important; max-width:100% !important; max-height:88vh !important; }
        }
        @media(min-width:641px){
          .fl-popup-bd { align-items:center !important; padding:16px !important; }
        }
        @media(max-width:380px){
          .fl-kpi-grid { gap:5px !important; }
          .fl-area-grid{ grid-template-columns:1fr 1fr !important; }
        }
      `}}/>
    </div>
  )
}