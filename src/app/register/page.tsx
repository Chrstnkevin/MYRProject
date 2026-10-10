"use client"

import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff, Sparkles, UserPlus, CheckCircle2 } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function RegisterPage() {
  const [fullName, setFullName] = useState("")
  const [email, setEmail]       = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm]   = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)
  const [done, setDone]         = useState(false)
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password.length < 6) { setError("Password minimal 6 karakter."); return }
    if (password !== confirm) { setError("Konfirmasi password tidak sama."); return }

    setLoading(true)
    const { data, error: signUpErr } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() } },
    })
    setLoading(false)

    if (signUpErr) { setError(signUpErr.message); return }
    // Supabase balikin session null kalau project-nya masih butuh user
    // klik link konfirmasi email dulu sebelum bisa login — beda kasus
    // sama "menunggu approve admin" (itu dicek pas login, bukan di sini).
    setNeedsEmailConfirm(!data.session && !!data.user && !data.user.email_confirmed_at)
    setDone(true)
  }

  if (done) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        <div className="card" style={{ padding: "32px", maxWidth: "400px", textAlign: "center", boxShadow: "var(--shadow-md)" }}>
          <CheckCircle2 size={44} color="var(--success, #16A34A)" style={{ margin: "0 auto 16px" }} />
          <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "8px" }}>Registrasi berhasil!</div>
          <p style={{ fontSize: "13px", color: "var(--text3)", lineHeight: 1.6 }}>
            {needsEmailConfirm && <>Cek email kamu dan klik link konfirmasi dulu, lalu </>}
            Akun kamu perlu diverifikasi admin sebelum bisa login ke dashboard. Hubungi admin buat minta diverifikasi.
          </p>
          <Link href="/login" style={{ display: "inline-block", marginTop: "20px", fontSize: "13px", fontWeight: 700, color: "var(--accent)" }}>
            ← Kembali ke halaman login
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "400px", height: "400px", borderRadius: "50%", background: "var(--accent-muted)", opacity: 0.6 }} />
        <div style={{ position: "absolute", bottom: "-100px", left: "-60px", width: "300px", height: "300px", borderRadius: "50%", background: "var(--accent-light)", opacity: 0.4 }} />
      </div>

      <div style={{ width: "100%", maxWidth: "400px", position: "relative" }}>
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", boxShadow: "0 8px 32px rgba(45,106,79,0.3)" }}>
            <Sparkles size={26} color="white" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>Elite Global</div>
          <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "4px" }}>Buat akun baru</div>
        </div>

        <div className="card" style={{ padding: "32px", boxShadow: "var(--shadow-md)" }}>
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>Daftar akun 📝</div>
            <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "4px" }}>Akun akan diverifikasi admin sebelum bisa dipakai</div>
          </div>

          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div className="label" style={{ marginBottom: "6px" }}>Nama Lengkap</div>
              <input className="input" type="text" placeholder="Nama kamu" value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" required autoFocus />
            </div>
            <div>
              <div className="label" style={{ marginBottom: "6px" }}>Email</div>
              <input className="input" type="email" placeholder="nama@email.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
            </div>
            <div>
              <div className="label" style={{ marginBottom: "6px" }}>Password</div>
              <div style={{ position: "relative" }}>
                <input className="input" type={showPass ? "text" : "password"} placeholder="Minimal 6 karakter" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" required style={{ paddingRight: "44px" }} />
                <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text3)", display: "flex" }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <div className="label" style={{ marginBottom: "6px" }}>Konfirmasi Password</div>
              <input className="input" type={showPass ? "text" : "password"} placeholder="Ulangi password" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" required />
            </div>

            {error && (
              <div style={{ background: "var(--danger-bg)", border: "1px solid #fca5a5", borderRadius: "var(--radius-sm)", padding: "10px 14px", fontSize: "13px", color: "var(--danger)", fontWeight: 500 }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary" disabled={loading || !fullName || !email || !password || !confirm}
              style={{ width: "100%", justifyContent: "center", padding: "12px", fontSize: "14px", marginTop: "4px", opacity: (!fullName || !email || !password || !confirm) ? 0.6 : 1 }}>
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "14px", height: "14px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
                  Mendaftar...
                </span>
              ) : (
                <><UserPlus size={16} /> Daftar</>
              )}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "18px", fontSize: "13px", color: "var(--text3)" }}>
            Sudah punya akun? <Link href="/login" style={{ color: "var(--accent)", fontWeight: 700 }}>Masuk</Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "11px", color: "var(--text3)" }}>
          Elite Global © {new Date().getFullYear()} · System Support Dashboard
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
