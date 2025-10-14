// src/pages/ShopSuccess.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/shop.css";
import Ticket from "../components/Ticket"; // ← usa el Ticket.jsx que te pasé

export default function ShopSuccess() {
  const navigate = useNavigate();

  // Carro y totales guardados por el POS
  const cart = useMemo(
    () => JSON.parse(sessionStorage.getItem("pos_cart") || "[]"),
    []
  );
  const totals = useMemo(
    () => JSON.parse(sessionStorage.getItem("pos_totals") || "{}"),
    []
  );
  const total = totals?.total ?? 0;

  // Si no hay carrito, vuelve al POS
  useEffect(() => {
    if (!cart.length) navigate("/shop", { replace: true });
  }, [cart, navigate]);

  // ===== Estado de pago =====
  const [method, setMethod] = useState("efectivo");
  const mapMethod = {
    efectivo: "efectivo",
    tarjeta: "debito", // ajusta si distingues débito/crédito
    transferencia: "transferencia",
    debito: "debito",
    credito: "credito",
  };
  const [cash, setCash] = useState("");
  const cashNum = Number(cash || 0);
  const change = Math.max(0, cashNum - total);

  // ===== Flujo 2: mostrar boleta =====
  const [order, setOrder] = useState(null); // cuando exista, renderizamos Ticket

  async function submit() {
    try {
      const payload = {
        customer: {
          full_name: "Cliente Demo",
          email: "",
          phone: "99999999",
        },
        delivery: {
          mode: "retiro",
          address: "",
          notes: "",
        },
        payment_method: mapMethod[method] || "efectivo",
        items: cart.map((l) => ({
          product_id: l.id, // OBLIGATORIO este nombre según tu API
          quantity: l.qty,  // OBLIGATORIO este nombre según tu API
        })),
      };

      const resp = await api.post("/api/orders/", payload);
      // Puede venir la orden completa o solo {id}
      let ord = resp.data;

      if (!ord?.items) {
        // Si vino solo el id, consulta el detalle
        const id = ord?.id ?? ord?.order_id ?? ord;
        const det = await api.get(`/api/orders/${id}/`);
        ord = det.data;
      }

      // Limpiar POS (carro) y pasar a boleta
      sessionStorage.removeItem("pos_cart");
      sessionStorage.removeItem("pos_totals");
      setOrder(ord);
      // La impresión la hace el <Ticket autoPrint />
    } catch (err) {
      console.error("Error al registrar la venta:", err?.response?.data || err);
      alert(
        "No se pudo registrar la venta.\n\n" +
          JSON.stringify(err?.response?.data || err?.message || err)
      );
    }
  }

  // ===== Vista 2: Boleta (Ticket) =====
  if (order) {
  return (
    <div className="ticket-page">
      <div className="ticket-wrap">
        <Ticket order={order} autoPrint />
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button className="btn primary" onClick={() => navigate("/shop")}>
            Nueva venta
          </button>
        </div>
      </div>
    </div>
  );
}

  // ===== Vista 1: Cobro =====
  return (
    <div className="pay-screen">
      <div className="pay-card">
        <h2>Total a pagar</h2>
        <div className="total-big">{formatCLP(total)}</div>

        <div className="pay-methods">
          <button
            className={`pm ${method === "efectivo" ? "active" : ""}`}
            onClick={() => setMethod("efectivo")}
          >
            💵 Efectivo
          </button>
          <button
            className={`pm ${method === "tarjeta" ? "active" : ""}`}
            onClick={() => setMethod("tarjeta")}
          >
            💳 Tarjeta
          </button>
          <button
            className={`pm ${method === "transferencia" ? "active" : ""}`}
            onClick={() => setMethod("transferencia")}
          >
            🏦 Transferencia
          </button>
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
          <button className="btn ghost" onClick={() => navigate("/shop")}>
            Regresar
          </button>
          <button
            className="btn primary"
            onClick={submit}
            disabled={method === "efectivo" && Number(cash || 0) < total}
            title={
              method === "efectivo" && Number(cash || 0) < total
                ? "Monto insuficiente para pagar"
                : ""
            }
          >
            Validar pago
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===== Utils ===== */
function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(n);
}
