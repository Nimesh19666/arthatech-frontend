import { api } from "./client";

// ASSUMPTION: your API list has no audit endpoint yet. This calls GET /audit-logs.
// When the backend adds it, change AUDIT_PATH below if the address is different.
export const AUDIT_PATH = "/auth/audit-logs";

export const listAudit = () => api(AUDIT_PATH);

const text = (v) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  return v.email || v.full_name || v.name || v.code || JSON.stringify(v);
};

/** Reads common field names, so small differences in the backend response still work. */
export function normalizeAudit(data) {
  const list = Array.isArray(data) ? data : data?.results || data?.logs || data?.data || [];
  return list.map((e, i) => ({
    key: e.id ?? i,
    when: e.created_at ?? e.timestamp ?? e.at ?? e.time ?? e.date ?? null,
    who: text(e.actor_email ?? e.actor ?? e.user_email ?? e.user ?? e.performed_by) || "System",
    role: text(e.actor_role ?? e.role),
    action: text(e.action ?? e.event ?? e.event_type ?? e.verb),
    target: [text(e.target ?? e.object ?? e.entity ?? e.model ?? e.object_type), text(e.object_id ?? e.target_id)]
      .filter(Boolean)
      .join(" #"),
    detail: e.detail ?? e.details ?? e.message ?? e.description ?? e.changes ?? e.metadata ?? null,
    ip: text(e.ip ?? e.ip_address),
    raw: e,
  }));
}
