import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import * as houses from "../api/houses";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useLoad } from "../lib/useLoad.js";
import { Alert, Button } from "../components/ui.jsx";
import { ActionBtn, Table } from "../components/Table.jsx";
import FormModal from "../components/FormModal.jsx";
import { errorText } from "../lib/errors.js";
import { formatPaise, rupeesToPaise } from "../lib/money.js";

export default function TeamsPage() {
  const { projectId } = useParams();
  const state = useLocation().state || {};
  const projectName = state.name || `Project #${projectId}`;
  const { can } = useAuth();
  const { data, loading, error, setError, reload } = useLoad(() => houses.listTeams(projectId), [projectId]);
  const [modal, setModal] = useState(null); // { type: "create" | "edit", row? }
  const [notice, setNotice] = useState("");

  const canBudget = can("team.budget.set");
  const canAdvance = can("team.advance.set");

  // Money is typed in rupees and sent as whole paise. Only fields this person may set are shown.
  const fields = [
    { name: "name", label: "Team name", required: true },
    { name: "headcount", label: "Headcount", type: "number", min: 0 },
    ...(canBudget ? [{ name: "budget", label: "Team budget (₹)", type: "number", min: 0, hint: "In rupees" }] : []),
    ...(canAdvance ? [{ name: "advance", label: "Advance (₹)", type: "number", min: 0, hint: "In rupees" }] : []),
  ];

  function toBody(v) {
    const body = { name: v.name.trim() };
    if (v.headcount !== "") body.headcount = Number(v.headcount);
    if (canBudget && v.budget !== "") body.budget_paise = rupeesToPaise(v.budget);
    if (canAdvance && v.advance !== "") body.advance_paise = rupeesToPaise(v.advance);
    return body;
  }

  async function finish(message) {
    setModal(null);
    setNotice(message);
    await reload();
  }

  async function remove(t) {
    if (!window.confirm(`Delete team ${t.name}? This only works if it has no members, expenses or advances.`)) return;
    setNotice("");
    try {
      await houses.deleteTeam(t.id);
      await finish(`Deleted ${t.name}`);
    } catch (e) {
      setError(e);
    }
  }

  const rupees = (paise) => (paise === null || paise === undefined ? "" : String(paise / 100));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink/55">
            <Link to="/houses" className="hover:text-brand">
              Houses
            </Link>{" "}
            /{" "}
            {state.orgId ? (
              <Link to={`/houses/${state.orgId}`} state={{ name: state.houseName }} className="hover:text-brand">
                {state.houseName || "House"}
              </Link>
            ) : (
              "House"
            )}{" "}
            / {projectName}
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Teams</h1>
        </div>
        {can("team.manage") && <Button onClick={() => setModal({ type: "create" })}>+ New team</Button>}
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      <Alert>{error && errorText(error)}</Alert>

      <Table heads={["Team", "Headcount", "Budget", "Advance", "Actions"]} loading={loading} isEmpty={data.length === 0} empty="No teams yet.">
        {data.map((t) => (
          <tr key={t.id}>
            <td className="px-4 py-3 font-bold">{t.name}</td>
            <td className="px-4 py-3">{t.headcount ?? "—"}</td>
            <td className="px-4 py-3">{t.budget_paise != null ? formatPaise(t.budget_paise) : "—"}</td>
            <td className="px-4 py-3">{t.advance_paise != null ? formatPaise(t.advance_paise) : "—"}</td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap justify-end gap-1">
                <Link
                  to={`/teams/${t.id}`}
                  state={{ name: t.name, projectId, projectName, orgId: state.orgId, houseName: state.houseName }}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-light"
                >
                  Members →
                </Link>
                {can("team.manage") && <ActionBtn onClick={() => setModal({ type: "edit", row: t })}>Edit</ActionBtn>}
                {can("team.manage") && (
                  <ActionBtn danger onClick={() => remove(t)}>
                    Delete
                  </ActionBtn>
                )}
              </div>
            </td>
          </tr>
        ))}
      </Table>

      {modal?.type === "create" && (
        <FormModal
          title="New team"
          submitLabel="Create"
          fields={fields}
          onSubmit={async (v) => {
            await houses.createTeam(projectId, toBody(v));
            await finish("Team created");
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <FormModal
          title="Edit team"
          fields={fields}
          initial={{
            name: modal.row.name,
            headcount: modal.row.headcount ?? "",
            budget: rupees(modal.row.budget_paise),
            advance: rupees(modal.row.advance_paise),
          }}
          onSubmit={async (v) => {
            await houses.updateTeam(modal.row.id, toBody(v));
            await finish("Team saved");
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
