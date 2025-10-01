import { useEffect, useMemo, useState } from "react";
import api from "../services/api";
import "../styles/inventory.css";

export default function Inventario() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm());

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  function blankForm() {
    return {
      // campos del producto
      manualId: "",      // ⬅️ NUEVO (solo para crear)
      name: "",
      price: "",
      stock: "",
      sku: "",
      barcode: "",
      image: "",
      category_id: "",
      track: true,
      tax19: true,
    };
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/api/categories/").catch(() => ({ data: [] })),
      api.get("/api/products/").catch(() => ({ data: [] })),
    ])
      .then(([c, p]) => {
        setCategories(c.data || []);
        setProducts(p.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const grouped = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = products.filter((p) => {
      const byQ =
        !term ||
        (p.name || "").toLowerCase().includes(term) ||
        (p.sku || "").toLowerCase().includes(term) ||
        (p.barcode || "").toLowerCase().includes(term);
      const low = !lowOnly || (Number(p.stock) || 0) <= 5;
      return byQ && low;
    });

    const map = new Map();
    for (const c of categories) map.set(c.id, { category: c, items: [] });
    map.set("__none__", { category: { id: "__none__", name: "Sin categoría" }, items: [] });

    for (const p of list) {
      const cid = p.category?.id ?? p.category ?? "__none__";
      if (!map.has(cid)) map.set(cid, { category: { id: cid, name: "Otra" }, items: [] });
      map.get(cid).items.push(p);
    }
    for (const v of map.values()) v.items.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return Array.from(map.values());
  }, [products, categories, q, lowOnly]);

  function openCreate(prefCatId = "") {
    setEditing(null);
    setForm({ ...blankForm(), category_id: prefCatId || "" });
    setShowNewCat(false);
    setNewCatName("");
    setOpen(true);
  }
  function openEdit(p) {
    setEditing(p);
    setForm({
      manualId: "", // no mostramos id al editar
      name: p.name || "",
      price: p.price ?? "",
      stock: p.stock ?? "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      image: p.image || "",
      category_id: p.category?.id ?? p.category ?? "",
      track: true,
      tax19: true,
    });
    setShowNewCat(false);
    setNewCatName("");
    setOpen(true);
  }
  function closeModal() {
    setOpen(false);
    setEditing(null);
    setForm(blankForm());
    setShowNewCat(false);
    setNewCatName("");
  }

  function payloadForCreate(f) {
    const payload = {
      // 'id' va solo si lo escribes
      name: (f.name || "").trim(),
      price: Number(f.price || 0),
      stock: Number(f.stock || 0),
      sku: (f.sku || "").trim(),
      barcode: (f.barcode || "").trim() || null,
      image: (f.image || "").trim() || null,
      category_id: f.category_id ? Number(f.category_id) : null,
    };
    const manualId = (f.manualId || "").trim();
    if (manualId) payload.id = manualId;  // ⬅️ si lo pones, se envía
    return payload;
  }

  function payloadForUpdate(f) {
    return {
      name: (f.name || "").trim(),
      price: Number(f.price || 0),
      stock: Number(f.stock || 0),
      sku: (f.sku || "").trim(),
      barcode: (f.barcode || "").trim() || null,
      image: (f.image || "").trim() || null,
      category_id: f.category_id ? Number(f.category_id) : null,
    };
  }

  async function save() {
    if (!form.category_id) return alert("Selecciona una categoría (o crea una con “+ Nueva”).");
    if (!form.name.trim()) return alert("El nombre es obligatorio.");
    if (!String(form.price).trim()) return alert("El precio es obligatorio.");
    if (!form.sku.trim()) return alert("El SKU es obligatorio.");

    try {
      if (editing) {
        const payload = payloadForUpdate(form);
        const { data } = await api.patch(`/api/products/${editing.id}/`, payload);
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? data : p)));
      } else {
        const payload = payloadForCreate(form);
        const { data } = await api.post(`/api/products/`, payload);
        setProducts((prev) => [data, ...prev]);
      }
      closeModal();
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data || e?.message || "Error";
      console.error("Save product error:", status, detail);
      alert(`No se pudo guardar el producto.\nStatus: ${status}\n${JSON.stringify(detail)}`);
    }
  }

  async function remove(id) {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await api.delete(`/api/products/${id}/`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert("No se pudo eliminar.");
      console.error(e);
    }
  }

  async function adjStock(p, delta) {
    try {
      const newStock = Math.max(0, (Number(p.stock) || 0) + delta);
      const { data } = await api.patch(`/api/products/${p.id}/`, {
        stock: newStock,
        category_id: p.category?.id ?? p.category,
      });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? data : x)));
    } catch (e) {
      console.error(e);
      alert("No se pudo actualizar el stock.");
    }
  }

  async function quickAddCategory() {
    const name = (newCatName || "").trim();
    if (name.length < 2) return alert("Escribe un nombre de categoría.");
    try {
      const { data } = await api.post("/api/categories/", { name });
      setCategories((prev) => [...prev, data]);
      setForm((f) => ({ ...f, category_id: data.id }));
      setShowNewCat(false);
      setNewCatName("");
    } catch (e) {
      const status = e?.response?.status;
      const detail = e?.response?.data || e?.message || "Error";
      console.error("Create category error:", status, detail);
      alert(`No se pudo crear la categoría.\nStatus: ${status}\n${JSON.stringify(detail)}`);
    }
  }

  return (
    <div className="inv-wrap">
      <header className="inv-bar">
        <div className="left">
          <h1>Inventario</h1>
          <span className="muted">Plantas y accesorios</span>
        </div>
        <div className="right">
          <input
            className="inp search"
            placeholder="Buscar por nombre, SKU o código de barras…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="chk">
            <input type="checkbox" checked={lowOnly} onChange={(e) => setLowOnly(e.target.checked)} />
            Stock bajo (≤5)
          </label>
          <button className="btn primary" onClick={() => openCreate()}>Nuevo</button>
        </div>
      </header>

      <section className="inv-board">
        {loading && <div className="loading">Cargando…</div>}

        {!loading && grouped.map(({ category, items }) => (
          <div key={category.id} className="inv-col">
            <div className="col-head">
              <div className="title">{category.name}</div>
              <div className="count">{items.length}</div>
              <button className="mini" title="Añadir en esta categoría" onClick={() => openCreate(category.id)}>＋</button>
            </div>

            <div className="col-body">
              {items.map((p) => (
                <article key={p.id} className="prod-card">
                  <header className="pc-head">
                    <div className="pc-name" title={p.name}>{p.name}</div>
                    <div className="pc-sku">{p.sku || "—"}</div>
                  </header>

                  <div className="pc-main">
                    <div className="pc-img">
                      {p.image ? <img src={p.image} alt={p.name} /> : <div className="ph">🪴</div>}
                    </div>
                    <div className="pc-info">
                      <div className="price">{formatCLP(p.price ?? 0)}</div>
                      <div className="tax">19% IVA</div>
                      <div className="stock">A la mano: <strong>{p.stock ?? 0}</strong> Unidades</div>

                      <div className="stock-ops">
                        <button className="chip" onClick={() => adjStock(p, +1)}>+1</button>
                        <button className="chip" onClick={() => adjStock(p, +5)}>+5</button>
                        <button className="chip ghost" onClick={() => adjStock(p, -1)}>-1</button>
                      </div>
                    </div>
                  </div>

                  <footer className="pc-actions">
                    <button className="btn" onClick={() => openEdit(p)}>Editar</button>
                    <button className="btn danger" onClick={() => remove(p.id)}>Eliminar</button>
                  </footer>
                </article>
              ))}

              {!items.length && <div className="empty-col">Sin productos</div>}
            </div>
          </div>
        ))}
      </section>

      {open && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3>{editing ? "Editar producto" : "Nuevo producto"}</h3>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <label>
                  <span>Producto</span>
                  <input
                    className="inp"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Ej: Monstera deliciosa mediana"
                  />
                </label>

                {/* ID opcional solo al crear */}
                {!editing && (
                  <label>
                    <span>ID (opcional)</span>
                    <input
                      className="inp"
                      value={form.manualId}
                      onChange={(e) => setForm({ ...form, manualId: e.target.value })}
                      placeholder="Si lo dejas vacío se genera automáticamente"
                    />
                  </label>
                )}

                <label>
                  <span>Categoría</span>
                  <div className="cat-row">
                    <select
                      className="inp"
                      value={form.category_id ?? ""}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    >
                      <option value="">— Selecciona —</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn mini"
                      title="Nueva categoría"
                      onClick={() => { setShowNewCat((s) => !s); setNewCatName(""); }}
                    >
                      + Nueva
                    </button>
                  </div>

                  {showNewCat && (
                    <div className="inline-create">
                      <input
                        className="inp"
                        placeholder='Escribe el nombre (ej. "Suculentas")'
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                      />
                      <button type="button" className="btn primary mini" onClick={quickAddCategory}>
                        Crear “{(newCatName || "").trim() || "…"}”
                      </button>
                      <button type="button" className="btn ghost mini" onClick={() => { setShowNewCat(false); setNewCatName(""); }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </label>

                <label>
                  <span>Precio de venta</span>
                  <input
                    className="inp right"
                    type="number"
                    min="0"
                    step="100"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                  />
                </label>

                <label>
                  <span>Stock</span>
                  <input
                    className="inp right"
                    type="number"
                    min="0"
                    step="1"
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  />
                </label>

                <label>
                  <span>SKU</span>
                  <input
                    className="inp"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                    placeholder="Ej: MON-MED-01"
                  />
                </label>

                <label>
                  <span>Código de barras</span>
                  <input
                    className="inp"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="EAN/UPC"
                  />
                </label>

                <label className="col-span-2">
                  <span>URL de imagen</span>
                  <input
                    className="inp"
                    value={form.image}
                    onChange={(e) => setForm({ ...form, image: e.target.value })}
                    placeholder="https://…"
                  />
                </label>

                <label className="row">
                  <input
                    type="checkbox"
                    checked={form.track}
                    onChange={(e) => setForm({ ...form, track: e.target.checked })}
                  />
                  Rastrear inventario
                </label>

                <label className="row">
                  <input
                    type="checkbox"
                    checked={form.tax19}
                    onChange={(e) => setForm({ ...form, tax19: e.target.checked })}
                  />
                  Impuesto de ventas 19% IVA
                </label>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn ghost" onClick={closeModal}>Cancelar</button>
              <button className="btn primary" onClick={save}>{editing ? "Guardar" : "Crear"}</button>
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
