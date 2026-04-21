"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Sparkles, LogIn } from "lucide-react"

const VALID_USERNAME = "admin123"
const VALID_PASSWORD = "kevin123"
// Cookie name yang dicek middleware
const SESSION_COOKIE = "sb-session-manual"

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

    await new Promise(r => setTimeout(r, 600)) // feel legit

    if (username === VALID_USERNAME && password === VALID_PASSWORD) {
      // Set cookie manual agar middleware mengenalinya
      document.cookie = `sb-session-manual=authenticated; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
      router.push("/dashboard")
    } else {
      setError("Username atau password salah.")
    }
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
              <div className="label" style={{ marginBottom: "6px" }}>Username</div>
              <input
                className="input"
                type="text"
                placeholder="Masukkan username"
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