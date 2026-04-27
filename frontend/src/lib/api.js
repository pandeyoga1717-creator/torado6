import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API_BASE = `${BACKEND_URL}/api`;

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Attach token from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aurora_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auto-refresh on 401
let refreshPromise = null;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const code = error.response?.data?.errors?.[0]?.code;

    if (status === 401 && code === "TOKEN_EXPIRED" && !original._retry) {
      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const rt = localStorage.getItem("aurora_refresh_token");
            if (!rt) throw new Error("no refresh");
            const res = await axios.post(`${API_BASE}/auth/refresh`, {
              refresh_token: rt,
            });
            const newToken = res.data.data.access_token;
            localStorage.setItem("aurora_access_token", newToken);
            return newToken;
          })();
        }
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch (e) {
        refreshPromise = null;
        localStorage.removeItem("aurora_access_token");
        localStorage.removeItem("aurora_refresh_token");
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        throw e;
      }
    }
    throw error;
  },
);

export default api;

// Helper: extract data envelope
export const unwrap = (response) => response.data?.data ?? null;
export const unwrapWithMeta = (response) => ({
  data: response.data?.data ?? null,
  meta: response.data?.meta ?? null,
});
export const unwrapError = (e) => {
  const errs = e.response?.data?.errors;
  if (errs?.length) return errs[0].message;
  return e.message || "Network error";
};
