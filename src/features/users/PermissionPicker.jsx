import { PERMISSION_GROUPS } from "../../lib/permissions.js";
import { roleHas } from "../../lib/roleDefaults.js";

const OPTIONS = [
  { value: "default", label: "Default" },
  { value: "allow", label: "Allow" },
  { value: "deny", label: "Deny" },
];

/** value: { "expense.raise": "allow" }. roleCode decides the "Role default" shown. */
export default function PermissionPicker({ value, onChange, roleCode }) {
  const setEffect = (code, effect) => {
    const next = { ...value };
    if (effect === "default") delete next[code];
    else next[code] = effect;
    onChange(next);
  };

  return (
    <div className="max-h-[40vh] space-y-5 overflow-y-auto pr-1">
      {PERMISSION_GROUPS.map((g) => (
        <div key={g.group}>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand">
            {g.group}
          </p>
          <div className="divide-y divide-line rounded-xl border border-line">
            {g.items.map(({ code, label }) => {
              const has = roleHas(roleCode, code);
              const override = value[code];
              const final =
                override === "allow" ? true : override === "deny" ? false : has;
              return (
                <div
                  key={code}
                  className="flex items-center justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <span
                      className="block truncate text-sm font-medium"
                      title={code}
                    >
                      {label}
                    </span>
                    <span className="text-xs text-ink/50">
                      Role default:{" "}
                      <b className={has ? "text-ink" : "text-ink/40"}>
                        {has ? "Yes" : "No"}
                      </b>
                      {override && (
                        <>
                          {" "}
                          → Final:{" "}
                          <b className={final ? "text-ink" : "text-brand"}>
                            {final ? "Yes" : "No"}
                          </b>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="flex shrink-0 overflow-hidden rounded-lg border border-line text-xs font-semibold">
                    {OPTIONS.map((o) => {
                      const active = (override || "default") === o.value;
                      // Allow does nothing if the role already has it. Deny does nothing if it does not.
                      const pointless =
                        (o.value === "allow" && has) ||
                        (o.value === "deny" && !has);
                      const activeCls =
                        o.value === "allow"
                          ? "bg-ink text-white"
                          : o.value === "deny"
                            ? "bg-brand text-white"
                            : "bg-mist";
                      return (
                        <button
                          key={o.value}
                          type="button"
                          disabled={pointless && !active}
                          onClick={() => setEffect(code, o.value)}
                          className={`px-2.5 py-1.5 ${
                            active
                              ? activeCls
                              : "bg-white text-ink/60 hover:bg-mist"
                          } ${pointless && !active ? "cursor-not-allowed opacity-30" : "cursor-pointer"}`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
