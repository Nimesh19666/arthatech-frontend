import { useCallback, useEffect, useState } from "react";
import * as auditApi from "../api/audit";
import { Alert, Button } from "../components/ui.jsx";
import { TableRowsSkeleton } from "../components/Skeleton.jsx";
import { errorText } from "../lib/errors.js";
import { fmtDateTime } from "../lib/projectMeta.js";

const LIMIT = 50;
const TARGETS = ["user", "profile", "organisation", "project", "team", "member"];

const show = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : String(v));

/** Raw key / value pairs, because the details are different for every action */
function Details({ value }) {
  const entries = value ? Object.entries(value) : [];
  if (entries.length === 0) return <span className="text-ink/35">—</span>;
  return (
    <dl className="space-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="shrink-0 font-semibold text-ink/50">{k}</dt>
          <dd className="min-w-0 break-words">{show(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function AuditLogPage() {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [action, setAction] = useState("");
  const [target, setTarget] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = auditApi.normalizeAudit(
        await auditApi.listAudit({ action: action.trim(), target_type: target, date_from: from, date_to: to, limit: LIMIT, offset })
      );
      setRows(res.rows);
      setTotal(res.total);
      setError(null);
    } catch (e) {
      setError(e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [action, target, from, to, offset]);

  // Wait a little while the person types
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  // A new filter means start again from page 1
  const filter = (setter) => (e) => {
    setter(e.target.value);
    setOffset(0);
  };

  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + LIMIT, total);
  const notBuilt = error && error.status === 404;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Platform</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm text-ink/60">Who did what, and when. Newest first.</p>
        </div>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      {notBuilt ? (
        <Alert>The audit log was not found on the server. Ask your backend developer to check the address.</Alert>
      ) : (
        <Alert>{error && errorText(error)}</Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input className="input" placeholder="Action, e.g. login or user.created" value={action} onChange={filter(setAction)} />
        <select className="input" value={target} onChange={filter(setTarget)}>
          <option value="">Everything</option>
          {TARGETS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input className="input" type="date" value={from} onChange={filter(setFrom)} aria-label="From date" />
        <input className="input" type="date" value={to} onChange={filter(setTo)} aria-label="To date" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink/45">
              <th className="px-4 py-3 font-bold">When</th>
              <th className="px-4 py-3 font-bold">Who</th>
              <th className="px-4 py-3 font-bold">Action</th>
              <th className="px-4 py-3 font-bold">On</th>
              <th className="px-4 py-3 font-bold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line align-top">
            {loading && <TableRowsSkeleton cols={5} />}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink/50">
                  No entries found.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r) => (
                <tr key={r.key}>
                  <td className="whitespace-nowrap px-4 py-3 text-ink/70">{fmtDateTime(r.when)}</td>
                  <td className="px-4 py-3">
                    <p className={`font-semibold ${r.who === "Deleted user" ? "italic text-ink/60" : ""}`}>{r.who}</p>
                    {r.whoEmail && r.whoEmail !== r.who && <p className="text-xs text-ink/50">{r.whoEmail}</p>}
                    {(r.role || r.org) && <p className="text-xs text-ink/40">{[r.role, r.org].filter(Boolean).join(" · ")}</p>}
                  </td>
                  <td className="px-4 py-3 font-semibold">{r.action || "—"}</td>
                  <td className="px-4 py-3 text-ink/70">{r.target || "—"}</td>
                  <td className="px-4 py-3">
                    <Details value={r.details} />
                    {r.ip && <p className="mt-1 text-xs text-ink/40">IP {r.ip}</p>}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink/50">{total > 0 ? `Showing ${first}–${last} of ${total}` : ""}</p>
        <div className="flex gap-2">
          <Button variant="outline" className="!py-2" disabled={offset === 0 || loading} onClick={() => setOffset(Math.max(0, offset - LIMIT))}>
            ← Previous
          </Button>
          <Button variant="outline" className="!py-2" disabled={offset + LIMIT >= total || loading} onClick={() => setOffset(offset + LIMIT)}>
            Next →
          </Button>
        </div>
      </div>
    </div>
  );
}
