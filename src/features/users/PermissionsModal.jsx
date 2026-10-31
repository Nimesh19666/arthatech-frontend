import { useState } from "react";
import * as usersApi from "../../api/users";
import { Alert, Button, Modal } from "../../components/ui.jsx";
import { errorText } from "../../lib/errors.js";
import PermissionPicker from "./PermissionPicker.jsx";

/** Edit one hat's extra permissions. Saving replaces the whole list. */
export default function PermissionsModal({ target, onClose, onSaved }) {
  const [state, setState] = useState(() => {
    const map = {};
    (target.extra || []).forEach((p) => {
      map[p.code] = p.effect;
    });
    return map;
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!target.profileId) {
      setError({
        code: "validation_error",
        message: `No profile id found. The backend sent these fields: ${Object.keys(target.raw || {}).join(", ")}`,
        fields: {},
      });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const permissions = Object.entries(state).map(([code, effect]) => ({
        code,
        effect,
      }));
      await usersApi.setProfilePermissions(target.profileId, permissions);
      onSaved();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Permissions · ${target.name || target.email}`}
      onClose={onClose}
      wide
    >
      <div className="space-y-4">
        <p className="text-sm text-ink/60">
          Role: <b className="text-ink">{target.roleName || target.roleCode}</b>
          . "Allow" adds a permission the role does not have. "Deny" removes one
          it has. Saving replaces the whole list.
        </p>
        <Alert>{error && errorText(error)}</Alert>
        <PermissionPicker
          value={state}
          onChange={setState}
          roleCode={target.roleCode}
        />
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={save} loading={busy} className="flex-1">
            Save ({Object.keys(state).length})
          </Button>
        </div>
      </div>
    </Modal>
  );
}
