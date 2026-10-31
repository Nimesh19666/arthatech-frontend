// Money arrives from the API as whole paise (integers). 1 rupee = 100 paise.
// Never keep money as a decimal in state; convert only when showing it.

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

/** 1245000000 -> "₹1,24,50,000.00" (lakh/crore grouping) */
export function formatPaise(paise) {
  const n = Number(paise);
  if (paise === null || paise === undefined || Number.isNaN(n)) return "—";
  return inr.format(n / 100);
}

/** 1245000000 -> "₹1.25 Cr", 750000 -> "₹7,500.00", 25000000 -> "₹2.50 L" */
export function formatPaiseShort(paise) {
  const n = Number(paise);
  if (paise === null || paise === undefined || Number.isNaN(n)) return "—";
  const rupees = n / 100;
  const abs = Math.abs(rupees);
  const sign = rupees < 0 ? "-" : "";
  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  return formatPaise(paise);
}

/** Form input (rupees, as typed) -> whole paise to send to the API */
export function rupeesToPaise(value) {
  return Math.round(Number(value) * 100);
}
