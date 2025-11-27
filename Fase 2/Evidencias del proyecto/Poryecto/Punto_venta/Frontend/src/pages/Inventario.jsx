import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api, { API_BASE } from "../services/api";
import "../styles/inventory.css";


const DEFAULT_RIEGO_DIAS = 3;
const DEFAULT_VIDA_UTIL_DIAS = 30;
const ALERT_TYPE_LABELS = {
  RIEGO: "Riego atrasado",
  VIDA_UTIL: "Vida util excedida",
  SOBRESTOCK: "Sobrestock",
  RIESGO_ALTO: "Riesgo climatico alto",
  CALOR: "Temperatura alta",
  FRIO: "Temperatura baja",
};
const ALERT_LEVEL_LABELS = {
  INFO: "Informacion",
  ADVERTENCIA: "Advertencia",
  CRITICO: "Critico",
};
const ALERT_LEVEL_COLORS = {
  INFO: "#0f766e",
  ADVERTENCIA: "#f97316",
  CRITICO: "#dc2626",
};
const ALERT_REFRESH_MS = 3_600_000;

export default function Inventario() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const [q, setQ] = useState("");
  const [lowOnly, setLowOnly] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm());

  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");

function blankForm() {
    return {
      isPlant: false,
      manualId: "",
      name: "",
      price: "",
      stock: "",
      sku: "",
      barcode: "",
      image: "",
      category_id: "",
      track: true,
      tax19: true,
      discount_pct: 0,
      frecuencia_riego_dias: DEFAULT_RIEGO_DIAS,
      vida_util_dias: DEFAULT_VIDA_UTIL_DIAS,
      sensibilidad_climatica: "",
      sensibilidad_calor: "",
      sensibilidad_frio: "",
      temp_max_segura: "",
      temp_min_segura: "",
      requiere_alerta_calor: false,
      fecha_ingreso: "",
      ultima_fecha_riego: "",
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

  const fetchAlerts = useCallback(() => {
    setAlertsLoading(true);
    api
      .get("/api/alerts/?resuelta=false")
      .then((res) => setAlerts(res.data || []))
      .catch(() => setAlerts([]))
      .finally(() => setAlertsLoading(false));
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    const id = setInterval(() => fetchAlerts(), ALERT_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const alertsByProduct = useMemo(() => {
    const map = new Map();
    for (const alerta of alerts || []) {
      const pid = alerta?.producto?.id ?? alerta?.producto_id ?? alerta?.producto ?? null;
      if (!pid) continue;
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid).push(alerta);
    }
    return map;
  }, [alerts]);

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
    map.set("__none__", { category: { id: "__none__", name: "Sin categoria" }, items: [] });

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
    setFile(null);
    setPreview("");
    setShowNewCat(false);
    setNewCatName("");
    setOpen(true);
  }

  function openEdit(p) {
    const detectedPlant = Boolean(
      (p.frecuencia_riego_dias ?? "") !== "" ||
      (p.vida_util_dias ?? "") !== "" ||
      (p.sensibilidad_climatica ?? "") !== "" ||
      p.ultima_fecha_riego
    );
    setEditing(p);
    setForm({
      isPlant: detectedPlant,
      manualId: "",
      name: p.name || "",
      price: p.price ?? "",
      stock: p.stock ?? "",
      sku: p.sku || "",
      barcode: p.barcode || "",
      image: p.image || "",
      category_id: p.category?.id ?? p.category ?? "",
      track: true,
      tax19: true,
      discount_pct: p.discount_pct ?? 0,
      frecuencia_riego_dias: p.frecuencia_riego_dias ?? "",
      vida_util_dias: p.vida_util_dias ?? "",
      sensibilidad_climatica: p.sensibilidad_climatica ?? "",
      sensibilidad_calor: p.sensibilidad_calor ?? "",
      sensibilidad_frio: p.sensibilidad_frio ?? "",
      temp_max_segura: p.temp_max_segura ?? "",
      temp_min_segura: p.temp_min_segura ?? "",
      requiere_alerta_calor: Boolean(p.requiere_alerta_calor),
      fecha_ingreso: p.fecha_ingreso ? p.fecha_ingreso.slice(0, 10) : "",
      ultima_fecha_riego: p.ultima_fecha_riego || "",
    });
    setFile(null);
    setPreview(p.image ? imgUrl(p.image) : "");
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
    setFile(null);
    setPreview("");
  }

  function imgUrl(src) {
    if (!src) return "";
    return src.startsWith("http") ? src : `${API_BASE}${src}`;
  }

  function buildFormData(f, isEdit) {
    const fd = new FormData();
    if (!isEdit && (f.manualId || "").trim()) fd.append("id", f.manualId.trim());
    fd.append("name", (f.name || "").trim());
    fd.append("price", String(Number(f.price || 0)));
    fd.append("stock", String(Number(f.stock || 0)));
    fd.append("sku", (f.sku || "").trim());
    if ((f.barcode || "").trim()) fd.append("barcode", f.barcode.trim());
    fd.append("category_id", String(f.category_id));
    fd.append("discount_pct", String(Math.min(40, Math.max(0, Number(f.discount_pct || 0)))));
    if (file) fd.append("image", file);
    if (f.isPlant && f.frecuencia_riego_dias !== "" && f.frecuencia_riego_dias !== null) {
      fd.append("frecuencia_riego_dias", String(f.frecuencia_riego_dias));
    }
    if (f.vida_util_dias !== "" && f.vida_util_dias !== null) {
      fd.append("vida_util_dias", String(f.vida_util_dias));
    }
    if (f.isPlant && (f.sensibilidad_climatica || "").trim()) {
      fd.append("sensibilidad_climatica", f.sensibilidad_climatica.trim());
    }
    if (f.isPlant && (f.sensibilidad_calor || "").trim()) {
      fd.append("sensibilidad_calor", f.sensibilidad_calor.trim());
    }
    if (f.isPlant && (f.sensibilidad_frio || "").trim()) {
      fd.append("sensibilidad_frio", f.sensibilidad_frio.trim());
    }
    if (f.isPlant && f.temp_max_segura !== "" && f.temp_max_segura !== null) {
      fd.append("temp_max_segura", String(f.temp_max_segura));
    }
    if (f.isPlant && f.temp_min_segura !== "" && f.temp_min_segura !== null) {
      fd.append("temp_min_segura", String(f.temp_min_segura));
    }
    fd.append("requiere_alerta_calor", f.isPlant && f.requiere_alerta_calor ? "true" : "false");
    if ((f.fecha_ingreso || "").trim()) {
      fd.append("fecha_ingreso", `${f.fecha_ingreso}T00:00:00`);
    }
    return fd;
  }

  async function save() {
    if (!form.category_id) return alert("Selecciona una categoria.");
    if (!form.name.trim()) return alert("El nombre es obligatorio.");
    if (!String(form.price).trim()) return alert("El precio es obligatorio.");
    if (!form.sku.trim()) return alert("El SKU es obligatorio.");

    try {
      if (editing) {
        const fd = buildFormData(form, true);
        const { data } = await api.patch(`/api/products/${editing.id}/`, fd);
        setProducts((prev) => prev.map((p) => (p.id === editing.id ? data : p)));
      } else {
        const fd = buildFormData(form, false);
        const { data } = await api.post(`/api/products/`, fd);
        setProducts((prev) => [data, ...prev]);
      }
      closeModal();
      fetchAlerts();
    } catch (e) {
      console.error(e?.response?.data || e);
      alert("No se pudo guardar el producto.");
    }
  }

  async function remove(id) {
    if (!confirm("Eliminar este producto?")) return;
    try {
      await api.delete(`/api/products/${id}/`);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      fetchAlerts();
    } catch (e) {
      const msg =
        e?.response?.data?.detail ||
        e?.response?.data?.error ||
        "No se pudo eliminar.";
      alert(msg);
    }
  }

  async function adjStock(p, delta) {
    try {
      const newStock = Math.max(0, (Number(p.stock) || 0) + delta);
      const fd = new FormData();
      fd.append("stock", String(newStock));
      if (p.category?.id ?? p.category) {
        fd.append("category_id", p.category?.id ?? p.category);
      }
      const { data } = await api.patch(`/api/products/${p.id}/`, fd);
      setProducts((prev) => prev.map((x) => (x.id === p.id ? data : x)));
      fetchAlerts();
    } catch {
      alert("No se pudo actualizar el stock.");
    }
  }

  async function quickAddCategory() {
    const name = (newCatName || "").trim();
    if (name.length < 2) return alert("Escribe un nombre de categoria.");
    try {
      const { data } = await api.post("/api/categories/", { name });
      setCategories((prev) => [...prev, data]);
      setForm((f) => ({ ...f, category_id: data.id }));
      setShowNewCat(false);
      setNewCatName("");
    } catch {
      alert("No se pudo crear la categoria.");
    }
  }

  async function marcarRiego(p) {
    try {
      await api.post(`/api/products/${p.id}/regar/`, {});
      const nowIso = new Date().toISOString();
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, ultima_fecha_riego: nowIso } : x))
      );
      fetchAlerts();
    } catch (e) {
      console.error(e?.response?.data || e);
      alert("No se pudo registrar el riego.");
    }
  }

  async function extenderVida(p) {
    if (!confirm("Extender vida util para este producto?")) return;
    try {
      const { data } = await api.post(`/api/products/${p.id}/extender-vida/`, {});
      setProducts((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, ...data } : x))
      );
      fetchAlerts();
    } catch (e) {
      console.error(e?.response?.data || e);
      alert("No se pudo extender la vida util.");
    }
  }

  return (
    <div className="page-plantitas dashboard-page inv-root inventory-page">
      <header className="dash-header inventory-head">
        <div className="brand">
          <div className="brand-logo" />
          <div>
            <h1 className="brand-title">Inventario</h1>
            <div className="brand-sub">Plantas y accesorios</div>
          </div>
        </div>
        <div className="inventory-controls">
          <input
            className="inp search"
            placeholder="Buscar por nombre, SKU o codigo de barras..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <label className="chk">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(e) => setLowOnly(e.target.checked)}
            />
            Stock bajo (&lt;=5)
          </label>
        </div>
        <div className="header-actions">
          <button className="btn solid accent" onClick={() => openCreate()}>
            + Nuevo
          </button>
          <Link className="btn ghost accent" to="/">
            Volver al panel
          </Link>
        </div>
      </header>

      <section className="alerts-panel">
        <div className="alerts-head">
          
          <button className="btn mini" onClick={fetchAlerts} disabled={alertsLoading}>
            {alertsLoading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        {alertsLoading && <div className="loading">Consultando alertas...</div>}

        {!alertsLoading && !alerts.length && (
          <div className="empty-col">No hay alertas pendientes. Buen trabajo!</div>
        )}

        {!alertsLoading && alerts.length > 0 && (
          <div className="alerts-grid">
            {alerts.map((alerta) => {
              const nivel = alerta.nivel || "INFO";
              const tipoLabel = ALERT_TYPE_LABELS[alerta.tipo] || alerta.tipo;
              const nivelLabel = ALERT_LEVEL_LABELS[nivel] || nivel;
              const accent = ALERT_LEVEL_COLORS[nivel] || "#0f172a";
              return (
                <article
                  key={alerta.id}
                  className={`alert-card alert-${nivel.toLowerCase()}`}
                  style={{ borderLeft: `4px solid ${accent}` }}
                >
                  <header>
                    <span className="alert-type">
                      {tipoLabel} [{nivelLabel}]
                    </span>
                    <span className="alert-product">
                      {alerta.producto?.name || "Producto"}
                    </span>
                  </header>
                  <p>{alerta.mensaje}</p>
                  <small>{formatDate(alerta.fecha_creacion)}</small>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="inv-board">
        {loading && <div className="loading">Cargando...</div>}

        {!loading &&
          grouped.map(({ category, items }) => (
            <div key={category.id} className="inv-col">
              <div className="col-head">
                <div className="title">{category.name}</div>
                <div className="count">{items.length}</div>
                <button className="mini" onClick={() => openCreate(category.id)}>
                  +
                </button>
              </div>

              <div className="col-body">
                {items.map((p) => {
                  const frecuencia = p.frecuencia_riego_dias ?? DEFAULT_RIEGO_DIAS;
                  const vidaUtil = p.vida_util_dias ?? DEFAULT_VIDA_UTIL_DIAS;
                  const sensibilidad = p.sensibilidad_climatica || "Sin dato";
                  const productAlerts = alertsByProduct.get(p.id) || [];
                  const isPlant = Boolean(
                    (p.frecuencia_riego_dias ?? "") !== "" ||
                    (p.sensibilidad_climatica ?? "") !== "" ||
                    p.ultima_fecha_riego
                  );
                  return (
                    <article key={p.id} className="prod-card">
                      <header className="pc-head">
                        <div className="pc-name">{p.name}</div>
                        <div className="pc-sku">{p.sku || "--"}</div>
                      </header>

                      <div className="pc-main">
                        <div className="pc-img">
                          {p.image ? (
                            <img src={imgUrl(p.image)} alt={p.name} />
                          ) : (
                            <div className="ph">IMG</div>
                          )}
                        </div>
                        <div className="pc-info">
                          <div className="price">{formatCLP(p.price ?? 0)}</div>
                          <div className="tax">19% IVA</div>
                          <div className="stock">
                            A la mano: <strong>{p.stock ?? 0}</strong> unidades
                          </div>
                          <div className="stock-ops">
                            <button className="chip" onClick={() => adjStock(p, +1)}>+1</button>
                            <button className="chip" onClick={() => adjStock(p, +5)}>+5</button>
                            <button className="chip ghost" onClick={() => adjStock(p, -1)}>-1</button>
                          </div>
                          {isPlant && (
                            <div className="care-info">
                              <div>Riego cada <strong>{frecuencia}</strong> dias</div>
                              <div>Ultimo riego: {formatDate(p.ultima_fecha_riego)}</div>
                              <div>Vida util comercial: {vidaUtil} dias</div>
                              <div>Sensibilidad: {sensibilidad}</div>
                              <div>Ingreso: {formatDate(p.fecha_ingreso)}</div>
                            </div>
                          )}
                          {!isPlant && (
                            <div className="care-info">
                              <div>Vida util comercial: {vidaUtil} dias</div>
                              <div>Ingreso: {formatDate(p.fecha_ingreso)}</div>
                            </div>
                          )}
                          {isPlant && productAlerts.length > 0 && (
                            <div className="product-alert-badges">
                              {productAlerts.map((alerta) => {
                                const tipoLabel = ALERT_TYPE_LABELS[alerta.tipo] || alerta.tipo;
                                const nivelLabel = ALERT_LEVEL_LABELS[alerta.nivel] || alerta.nivel;
                                const badgeClass = alerta.tipo === "RIEGO" ? "badge badge-riego" : "badge";
                                return (
                                  <span
                                    key={alerta.id}
                                    className={badgeClass}
                                    title={nivelLabel ? `${tipoLabel} (${nivelLabel})` : tipoLabel}
                                  >
                                    {tipoLabel}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {isPlant && (
                        <div className="care-actions">
                          <button className="btn mini care-water" onClick={() => marcarRiego(p)}>
                            Marcar riego
                          </button>
                          <button className="btn mini ghost" onClick={() => extenderVida(p)}>
                            Extender vida util
                          </button>
                        </div>
                      )}

                      <footer className="pc-actions">
                        <button className="btn" onClick={() => openEdit(p)}>Editar</button>
                        <button className="btn danger" onClick={() => remove(p.id)}>Eliminar</button>
                      </footer>
                    </article>
                  );
                })}

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
              <div className="type-toggle">
                <span>Tipo de producto:</span>
                <div className="btn-group">
                  <button
                    type="button"
                    className={`chip ${form.isPlant ? "active" : ""}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        isPlant: true,
                        frecuencia_riego_dias: f.frecuencia_riego_dias || DEFAULT_RIEGO_DIAS,
                        vida_util_dias: f.vida_util_dias || DEFAULT_VIDA_UTIL_DIAS,
                      }))
                    }
                  >
                    Planta
                  </button>
                  <button
                    type="button"
                    className={`chip ${!form.isPlant ? "active" : ""}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        isPlant: false,
                        frecuencia_riego_dias: "",
                        sensibilidad_climatica: "",
                        ultima_fecha_riego: "",
                      }))
                    }
                  >
                    Otro
                  </button>
                </div>
              </div>

              <div className="form-grid">
                <label>
                  <span>Producto</span>
                  <input
                    className="inp"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </label>

                {!editing && (
                  <label>
                    <span>ID (opcional)</span>
                    <input
                      className="inp"
                      value={form.manualId}
                      onChange={(e) => setForm({ ...form, manualId: e.target.value })}
                    />
                  </label>
                )}

                <label>
                  <span>Categoria</span>
                  <div className="cat-row">
                    <select
                      className="inp"
                      value={form.category_id ?? ""}
                      onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                    >
                      <option value="">- Selecciona -</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn mini"
                      onClick={() => { setShowNewCat((s) => !s); setNewCatName(""); }}
                    >
                      + Nueva
                    </button>
                  </div>

                  {showNewCat && (
                    <div className="inline-create">
                      <input
                        className="inp"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                      />
                      <button type="button" className="btn primary mini" onClick={quickAddCategory}>
                        Crear
                      </button>
                      <button
                        type="button"
                        className="btn ghost mini"
                        onClick={() => {
                          setShowNewCat(false);
                          setNewCatName("");
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </label>

                <label>
                  <span>Precio</span>
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
                  <span>Descuento (%)</span>
                  <select
                    className="inp"
                    value={String(form.discount_pct ?? 0)}
                    onChange={(e) => setForm({ ...form, discount_pct: Number(e.target.value) })}
                  >
                    {[0, 5, 10, 15, 20, 25, 30, 35, 40].map((pct) => (
                      <option key={pct} value={String(pct)}>
                        -{pct}%
                      </option>
                    ))}
                  </select>
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
                  />
                </label>

                <label>
                  <span>Codigo de barras</span>
                  <input
                    className="inp"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  />
                </label>

                {form.isPlant && (
                  <label>
                    <span>Frecuencia de riego (dias)</span>
                    <input
                      className="inp right"
                      type="number"
                      min="0"
                      value={form.frecuencia_riego_dias}
                      onChange={(e) => setForm({ ...form, frecuencia_riego_dias: e.target.value })}
                    />
                  </label>
                )}

                <label>
                  <span>Vida util comercial (dias)</span>
                  <input
                    className="inp right"
                    type="number"
                    min="0"
                    value={form.vida_util_dias}
                    onChange={(e) => setForm({ ...form, vida_util_dias: e.target.value })}
                  />
                </label>

                {form.isPlant && (
                  <label>
                    <span>Sensibilidad climatica</span>
                    <select
                      className="inp"
                      value={form.sensibilidad_climatica}
                      onChange={(e) => setForm({ ...form, sensibilidad_climatica: e.target.value })}
                    >
                      <option value="">- Selecciona -</option>
                      <option value="BAJA">Baja</option>
                      <option value="MEDIA">Media</option>
                      <option value="ALTA">Alta</option>
                    </select>
                  </label>
                )}

                {form.isPlant && (
                  <>
                    <label>
                      <span>Sensibilidad al calor</span>
                      <select
                        className="inp"
                        value={form.sensibilidad_calor}
                        onChange={(e) => setForm({ ...form, sensibilidad_calor: e.target.value })}
                      >
                        <option value="">- Selecciona -</option>
                        <option value="BAJA">Baja</option>
                        <option value="MEDIA">Media</option>
                        <option value="ALTA">Alta</option>
                      </select>
                    </label>

                    <label>
                      <span>Sensibilidad al frío</span>
                      <select
                        className="inp"
                        value={form.sensibilidad_frio}
                        onChange={(e) => setForm({ ...form, sensibilidad_frio: e.target.value })}
                      >
                        <option value="">- Selecciona -</option>
                        <option value="BAJA">Baja</option>
                        <option value="MEDIA">Media</option>
                        <option value="ALTA">Alta</option>
                      </select>
                    </label>

                    <label>
                      <span>Temperatura máxima segura (°C)</span>
                      <input
                        className="inp right"
                        type="number"
                        step="0.1"
                        value={form.temp_max_segura}
                        onChange={(e) => setForm({ ...form, temp_max_segura: e.target.value })}
                      />
                    </label>

                    <label>
                      <span>Temperatura mínima segura (°C)</span>
                      <input
                        className="inp right"
                        type="number"
                        step="0.1"
                        value={form.temp_min_segura}
                        onChange={(e) => setForm({ ...form, temp_min_segura: e.target.value })}
                      />
                    </label>

                    <label className="checkbox-card">
                      <input
                        type="checkbox"
                        checked={form.requiere_alerta_calor}
                        onChange={(e) => setForm({ ...form, requiere_alerta_calor: e.target.checked })}
                      />
                      <span>Activar alertas de temperatura</span>
                    </label>
                  </>
                )}

                <label>
                  <span>Fecha de ingreso</span>
                  <input
                    className="inp"
                    type="date"
                    value={form.fecha_ingreso}
                    onChange={(e) => setForm({ ...form, fecha_ingreso: e.target.value })}
                  />
                </label>

                {editing && form.isPlant && (
                  <label>
                    <span>Ultimo riego</span>
                    <input className="inp" value={formatDate(form.ultima_fecha_riego)} readOnly />
                  </label>
                )}

                <label className="col-span-2">
                  <span>Imagen</span>
                  <input
                    className="inp"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setFile(f);
                      setPreview(f ? URL.createObjectURL(f) : (form.image ? imgUrl(form.image) : ""));
                    }}
                  />
                  {preview ? (
                    <div style={{ marginTop: 8 }}>
                      <img src={preview} alt="preview" style={{ maxHeight: 120, borderRadius: 8 }} />
                    </div>
                  ) : null}
                </label>

                <div className="checkbox-row">
                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={form.track}
                      onChange={(e) => setForm({ ...form, track: e.target.checked })}
                    />
                    <span>Rastrear inventario</span>
                  </label>

                  <label className="checkbox-card">
                    <input
                      type="checkbox"
                      checked={form.tax19}
                      onChange={(e) => setForm({ ...form, tax19: e.target.checked })}
                    />
                    <span>Impuesto 19% IVA</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn primary" onClick={closeModal}>Cancelar</button>
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

function formatDate(value) {
  if (!value) return "--";
  try {
    return new Date(value).toLocaleDateString("es-CL");
  } catch {
    return value;
  }
}
