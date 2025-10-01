import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || "Credenciales inválidas";
      setError(String(msg));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0b0f19",
      color: "#fff",
      padding: 16
    }}>
      <form onSubmit={onSubmit} style={{
        width: 360,
        background: "#111827",
        border: "1px solid #1f2937",
        borderRadius: 12,
        padding: 20,
        display: "grid",
        gap: 12
      }}>
        <h2 style={{ margin: 0 }}>Iniciar sesión</h2>
        <label>
          <div style={{ fontSize: 12, opacity: .8, marginBottom: 4 }}>Usuario</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            style={{
              width: "100%", height: 40, borderRadius: 8,
              border: "1px solid #374151", background: "#0f172a", color: "white", padding: "0 10px"
            }}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, opacity: .8, marginBottom: 4 }}>Contraseña</div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%", height: 40, borderRadius: 8,
              border: "1px solid #374151", background: "#0f172a", color: "white", padding: "0 10px"
            }}
          />
        </label>

        {error && (
          <div style={{ color: "#fca5a5", fontSize: 14 }}>{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            height: 42, borderRadius: 10, border: "none",
            background: "#2563eb", color: "white", fontWeight: 800, cursor: "pointer",
            opacity: submitting ? .7 : 1
          }}
        >
          {submitting ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
