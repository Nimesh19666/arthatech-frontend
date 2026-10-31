import { useState } from "react";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { Alert, Button, Field } from "../components/ui.jsx";
import { errorText, fieldError } from "../lib/errors.js";

export default function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && confirm !== newPassword;

  async function submit(e) {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await changePassword(oldPassword, newPassword);
      setOldPassword("");
      setNewPassword("");
      setConfirm("");
      setDone(true);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-black tracking-tight">Change password</h1>
      <p className="mt-1 text-sm text-ink/60">Other devices will be signed out.</p>

      <form onSubmit={submit} className="mt-6 space-y-4 rounded-2xl border border-line bg-white p-6">
        {done && <Alert tone="success">Password changed.</Alert>}
        <Alert>{error && errorText(error)}</Alert>
        <Field
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          error={error?.code === "bad_password" ? "Wrong password" : fieldError(error, "old_password")}
        />
        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={fieldError(error, "new_password")}
        />
        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? "Passwords do not match" : undefined}
        />
        <Button type="submit" loading={busy} disabled={mismatch} className="w-full">
          Update password
        </Button>
      </form>
    </div>
  );
}
