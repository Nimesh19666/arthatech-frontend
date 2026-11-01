import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import * as authApi from "../api/auth";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { Alert, Button, Field } from "../components/ui.jsx";
import { errorText, fieldError } from "../lib/errors.js";
import { takeExpired } from "../api/client";

/** Password box with a show / hide eye button */
function PasswordField({ label, error, ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold">{label}</span>
        <span className="relative block">
          <input {...props} type={show ? "text" : "password"} className={`input !pr-11 ${error ? "input-error" : ""}`} />
          <button
            type="button"
            onClick={() => setShow(!show)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="absolute inset-y-0 right-0 grid w-11 cursor-pointer place-items-center text-ink/50 hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {show ? (
                <>
                  <path d="M3 3l18 18" />
                  <path d="M10.6 6.1A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.2 3.9M6.6 7.6A17 17 0 0 0 2.5 12S6 18 12 18c1.4 0 2.6-.3 3.7-.8" />
                  <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                </>
              ) : (
                <>
                  <path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6S2.5 12 2.5 12z" />
                  <circle cx="12" cy="12" r="3" />
                </>
              )}
            </svg>
          </button>
        </span>
        {error && <span className="mt-1 block text-xs font-medium text-brand">{error}</span>}
      </label>
    </div>
  );
}

// Steps: credentials -> (change password) -> (pick role) -> (email code) -> in
export default function LoginPage() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [expired] = useState(() => takeExpired()); // true when the session ended by itself
  const [step, setStep] = useState("credentials");
  const [stage, setStage] = useState(null); // stage_token: memory only, never stored
  const [profiles, setProfiles] = useState([]);
  const [lastId, setLastId] = useState(null);
  const [chosen, setChosen] = useState(null);
  const [emailHint, setEmailHint] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");

  // 60 second wait between "resend code" clicks
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (status === "authed") return <Navigate to={location.state?.from || "/"} replace />;

  function backToLogin(e) {
    setStep("credentials");
    setStage(null);
    setPassword("");
    setNewPassword("");
    setOtp("");
    setError(e || null);
  }

  // One place to react to error codes
  function handleError(e) {
    if (e.code === "stage_invalid" || e.code === "token_invalid") return backToLogin(e);
    setError(e);
  }

  async function run(fn) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function choose(profile, stageToken, code) {
    setChosen(profile);
    const res = await authApi.selectProfile(stageToken, profile.profile_id, code);
    if (res.status === "otp_required") {
      setEmailHint(res.email_hint || "");
      setCooldown(60); // a code was just sent
      setOtp("");
      setStep("otp");
      return;
    }
    await signIn(res); // saves tokens and loads /auth/me
    navigate(location.state?.from || "/", { replace: true });
  }

  async function afterStage(stageToken, list, last) {
    if (list.length === 1) return choose(list[0], stageToken); // only one hat: skip the picker
    setStep("hat");
  }

  const submitCredentials = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await authApi.login(email.trim(), password);
      setStage(res.stage_token);
      setProfiles(res.profiles || []);
      setLastId(res.last_profile_id ?? null);
      setPassword("");
      if (res.must_change_password) setStep("change");
      else await afterStage(res.stage_token, res.profiles || [], res.last_profile_id);
    });
  };

  const submitNewPassword = (e) => {
    e.preventDefault();
    run(async () => {
      const res = await authApi.changePasswordFirst(stage, newPassword);
      setStage(res.stage_token);
      setNewPassword("");
      await afterStage(res.stage_token, profiles, lastId);
    });
  };

  const submitOtp = (e) => {
    e.preventDefault();
    run(() => choose(chosen, stage, otp));
  };

  const resend = () =>
    run(async () => {
      const res = await authApi.resendOtp(stage);
      setEmailHint(res.email_hint || emailHint);
      setCooldown(60);
    });

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-ink p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand" />
        <div aria-hidden className="absolute -right-10 top-24 h-40 w-40 rounded-full border-2 border-white/15" />
        <div className="relative flex items-center gap-2 text-xl font-black tracking-tight">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand">A</span>
          Artha<span className="text-brand">Tech</span>
        </div>
        <div className="relative">
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight">
            Every rupee of
            <br />
            your film, <span className="text-brand">live.</span>
          </h1>
          <p className="mt-5 max-w-sm text-white/60">
            Budget, daily crew work, expenses, approvals and payments in one place. No more Excel and WhatsApp.
          </p>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} ArthaTech</p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-white p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 text-xl font-black lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-white">A</span>
            Artha<span className="text-brand">Tech</span>
          </div>

          {step === "credentials" && expired && !error && (
            <Alert tone="info" className="mb-4">
              You were logged out because your session ended. Please sign in again.
            </Alert>
          )}
          {step === "credentials" && (
            <form onSubmit={submitCredentials} className="space-y-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Sign in</h2>
                <p className="mt-1 text-sm text-ink/60">Use your email and password.</p>
              </div>
              <Alert>{error && errorText(error)}</Alert>
              <Field
                label="Email"
                type="email"
                autoComplete="username"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={fieldError(error, "email")}
              />
              <PasswordField
                label="Password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={fieldError(error, "password")}
              />
              <Button type="submit" loading={busy} className="w-full">
                Continue
              </Button>
            </form>
          )}

          {step === "change" && (
            <form onSubmit={submitNewPassword} className="space-y-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Set a new password</h2>
                <p className="mt-1 text-sm text-ink/60">You must change your password before you continue.</p>
              </div>
              <Alert>{error && errorText(error)}</Alert>
              <PasswordField
                label="New password"
                autoComplete="new-password"
                required
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                error={fieldError(error, "new_password")}
              />
              <Button type="submit" loading={busy} className="w-full">
                Save and continue
              </Button>
            </form>
          )}

          {step === "hat" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Choose your role</h2>
                <p className="mt-1 text-sm text-ink/60">You can switch later without signing in again.</p>
              </div>
              <Alert>{error && errorText(error)}</Alert>
              <div className="space-y-2">
                {profiles.map((p) => (
                  <button
                    key={p.profile_id}
                    disabled={busy}
                    onClick={() => run(() => choose(p, stage))}
                    className="flex w-full cursor-pointer items-center justify-between rounded-xl border border-line p-4 text-left transition hover:border-brand hover:bg-brand-light disabled:opacity-50"
                  >
                    <span>
                      <span className="block font-bold">{p.role_name}</span>
                      <span className="block text-sm text-ink/55">{p.organisation_name || "Platform"}</span>
                    </span>
                    {p.profile_id === lastId && (
                      <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold text-white">Last used</span>
                    )}
                  </button>
                ))}
              </div>
              <button onClick={() => backToLogin()} className="cursor-pointer text-sm font-semibold text-ink/60 hover:text-brand">
                ← Use a different account
              </button>
            </div>
          )}

          {step === "otp" && (
            <form onSubmit={submitOtp} className="space-y-4">
              <div>
                <h2 className="text-3xl font-black tracking-tight">Check your email</h2>
                <p className="mt-1 text-sm text-ink/60">
                  We sent a 6-digit code to <b className="text-ink">{emailHint}</b>. It works for 5 minutes, once.
                </p>
              </div>
              <Alert>{error && errorText(error)}</Alert>
              <Field
                autoFocus
                label="Code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                className="tracking-[0.4em]"
              />
              <Button type="submit" loading={busy} disabled={otp.length !== 6} className="w-full">
                Verify and sign in
              </Button>
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={resend}
                  disabled={cooldown > 0 || busy}
                  className="cursor-pointer font-semibold text-brand disabled:cursor-not-allowed disabled:text-ink/40"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  onClick={() => (profiles.length > 1 ? (setError(null), setStep("hat")) : backToLogin())}
                  className="cursor-pointer font-semibold text-ink/60 hover:text-brand"
                >
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
