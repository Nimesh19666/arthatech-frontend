import { useCallback, useEffect, useState } from "react";
import * as usersApi from "../api/users";
import { useAuth } from "../features/auth/AuthContext.jsx";
import CreateUserModal from "../features/users/CreateUserModal.jsx";
import EditUserModal from "../features/users/EditUserModal.jsx";
import PasswordModal from "../features/users/PasswordModal.jsx";
import PermissionsModal from "../features/users/PermissionsModal.jsx";
import { Alert, Badge, Button, Spinner } from "../components/ui.jsx";
import { CardsSkeleton, RowsSkeleton, TableRowsSkeleton } from "../components/Skeleton.jsx";
import { useToast } from "../components/Toast.jsx";
import { useConfirm } from "../components/Confirm.jsx";
import { errorText } from "../lib/errors.js";
import { fmtDateTime } from "../lib/projectMeta.js";
import { ROLES, roleName } from "../lib/roles.js";

export default function UsersPage() {
  const { can, user: me } = useAuth();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [orgId, setOrgId] = useState("");
  const [orgs, setOrgs] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { success: setNotice } = useToast(); // shows a pop-up message
  const [busyKey, setBusyKey] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [secret, setSecret] = useState(null); // { title, email, password } - cleared when the modal closes
  const [permFor, setPermFor] = useState(null);
  const [editFor, setEditFor] = useState(null);

  useEffect(() => {
    usersApi
      .listOrganisations()
      .then((d) => setOrgs(Array.isArray(d) ? d : d?.results || []))
      .catch(() => setOrgs([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await usersApi.listUsers({ search: search.trim(), role_code: role, organisation_id: orgId });
      setRows(usersApi.normalizeUsers(data));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [search, role, orgId]);

  // Wait a little while the person types in the search box
  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const canCreate = can("users.create.user") || can("users.create.admin");
  const suffix = (u) => (u.roleCode === "admin" ? "admin" : "user");

  async function removeUser(u) {
    const ok = await confirm({
      title: `Delete ${u.name || u.email}?`,
      message:
        "This removes the person and ALL their roles, project links and extra permissions. If they have activity history, only their personal data is wiped and a blank record stays for the audit log.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setBusyKey(u.key);
    setError(null);
    try {
      const res = await usersApi.deleteUser(u.userId);
      setNotice(
        res?.result === "anonymised"
          ? `${u.email} had history, so their data was wiped and a blank record was kept`
          : `Deleted: ${u.email}`
      );
      await load();
    } catch (e) {
      setError(e);
    } finally {
      setBusyKey(null);
    }
  }

  async function run(u, action, doneText) {
    if (action === "deactivate") {
      const ok = await confirm({
        title: "Deactivate this person?",
        message: `${u.email} will not be able to log in until you activate them again.`,
        confirmLabel: "Deactivate",
      });
      if (!ok) return;
    }
    setBusyKey(u.key);
    setNotice("");
    setError(null);
    try {
      if (action === "reset") {
        const res = await usersApi.resetPassword(u.userId);
        setSecret({ title: "Password reset", email: u.email, password: res.generated_password });
      } else {
        await usersApi.userAction(u.userId, action);
        setNotice(`${doneText}: ${u.email}`);
        await load();
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Admin</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Users</h1>
        </div>
        {canCreate && <Button onClick={() => setShowCreate(true)}>+ New user</Button>}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          className="input sm:max-w-xs"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input sm:max-w-[12rem]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </select>
        <select className="input sm:max-w-[12rem]" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
          <option value="">All houses</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <Alert>{error && errorText(error)}</Alert>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[56rem] text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wider text-ink/45">
              <th className="px-4 py-3 font-bold">User</th>
              <th className="px-4 py-3 font-bold">Role</th>
              <th className="px-4 py-3 font-bold">House / project</th>
              <th className="px-4 py-3 font-bold">Status</th>
              <th className="px-4 py-3 font-bold">Last login</th>
              <th className="px-4 py-3 text-right font-bold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && (
              <TableRowsSkeleton cols={6} />
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/50">
                  No users found.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((u) => {
                const busy = busyKey === u.key;
                const act = "cursor-pointer rounded-md px-2 py-1 text-xs font-semibold hover:bg-mist disabled:opacity-40";
                return (
                  <tr key={u.key} className="align-middle">
                    <td className="px-4 py-3">
                      <p className="font-bold">{u.name || "—"}</p>
                      <p className="text-xs text-ink/50">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">{u.roleName || roleName(u.roleCode)}</td>
                    <td className="px-4 py-3 text-ink/60">
                      <p>{u.orgName || "Platform"}</p>
                      {(u.projectName || u.teams.length > 0) && (
                        <p className="text-xs text-ink/45">
                          {[u.projectName, u.teams.map((t) => t.name).join(", ")].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="space-y-1 px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={u.active ? "dark" : "neutral"}>{u.active ? "Active" : "Inactive"}</Badge>
                        {u.locked && <Badge tone="red">Locked</Badge>}
                      </div>
                      {u.mustChange && <Badge tone="red">Must change password</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-ink/60">
                      {u.lastLogin ? fmtDateTime(u.lastLogin) : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-1">
                        {canCreate && (
                          <button disabled={busy} className={act} onClick={() => setEditFor(u)}>
                            Edit
                          </button>
                        )}
                        {can(`users.reset_password.${suffix(u)}`) && (
                          <button disabled={busy} className={act} onClick={() => run(u, "reset")}>
                            Reset password
                          </button>
                        )}
                        {can(`users.deactivate.${suffix(u)}`) && (
                          <>
                            <button
                              disabled={busy}
                              className={act}
                              onClick={() => run(u, u.locked ? "unlock" : "lock", u.locked ? "Unlocked" : "Locked")}
                            >
                              {u.locked ? "Unlock" : "Lock"}
                            </button>
                            <button
                              disabled={busy}
                              className={`${act} ${u.active ? "text-brand" : ""}`}
                              onClick={() => run(u, u.active ? "deactivate" : "activate", u.active ? "Deactivated" : "Activated")}
                            >
                              {u.active ? "Deactivate" : "Activate"}
                            </button>
                          </>
                        )}
                        {can(`users.delete.${suffix(u)}`) && String(u.userId) !== String(me?.id) && (
                          <button disabled={busy} className={`${act} text-brand`} onClick={() => removeUser(u)}>
                            Delete
                          </button>
                        )}
                        {can("profile_permission.manage") && u.profileId && (
                          <button disabled={busy} className={act} onClick={() => setPermFor(u)}>
                            Permissions
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={({ email, password }) => {
            setShowCreate(false);
            setSecret({ title: "User created", email, password });
            load();
          }}
        />
      )}
      {editFor && (
        <EditUserModal
          target={editFor}
          onClose={() => setEditFor(null)}
          onSaved={() => {
            setNotice(`Saved: ${editFor.email}`);
            setEditFor(null);
            load();
          }}
        />
      )}
      {secret && <PasswordModal {...secret} onClose={() => setSecret(null)} />}
      {permFor && (
        <PermissionsModal
          target={permFor}
          onClose={() => setPermFor(null)}
          onSaved={() => {
            setNotice(`Permissions saved: ${permFor.email}`);
            setPermFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}
