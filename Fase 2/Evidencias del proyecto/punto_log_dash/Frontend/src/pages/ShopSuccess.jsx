import { useSearchParams, Link } from "react-router-dom";

export default function ShopSuccess() {
  const [params] = useSearchParams();
  const code = params.get("code");
  return (
    <div className="shop-page">
      <div className="card" style={{maxWidth: 640, margin: "40px auto", padding: 20}}>
        <h2>¡Gracias por tu compra! 🌿</h2>
        {code && <p>Tu código de pedido es <strong>{code}</strong>.</p>}
        <p>Te contactaremos para coordinar la entrega.</p>
        <Link className="btn primary" to="/shop">Volver a la tienda</Link>
      </div>
    </div>
  );
}
