import React, { useEffect } from "react";
import "../styles/ticket.css";


export default function Ticket({ order, autoPrint = false }) {
  const CLP = (n) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(n || 0);
  const fmtDateTime = (s) =>
    new Intl.DateTimeFormat("es-CL", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(s));

  // ⚙️ Datos fijos del negocio
  const biz = {
    logoText: "PLANTITAS",
    razon: "PLANTITAS DONDE LA FRAN",
    giro: "VENTA DE PLANTAS Y ACCESORIOS",
    rut: "76.123.456-7",
    direccion: "Av. Siempreviva 742",
    comuna: "Santiago",
    ciudad: "Santiago",
    telefono: "+56 9 1234 5678",
    sucursal: "Casa Matriz",
  };

  const total = Number(order.total || 0);
  const neto = order.neto ?? Math.round(total / 1.19);
  const iva = order.iva ?? (total - neto);

  useEffect(() => {
    if (autoPrint) setTimeout(() => window.print(), 400);
  }, [autoPrint]);

  return (
    <div className="ticket">
      {/* Encabezado */}
      <div className="t-header">
        <div className="t-logo">{biz.logoText}</div>
        <div className="t-title">BOLETA ELECTRÓNICA</div>
        <div className="t-rut">RUT: {biz.rut}</div>
        <div className="t-razon">{biz.razon}</div>
        <div className="t-giro">Giro: {biz.giro}</div>
        <div className="t-dir">Dirección: {biz.direccion}</div>
        <div className="t-com">
          {biz.comuna} — {biz.ciudad}
        </div>
        <div className="t-fono">Fono: {biz.telefono}</div>
        <div className="t-suc">Sucursal: {biz.sucursal}</div>
      </div>

      {/* Info de orden */}
      <div className="t-meta">
        <div>
          N°: <b>{order.number || order.id}</b>
        </div>
        <div>Fecha: {fmtDateTime(order.created_at)}</div>
        {order.customer_name && <div>Cliente: {order.customer_name}</div>}
        {order.payment_method && (
          <div>Pago: {order.payment_method.toUpperCase()}</div>
        )}
      </div>

      {/* Tabla productos */}
      <div className="t-table">
        <div className="t-row t-head">
          <div className="c-cant">CANT.</div>
          <div className="c-desc">ITEM</div>
          <div className="c-val">VALOR U.</div>
          <div className="c-sub">SUBTOTAL</div>
        </div>
        {order.items?.map((it, i) => (
          <div key={i} className="t-row">
            <div className="c-cant">{it.quantity}</div>
            <div className="c-desc">
              {it.product} {it.sku ? `(${it.sku})` : ""}
            </div>
            <div className="c-val">{CLP(it.unit_price ?? it.price ?? (it.line_total / (it.quantity || 1)))}</div>
            <div className="c-sub">{CLP(it.line_total)}</div>
          </div>
        ))}
      </div>

      {/* Totales */}
      <div className="t-totals">
        <div>
          <span>NETO:</span>
          <b>{CLP(neto)}</b>
        </div>
        <div>
          <span>IVA (19%):</span>
          <b>{CLP(iva)}</b>
        </div>
        <div className="t-total">
          <span>TOTAL:</span>
          <b>{CLP(total)}</b>
        </div>
      </div>

      {/* Pie */}
      <div className="t-footer">
        <div>Gracias por su compra 🌿</div>
        <div>Boleta generada por Plantitas POS</div>
      </div>
    </div>
  );
}
