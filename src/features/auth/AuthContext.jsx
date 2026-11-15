import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as authApi from "../../api/auth";
import { setSyncUser } from "../../lib/outbox";
import * as idb from "../../lib/idb";
import * as shoot from "../../api/shoot";
import { clearTokens, getRefreshToken, hasSession, markExpired, setAuthLostHandler, setTokens } from "../../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // status: "loading" | "authed" | "anon"
  const [state, setState] = useState({ status: "loading", me: null });

  const loadMe = useCallback(async () => {
    try {
      const me = await authApi.me();
      setSyncUser(me?.user?.id ?? null, me?.profile?.profile_id);
      idb.kvSet("last-me", me);
      if (me?.profile?.profile_id) idb.kvSet(`me:${me.profile.profile_id}`, me);
      setState({ status: "authed", me });
      return me;
    } catch (e) {
      // Offline with a saved session: use the copy of "me" kept on this device
      if (e?.status === 0 && hasSession()) {
        const saved = await idb.kvGet("last-me");
        if (saved) {
          setSyncUser(saved?.user?.id ?? null, saved?.profile?.profile_id);
          setState({ status: "authed", me: saved });
          return saved;
        }
      }
      throw e;
    }
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
  const [switching, setSwitching] = useState(false);
  const switchProfile = useCallback(
    async (profileId, otp) => {
      setSwitching(true);
      try {
        // Read the saved copy of the target role while the server call is running
        const savedP = idb.kvGet(`me:${profileId}`).catch(() => null);
        const res = await authApi.switchProfile(getRefreshToken(), profileId, otp);
        if (res.status === "otp_required") return res;
        setTokens(res.access, res.refresh);
        const saved = await savedP;
        let fresh = null;
        if (saved?.profile) {
          // Show the new role at once, and refresh its permissions quietly
          setSyncUser(saved?.user?.id ?? null, saved?.profile?.profile_id);
          setState({ status: "authed", me: saved });
          loadMe().catch(() => {});
        } else {
          fresh = await loadMe();
        }
        // Start fetching the shoot days of the new project now, so the page is ready when it opens
        const pid = (saved || fresh)?.profile?.project_id;
        if (pid) shoot.listDays(pid, { reuse: true }).catch(() => {});
        return res;
      } finally {
        setSwitching(false);
      }
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
    setSyncUser(null);
    idb.kvDel("last-me");
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
      switching,
      changePassword,
      logout,
    };
  }, [state, switching, signIn, switchProfile, changePassword, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
