import { api } from "./client";

// The server may serve this at /audit-logs or /auth/audit-logs. We try the first, then the second.
const PATHS = ["/audit-logs", "/auth/audit-logs"];
let working = null;

/** params: { action, target_type, date_from, date_to, user_id, limit, offset } */
export async function listAudit(params = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== "" && v !== null && v !== undefined) q.set(k, v);
  const qs = q.toString() ? `?${q}` : "";
  const order = working ? [working] : PATHS;
  let last;
  for (const path of order) {
    try {
      const res = await api(path + qs);
      working = path;
      return res;
    } catch (e) {
      last = e;
      if (e.status !== 404) throw e;
    }
  }
  throw last;
}

export const DELETED_EMAIL = /^deleted-\d+@deleted\.invalid$/;

/** Reads { total, limit, offset, results: [...] } */
export function normalizeAudit(data) {
  const list = Array.isArray(data) ? data : data?.results || [];
  const rows = list.map((e, i) => {
    const email = e.user?.email || "";
    const deleted = DELETED_EMAIL.test(email);
    return {
      key: e.id ?? i,
      when: e.created_at ?? null,
      who: deleted ? "Deleted user" : e.user?.full_name || email || "System",
      whoEmail: deleted ? "" : email,
      role: e.profile?.role_code || "",
      action: e.action || "",
      target: [e.target_type, e.target_id].filter((x) => x !== null && x !== undefined && x !== "").join(" #"),
      details: e.details && typeof e.details === "object" ? e.details : null,
      ip: e.ip_address || "",
      org: e.organisation?.name || "",
    };
  });
  return { rows, total: Array.isArray(data) ? rows.length : (data?.total ?? rows.length) };
}
