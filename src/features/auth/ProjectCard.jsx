import { Badge } from "../../components/ui.jsx";
import { STATUSES, TYPES, fmtDate, label as metaLabel } from "../../lib/projectMeta.js";

/** One project card: role, project name and how far the shoot has got. No money here. */
export default function ProjectCard({ p, last, current, busy, onPick }) {
  const g = p.progress;
  return (
    <button
      disabled={busy}
      onClick={onPick}
      className="flex w-full flex-1 cursor-pointer flex-col justify-start rounded-2xl border border-line bg-white p-5 text-left shadow-sm transition hover:border-brand hover:shadow-md disabled:opacity-50"
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0">
          <span className="block break-words font-bold">{p.project_name || p.role_name}</span>
          <span className="block text-sm text-ink/55">
            {p.project_name ? `${p.role_name} · ` : ""}
            {p.organisation_name || "Platform"}
          </span>
        </span>
        {current ? <span className="shrink-0 rounded-full bg-brand px-2.5 py-0.5 text-xs font-semibold text-white">Current</span> : last ? <span className="shrink-0 rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Last used</span> : null}
      </span>

      {g && (
        <span className="mt-3 block">
          {(g.status || g.project_type || g.start_date || g.end_date) && (
          <span className="flex flex-wrap items-center gap-2 text-xs text-ink/55">
            <Badge tone={g.status === "active" ? "dark" : "neutral"}>{metaLabel(STATUSES, g.status)}</Badge>
            <span>{metaLabel(TYPES, g.project_type)}</span>
            {(g.start_date || g.end_date) && (
              <span>
                {g.start_date ? fmtDate(g.start_date) : "…"} → {g.end_date ? fmtDate(g.end_date) : "…"}
              </span>
            )}
          </span>
          )}
          <span className="mt-3 block h-2 overflow-hidden rounded-full bg-mist">
            <span className="block h-full rounded-full bg-brand" style={{ width: `${g.approved_percent ?? 0}%` }} />
          </span>
          <span className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 text-xs">
            <span className="font-semibold">
              {g.shoot_days_total === 0 ? "No shoot days yet" : `${g.shoot_days_approved ?? 0} of ${g.shoot_days_total} days approved (${g.approved_percent ?? 0}%)`}
            </span>
            {g.shoot_days_total > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {g.shoot_days_submitted > 0 && <span className="rounded-full bg-ink px-2 py-0.5 font-semibold text-white">{g.shoot_days_submitted} waiting</span>}
                {g.shoot_days_recheck > 0 && <span className="rounded-full bg-brand-light px-2 py-0.5 font-semibold text-brand-dark">{g.shoot_days_recheck} to fix</span>}
              </span>
            )}
          </span>
          {g.last_shoot_date && <span className="mt-0.5 block text-xs text-ink/45">Last shoot day {fmtDate(g.last_shoot_date)}</span>}
        </span>
      )}
    </button>
  );
}

