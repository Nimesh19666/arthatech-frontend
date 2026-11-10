import { useEffect, useState } from "react";
import FormModal from "../../components/FormModal.jsx";
import { Alert, Badge, Button, Field, Modal } from "../../components/ui.jsx";
import { Skeleton } from "../../components/Skeleton.jsx";
import { useConfirm } from "../../components/Confirm.jsx";
import { formatPaise, rupeesToPaise } from "../../lib/money.js";
import { Cell, Pick, Tick } from "./Cell.jsx";
import { PAY_MODES, fmtHours, hhmm, paiseToRupees } from "./format";

const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);
const rupees = (v) => rupeesToPaise(v === "" ? 0 : v);

function Row({ children, onRemove, disabled, title, head, cols = "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6" }) {
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        <p className="min-w-0 flex-1 break-words text-sm font-bold">{title || "—"}</p>
        {head}
        {onRemove && !disabled && (
          <button onClick={onRemove} className="cursor-pointer text-xs font-semibold text-brand hover:underline">
            Remove
          </button>
        )}
      </div>
      <div className={`grid gap-2 ${cols}`}>{children}</div>
    </div>
  );
}

function AddPersonModal({ sd, row, tab, onClose }) {
  const [members, setMembers] = useState(null);
  const [mode, setMode] = useState("existing");
  const [pick, setPick] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const locked = tab.team.roster_locked;

  useEffect(() => {
    sd.loadMembers(tab.team.id).then(setMembers);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDay = new Set(tab.entries.map((e) => e.team_member_id).filter(Boolean));
  const free = (members || []).filter((m) => m.is_active !== false && !onDay.has(m.id));

  function submit(e) {
    e.preventDefault();
    if (mode === "existing") {
      const m = free.find((x) => String(x.id) === pick);
      if (!m) return setError("Choose a person.");
      sd.addEntry(row.day_team_id, { team_member_id: m.id }, m);
    } else {
      if (!name.trim()) return setError("Enter a name.");
      sd.addEntry(row.day_team_id, { name: name.trim(), ...(role.trim() ? { role: role.trim() } : {}) });
    }
    onClose();
  }

  return (
    <Modal title="Add person" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error}</Alert>
        <div className="flex gap-2 text-sm font-semibold">
          <button type="button" onClick={() => setMode("existing")} className={`cursor-pointer rounded-lg px-3 py-1.5 ${mode === "existing" ? "bg-ink text-white" : "bg-mist"}`}>
            From the team
          </button>
          <button type="button" disabled={locked} onClick={() => setMode("new")} className={`cursor-pointer rounded-lg px-3 py-1.5 disabled:opacity-40 ${mode === "new" ? "bg-ink text-white" : "bg-mist"}`}>
            New name
          </button>
        </div>
        {locked && <p className="text-xs text-ink/55">This team's roster is locked, so only people already in the team can be added.</p>}
        {mode === "existing" ? (
          <Field label="Person" as="select" value={pick} onChange={(e) => setPick(e.target.value)} hint={members && free.length === 0 ? "Everyone in the team is already on this day." : undefined}>
            <option value="">{members ? "Select…" : "Loading…"}</option>
            {free.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.job_title ? ` · ${m.job_title}` : ""}
              </option>
            ))}
          </Field>
        ) : (
          <>
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field label="Role" value={role} onChange={(e) => setRole(e.target.value)} />
          </>
        )}
        <div className="flex gap-3 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1">
            Add
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function TeamSection({ row, tab, open, onToggle, sd, canEdit, online, onRemoveTeam }) {
  const confirm = useConfirm();
  const [modal, setModal] = useState(null);
  const dt = row.day_team_id;
  const off = !canEdit;
  const crew = tab?.team.kind === "crew";

  const present = tab ? tab.entries.filter((e) => e.attendance === "present").length : 0;
  const spent = tab ? sum(tab.entries, (e) => e.paid_paise) + sum(tab.vehicles, (v) => v.amount_paise) + sum(tab.expenses, (x) => x.amount_paise) : 0;
  const empty = tab && !tab.entries.length && !tab.vehicles.length && !tab.expenses.length;

  async function removeTeam() {
    const ok = await confirm({ title: `Remove ${row.name} from this day?`, message: "This only works if no work is recorded on it (signed or paid people, expenses, linked vouchers). The server will tell you if something blocks it.", confirmLabel: "Remove" });
    if (ok) onRemoveTeam(row);
  }

  return (
    <details open={open} onToggle={(e) => e.currentTarget.open !== open && onToggle()} className="group border-t border-line first:border-t-0">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3 hover:bg-mist/60">
        <span className="text-xs text-ink/40 transition group-open:rotate-90">▸</span>
        <span className="min-w-[8rem] flex-1 break-words font-bold">{row.name}</span>
        {tab ? (
          <span className="flex flex-wrap items-center gap-2 text-xs">
            {crew ? <span className="text-ink/60">{present} present / {tab.entries.length}{tab.declared_headcount != null ? ` (expected ${tab.declared_headcount})` : ""}</span> : <span className="text-ink/60">{tab.vehicles.length} vehicles</span>}
            {spent > 0 && <span className="font-bold">{formatPaise(spent)}</span>}
            {tab.team.roster_locked && <Badge tone="red">Roster locked</Badge>}
          </span>
        ) : open ? (
          <Skeleton className="h-4 w-24" />
        ) : (
          <span className="text-xs text-ink/50">{row.declared_headcount != null ? `expected ${row.declared_headcount} · ` : ""}tap to open</span>
        )}
      </summary>

      {open && (
        <div className="space-y-4 px-4 pb-5">
          {!tab ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {crew && (
                  <Cell label="Expected count" type="number" min="0" disabled={off} value={tab.declared_headcount ?? ""} onSave={(v) => sd.editTeam(dt, { declared_headcount: v === "" ? null : Number(v) })} />
                )}
                <Cell label="Team budget today (₹)" type="number" min="0" disabled={off} value={paiseToRupees(tab.day_budget_paise)} onSave={(v) => sd.editTeam(dt, { day_budget_paise: rupees(v) })} />
              </div>

              {crew ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink/50">People</h4>
                    {canEdit && (
                      <div className="flex flex-wrap gap-1.5">
                        <Button variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={() => sd.bulk(dt, { action: "all_present" })}>All present</Button>
                        <Button variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={() => sd.bulk(dt, { action: "all_absent" })}>All absent</Button>
                        <Button variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={() => setModal("time")}>Set time for everyone</Button>
                        <Button className="!px-3 !py-1.5 !text-xs" onClick={() => setModal("person")}>+ Add person</Button>
                      </div>
                    )}
                  </div>
                  {tab.entries.length === 0 && <p className="rounded-lg bg-mist/60 p-3 text-sm text-ink/55">No people on this day yet.</p>}
                  {tab.entries.map((e) => (
                    <Row
                      key={e.id}
                      title={e.name}
                      disabled={off}
                      cols="grid-cols-2 sm:grid-cols-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(8.5rem,1fr)_minmax(8.5rem,1fr)_minmax(4.5rem,.6fr)_minmax(6rem,1fr)_minmax(5rem,.9fr)_minmax(0,1.5fr)]"
                      head={
                        <label className="flex items-center gap-1.5 text-sm font-semibold">
                          <input type="checkbox" checked={Boolean(e.signed)} disabled={off} onChange={(ev) => sd.editEntry(dt, e.id, { signed: ev.target.checked })} className="h-4 w-4 accent-brand" />
                          Signed
                        </label>
                      }
                      onRemove={() => sd.removeEntry(dt, e.id)}
                    >
                      <Cell label="Role" disabled={off} value={e.role} onSave={(v) => sd.editEntry(dt, e.id, { role: v })} />
                      <Cell label="Time in" type="time" disabled={off} value={hhmm(e.in_time)} onSave={(v) => sd.editEntry(dt, e.id, { in_time: v })} />
                      <Cell label="Time out" type="time" disabled={off} value={hhmm(e.out_time)} onSave={(v) => sd.editEntry(dt, e.id, { out_time: v })} />
                      <div>
                        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-ink/45">Hours</span>
                        <p className="py-1.5 font-mono text-sm">{fmtHours(e.hours)}</p>
                      </div>
                      <Pick label="Status" disabled={off} value={e.attendance} onSave={(v) => sd.editEntry(dt, e.id, { attendance: v })} options={[{ value: "present", label: "Present" }, { value: "absent", label: "Absent" }]} />
                      <Cell label="Paid (₹)" type="number" min="0" disabled={off} value={paiseToRupees(e.paid_paise)} onSave={(v) => sd.editEntry(dt, e.id, { paid_paise: rupees(v) })} />
                      <Cell className="col-span-2 sm:col-span-4 lg:col-span-1" label="Remarks" disabled={off} value={e.remarks} onSave={(v) => sd.editEntry(dt, e.id, { remarks: v })} />
                    </Row>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-ink/50">Vehicles</h4>
                    {canEdit && <Button className="!px-3 !py-1.5 !text-xs" onClick={() => setModal("vehicle")}>+ Add vehicle</Button>}
                  </div>
                  {tab.vehicles.length === 0 && <p className="rounded-lg bg-mist/60 p-3 text-sm text-ink/55">No vehicles on this day yet.</p>}
                  {tab.vehicles.map((v) => (
                    <Row key={v.id} title={v.vehicle_no || "Vehicle"} disabled={off} onRemove={() => sd.removeVehicle(dt, v.id)}>
                      <Cell label="Vehicle no." disabled={off} value={v.vehicle_no} onSave={(x) => sd.editVehicle(dt, v.id, { vehicle_no: x })} />
                      <Cell label="Type" disabled={off} value={v.vehicle_type} onSave={(x) => sd.editVehicle(dt, v.id, { vehicle_type: x })} />
                      <Cell label="Vendor" disabled={off} value={v.vendor} onSave={(x) => sd.editVehicle(dt, v.id, { vendor: x })} />
                      <Cell label="Driver" disabled={off} value={v.driver} onSave={(x) => sd.editVehicle(dt, v.id, { driver: x })} />
                      <Cell label="Report time" type="time" disabled={off} value={hhmm(v.report_time)} onSave={(x) => sd.editVehicle(dt, v.id, { report_time: x })} />
                      <Cell label="Start km" type="number" min="0" disabled={off} value={v.km_start ?? ""} onSave={(x) => sd.editVehicle(dt, v.id, { km_start: x === "" ? null : Number(x) })} />
                      <Cell label="End km" type="number" min="0" disabled={off} value={v.km_end ?? ""} onSave={(x) => sd.editVehicle(dt, v.id, { km_end: x === "" ? null : Number(x) })} />
                      <Cell label="Amount (₹)" type="number" min="0" disabled={off} value={paiseToRupees(v.amount_paise)} onSave={(x) => sd.editVehicle(dt, v.id, { amount_paise: rupees(x) })} />
                    </Row>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-ink/50">Expenses</h4>
                  {canEdit && <Button variant="outline" className="!px-3 !py-1.5 !text-xs" onClick={() => setModal("expense")}>+ Expense</Button>}
                </div>
                {tab.expenses.length === 0 && <p className="rounded-lg bg-mist/60 p-3 text-sm text-ink/55">No expenses for this team.</p>}
                {tab.expenses.map((x) => (
                  <Row key={x.id} title={x.description} disabled={off} onRemove={() => sd.removeExpense(dt, x.id)}>
                    <Cell label="Item" disabled={off} value={x.description} onSave={(v) => v.trim() && sd.editExpense(dt, x.id, { description: v.trim() })} />
                    <Cell label="Vendor" disabled={off} value={x.vendor} onSave={(v) => sd.editExpense(dt, x.id, { vendor: v })} />
                    <Cell label="Qty" disabled={off} value={x.quantity} onSave={(v) => sd.editExpense(dt, x.id, { quantity: v })} />
                    <Cell label="Amount (₹)" type="number" min="0" disabled={off} value={paiseToRupees(x.amount_paise)} onSave={(v) => sd.editExpense(dt, x.id, { amount_paise: rupees(v) })} />
                    <Pick label="Paid by" disabled={off} value={x.pay_mode} onSave={(v) => sd.editExpense(dt, x.id, { pay_mode: v })} options={PAY_MODES} />
                    <Tick label="Bill available" disabled={off} checked={x.has_bill} onSave={(v) => sd.editExpense(dt, x.id, { has_bill: v })} />
                    <Cell className="col-span-2" label="Remarks" disabled={off} value={x.remarks} onSave={(v) => sd.editExpense(dt, x.id, { remarks: v })} />
                  </Row>
                ))}
              </div>

              {canEdit && (
                <button disabled={!online} onClick={removeTeam} title={online ? "" : "Needs internet"} className="cursor-pointer text-xs font-semibold text-brand hover:underline disabled:cursor-not-allowed disabled:opacity-40">
                  Remove this team from the day
                </button>
              )}
            </>
          )}
        </div>
      )}

      {modal === "person" && tab && <AddPersonModal sd={sd} row={row} tab={tab} onClose={() => setModal(null)} />}
      {modal === "time" && tab && (
        <FormModal
          title="Set time for everyone"
          submitLabel="Apply"
          fields={[
            { name: "time_in", label: "Time in", type: "time", required: true },
            { name: "time_out", label: "Time out", type: "time", required: true },
          ]}
          initial={{ time_in: hhmm(tab.team.default_in_time) || "21:00", time_out: hhmm(tab.team.default_out_time) || "09:00" }}
          onSubmit={(v) => {
            sd.bulk(dt, { action: "apply_time", time_in: v.time_in, time_out: v.time_out });
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "vehicle" && (
        <FormModal
          title="Add vehicle"
          fields={[
            { name: "vehicle_no", label: "Vehicle number", required: true },
            { name: "vehicle_type", label: "Type" },
            { name: "vendor", label: "Vendor" },
            { name: "driver", label: "Driver / attendant" },
          ]}
          onSubmit={(v) => {
            const body = {};
            Object.entries(v).forEach(([k, val]) => val.trim() && (body[k] = val.trim()));
            sd.addVehicle(dt, body);
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "expense" && (
        <FormModal
          title="Add expense"
          fields={[
            { name: "description", label: "Item", required: true },
            { name: "vendor", label: "Vendor" },
            { name: "amount", label: "Amount (₹)", type: "number", min: 0 },
            { name: "pay_mode", label: "Paid by", as: "select", options: PAY_MODES, required: true },
          ]}
          initial={{ pay_mode: "cash_voucher" }}
          onSubmit={(v) => {
            sd.addExpense(dt, { description: v.description.trim(), vendor: v.vendor.trim(), amount_paise: rupees(v.amount), has_bill: true, pay_mode: v.pay_mode || "cash_voucher" });
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </details>
  );
}
