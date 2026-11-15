import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as authApi from "../api/auth";
import * as idb from "../lib/idb";
import * as shoot from "../api/shoot";
import { useAuth } from "../features/auth/AuthContext.jsx";
import ProjectCard from "../features/auth/ProjectCard.jsx";
import { Alert } from "../components/ui.jsx";
import { CardsSkeleton } from "../components/Skeleton.jsx";
import { homeFor } from "../lib/home.js";
import { errorText } from "../lib/errors.js";

export default function ProjectsPage() {
  const { profile, otherProfiles, switchProfile } = useAuth();
  const navigate = useNavigate();
  const [list, setList] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The login screen already received every role in this house with its progress: use that copy
    let alive = true;
    (async () => {
      const saved = await idb.kvGet(`house-profiles:${profile?.organisation_id}`).catch(() => null);
      const known = [profile, ...otherProfiles].filter((p) => p && p.organisation_id === profile?.organisation_id && p.project_id);
      const byId = new Map((saved || []).map((p) => [p.profile_id, p]));
      if (alive) setList(known.map((p) => (byId.get(p.profile_id)?.progress ? { ...p, progress: byId.get(p.profile_id).progress } : p)));
    })();
    return () => {
      alive = false;
    };
  }, [profile, otherProfiles]);

  // Until the server sends progress for every project, work it out for the one we can read
  const [mine, setMine] = useState(null);
  useEffect(() => {
    const pid = profile?.project_id;
    if (!pid || !list || list.some((p) => p.project_id === pid && p.progress)) return undefined;
    let alive = true;
    (async () => {
      try {
        const days = await shoot.listDays(pid, { reuse: true });
        const proj = null; // GET /projects/<id> is not allowed for this role
        const n = (s) => days.filter((d) => d.audit_status === s).length;
        const total = days.length;
        const approved = n("approved");
        const dates = days.map((d) => d.shoot_date).filter(Boolean).sort();
        if (alive)
          setMine({
            project_id: pid,
            progress: {
              status: proj?.status,
              project_type: proj?.project_type,
              start_date: proj?.start_date,
              end_date: proj?.end_date,
              shoot_days_total: total,
              shoot_days_approved: approved,
              shoot_days_submitted: n("submitted"),
              shoot_days_recheck: n("recheck"),
              approved_percent: total ? Math.round((approved / total) * 100) : 0,
              last_shoot_date: dates[dates.length - 1],
            },
          });
      } catch {
        /* no access to the days: the card just stays plain */
      }
    })();
    return () => {
      alive = false;
    };
  }, [list, profile]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (list || []).map((p) => (mine && p.project_id === mine.project_id && !p.progress ? { ...p, progress: mine.progress } : p)).filter((p) => !t || `${p.project_name} ${p.role_name}`.toLowerCase().includes(t));
  }, [list, q, mine]);

  // One card per project. If you hold two roles on it, the other role is a small button under the card.
  const groups = useMemo(() => {
    const m = new Map();
    for (const p of shown) {
      const g = m.get(p.project_id) || [];
      g.push(p);
      m.set(p.project_id, g);
    }
    return [...m.values()].map((g) => {
      const main = g.find((x) => x.profile_id === profile?.profile_id) || g[0];
      return { main, others: g.filter((x) => x !== main) };
    });
  }, [shown, profile]);

  async function pick(p) {
    if (p.profile_id === profile?.profile_id) return navigate(homeFor(p));
    setBusy(true);
    setError(null);
    try {
      await switchProfile(p.profile_id);
      navigate(homeFor(p), { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-brand">{profile?.organisation_name || "Your house"}</p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">Projects</h1>
      </div>

      <input className="input sm:max-w-sm" type="search" placeholder="Search projects…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search projects" />
      <Alert>{error && errorText(error)}</Alert>

      {!list ? (
        <CardsSkeleton count={3} />
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-10 text-center text-sm text-ink/60">{q ? "No project matches your search." : "You are not on any project in this house yet."}</p>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ main, others }) => (
            <div key={main.project_id} className="flex flex-col gap-2">
              <ProjectCard p={main} current={main.profile_id === profile?.profile_id} busy={busy} onPick={() => pick(main)} />
              {others.map((o) => (
                <button key={o.profile_id} disabled={busy} onClick={() => pick(o)} className="cursor-pointer rounded-lg border border-line bg-white px-3 py-2 text-left text-xs font-semibold text-ink/70 hover:border-brand hover:text-brand">
                  Open as {o.role_name} →
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
