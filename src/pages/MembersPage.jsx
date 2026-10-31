import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import * as houses from "../api/houses";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useLoad } from "../lib/useLoad.js";
import { Alert, Badge, Button } from "../components/ui.jsx";
import { ActionBtn, Table } from "../components/Table.jsx";
import FormModal from "../components/FormModal.jsx";
import { errorText } from "../lib/errors.js";

const FIELDS = [
  { name: "name", label: "Full name", required: true },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "job_title", label: "Job title", hint: "For example: Gaffer" },
  { name: "is_team_head", type: "checkbox", label: "This person is the Team Head (only one per team)" },
];

function toBody(v) {
  return {
    name: v.name.trim(),
    phone: v.phone.trim(),
    job_title: v.job_title.trim(),
    is_team_head: Boolean(v.is_team_head),
  };
}

export default function MembersPage() {
  const { teamId } = useParams();
  const state = useLocation().state || {};
  const teamName = state.name || `Team #${teamId}`;
  const { can } = useAuth();
  const { data, loading, error, setError, reload } = useLoad(() => houses.listMembers(teamId), [teamId]);
  const [modal, setModal] = useState(null); // { type: "create" | "edit", row? }
  const [notice, setNotice] = useState("");

  async function finish(message) {
    setModal(null);
    setNotice(message);
    await reload();
  }

  async function setActive(m, active) {
    setNotice("");
    try {
      await houses.updateMember(m.id, { is_active: active });
      await finish(`${m.name} ${active ? "activated" : "deactivated"}`);
    } catch (e) {
      setError(e);
    }
  }

  async function remove(m) {
    if (!window.confirm(`Delete ${m.name}? This only works if they have no pay rates. Otherwise deactivate them.`)) return;
    setNotice("");
    try {
      await houses.deleteMember(m.id);
      await finish(`Deleted ${m.name}`);
    } catch (e) {
      setError(e);
    }
  }

  const manage = can("team.manage");

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
            /{" "}
            {state.projectId ? (
              <Link
                to={`/projects/${state.projectId}`}
                state={{ name: state.projectName, orgId: state.orgId, houseName: state.houseName }}
                className="hover:text-brand"
              >
                {state.projectName || "Project"}
              </Link>
            ) : (
              "Project"
            )}{" "}
            / {teamName}
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Members</h1>
        </div>
        {manage && <Button onClick={() => setModal({ type: "create" })}>+ Add member</Button>}
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      <Alert>{error && errorText(error)}</Alert>

      <Table heads={["Member", "Job title", "Status", "Actions"]} loading={loading} isEmpty={data.length === 0} empty="No members yet.">
        {data.map((m) => {
          const active = m.is_active ?? true;
          return (
            <tr key={m.id}>
              <td className="px-4 py-3">
                <p className="font-bold">{m.name}</p>
                <p className="text-xs text-ink/50">{m.phone || "No phone"}</p>
              </td>
              <td className="px-4 py-3">{m.job_title || "—"}</td>
              <td className="space-x-1 px-4 py-3">
                <Badge tone={active ? "dark" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>
                {m.is_team_head && <Badge tone="red">Team Head</Badge>}
                {m.has_login && <Badge>Has login</Badge>}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap justify-end gap-1">
                  {manage && <ActionBtn onClick={() => setModal({ type: "edit", row: m })}>Edit</ActionBtn>}
                  {manage && (
                    <ActionBtn onClick={() => setActive(m, !active)}>{active ? "Deactivate" : "Activate"}</ActionBtn>
                  )}
                  {manage && (
                    <ActionBtn danger onClick={() => remove(m)}>
                      Delete
                    </ActionBtn>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      {modal?.type === "create" && (
        <FormModal
          title="Add member"
          submitLabel="Add"
          fields={FIELDS}
          onSubmit={async (v) => {
            await houses.addMember(teamId, toBody(v));
            await finish("Member added");
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <FormModal
          title="Edit member"
          fields={FIELDS}
          initial={{
            name: modal.row.name,
            phone: modal.row.phone || "",
            job_title: modal.row.job_title || "",
            is_team_head: Boolean(modal.row.is_team_head),
          }}
          onSubmit={async (v) => {
            await houses.updateMember(modal.row.id, toBody(v));
            await finish("Member saved");
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
