// src/AuthScreen.jsx — drop in src/ folder
import { useState } from "react"
import { signIn, signUp } from "./supabase"

export default function AuthScreen({ onAuth }) {
  const [mode, setMode]       = useState("signin") // "signin" | "signup"
  const [email, setEmail]     = useState("")
  const [pass, setPass]       = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState("")
  const [success, setSuccess] = useState("")

  const submit = async () => {
    setError(""); setSuccess("")
    if (!email.trim() || !pass.trim()) return setError("Email and password required.")
    if (mode === "signup" && pass !== confirm) return setError("Passwords don't match.")
    if (mode === "signup" && pass.length < 6) return setError("Password must be at least 6 characters.")
    setLoading(true)
    if (mode === "signup") {
      const { data, error: e } = await signUp(email.trim(), pass)
      setLoading(false)
      if (e) return setError(e.message)
      // Supabase sends a confirmation email by default
      setSuccess("Check your email to confirm your account, then sign in.")
      setMode("signin"); setPass(""); setConfirm("")
    } else {
      const { data, error: e } = await signIn(email.trim(), pass)
      setLoading(false)
      if (e) return setError(e.message)
      if (data?.session) onAuth(data.session)
    }
  }

  const inp = {
    background: "var(--s1,#141414)",
    border: "1px solid var(--b1,#252525)",
    borderRadius: 4,
    color: "var(--tx,#dedede)",
    fontFamily: "'DM Sans', sans-serif",
    fontSize: 14,
    padding: "10px 12px",
    width: "100%",
    outline: "none",
  }
  const btn = (primary) => ({
    background: primary ? "var(--primary,#c8a96e)" : "var(--s2,#1a1a1a)",
    border: `1px solid ${primary ? "var(--primary,#c8a96e)" : "var(--b2,#333)"}`,
    borderRadius: 4,
    color: primary ? "#000" : "var(--tx3,#555)",
    cursor: loading ? "not-allowed" : "pointer",
    fontFamily: "'DM Mono', monospace",
    fontSize: 9,
    letterSpacing: 1.5,
    opacity: loading ? 0.6 : 1,
    padding: "10px 0",
    textTransform: "uppercase",
    width: "100%",
  })

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "var(--bg,#0c0c0c)", padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 360,
        background: "var(--s1,#141414)",
        border: "1px solid var(--b1,#252525)",
        borderRadius: 6, padding: 28,
      }}>
        {/* header */}
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, letterSpacing: 3, color: "var(--primary,#c8a96e)", textTransform: "uppercase", marginBottom: 6 }}>
            A Theory of Everything
          </div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 2, color: "var(--tx3,#555)", textTransform: "uppercase" }}>
            {mode === "signin" ? "Sign In" : "Create Account"}
          </div>
        </div>

        {/* mode toggle */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--bg,#0c0c0c)", borderRadius: 4, padding: 3 }}>
          {["signin","signup"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setSuccess("") }}
              style={{ flex: 1, padding: "6px 0", border: "none", borderRadius: 3, cursor: "pointer",
                fontFamily: "'DM Mono',monospace", fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase",
                background: mode === m ? "var(--s2,#1a1a1a)" : "transparent",
                color: mode === m ? "var(--tx,#dedede)" : "var(--tx3,#555)",
                transition: "all .15s" }}>
              {m === "signin" ? "Sign In" : "Sign Up"}
            </button>
          ))}
        </div>

        {/* fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <input style={inp} type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} />
          <input style={inp} type="password" placeholder="Password" value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} />
          {mode === "signup" && (
            <input style={inp} type="password" placeholder="Confirm password" value={confirm}
              onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === "Enter" && submit()} />
          )}
        </div>

        {/* feedback */}
        {error   && <div style={{ marginTop: 12, fontSize: 11, color: "var(--danger,#a06060)", lineHeight: 1.4 }}>{error}</div>}
        {success && <div style={{ marginTop: 12, fontSize: 11, color: "var(--success,#6a9e6a)", lineHeight: 1.4 }}>{success}</div>}

        {/* submit */}
        <button style={{ ...btn(true), marginTop: 16 }} onClick={submit} disabled={loading}>
          {loading ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
        </button>

        {/* guest mode */}
        <button style={{ ...btn(false), marginTop: 8 }} onClick={() => onAuth(null)}>
          Continue without account
        </button>

        {mode === "signin" && (
          <div style={{ textAlign: "center", marginTop: 14, fontSize: 10, color: "var(--tx3,#555)", fontFamily: "'DM Mono',monospace" }}>
            No account?{" "}
            <span style={{ color: "var(--primary,#c8a96e)", cursor: "pointer" }} onClick={() => { setMode("signup"); setError(""); setSuccess("") }}>
              Sign up
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
