import { useState } from "react";
import * as shoot from "../../api/shoot";
import { Alert, Button, Modal } from "../../components/ui.jsx";
import { errorText, fieldError } from "../../lib/errors.js";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // local calendar, never UTC
const parse = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Day, Week (Monday to Sunday) or Month around one date */
export function rangeFor(mode, date) {
  const d = parse(date);
  if (mode === "week") {
    const mon = addDays(d, -((d.getDay() + 6) % 7));
    return [iso(mon), iso(addDays(mon, 6))];
  }
  if (mode === "month") return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
  return [date, date];
}
const nice = (s) => parse(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const MODES = [["day", "Day"], ["week", "Week"], ["month", "Month"], ["custom", "Custom"]];

export default function ReportModal({ projectId, onClose }) {
  const today = iso(new Date());
  const [mode, setMode] = useState("day");
  const [date, setDate] = useState(today);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [a, b] = mode === "custom" ? [from, to] : rangeFor(mode, date);
  const days = a && b ? Math.round((parse(b) - parse(a)) / 86400000) + 1 : 0;
  const problem = !a || !b ? "Pick the dates." : days < 1 ? "The end date is before the start date." : days > 92 ? "Pick at most 92 days at a time." : "";

  async function go() {
    if (problem) return setErr({ message: problem });
    setBusy(true);
    setErr(null);
    try {
      const { blob, filename } = await shoot.reportXlsx(projectId, a, b, approved);
      const url = URL.createObjectURL(blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = filename || `report-shoot-days-${a}-to-${b}.xlsx`;
      document.body.appendChild(el);
      el.click();
      el.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      onClose();
    } catch (e) {
      setErr(e);
    } finally {
      setBusy(false);
    }
  }

  const inp = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand";
  return (
    <Modal title="Download Excel report" onClose={busy ? undefined : onClose}>
      <div className="space-y-4">
        {err && <Alert>{fieldError(err, "date_from") || fieldError(err, "date_to") || (err.fields ? errorText(err) : err.message)}</Alert>}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Report period">
          {MODES.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} onClick={() => setMode(k)} className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold ${mode === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70 hover:border-ink"}`}>{l}</button>
          ))}
        </div>
        {mode === "custom" ? (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink/50">From</span><input type="date" className={inp} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink/50">To</span><input type="date" className={inp} value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
        ) : (
          <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink/50">{mode === "day" ? "Date" : mode === "week" ? "Any date in the week" : "Any date in the month"}</span><input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} /></label>
        )}
        <p className="rounded-lg bg-mist/60 p-3 text-sm">
          {problem ? <span className="font-semibold text-red-700">{problem}</span> : <>Report for <b>{a === b ? nice(a) : `${nice(a)} to ${nice(b)}`}</b> · {days} day{days === 1 ? "" : "s"}</>}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /> Approved days only
        </label>
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="button" className="flex-1" loading={busy} disabled={Boolean(problem)} onClick={go}>{busy ? "Preparing…" : "Download"}</Button>
        </div>
      </div>
    </Modal>
  );
}
