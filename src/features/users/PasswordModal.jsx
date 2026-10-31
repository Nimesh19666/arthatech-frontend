import { useState } from "react";
import { Button, Modal } from "../../components/ui.jsx";

/** Shows a generated password ONCE. The parent clears it from state when this closes. */
export default function PasswordModal({ title, email, password, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Modal title={title} dismissible={false} onClose={onClose}>
      <div className="space-y-4">
        {password ? (
          <>
            <p className="text-sm text-ink/70">
              Give this password to <b className="text-ink">{email}</b>. It is shown only once and they must change it at
              next login.
            </p>
            <div className="rounded-xl bg-ink p-4 text-center font-mono text-xl font-bold tracking-wider text-white select-all">
              {password}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={copy} className="flex-1">
                {copied ? "Copied ✓" : "Copy"}
              </Button>
              <Button onClick={onClose} className="flex-1">
                I have noted it
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/70">
              <b className="text-ink">{email}</b> already had an account, so no new password was generated. The new role
              was added to their existing login.
            </p>
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
