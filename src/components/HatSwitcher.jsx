import { useEffect, useState } from "react";
import { Alert, Button, Field, Modal } from "./ui.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { errorText } from "../lib/errors.js";

/** Switch hat without logging in again. Asks for an email code only if the server needs one. */
export default function HatSwitcher() {
  const { profile, otherProfiles, switchProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(null); // profile waiting for an OTP
  const [emailHint, setEmailHint] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [open]);

  async function pick(p, code) {
    setBusy(true);
    setError(null);
    try {
      const res = await switchProfile(p.profile_id, code);
      if (res.status === "otp_required") {
        setTarget(p);
        setEmailHint(res.email_hint || "");
        setOtp("");
      } else {
        setTarget(null);
        setOpen(false);
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  const label = profile ? `${profile.role_name}${profile.organisation_name ? ` · ${profile.organisation_name}` : ""}` : "";
  const canSwitch = otherProfiles.length > 0;

  return (
    <div className="relative min-w-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => canSwitch && setOpen(!open)}
        className={`flex max-w-[10.5rem] items-center sm:max-w-[16rem] gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold ${canSwitch ? "cursor-pointer hover:border-ink" : "cursor-default"}`}
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
        <span className="truncate">{label}</span>
        {canSwitch && <span className="text-xs text-ink/50">▾</span>}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-72 rounded-xl border border-line bg-white p-2 shadow-xl">
          <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-ink/40">Switch role</p>
          {error && !target && <Alert className="m-2">{errorText(error)}</Alert>}
          {otherProfiles.map((p) => (
            <button
              key={p.profile_id}
              disabled={busy}
              onClick={() => pick(p)}
              className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left hover:bg-mist disabled:opacity-50"
            >
              <span className="block text-sm font-semibold">{p.role_name}</span>
              <span className="block text-xs text-ink/50">{p.organisation_name || "Platform"}</span>
            </button>
          ))}
        </div>
      )}

      {target && (
        <Modal title="Enter email code" onClose={() => setTarget(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              pick(target, otp);
            }}
            className="space-y-4"
          >
            <p className="text-sm text-ink/70">
              {target.role_name} needs a 6-digit code. We sent it to <b>{emailHint}</b>.
            </p>
            <Alert>{error && errorText(error)}</Alert>
            <Field
              label="Code"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
            <Button type="submit" loading={busy} disabled={otp.length !== 6} className="w-full">
              Switch role
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
