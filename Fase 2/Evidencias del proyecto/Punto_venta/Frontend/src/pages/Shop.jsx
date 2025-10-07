import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api,{ API_BASE } from "../services/api";
import "../styles/shop.css";

export default function Shop() {
  const navigate = useNavigate();

  // Cargar desde backend (categorías y productos)
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    api.get("/api/categories/").then(r => setCategories(r.data)).catch(() => setCategories([]));
    api.get("/api/products/").then(r => setProducts(r.data)).catch(() => setProducts([]));
  }, []);

  // Filtros
  const [query, setQuery] = useState("");
  const [catId, setCatId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(p => {
      const matchCat = catId ? (p.category?.id ?? p.category) === catId : true;
      const name = (p.name || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      return matchCat && (!q || name.includes(q) || sku.includes(q));
    });
  }, [products, query, catId]);

  // Carrito
  const [cart, setCart] = useState([]);
  const neto = cart.reduce((acc, l) => acc + l.price * l.qty, 0);
  const tax = Math.round(neto * 0.19);
  const total = neto + tax;

  function addToCart(prod) {
    setCart(c => {
      const i = c.findIndex(x => x.id === prod.id);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], qty: copy[i].qty + 1 };
        return copy;
      }
      return [...c, { id: prod.id, name: prod.name, price: prod.price, qty: 1 }];
    });
  }
  function decQty(id) {
    setCart(c => c.map(l => l.id === id ? { ...l, qty: Math.max(0, l.qty - 1) } : l).filter(l => l.qty > 0));
  }
  function incQty(id) {
    setCart(c => c.map(l => l.id === id ? { ...l, qty: l.qty + 1 } : l));
  }
  function removeLine(id) {
    setCart(c => c.filter(l => l.id !== id));
  }

  function pay() {
    if (!cart.length) return;
    // Guarda info mínima para pantalla de pago
    sessionStorage.setItem("pos_cart", JSON.stringify(cart));
    sessionStorage.setItem("pos_totals", JSON.stringify({ neto, tax, total }));
    navigate("/shop/success"); // pantalla de método de pago
  }

  return (
    <div className="pos-wrap pos-no-pad">
      {/* Panel izquierdo: carrito */}
      <aside className="pos-aside">
        <div className="ticket-head">
          <button className="order-number">#Ticket</button>
        </div>

        <div className="cart-list">
          {cart.length === 0 && <div className="empty">Sin productos</div>}
          {cart.map((l) => (
            <div key={l.id} className="cart-line">
              <div className="line-title">
                {l.name}
                <button className="line-del" onClick={() => removeLine(l.id)}>✕</button>
              </div>
              <div className="line-meta">
                <div className="qty-ctrl">
                  <button onClick={() => decQty(l.id)}>-</button>
                  <span className="qty">{l.qty}</span>
                  <button onClick={() => incQty(l.id)}>+</button>
                </div>
                <span className="x">×</span>
                <span className="unit">{formatCLP(l.price)}</span>
                <span className="grow" />
                <strong>{formatCLP(l.price * l.qty)}</strong>
              </div>
            </div>
          ))}
        </div>

        <div className="totals">
          <div className="row"><span>Impuestos</span><span>{formatCLP(tax)}</span></div>
          <div className="row total"><span>Total</span><span>{formatCLP(total)}</span></div>
        </div>

        <div className="paybar single">
          <button className={`pay ${cart.length ? "" : "disabled"}`} onClick={pay}>
            Pagar
          </button>
        </div>
      </aside>

      {/* Principal: buscador, categorías y grid */}
      <main className="pos-main">
        <header className="pos-topbar">
          <div className="brand">Plantitas POS</div>
          <input
            className="search"
            placeholder="Buscar plantas, maceteros, tierra..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </header>

        <div className="cat-strip">
          {categories.map((c) => (
            <button
              key={c.id}
              className={`cat ${catId === c.id ? "active" : ""}`}
              onClick={() => setCatId(prev => prev === c.id ? null : c.id)}
              title={c.name}
            >
              <span className="cat-ic">🪴</span>
              <span className="cat-tx">{c.name}</span>
            </button>
          ))}
        </div>

        <div className="grid-products">
          {filtered.map((p) => (
            <button key={p.id} className="prod" onClick={() => addToCart(p)}>
              <div className="pic">
                <img src={p.image?.startsWith("http") ? p.image : `${API_BASE}${p.image}`} alt={p.name} />
              </div>
              <div className="pname">{p.name}</div>
              <div className="pprice">{formatCLP(p.price)}</div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}

function formatCLP(n) {
  return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(n);
}
