import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as houses from "../api/houses";
import * as usersApi from "../api/users";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { Badge } from "../components/ui.jsx";
import { CardsSkeleton, RowsSkeleton, TableRowsSkeleton } from "../components/Skeleton.jsx";
import { formatPaiseShort } from "../lib/money.js";
import { STATUSES, fmtDate, label } from "../lib/projectMeta.js";

/** Real numbers only, built from the houses, projects, teams and users the server already returns. */
export default function DashboardPage() {
  const { user, profile, can } = useAuth();
  const first = (user?.full_name || user?.email || "").split(/[\s@]/)[0];
  const canHouses = can("house.create") || can("project.view");
  const canUsers = can("users.view");
  const canBudget = can("team.budget.set");

  const [stats, setStats] = useState({ data: null, loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
    const hs = canHouses ? houses.asList(await houses.listHouses()) : [];
    const projects = hs.flatMap((h) => (h.projects || []).map((p) => ({ ...p, houseName: h.name, orgId: h.id })));

    // Teams for up to 30 projects (one call each)
    const teamLists = await Promise.all(
      projects.slice(0, 30).map((p) =>
        houses
          .listTeams(p.id)
          .then(houses.asList)
          .catch(() => [])
      )
    );
    const teams = teamLists.flat();

    let people = null;
    if (canUsers) {
      try {
        people = usersApi.normalizeUsers(await usersApi.listUsers()).length;
      } catch {
        people = null;
      }
    }
      return {
      houses: hs,
      projects,
      teams: teams.length,
      planned: teams.reduce((a, t) => a + (Number(t.headcount) || 0), 0),
      budget: teams.reduce((a, t) => a + (Number(t.budget_paise) || 0), 0),
      people,
    };
    })()
      .then((data) => alive && setStats({ data, loading: false }))
      .catch(() => alive && setStats({ data: null, loading: false }));
    return () => {
      alive = false;
    };
  }, [canHouses, canUsers]);

  const s = stats.data;
  const tiles = s
    ? [
        ...(canHouses
          ? [
              { label: "Houses", value: s.houses.length },
              { label: "Projects", value: s.projects.length, sub: `${s.projects.filter((p) => p.status === "active").length} active` },
              { label: "Teams", value: s.teams, sub: `${s.planned} people planned` },
            ]
          : []),
        ...(canBudget && canHouses ? [{ label: "Team budgets", value: formatPaiseShort(s.budget) }] : []),
        ...(s.people !== null ? [{ label: "Users", value: s.people }] : []),
      ]
    : [];

  const recent = s ? [...s.projects].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 6) : [];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-brand">Dashboard</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">Hello, {first}.</h1>
        <p className="mt-1 text-ink/60">
          You are signed in as <b className="text-ink">{profile?.role_name}</b>
          {profile?.organisation_name ? ` at ${profile.organisation_name}` : " on the platform"}.
        </p>
      </div>

      {stats.loading ? (
        <CardsSkeleton count={1} />
      ) : (
        <>
          {tiles.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {tiles.map((t, i) => (
                <div key={t.label} className={`rounded-2xl p-5 ${i === 0 ? "bg-ink text-white" : "border border-line bg-white"}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider ${i === 0 ? "text-white/50" : "text-ink/45"}`}>{t.label}</p>
                  <p className="mt-1 text-3xl font-black tracking-tight">{t.value}</p>
                  {t.sub && <p className={`mt-0.5 text-xs ${i === 0 ? "text-white/50" : "text-ink/45"}`}>{t.sub}</p>}
                </div>
              ))}
            </div>
          )}

          {recent.length > 0 && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-extrabold">Projects</h2>
                <Link to="/houses" className="text-sm font-semibold text-brand hover:underline">
                  All houses →
                </Link>
              </div>
              <ul className="mt-3 divide-y divide-line">
                {recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/projects/${p.id}`}
                      state={{ name: p.name, orgId: p.orgId, houseName: p.houseName }}
                      className="flex flex-wrap items-center justify-between gap-2 py-3 hover:text-brand"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold">{p.name}</span>
                        <span className="block text-xs text-ink/50">
                          {p.houseName} · {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                        </span>
                      </span>
                      <Badge tone={p.status === "active" ? "dark" : "neutral"}>{label(STATUSES, p.status)}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tiles.length === 0 && recent.length === 0 && (
            <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-10 text-center text-sm text-ink/60">
              Nothing to show yet. Your menu on the left has what your role can open.
            </div>
          )}
        </>
      )}
    </div>
  );
}
