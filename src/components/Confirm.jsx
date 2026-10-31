import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button, Modal } from "./ui.jsx";

const ConfirmContext = createContext(null);

/** Wrap the app once. Then any component can do:  if (!(await confirm({ message }))) return;  */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setState(options);
      }),
    []
  );

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal title={state.title || "Are you sure?"} onClose={() => close(false)}>
          <p className="text-sm leading-relaxed text-ink/70">{state.message}</p>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="dark" className="flex-1" onClick={() => close(true)}>
              {state.confirmLabel || "Confirm"}
            </Button>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return confirm;
}
