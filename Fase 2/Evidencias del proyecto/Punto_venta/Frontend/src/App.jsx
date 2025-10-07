import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import ProtectedRoute from "./routes/ProtectedRoute";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Shop from "./pages/Shop";
import ShopSuccess from "./pages/ShopSuccess";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Inventario from "./pages/Inventario";

// --- RoleGate: permite el paso solo si el rol del usuario está dentro de "allow"
function getStoredRole() {
  // prioriza localStorage si hay sesión persistente; si no, sessionStorage
  return (
    localStorage.getItem("role") ||
    sessionStorage.getItem("role") ||
    null
  );
}
function RoleGate({ allow = [], children }) {
  const role = getStoredRole();

  // Si no hay rol aún, dejamos que ProtectedRoute decida (redirigirá a /login si no hay token)
  if (!role) return children;

  // Si es admin, siempre puede pasar
  if (role === "admin") return children;

  // Si el rol está en la lista permitida, ok
  if (allow.includes(role)) return children;

  // Si no tiene permiso, 403
  return <Navigate to="/403" replace />;
}

function Forbidden() {
  return (
    <div style={{ maxWidth: 480, margin: "4rem auto", textAlign: "center" }}>
      <h1>403</h1>
      <p>No tienes permisos para acceder a esta página.</p>
      <a href="/">Volver al inicio</a>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/shop" element={
              <ProtectedRoute>
                <RoleGate allow={["vendedor"]}>
                  <Shop />
                </RoleGate>
              </ProtectedRoute>
            } />
            <Route path="/shop/success" element={
              <ProtectedRoute>
                <RoleGate allow={["vendedor"]}>
                  <ShopSuccess />
                </RoleGate>
              </ProtectedRoute>
            } />

            {/* Privadas con guard de rol */}
            <Route
              path="/inventario"
              element={
                <ProtectedRoute>
                  <RoleGate allow={["bodeguero"]}>
                    <Inventario />
                  </RoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <ProtectedRoute>
                  <RoleGate allow={["vendedor"]}>
                    <Orders />
                  </RoleGate>
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute>
                  <RoleGate allow={["vendedor"]}>
                    <OrderDetail />
                  </RoleGate>
                </ProtectedRoute>
              }
            />

            {/* Dashboard solo admin */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RoleGate allow={[] /* vacío = solo admin pasa */}>
                    <Dashboard />
                  </RoleGate>
                </ProtectedRoute>
              }
            />

            {/* 403 */}
            <Route path="/403" element={<Forbidden />} />

            {/* Fallback */}
            <Route path="*" element={<Login />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
