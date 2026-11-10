import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import * as houses from "../api/houses";
import * as usersApi from "../api/users";
import CreateUserModal from "../features/users/CreateUserModal.jsx";
import PasswordModal from "../features/users/PasswordModal.jsx";
import { roleName } from "../lib/roles.js";
import { Link as RouterLink } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useLoad } from "../lib/useLoad.js";
import { Alert, Badge, Button, Spinner } from "../components/ui.jsx";
import { CardsSkeleton, RowsSkeleton, TableRowsSkeleton } from "../components/Skeleton.jsx";
import { useToast } from "../components/Toast.jsx";
import FormModal from "../components/FormModal.jsx";
import TeamCard from "../features/projects/TeamCard.jsx";
import { errorText } from "../lib/errors.js";
import { formatPaiseShort, rupeesToPaise } from "../lib/money.js";
import { useConfirm } from "../components/Confirm.jsx";
import { DEFAULT_TEAMS } from "../lib/defaultTeams.js";
import { PROJECT_FIELDS, STATUSES, TYPES, fmtDate, label, projectToBody } from "../lib/projectMeta.js";

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const state = useLocation().state || {};
  const { can } = useAuth();
  const confirm = useConfirm();
  // Find this project and its house from the houses list, so a page refresh still works
  const houseQ = useLoad(() => houses.listHouses(), []);
  const house = houseQ.data.find((h) => (h.projects || []).some((p) => String(p.id) === String(projectId)));
  const project = house?.projects?.find((p) => String(p.id) === String(projectId));
  const projectName = project?.name || state.name || `Project #${projectId}`;
  const houseName = house?.name || state.houseName;
  const canProject = can("project.create");
  const teams = useLoad(() => houses.listTeams(projectId), [projectId]);
  const [modal, setModal] = useState(null); // { type: "create" | "edit", row? }
  const { success: setNotice } = useToast(); // shows a pop-up message
  const [showUser, setShowUser] = useState(false);
  const [secret, setSecret] = useState(null);
  const orgId = house?.id ?? state.orgId;
  // People of this house, then keep only the ones assigned to this project
  const people = useLoad(
    async () =>
      orgId
        ? usersApi
            .normalizeUsers(await usersApi.listUsers({ organisation_id: orgId }))
            .filter((u) => String(u.orgId) === String(orgId))
        : [],
    [orgId]
  );
  const projectPeople = people.data.filter((u) => String(u.projectId) === String(projectId));
  const canUser = can("users.create.user") || can("users.create.admin");
  const [openIds, setOpenIds] = useState(null); // null = default (all open when 6 teams or fewer)

  const canManage = can("team.manage");
  const canBudget = can("team.budget.set");
  const canAdvance = can("team.advance.set");
  const list = teams.data;

  const isOpen = (id) => (openIds ? openIds.has(id) : list.length <= 6);
  const toggle = (id) => {
    const next = new Set(openIds ?? (list.length <= 6 ? list.map((t) => t.id) : []));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOpenIds(next);
  };

  const totals = list.reduce(
    (a, t) => ({
      people: a.people + (Number(t.headcount) || 0),
      budget: a.budget + (Number(t.budget_paise) || 0),
      advance: a.advance + (Number(t.advance_paise) || 0),
    }),
    { people: 0, budget: 0, advance: 0 }
  );

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
  const rupees = (paise) => (paise === null || paise === undefined ? "" : String(paise / 100));

  async function finish(message) {
    setModal(null);
    setNotice(message);
    await teams.reload();
  }

  const [seeding, setSeeding] = useState(null); // "3 of 36" while the standard teams are being created

  /** Creates every standard department from the docket that this project does not have yet. */
  async function addStandardTeams() {
    const have = new Set((list || []).map((t) => String(t.name).trim().toLowerCase()));
    const todo = DEFAULT_TEAMS.filter((t) => !have.has(t.name.toLowerCase()));
    if (todo.length === 0) return setNotice("All the standard teams already exist");
    const ok = await confirm({
      title: `Add ${todo.length} standard teams?`,
      message: "These are the standard film departments (Camera, Art, Light, Junior Artists, vehicles and so on). Create them before adding shoot days. Teams added later do not appear on days that already exist.",
      confirmLabel: `Add ${todo.length} teams`,
    });
    if (!ok) return;
    let done = 0;
    try {
      for (const t of todo) {
        setSeeding(`${done + 1} of ${todo.length}`);
        try {
          await houses.createTeam(projectId, { name: t.name, kind: t.kind });
        } catch (e) {
          if (e.status !== 400) throw e; // 400 = already exists, skip it
        }
        done += 1;
      }
      setNotice(`Added ${done} teams`);
    } catch (e) {
      teams.setError(e);
    } finally {
      setSeeding(null);
      await teams.reload();
    }
  }

  async function removeTeam(t) {
    const ok = await confirm({
      title: `Delete team ${t.name}?`,
      message: "This only works if it has no members, expenses or advances.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setNotice("");
    try {
      await houses.deleteTeam(t.id);
      await finish(`Deleted ${t.name}`);
    } catch (e) {
      teams.setError(e);
    }
  }

  const tiles = [
    { label: "Teams", value: list.length },
    { label: "People planned", value: totals.people },
    ...(canBudget ? [{ label: "Team budgets", value: formatPaiseShort(totals.budget) }] : []),
    ...(canAdvance ? [{ label: "Advances", value: formatPaiseShort(totals.advance) }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-ink/55">
            <Link to="/houses" className="hover:text-brand">Houses</Link> /{" "}
            {orgId ? (
              <Link to={`/houses/${orgId}`} state={{ name: houseName }} className="hover:text-brand">
                {houseName || "House"}
              </Link>
            ) : (
              "House"
            )}{" "}
            / {projectName}
          </p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">{projectName}</h1>
          {project && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink/60">
              <Badge tone={project.status === "active" ? "dark" : "neutral"}>{label(STATUSES, project.status)}</Badge>
              <span>{label(TYPES, project.project_type)}</span>
              <span>· {fmtDate(project.start_date)} → {fmtDate(project.end_date)}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {list.length > 1 && (
            <Button variant="outline" onClick={() => setOpenIds(openIds && openIds.size === list.length ? new Set() : new Set(list.map((t) => t.id)))}>
              {openIds && openIds.size === list.length ? "Collapse all" : "Expand all"}
            </Button>
          )}
          {can("shoot_day.view") && (
            <RouterLink to={`/projects/${projectId}/shoot-days`} state={{ name: projectName }} className="inline-flex items-center justify-center rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white hover:opacity-90">
              Shoot days
            </RouterLink>
          )}
          {canProject && project && (
            <Button variant="outline" onClick={() => setModal({ type: "project" })}>
              Edit project
            </Button>
          )}
          {canManage && (
            <Button variant="outline" loading={Boolean(seeding)} onClick={addStandardTeams}>
              {seeding ? `Adding ${seeding}…` : "Add standard teams"}
            </Button>
          )}
          {canManage && <Button onClick={() => setModal({ type: "create" })}>+ New team</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <div key={t.label} className={`rounded-2xl p-5 ${i === 0 ? "bg-ink text-white" : "border border-line bg-white"}`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${i === 0 ? "text-white/50" : "text-ink/45"}`}>{t.label}</p>
            <p className="mt-1 text-2xl font-black tracking-tight">{t.value}</p>
          </div>
        ))}
      </div>

      {/* People assigned to this project only */}
      <div className="rounded-2xl border border-line bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-extrabold">People on this project</h2>
            <p className="text-xs text-ink/55">Producer, Project Manager and others who belong to this project only.</p>
          </div>
          {canUser && orgId && (
            <Button variant="outline" className="!py-2" onClick={() => setShowUser(true)}>
              + Add user to this project
            </Button>
          )}
        </div>
        {!orgId && (
          <p className="mt-3 text-sm text-ink/55">Open this project from its house page to manage its people.</p>
        )}
        {orgId && people.loading && <Spinner className="mt-3 h-5 w-5 text-brand" />}
        {orgId && !people.loading && projectPeople.length === 0 && (
          <p className="mt-3 text-sm text-ink/55">Nobody is assigned to this project yet. Add the Producer first.</p>
        )}
        {projectPeople.length > 0 && (
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {projectPeople.map((u) => (
              <li key={u.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{u.name || u.email}</p>
                  <p className="truncate text-xs text-ink/50">{u.email}</p>
                </div>
                <Badge tone="dark">{u.roleName || roleName(u.roleCode)}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Alert>{teams.error && errorText(teams.error)}</Alert>

      {teams.loading ? (
        <CardsSkeleton count={2} />
      ) : list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-10 text-center">
          <p className="text-lg font-extrabold">No teams yet</p>
          <p className="mt-1 text-sm text-ink/60">Start with the standard film departments, or create your own.</p>
          {canManage && (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button loading={Boolean(seeding)} onClick={addStandardTeams}>{seeding ? `Adding ${seeding}…` : "Add the standard teams"}</Button>
              <Button variant="outline" onClick={() => setModal({ type: "create" })}>+ New team</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              open={isOpen(t.id)}
              onToggle={() => toggle(t.id)}
              canManage={canManage}
              onEdit={() => setModal({ type: "edit", row: t })}
              onDelete={() => removeTeam(t)}
              orgId={orgId}
              projectId={projectId}
              canUser={canUser}
            />
          ))}
        </div>
      )}

      {modal?.type === "project" && project && (
        <FormModal
          title="Edit project"
          fields={PROJECT_FIELDS}
          initial={{
            name: project.name,
            project_type: project.project_type,
            status: project.status,
            start_date: project.start_date || "",
            end_date: project.end_date || "",
          }}
          onSubmit={async (v) => {
            await houses.updateProject(project.id, projectToBody(v));
            setModal(null);
            setNotice("Project saved");
            await houseQ.reload();
          }}
          onClose={() => setModal(null)}
        />
      )}
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
      {showUser && (
        <CreateUserModal
          presetOrgId={orgId}
          presetProjectId={projectId}
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
