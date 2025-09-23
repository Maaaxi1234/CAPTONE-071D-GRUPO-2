import { createContext, useContext, useState, useMemo } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [access, setAccess] = useState(localStorage.getItem("access"));
  const [refresh, setRefresh] = useState(localStorage.getItem("refresh"));

  const login = async (username, password) => {
    const { data } = await api.post("/api/token/", { username, password });
    localStorage.setItem("access", data.access);
    localStorage.setItem("refresh", data.refresh);
    setAccess(data.access);
    setRefresh(data.refresh);
  };

  const logout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    setAccess(null);
    setRefresh(null);
  };

  const value = useMemo(
    () => ({ access, refresh, isAuth: !!access, login, logout }),
    [access, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
