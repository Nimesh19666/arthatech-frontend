// Shared project labels and form definition, used by the house and project pages.

export const TYPES = [
  { value: "movie", label: "Movie" },
  { value: "ott_series", label: "OTT series" },
  { value: "ad", label: "Ad" },
  { value: "other", label: "Other" },
];

export const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "wrapped", label: "Wrapped" },
  { value: "closed", label: "Closed" },
];

export const label = (list, value) => list.find((x) => x.value === value)?.label || value || "—";

export const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const fmtDateTime = (s) =>
  s
    ? new Date(s).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export const PROJECT_FIELDS = [
  { name: "name", label: "Project name", required: true },
  { name: "project_type", label: "Type", as: "select", options: TYPES, required: true },
  { name: "status", label: "Status", as: "select", options: STATUSES },
  { name: "start_date", label: "Start date", type: "date" },
  { name: "end_date", label: "End date", type: "date" },
];

/** Send only the fields that have a value */
export function projectToBody(v) {
  const body = { name: v.name.trim(), project_type: v.project_type };
  if (v.status) body.status = v.status;
  if (v.start_date) body.start_date = v.start_date;
  if (v.end_date) body.end_date = v.end_date;
  return body;
}
