// One shoot day, kept on this device. Every edit changes the screen at once, is saved on the device,
// and is sent to the server through the outbox (waiting there if there is no network).

import { useCallback, useEffect, useRef, useState } from "react";
import * as shoot from "../../api/shoot";
import * as idb from "../../lib/idb";
import { cancelFor, enqueue, flush, getSyncUserId, isTmp, newTmpId, onSyncEvent, pendingCount } from "../../lib/outbox";
import { hoursBetween, hhmm, withSec } from "./format";

const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
export const cacheKey = (name) => `u${getSyncUserId()}:${name}`;

/** Totals worked out on the device (same sums the server makes). Falls back to the server's until every team is loaded. */
export function computeTotals(m) {
  const { day, tabs } = m;
  if (!day.teams.every((t) => tabs[t.day_team_id])) return { ...day.totals, local: false };
  let crew = 0, present = 0, spent = 0, active = 0;
  day.teams.forEach((t) => {
    const tab = tabs[t.day_team_id];
    crew += tab.entries.length;
    present += tab.entries.filter((e) => e.attendance === "present").length;
    spent += sum(tab.entries, (e) => e.paid_paise) + sum(tab.vehicles, (v) => v.amount_paise) + sum(tab.expenses, (x) => x.amount_paise);
    if (tab.entries.length || tab.vehicles.length || tab.expenses.length) active++;
  });
  return {
    teams_total: day.teams.length,
    teams_active: active,
    crew,
    present,
    budget_paise: day.day_budget_paise,
    spent_paise: spent,
    cash_vouchers_paise: sum(day.vouchers || [], (v) => v.amount_paise),
    local: true,
  };
}

export function useShootDay(dayId) {
  const ref = useRef(null);
  const [model, setModel] = useState(null);
  const [state, setState] = useState({ loading: true, error: null, source: "server" });
  const saveTimer = useRef(null);
  const loadId = useRef(0);

  const commit = useCallback(
    (next, source) => {
      ref.current = next;
      setModel(next);
      if (source) setState((s) => ({ ...s, source }));
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => idb.kvSet(cacheKey(`day:${dayId}`), { ...ref.current, savedAt: Date.now() }), 250);
    },
    [dayId]
  );

  const loadTabs = useCallback(
    async (ids, { workers = 4, members = false } = {}) => {
      const mine = loadId.current;
      const queue = [...ids];
      const worker = async () => {
        while (queue.length && mine === loadId.current) {
          const id = queue.shift();
          try {
            const tab = await shoot.getTab(id);
            // Do not overwrite the screen while there are changes waiting to be sent
            if (mine === loadId.current && pendingCount(dayId) === 0) {
              const next = structuredClone(ref.current);
              next.tabs[id] = tab;
              commit(next);
              // Keep the team's people list on the device so "Add person" also works offline
              const tid = tab.team?.id;
              if (members && tid && !ref.current.members?.[tid]) {
                try {
                  const list = await shoot.listMembers(tid);
                  if (mine === loadId.current) {
                    const n2 = structuredClone(ref.current);
                    n2.members[tid] = list;
                    commit(n2);
                  }
                } catch {
                  /* optional */
                }
              }
            }
          } catch {
            /* keep what we have */
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(workers, queue.length) || 1 }, worker));
    },
    [commit, dayId]
  );

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const mine = ++loadId.current;
      if (!silent) setState({ loading: true, error: null, source: "server" });
      if (pendingCount(dayId) > 0) await flush();
      const cached = await idb.kvGet(cacheKey(`day:${dayId}`));
      if (mine !== loadId.current) return;
      // Show the saved copy straight away, then refresh from the server behind it
      if (cached && pendingCount(dayId) === 0 && !silent) {
        commit(cached, "stale");
        setState((s) => ({ ...s, loading: false, error: null }));
      }
      // Still unsent changes: the saved copy on this device is the truth
      if (pendingCount(dayId) > 0 && cached) {
        commit(cached, "cache");
        setState((s) => ({ ...s, loading: false, error: null }));
        return;
      }
      try {
        const day = await shoot.getDay(dayId);
        if (mine !== loadId.current) return;
        const keep = ref.current && String(ref.current.day.id) === String(day.id) ? ref.current.tabs : cached?.tabs || {};
        const tabs = {};
        day.teams.forEach((t) => keep[t.day_team_id] && (tabs[t.day_team_id] = keep[t.day_team_id]));
        commit({ day, tabs, members: ref.current?.members || cached?.members || {} }, "server");
        setState((s) => ({ ...s, loading: false, error: null, source: "server" }));
        // Only refresh the teams already open on this screen. Others load when you open them.
        const wanted = day.teams.filter((t) => tabs[t.day_team_id] || day.teams.length === 1).map((t) => t.day_team_id);
        loadTabs(wanted, { members: true });
      } catch (e) {
        if (e.status === 0 && cached) {
          commit(cached, "cache");
          setState((s) => ({ ...s, loading: false, error: null }));
        } else {
          if (e.status === 404) {
            idb.kvDel(cacheKey(`day:${dayId}`)); // the day is gone: drop the saved copy
            ref.current = null;
            setModel(null);
          }
          setState({ loading: false, error: e, source: "server" });
        }
      }
    },
    [dayId, commit, loadTabs]
  );

  useEffect(() => {
    ref.current = null;
    setModel(null);
    load();
    return () => {
      loadId.current++;
      clearTimeout(saveTimer.current);
      if (ref.current) idb.kvSet(cacheKey(`day:${dayId}`), { ...ref.current, savedAt: Date.now() });
    };
  }, [dayId, load]);

  // Sync events: swap temporary ids for real ones, and refresh after saving or a refusal
  useEffect(() => {
    let t;
    const later = () => {
      clearTimeout(t);
      t = setTimeout(() => load({ silent: true }), 600);
    };
    const off = onSyncEvent((e) => {
      if (e.type === "created" && String(e.op.dayId) === String(dayId) && ref.current) {
        const next = structuredClone(ref.current);
        const fix = (item) => {
          if (item && item.id === e.tmp) {
            item.id = e.real;
            if (e.res?.team_member_id !== undefined) item.team_member_id = e.res.team_member_id;
            if (e.res?.hours !== undefined) item.hours = e.res.hours;
          }
        };
        Object.values(next.tabs).forEach((tab) => [...tab.entries, ...tab.vehicles, ...tab.expenses].forEach(fix));
        (next.day.vouchers || []).forEach(fix);
        commit(next);
      }
      if (e.type === "rejected" && String(e.op.dayId) === String(dayId)) later();
      if (e.type === "drained") later();
    });
    return () => {
      off();
      clearTimeout(t);
    };
  }, [dayId, commit, load]);

  const locked = !model || model.day.audit_status === "verified";

  /** apply() changes a copy of the data; op is the request to send. */
  const mutate = useCallback(
    (apply, op) => {
      const m = ref.current;
      if (!m || m.day.audit_status === "verified") return;
      const next = structuredClone(m);
      apply(next);
      commit(next);
      if (op) enqueue({ ...op, dayId });
    },
    [commit, dayId]
  );

  const A = {
    // ---- day header
    editDay: (patch) =>
      mutate(
        (m) => {
          for (const [k, v] of Object.entries(patch)) m.day[k] = k.endsWith("_time") ? withSec(v) : v;
        },
        { method: "PATCH", path: `/shoot-days/${dayId}`, body: patch, label: "Day details" }
      ),
    editTeam: (dtId, patch) =>
      mutate(
        (m) => {
          Object.assign(m.tabs[dtId], patch);
          const row = m.day.teams.find((t) => t.day_team_id === dtId);
          if (row) Object.assign(row, patch);
        },
        { method: "PATCH", path: `/day-teams/${dtId}`, body: patch, label: "Team figures" }
      ),

    // ---- people
    addEntry: (dtId, payload, member) => {
      const tmp = newTmpId();
      const tab = ref.current.tabs[dtId];
      const tin = payload.in_time || hhmm(tab.team.default_in_time) || "";
      const tout = payload.out_time || hhmm(tab.team.default_out_time) || "";
      mutate(
        (m) => {
          m.tabs[dtId].entries.push({
            id: tmp,
            team_member_id: payload.team_member_id ?? null,
            name: member?.name || payload.name,
            role: payload.role || member?.job_title || "",
            attendance: "present",
            in_time: withSec(tin),
            out_time: withSec(tout),
            hours: hoursBetween(tin, tout),
            signed: false,
            paid_paise: 0,
            remarks: "",
          });
        },
        { method: "POST", path: `/day-teams/${dtId}/entries`, body: payload, label: "New person", tmp }
      );
    },
    editEntry: (dtId, id, patch) =>
      mutate(
        (m) => {
          const e = m.tabs[dtId].entries.find((x) => x.id === id);
          for (const [k, v] of Object.entries(patch)) e[k] = k.endsWith("_time") ? withSec(v) : v;
          if ("in_time" in patch || "out_time" in patch) e.hours = hoursBetween(hhmm(e.in_time), hhmm(e.out_time));
        },
        { method: "PATCH", path: `/day-entries/${id}`, body: patch, label: "Person" }
      ),
    removeEntry: (dtId, id) => {
      const skip = isTmp(id) && cancelFor(id);
      mutate(
        (m) => {
          m.tabs[dtId].entries = m.tabs[dtId].entries.filter((x) => x.id !== id);
        },
        skip ? null : { method: "DELETE", path: `/day-entries/${id}`, label: "Remove person" }
      );
    },
    bulk: (dtId, body) =>
      mutate(
        (m) => {
          m.tabs[dtId].entries.forEach((e) => {
            if (body.action === "apply_time") {
              e.in_time = withSec(body.time_in);
              e.out_time = withSec(body.time_out);
              e.hours = hoursBetween(body.time_in, body.time_out);
            } else e.attendance = body.action === "all_present" ? "present" : "absent";
          });
        },
        { method: "POST", path: `/day-teams/${dtId}/bulk`, body, label: "Attendance for the whole team" }
      ),

    // ---- vehicles
    addVehicle: (dtId, body) => {
      const tmp = newTmpId();
      mutate(
        (m) => {
          m.tabs[dtId].vehicles.push({ id: tmp, vehicle_no: "", vehicle_type: "", vendor: "", driver: "", report_time: null, km_start: null, km_end: null, amount_paise: 0, ...body });
        },
        { method: "POST", path: `/day-teams/${dtId}/vehicles`, body, label: "New vehicle", tmp }
      );
    },
    editVehicle: (dtId, id, patch) =>
      mutate(
        (m) => {
          const v = m.tabs[dtId].vehicles.find((x) => x.id === id);
          for (const [k, val] of Object.entries(patch)) v[k] = k.endsWith("_time") ? withSec(val) : val;
        },
        { method: "PATCH", path: `/day-vehicles/${id}`, body: patch, label: "Vehicle" }
      ),
    removeVehicle: (dtId, id) => {
      const skip = isTmp(id) && cancelFor(id);
      mutate(
        (m) => {
          m.tabs[dtId].vehicles = m.tabs[dtId].vehicles.filter((x) => x.id !== id);
        },
        skip ? null : { method: "DELETE", path: `/day-vehicles/${id}`, label: "Remove vehicle" }
      );
    },

    // ---- expenses
    addExpense: (dtId, body) => {
      const tmp = newTmpId();
      mutate(
        (m) => {
          m.tabs[dtId].expenses.push({ id: tmp, vendor: "", quantity: "", amount_paise: 0, has_bill: true, pay_mode: "cash_voucher", remarks: "", ...body });
        },
        { method: "POST", path: `/day-teams/${dtId}/expenses`, body, label: "New expense", tmp }
      );
    },
    editExpense: (dtId, id, patch) =>
      mutate(
        (m) => Object.assign(m.tabs[dtId].expenses.find((x) => x.id === id), patch),
        { method: "PATCH", path: `/day-expenses/${id}`, body: patch, label: "Expense" }
      ),
    removeExpense: (dtId, id) => {
      const skip = isTmp(id) && cancelFor(id);
      mutate(
        (m) => {
          m.tabs[dtId].expenses = m.tabs[dtId].expenses.filter((x) => x.id !== id);
        },
        skip ? null : { method: "DELETE", path: `/day-expenses/${id}`, label: "Remove expense" }
      );
    },

    // ---- cash vouchers
    addVoucher: (body) => {
      const tmp = newTmpId();
      mutate(
        (m) => {
          (m.day.vouchers ||= []).push({ id: tmp, team_id: null, ref: "", person_name: "", department: "", narration: "", amount_paise: 0, docket_page: "", ...body });
        },
        { method: "POST", path: `/shoot-days/${dayId}/vouchers`, body, label: "New voucher", tmp }
      );
    },
    editVoucher: (id, patch) =>
      mutate(
        (m) => Object.assign(m.day.vouchers.find((x) => x.id === id), patch),
        { method: "PATCH", path: `/vouchers/${id}`, body: patch, label: "Voucher" }
      ),
    removeVoucher: (id) => {
      const skip = isTmp(id) && cancelFor(id);
      mutate(
        (m) => {
          m.day.vouchers = m.day.vouchers.filter((x) => x.id !== id);
        },
        skip ? null : { method: "DELETE", path: `/vouchers/${id}`, label: "Remove voucher" }
      );
    },
  };

  /** Members of a team for the "add existing person" list (cached for offline) */
  async function loadMembers(teamId) {
    try {
      const list = await shoot.listMembers(teamId);
      const next = structuredClone(ref.current);
      next.members[teamId] = list;
      commit(next);
      return list;
    } catch {
      return ref.current?.members?.[teamId] || [];
    }
  }

  /** Load teams that are not loaded yet (when opened, or when a step needs every team). */
  const loading = useRef(new Set());
  const ensureTabs = useCallback(
    (ids, opts) => {
      const have = ref.current?.tabs || {};
      const todo = ids.filter((id) => !have[id] && !loading.current.has(id));
      if (!todo.length) return;
      todo.forEach((id) => loading.current.add(id));
      loadTabs(todo, opts).finally(() => todo.forEach((id) => loading.current.delete(id)));
    },
    [loadTabs]
  );

  return { model, state, locked, reload: load, loadMembers, ensureTabs, ...A };
}
