export const hhmm = (s) => (s ? String(s).slice(0, 5) : "");
export const withSec = (s) => (s && String(s).length === 5 ? `${s}:00` : s || null);
export const paiseToRupees = (p) => (p === null || p === undefined || p === "" ? "" : String(p / 100));

export function fdate(s) {
  if (!s) return "No date";
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
}

/** Only used for a quick estimate while offline. The server's number replaces it once saved. */
export function hoursBetween(a, b) {
  if (!a || !b) return null;
  const [h1, m1] = a.split(":").map(Number);
  const [h2, m2] = b.split(":").map(Number);
  let m = h2 * 60 + m2 - (h1 * 60 + m1);
  if (m < 0) m += 1440;
  return Math.round((m / 60) * 100) / 100;
}
export function fmtHours(h) {
  if (h === null || h === undefined) return "—";
  const m = Math.round(Number(h) * 60);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

export const AUDIT = {
  draft: { label: "Draft", tone: "neutral" },
  submitted: { label: "Submitted", tone: "dark" },
  recheck: { label: "Recheck", tone: "red" },
  approved: { label: "Approved", tone: "dark" },
  rejected: { label: "Rejected", tone: "red" },
};
/** Only these can be edited. Everything else is locked. */
export const EDITABLE = ["draft", "recheck"];
export const isEditable = (status) => !status || EDITABLE.includes(status);
export const PAY_MODES = [
  { value: "cash_voucher", label: "Cash voucher" },
  { value: "vendor_bill", label: "Vendor bill" },
  { value: "online", label: "Online" },
  { value: "credit", label: "Credit" },
];
