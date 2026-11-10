import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import * as shoot from "../api/shoot";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { AUDIT, fdate } from "../features/shoot/format";
import { cacheKey } from "../features/shoot/useShootDay";
import { Alert, Badge, Button } from "../components/ui.jsx";
import FormModal from "../components/FormModal.jsx";
import { CardsSkeleton } from "../components/Skeleton.jsx";
import { useSyncStatus } from "../components/SyncBadge.jsx";
import { errorText } from "../lib/errors.js";
import * as idb from "../lib/idb";
import { formatPaiseShort } from "../lib/money.js";

const today = () => new Date().toISOString().slice(0, 10);

export default function ShootDaysPage() {
  const { projectId } = useParams();
  const state = useLocation().state || {};
  const navigate = useNavigate();
  const { can } = useAuth();
  const sync = useSyncStatus();
  const [days, setDays] = useState(null);
  const [error, setError] = useState(null);
  const [cached, setCached] = useState(false);
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("all");

  const fresh = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    const key = cacheKey(`days:${projectId}`);
    setRefreshing(true);
    // Saved list first, so the screen is not empty while the server answers
    idb.kvGet(key).then((saved) => {
      if (saved && !fresh.current) setDays(saved);
    });
    try {
      const list = await shoot.listDays(projectId);
      fresh.current = true;
      setRefreshing(false);
      setDays(list);
      setCached(false);
      setError(null);
      idb.kvSet(key, list);
    } catch (e) {
      setRefreshing(false);
      const saved = e.status === 0 ? await idb.kvGet(key) : null;
      if (saved) {
        setDays(saved);
        setCached(true);
      } else setError(e);
    }
  }, [projectId]);

  useEffect(() => {
    fresh.current = false;
    load();
  }, [load]);

  // Start fetching a day when the pointer or finger reaches its card, so it is ready when clicked
  const warmed = useRef(new Set());
  const warm = (id) => {
    if (warmed.current.has(id) || !sync.online) return;
    warmed.current.add(id);
    const k = cacheKey(`day:${id}`);
    shoot.getDay(id).then(async (day) => {
      if (!(await idb.kvGet(k))) idb.kvSet(k, { day, tabs: {}, members: {} });
    }).catch(() => warmed.current.delete(id));
  };

  const all = days || [];
  const count = (s) => all.filter((d) => d.audit_status === s).length;
  const list = filter === "all" ? all : all.filter((d) => d.audit_status === filter);
  const sum = (f) => all.reduce((a, d) => a + (Number(f(d.totals || {})) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand">{state.name || "Project"}</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Shoot days</h1>
          {refreshing && days && <p className="mt-1 text-xs font-semibold text-ink/40">Refreshing…</p>}
        </div>
        {can("shoot_day.edit") && (
          <Button disabled={!sync.online} title={sync.online ? "" : "Needs internet"} onClick={() => setAdding(true)}>+ Shoot day</Button>
        )}
      </div>

      {cached && <Alert tone="info">You are offline. Showing the list saved on this device.</Alert>}
      <Alert>{error && errorText(error)}</Alert>

      {!days && !error ? (
        <CardsSkeleton count={3} />
      ) : (
        <>
          {all.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Shoot days", all.length],
                ["Total budget", formatPaiseShort(sum((t) => t.budget_paise))],
                ["Spent", formatPaiseShort(sum((t) => t.spent_paise))],
                ["Cash vouchers", formatPaiseShort(sum((t) => t.cash_vouchers_paise))],
                ["Present / crew", `${sum((t) => t.present)} / ${sum((t) => t.crew)}`],
              ].map(([l, v], i) => (
                <div key={l} className={`rounded-2xl p-4 ${i === 0 ? "bg-ink text-white" : "border border-line bg-white"}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider ${i === 0 ? "text-white/50" : "text-ink/45"}`}>{l}</p>
                  <p className="mt-1 text-2xl font-black tracking-tight">{v}</p>
                </div>
              ))}
            </div>
          )}

          {all.length > 0 && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter days by audit status">
              {[["all", "All", all.length], ["pending", "To audit", count("pending")], ["query_raised", "Queries", count("query_raised")], ["verified", "Verified", count("verified")]].map(([k, l, n]) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={filter === k}
                  onClick={() => setFilter(k)}
                  className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold transition ${filter === k ? "border-ink bg-ink text-white" : "border-line bg-white text-ink/70 hover:border-ink"}`}
                >
                  {l} <span className={filter === k ? "text-white/60" : "text-ink/40"}>{n}</span>
                </button>
              ))}
            </div>
          )}

          {all.length > 0 && list.length === 0 && <p className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-8 text-center text-sm text-ink/60">No days in this view.</p>}

          {all.length === 0 && !error && (
            <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-10 text-center">
              <p className="text-lg font-extrabold">No shoot days yet</p>
              <p className="mt-1 text-sm text-ink/60">Add the first day to start recording attendance and expenses.</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {list.map((d) => {
              const t = d.totals || {};
              const a = AUDIT[d.audit_status] || AUDIT.pending;
              const pct = t.budget_paise ? Math.min(100, (t.spent_paise / t.budget_paise) * 100) : 0;
              const over = t.budget_paise > 0 && t.spent_paise > t.budget_paise;
              return (
                <Link key={d.id} to={`/shoot-days/${d.id}`} onMouseEnter={() => warm(d.id)} onTouchStart={() => warm(d.id)} onFocus={() => warm(d.id)} className={`block rounded-2xl border bg-white p-4 transition hover:border-ink hover:shadow-sm ${d.audit_status === "query_raised" ? "border-brand/50" : "border-line"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xl font-black">Shoot Day {d.day_no}</p>
                      <p className="font-mono text-xs text-ink/55">{fdate(d.shoot_date)}{d.shift ? ` · ${d.shift}` : ""}</p>
                      <p className="mt-0.5 truncate text-sm text-ink/60">{d.location || "Location not set"}</p>
                    </div>
                    <Badge tone={a.tone}>{a.label}</Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    {[["Teams", `${t.teams_active ?? 0}/${t.teams_total ?? 0}`], ["Crew", t.crew ?? 0], ["Present", t.present ?? 0]].map(([l, v]) => (
                      <div key={l} className="rounded-lg bg-mist/70 py-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-ink/45">{l}</p>
                        <p className="font-mono text-base font-semibold">{v}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-xs">
                    <span><span className="text-ink/50">Budget</span> <b>{formatPaiseShort(t.budget_paise ?? 0)}</b></span>
                    <span><span className="text-ink/50">Spent</span> <b>{formatPaiseShort(t.spent_paise ?? 0)}</b></span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-mist"><div className={`h-full ${over ? "bg-brand-dark" : "bg-ink"}`} style={{ width: `${pct}%` }} /></div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {adding && (
        <FormModal
          title="New shoot day"
          submitLabel="Create"
          fields={[
            { name: "shoot_date", label: "Date", type: "date", required: true },
            { name: "location", label: "Location" },
          ]}
          initial={{ shoot_date: today() }}
          onSubmit={async (v) => {
            const created = await shoot.createDay(projectId, { shoot_date: v.shoot_date, ...(v.location.trim() ? { location: v.location.trim() } : {}) });
            navigate(`/shoot-days/${created.id}`);
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}
