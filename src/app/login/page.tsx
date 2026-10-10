"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Sparkles, LogIn } from "lucide-react"
import { supabase } from "@/lib/supabase"

// Login lama (satu akun dipakai bareng semua orang) — DIPERTAHANKAN
// sebagai fallback super-admin selama masa transisi ke Supabase Auth,
// biar nggak ada jeda "nggak ada yang bisa login" pas fitur baru masih
// digarap/dites. Jalur ini SAMA SEKALI nggak lewat Supabase Auth, jadi
// nggak punya identitas user asli (nggak muncul di live presence, nggak
// tunduk ke sistem permission per-fitur — otomatis akses semua halaman).
const FALLBACK_USERNAME = "admin123"
const FALLBACK_PASSWORD = "kevin123"
const FALLBACK_COOKIE   = "sb-session-manual"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPass, setShowPass] = useState(false)
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    // 1) Jalur fallback admin lama — dicek duluan, persis kayak sebelumnya.
    if (username === FALLBACK_USERNAME && password === FALLBACK_PASSWORD) {
      await new Promise(r => setTimeout(r, 400))
      document.cookie = `${FALLBACK_COOKIE}=authenticated; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
      router.push("/dashboard")
      setLoading(false)
      return
    }

    // 2) Jalur Supabase Auth asli — field "username" di sini dipakai
    // sebagai email (satu form buat dua jalur, biar UI nggak berubah).
    const { data, error: signInErr } = await supabase.auth.signInWithPassword({
      email: username.trim(),
      password,
    })

    if (signInErr) {
      setError("Email/username atau password salah.")
      setLoading(false)
      return
    }
    if (!data.user) {
      setError("Login gagal — coba lagi.")
      setLoading(false)
      return
    }

    // Cek status verifikasi admin DULU sebelum dianggap berhasil login —
    // kalau belum approved, sign-out lagi & kasih pesan sesuai statusnya.
    const { data: profile, error: profileErr } = await supabase
      .from("profiles").select("status").eq("id", data.user.id).maybeSingle()

    if (profileErr || !profile) {
      await supabase.auth.signOut()
      setError("Gagal memuat profil akun — coba lagi atau hubungi admin.")
      setLoading(false)
      return
    }
    if (profile.status === "pending") {
      await supabase.auth.signOut()
      setError("Akun kamu masih menunggu verifikasi admin.")
      setLoading(false)
      return
    }
    if (profile.status === "rejected") {
      await supabase.auth.signOut()
      setError("Akun kamu ditolak admin. Hubungi admin kalau ini keliru.")
      setLoading(false)
      return
    }

    router.push("/dashboard")
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px", fontFamily: "'Plus Jakarta Sans', sans-serif",
    }}>

      {/* Background decoration */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: "-80px", right: "-80px", width: "400px", height: "400px", borderRadius: "50%", background: "var(--accent-muted)", opacity: 0.6 }} />
        <div style={{ position: "absolute", bottom: "-100px", left: "-60px", width: "300px", height: "300px", borderRadius: "50%", background: "var(--accent-light)", opacity: 0.4 }} />
      </div>

      <div style={{ width: "100%", maxWidth: "400px", position: "relative" }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "16px",
            background: "var(--accent)", display: "flex", alignItems: "center",
            justifyContent: "center", margin: "0 auto 16px",
            boxShadow: "0 8px 32px rgba(45,106,79,0.3)",
          }}>
            <Sparkles size={26} color="white" />
          </div>
          <div style={{ fontSize: "24px", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)" }}>
            Elite Global
          </div>
          <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "4px" }}>
            Productivity Dashboard
          </div>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: "32px", boxShadow: "var(--shadow-md)" }}>
          <div style={{ marginBottom: "24px" }}>
            <div style={{ fontSize: "18px", fontWeight: 800 }}>Selamat datang 👋</div>
            <div style={{ fontSize: "13px", color: "var(--text3)", marginTop: "4px" }}>
              Masuk untuk melanjutkan ke dashboard
            </div>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <div className="label" style={{ marginBottom: "6px" }}>Email</div>
              <input
                className="input"
                type="text"
                placeholder="nama@email.com"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div>
              <div className="label" style={{ marginBottom: "6px" }}>Password</div>
              <div style={{ position: "relative" }}>
                <input
                  className="input"
                  type={showPass ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password"
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  style={{
                    position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "var(--text3)",
                    display: "flex", alignItems: "center",
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                background: "var(--danger-bg)", border: "1px solid #fca5a5",
                borderRadius: "var(--radius-sm)", padding: "10px 14px",
                fontSize: "13px", color: "var(--danger)", fontWeight: 500,
              }}>
                ⚠️ {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || !username || !password}
              style={{
                width: "100%", justifyContent: "center", padding: "12px",
                fontSize: "14px", marginTop: "4px",
                opacity: (!username || !password) ? 0.6 : 1,
              }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ width: "14px", height: "14px", border: "2px solid white", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.6s linear infinite", display: "inline-block" }} />
                  Masuk...
                </span>
              ) : (
                <><LogIn size={16} /> Masuk</>
              )}
            </button>
          </form>

          <div style={{ textAlign: "center", marginTop: "18px", fontSize: "13px", color: "var(--text3)" }}>
            Belum punya akun? <Link href="/register" style={{ color: "var(--accent)", fontWeight: 700 }}>Daftar</Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "20px", fontSize: "11px", color: "var(--text3)" }}>
          Elite Global © {new Date().getFullYear()} · System Support Dashboard
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
