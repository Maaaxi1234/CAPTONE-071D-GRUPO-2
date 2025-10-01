import axios from "axios";

// Usa tu backend; si tienes VITE_API_BASE en .env, lo toma.
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false,
});

// ---- Helpers de tokens en localStorage ----
function getAccess() {
  return localStorage.getItem("access");
}
function getRefresh() {
  return localStorage.getItem("refresh");
}
function setTokens({ access, refresh }) {
  if (access) localStorage.setItem("access", access);
  if (refresh) localStorage.setItem("refresh", refresh);
}
function clearTokens() {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
}

// Exporto para que AuthContext pueda setear/limpiar tokens
export const setAuthTokens = setTokens;
export const clearAuthTokens = clearTokens;

// ---- Interceptor de request: agrega Authorization ----
api.interceptors.request.use((config) => {
  const access = getAccess();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// ---- Manejo de refresh concurrente ----
let isRefreshing = false;
let refreshPromise = null;
const subscribers = [];

function onRefreshed(newAccess) {
  subscribers.forEach((cb) => cb(newAccess));
  subscribers.length = 0;
}
function addSubscriber(cb) {
  subscribers.push(cb);
}

// ---- Interceptor de response: intenta refresh en 401 ----
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { response, config } = error;
    if (!response) return Promise.reject(error);

    // No intentamos reintento si no es 401 o ya es reintento
    if (response.status !== 401 || config.__isRetryRequest) {
      return Promise.reject(error);
    }

    const refresh = getRefresh();
    if (!refresh) {
      // no hay refresh: cerrar sesión arriba
      return Promise.reject(error);
    }

    // disparamos el refresh (una sola vez)
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = axios
        .post(`${API_BASE}/api/token/refresh/`, { refresh })
        .then((res) => {
          const newAccess = res.data.access;
          setTokens({ access: newAccess, refresh });
          isRefreshing = false;
          onRefreshed(newAccess);
          return newAccess;
        })
        .catch((err) => {
          isRefreshing = false;
          clearTokens();
          onRefreshed(null);
          throw err;
        });
    }

    // encolamos este request para cuando termine el refresh
    const retryOrigReq = new Promise((resolve, reject) => {
      addSubscriber((newAccess) => {
        if (!newAccess) {
          reject(error);
          return;
        }
        const newCfg = { ...config };
        newCfg.__isRetryRequest = true;
        newCfg.headers = { ...(newCfg.headers || {}), Authorization: `Bearer ${newAccess}` };
        resolve(api(newCfg));
      });
    });

    // esperamos a que el refresh termine (si ya estaba en curso no lanza 2 veces)
    await refreshPromise.catch(() => {});
    return retryOrigReq;
  }
);

export default api;
