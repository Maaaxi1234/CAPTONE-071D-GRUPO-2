import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
  const { isAuth } = useAuth();
  if (!isAuth) return <Navigate to="/login" replace />;
  return children;
}
