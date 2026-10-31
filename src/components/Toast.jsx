import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

/** Small pop-up messages in the corner. They go away by themselves after a few seconds. */
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (tone, text) => {
      if (!text) return; // empty text means "clear", so show nothing
      const id = `${Date.now()}-${Math.random()}`;
      setItems((list) => [...list.slice(-3), { id, tone, text }]);
      timers.current.set(id, setTimeout(() => dismiss(id), tone === "error" ? 6000 : 3500));
    },
    [dismiss]
  );

  useEffect(() => {
    const all = timers.current;
    return () => all.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo(() => ({ success: (t) => push("success", t), error: (t) => push("error", t) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl sm:w-auto ${
              t.tone === "error" ? "bg-brand-dark text-white" : "bg-ink text-white"
            }`}
          >
            <span className="min-w-0 flex-1 break-words">{t.text}</span>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="cursor-pointer text-white/60 hover:text-white">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
