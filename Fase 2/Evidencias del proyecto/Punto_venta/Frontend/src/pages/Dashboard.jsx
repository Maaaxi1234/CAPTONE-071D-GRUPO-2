import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";


export default function Dashboard() {
  const { logout } = useAuth();

  const [stats] = useState({
    ventasHoy: 129_500,
    ticketsHoy: 18,
    ticketPromedio: 7_194,
    lowStockCount: 4,
  });

  const ventas7 = useMemo(
    () => [120000, 98000, 145000, 110000, 155000, 172000, 129500],
    []
  );

  const topProductos = [
    { nombre: "Rosa roja (unidad)", vendidos: 84, ingreso: 126000 },
    { nombre: "Ramo Primavera", vendidos: 23, ingreso: 161000 },
    { nombre: "Lirio blanco (unidad)", vendidos: 41, ingreso: 61500 },
    { nombre: "Ramo Deluxe", vendidos: 9, ingreso: 135000 },
  ];

  const lowStock = [
    { sku: "ROSA-RJA-UNI", nombre: "Rosa roja (unidad)", stock: 6 },
    { sku: "LIR-BLC-UNI", nombre: "Lirio blanco (unidad)", stock: 5 },
    { sku: "RMO-PRM-STD", nombre: "Ramo Primavera", stock: 3 },
    { sku: "EUC-BQT", nombre: "Eucalipto (fardo)", stock: 2 },
  ];

  return (
    <div className="page page-plantitas">
      {/* Header */}
      <header className="dash-header">
        <div className="brand">
          <div className="brand-logo" />
          <div>
            <h1 className="brand-title">Plantitas donde la Fran</h1>
            <div className="brand-sub">Panel principal</div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn ghost" onClick={logout}>Cerrar sesión</button>
        </div>
      </header>

      {/* KPIs arriba */}
      <section className="grid kpis">
        <Kpi title="Ventas de hoy" value={formatCLP(stats.ventasHoy)} hint="INGRESO BRUTO" />
        <Kpi title="Tickets" value={stats.ticketsHoy} hint="TRANSACCIONES" />
        <Kpi title="Ticket promedio" value={formatCLP(stats.ticketPromedio)} hint="POR TICKET" />
        <Kpi title="Stock bajo" value={stats.lowStockCount} hint="PRODUCTOS" warn />
      </section>

      {/* Layout 3 columnas: gráfico — HUB (botones) — gráfico */}
      <section className="main-grid">
        <Card title="Ventas últimos 7 días">
          <Bars data={ventas7} />
        </Card>

        <Hub /> {/* ⬅️ botones grandes centrados */}

        <Card title="Top productos">
          <Table
            columns={["Producto", "Vendidos", "Ingreso"]}
            rows={topProductos.map(p => [p.nombre, p.vendidos, formatCLP(p.ingreso)])}
          />
        </Card>
      </section>

      {/* Debajo, tablas a ancho completo en 2 columnas */}
      <section className="grid two">
        <Card title="Stock bajo">
          <Table columns={["SKU", "Producto", "Stock"]} rows={lowStock.map(i => [i.sku, i.nombre, i.stock])} />
        </Card>

        <Card title="Notas / recordatorios">
          <ul className="notes">
            <li>Revisar proveedor de rosas (precio subió 4%).</li>
            <li>Programar campaña “Día de la Madre”.</li>
            <li>Etiquetas nuevas para ramos “Deluxe”.</li>
          </ul>
        </Card>
      </section>
    </div>
  );
}

/* ---------- Componentes ---------- */

function Kpi({ title, value, hint, warn = false }) {
  return (
    <div className={`card kpi ${warn ? "warn" : ""}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-hint">{hint}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="card">
      <div className="card-head">
        <h3>{title}</h3>
      </div>
      <div className="card-body">{children}</div>
    </div>
  );
}

function Table({ columns, rows }) {
  return (
    <div className="table">
      <div className="thead">
        {columns.map((c, i) => (
          <div key={i} className="th">{c}</div>
        ))}
      </div>
      <div className="tbody">
        {rows.map((r, i) => (
          <div key={i} className="tr">
            {r.map((cell, j) => (
              <div key={j} className="td">{cell}</div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Gráfico simple
function Bars({ data }) {
  const max = Math.max(...data, 1);
  return (
    <div className="bars">
      {data.map((v, i) => {
        const h = Math.round((v / max) * 100);
        return (
          <div key={i} className="bar">
            <div className="bar-fill" style={{ height: `${h}%` }} />
            <div className="bar-val">{shortCLP(v)}</div>
          </div>
        );
      })}
    </div>
  );
}

/* HUB central con botones grandes */
function Hub() {
  const navigate = useNavigate();
  return (
    <div className="hub">
      <button className="tile tile-primary" onClick={() => navigate("/shop")}>
        <span className="tile-emoji">🧾</span>
        <span className="tile-title">Punto de venta</span>
        <span className="tile-sub">Cobrar / Registrar ventas</span>
      </button>

      <button className="tile" onClick={() => navigate("/inventario")}>
        <span className="tile-emoji">📚</span>
        <span className="tile-title">Inventario</span>
        <span className="tile-sub">Productos y stock</span>
      </button>
    </div>
  );
}

/* ---------- Utils ---------- */
function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
function shortCLP(n) {
  const k = Math.round(n / 1000);
  return `$${k}k`;
}
