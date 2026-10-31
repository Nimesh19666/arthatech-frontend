// Central API client: Bearer token, error format, refresh-once-and-retry.
// Never log tokens, codes or passwords.

const BASE = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api").replace(/\/$/, "");

const K_ACCESS = "arthatech_access";
const K_REFRESH = "arthatech_refresh";

// sessionStorage can throw (private mode, blocked storage), so always wrap it.
function read(key) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    if (value === null || value === undefined) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

let access = read(K_ACCESS);
let refresh = read(K_REFRESH);
let onAuthLost = () => {};

// Remember (for the login page) that the session ended by itself, not because the person logged out.
const K_EXPIRED = "arthatech_expired";
export const markExpired = () => write(K_EXPIRED, "1");
export function takeExpired() {
  const was = read(K_EXPIRED) === "1";
  if (was) write(K_EXPIRED, null);
  return was;
}

export const setAuthLostHandler = (fn) => {
  onAuthLost = fn;
};
export const hasSession = () => Boolean(access || refresh);
export const getRefreshToken = () => refresh;

export function setTokens(newAccess, newRefresh) {
  access = newAccess ?? null;
  refresh = newRefresh ?? null;
  write(K_ACCESS, access);
  write(K_REFRESH, refresh);
}
export const clearTokens = () => setTokens(null, null);

export class ApiError extends Error {
  constructor(status, code, message, fields = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

async function send(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth && access) headers.Authorization = `Bearer ${access}`;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server.");
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const err = data && data.error;
    throw new ApiError(
      res.status,
      (err && err.code) || "server_error",
      (err && err.message) || "Something went wrong.",
      (err && err.fields) || {}
    );
  }
  return data;
}

// Many calls can fail at once when the access token expires. Share one refresh.
let refreshing = null;
function refreshTokens() {
  if (!refresh) return Promise.reject(new ApiError(401, "token_invalid", "Session ended."));
  if (!refreshing) {
    refreshing = send("/auth/token/refresh", { method: "POST", body: { refresh }, auth: false })
      .then((d) => {
        // The old refresh token is now dead. Always save the new pair.
        setTokens(d.access, d.refresh);
      })
      .catch((e) => {
        clearTokens();
        markExpired();
        onAuthLost();
        throw e;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

export async function api(path, opts = {}) {
  try {
    return await send(path, opts);
  } catch (e) {
    const expired =
      opts.auth !== false &&
      e instanceof ApiError &&
      e.status === 401 &&
      (e.code === "token_invalid" || e.code === "not_authenticated");
    if (expired && refresh) {
      await refreshTokens(); // throws (and logs out) if refresh fails
      return send(path, opts); // retry once
    }
    throw e;
  }
}
