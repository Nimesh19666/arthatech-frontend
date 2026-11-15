import { formatPaise } from "./money.js";

/** "21:30:00" -> "21:30" */
export const hhmm = (t) => (t ? String(t).slice(0, 5) : "");

/** 2026-10-29 -> 29/10/2026 */
export function fdate(s) {
  if (!s) return "No date";
  const [y, m, d] = String(s).split("-");
  return `${d}/${m}/${y}`;
}

/** Paise from the API -> rupees text for an input box ("" when empty) */
export const paiseToInput = (p) => (p === null || p === undefined || p === "" ? "" : String(Number(p) / 100));

/** Rupees typed -> whole paise. Empty becomes 0. */
export const inputToPaise = (v) => (v === "" || v === null ? 0 : Math.round(Number(v) * 100));

export const AUDIT_STATUS = {
  draft: { label: "Draft", tone: "warn" },
  submitted: { label: "Submitted", tone: "warn" },
  recheck: { label: "Recheck", tone: "bad" },
  approved: { label: "Approved", tone: "good" },
  rejected: { label: "Rejected", tone: "bad" },
};

export const PAY_MODES = [
  { value: "cash_voucher", label: "Cash voucher" },
  { value: "vendor_bill", label: "Vendor bill" },
  { value: "online", label: "Online" },
  { value: "credit", label: "Credit" },
];
export const payModeLabel = (v) => PAY_MODES.find((m) => m.value === v)?.label || v || "—";

/**
 * Audit checks, worked out in the browser from the data on screen.
 * day = GET /shoot-days/<id>   tabs = { [day_team_id]: GET /day-teams/<id> }
 * Returns [{ tone: "warn" | "bad", text }]
 */
export function computeFlags(day, tabs) {
  const out = [];
  if (!day) return out;
  for (const row of day.teams || []) {
    const tab = tabs[row.day_team_id];
    if (!tab) continue;
    const t = tab.totals || {};
    const name = row.name;
    if (tab.team?.kind === "crew") {
      if (tab.declared_headcount !== null && tab.declared_headcount !== undefined && Number(tab.declared_headcount) !== Number(t.crew || 0)) {
        out.push({ tone: "warn", text: `${name}: expected count is ${tab.declared_headcount}, ${t.crew || 0} entered here.` });
      }
      const missing = (tab.entries || []).filter((e) => e.attendance === "present" && (!e.in_time || !e.out_time)).length;
      if (missing) out.push({ tone: "warn", text: `${name}: ${missing} present ${missing > 1 ? "people have" : "person has"} no time in or out.` });
    }
    const noBill = (tab.expenses || []).filter((e) => !e.has_bill && Number(e.amount_paise) > 0);
    if (noBill.length) {
      const total = noBill.reduce((a, e) => a + Number(e.amount_paise), 0);
      out.push({ tone: "warn", text: `${name}: ${noBill.length} expense${noBill.length > 1 ? "s" : ""} without a bill (${formatPaise(total)}).` });
    }
    const budget = Number(tab.day_budget_paise || 0);
    if (budget > 0 && Number(t.spent_paise || 0) > budget) {
      out.push({ tone: "bad", text: `${name}: spent ${formatPaise(t.spent_paise)} is over the team budget ${formatPaise(budget)}.` });
    }
  }
  const dt = day.totals || {};
  if (Number(dt.budget_paise) > 0 && Number(dt.spent_paise) > Number(dt.budget_paise)) {
    out.push({ tone: "bad", text: `Day spend ${formatPaise(dt.spent_paise)} is over the day budget ${formatPaise(dt.budget_paise)}.` });
  }
  return out;
}
