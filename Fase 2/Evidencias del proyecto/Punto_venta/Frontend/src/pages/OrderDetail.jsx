import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../services/api";

const LABELS = {
  pendiente: "Pendiente",
  preparando: "Preparando",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export default function OrderDetail() {
  const { id } = useParams();
  const [o, setO] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/api/orders/${id}/`)
      .then(r => setO(r.data))
      .catch(err => {
        const status = err?.response?.status;
        if (status === 401) setError("Debes iniciar sesión para ver este pedido.");
        else if (status === 404) setError("Pedido no encontrado.");
        else setError(String(err?.response?.data?.detail || "No se pudo cargar el pedido."));
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page page-plantitas"><div className="card">Cargando...</div></div>;
  if (error) return (
    <div className="page page-plantitas">
      <div className="dash-header">
        <div className="brand">
          <div className="brand-logo" />
          <div><h1 className="brand-title">Pedido</h1></div>
        </div>
        <div className="header-actions">
          <Link className="btn" to="/orders">← Volver a pedidos</Link>
        </div>
      </div>
      <div className="card"><div className="auth-error">{error}</div></div>
    </div>
  );

  return (
    <div className="page page-plantitas">
      <div className="dash-header">
        <div className="brand">
          <div className="brand-logo" />
          <div>
            <h1 className="brand-title">Pedido {o.code}</h1>
            <div className="brand-sub">{new Date(o.created_at).toLocaleString()}</div>
          </div>
        </div>
        <div className="header-actions">
          <Link className="btn" to="/orders">← Volver a pedidos</Link>
        </div>
      </div>

      <div className="grid2" style={{gap:12}}>
        <div className="card">
          <h3>Cliente</h3>
          <div><strong>{o.full_name}</strong></div>
          <div>Tel: {o.phone}</div>
          {o.address && <div>Dirección: {o.address}</div>}
          <div>Entrega: {o.delivery_mode === "envio" ? "Envío a domicilio" : "Retiro en tienda"}</div>
          <div>Pago: {o.payment_method}</div>
        </div>

        <div className="card">
          <h3>Estado</h3>
          <div><strong>{LABELS[o.status] || "Pendiente"}</strong></div>
        </div>
      </div>

      <div className="card" style={{marginTop:12}}>
        <h3>Ítems</h3>
        <div className="table">
          <div className="thead" style={{gridTemplateColumns: "1fr auto auto auto"}}>
            <div className="th">Producto</div>
            <div className="th">Cantidad</div>
            <div className="th">Precio</div>
            <div className="th">Total</div>
          </div>
          <div className="tbody">
            {o.items.map((i, idx) => (
              <div key={idx} className="tr" style={{gridTemplateColumns: "1fr auto auto auto"}}>
                <div className="td">{i.product} ({i.sku})</div>
                <div className="td">{i.quantity}</div>
                <div className="td">{formatCLP(i.price)}</div>
                <div className="td">{formatCLP(i.line_total)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{textAlign:"right", marginTop:10}}>
          <strong>Total: {formatCLP(o.total)}</strong>
        </div>
      </div>
    </div>
  );
}

function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
