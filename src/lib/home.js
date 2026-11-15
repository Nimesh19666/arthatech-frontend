/** Where a role starts inside its project */
export const homeFor = (p) =>
  ["auditor", "head_auditor"].includes(p?.role_code) && p?.project_id ? `/projects/${p.project_id}/shoot-days` : p?.project_id ? `/projects/${p.project_id}` : "/";
