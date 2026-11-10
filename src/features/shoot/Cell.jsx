import { useEffect, useState } from "react";
import { rupeesInWords } from "../../lib/money.js";

const LABEL = "mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-ink/45";

/** A small labelled input that saves when you leave it (not on every key). */
export function Cell({ label, value, onSave, type = "text", disabled = false, className = "", placeholder, min }) {
  const [v, setV] = useState(value ?? "");
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) setV(value ?? "");
  }, [value, focus]);

  function commit() {
    setFocus(false);
    if (String(v) === String(value ?? "")) return;
    if (type === "time" && v === "") return setV(value ?? ""); // a time cannot be cleared
    onSave(v);
  }
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={LABEL}>{label}</span>
      <input
        type={type}
        min={min}
        value={v}
        placeholder={placeholder}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className={`input !py-1.5 text-sm disabled:opacity-60 ${type === "time" ? "!px-2" : ""}`}
      />
      {type === "number" && /₹/.test(label) && v !== "" && <span className="mt-0.5 block text-[11px] font-medium text-ink/50">{rupeesInWords(v)}</span>}
    </label>
  );
}

export function Pick({ label, value, onSave, options, disabled = false, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={LABEL}>{label}</span>
      <select value={value ?? ""} disabled={disabled} onChange={(e) => onSave(e.target.value)} className="input !py-1.5 text-sm disabled:opacity-60">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Tick({ label, checked, onSave, disabled = false }) {
  return (
    <label className="flex min-w-0 items-center gap-2 pt-4 text-sm font-semibold">
      <input type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onSave(e.target.checked)} className="h-4 w-4 accent-brand" />
      {label}
    </label>
  );
}
