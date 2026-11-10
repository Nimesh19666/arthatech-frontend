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
  pending: { label: "Pending", tone: "neutral" },
  query_raised: { label: "Query raised", tone: "red" },
  verified: { label: "Verified", tone: "dark" },
};
export const PAY_MODES = [
  { value: "cash_voucher", label: "Cash voucher" },
  { value: "online", label: "Online" },
];
