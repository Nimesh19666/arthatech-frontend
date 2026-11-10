import { useEffect, useMemo, useState } from "react";
import * as idb from "../lib/idb";
import { Link, useNavigate, useParams } from "react-router-dom";
import * as shoot from "../api/shoot";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { Cell } from "../features/shoot/Cell.jsx";
import TeamSection from "../features/shoot/TeamSection.jsx";
import { AUDIT, fdate, hhmm, paiseToRupees } from "../features/shoot/format";
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

  const [open, setOpen] = useState({});
  const [onlyActive, setOnlyActive] = useState(false);
  const [modal, setModal] = useState(null);
  const [status, setStatus] = useState("pending");
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
    const single = teamIds.length === 1;
    if (step === "crew" || step === "check" || onlyActive) sd.ensureTabs(teamIds, { workers: 6 });
    else if (step === "teams") sd.ensureTabs(teamIds.filter((id) => open[id] ?? single), { workers: 3, members: true });
  }, [step, open, onlyActive, idKey, Boolean(model), sync.pending === 0]); // eslint-disable-line react-hooks/exhaustive-deps
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
    shoot.listDays(projectId).then((l) => alive && setSiblings(l)).catch(async () => {
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
  useEffect(() => {
    if (day) {
      setStatus(day.audit_status);
      setNote(day.audit_note || "");
    }
  }, [day?.audit_status, day?.audit_note]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const verified = day.audit_status === "verified";
  const canEdit = can("shoot_day.edit") && !verified;
  const canSign = can("shoot_day.signoff");
  const totals = computeTotals(model);
  const pct = totals.budget_paise ? Math.min(100, (totals.spent_paise / totals.budget_paise) * 100) : 0;
  const over = totals.budget_paise > 0 && totals.spent_paise > totals.budget_paise;
  const a = AUDIT[day.audit_status] || AUDIT.pending;

  const rows = day.teams.filter((r) => {
    if (!onlyActive) return true;
    const t = model.tabs[r.day_team_id];
    return !t || t.entries.length || t.vehicles.length || t.expenses.length;
  });

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

  async function saveSignoff() {
    setSignErr(null);
    if (status === "query_raised" && !note.trim()) return setSignErr("Write what the query is.");
    if (status === "verified") {
      const ok = await confirm({ title: "Verify this day?", message: "This locks the whole day. Nobody can edit it until you reopen it.", confirmLabel: "Verify" });
      if (!ok) return;
    }
    await online(async () => {
      try {
        await shoot.signoff(dayId, { status, ...(note.trim() ? { note: note.trim() } : {}) });
      } catch (e) {
        setSignErr(errorText(e));
        throw e;
      }
      await sd.reload({ silent: true });
    }, "Saved");
  }

  const words = (p) => rupeesInWords(p / 100).split(" · ")[1] || "";
  const vouchers = day.vouchers || [];
  const voucherTotal = vouchers.reduce((a, v) => a + (Number(v.amount_paise) || 0), 0);
  const kindOf = (r) => model.tabs[r.day_team_id]?.team.kind ?? r.kind;
  const declaredOf = (r) => (model.tabs[r.day_team_id] ? model.tabs[r.day_team_id].declared_headcount : r.declared_headcount);
  const crewRows = day.teams.filter((r) => kindOf(r) !== "vehicle");
  const allLoaded = day.teams.every((r) => model.tabs[r.day_team_id]);
  const crewDocketTotal = crewRows.reduce((a, r) => a + (Number(declaredOf(r)) || 0), 0);
  const crewEnteredTotal = crewRows.reduce((a, r) => a + (model.tabs[r.day_team_id]?.entries.length || 0), 0);
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
    totals.budget_paise > 0
      ? { state: over ? "warn" : "ok", title: "Spending against the day budget:", detail: `${formatPaise(totals.spent_paise)} of ${formatPaise(totals.budget_paise)}${over ? ", over budget" : ""}.`, go: "details" }
      : { state: "info", title: "Day budget:", detail: "not set.", go: "details" },
  ].filter(Boolean);
  const attention = checks.filter((c) => c.state === "warn");
  const steps = [
    { key: "details", title: "Day details", sub: "Times and crew names", help: "Location, shift, call, roll and pack-up times, scenes and the crew names.", done: Boolean(day.location && day.call_time) },
    { key: "vouchers", title: "Cash vouchers", sub: `${vouchers.length} added`, help: "One row per cash voucher: reference, person, department, narration and amount.", done: vouchers.length > 0 },
    { key: "crew", title: "Crew count", sub: `${crewDocketTotal} expected`, help: "Type the expected headcount for each team. The app compares it with the people you add next.", done: crewRows.length > 0 && countUnset.length === 0 },
    { key: "teams", title: "Teams", sub: `${totals.crew ?? 0} people`, help: "For each team: who came, in and out time, signed or not. Then vehicles and expenses.", done: (totals.crew ?? 0) > 0 },
    { key: "check", title: canSign ? "Check and sign off" : "Check", sub: attention.length ? `${attention.length} to look at` : a.label, help: "See what does not add up, then verify the day or raise a query.", done: verified },
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
          <span className="hidden text-xs sm:block"><b>{formatPaise(totals.spent_paise)}</b> <span className="text-ink/50">of {formatPaise(totals.budget_paise)}</span></span>
          <span className="ml-auto sm:ml-0"><Badge tone={a.tone}>{a.label}</Badge></span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-mist"><div className={`h-full ${over ? "bg-brand-dark" : "bg-ink"}`} style={{ width: `${pct}%` }} /></div>
      </div>

      {state.source === "cache" && <Alert tone="info">Showing the copy saved on this device. It will refresh when you are back online.</Alert>}
      {verified && <Alert tone="info">This day is verified and locked. Reopen it to make changes.</Alert>}

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
        {stat("Budget", formatPaise(totals.budget_paise), words(totals.budget_paise) && <p className="mt-0.5 text-xs font-semibold text-ink/50">{words(totals.budget_paise)}</p>)}
        {stat("Spent", formatPaise(totals.spent_paise), (
          <>
            {words(totals.spent_paise) && <p className="mt-0.5 text-xs font-semibold text-ink/50">{words(totals.spent_paise)}</p>}
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist"><div className={`h-full ${over ? "bg-brand-dark" : "bg-ink"}`} style={{ width: `${pct}%` }} /></div>
          </>
        ))}
        {stat("Cash vouchers", formatPaise(voucherTotal), words(voucherTotal) && <p className="mt-0.5 text-xs font-semibold text-ink/50">{words(voucherTotal)}</p>)}
        {stat("Present / crew", `${totals.present} / ${totals.crew}`, <p className="mt-0.5 text-xs text-ink/50">{totals.teams_active} of {totals.teams_total} teams active</p>)}
      </div>

      <p className="text-sm text-ink/60">{cur.help}</p>

      {step === "details" && (
        <Panel title="Shoot details">
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ["Date", "shoot_date", "date"], ["Shoot location", "location"], ["Script location", "script_location"], ["Shift", "shift"],
              ["Call time", "call_time", "time"], ["Roll time", "roll_time", "time"], ["Pack-up", "packup_time", "time"], ["Scenes planned", "scenes_planned"],
              ["Scenes executed", "scenes_executed"], ["Director", "director"], ["DOP", "dop"], ["Production designer", "production_designer"],
              ["Associate producer", "associate_producer"], ["Line producer", "line_producer"], ["Auditor(s)", "auditors"],
            ].map(([label, key, type]) => (
              <Cell key={key} label={label} type={type || "text"} disabled={!canEdit} value={type === "time" ? hhmm(day[key]) : day[key] ?? ""} onSave={(v) => sd.editDay({ [key]: v })} />
            ))}
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
                  <button onClick={() => { setOpen((o) => ({ ...o, [r.day_team_id]: true })); setStep("teams"); }} className="min-w-[10rem] flex-1 cursor-pointer break-words text-left font-bold hover:text-brand">{r.name} <span className="text-xs font-semibold text-ink/40">open →</span></button>
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
          {rows.length === 0 && <p className="p-4 text-sm text-ink/55">No teams with entries yet. Untick the filter and open a team to add people.</p>}
          {rows.map((r) => (
            <TeamSection
              key={r.day_team_id}
              row={r}
              tab={model.tabs[r.day_team_id]}
              open={open[r.day_team_id] ?? day.teams.length === 1}
              onToggle={() => setOpen((o) => ({ ...o, [r.day_team_id]: !(o[r.day_team_id] ?? day.teams.length === 1) }))}
              sd={sd}
              canEdit={canEdit}
              online={!offline}
              onRemoveTeam={(row) => online(async () => { await shoot.removeDayTeam(row.day_team_id); await sd.reload({ silent: true }); }, "Team removed")}
            />
          ))}
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

          {canSign && (
            <Panel title="Auditor sign-off">
              <div className="space-y-3 p-4">
                <Alert>{signErr}</Alert>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Status" as="select" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="query_raised">Query raised</option>
                    <option value="verified">Verified</option>
                  </Field>
                  <Field className="sm:col-span-2" label="Auditor notes" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mismatches, missing vouchers, follow-ups" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button loading={busy} disabled={offline || sync.pending > 0} onClick={saveSignoff}>{verified && status === "pending" ? "Reopen day" : "Save sign-off"}</Button>
                  {(offline || sync.pending > 0) && <span className="text-xs text-ink/55">{offline ? "Sign-off needs internet." : "Wait for your changes to finish saving first."}</span>}
                </div>
              </div>
            </Panel>
          )}
        </>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>{idx > 0 && <Button variant="outline" onClick={() => setStep(steps[idx - 1].key)}>← {steps[idx - 1].title}</Button>}</div>
        <div>{idx < steps.length - 1 && <Button onClick={() => setStep(steps[idx + 1].key)}>Next: {steps[idx + 1].title} →</Button>}</div>
      </div>

      {step === "details" && can("shoot_day.edit") && !verified && (
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
