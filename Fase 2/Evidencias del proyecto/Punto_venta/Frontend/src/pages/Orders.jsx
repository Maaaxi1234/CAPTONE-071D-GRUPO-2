import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../services/api";

export default function Orders() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    api.get("/api/orders/list/")
      .then(r => setRows(r.data))
      .catch(err => {
        const status = err?.response?.status;
        if (status === 401) setError("Debes iniciar sesión para ver los pedidos.");
        else setError(String(err?.response?.data?.detail || "No se pudieron cargar los pedidos."));
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(o =>
      o.code.toLowerCase().includes(s) ||
      (o.full_name || "").toLowerCase().includes(s) ||
      (o.payment_method || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="page page-plantitas">
      <div className="dash-header">
        <div className="brand">
          <div className="brand-logo" />
          <div>
            <h1 className="brand-title">Pedidos</h1>
            <div className="brand-sub">Listado de órdenes</div>
          </div>
        </div>
        <div className="header-actions">
          <Link className="btn" to="/">Volver al panel</Link>
        </div>
      </div>

      <div className="card" style={{padding:12, marginBottom:12}}>
        <input
          className="inp"
          placeholder="Buscar por código, cliente o método de pago..."
          value={q}
          onChange={(e)=>setQ(e.target.value)}
        />
      </div>

      {error && (
        <div className="card" style={{padding:12, marginBottom:12}}>
          <div className="auth-error" style={{margin:0}}>
            {error} {error.includes("iniciar sesión") && (<Link to="/login">Ir al login</Link>)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="card">Cargando...</div>
      ) : (
        <div className="card">
          <div className="table">
            <div className="thead" style={{gridTemplateColumns: "1fr auto auto auto auto"}}>
              <div className="th">Código</div>
              <div className="th">Fecha</div>
              <div className="th">Cliente</div>
              <div className="th">Pago</div>
              <div className="th">Total</div>
            </div>
            <div className="tbody">
              {filtered.map(o => (
                <div
                  key={o.id}
                  className="tr row-clickable"
                  style={{gridTemplateColumns: "1fr auto auto auto auto", cursor: "pointer"}}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e)=>{ if(e.key === "Enter") navigate(`/orders/${o.id}`)}}
                >
                  <div className="td"><span className="link">{o.code}</span></div>
                  <div className="td">{new Date(o.created_at).toLocaleString()}</div>
                  <div className="td">{o.full_name}</div>
                  <div className="td">{o.payment_method}</div>
                  <div className="td">{formatCLP(o.total)}</div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="tr"><div className="td">Sin resultados</div></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
