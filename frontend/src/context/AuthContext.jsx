import { createContext, useContext, useState, useEffect, useCallback } from "react";
import axios from "axios";

// ── Axios instance ────────────────────────────────────────────
// withCredentials: true → sends the httpOnly cookie on every request.
// All auth API calls go through this instance.

const api = axios.create({
  baseURL:         `${import.meta.env.VITE_API_URL ?? "http://localhost:3000"}/api`,
  withCredentials: true,
});

// ── Context ───────────────────────────────────────────────────

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);  // true until /me resolves

  // Called once on mount and after OAuth redirects land on the frontend.
  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);          // 401 = not authenticated, that's fine
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMe(); }, [fetchMe]);

  // ── Local auth ───────────────────────────────────────────────

  const signup = async (name, email, password) => {
    const { data } = await api.post("/auth/signup", { name, email, password });
    setUser(data.user);
    return data.user;
  };

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setUser(null);
  };

  // ── OAuth ─────────────────────────────────────────────────────
  // Full-page redirect to the backend — passport handles the rest.
  // After a successful OAuth flow the backend redirects to /dashboard
  // with the JWT cookie set; fetchMe() is called by the dashboard page.

  const loginWithGoogle = () => {
    window.location.href = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/auth/google`;
  };

  const loginWithGithub = () => {
    window.location.href = `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/api/auth/github`;
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signup, login, logout, loginWithGoogle, loginWithGithub, fetchMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};