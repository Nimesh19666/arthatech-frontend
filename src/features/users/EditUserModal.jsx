import { useState } from "react";
import * as usersApi from "../../api/users";
import { Alert, Button, Field, Modal } from "../../components/ui.jsx";
import { errorText, fieldError } from "../../lib/errors.js";
import { ROLES, isPlatformRole } from "../../lib/roles.js";

/** Edit one person's name and email, and this role (hat): its type and whether it is switched on. */
export default function EditUserModal({ target, onClose, onSaved }) {
  const [form, setForm] = useState({
    full_name: target.name || "",
    email: target.email || "",
    role_code: target.roleCode || "",
    role_active: target.profileActive !== false,
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // Only roles of the same kind (platform / house) make sense here
  const sameKind = ROLES.filter((r) => r.code !== "super_admin" && isPlatformRole(r.code) === isPlatformRole(target.roleCode));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const person = {};
      if (form.full_name.trim() !== (target.name || "")) person.full_name = form.full_name.trim();
      if (form.email.trim() !== (target.email || "")) person.email = form.email.trim();
      if (Object.keys(person).length) await usersApi.updateUser(target.userId, person);

      if (target.profileId) {
        const profile = {};
        if (form.role_code && form.role_code !== target.roleCode) profile.role_code = form.role_code;
        if (form.role_active !== (target.profileActive !== false)) profile.is_active = form.role_active;
        if (Object.keys(profile).length) await usersApi.updateProfile(target.profileId, profile);
      }
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Edit user" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error && errorText(error)}</Alert>
        <Field label="Full name" value={form.full_name} onChange={set("full_name")} error={fieldError(error, "full_name")} />
        <Field label="Email" type="email" required value={form.email} onChange={set("email")} error={fieldError(error, "email")} />
        {target.profileId && (
          <>
            <Field label="Role" as="select" value={form.role_code} onChange={set("role_code")} error={fieldError(error, "role_code")}>
              {sameKind.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </Field>
            <label className="flex cursor-pointer items-start gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.role_active}
                onChange={(e) => setForm((f) => ({ ...f, role_active: e.target.checked }))}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span>
                This role is active
                <span className="block text-xs font-normal text-ink/55">
                  Switch off to stop only this role. The person's other roles keep working.
                </span>
              </span>
            </label>
          </>
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={busy} className="flex-1">
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
