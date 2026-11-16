import { useCallback, useEffect, useRef, useState } from "react";
import * as shoot from "../../api/shoot";
import { Alert, Button } from "../../components/ui.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import { useToast } from "../../components/Toast.jsx";
import { errorText, fieldError } from "../../lib/errors.js";
import { formatPaise } from "../../lib/money.js";

const TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX = 10 * 1024 * 1024;

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
export default function Receipts({ dayId, teams, canChange, offline, scope }) {
  // scope: undefined = every bill of the day, "day" = whole-day bills only, a team id = that team's bills only
  const fixed = scope !== undefined;
  const confirm = useConfirm();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [f, setF] = useState({ team: "", description: "", amount: "", date: "" });
  const [ferr, setFerr] = useState("");
  const [serverErr, setServerErr] = useState(null);
  const pick = useRef(null);
  const cam = useRef(null);

  const load = useCallback(async () => {
    try {
      setList(await shoot.receipts(dayId));
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
    const tid = typeof scope === "number" ? scope : fixed ? "" : f.team;
    if (tid) form.append("team_id", String(tid));
    if (f.description.trim()) form.append("description", f.description.trim());
    if (paise != null) form.append("amount_paise", String(paise));
    if (f.date) form.append("receipt_date", f.date);
    setBusy(true);
    setFerr("");
    setServerErr(null);
    try {
      await shoot.uploadReceipt(dayId, form);
      setFile(null);
      setF({ team: "", description: "", amount: "", date: "" });
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
              {!fixed && <select aria-label="Team" className={inp} value={f.team} onChange={(e) => setF({ ...f, team: e.target.value })}>
                <option value="">Whole day</option>
                {teams.map((t) => <option key={t.team_id} value={t.team_id}>{t.name}</option>)}
              </select>}
              <input aria-label="Description" className={inp} maxLength={300} placeholder="What is it for?" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
              <input aria-label="Amount in rupees" className={inp} inputMode="decimal" placeholder="Amount ₹" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
              <input aria-label="Bill date" type="date" className={inp} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </div>
          )}
          {ferr && <p className="text-sm font-semibold text-red-700" role="alert">{ferr}</p>}
          {serverErr && fieldError(serverErr, "team_id") && <p className="text-sm font-semibold text-red-700">{fieldError(serverErr, "team_id")}</p>}
          {file && (
            <Button type="button" onClick={upload} disabled={busy}>{busy ? "Uploading…" : "Upload bill"}</Button>
          )}
        </div>
      )}

      {(shown = list && (!fixed ? list : list.filter((r) => (scope === "day" ? !r.team_id : r.team_id === scope)))) && null}
      {list === null ? (
        <p className="text-sm text-ink/50">Loading bills…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm text-ink/55">{scope === "day" ? "No whole-day bills yet." : typeof scope === "number" ? "No bills for this team." : "No bills uploaded for this day."}</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line bg-white">
          {shown.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3">
              <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => { /* links last 5 minutes: fetch fresh ones on click */ e.preventDefault(); shoot.receipts(dayId).then((l) => { setList(l); const n = l.find((x) => x.id === r.id); window.open((n || r).url, "_blank", "noopener"); }).catch(() => window.open(r.url, "_blank", "noopener")); }} className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-mist text-xs font-black text-brand">
                {r.content_type?.startsWith("image/") ? <img src={r.url} alt="" className="h-full w-full object-cover" onError={load} /> : "PDF"}
              </a>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{r.file_name}</p>
                <p className="truncate text-xs text-ink/55">
                  {[size(r.file_size), r.team_id ? teamName(r.team_id) : "Whole day", r.amount_paise ? formatPaise(r.amount_paise) : null, r.receipt_date, r.description].filter(Boolean).join(" · ")}
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
