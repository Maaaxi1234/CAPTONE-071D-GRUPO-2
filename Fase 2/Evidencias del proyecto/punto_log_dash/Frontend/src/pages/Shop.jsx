import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PRODUCTS, CATEGORIES } from "../data/products";
import { useCart } from "../context/CartContext";
import ProductCard from "../components/ProductCard";
import CartDrawer from "../components/CartDrawer";
import CheckoutModal from "../components/CheckoutModal";
import "../styles/shop.css";
import "../styles/shop.modal.css";

export default function Shop() {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("Todas");
  const [open, setOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const { add, count, subtotal } = useCart();
  const navigate = useNavigate();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return PRODUCTS.filter((p) => {
      const inCat = cat === "Todas" || p.category === cat;
      const inQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      const inPrice =
        (minPrice === "" || p.price >= Number(minPrice)) &&
        (maxPrice === "" || p.price <= Number(maxPrice));
      return inCat && inQ && inPrice;
    });
  }, [query, cat, minPrice, maxPrice]);

  return (
    <div className="shop-page">
      {/* Top bar */}
      <header className="shop-top">
        <div className="shop-brand">
          <div className="leaf">🍃</div>
          <div>
            <h2 className="brand-name">Plantitas donde la Fran</h2>
            <div className="brand-sub">Tienda</div>
          </div>
        </div>
        <div className="shop-actions">
          <button className="btn" onClick={() => setOpen(true)}>
            Carrito · {count} · {formatCLP(subtotal)}
          </button>
        </div>
      </header>

      {/* Filtros */}
      <section className="shop-filters">
        <div className="tabs">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              className={`tab ${c === cat ? "active" : ""}`}
              onClick={() => setCat(c)}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="filters-row">
          <input
            type="search"
            className="inp"
            placeholder="Buscar por nombre o SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="price-range">
            <input
              type="number"
              className="inp small"
              placeholder="Mín $"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <span>—</span>
            <input
              type="number"
              className="inp small"
              placeholder="Máx $"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Grid de productos */}
      <section className="shop-grid">
        {filtered.map((p) => (
          <ProductCard key={p.id} product={p} onAdd={(prod) => add(prod, 1)} />
        ))}
        {filtered.length === 0 && (
          <div className="empty">No encontramos productos con esos filtros 🌱</div>
        )}
      </section>

      <CartDrawer
        open={open}
        onClose={() => setOpen(false)}
        onCheckout={() => { setOpen(false); setShowCheckout(true); }}
      />

      <CheckoutModal
        open={showCheckout}
        onClose={() => setShowCheckout(false)}
        onSuccess={(order) => navigate(`/shop/success?code=${order.code}`)}
      />
    </div>
  );
}

function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
