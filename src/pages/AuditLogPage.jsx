import { useEffect, useMemo, useState } from "react";
import * as auditApi from "../api/audit";
import { Alert, Button, Spinner } from "../components/ui.jsx";
import { CardsSkeleton, RowsSkeleton, TableRowsSkeleton } from "../components/Skeleton.jsx";
import { errorText } from "../lib/errors.js";
import { fmtDateTime } from "../lib/projectMeta.js";

function Detail({ value }) {
  if (value === null || value === undefined || value === "") return <span className="text-ink/35">—</span>;
  if (typeof value === "string" || typeof value === "number") return <span>{String(value)}</span>;
  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-semibold text-brand">View changes</summary>
      <pre className="mt-1 max-w-md overflow-auto rounded-lg bg-mist p-2">{JSON.stringify(value, null, 1)}</pre>
    </details>
  );
}

export default function AuditLogPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    try {
      setRows(auditApi.normalizeAudit(await auditApi.listAudit()));
      setError(null);
    } catch (e) {
      setError(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const actions = useMemo(() => [...new Set(rows.map((r) => r.action).filter(Boolean))].sort(), [rows]);

  const visible = rows.filter((r) => {
    if (action && r.action !== action) return false;
    if (from && (!r.when || new Date(r.when) < new Date(from))) return false;
    if (to && (!r.when || new Date(r.when) > new Date(`${to}T23:59:59`))) return false;
    if (q.trim()) {
      const hay = `${r.who} ${r.role} ${r.action} ${r.target} ${r.ip} ${JSON.stringify(r.detail ?? "")}`.toLowerCase();
      if (!hay.includes(q.trim().toLowerCase())) return false;
    }
    return true;
  });

  const notBuilt = error && (error.status === 404 || error.code === "not_found");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Platform</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm text-ink/60">Who did what, and when.</p>
        </div>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </div>

      {notBuilt ? (
        <div className="rounded-2xl border border-dashed border-ink/25 bg-white/70 p-8">
          <p className="text-lg font-extrabold">The audit log is not available on the server yet</p>
          <p className="mt-1 text-sm text-ink/65">
            This screen calls <code className="rounded bg-mist px-1.5 py-0.5">GET {auditApi.AUDIT_PATH}</code> and the server
            answered "not found". Ask your backend developer to add it. If the address is different, change{" "}
            <code className="rounded bg-mist px-1.5 py-0.5">AUDIT_PATH</code> in <code>src/api/audit.js</code>.
          </p>
        </div>
      ) : (
        <>
          <Alert>{error && errorText(error)}</Alert>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input className="input" placeholder="Search who, action, details…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">All actions</option>
              {actions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
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
                {loading && (
                  <TableRowsSkeleton cols={5} />
                )}
                {!loading && visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-ink/50">
                      No entries found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  visible.map((r) => (
                    <tr key={r.key}>
                      <td className="whitespace-nowrap px-4 py-3 text-ink/70">{fmtDateTime(r.when)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold">{r.who}</p>
                        {r.role && <p className="text-xs text-ink/50">{r.role}</p>}
                      </td>
                      <td className="px-4 py-3 font-semibold">{r.action || "—"}</td>
                      <td className="px-4 py-3 text-ink/70">{r.target || "—"}</td>
                      <td className="px-4 py-3">
                        <Detail value={r.detail} />
                        {r.ip && <p className="mt-1 text-xs text-ink/40">IP {r.ip}</p>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {!loading && <p className="text-xs text-ink/50">{visible.length} of {rows.length} entries</p>}
        </>
      )}
    </div>
  );
}
