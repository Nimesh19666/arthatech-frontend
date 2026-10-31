import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import * as houses from "../api/houses";
import * as usersApi from "../api/users";
import { useAuth } from "../features/auth/AuthContext.jsx";
import CreateUserModal from "../features/users/CreateUserModal.jsx";
import PasswordModal from "../features/users/PasswordModal.jsx";
import { useLoad } from "../lib/useLoad.js";
import { Alert, Badge, Button, Spinner } from "../components/ui.jsx";
import { CardsSkeleton, RowsSkeleton, TableRowsSkeleton } from "../components/Skeleton.jsx";
import { useToast } from "../components/Toast.jsx";
import { ActionBtn } from "../components/Table.jsx";
import FormModal from "../components/FormModal.jsx";
import { errorText } from "../lib/errors.js";
import { roleName } from "../lib/roles.js";
import { useConfirm } from "../components/Confirm.jsx";

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

function toBody(v) {
  const body = { name: v.name.trim(), project_type: v.project_type };
  if (v.status) body.status = v.status;
  if (v.start_date) body.start_date = v.start_date;
  if (v.end_date) body.end_date = v.end_date;
  return body;
}

export default function HouseDetailPage() {
  const { orgId } = useParams();
  const stateName = useLocation().state?.name;
  const { can } = useAuth();
  const confirm = useConfirm();
  const [tab, setTab] = useState("projects");
  const [modal, setModal] = useState(null); // { type: "create" | "edit", row? }
  const [showUser, setShowUser] = useState(false);
  const [secret, setSecret] = useState(null);
  const { success: setNotice } = useToast(); // shows a pop-up message

  // The houses list already includes each house's projects, so one call is enough
  const houseQ = useLoad(() => houses.listHouses(), []);
  const house = houseQ.data.find((h) => String(h.id) === String(orgId));
  const houseName = house?.name || stateName || `House #${orgId}`;
  const projects = {
    data: house?.projects || [],
    loading: houseQ.loading,
    error: houseQ.error,
    setError: houseQ.setError,
    reload: houseQ.reload,
  };
  const people = useLoad(
    async () =>
      usersApi
        .normalizeUsers(await usersApi.listUsers({ organisation_id: orgId }))
        .filter((u) => String(u.orgId) === String(orgId)),
    [orgId]
  );

  const canProject = can("project.create");
  const canUser = can("users.create.user") || can("users.create.admin");

  async function finish(message) {
    setModal(null);
    setNotice(message);
    await projects.reload();
  }

  async function removeProject(p) {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      message: "This only works if it has no teams or expenses.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setNotice("");
    try {
      await houses.deleteProject(p.id);
      await finish(`Deleted ${p.name}`);
    } catch (e) {
      projects.setError(e);
    }
  }

  const hasPeople = people.data.length > 0;
  const hasProjects = projects.data.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-ink/55">
          <Link to="/houses" className="hover:text-brand">Houses</Link> / {houseName}
        </p>
        <h1 className="mt-1 text-4xl font-black tracking-tight">{houseName}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-line">
        {[
          { id: "projects", label: `Projects${hasProjects ? ` (${projects.data.length})` : ""}` },
          { id: "people", label: `People${hasPeople ? ` (${people.data.length})` : ""}` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px cursor-pointer border-b-2 px-4 py-2.5 text-sm font-bold transition ${
              tab === t.id ? "border-brand text-brand" : "border-transparent text-ink/55 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>


      {/* PROJECTS TAB */}
      {tab === "projects" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            {canProject && <Button onClick={() => setModal({ type: "create" })}>+ New project</Button>}
          </div>
          <Alert>{projects.error && errorText(projects.error)}</Alert>
          {projects.loading ? (
            <CardsSkeleton count={2} />
          ) : !hasProjects ? (
            <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-10 text-center text-sm text-ink/60">
              No projects yet.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.data.map((p) => (
                <div
                  key={p.id}
                  className="group relative rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg"
                >
                  {/* The whole card opens the project */}
                  <Link
                    to={`/projects/${p.id}`}
                    state={{ name: p.name, orgId, houseName }}
                    aria-label={`Open ${p.name}`}
                    className="absolute inset-0 rounded-2xl"
                  />
                  <div className="flex items-start justify-between gap-2">
                    <Badge tone={p.status === "active" ? "dark" : "neutral"}>{label(STATUSES, p.status)}</Badge>
                    <span className="text-xs font-semibold text-ink/50">{label(TYPES, p.project_type)}</span>
                  </div>
                  <h3 className="mt-3 text-xl font-extrabold tracking-tight">{p.name}</h3>
                  <p className="mt-1 text-xs text-ink/55">
                    {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                  </p>
                  <div className="relative z-10 mt-4 flex items-center justify-between">
                    <span className="text-sm font-bold text-brand">Open teams →</span>
                    {canProject && (
                      <div className="flex">
                        <ActionBtn onClick={() => setModal({ type: "edit", row: p })}>Edit</ActionBtn>
                        <ActionBtn danger onClick={() => removeProject(p)}>
                          Delete
                        </ActionBtn>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PEOPLE TAB */}
      {tab === "people" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-ink/60">Everyone who can log in to this house.</p>
            <div className="flex gap-2">
              <Link to="/users" className="inline-flex items-center rounded-lg px-3 text-sm font-semibold text-brand hover:bg-brand-light">
                Manage all users →
              </Link>
              {canUser && <Button onClick={() => setShowUser(true)}>+ Add user</Button>}
            </div>
          </div>
          <Alert>{people.error && errorText(people.error)}</Alert>
          {people.loading ? (
            <RowsSkeleton count={4} />
          ) : !hasPeople ? (
            <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-10 text-center text-sm text-ink/60">
              No users in this house yet. Add the Producer first.
            </div>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
              {people.data.map((u) => (
                <li key={u.key} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold">{u.name || u.email}</p>
                    <p className="truncate text-xs text-ink/50">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="dark">{u.roleName || roleName(u.roleCode)}</Badge>
                    <Badge tone="neutral">{u.projectName || "Whole house"}</Badge>
                    {!u.active && <Badge>Inactive</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Popups */}
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
      {showUser && (
        <CreateUserModal
          presetOrgId={orgId}
          onClose={() => setShowUser(false)}
          onCreated={({ email, password }) => {
            setShowUser(false);
            setSecret({ title: "User created", email, password });
            people.reload();
          }}
        />
      )}
      {secret && <PasswordModal {...secret} onClose={() => setSecret(null)} />}
    </div>
  );
}
