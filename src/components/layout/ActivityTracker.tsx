"use client"

import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { featureKeyFromPath } from "@/lib/features"

// Nge-log tiap kunjungan ke 1 halaman dashboard: tanggal/jam mulai
// (started_at, diisi Supabase otomatis), user siapa (user_label),
// fitur apa (feature_key, dari path segment setelah /dashboard/), dan
// berapa lama (duration_seconds, dihitung pas user PINDAH halaman atau
// NUTUP tab). Dipasang sekali di dashboard/layout.tsx, nggak render
// apapun (return null) — murni efek samping buat logging.
//
// Dua jalur login beda (lihat src/app/login/page.tsx): Supabase Auth
// asli (resolveUserLabel pakai email-nya) vs fallback cookie
// "sb-session-manual" (nggak punya identitas Supabase sama sekali,
// label-nya di-hardcode).
async function resolveUserLabel(): Promise<{ userId: string | null; label: string }> {
  const hasFallback = document.cookie.split("; ").some(c => c.startsWith("sb-session-manual="))
  if (hasFallback) return { userId: null, label: "admin123 (fallback)" }
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { userId: null, label: "(belum login)" }
  return { userId: user.id, label: user.email || user.id }
}

export default function ActivityTracker() {
  const pathname = usePathname()
  const currentLogId = useRef<string | null>(null)
  const startedAtMs = useRef<number>(0)

  // sendBeacon (bukan fetch) — satu-satunya cara yang RELIABLE buat
  // ngirim data pas tab lagi ditutup/dipindah (fetch biasa bisa
  // ke-cancel browser sebelum sempat terkirim).
  function endCurrent() {
    if (!currentLogId.current) return
    const endedAt = new Date().toISOString()
    const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtMs.current) / 1000))
    const payload = JSON.stringify({ logId: currentLogId.current, endedAt, durationSeconds })
    navigator.sendBeacon("/api/activity-log/end", new Blob([payload], { type: "application/json" }))
    currentLogId.current = null
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { userId, label } = await resolveUserLabel()
      if (cancelled) return
      const { data } = await supabase.from("activity_logs")
        .insert({ user_id: userId, user_label: label, feature_key: featureKeyFromPath(pathname), path: pathname })
        .select("id").single()
      if (!cancelled && data) {
        currentLogId.current = data.id
        startedAtMs.current = Date.now()
      }
    })()
    // Cleanup jalan pas pathname GANTI (sebelum effect baru buat path
    // berikutnya jalan) ATAU pas komponen unmount — dua-duanya berarti
    // "selesai lihat halaman ini", jadi nutup log yang lagi aktif.
    return () => { cancelled = true; endCurrent() }
  }, [pathname])

  useEffect(() => {
    const onHide = () => endCurrent()
    const onVisibility = () => { if (document.visibilityState === "hidden") endCurrent() }
    window.addEventListener("pagehide", onHide)
    document.addEventListener("visibilitychange", onVisibility)
    return () => {
      window.removeEventListener("pagehide", onHide)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [])

  return null
}
