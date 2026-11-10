import { useEffect, useSyncExternalStore } from "react";
import { getSnapshot, onSyncEvent, subscribe } from "../lib/outbox";
import { errorText } from "../lib/errors.js";
import { useToast } from "./Toast.jsx";

export const useSyncStatus = () => useSyncExternalStore(subscribe, getSnapshot);

/** Small pill in the top bar. Hidden when everything is saved and online. */
export default function SyncBadge() {
  const s = useSyncStatus();
  if (s.online && s.pending === 0) return null;
  const text = !s.online ? `Offline${s.pending ? ` · ${s.pending} waiting` : ""}` : s.syncing ? "Saving…" : `${s.pending} waiting to save`;
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-bold ${s.online ? "bg-mist text-ink" : "bg-ink text-white"}`}>
      {text}
    </span>
  );
}

/** Tells the person when the server refused a saved change (from any screen). */
export function SyncToasts() {
  const toast = useToast();
  useEffect(
    () =>
      onSyncEvent((e) => {
        if (e.type === "rejected") toast.error(`${e.op.label || "A change"} was not saved: ${errorText(e.error)}`);
      }),
    [toast]
  );
  return null;
}
