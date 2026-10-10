"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Users, CheckCircle2, XCircle, ShieldCheck, ChevronDown, ChevronRight,
  Clock, ShieldAlert,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { FEATURES, FEATURE_GROUPS } from "@/lib/features"

interface Profile {
  id: string
  email: string
  full_name: string | null
  status: "pending" | "approved" | "rejected"
  is_admin: boolean
  created_at: string
}

const STATUS_LABEL: Record<Profile["status"], string> = { pending: "Menunggu", approved: "Approved", rejected: "Ditolak" }
const STATUS_CLR: Record<Profile["status"], { bg: string; color: string }> = {
  pending:  { bg: "#FEF3C7", color: "#92400E" },
  approved: { bg: "#DCFCE7", color: "#166534" },
  rejected: { bg: "#FEE2E2", color: "#991B1B" },
}

export default function UserManagementPage() {
  const [myId, setMyId]       = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null) // null = masih dicek
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [permissions, setPermissions] = useState<Map<string, Set<string>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState("")

  const hasFallbackCookie = typeof document !== "undefined" && document.cookie.split("; ").some(c => c.startsWith("sb-session-manual="))

  useEffect(() => {
    (async () => {
      // Fallback admin lama (admin123/kevin123) otomatis dianggap admin
      // di sini — nggak punya baris profiles beneran buat dicek.
      if (hasFallbackCookie) { setIsAdmin(true); loadAll(); return }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setIsAdmin(false); setLoading(false); return }
      setMyId(user.id)
      const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
      setIsAdmin(!!profile?.is_admin)
      if (profile?.is_admin) loadAll()
      else setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadAll() {
    setLoading(true)
    const [{ data: profs }, { data: perms }] = await Promise.all([
      supabase.from("profiles").select("id,email,full_name,status,is_admin,created_at").order("created_at", { ascending: false }),
      supabase.from("user_permissions").select("user_id,feature_key"),
    ])
    setProfiles((profs as Profile[]) || [])
    const map = new Map<string, Set<string>>()
    ;(perms || []).forEach((p: { user_id: string; feature_key: string }) => {
      if (!map.has(p.user_id)) map.set(p.user_id, new Set())
      map.get(p.user_id)!.add(p.feature_key)
    })
    setPermissions(map)
    setLoading(false)
  }

  async function setStatus(id: string, status: "approved" | "rejected") {
    setActionMsg("")
    const { error } = await supabase.from("profiles")
      .update({ status, approved_by: myId, approved_at: new Date().toISOString() })
      .eq("id", id)
    if (error) { setActionMsg(`❌ ${error.message}`); return }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, status } : p))
  }

  async function toggleAdmin(id: string, nextIsAdmin: boolean) {
    const { error } = await supabase.from("profiles").update({ is_admin: nextIsAdmin }).eq("id", id)
    if (error) { setActionMsg(`❌ ${error.message}`); return }
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, is_admin: nextIsAdmin } : p))
  }

  async function togglePermission(userId: string, featureKey: string, currentlyGranted: boolean) {
    // Update state LANGSUNG biar checkbox responsif, baru tulis ke DB.
    setPermissions(prev => {
      const next = new Map(prev)
      const set = new Set(next.get(userId) || [])
      if (currentlyGranted) set.delete(featureKey); else set.add(featureKey)
      next.set(userId, set)
      return next
    })
    if (currentlyGranted) {
      await supabase.from("user_permissions").delete().eq("user_id", userId).eq("feature_key", featureKey)
    } else {
      await supabase.from("user_permissions").insert({ user_id: userId, feature_key: featureKey, granted_by: myId })
    }
  }

  const pendingProfiles  = useMemo(() => profiles.filter(p => p.status === "pending"), [profiles])
  const otherProfiles    = useMemo(() => profiles.filter(p => p.status !== "pending"), [profiles])

  if (isAdmin === null || (isAdmin && loading)) {
    return <div style={{ padding: "60px", textAlign: "center", color: "var(--text3)" }}>Memuat...</div>
  }

  if (!isAdmin) {
    return (
      <div style={{ padding: "60px", textAlign: "center", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px" }}>
        <ShieldAlert size={36} color="var(--text3)" style={{ margin: "0 auto 12px", display: "block", opacity: 0.4 }} />
        <div style={{ fontSize: "16px", fontWeight: 700 }}>Akses ditolak</div>
        <div style={{ fontSize: "12px", color: "var(--text3)", marginTop: "4px" }}>Halaman ini cuma buat admin.</div>
      </div>
    )
  }

  const Row = ({ p }: { p: Profile }) => {
    const isOpen = expanded === p.id
    const granted = permissions.get(p.id) || new Set<string>()
    return (
      <div style={{ border: "1px solid var(--border)", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "var(--surface)" }}>
          <button onClick={() => setExpanded(isOpen ? null : p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex" }}>
            {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{p.full_name || "(tanpa nama)"} {p.is_admin && <span style={{ fontSize: "9px", fontWeight: 700, background: "#1E3A5F", color: "white", padding: "1px 7px", borderRadius: "99px", marginLeft: "6px" }}>ADMIN</span>}</div>
            <div style={{ fontSize: "11px", color: "var(--text3)" }}>{p.email} · daftar {new Date(p.created_at).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 9px", borderRadius: "99px", whiteSpace: "nowrap", ...STATUS_CLR[p.status] }}>{STATUS_LABEL[p.status]}</span>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {p.status === "rejected" ? (
              <button onClick={() => setStatus(p.id, "approved")} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "none", background: "#166534", color: "white", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <CheckCircle2 size={13} /> Aktifkan
              </button>
            ) : (
              <button onClick={() => setStatus(p.id, "rejected")} style={{ display: "flex", alignItems: "center", gap: "5px", padding: "6px 12px", borderRadius: "7px", border: "1px solid var(--border)", background: "var(--surface2)", color: "#991B1B", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <XCircle size={13} /> Nonaktifkan
              </button>
            )}
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text3)", cursor: "pointer" }}>
              <input type="checkbox" checked={p.is_admin} onChange={e => toggleAdmin(p.id, e.target.checked)} />
              Jadikan admin
            </label>
          </div>
        </div>

        {isOpen && (
          <div style={{ padding: "14px", borderTop: "1px solid var(--border)", background: "var(--surface2)" }}>
            {p.is_admin ? (
              <div style={{ fontSize: "12px", color: "var(--text3)" }}>User ini admin — otomatis akses semua fitur, permission di bawah diabaikan.</div>
            ) : p.status !== "approved" ? (
              <div style={{ fontSize: "12px", color: "var(--text3)" }}>Approve dulu user ini buat bisa atur permission fitur.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {FEATURE_GROUPS.map(group => (
                  <div key={group}>
                    <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "6px" }}>{group}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {FEATURES.filter(f => f.group === group).map(f => {
                        const isGranted = granted.has(f.key)
                        return (
                          <label key={f.key}
                            style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 10px", borderRadius: "7px", border: `1px solid ${isGranted ? "#86efac" : "var(--border)"}`, background: isGranted ? "#F0FDF4" : "var(--surface)", fontSize: "11px", fontWeight: 600, color: isGranted ? "#166534" : "var(--text2)", cursor: "pointer" }}>
                            <input type="checkbox" checked={isGranted} onChange={() => togglePermission(p.id, f.key, isGranted)} />
                            {f.label}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: "38px", height: "38px", borderRadius: "10px", background: "linear-gradient(135deg,#7C3AED,#1E3A5F)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Users size={20} color="white" />
        </div>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 800, margin: 0 }}>User Management</h1>
          <p style={{ fontSize: "12px", color: "var(--text3)", margin: 0 }}>Atur fitur yang boleh diakses tiap user, nonaktifkan akun kalau perlu</p>
        </div>
      </div>

      {actionMsg && <div style={{ fontSize: "12px", color: "#991B1B" }}>{actionMsg}</div>}

      {pendingProfiles.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <Clock size={14} color="#92400E" />
            <span style={{ fontSize: "13px", fontWeight: 800 }}>Menunggu Verifikasi ({pendingProfiles.length})</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingProfiles.map(p => <Row key={p.id} p={p} />)}
          </div>
        </div>
      )}

      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <ShieldCheck size={14} color="var(--text3)" />
          <span style={{ fontSize: "13px", fontWeight: 800 }}>Semua User ({otherProfiles.length})</span>
        </div>
        {otherProfiles.length === 0 ? (
          <div style={{ padding: "30px", textAlign: "center", color: "var(--text3)", fontSize: "12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "10px" }}>
            Belum ada user lain.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {otherProfiles.map(p => <Row key={p.id} p={p} />)}
          </div>
        )}
      </div>
    </div>
  )
}
