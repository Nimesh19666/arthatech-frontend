import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../../api/auth";
import { clearTokens, getRefreshToken, hasSession, markExpired, setAuthLostHandler, setTokens } from "../../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // status: "loading" | "authed" | "anon"
  const [state, setState] = useState({ status: "loading", me: null });

  const loadMe = useCallback(async () => {
    const me = await authApi.me();
    setState({ status: "authed", me });
    return me;
  }, []);

  // On app start: if a session exists, try to restore it (the client refreshes if needed).
  useEffect(() => {
    setAuthLostHandler(() => setState({ status: "anon", me: null }));
    if (!hasSession()) {
      setState({ status: "anon", me: null });
      return;
    }
    loadMe().catch(() => {
      clearTokens();
      markExpired();
      setState({ status: "anon", me: null });
    });
  }, [loadMe]);

  /** Call after select-profile returns { status: "ok", access, refresh } */
  const signIn = useCallback(
    async ({ access, refresh }) => {
      setTokens(access, refresh);
      return loadMe();
    },
    [loadMe]
  );

  /** Returns the server reply. If status is "otp_required", ask for the code and call again with it. */
  const switchProfile = useCallback(
    async (profileId, otp) => {
      const res = await authApi.switchProfile(getRefreshToken(), profileId, otp);
      if (res.status === "otp_required") return res;
      setTokens(res.access, res.refresh);
      await loadMe();
      return res;
    },
    [loadMe]
  );

  /** Change password returns new tokens; all old ones stop working. */
  const changePassword = useCallback(async (oldPassword, newPassword) => {
    const res = await authApi.changePassword(oldPassword, newPassword);
    if (res?.access && res?.refresh) setTokens(res.access, res.refresh);
    return res;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout(getRefreshToken());
    } catch {
      /* sign out locally even if the server call fails */
    }
    clearTokens();
    setState({ status: "anon", me: null });
  }, []);

  const value = useMemo(() => {
    const me = state.me;
    const permissions = me?.permissions || [];
    const roleCode = me?.profile?.role_code;
    // Super Admin passes every check by role_code. The server always checks too.
    const can = (code) => roleCode === "super_admin" || permissions.includes(code);
    return {
      status: state.status,
      me,
      user: me?.user || null,
      profile: me?.profile || null,
      otherProfiles: me?.other_profiles || [],
      permissions,
      can,
      signIn,
      switchProfile,
      changePassword,
      logout,
    };
  }, [state, signIn, switchProfile, changePassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
