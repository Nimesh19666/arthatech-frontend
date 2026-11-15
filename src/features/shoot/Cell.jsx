import { useEffect, useState } from "react";
import { rupeesInWords } from "../../lib/money.js";

const LABEL = "cell-label mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-ink/45";

/** A small labelled input that saves when you leave it (not on every key). */
export function Cell({ label, value, onSave, type = "text", disabled = false, className = "", placeholder, min, hint }) {
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
      {hint && <span className="mt-0.5 block text-[11px] font-semibold text-ink/55">{hint}</span>}
      {type === "number" && /₹/.test(label) && v !== "" && <span className="cell-hint mt-0.5 block text-[11px] font-medium text-ink/50">{rupeesInWords(v)}</span>}
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
    <label className="tick flex min-w-0 items-center gap-2 pt-4 text-sm font-semibold">
      <input aria-label={label} type="checkbox" checked={Boolean(checked)} disabled={disabled} onChange={(e) => onSave(e.target.checked)} className="h-4 w-4 accent-brand" />
      <span className="tick-text">{label}</span>
    </label>
  );
}

const SCENE_OK = /^[A-Za-z0-9]{1,10}$/;
/** Old data may still be one text like "10, 20 D2": read it as a list */
export const asScenes = (v) => (Array.isArray(v) ? v : String(v || "").split(/[,\s]+/).filter(Boolean));

/** Scene numbers as chips. Type one and press Enter, comma or space; paste many at once. */
export function SceneChips({ label, value, onSave, disabled = false, className = "" }) {
  const list = asScenes(value).map((s) => String(s).toUpperCase());
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [focus, setFocus] = useState(false);

  function add(raw) {
    const parts = raw.split(/[,\s]+/).filter(Boolean);
    if (!parts.length) return setText("");
    const bad = parts.find((p) => !SCENE_OK.test(p));
    if (bad) {
      setErr(`"${bad.slice(0, 14)}" is not a scene number. Use letters and numbers only, up to 10 characters (e.g. 12A, D2).`);
      return;
    }
    const next = [...new Set([...list, ...parts.map((p) => p.toUpperCase())])];
    setErr("");
    setText("");
    if (next.length > 200) return setErr("Up to 200 scenes.");
    if (next.length !== list.length) onSave(next);
  }
  const remove = (s) => onSave(list.filter((x) => x !== s));

  return (
    <div className={`min-w-0 ${className}`}>
      <span className={LABEL}>{label}</span>
      <div className={`flex min-h-[34px] flex-wrap items-center gap-1 rounded-lg border bg-white px-2 py-[3px] ${err ? "border-brand" : "border-line"} focus-within:border-ink focus-within:ring-2 focus-within:ring-brand/20`}>
        {list.map((s) => (
          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-brand-light px-2 py-0.5 text-xs font-bold text-brand-dark">
            {s}
            {!disabled && (
              <button type="button" aria-label={`Remove scene ${s}`} onClick={() => remove(s)} className="cursor-pointer text-brand-dark/60 hover:text-brand-dark">
                ✕
              </button>
            )}
          </span>
        ))}
        {!disabled && (
          <input
            value={text}
            maxLength={40}
            placeholder={list.length ? "Add" : "10, 12A, D2"}
            aria-label={`${label}: add a scene number`}
            onChange={(e) => {
              const v = e.target.value;
              if (/[,\s]$/.test(v) && v.trim()) add(v);
              else {
                setText(v);
                setErr("");
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(text);
              } else if (e.key === "Backspace" && !text && list.length) remove(list[list.length - 1]);
            }}
            onFocus={() => setFocus(true)}
            onBlur={() => { setFocus(false); text.trim() && add(text); }}
            className="min-w-[4rem] flex-1 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-ink/35"
          />
        )}
        {disabled && list.length === 0 && <span className="px-1 text-sm text-ink/40">None</span>}
      </div>
      {err ? <span className="mt-0.5 block text-[11px] font-medium text-brand">{err}</span> : null}
    </div>
  );
}

/** In and out time in ONE field: [ 09:00 AM ] to [ 09:00 PM ]. Each part saves when you leave it. */
export function TimeRange({ label, from, to, onSave, disabled = false, hint, className = "" }) {
  const [a, setA] = useState(from ?? "");
  const [b, setB] = useState(to ?? "");
  const [focus, setFocus] = useState(false);
  useEffect(() => {
    if (!focus) {
      setA(from ?? "");
      setB(to ?? "");
    }
  }, [from, to, focus]);

  function leave(e) {
    // only when focus leaves the whole field, not when moving from "in" to "out"
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setFocus(false);
    const patch = {};
    if (a !== (from ?? "") && a !== "") patch.shift_in_time = a;
    if (b !== (to ?? "") && b !== "") patch.shift_out_time = b;
    if (a === "") setA(from ?? "");
    if (b === "") setB(to ?? "");
    if (Object.keys(patch).length) onSave(patch);
  }
  const part = "min-w-0 flex-1 bg-transparent px-1 py-1 text-sm outline-none disabled:opacity-60 [&::-webkit-calendar-picker-indicator]:hidden";
  return (
    <div className={`min-w-0 ${className}`}>
      <span className={LABEL}>{label}</span>
      <div onFocus={() => setFocus(true)} onBlur={leave} className="flex min-h-[34px] items-center gap-1 rounded-lg border border-line bg-white px-2 focus-within:border-ink focus-within:ring-2 focus-within:ring-brand/20">
        <input type="time" aria-label={`${label} in`} value={a} disabled={disabled} onChange={(e) => setA(e.target.value)} className={part} />
        <span className="text-xs font-semibold text-ink/40">to</span>
        <input type="time" aria-label={`${label} out`} value={b} disabled={disabled} onChange={(e) => setB(e.target.value)} className={part} />
      </div>
      {hint && <span className="mt-0.5 block text-[11px] font-semibold text-ink/55">{hint}</span>}
    </div>
  );
}
