import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [form, setForm] = useState({ username: "", password: "" });
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    if (!form.username.trim() || !form.password.trim()) {
      setErrorMsg("Por favor, ingresa usuario y contraseña.");
      return;
    }
    try {
      setLoading(true);
      await login(form.username, form.password);
      // Persistencia sencilla según "recordarme"
      if (!remember) {
        // si no quiere recordar, solo mantenemos el access mientras esté abierta la pestaña
        const access = localStorage.getItem("access");
        const refresh = localStorage.getItem("refresh");
        sessionStorage.setItem("access", access);
        sessionStorage.setItem("refresh", refresh);
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
      }
      navigate("/");
    } catch (err) {
      const detail =
        err?.response?.data?.detail ||
        "Credenciales inválidas o servidor no disponible.";
      setErrorMsg(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={onSubmit} aria-label="Formulario de ingreso">
        <div className="auth-header">
          {/* Si quieres, coloca tu logo en public/logo.png y cámbialo por un <img> */}
          <div className="auth-logo" aria-hidden />
          <h1 className="auth-title">Iniciar sesión</h1>
        </div>

        <div className="auth-field">
          <label htmlFor="username">Usuario</label>
          <div className="auth-input-wrap">
            <input
              id="username"
              className="auth-input"
              type="text"
              name="username"
              placeholder="Ej: admin"
              value={form.username}
              onChange={onChange}
              autoComplete="username"
              disabled={loading}
            />
          </div>
        </div>

        <div className="auth-field">
          <label htmlFor="password">Contraseña</label>
          <div className="auth-input-wrap">
            <input
              id="password"
              className="auth-input"
              type={showPwd ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={form.password}
              onChange={onChange}
              autoComplete="current-password"
              disabled={loading}
            />
            <button
              type="button"
              className="toggle-eye"
              onClick={() => setShowPwd((s) => !s)}
              aria-label={showPwd ? "Ocultar contraseña" : "Mostrar contraseña"}
              disabled={loading}
            >
              {showPwd ? "Ocultar" : "Mostrar"}
            </button>
          </div>
        </div>

        {errorMsg && <div className="auth-error">{errorMsg}</div>}

        <div className="auth-row">
          <label>
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={loading}
              style={{ marginRight: 6 }}
            />
            Recordarme
          </label>

          <a href="#" onClick={(e)=>e.preventDefault()}>
            ¿Olvidaste tu contraseña?
          </a>
        </div>

        <button className="auth-btn" type="submit" disabled={loading}>
          {loading && <span className="btn-spinner" />}
          {loading ? "Ingresando..." : "Entrar"}
        </button>

        <div className="auth-foot">
          © {new Date().getFullYear()} Plantitas donde la Fran • Seguridad y Control
        </div>
      </form>
    </div>
  );
}
