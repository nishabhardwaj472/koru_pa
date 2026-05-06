import { useCallback, useEffect, useState } from "react";
import * as authApi from "@/services/authApi";
import type { AuthUser } from "@/services/authApi";

/**
 * Real authentication hook backed by the Express/MongoDB backend.
 *
 * On mount:  reads the stored JWT → calls GET /api/auth/me to restore session.
 * signUp:    POST /api/auth/register → stores JWT → auto sign-in.
 * signIn:    POST /api/auth/login    → stores JWT → sets user state.
 * signOut:   removes JWT from localStorage → clears user state.
 */
export const useAuth = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Restore session on mount ───────────────────────────────────────────────
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const currentUser = await authApi.getMe();
        setUser(currentUser);
      } catch {
        // Token invalid or network error — treat as logged out
        authApi.removeToken();
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    void restoreSession();
  }, []);

  // ── Sign Up ────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    // Register on the backend (bcrypt hashing happens server-side)
    const { user: newUser } = await authApi.register(fullName, email, password);

    // Auto sign-in after successful registration
    const { user: loggedInUser } = await authApi.login(email, password);
    setUser(loggedInUser);

    return newUser;
  }, []);

  // ── Sign In ────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser } = await authApi.login(email, password);
    setUser(loggedInUser);
  }, []);

  // ── Reset Password (placeholder — wire to a real email service if needed) ──
  const resetPassword = useCallback(async (_email: string) => {
    // TODO: POST /api/auth/forgot-password when implemented on the backend
    await new Promise((r) => setTimeout(r, 300));
  }, []);

  // ── Sign Out ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    authApi.removeToken();
    setUser(null);
  }, []);

  return { user, loading, signUp, signIn, resetPassword, signOut };
};
