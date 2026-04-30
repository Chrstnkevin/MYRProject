"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { LandingTutorial, TutorialImprovement, TutorialStep } from "@/lib/types"
import LandingNav from "../components/LandingNav"

/* ─── Types ─────────────────────────────────────────────────── */
interface TutorialApp {
  id: string
  appName: string
  emoji: string
  improvements: TutorialImprovement[]
}

function fromDB(row: LandingTutorial): TutorialApp {
  return { id: row.app_id, appName: row.app_name, emoji: row.emoji, improvements: row.improvements ?? [] }
}

const APP_STYLES: Record<string, { color: string; light: string; grad: string }> = {
  "matrix":      { color: "#7C3AED", light: "#EDE9FE", grad: "linear-gradient(135deg,#7C3AED,#A855F7)" },
  "sfa":         { color: "#E8381A", light: "#FEF0ED", grad: "linear-gradient(135deg,#E8381A,#F97316)" },
  "ficom":       { color: "#FB8C00", light: "#FFF3E0", grad: "linear-gradient(135deg,#FB8C00,#FFA726)" },
  "ficom-lite":  { color: "#1E88E5", light: "#E3F2FD", grad: "linear-gradient(135deg,#1E88E5,#42A5F5)" },
}
const gs = (appId: string) => APP_STYLES[appId] ?? { color: "#6B7280", light: "#F4F4F2", grad: "linear-gradient(135deg,#6B7280,#9CA3AF)" }

/* ─── Share Token — Supabase-backed ─────────────────────────── */
/**
 * Tokens are stored in the `tutorial_share_tokens` table.
 * See SQL comment in getOrCreateShareToken below.
 */

function randomSlug(len = 8): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map(b => chars[b % chars.length]).join("")
}

async function getOrCreateShareToken(appId: string, impId: string): Promise<string | null> {
  // Reuse existing token for same app+imp
  const { data: existing } = await supabase
    .from("tutorial_share_tokens")
    .select("token")
    .eq("app_id", appId)
    .eq("imp_id", impId)
    .maybeSingle()
  if (existing?.token) return existing.token

  // Create new
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = randomSlug(8)
    const { error } = await supabase
      .from("tutorial_share_tokens")
      .insert({ token, app_id: appId, imp_id: impId })
    if (!error) return token
  }
  return null
}

async function resolveShareToken(token: string): Promise<{ appId: string; impId: string } | null> {
  const { data } = await supabase
    .from("tutorial_share_tokens")
    .select("app_id, imp_id")
    .eq("token", token)
    .maybeSingle()
  if (!data) return null
  return { appId: data.app_id, impId: data.imp_id }
}

/* ─── Real QR Code via qrserver.com API ──────────────────────── */
function QRCode({ url, color, size = 160 }: { url: string; color: string; size?: number }) {
  const [loaded, setLoaded] = useState(false)
  // qrserver.com free API — no install needed, works in browser
  // color param needs hex without '#'
  const hex = color.replace("#", "")
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}&color=${hex}&bgcolor=ffffff&qzone=1&format=svg`

  return (
    <div style={{ position: "relative", width: size, height: size, borderRadius: 10, overflow: "hidden", background: "white", border: `2px solid ${color}20` }}>
      {!loaded && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "white" }}>
          <div style={{ width: 20, height: 20, border: `2px solid ${color}30`, borderTopColor: color, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qrUrl}
        alt="QR Code"
        width={size}
        height={size}
        onLoad={() => setLoaded(true)}
        style={{ display: loaded ? "block" : "none", width: size, height: size }}
      />
    </div>
  )
}

/* ─── Share Modal — responsive ───────────────────────────────── */
function ShareModal({ app, impName, shareUrl, loadingUrl, onClose }: { app: TutorialApp; impName: string; shareUrl: string; loadingUrl: boolean; onClose: () => void }) {
  const s = gs(app.id)
  const [copied, setCopied] = useState<"url" | "text" | null>(null)
  const shareText = `📖 Tutorial: *${impName}*\n🚀 App: ${app.emoji} ${app.appName}\n🔗 ${shareUrl}`

  const copy = async (type: "url" | "text") => {
    await navigator.clipboard.writeText(type === "url" ? shareUrl : shareText)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 0, animation: "fade-in 0.2s ease" }}
      className="share-modal-overlay">
      <div onClick={e => e.stopPropagation()}
        style={{ background: "white", borderRadius: "24px 24px 0 0", padding: "24px 20px 32px", width: "100%", maxWidth: 480, boxShadow: "0 -8px 48px rgba(0,0,0,0.18)", animation: "sheet-in 0.3s cubic-bezier(0.34,1.2,0.64,1)", maxHeight: "92dvh", overflowY: "auto" }}
        className="share-modal-sheet">

        {/* Drag handle */}
        <div style={{ width: 40, height: 4, background: "#E5E7EB", borderRadius: 99, margin: "0 auto 20px" }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: s.color, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>Share Tutorial</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#111", fontFamily: "'Bricolage Grotesque',sans-serif", lineHeight: 1.2 }}>{impName}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5 }}>
              <span style={{ fontSize: 13 }}>{app.emoji}</span>
              <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 600 }}>{app.appName}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "#F4F4F2", borderRadius: 99, width: 30, height: 30, cursor: "pointer", fontSize: 14, color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>✕</button>
        </div>

        {/* QR + URL — stacked on mobile, side-by-side on wider */}
        <div className="share-qr-row" style={{ display: "flex", gap: 14, marginBottom: 16, alignItems: "flex-start" }}>
          {/* QR Code — real, scannable */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {loadingUrl
              ? <div style={{ width: 140, height: 140, borderRadius: 10, background: "#F4F4F2", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${s.color}20` }}>
                  <div style={{ width: 24, height: 24, border: `2px solid ${s.color}30`, borderTopColor: s.color, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                </div>
              : <QRCode url={shareUrl} color={s.color} size={140} />
            }
            <div style={{ fontSize: 9, color: "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Scan to open</div>
          </div>

          {/* Link */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Unique Link</div>
            <div style={{ background: "#F8F9FA", borderRadius: 10, padding: "9px 11px", border: `1.5px solid ${s.color}22`, marginBottom: 9, wordBreak: "break-all", minHeight: 48, display: "flex", alignItems: "center" }}>
              {loadingUrl
                ? <span style={{ fontSize: 11, color: "#9CA3AF", fontStyle: "italic" }}>Generating link…</span>
                : <span style={{ fontSize: 10, color: "#374151", fontFamily: "monospace", lineHeight: 1.7 }}>{shareUrl}</span>
              }
            </div>
            <button onClick={() => copy("url")} disabled={loadingUrl} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: `1.5px solid ${copied === "url" ? s.color : s.color + "30"}`, background: copied === "url" ? s.color : loadingUrl ? "#F4F4F2" : s.light, color: copied === "url" ? "white" : loadingUrl ? "#9CA3AF" : s.color, cursor: loadingUrl ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>
              {copied === "url" ? "✓ Copied!" : "📋 Copy Link"}
            </button>
          </div>
        </div>

        {/* Share message */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 7 }}>Share Message</div>
          <div style={{ background: "#F8F9FA", borderRadius: 10, padding: "11px 13px", border: "1.5px solid #E5E7EB", fontSize: 12, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap", marginBottom: 9 }}>{shareText}</div>
          <button onClick={() => copy("text")} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${copied === "text" ? "#10B981" : "#E5E7EB"}`, background: copied === "text" ? "#10B981" : "white", color: copied === "text" ? "white" : "#374151", cursor: "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s" }}>
            {copied === "text" ? "✓ Copied!" : "💬 Copy Message"}
          </button>
        </div>

        {/* Quick share */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <a href={loadingUrl ? "#" : `https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" onClick={e => { if (loadingUrl) e.preventDefault() }}
            style={{ padding: "11px 0", borderRadius: 12, background: "#25D366", color: "white", textDecoration: "none", textAlign: "center", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
          <a href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`📖 ${impName} — ${app.emoji} ${app.appName}`)}`} target="_blank" rel="noopener noreferrer"
            style={{ padding: "11px 0", borderRadius: 12, background: "#0088CC", color: "white", textDecoration: "none", textAlign: "center", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="white"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Telegram
          </a>
        </div>
      </div>

      <style>{`
        @keyframes sheet-in { from{opacity:0;transform:translateY(100%);} to{opacity:1;transform:translateY(0);} }
        @keyframes spin { to{transform:rotate(360deg);} }
        @media(min-width:520px){
          .share-modal-overlay { align-items: center !important; padding: 16px !important; }
          .share-modal-sheet { border-radius: 24px !important; animation: modal-in 0.25s cubic-bezier(0.34,1.2,0.64,1) !important; }
        }
        @keyframes modal-in { from{opacity:0;transform:scale(0.92) translateY(16px);}to{opacity:1;transform:none;} }
      `}</style>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   SELECTOR PAGE
════════════════════════════════════════════════════ */
function AppCard({ app, idx }: { app: TutorialApp; idx: number }) {
  const [hovered, setHovered] = useState(false)
  const s = gs(app.id)
  const totalSteps = app.improvements.reduce((n, imp) => n + (imp.steps?.length ?? 0), 0)
  const totalImps  = app.improvements.length

  return (
    <a href={`/landing/tutorials?app=${app.id}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div style={{ background: "white", borderRadius: 24, overflow: "hidden", border: `1.5px solid ${hovered ? s.color + "40" : "rgba(0,0,0,0.07)"}`, boxShadow: hovered ? `0 20px 48px ${s.color}18, 0 4px 16px rgba(0,0,0,0.06)` : "0 2px 12px rgba(0,0,0,0.05)", transform: hovered ? "translateY(-6px)" : "none", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", animationDelay: `${idx * 0.08}s`, animation: "card-in 0.45s ease both" }}>
        <div style={{ background: s.light, padding: "28px 28px 22px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -24, top: -24, width: 100, height: 100, borderRadius: "50%", background: s.grad, opacity: hovered ? 0.18 : 0.10, transform: hovered ? "scale(1.4)" : "scale(1)", transition: "all 0.5s ease" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 44, display: "block", filter: hovered ? "drop-shadow(0 4px 8px rgba(0,0,0,0.15))" : "none", transform: hovered ? "scale(1.1)" : "scale(1)", transition: "all 0.3s" }}>{app.emoji}</span>
              <div style={{ background: s.grad, color: "white", borderRadius: 99, padding: "4px 12px", fontSize: 11, fontWeight: 700, boxShadow: `0 4px 12px ${s.color}30`, whiteSpace: "nowrap" }}>
                {totalImps > 0 ? `${totalImps} Improvement${totalImps > 1 ? "s" : ""}` : "Coming Soon"}
              </div>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111", fontFamily: "'Bricolage Grotesque',sans-serif", marginBottom: 6 }}>{app.appName}</div>
            {totalSteps > 0 && <div style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>{totalSteps} step{totalSteps > 1 ? "s" : ""} available</div>}
          </div>
        </div>
        <div style={{ padding: "16px 28px" }}>
          {totalImps > 0 ? (
            <>
              <div style={{ fontSize: 10, fontWeight: 800, color: "#D1D5DB", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>Available Content</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {app.improvements.slice(0, 4).map((imp, j) => (
                  <div key={imp.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#374151" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: hovered ? s.grad : "#E5E7EB", color: hovered ? "white" : "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, transition: "all 0.3s", transitionDelay: `${j * 0.05}s` }}>{j + 1}</div>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{imp.name}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF", flexShrink: 0 }}>{imp.steps?.length ?? 0} step{(imp.steps?.length ?? 0) !== 1 ? "s" : ""}</span>
                  </div>
                ))}
                {app.improvements.length > 4 && <div style={{ fontSize: 12, color: "#9CA3AF", paddingLeft: 26 }}>+{app.improvements.length - 4} more</div>}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "16px 0", color: "#9CA3AF", fontSize: 13 }}>No content added yet</div>
          )}
        </div>
        <div style={{ padding: "0 28px 28px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", background: hovered ? s.grad : s.light, color: hovered ? "white" : s.color, padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 700, transition: "all 0.3s", boxShadow: hovered ? `0 8px 24px ${s.color}35` : "none", border: `1.5px solid ${hovered ? "transparent" : s.color + "30"}` }}>
            {totalImps > 0 ? (hovered ? "Start Tutorial →" : `📖 Open ${app.appName}`) : "Coming Soon"}
          </div>
        </div>
      </div>
    </a>
  )
}

function SelectorPage({ apps, loading }: { apps: TutorialApp[]; loading: boolean }) {
  useEffect(() => {
    const l = document.createElement("link"); l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600;700&display=swap"
    document.head.appendChild(l)
  }, [])
  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", minHeight: "100vh", background: "white" }}>
      <LandingNav />
      <div style={{ background: "linear-gradient(135deg,#FEF0ED,#FFF8F5,#F8F4FF,white)", padding: "clamp(100px,12vw,140px) clamp(20px,5vw,80px) clamp(48px,6vw,72px)", textAlign: "center" }}>
        <div style={{ display: "inline-block", background: "#E8381A12", borderRadius: 99, padding: "5px 16px", fontSize: 12, fontWeight: 700, color: "#E8381A", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>📖 Tutorial System</div>
        <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(34px,6vw,64px)", fontWeight: 900, lineHeight: 1.05, letterSpacing: "-0.03em", marginBottom: 16, color: "#111" }}>
          Choose an App<br /><span style={{ color: "#E8381A" }}>to Get Started</span>
        </h1>
        <p style={{ fontSize: "clamp(14px,1.6vw,17px)", color: "#6B7280", lineHeight: 1.8, maxWidth: 480, margin: "0 auto" }}>
          Interactive step-by-step tutorials for every application — pick one and start learning.
        </p>
      </div>
      <div style={{ padding: "clamp(40px,6vw,72px) clamp(20px,5vw,80px) clamp(60px,8vw,100px)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "60px 0", gap: 12, alignItems: "center", color: "#9CA3AF" }}>
              <div style={{ width: 28, height: 28, border: "3px solid #E5E7EB", borderTopColor: "#9CA3AF", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Loading tutorials...
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: "clamp(16px,2.5vw,24px)" }}>
              {apps.map((app, i) => <AppCard key={app.id} app={app} idx={i} />)}
            </div>
          )}
        </div>
      </div>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } @keyframes card-in { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:none; } } @keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   STEP IMAGE — shows base64, http URL, or placeholder
════════════════════════════════════════════════════ */
function StepImage({ imageUrl, emoji, color, light }: { imageUrl: string; emoji: string; color: string; light: string }) {
  const [t, setT] = useState(0)
  const [imgError, setImgError] = useState(false)

  // Reset error state whenever the image URL changes
  useEffect(() => { setImgError(false) }, [imageUrl])

  // Animate placeholder only when no valid image
  useEffect(() => {
    if (imageUrl && !imgError) return
    const id = setInterval(() => setT(v => v + 1), 60)
    return () => clearInterval(id)
  }, [imageUrl, imgError])

  if (imageUrl && !imgError) return (
    <div style={{ flex: 1, minHeight: 0, borderRadius: 16, overflow: "hidden", background: light }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt="Tutorial screenshot"
        onError={() => setImgError(true)}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: light }}
      />
    </div>
  )

  const p = 0.72 + Math.sin(t * 0.11) * 0.14
  return (
    <div style={{ flex: 1, minHeight: 0, borderRadius: 16, background: light, border: `2px solid ${color}18`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden", gap: 12 }}>
      <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", background: color, opacity: 0.06 * p, top: -40, right: -40, transform: `scale(${p})`, transition: "all 0.06s linear" }} />
      <div style={{ position: "absolute", width: 100, height: 100, borderRadius: "50%", background: color, opacity: 0.04, bottom: 20, left: 20 }} />
      <div style={{ background: "white", borderRadius: 12, boxShadow: `0 8px 28px ${color}20`, width: "min(300px,70%)", zIndex: 1 }}>
        <div style={{ background: "#f0f0f0", padding: "6px 10px", display: "flex", gap: 4, borderRadius: "12px 12px 0 0" }}>
          {["#FF5F57", "#FFC22A", "#29CB40"].map((c, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: c }} />)}
          <div style={{ flex: 1, height: 12, borderRadius: 3, background: "white", marginLeft: 6 }} />
        </div>
        <div style={{ padding: "12px 12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          <div style={{ height: 9, borderRadius: 3, background: `${color}40`, width: "58%" }} />
          <div style={{ height: 7, borderRadius: 3, background: "#f0f0f0", width: "88%" }} />
          <div style={{ height: 7, borderRadius: 3, background: "#f0f0f0", width: "70%" }} />
          <div style={{ height: 26, borderRadius: 6, background: color, width: "42%", marginTop: 4, opacity: p, transition: "opacity 0.06s linear" }} />
        </div>
      </div>
      <div style={{ zIndex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 22, marginBottom: 3 }}>{emoji}</div>
        <div style={{ fontSize: 11, color, fontWeight: 600, opacity: 0.8 }}>Screenshot available via Admin Dashboard</div>
      </div>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   SLIDE TRANSITION
════════════════════════════════════════════════════ */
function SlideView({ children, id, dir }: { children: React.ReactNode; id: string; dir: "fwd" | "back" }) {
  const [show, setShow] = useState(false)
  useEffect(() => { setShow(false); const t = setTimeout(() => setShow(true), 16); return () => clearTimeout(t) }, [id])
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", opacity: show ? 1 : 0, transform: show ? "translateX(0)" : `translateX(${dir === "fwd" ? 40 : -40}px)`, transition: "opacity 0.3s cubic-bezier(0.4,0,0.2,1), transform 0.3s cubic-bezier(0.4,0,0.2,1)" }}>{children}</div>
  )
}

/* ════════════════════════════════════════════════════
   VIEWER PAGE
   locked=true  → from share link, hides back/dropdown
   locked=false → normal ?app= view
════════════════════════════════════════════════════ */
function ViewerPage({ app, initialImpId, locked = false }: { app: TutorialApp; initialImpId?: string; locked?: boolean }) {
  const lockedImpIdx = initialImpId ? Math.max(0, app.improvements.findIndex(i => i.id === initialImpId)) : 0
  const [impIdx, setImpIdx]   = useState(lockedImpIdx)
  const [stepIdx, setStepIdx] = useState(0)
  const [dir, setDir]         = useState<"fwd" | "back">("fwd")
  const [dropOpen, setDropOpen]     = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [shareModal, setShareModal] = useState(false)
  const [shareUrl, setShareUrl]     = useState("")
  const [loadingShareUrl, setLoadingShareUrl] = useState(false)
  const wheelLock = useRef(false)
  const inTransit = useRef(false)

  const s    = gs(app.id)
  const imps = app.improvements
  // In locked mode, always use the locked improvement index regardless of impIdx state
  const activeImpIdx = locked ? lockedImpIdx : impIdx
  const imp  = imps[activeImpIdx]
  const step = imp?.steps?.[stepIdx]
  const totalSteps = imp?.steps?.length ?? 0
  const prog = totalSteps ? ((stepIdx + 1) / totalSteps) * 100 : 0

  // Open share modal: generate/fetch token from Supabase on first open per imp
  const openShare = useCallback(async () => {
    setShareModal(true)
    if (shareUrl) return // already loaded for this session
    setLoadingShareUrl(true)
    const token = await getOrCreateShareToken(app.id, imp?.id ?? "")
    if (token) {
      setShareUrl(`${window.location.origin}/landing/tutorials?t=${token}`)
    }
    setLoadingShareUrl(false)
  }, [app.id, imp?.id, shareUrl])

  const goStep = useCallback((next: number) => {
    if (inTransit.current || next === stepIdx || next < 0 || next >= totalSteps) return
    inTransit.current = true
    setDir(next > stepIdx ? "fwd" : "back")
    setStepIdx(next)
    setTimeout(() => { inTransit.current = false }, 340)
  }, [stepIdx, totalSteps])

  const goImp = useCallback((i: number) => {
    if (locked) return // 🔒 no improvement switching in shared view
    if (i === impIdx) { setDropOpen(false); return }
    setDropOpen(false); setDir("fwd"); setImpIdx(i); setStepIdx(0)
    setShareUrl("") // reset so new token is fetched for the new improvement
  }, [impIdx, locked])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (wheelLock.current) return
    wheelLock.current = true
    setTimeout(() => { wheelLock.current = false }, 650)
    if (e.deltaY > 20) goStep(stepIdx + 1)
    if (e.deltaY < -20) goStep(stepIdx - 1)
  }, [stepIdx, goStep])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (shareModal) return
      if (["ArrowDown", "ArrowRight"].includes(e.key)) goStep(stepIdx + 1)
      if (["ArrowUp", "ArrowLeft"].includes(e.key))    goStep(stepIdx - 1)
      if (e.key === "Escape") { setDropOpen(false); setDrawerOpen(false) }
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [stepIdx, goStep, shareModal])

  const ty = useRef<number | null>(null)
  const onTS = (e: React.TouchEvent) => { ty.current = e.touches[0].clientY }
  const onTE = (e: React.TouchEvent) => {
    if (ty.current === null) return
    const d = ty.current - e.changedTouches[0].clientY
    if (Math.abs(d) > 44) d > 0 ? goStep(stepIdx + 1) : goStep(stepIdx - 1)
    ty.current = null
  }

  useEffect(() => {
    if (!dropOpen) return
    const fn = () => setDropOpen(false)
    setTimeout(() => window.addEventListener("click", fn), 0)
    return () => window.removeEventListener("click", fn)
  }, [dropOpen])

  if (!imp || !step) return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", flexDirection: "column", gap: 12, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ fontSize: 32 }}>📭</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>This improvement has no steps yet</div>
      {!locked && <a href="/landing/tutorials" style={{ fontSize: 13, color: "#E8381A", fontWeight: 600 }}>← Back to Tutorials</a>}
    </div>
  )

  return (
    <div onWheel={onWheel} onTouchStart={onTS} onTouchEnd={onTE}
      style={{ fontFamily: "'DM Sans',sans-serif", position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "#FAFAFA", userSelect: "none" }}>

      {shareModal && imp && <ShareModal app={app} impName={imp.name} shareUrl={shareUrl} loadingUrl={loadingShareUrl} onClose={() => setShareModal(false)} />}

      {/* ── Topbar ── */}
      <div style={{ height: 52, flexShrink: 0, background: "white", borderBottom: "1px solid rgba(0,0,0,0.07)", display: "flex", alignItems: "center", padding: "0 12px", gap: 8, zIndex: 20 }}>

        {/* Back — hidden when locked */}
        {!locked && (
          <a href="/landing/tutorials" style={{ fontSize: 18, fontWeight: 600, color: "#9CA3AF", textDecoration: "none", padding: "6px 8px", borderRadius: 8, lineHeight: 1, flexShrink: 0 }}>←</a>
        )}

        {/* App badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 8, background: s.light, border: `1px solid ${s.color}25`, flexShrink: 0, minWidth: 0 }}>
          <span style={{ fontSize: 14 }}>{app.emoji}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: s.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80px" }}>{app.appName}</span>
        </div>

        {/* Progress bar — fills flex space */}
        <div style={{ flex: 1, height: 4, background: "#E5E7EB", borderRadius: 99, overflow: "hidden", minWidth: 0 }}>
          <div style={{ height: "100%", width: `${prog}%`, background: s.grad, borderRadius: 99, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
        </div>

        {/* Step counter */}
        <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", flexShrink: 0, whiteSpace: "nowrap" }}>
          {stepIdx + 1}/{totalSteps}
        </div>

        {/* Improvement switcher — desktop only, hidden when locked */}
        {!locked && (
          <div id="imp-dropdown" style={{ position: "relative", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setDropOpen(v => !v)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${s.color}30`, background: s.light, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, color: s.color, whiteSpace: "nowrap", maxWidth: 180, overflow: "hidden" }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{imp.name}</span>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
                <path d="M2 4l4 4 4-4" stroke={s.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {dropOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "white", borderRadius: 14, border: "1px solid rgba(0,0,0,0.09)", boxShadow: "0 16px 48px rgba(0,0,0,0.13)", overflow: "hidden", zIndex: 50, minWidth: 240, animation: "dd-in 0.15s ease" }}>
                <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid rgba(0,0,0,0.06)", fontSize: 10, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  {imps.length} Improvement{imps.length > 1 ? "s" : ""} — {app.appName}
                </div>
                {imps.map((im, i) => (
                  <button key={im.id} onClick={() => goImp(i)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "11px 14px", border: "none", cursor: "pointer", textAlign: "left", background: i === activeImpIdx ? s.light : "white", borderLeft: i === activeImpIdx ? `3px solid ${s.color}` : "3px solid transparent", fontFamily: "inherit", transition: "background 0.15s" }}
                    onMouseEnter={e => { if (i !== activeImpIdx) e.currentTarget.style.background = "#F9FAFB" }}
                    onMouseLeave={e => { if (i !== activeImpIdx) e.currentTarget.style.background = "white" }}>
                    <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: i === activeImpIdx ? s.color : "#E5E7EB", color: i === activeImpIdx ? "white" : "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800 }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: i === activeImpIdx ? 700 : 500, color: i === activeImpIdx ? s.color : "#111" }}>{im.name}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF" }}>{im.steps?.length ?? 0} steps</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ONE share button — always in topbar */}
        <button onClick={openShare} style={{ flexShrink: 0, width: 34, height: 34, borderRadius: 10, border: `1.5px solid ${s.color}30`, background: s.light, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: s.color, transition: "all 0.2s" }}
          onMouseEnter={e => { e.currentTarget.style.background = s.color; e.currentTarget.style.color = "white" }}
          onMouseLeave={e => { e.currentTarget.style.background = s.light; e.currentTarget.style.color = s.color }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
        </button>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative", minHeight: 0 }}>
        {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 30, backdropFilter: "blur(2px)", animation: "fade-in 0.2s ease" }} />}

        {/* Sidebar — desktop only, drawer on mobile */}
        <div id="sidebar" style={{ width: 240, flexShrink: 0, background: "white", borderRight: "1px solid rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 31 }}>
          <div style={{ padding: "12px 14px 8px", flexShrink: 0 }}>
            <div style={{ background: s.light, borderRadius: 10, padding: "8px 11px", border: `1px solid ${s.color}20` }}>
              {locked
                ? <div style={{ fontSize: 9, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>🔗 Shared</div>
                : <div style={{ fontSize: 9, fontWeight: 700, color: s.color, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Improvement {activeImpIdx + 1}/{imps.length}</div>
              }
              <div style={{ fontSize: 12, fontWeight: 700, color: "#111", lineHeight: 1.3 }}>{imp.name}</div>
            </div>
          </div>
          <div style={{ padding: "0 14px 6px", fontSize: 9, fontWeight: 800, color: "#D1D5DB", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>Steps</div>
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {imp.steps?.map((st, i) => {
              const active = i === stepIdx, past = i < stepIdx
              return (
                <div key={st.id} onClick={() => { goStep(i); setDrawerOpen(false) }}
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: active ? s.light : "transparent", borderRight: active ? `3px solid ${s.color}` : "3px solid transparent", borderLeft: "3px solid transparent", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F9FAFB" }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: active ? s.color : past ? `${s.color}22` : "#E5E7EB", color: active ? "white" : past ? s.color : "#9CA3AF", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, transition: "all 0.3s", boxShadow: active ? `0 4px 10px ${s.color}35` : "none" }}>
                    {past ? "✓" : i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? "#111" : "#4B5563", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{st.title}</div>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ padding: "10px 14px 12px", borderTop: "1px solid rgba(0,0,0,0.06)", flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>Progress</span>
              <span style={{ fontSize: 10, fontWeight: 700, color: s.color }}>{Math.round(prog)}%</span>
            </div>
            <div style={{ height: 4, background: "#E5E7EB", borderRadius: 99, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${prog}%`, background: s.grad, borderRadius: 99, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)" }} />
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
          {/* Top progress strip */}
          <div style={{ height: 3, flexShrink: 0, background: s.grad, width: `${prog}%`, transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)", alignSelf: "flex-start" }} />

          {/* DESKTOP: normal column layout */}
          <div id="desktop-content" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "20px 36px 16px", overflow: "hidden" }}>
            <SlideView id={`${activeImpIdx}-${stepIdx}`} dir={dir}>
              {/* Step badge + dots */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexShrink: 0 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.light, borderRadius: 99, padding: "3px 10px", border: `1px solid ${s.color}20` }}>
                  <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
                  <span style={{ fontSize: 10, fontWeight: 800, color: s.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>Step {stepIdx + 1} / {totalSteps}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {imp.steps?.map((_, i) => (
                    <div key={i} onClick={() => goStep(i)} style={{ height: 5, width: i === stepIdx ? 18 : 5, borderRadius: 99, background: i === stepIdx ? s.color : i < stepIdx ? `${s.color}45` : "#E5E7EB", cursor: "pointer", transition: "all 0.35s cubic-bezier(0.4,0,0.2,1)" }} />
                  ))}
                </div>
              </div>

              <h1 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: "clamp(18px,3vh,32px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.025em", color: "#111", marginBottom: 8, flexShrink: 0 }}>{step.title}</h1>
              <p style={{ fontSize: "clamp(12px,1.6vh,14px)", color: "#6B7280", lineHeight: 1.7, marginBottom: 12, flexShrink: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{step.desc}</p>

              <StepImage imageUrl={step.imageUrl} emoji={app.emoji} color={s.color} light={s.light} />

              {/* Nav buttons */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginTop: 12 }}>
                <button onClick={() => goStep(stepIdx - 1)} disabled={stepIdx === 0}
                  style={{ padding: "8px 16px", borderRadius: 99, border: "1.5px solid #E5E7EB", background: "white", cursor: stepIdx === 0 ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, color: stepIdx === 0 ? "#D1D5DB" : "#374151", fontFamily: "inherit", transition: "all 0.2s" }}>← Prev</button>

                {stepIdx < totalSteps - 1 ? (
                  <button onClick={() => goStep(stepIdx + 1)}
                    style={{ padding: "8px 18px", borderRadius: 99, background: s.grad, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px ${s.color}30`, transition: "all 0.2s" }}>Next →</button>
                ) : !locked && activeImpIdx < imps.length - 1 ? (
                  <button onClick={() => goImp(activeImpIdx + 1)}
                    style={{ padding: "8px 18px", borderRadius: 99, background: s.grad, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "white", fontFamily: "inherit", boxShadow: `0 4px 14px ${s.color}30` }}>Next Improvement →</button>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setStepIdx(0)} style={{ padding: "8px 14px", borderRadius: 99, background: s.light, border: `1.5px solid ${s.color}30`, cursor: "pointer", fontSize: 12, fontWeight: 700, color: s.color, fontFamily: "inherit" }}>🔄 Restart</button>
                    {!locked && <a href="/landing/tutorials" style={{ padding: "8px 14px", borderRadius: 99, background: "#F4F4F2", border: "1.5px solid #E5E7EB", textDecoration: "none", fontSize: 12, fontWeight: 700, color: "#6B7280", fontFamily: "inherit", display: "inline-flex", alignItems: "center" }}>✅ Done</a>}
                  </div>
                )}
              </div>
            </SlideView>
          </div>

          {/* MOBILE: horizontal card swipe */}
          <div id="mobile-content" style={{ display: "none", flex: 1, flexDirection: "column", minHeight: 0 }}>
            {/* Horizontal step carousel */}
            <div style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
              <div style={{
                display: "flex",
                height: "100%",
                transform: `translateX(-${stepIdx * 100}%)`,
                transition: "transform 0.32s cubic-bezier(0.4,0,0.2,1)",
                willChange: "transform",
              }}>
                {imp.steps?.map((st, i) => (
                  <div key={st.id} style={{ minWidth: "100%", height: "100%", display: "flex", flexDirection: "column", padding: "16px 16px 12px", overflow: "hidden" }}>
                    {/* Step badge */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexShrink: 0 }}>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: s.light, borderRadius: 99, padding: "3px 10px", border: `1px solid ${s.color}20` }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: s.color }} />
                        <span style={{ fontSize: 10, fontWeight: 800, color: s.color, letterSpacing: "0.08em", textTransform: "uppercase" }}>Step {i + 1} / {totalSteps}</span>
                      </div>
                    </div>
                    <h2 style={{ fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 20, fontWeight: 900, lineHeight: 1.15, color: "#111", marginBottom: 6, flexShrink: 0 }}>{st.title}</h2>
                    <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6, marginBottom: 12, flexShrink: 0, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{st.desc}</p>
                    {/* Image fills remaining space */}
                    <StepImage imageUrl={st.imageUrl} emoji={app.emoji} color={s.color} light={s.light} />
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile bottom bar */}
            <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", background: "white", padding: "10px 14px", display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
              {/* Step dots */}
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {imp.steps?.map((_, i) => (
                  <div key={i} onClick={() => goStep(i)} style={{ height: 6, width: i === stepIdx ? 18 : 6, borderRadius: 99, background: i === stepIdx ? s.color : i < stepIdx ? `${s.color}50` : "#E5E7EB", cursor: "pointer", transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }} />
                ))}
              </div>

              <div style={{ flex: 1 }} />

              {/* Prev */}
              <button onClick={() => goStep(stepIdx - 1)} disabled={stepIdx === 0}
                style={{ width: 40, height: 40, borderRadius: 12, border: "1.5px solid #E5E7EB", background: "white", cursor: stepIdx === 0 ? "not-allowed" : "pointer", fontSize: 16, color: stepIdx === 0 ? "#D1D5DB" : "#374151", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>←</button>

              {/* Next / Done */}
              {stepIdx < totalSteps - 1 ? (
                <button onClick={() => goStep(stepIdx + 1)}
                  style={{ height: 40, padding: "0 18px", borderRadius: 12, background: s.grad, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "white", fontFamily: "inherit", boxShadow: `0 4px 12px ${s.color}30`, flexShrink: 0 }}>Next →</button>
              ) : !locked && activeImpIdx < imps.length - 1 ? (
                <button onClick={() => goImp(activeImpIdx + 1)}
                  style={{ height: 40, padding: "0 14px", borderRadius: 12, background: s.grad, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 700, color: "white", fontFamily: "inherit", boxShadow: `0 4px 12px ${s.color}30`, flexShrink: 0 }}>Next →</button>
              ) : (
                <button onClick={() => setStepIdx(0)}
                  style={{ height: 40, padding: "0 14px", borderRadius: 12, background: s.light, border: `1.5px solid ${s.color}30`, cursor: "pointer", fontSize: 13, fontWeight: 700, color: s.color, fontFamily: "inherit", flexShrink: 0 }}>🔄 Restart</button>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        * { box-sizing:border-box; margin:0; padding:0; }
        @keyframes dd-in   { from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:none;} }
        @keyframes fade-in { from{opacity:0;}to{opacity:1;} }
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:#E5E7EB;border-radius:4px;}

        /* ── MOBILE ── */
        @media(max-width:720px){
          #sidebar{
            position:absolute!important;top:0;left:0;bottom:0;
            transform:${drawerOpen ? "translateX(0)" : "translateX(-100%)"};
            box-shadow:4px 0 24px rgba(0,0,0,0.14);
            transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);
          }
          #imp-dropdown{ display:none!important; }
          #desktop-content{ display:none!important; }
          #mobile-content{ display:flex!important; }
        }
        /* ── DESKTOP ── */
        @media(min-width:721px){
          #sidebar{ transform:none!important; transition:none!important; }
          #desktop-content{ display:flex!important; }
          #mobile-content{ display:none!important; }
        }
      `}</style>
    </div>
  )
}

/* ════════════════════════════════════════════════════
   ROOT
════════════════════════════════════════════════════ */
export default function TutorialsPage() {
  const [apps, setApps]       = useState<TutorialApp[]>([])
  const [loading, setLoading] = useState(true)
  const [params, setParams]   = useState<{ app: string | null; imp: string | null; token: string | null }>({ app: null, imp: null, token: null })
  // For share token route
  const [tokenResolved, setTokenResolved] = useState<{ appId: string; impId: string } | null | "invalid" | "loading">("loading")

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search)
    setParams({ app: sp.get("app"), imp: sp.get("imp"), token: sp.get("t") })
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await supabase.from("landing_tutorials").select("*").order("app_id")
      if (!error && data) setApps((data as LandingTutorial[]).map(fromDB))
      setLoading(false)
    }
    load()
    const l = document.createElement("link"); l.rel = "stylesheet"
    l.href = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800;12..96,900&family=DM+Sans:wght@300;400;500;600;700&display=swap"
    document.head.appendChild(l)
  }, [])

  // Resolve share token from Supabase when ?t= param is present
  useEffect(() => {
    if (!params.token) return
    setTokenResolved("loading")
    resolveShareToken(params.token).then(result => {
      setTokenResolved(result ?? "invalid")
    })
  }, [params.token])

  const Spinner = () => (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA" }}>
      <div style={{ width: 36, height: 36, border: "3px solid #E5E7EB", borderTopColor: "#6B7280", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}`}</style>
    </div>
  )

  // ── ?t= share token route ──────────────────────────────────
  if (params.token) {
    // Still resolving token or loading app data
    if (tokenResolved === "loading" || loading) return <Spinner />

    // Token not found in DB — invalid or revoked
    if (tokenResolved === "invalid") return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", flexDirection: "column", gap: 12, fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ fontSize: 40 }}>🔗</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>Link tidak valid atau sudah dicabut</div>
        <div style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", maxWidth: 300 }}>Link ini tidak ditemukan. Mungkin sudah dihapus oleh admin atau URL-nya salah.</div>
        <a href="/landing/tutorials" style={{ marginTop: 4, fontSize: 13, color: "#E8381A", fontWeight: 600 }}>← Browse all tutorials</a>
      </div>
    )

    // Token valid — find app and improvement
    const resolved = tokenResolved as { appId: string; impId: string }
    const sharedApp = apps.find(a => a.id === resolved.appId)
    const sharedImp = sharedApp?.improvements.find(i => i.id === resolved.impId)
    if (!sharedApp || !sharedImp) return (
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", flexDirection: "column", gap: 12, fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ fontSize: 32 }}>🔍</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Tutorial not found</div>
        <a href="/landing/tutorials" style={{ fontSize: 13, color: "#E8381A", fontWeight: 600 }}>← Browse all tutorials</a>
      </div>
    )

    return <ViewerPage app={sharedApp} initialImpId={sharedImp.id} locked={true} />
  }

  // ── No ?app → selector ─────────────────────────────────────
  if (!params.app) return <SelectorPage apps={apps} loading={loading} />

  if (loading) return <Spinner />

  const app = apps.find(a => a.id === params.app || a.appName.toLowerCase() === params.app!.toLowerCase())

  if (!app) return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", flexDirection: "column", gap: 12, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ fontSize: 32 }}>🔍</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>App not found</div>
      <a href="/landing/tutorials" style={{ fontSize: 13, color: "#E8381A", fontWeight: 600 }}>← Back to Tutorials</a>
    </div>
  )

  if (!app.improvements || app.improvements.length === 0) return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FAFAFA", flexDirection: "column", gap: 12, fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ fontSize: 40 }}>{app.emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#374151" }}>{app.appName}</div>
      <div style={{ fontSize: 13, color: "#9CA3AF" }}>Tutorial content not added yet</div>
      <a href="/landing/tutorials" style={{ marginTop: 8, fontSize: 13, color: "#E8381A", fontWeight: 600 }}>← Choose another app</a>
    </div>
  )

  return <ViewerPage app={app} initialImpId={params.imp ?? undefined} locked={false} />
}