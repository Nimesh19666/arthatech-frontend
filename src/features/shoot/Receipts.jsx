import { useCallback, useEffect, useRef, useState } from "react";
import * as shoot from "../../api/shoot";
import { Alert, Button } from "../../components/ui.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import { useToast } from "../../components/Toast.jsx";
import { errorText, fieldError } from "../../lib/errors.js";
import { formatPaise } from "../../lib/money.js";
import { PAY_MODES } from "./format";

const TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX = 10 * 1024 * 1024;
const EMPTY = { team: "", name: "", description: "", vendor: "", quantity: "", amount: "", pay_mode: "cash_voucher", remarks: "", date: "" };
const payLabel = (v) => PAY_MODES.find((m) => m.value === v)?.label || v;

/** "250.5" -> 25050, no floats. Returns null when empty, NaN when invalid. */
export function toPaise(text) {
  const t = String(text ?? "").trim();
  if (!t) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return NaN;
  const [r, p = ""] = t.split(".");
  return Number(r) * 100 + Number((p + "00").slice(0, 2));
}
const size = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** Bills for one shoot day: upload, list, delete. Needs a connection. */
export default function Receipts({ dayId, teams, canChange, offline, scope, entryId, onChanged }) {
  // scope: undefined = every bill of the day, "day" = whole-day bills only, a team id = that team's bills only
  const fixed = scope !== undefined || entryId !== undefined;
  const confirm = useConfirm();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [f, setF] = useState(EMPTY);
  const [ferr, setFerr] = useState("");
  const [serverErr, setServerErr] = useState(null);
  const pick = useRef(null);
  const cam = useRef(null);

  const load = useCallback(async () => {
    try {
      setList(await shoot.receipts(dayId));
      onChanged?.();
      setErr("");
    } catch (e) {
      setErr(errorText(e));
    }
  }, [dayId]);

  useEffect(() => {
    if (!offline) load();
  }, [load, offline]);

  function choose(file0) {
    setServerErr(null);
    if (!file0) return;
    if (!TYPES.includes(file0.type)) return setFerr("Only PDF, JPG or PNG files can be uploaded."), setFile(null);
    if (file0.size > MAX) return setFerr("The file is bigger than 10 MB."), setFile(null);
    setFerr("");
    setFile(file0);
  }

  async function upload() {
    if (!file) return;
    const paise = toPaise(f.amount);
    if (Number.isNaN(paise)) return setFerr("Amount: type rupees like 250 or 250.50.");
    const form = new FormData();
    form.append("file", file);
    if (entryId !== undefined) form.append("work_entry_id", String(entryId));
    else {
      const tid = typeof scope === "number" ? scope : fixed ? "" : f.team;
      if (tid) form.append("team_id", String(tid));
    }
    for (const k of ["name", "description", "vendor", "quantity", "remarks"]) if (f[k].trim()) form.append(k, f[k].trim());
    form.append("pay_mode", f.pay_mode);
    if (paise != null) form.append("amount_paise", String(paise));
    if (f.date) form.append("receipt_date", f.date);
    setBusy(true);
    setFerr("");
    setServerErr(null);
    try {
      await shoot.uploadReceipt(dayId, form);
      setFile(null);
      setF(EMPTY);
      toast.success("Bill uploaded.");
      await load();
    } catch (e) {
      setServerErr(e);
      setFerr(fieldError(e, "file") || errorText(e));
      if (e.status === 400) load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(r) {
    if (!(await confirm({ title: `Delete ${r.file_name}?`, message: "The file is removed for good.", confirmLabel: "Delete" }))) return;
    try {
      await shoot.deleteReceipt(r.id);
      toast.success("Bill deleted.");
      await load();
    } catch (e) {
      setErr(errorText(e));
    }
  }

  let shown = null;
  const teamName = (id) => teams.find((t) => t.team_id === id)?.name;
  const lab = "mb-1 block text-xs font-semibold uppercase tracking-wide text-ink/50";
  const inp = "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-brand";

  if (offline)
    return <p className="p-4 text-sm text-ink/60">Bills need a connection. Connect to the internet to see or add them.</p>;

  return (
    <div className="space-y-4 p-4">
      <Alert>{err}</Alert>

      {canChange && (
        <div className="space-y-3 rounded-xl border border-line bg-mist/40 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input ref={pick} type="file" hidden accept="application/pdf,image/jpeg,image/png" onChange={(e) => { choose(e.target.files[0]); e.target.value = ""; }} />
            <input ref={cam} type="file" hidden accept="image/*" capture="environment" onChange={(e) => { choose(e.target.files[0]); e.target.value = ""; }} />
            <Button type="button" variant="outline" onClick={() => pick.current?.click()}>Choose file</Button>
            <Button type="button" variant="outline" onClick={() => cam.current?.click()}>Take photo</Button>
            <span className="min-w-0 flex-1 truncate text-sm text-ink/60">{file ? `${file.name} · ${size(file.size)}` : "PDF, JPG or PNG, up to 10 MB"}</span>
          </div>
          {file && (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {!fixed && (
                <label className="block"><span className={lab}>Team</span>
                  <select className={inp} value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}>
                    <option value="">Whole day</option>
                    {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
                  </select>
                </label>
              )}
              {[["name", "Name", 150], ["description", "Description", 300], ["vendor", "Vendor", 100], ["quantity", "Quantity", 30]].map(([k, l, m]) => (
                <label key={k} className="block"><span className={lab}>{l}</span>
                  <input className={inp} maxLength={m} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
                  {fieldError(serverErr, k) && <span className="mt-1 block text-xs font-medium text-red-700">{fieldError(serverErr, k)}</span>}
                </label>
              ))}
              <label className="block"><span className={lab}>Amount (₹)</span>
                <input className={inp} inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
                {fieldError(serverErr, "amount_paise") && <span className="mt-1 block text-xs font-medium text-red-700">{fieldError(serverErr, "amount_paise")}</span>}
              </label>
              <label className="block"><span className={lab}>Paid by</span>
                <select className={inp} value={f.pay_mode} onChange={(e) => setF({ ...f, pay_mode: e.target.value })}>
                  {PAY_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                {fieldError(serverErr, "pay_mode") && <span className="mt-1 block text-xs font-medium text-red-700">{fieldError(serverErr, "pay_mode")}</span>}
              </label>
              <label className="block"><span className={lab}>Remarks</span>
                <input className={inp} maxLength={300} value={f.remarks} onChange={(e) => setF({ ...f, remarks: e.target.value })} />
              </label>
              <label className="block"><span className={lab}>Date</span>
                <input type="date" className={inp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
                {fieldError(serverErr, "receipt_date") && <span className="mt-1 block text-xs font-medium text-red-700">{fieldError(serverErr, "receipt_date")}</span>}
              </label>
            </div>
          )}
          {ferr && <p className="text-sm font-semibold text-red-700" role="alert">{ferr}</p>}
          {serverErr && fieldError(serverErr, "team_id") && <p className="text-sm font-semibold text-red-700">{fieldError(serverErr, "team_id")}</p>}
          {file && (
            <Button type="button" onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload bill"}</Button>
          )}
        </div>
      )}

      {(shown = list && (!fixed ? list : list.filter((r) => (entryId !== undefined ? r.work_entry_id === entryId : scope === "day" ? !r.team_id && !r.work_entry_id : r.team_id === scope && !r.work_entry_id)))) && null}
      {list === null ? (
        <p className="text-sm text-ink/50">Loading bills…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink/55">{entryId !== undefined ? "No bills for this person." : scope === "day" ? "No whole-day bills yet." : typeof scope === "number" ? "No bills for this team." : "No bills uploaded for this day."}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => { /* links last 5 minutes: fetch fresh ones on click */ e.preventDefault(); shoot.receipts(dayId).then((l) => { setList(l); const n = l.find((x) => x.id === r.id); window.open((n || r).url, "_blank", "noopener"); }).catch(() => window.open(r.url, "_blank", "noopener")); }} className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-mist text-xs font-black text-brand">
                {r.content_type?.startsWith("image/") ? <img src={r.url} alt="" className="h-full w-full object-cover" onError={load} /> : "PDF"}
              </a>
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-bold">{[r.name, r.description].filter(Boolean).join(" · ") || r.file_name}</p>
                <p className="break-words text-xs text-ink/55">
                  {[r.vendor, r.quantity, r.amount_paise ? formatPaise(r.amount_paise) : null, payLabel(r.pay_mode), r.remarks, r.receipt_date].filter(Boolean).join(" · ")}
                </p>
                <p className="truncate text-xs text-ink/40">
                  {[r.file_name, size(r.file_size), r.work_entry_id ? "Person bill" : r.team_id ? teamName(r.team_id) : "Whole day"].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canChange && <button type="button" aria-label={`Delete ${r.file_name}`} onClick={() => remove(r)} className="cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-red-700 hover:bg-red-50">Delete</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
