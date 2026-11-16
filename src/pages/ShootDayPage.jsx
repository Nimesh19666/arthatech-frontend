import { useEffect, useMemo, useRef, useState } from "react";
import * as idb from "../lib/idb";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as shoot from "../api/shoot";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { Cell, SceneChips, TimeRange } from "../features/shoot/Cell.jsx";
import Receipts from "../features/shoot/Receipts.jsx";
import TeamSection, { TeamList } from "../features/shoot/TeamSection.jsx";
import { AUDIT, auditInfo, fdate, hhmm, isEditable, paiseToRupees } from "../features/shoot/format";
import { cacheKey, computeTotals, useShootDay } from "../features/shoot/useShootDay";
import { Alert, Badge, Button, Field } from "../components/ui.jsx";
import FormModal from "../components/FormModal.jsx";
import { CardsSkeleton } from "../components/Skeleton.jsx";
import { useSyncStatus } from "../components/SyncBadge.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import { useToast } from "../components/Toast.jsx";
import { errorText } from "../lib/errors.js";
import { formatPaise, rupeesInWords, rupeesToPaise } from "../lib/money.js";

const rupees = (v) => rupeesToPaise(v === "" ? 0 : v);

function Panel({ title, right, fold, hint, children }) {
  if (fold)
    return (
      <details className="group rounded-2xl border border-line bg-white">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
          <span className="text-xs text-ink/40 transition group-open:rotate-90">▸</span>
          <h2 className="font-extrabold">{title}</h2>
          {hint && <span className="min-w-0 flex-1 truncate text-sm text-ink/50 group-open:hidden">{hint}</span>}
        </summary>
        <div className="border-t border-line">{children}</div>
      </details>
    );
  return (
    <section className="rounded-2xl border border-line bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <h2 className="font-extrabold">{title}</h2>
        {right}
      </header>
      {children}
    </section>
  );
}

/** Shift length from the two times. Out earlier than in means it ends next morning (night shift). */
function shiftHint(day) {
  const a = hhmm(day.shift_in_time), b = hhmm(day.shift_out_time);
  if (!a || !b) return null;
  const m = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let d = m(b) - m(a);
  if (d < 0) d += 1440;
  if (d === 0) return null;
  return `${Math.floor(d / 60)}h ${String(d % 60).padStart(2, "0")}m shift${m(b) < m(a) ? " (night, ends next day)" : ""}`;
}

export default function ShootDayPage() {
  const { dayId } = useParams();
  const navigate = useNavigate();
  const { can, me } = useAuth();
  const pid = me?.profile?.project_id ?? me?.project_id;
  const homeDays = pid ? `/projects/${pid}/shoot-days` : "/";
  const confirm = useConfirm();
  const toast = useToast();
  const sync = useSyncStatus();
  const sd = useShootDay(dayId);
  const { model, state } = sd;

  const detailRef = useRef(null);
  const [sel, setSel] = useState(null); // team chosen in the Teams step
  const [onlyActive, setOnlyActive] = useState(false);
  const [modal, setModal] = useState(null);
  const [reviewers, setReviewers] = useState(null); // Head Auditors who can review this day
  const [reviewerId, setReviewerId] = useState("");
  const [note, setNote] = useState("");
  const [signErr, setSignErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("details");
  // Figures printed on docket page 1, typed here only to compare. Kept on this device.
  const [docket, setDocket] = useState({ vouchers: "", cash: "" });
  useEffect(() => {
    idb.kvGet(cacheKey(`docket:${dayId}`)).then((v) => v && setDocket(v));
  }, [dayId]);
  useEffect(() => {
    document.querySelector('[aria-current="step"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [step]);
  const teamIds = model?.day.teams.map((t) => t.day_team_id) || [];
  const idKey = teamIds.join(",");
  useEffect(() => {
    if (!model) return;
    const selId = sel ?? teamIds[0];
    if (step === "crew" || step === "check" || onlyActive) sd.ensureTabs(teamIds, { workers: 6 });
    else if (step === "teams") sd.ensureTabs(selId ? [selId] : [], { workers: 1, members: true });
  }, [step, sel, onlyActive, idKey, Boolean(model), sync.pending === 0]); // eslint-disable-line react-hooks/exhaustive-deps
  const setDocketFig = (k, v) =>
    setDocket((d) => {
      const n = { ...d, [k]: v };
      idb.kvSet(cacheKey(`docket:${dayId}`), n);
      return n;
    });
  const [projectTeams, setProjectTeams] = useState([]);

  const day = model?.day;
  const [siblings, setSiblings] = useState([]);
  const projectId = day?.project_id;
  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    const key = cacheKey(`days:${projectId}`);
    shoot.listDays(projectId, { reuse: true }).then((l) => alive && setSiblings(l)).catch(async () => {
      const saved = await idb.kvGet(key);
      if (alive && saved) setSiblings(saved);
    });
    return () => { alive = false; };
  }, [projectId]);
  const nav = useMemo(() => {
    const s = [...siblings].sort((a, b) => a.day_no - b.day_no);
    const i = s.findIndex((d) => String(d.id) === String(dayId));
    return { prev: i > 0 ? s[i - 1] : null, next: i >= 0 && i < s.length - 1 ? s[i + 1] : null };
  }, [siblings, dayId]);
  // The comment box starts empty after every change of status
  useEffect(() => {
    setNote("");
    setSignErr(null);
  }, [day?.audit_status]);
  // Head Auditors to pick from, only needed while the day can be submitted
  useEffect(() => {
    if (step !== "check" || !day || !isEditable(day.audit_status) || !can("shoot_day.signoff") || offline) return undefined;
    let alive = true;
    shoot
      .reviewers(dayId)
      .then((r) => alive && (setReviewers(Array.isArray(r) ? r : []), setReviewerId((cur) => cur || String((Array.isArray(r) && r[0]?.profile_id) ?? ""))))
      .catch(() => alive && setReviewers([]));
    return () => {
      alive = false;
    };
  }, [step, dayId, day?.audit_status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!model) {
    return state.error ? (
      <div className="space-y-4">
        {state.error.status === 404 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-10 text-center">
            <p className="text-lg font-extrabold">This shoot day was not found</p>
            <p className="mx-auto mt-1 max-w-md text-sm text-ink/60">It may have been deleted, or it belongs to another project you cannot open. Go back to the list and pick a day from there.</p>
            <Link to={homeDays} className="mt-4 inline-block rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white">← All shoot days</Link>
          </div>
        ) : (
          <>
            <Alert>{errorText(state.error)}</Alert>
            <Link to={homeDays} className="text-sm font-semibold text-brand hover:underline">← Back</Link>
          </>
        )}
      </div>
    ) : (
      <CardsSkeleton count={3} />
    );
  }

  const status = day.audit_status;
  const editable = isEditable(status);
  const canEdit = can("shoot_day.edit") && editable;
  const canSign = can("shoot_day.signoff");
  const myProfileId = me?.profile?.profile_id;
  const canDecide = status === "submitted" && can("shoot_day.review") && day.reviewer_id != null && day.reviewer_id === myProfileId;
  const history = day.review_history || [];
  const lastReview = [...history].reverse().find((h) => h.to === "submitted");
  const waitingFor = lastReview?.reviewer?.name || "the Head Auditor";
  const lastDecision = [...history].reverse().find((h) => ["approved", "rejected"].includes(h.to));
  const totals = computeTotals(model);
  const pct = totals.budget_paise ? Math.min(100, (totals.spent_paise / totals.budget_paise) * 100) : 0;
  const over = totals.budget_paise > 0 && totals.spent_paise > totals.budget_paise;
  const a = auditInfo(status);

  const rows = day.teams.filter((r) => {
    if (!onlyActive) return true;
    const t = model.tabs[r.day_team_id];
    return !t || t.entries.length || t.vehicles.length || t.expenses.length;
  });

  const selRow = rows.find((r) => r.day_team_id === sel) || rows[0];

  async function online(fn, okText) {
    setBusy(true);
    try {
      await fn();
      if (okText) toast.success(okText);
    } catch (e) {
      toast.error(e.status === 404 || e.status === 405 ? "The server does not support this yet." : errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function openAddTeam() {
    await online(async () => {
      const all = await shoot.listProjectTeams(day.project_id);
      const used = new Set(day.teams.map((t) => t.team_id));
      setProjectTeams(all.filter((t) => !used.has(t.id)));
      setModal("team");
    });
  }

  /** Submit for review, or approve / reject / recheck. After any failure the day is reloaded: someone may have changed it. */
  async function act(kind) {
    setSignErr(null);
    const text = note.trim();
    if (kind === "submit") {
      if (!reviewerId) return setSignErr("Choose a Head Auditor.");
      const ok = await confirm({ title: "Submit this day?", message: "It will be locked until the Head Auditor approves it or sends it back.", confirmLabel: "Submit" });
      if (!ok) return;
    } else if ((kind === "reject" || kind === "recheck") && !text) {
      return setSignErr("Write a comment for reject or recheck.");
    } else if (kind === "approve") {
      const ok = await confirm({ title: "Approve this day?", message: "It will be locked for everyone.", confirmLabel: "Approve" });
      if (!ok) return;
    }
    await online(async () => {
      try {
        if (kind === "submit") await shoot.submitDay(dayId, { reviewer_profile_id: Number(reviewerId), ...(text ? { comment: text } : {}) });
        else await shoot.reviewDay(dayId, { action: kind, ...(text ? { comment: text } : {}) });
      } catch (e) {
        setSignErr(errorText(e));
        if (e.status === 400) await sd.reload({ silent: true });
        throw e;
      }
      setNote("");
      await sd.reload({ silent: true });
    }, kind === "submit" ? "Submitted for review" : kind === "approve" ? "Approved" : kind === "reject" ? "Rejected" : "Sent back for recheck");
  }

  const money = Boolean(day.totals);
  const words = (p) => rupeesInWords(p / 100).split(" · ")[1] || "";
  const vouchers = day.vouchers || [];
  const voucherTotal = vouchers.reduce((a, v) => a + (Number(v.amount_paise) || 0), 0);
  const kindOf = (r) => model.tabs[r.day_team_id]?.team.kind ?? r.kind;
  const declaredOf = (r) => (model.tabs[r.day_team_id] ? model.tabs[r.day_team_id].declared_headcount : r.declared_headcount);
  const crewRows = day.teams.filter((r) => kindOf(r) !== "vehicle");
  const allLoaded = day.teams.every((r) => model.tabs[r.day_team_id]);
  const crewDocketTotal = crewRows.reduce((a, r) => a + (Number(declaredOf(r)) || 0), 0);
  const crewEnteredTotal = crewRows.reduce((a, r) => a + (model.tabs[r.day_team_id]?.entries.length || 0), 0);
  const counts = Boolean(day.totals) || allLoaded;
  const crewCount = day.totals ? totals.crew ?? 0 : crewEnteredTotal;
  const allEntries = day.teams.flatMap((r) => (model.tabs[r.day_team_id]?.entries || []).map((e) => ({ ...e, team: r.name })));
  const presentRows = allEntries.filter((e) => e.attendance === "present");
  const noTimes = presentRows.filter((e) => !e.in_time || !e.out_time);
  const unsigned = presentRows.filter((e) => !e.signed);
  const countOff = crewRows.filter((r) => {
    const d = declaredOf(r);
    const t = model.tabs[r.day_team_id];
    return t && d !== null && d !== undefined && d !== "" && Number(d) !== t.entries.length;
  });
  const countUnset = crewRows.filter((r) => declaredOf(r) === null || declaredOf(r) === undefined || declaredOf(r) === "");
  const checks = [
    allLoaded ? null : { state: "info", title: "Still loading teams.", detail: "The checks below will update when every team has loaded.", go: null },
    docket.vouchers === ""
      ? { state: "info", title: "Cash voucher count:", detail: `${vouchers.length} entered. Type the number from your paper above to compare.`, go: null }
      : { state: Number(docket.vouchers) === vouchers.length ? "ok" : "warn", title: "Cash voucher count:", detail: `paper says ${docket.vouchers}, ${vouchers.length} entered.`, go: "vouchers" },
    docket.cash === ""
      ? { state: "info", title: "Cash total:", detail: `${formatPaise(voucherTotal)} entered. Type the total from your paper above to compare.`, go: null }
      : { state: Math.round(Number(docket.cash) * 100) === voucherTotal ? "ok" : "warn", title: "Cash total:", detail: `paper says ₹${Number(docket.cash).toLocaleString("en-IN")}, vouchers add up to ${formatPaise(voucherTotal)}.`, go: "vouchers" },
    countUnset.length
      ? { state: "warn", title: "Expected count not entered:", detail: `${countUnset.map((r) => r.name).join(", ")}.`, go: "crew" }
      : { state: countOff.length ? "warn" : "ok", title: "Expected count against people:", detail: countOff.length ? `${countOff.map((r) => `${r.name} (expected ${declaredOf(r)}, entered ${model.tabs[r.day_team_id].entries.length})`).join("; ")}.` : "every team matches.", go: "crew" },
    { state: noTimes.length ? "warn" : "ok", title: "Present people with no in or out time:", detail: noTimes.length ? `${noTimes.length} (${[...new Set(noTimes.map((e) => e.team))].join(", ")}).` : "none.", go: "teams" },
    { state: unsigned.length ? "warn" : "ok", title: "Present people not marked signed:", detail: unsigned.length ? `${unsigned.length}.` : "none.", go: "teams" },
    !money
      ? null
      : totals.budget_paise > 0
      ? { state: over ? "warn" : "ok", title: "Spending against the day budget:", detail: `${formatPaise(totals.spent_paise)} of ${formatPaise(totals.budget_paise)}${over ? ", over budget" : ""}.`, go: "details" }
      : { state: "info", title: "Day budget:", detail: "not set.", go: "details" },
  ].filter(Boolean);
  const attention = checks.filter((c) => c.state === "warn");
  const steps = [
    { key: "details", title: "Day details", sub: "Times and crew names", help: "Location, shift, call, roll and pack-up times, scenes and the crew names.", done: Boolean(day.location && day.call_time) },
    { key: "vouchers", title: "Cash vouchers", sub: `${vouchers.length} added`, help: "One row per cash voucher: reference, person, department, narration and amount.", done: vouchers.length > 0 },
    { key: "crew", title: "Crew count", sub: `${crewDocketTotal} expected`, help: "Type the expected headcount for each team. The app compares it with the people you add next.", done: crewRows.length > 0 && countUnset.length === 0 },
    { key: "teams", title: "Teams", sub: `${crewCount} people`, help: "For each team: who came, in and out time, signed or not. Then vehicles and expenses.", done: crewCount > 0 },
    { key: "check", title: canSign ? "Check and sign off" : "Check", sub: attention.length ? `${attention.length} to look at` : a.label, help: "See what does not add up, then submit the day to a Head Auditor.", done: status === "approved" },
  ];
  const idx = steps.findIndex((x) => x.key === step);
  const cur = steps[idx] || steps[0];
  const offline = !sync.online;
  const stat = (label, value, sub) => (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/45">{label}</p>
      <p className="mt-1 text-xl font-black tracking-tight">{value}</p>
      {sub}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* One header: stays visible while scrolling */}
      <div className="sticky top-[4.5rem] z-10 -mt-3 rounded-2xl border border-line bg-white/95 px-3 py-2.5 shadow-sm backdrop-blur sm:px-4">
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          <Link to={`/projects/${day.project_id}/shoot-days`} className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-sm font-semibold hover:border-ink" aria-label="Back to all shoot days">← Days</Link>
          <div className="flex shrink-0 gap-1">
            {nav.prev ? <Link to={`/shoot-days/${nav.prev.id}`} aria-label={`Day ${nav.prev.day_no}`} title={`Day ${nav.prev.day_no}`} className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:border-ink">‹</Link> : <span className="grid h-8 w-8 place-items-center rounded-lg border border-line/50 text-ink/25">‹</span>}
            {nav.next ? <Link to={`/shoot-days/${nav.next.id}`} aria-label={`Day ${nav.next.day_no}`} title={`Day ${nav.next.day_no}`} className="grid h-8 w-8 place-items-center rounded-lg border border-line hover:border-ink">›</Link> : <span className="grid h-8 w-8 place-items-center rounded-lg border border-line/50 text-ink/25">›</span>}
          </div>
          <div className="order-last w-full min-w-0 sm:order-none sm:w-auto sm:flex-1">
            <p className="break-words text-base font-black sm:truncate leading-tight sm:text-lg">Shoot Day {day.day_no} <span className="font-mono text-xs font-medium text-ink/55">· {fdate(day.shoot_date)}{day.location ? ` · ${day.location}` : ""}</span></p>
            <p className="truncate text-[11px] font-semibold text-ink/50">
              {sync.pending > 0 ? (offline ? `${sync.pending} saved on this device` : "Saving…") : offline ? "Offline · saved on this device" : "All changes saved"}
            </p>
          </div>
          {money && <span className="hidden text-xs sm:block"><b>{formatPaise(totals.spent_paise)}</b> <span className="text-ink/50">of {formatPaise(totals.budget_paise)}</span></span>}
          <span className="ml-auto sm:ml-0"><Badge tone={a.tone}>{a.label}</Badge></span>
        </div>
        {money && <div className="mt-2 h-1 overflow-hidden rounded-full bg-mist"><div className={`h-full ${over ? "bg-brand-dark" : "bg-ink"}`} style={{ width: `${pct}%` }} /></div>}
      </div>

      {state.source === "cache" && <Alert tone="info">Showing the copy saved on this device. It will refresh when you are back online.</Alert>}
      {a.unknown && (
        <Alert tone="error">
          This day has an old status (“{status}”) that the new review flow does not know, so it is locked. The backend needs to convert old days: pending → draft, query_raised → recheck, verified → approved.
        </Alert>
      )}
      {status === "recheck" && day.audit_note && (
        <Alert tone="error">
          <b>Sent back for recheck:</b> {day.audit_note}
        </Alert>
      )}
      {status === "submitted" && <Alert tone="info">This day is submitted and locked while {canDecide ? "you review" : waitingFor + " reviews"} it.</Alert>}
      {status === "approved" && <Alert tone="info">This day is approved and locked.</Alert>}
      {status === "rejected" && <Alert tone="info">This day is rejected and locked.</Alert>}

      {/* Steps, in the order the paper is filled */}
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" aria-label="Audit steps">
        {steps.map((st, i) => (
          <button
            key={st.key}
            onClick={() => setStep(st.key)}
            aria-current={step === st.key ? "step" : undefined}
            className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${step === st.key ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink"}`}
          >
            <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-black ${st.done ? "bg-brand text-white" : step === st.key ? "bg-white/20" : "bg-mist"}`}>{st.done ? "✓" : i + 1}</span>
            <span>
              <span className="block text-sm font-bold leading-tight">{st.title}</span>
              <span className={`block text-[11px] leading-tight ${step === st.key ? "text-white/60" : "text-ink/45"}`}>{st.sub}</span>
            </span>
          </button>
        ))}
      </nav>

      
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {money && stat("Budget", formatPaise(totals.budget_paise), words(totals.budget_paise) && <p className="mt-0.5 text-xs font-semibold text-ink/50">{words(totals.budget_paise)}</p>)}
        {money && stat("Spent", formatPaise(totals.spent_paise), (
          <>
            {words(totals.spent_paise) && <p className="mt-0.5 text-xs font-semibold text-ink/50">{words(totals.spent_paise)}</p>}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist"><div className={`h-full ${over ? "bg-brand-dark" : "bg-ink"}`} style={{ width: `${pct}%` }} /></div>
          </>
        ))}
        {stat("Cash vouchers", formatPaise(voucherTotal), words(voucherTotal) && <p className="mt-0.5 text-xs font-semibold text-ink/50">{words(voucherTotal)}</p>)}
        {counts && stat("Present / crew", `${totals.present} / ${totals.crew}`, <p className="mt-0.5 text-xs text-ink/50">{totals.teams_active} of {totals.teams_total} teams active</p>)}
      </div>

      <p className="text-sm text-ink/60">{cur.help}</p>

      {step === "details" && (
        <Panel title="Shoot details">
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ["Date", "shoot_date", "date"], ["Shoot location", "location"], ["Script location", "script_location"], ["@shift"],
              ["Call time", "call_time", "time"], ["Roll time", "roll_time", "time"], ["Pack-up", "packup_time", "time"], ["@scenes_planned"], ["@scenes_executed"], ["Director", "director"], ["DOP", "dop"], ["Production designer", "production_designer"],
              ["Associate producer", "associate_producer"], ["Line producer", "line_producer"], ["Auditor(s)", "auditors"],
            ].map(([label, key, type]) =>
              label === "@shift" ? (
                <TimeRange key={label} label="Shift (in to out)" disabled={!canEdit} from={hhmm(day.shift_in_time)} to={hhmm(day.shift_out_time)} hint={shiftHint(day)} onSave={(p) => sd.editDay(p)} />
              ) : label === "@scenes_planned" ? (
                <SceneChips key={label} label="Scenes planned" disabled={!canEdit} value={day.scenes_planned} onSave={(v) => sd.editDay({ scenes_planned: v })} />
              ) : label === "@scenes_executed" ? (
                <SceneChips key={label} label="Scenes executed" disabled={!canEdit} value={day.scenes_executed} onSave={(v) => sd.editDay({ scenes_executed: v })} />
              ) : (
              <Cell key={key} label={label} type={type || "text"} disabled={!canEdit} value={type === "time" ? hhmm(day[key]) : day[key] ?? ""} onSave={(v) => sd.editDay({ [key]: v })} />
              )
            )}
            <Cell label="Budget for the day (₹)" type="number" min="0" disabled={!canEdit} value={paiseToRupees(day.day_budget_paise)} onSave={(v) => sd.editDay({ day_budget_paise: rupees(v) })} />
          </div>
        </Panel>
      )}

      {step === "vouchers" && (
        <Panel title="Cash vouchers" right={canEdit && <Button variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={() => setModal("voucher")}>+ Voucher</Button>}>
          <div className="space-y-2 p-4">
            {vouchers.length === 0 && <p className="text-sm text-ink/55">No vouchers yet. Add one for each voucher on the paper.</p>}
            {vouchers.map((v) => (
              <div key={v.id} className="rounded-xl border border-line p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                  <Cell label="CV ref" disabled={!canEdit} value={v.ref} onSave={(x) => sd.editVoucher(v.id, { ref: x })} />
                  <Cell label="Person" disabled={!canEdit} value={v.person_name} onSave={(x) => sd.editVoucher(v.id, { person_name: x })} />
                  <Cell label="Department" disabled={!canEdit} value={v.department} onSave={(x) => sd.editVoucher(v.id, { department: x })} />
                  <Cell label="Narration" disabled={!canEdit} value={v.narration} onSave={(x) => sd.editVoucher(v.id, { narration: x })} />
                  <Cell label="Amount (₹)" type="number" min="0" disabled={!canEdit} value={paiseToRupees(v.amount_paise)} onSave={(x) => sd.editVoucher(v.id, { amount_paise: rupees(x) })} />
                  <Cell label="Page ref" disabled={!canEdit} value={v.docket_page} onSave={(x) => sd.editVoucher(v.id, { docket_page: x })} />
                </div>
                {canEdit && <button onClick={() => sd.removeVoucher(v.id)} className="mt-2 cursor-pointer text-xs font-semibold text-brand hover:underline">Remove</button>}
              </div>
            ))}
            {vouchers.length > 0 && (
              <p className="pt-1 text-sm font-semibold">
                {vouchers.length} voucher{vouchers.length === 1 ? "" : "s"} · total {formatPaise(voucherTotal)}
                {words(voucherTotal) && <span className="text-ink/50"> ({words(voucherTotal)})</span>}
              </p>
            )}
          </div>
        </Panel>
      )}

      {step === "crew" && (
        <Panel title="Expected count against people entered">
          <div className="divide-y divide-line">
            {crewRows.length === 0 && <p className="p-4 text-sm text-ink/55">This day has no crew teams.</p>}
            {crewRows.map((r) => {
              const tab = model.tabs[r.day_team_id];
              const dec = declaredOf(r);
              const have = tab ? tab.entries.length : null;
              const set = dec !== null && dec !== undefined && dec !== "";
              const match = tab && set && Number(dec) === have;
              return (
                <div key={r.day_team_id} className="flex flex-wrap items-end gap-x-4 gap-y-2 px-4 py-3">
                  <button onClick={() => { setSel(r.day_team_id); setStep("teams"); }} className="min-w-[10rem] flex-1 cursor-pointer break-words text-left font-bold hover:text-brand">{r.name} <span className="text-xs font-semibold text-ink/40">open →</span></button>
                  <Cell className="w-28" label="Expected count" type="number" min="0" disabled={!canEdit} value={set ? dec : ""} onSave={(v) => sd.editTeam(r.day_team_id, { declared_headcount: v === "" ? null : Number(v) })} />
                  <div className="w-20 text-center"><p className="text-[11px] font-semibold uppercase tracking-wide text-ink/45">Entered</p><p className="font-mono text-lg font-semibold">{have ?? "…"}</p></div>
                  <div className="w-24">{!tab ? <Badge>Loading</Badge> : !set ? <Badge>No count</Badge> : match ? <Badge tone="dark">Matches</Badge> : <Badge tone="red">{have - Number(dec) > 0 ? "+" : ""}{have - Number(dec)} off</Badge>}</div>
                </div>
              );
            })}
            {crewRows.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2 bg-mist/60 px-4 py-3 text-sm font-bold">
                <span>Total</span>
                <span className="font-mono">{crewDocketTotal} expected · {crewEnteredTotal} entered</span>
              </div>
            )}
          </div>
        </Panel>
      )}

      {step === "teams" && can("shoot_day.view") && (
        <Panel title="Overall bills (whole day)" fold hint="Bills that are not for one team">
          <Receipts dayId={day.id} teams={day.teams} scope="day" canChange={editable && can("shoot_day.edit")} offline={offline} />
        </Panel>
      )}

      {step === "teams" && (
        <Panel
          title="Teams: attendance, vehicles, expenses"
          right={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="h-4 w-4 accent-brand" /> Only teams with entries</label>
              {canEdit && <Button variant="outline" className="!px-3 !py-1.5 !text-xs" loading={busy} disabled={offline} title={offline ? "Needs internet" : ""} onClick={openAddTeam}>+ Add team</Button>}
            </div>
          }
        >
          {rows.length === 0 ? (
            <p className="p-4 text-sm text-ink/55">No teams with entries yet. Untick the filter to see every team.</p>
          ) : (
            <div className="grid lg:grid-cols-[13rem_minmax(0,1fr)]">
              <div className="max-h-64 overflow-y-auto border-b border-line lg:max-h-[75vh] lg:border-b-0 lg:border-r">
                <TeamList rows={rows} tabs={model.tabs} selected={selRow?.day_team_id} onSelect={(id) => { setSel(id); if (window.innerWidth < 1024) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }} />
              </div>
              <div ref={detailRef} className="min-w-0 scroll-mt-24">
                {selRow && (
                  <TeamSection
                    key={selRow.day_team_id}
                    row={selRow}
                    dayId={day.id}
                    tab={model.tabs[selRow.day_team_id]}
                    sd={sd}
                    canEdit={canEdit}
                    online={!offline}
                    onRemoveTeam={(row) => online(async () => { await shoot.removeDayTeam(row.day_team_id); setSel(null); await sd.reload({ silent: true }); }, "Team removed")}
                  />
                )}
              </div>
            </div>
          )}
        </Panel>
      )}

      {step === "check" && (
        <>
          <Panel title="Totals from the paper (optional)">
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Cell label="Cash vouchers issued" type="number" min="0" value={docket.vouchers} onSave={(v) => setDocketFig("vouchers", v)} />
              <Cell label="Total cash disbursed (₹)" type="number" min="0" value={docket.cash} onSave={(v) => setDocketFig("cash", v)} />
              <p className="text-xs text-ink/50 sm:col-span-2">Type the totals printed on the paper so the app can compare. These two numbers stay on this device only.</p>
            </div>
          </Panel>

          {can("shoot_day.view") && (
            <Panel title="Bills and receipts">
              <Receipts dayId={day.id} teams={day.teams} canChange={editable && can("shoot_day.edit")} offline={offline} />
            </Panel>
          )}

          <section className={`rounded-2xl border p-4 ${attention.length ? "border-brand/40 bg-brand-light/40" : "border-line bg-white"}`}>
            <h3 className="font-extrabold">{attention.length ? `${attention.length} thing${attention.length === 1 ? "" : "s"} to look at` : "Everything checked looks clean"}</h3>
            <ul className="mt-3 space-y-2">
              {checks.map((c) => (
                <li key={c.title} className="flex flex-wrap items-start gap-2 text-sm">
                  <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${c.state === "ok" ? "bg-ink text-white" : c.state === "warn" ? "bg-brand text-white" : "bg-mist text-ink/50"}`}>{c.state === "ok" ? "✓" : c.state === "warn" ? "!" : "·"}</span>
                  <span className="min-w-0 flex-1"><b>{c.title}</b> <span className="text-ink/65">{c.detail}</span></span>
                  {c.go && c.state !== "ok" && <button onClick={() => setStep(c.go)} className="cursor-pointer text-xs font-semibold text-brand hover:underline">Go there →</button>}
                </li>
              ))}
            </ul>
          </section>

          {canSign && editable && (
            <Panel title="Submit for review">
              <div className="space-y-3 p-4">
                <Alert>{signErr}</Alert>
                {reviewers && reviewers.length === 0 ? (
                  <p className="text-sm font-semibold text-ink/60">No Head Auditor on this project yet.</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Field label="Head Auditor" as="select" value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
                      {!reviewers && <option value="">Loading…</option>}
                      {(reviewers || []).map((r) => (
                        <option key={r.profile_id} value={r.profile_id}>{r.name}</option>
                      ))}
                    </Field>
                    <Field className="sm:col-span-2" label="Comment (optional)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the Head Auditor should look at" />
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <Button loading={busy} disabled={offline || sync.pending > 0 || !reviewerId || !reviewers?.length} onClick={() => act("submit")}>Submit for review</Button>
                  {(offline || sync.pending > 0) && <span className="text-xs text-ink/55">{offline ? "Submitting needs internet." : "Wait for your changes to finish saving first."}</span>}
                </div>
              </div>
            </Panel>
          )}

          {status === "submitted" && !canDecide && (
            <Panel title="Waiting for review">
              <p className="p-4 text-sm">Waiting for <b>{waitingFor}</b> to approve this day, send it back, or reject it.</p>
            </Panel>
          )}

          {canDecide && (
            <Panel title="Review this day">
              <div className="space-y-3 p-4">
                <Alert>{signErr}</Alert>
                {lastReview?.comment && <p className="rounded-lg bg-mist/70 p-3 text-sm"><b>{lastReview.by?.name || "Auditor"}:</b> {lastReview.comment}</p>}
                <Field label="Comment (needed for reject and recheck)" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What is wrong, or what to fix" />
                <div className="flex flex-wrap items-center gap-2">
                  <Button loading={busy} disabled={offline} onClick={() => act("approve")}>Approve</Button>
                  <Button variant="outline" disabled={busy || offline} onClick={() => act("recheck")}>Send for recheck</Button>
                  <Button variant="danger" disabled={busy || offline} onClick={() => act("reject")}>Reject</Button>
                  {offline && <span className="text-xs text-ink/55">Reviewing needs internet.</span>}
                </div>
              </div>
            </Panel>
          )}

          {(status === "approved" || status === "rejected") && (
            <Panel title={status === "approved" ? "Approved" : "Rejected"}>
              <p className="p-4 text-sm">
                {status === "approved" ? "Approved" : "Rejected"} by <b>{lastDecision?.by?.name || "the Head Auditor"}</b>
                {(lastDecision?.at || day.verified_at) && <> on {new Date(lastDecision?.at || day.verified_at).toLocaleString()}</>}
                {lastDecision?.comment ? <>. Reason: {lastDecision.comment}</> : "."}
              </p>
            </Panel>
          )}

          {history.length > 0 && (
            <Panel title="Review history">
              <ol className="space-y-3 p-4">
                {history.map((h, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                    <div className="min-w-0">
                      <p>
                        <b>{h.by?.name || "Someone"}</b> <span className="text-ink/60">{({ submitted: "submitted it", recheck: "sent it back for recheck", approved: "approved it", rejected: "rejected it" })[h.to] || `moved it to ${h.to}`}</span>
                        {h.to === "submitted" && h.reviewer?.name ? <span className="text-ink/60"> to <b className="text-ink">{h.reviewer.name}</b></span> : null}
                      </p>
                      {h.comment && <p className="mt-0.5 break-words text-ink/80">“{h.comment}”</p>}
                      {h.at && <p className="mt-0.5 text-xs text-ink/45">{new Date(h.at).toLocaleString()}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>{idx > 0 && <Button variant="outline" onClick={() => setStep(steps[idx - 1].key)}>← {steps[idx - 1].title}</Button>}</div>
        <div>{idx < steps.length - 1 && <Button onClick={() => setStep(steps[idx + 1].key)}>Next: {steps[idx + 1].title} →</Button>}</div>
      </div>

      {step === "details" && can("shoot_day.edit") && editable && history.length === 0 && (
        <div className="flex justify-end">
          <Button variant="danger" disabled={offline} onClick={async () => {
            const ok = await confirm({ title: "Delete this shoot day?", message: "All its attendance, expenses and vouchers will be removed.", confirmLabel: "Delete" });
            if (ok) online(async () => { await shoot.deleteDay(dayId); navigate(`/projects/${day.project_id}/shoot-days`, { replace: true }); }, "Shoot day deleted");
          }}>Delete this shoot day</Button>
        </div>
      )}

      {modal === "voucher" && (
        <FormModal
          title="Add cash voucher"
          fields={[
            { name: "ref", label: "CV ref" },
            { name: "person_name", label: "Name of the person", required: true },
            { name: "department", label: "Designation / department" },
            { name: "narration", label: "Narration" },
            { name: "amount", label: "Amount (₹)", type: "number", min: 0, required: true },
            { name: "docket_page", label: "Page ref" },
          ]}
          onSubmit={(v) => {
            const body = { amount_paise: rupees(v.amount), person_name: v.person_name.trim() };
            ["ref", "department", "narration", "docket_page"].forEach((k) => v[k].trim() && (body[k] = v[k].trim()));
            sd.addVoucher(body);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "team" && (
        <FormModal
          title="Add a team to this day"
          fields={[{ name: "team_id", label: "Team", as: "select", required: true, options: [{ value: "", label: projectTeams.length ? "Select…" : "All teams are already on this day" }, ...projectTeams.map((t) => ({ value: t.id, label: t.name }))] }]}
          onSubmit={async (v) => {
            await shoot.addTeamToDay(dayId, Number(v.team_id));
            setModal(null);
            await sd.reload({ silent: true });
            toast.success("Team added");
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
