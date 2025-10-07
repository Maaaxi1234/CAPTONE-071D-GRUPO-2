import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/shop.css";

export default function ShopSuccess() {
  const navigate = useNavigate();
  const cart = useMemo(() => JSON.parse(sessionStorage.getItem("pos_cart") || "[]"), []);
  const totals = useMemo(() => JSON.parse(sessionStorage.getItem("pos_totals") || "{}"), []);
  const total = totals?.total ?? 0;

  useEffect(() => {
    if (!cart.length) navigate("/shop", { replace: true });
  }, [cart, navigate]);
  const [method, setMethod] = useState("efectivo");   // ✅ FALTABA
  const mapMethod = {
    efectivo: "efectivo",
    tarjeta: "debito",          // si hoy tienes solo “tarjeta”, mándalo como débito
    transferencia: "transferencia",
    debito: "debito",
    credito: "credito",
  };
  const [cash, setCash] = useState(""); // monto recibido en efectivo

  const cashNum = Number(cash || 0);
  const change = Math.max(0, cashNum - total);

  function submit() {
  const payload = {
    customer: {
      full_name: "Cliente Demo",  // en el futuro puedes usar datos reales
      email: "",
      phone: "99999999",
    },
    delivery: {
      mode: "retiro",             // o "envio"
      address: "",                // requerido si envio
      notes: "",
    },
    payment_method: mapMethod[method] || "efectivo",

    items: cart.map(l => ({
      product_id: l.id,   // OBLIGATORIO este nombre
      quantity: l.qty     // OBLIGATORIO este nombre
    }))
  };

  api.post("/api/orders/", payload)
    .then(() => {
      sessionStorage.clear();
      navigate("/shop", { replace: true });
    })
    .catch(err => {
      console.error("Error al registrar la venta:", err?.response?.data || err);
      alert(JSON.stringify(err?.response?.data));
    });
}


  return (
    <div className="pay-screen">
      <div className="pay-card">
        <h2>Total a pagar</h2>
        <div className="total-big">{formatCLP(total)}</div>

        <div className="pay-methods">
          <button className={`pm ${method==="efectivo"?"active":""}`} onClick={() => setMethod("efectivo")}>💵 Efectivo</button>
          <button className={`pm ${method==="tarjeta"?"active":""}`} onClick={() => setMethod("tarjeta")}>💳 Tarjeta</button>
          <button className={`pm ${method==="transferencia"?"active":""}`} onClick={() => setMethod("transferencia")}>🏦 Transferencia</button>
        </div>

        {method === "efectivo" && (
          <div className="cash-box">
            <label>Monto recibido</label>
            <input
              type="number"
              min="0"
              step="100"
              placeholder="0"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
            />
            <div className="change">
              <span>Vuelto</span>
              <strong>{formatCLP(change)}</strong>
            </div>
          </div>
        )}

        <div className="pay-actions">
          <button className="btn ghost" onClick={() => navigate("/shop")}>Regresar</button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={method === "efectivo" && Number(cash || 0) < total}
            title={method === "efectivo" && Number(cash || 0) < total ? "Monto insuficiente para pagar" : ""}
          >
            Validar pago
          </button>
        </div>
      </div>
    </div>
  );
}

function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
