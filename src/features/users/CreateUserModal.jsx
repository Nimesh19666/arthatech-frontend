import { useEffect, useState } from "react";
import * as usersApi from "../../api/users";
import * as houses from "../../api/houses";
import { useAuth } from "../auth/AuthContext.jsx";
import { Alert, Button, Field, Modal } from "../../components/ui.jsx";
import { errorText, fieldError } from "../../lib/errors.js";
import { ROLES, isPlatformRole } from "../../lib/roles.js";
import PermissionPicker from "./PermissionPicker.jsx";

const hasLogin = (m) => Boolean(m.has_login || m.user_id || m.user);

export default function CreateUserModal({
  onClose,
  onCreated,
  presetOrgId,
  presetProjectId,
  presetTeamId,
  presetMemberId,
  presetRole,
  presetName,
}) {
  const { can } = useAuth();
  const [form, setForm] = useState({
    email: "",
    full_name: presetName || "",
    role_code: presetRole || "producer",
    organisation_id: presetOrgId ? String(presetOrgId) : "",
    project_id: presetProjectId ? String(presetProjectId) : "",
    team_ids: "",
    team_id: presetTeamId ? String(presetTeamId) : "",
    member_id: presetMemberId ? String(presetMemberId) : "",
  });
  const [orgs, setOrgs] = useState([]);
  const [teams, setTeams] = useState([]);
  const [members, setMembers] = useState([]);
  const [extra, setExtra] = useState({});
  const [showPerms, setShowPerms] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const platform = isPlatformRole(form.role_code);
  const teamHead = form.role_code === "team_head";

  // Only offer roles this person may create. (Super Admin accounts are not created here.)
  const allRoles = ROLES.filter((r) => r.code !== "super_admin" && (r.code !== "admin" || can("users.create.admin")));
  // Inside a house, only house roles make sense
  const baseRoles = presetOrgId ? allRoles.filter((r) => !isPlatformRole(r.code)) : allRoles;
  const roles = presetRole ? baseRoles.filter((r) => r.code === presetRole) : baseRoles;

  useEffect(() => {
    usersApi
      .listOrganisations()
      .then((d) => setOrgs(Array.isArray(d) ? d : d?.results || []))
      .catch(() => setOrgs([]));
  }, []);

  const selectedOrg = orgs.find((o) => String(o.id) === String(form.organisation_id));
  const projects = selectedOrg?.projects || [];

  // Team Head: teams of the chosen project
  useEffect(() => {
    if (!teamHead || !form.project_id) {
      setTeams([]);
      return;
    }
    houses
      .listTeams(form.project_id)
      .then((d) => setTeams(houses.asList(d)))
      .catch(() => setTeams([]));
  }, [teamHead, form.project_id]);

  // Team Head: members of the chosen team
  useEffect(() => {
    if (!teamHead || !form.team_id) {
      setMembers([]);
      return;
    }
    houses
      .listMembers(form.team_id)
      .then((d) => setMembers(houses.asList(d)))
      .catch(() => setMembers([]));
  }, [teamHead, form.team_id]);

  function changeHouse(e) {
    setForm((f) => ({ ...f, organisation_id: e.target.value, project_id: "", team_id: "", member_id: "" }));
  }
  function changeProject(e) {
    setForm((f) => ({ ...f, project_id: e.target.value, team_id: "", member_id: "" }));
  }
  function changeTeam(e) {
    setForm((f) => ({ ...f, team_id: e.target.value, member_id: "" }));
  }
  function changeMember(e) {
    const id = e.target.value;
    const m = members.find((x) => String(x.id) === id);
    setForm((f) => ({ ...f, member_id: id, full_name: m && !f.full_name ? m.name : f.full_name }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { email: form.email.trim(), role_code: form.role_code };
      if (form.full_name.trim()) body.full_name = form.full_name.trim();
      if (!platform) {
        // Platform roles take NO organisation. House roles need one.
        body.organisation_id = Number(form.organisation_id);
        if (form.project_id) body.project_id = Number(form.project_id);
        if (teamHead) {
          if (form.team_id) body.team_ids = [Number(form.team_id)];
          if (form.member_id) body.team_member_id = Number(form.member_id);
        } else {
          const ids = form.team_ids
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .map(Number);
          if (ids.length) body.team_ids = ids;
        }
      }
      const extraList = Object.entries(extra).map(([code, effect]) => ({ code, effect }));
      if (extraList.length) body.extra_permissions = extraList;

      const res = await usersApi.createUser(body);
      onCreated({ email: body.email, password: res.generated_password });
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const projectHint = !form.organisation_id
    ? "Choose a house first"
    : projects.length === 0
      ? "This house has no projects yet"
      : teamHead
        ? "A Team Head belongs to one project"
        : form.project_id
          ? "This person will only see this project"
          : "Leave empty and this person gets the whole house (every project)";

  return (
    <Modal title={teamHead ? "New Team Head login" : "New user"} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error && errorText(error)}</Alert>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" type="email" required value={form.email} onChange={set("email")} error={fieldError(error, "email")} />
          <Field label="Full name" value={form.full_name} onChange={set("full_name")} error={fieldError(error, "full_name")} />
        </div>

        <Field
          label="Role"
          as="select"
          value={form.role_code}
          onChange={set("role_code")}
          disabled={Boolean(presetRole)}
          error={fieldError(error, "role_code")}
        >
          {roles.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </Field>

        {!platform && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="House"
                as="select"
                required
                disabled={Boolean(presetOrgId)}
                value={form.organisation_id}
                onChange={changeHouse}
                error={fieldError(error, "organisation_id")}
              >
                <option value="">Select a house…</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Field>

              <Field
                label="Project"
                as="select"
                required={teamHead}
                disabled={Boolean(presetProjectId) || !form.organisation_id}
                value={form.project_id}
                onChange={changeProject}
                error={fieldError(error, "project_id")}
                hint={projectHint}
              >
                <option value="">{teamHead ? "Select a project…" : "Whole house (all projects)"}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Field>
            </div>

            {teamHead ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Team"
                  as="select"
                  required
                  disabled={Boolean(presetTeamId) || !form.project_id}
                  value={form.team_id}
                  onChange={changeTeam}
                  error={fieldError(error, "team_ids")}
                  hint={form.project_id && teams.length === 0 ? "This project has no teams yet" : undefined}
                >
                  <option value="">Select a team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Field>
                <Field
                  label="Team member"
                  as="select"
                  required
                  disabled={Boolean(presetMemberId) || !form.team_id}
                  value={form.member_id}
                  onChange={changeMember}
                  error={fieldError(error, "team_member_id")}
                  hint="The person in the team who will log in"
                >
                  <option value="">Select a member…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id} disabled={hasLogin(m)}>
                      {m.name}
                      {m.is_team_head ? " (Team Head)" : ""}
                      {hasLogin(m) ? " — already has a login" : ""}
                    </option>
                  ))}
                </Field>
              </div>
            ) : (
              <Field
                label="Team IDs"
                value={form.team_ids}
                onChange={set("team_ids")}
                error={fieldError(error, "team_ids")}
                hint="Optional, for example 1,2"
              />
            )}
          </>
        )}

        <div>
          <button
            type="button"
            onClick={() => setShowPerms(!showPerms)}
            className="cursor-pointer text-sm font-semibold text-brand hover:underline"
          >
            {showPerms
              ? "− Hide extra permissions"
              : `+ Extra permissions (optional)${Object.keys(extra).length ? ` · ${Object.keys(extra).length} set` : ""}`}
          </button>
          {showPerms && (
            <div className="mt-3">
              <p className="mb-3 text-sm text-ink/60">
                "Allow" adds a permission the role does not normally have. "Deny" removes one it does have. Leave on Default
                to use the role as it is.
              </p>
              <PermissionPicker value={extra} onChange={setExtra} roleCode={form.role_code} />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={busy} className="flex-1">
            Create user
          </Button>
        </div>
      </form>
    </Modal>
  );
}
