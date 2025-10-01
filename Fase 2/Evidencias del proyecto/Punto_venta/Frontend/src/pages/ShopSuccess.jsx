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

  const [method, setMethod] = useState("efectivo"); // efectivo | tarjeta | transferencia
  const [cash, setCash] = useState(""); // monto recibido en efectivo

  const cashNum = Number(cash || 0);
  const change = Math.max(0, cashNum - total);

  function submit() {
    // Construir payload para backend
    const payload = {
      items: cart.map(l => ({
        product_id: l.id,
        qty: l.qty,
        price: l.price,
      })),
      note: `Pago: ${method}${method === "efectivo" ? ` / Recibido ${cashNum} / Vuelto ${change}` : ""}`,
    };

    api.post("/api/orders/", payload)
      .then(() => {
        // limpiar carrito temporal
        sessionStorage.removeItem("pos_cart");
        sessionStorage.removeItem("pos_totals");
        navigate("/shop", { replace: true });
      })
      .catch(err => {
        alert(err?.response?.data?.detail || "Error al registrar la venta");
        console.error(err);
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
