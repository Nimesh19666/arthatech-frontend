import { useState } from "react";
import { Alert, Button, Field, Modal } from "./ui.jsx";
import { errorText, fieldError } from "../lib/errors.js";

/**
 * One reusable form popup.
 * fields: [{ name, label, type?, as?, options?, hint?, required? }]
 *   type "checkbox" is supported. as "select" needs options: [{ value, label }]
 * onSubmit(values) must return a promise. The parent closes the popup when it succeeds.
 */
export default function FormModal({ title, fields, initial = {}, submitLabel = "Save", onSubmit, onClose }) {
  const [values, setValues] = useState(() =>
    Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? (f.type === "checkbox" ? false : "")]))
  );
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (name, value) => setValues((s) => ({ ...s, [name]: value }));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Alert>{error && errorText(error)}</Alert>
        {fields.map((f) =>
          f.type === "checkbox" ? (
            <label key={f.name} className="flex cursor-pointer items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={Boolean(values[f.name])}
                onChange={(e) => set(f.name, e.target.checked)}
                className="h-4 w-4 accent-brand"
              />
              {f.label}
            </label>
          ) : (
            <Field
              key={f.name}
              label={f.label}
              as={f.as}
              type={f.type}
              required={f.required}
              min={f.min}
              hint={f.hint}
              value={values[f.name]}
              onChange={(e) => set(f.name, e.target.value)}
              error={fieldError(error, f.name)}
            >
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Field>
          )
        )}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={busy} className="flex-1">
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
