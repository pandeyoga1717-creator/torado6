import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { unwrap, unwrapError } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    const token = localStorage.getItem("aurora_access_token");
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get("/auth/me")
      .then((res) => setUser(unwrap(res)))
      .catch(() => {
        localStorage.removeItem("aurora_access_token");
        localStorage.removeItem("aurora_refresh_token");
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      const res = await api.post("/auth/login", { email, password });
      const data = unwrap(res);
      localStorage.setItem("aurora_access_token", data.access_token);
      localStorage.setItem("aurora_refresh_token", data.refresh_token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: unwrapError(e) };
    }
  }, []);

  const logout = useCallback(async () => {
    const rt = localStorage.getItem("aurora_refresh_token");
    try {
      await api.post("/auth/logout", rt ? { refresh_token: rt } : null);
    } catch (e) {
      // ignore
    }
    localStorage.removeItem("aurora_access_token");
    localStorage.removeItem("aurora_refresh_token");
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const res = await api.get("/auth/me");
      setUser(unwrap(res));
    } catch (e) {
      // ignore
    }
  }, []);

  const can = useCallback(
    (perm) => {
      if (!user) return false;
      const perms = user.permissions || [];
      if (perms.includes("*")) return true;
      return perms.includes(perm);
    },
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshMe, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
