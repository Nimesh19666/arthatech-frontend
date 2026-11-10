import { rupeesInWords } from "../lib/money.js";
import { useEffect } from "react";

export function Spinner({ className = "h-4 w-4" }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const BUTTON_VARIANTS = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  dark: "bg-ink text-white hover:bg-ink-soft",
  outline: "border border-ink/15 bg-white text-ink hover:border-ink",
  ghost: "text-ink hover:bg-mist",
  danger: "border border-brand/30 bg-white text-brand hover:bg-brand-light",
};

export function Button({ variant = "primary", loading = false, className = "", children, ...props }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

/** Labelled input or select with an error line. Use as="select" and pass <option>s as children. */
export function Field({ label, error, hint, as = "input", children, className = "", ...props }) {
  if (!hint && as !== "select" && props.type === "number" && /₹/.test(String(label))) hint = rupeesInWords(props.value) || undefined;
  const cls = `input ${error ? "input-error" : ""}`;
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {as === "select" ? (
        <select {...props} className={cls}>
          {children}
        </select>
      ) : (
        <input {...props} className={cls} />
      )}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-brand">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-ink/50">{hint}</span>
      ) : null}
    </label>
  );
}

const ALERT_TONES = {
  error: "border-brand/30 bg-brand-light text-brand-dark",
  success: "border-ink/10 bg-ink text-white",
  info: "border-line bg-white text-ink",
};

export function Alert({ tone = "error", children, className = "" }) {
  if (!children) return null;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm font-medium ${ALERT_TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}

const BADGE_TONES = {
  neutral: "bg-mist text-ink/70",
  dark: "bg-ink text-white",
  red: "bg-brand-light text-brand-dark",
};

export function Badge({ tone = "neutral", children }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_TONES[tone]}`}>
      {children}
    </span>
  );
}

/** dismissible=false means Esc / backdrop click do nothing (use for one-time secrets). */
export function Modal({ title, onClose, dismissible = true, children, wide = false }) {
  useEffect(() => {
    if (!dismissible) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dismissible, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => dismissible && e.target === e.currentTarget && onClose?.()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-6 shadow-2xl sm:rounded-2xl ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
          {dismissible && (
            <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg hover:bg-mist">
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
