import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import * as houses from "../api/houses";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useLoad } from "../lib/useLoad.js";
import { Alert, Badge, Button } from "../components/ui.jsx";
import { ActionBtn, Table } from "../components/Table.jsx";
import FormModal from "../components/FormModal.jsx";
import { errorText } from "../lib/errors.js";

const TYPES = [
  { value: "movie", label: "Movie" },
  { value: "ott_series", label: "OTT series" },
  { value: "ad", label: "Ad" },
  { value: "other", label: "Other" },
];
const STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "wrapped", label: "Wrapped" },
  { value: "closed", label: "Closed" },
];
const label = (list, value) => list.find((x) => x.value === value)?.label || value || "—";

const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const FIELDS = [
  { name: "name", label: "Project name", required: true },
  { name: "project_type", label: "Type", as: "select", options: TYPES, required: true },
  { name: "status", label: "Status", as: "select", options: STATUSES },
  { name: "start_date", label: "Start date", type: "date" },
  { name: "end_date", label: "End date", type: "date" },
];

// Send only the fields that have a value
function toBody(v) {
  const body = { name: v.name.trim(), project_type: v.project_type };
  if (v.status) body.status = v.status;
  if (v.start_date) body.start_date = v.start_date;
  if (v.end_date) body.end_date = v.end_date;
  return body;
}

export default function ProjectsPage() {
  const { orgId } = useParams();
  const houseName = useLocation().state?.name || `House #${orgId}`;
  const { can } = useAuth();
  const { data, loading, error, setError, reload } = useLoad(() => houses.listProjects(orgId), [orgId]);
  const [modal, setModal] = useState(null); // { type: "create" | "edit", row? }
  const [notice, setNotice] = useState("");

  async function finish(message) {
    setModal(null);
    setNotice(message);
    await reload();
  }

  async function remove(p) {
    if (!window.confirm(`Delete ${p.name}? This only works if it has no teams or expenses.`)) return;
    setNotice("");
    try {
      await houses.deleteProject(p.id);
      await finish(`Deleted ${p.name}`);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink/55">
            <Link to="/houses" className="hover:text-brand">
              Houses
            </Link>{" "}
            / {houseName}
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Projects</h1>
        </div>
        {can("project.create") && <Button onClick={() => setModal({ type: "create" })}>+ New project</Button>}
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      <Alert>{error && errorText(error)}</Alert>

      <Table heads={["Project", "Type", "Status", "Dates", "Actions"]} loading={loading} isEmpty={data.length === 0} empty="No projects yet.">
        {data.map((p) => (
          <tr key={p.id}>
            <td className="px-4 py-3 font-bold">{p.name}</td>
            <td className="px-4 py-3">{label(TYPES, p.project_type)}</td>
            <td className="px-4 py-3">
              <Badge tone={p.status === "active" ? "dark" : "neutral"}>{label(STATUSES, p.status)}</Badge>
            </td>
            <td className="px-4 py-3 text-ink/60">
              {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
            </td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap justify-end gap-1">
                <Link
                  to={`/projects/${p.id}`}
                  state={{ name: p.name, orgId, houseName }}
                  className="rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-light"
                >
                  Teams →
                </Link>
                {can("project.create") && <ActionBtn onClick={() => setModal({ type: "edit", row: p })}>Edit</ActionBtn>}
                {can("project.create") && (
                  <ActionBtn danger onClick={() => remove(p)}>
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
          title="New project"
          submitLabel="Create"
          fields={FIELDS}
          initial={{ project_type: "movie", status: "draft" }}
          onSubmit={async (v) => {
            await houses.createProject(orgId, toBody(v));
            await finish("Project created");
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <FormModal
          title="Edit project"
          fields={FIELDS}
          initial={{
            name: modal.row.name,
            project_type: modal.row.project_type,
            status: modal.row.status,
            start_date: modal.row.start_date || "",
            end_date: modal.row.end_date || "",
          }}
          onSubmit={async (v) => {
            await houses.updateProject(modal.row.id, toBody(v));
            await finish("Project saved");
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
