import { useState } from "react";
import { Link } from "react-router-dom";
import * as houses from "../api/houses";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useLoad } from "../lib/useLoad.js";
import { Alert, Badge, Button, Spinner } from "../components/ui.jsx";
import { CardsSkeleton, RowsSkeleton, TableRowsSkeleton } from "../components/Skeleton.jsx";
import { useToast } from "../components/Toast.jsx";
import { ActionBtn } from "../components/Table.jsx";
import FormModal from "../components/FormModal.jsx";
import { errorText } from "../lib/errors.js";
import { useConfirm } from "../components/Confirm.jsx";

const TYPES = { movie: "Movie", ott_series: "OTT series", ad: "Ad", other: "Other" };
const STATUSES = { draft: "Draft", planning: "Planning", active: "Active", wrapped: "Wrapped", closed: "Closed" };
const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export default function HousesPage() {
  const { can } = useAuth();
  const confirm = useConfirm();
  const [q, setQ] = useState("");
  // Each house comes with its projects inside, so everything shows on this one page.
  const { data, loading, error, setError, reload } = useLoad(() => houses.listHouses(), []);
  const [modal, setModal] = useState(null); // { type: "create" | "rename" | "suspend", row? }
  const { success: setNotice } = useToast(); // shows a pop-up message

  const needle = q.trim().toLowerCase();
  const visibleHouses = needle
    ? data.filter(
        (h) => h.name.toLowerCase().includes(needle) || (h.projects || []).some((p) => p.name.toLowerCase().includes(needle))
      )
    : data;

  async function finish(message) {
    setModal(null);
    setNotice(message);
    await reload();
  }

  async function unsuspend(h) {
    setNotice("");
    try {
      await houses.updateHouse(h.id, { is_suspended: false, suspended_reason: "" });
      await finish(`${h.name} is active again`);
    } catch (e) {
      setError(e);
    }
  }

  async function remove(h) {
    const ok = await confirm({
      title: `Delete ${h.name}?`,
      message: "This only works if it has no projects and no users.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setNotice("");
    try {
      await houses.deleteHouse(h.id);
      await finish(`Deleted ${h.name}`);
    } catch (e) {
      setError(e); // the server explains what is blocking the delete
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-brand">Platform</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">Houses</h1>
        </div>
        {can("house.create") && <Button onClick={() => setModal({ type: "create" })}>+ New house</Button>}
      </div>

      <Alert>{error && errorText(error)}</Alert>

      <input
        className="input sm:max-w-sm"
        placeholder="Search houses or projects…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {loading ? (
        <CardsSkeleton count={3} />
      ) : visibleHouses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-white/60 p-10 text-center text-sm text-ink/60">
          {q ? "Nothing matches your search." : "No houses found."}
        </div>
      ) : (
        <div className="space-y-4">
          {visibleHouses.map((h) => {
            const projects = h.projects || [];
            return (
              <div key={h.id} className="overflow-hidden rounded-2xl border border-line bg-white">
                {/* House header */}
                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <Link
                      to={`/houses/${h.id}`}
                      state={{ name: h.name }}
                      className="text-xl font-extrabold tracking-tight hover:text-brand"
                    >
                      {h.name}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink/55">
                      {h.is_suspended ? (
                        <>
                          <Badge tone="red">Suspended</Badge>
                          {h.suspended_reason && <span>{h.suspended_reason}</span>}
                        </>
                      ) : (
                        <Badge tone="dark">Active</Badge>
                      )}
                      <span>
                        {projects.length} {projects.length === 1 ? "project" : "projects"}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Link
                      to={`/houses/${h.id}`}
                      state={{ name: h.name }}
                      className="rounded-md px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-light"
                    >
                      Open house →
                    </Link>
                    {can("house.create") && <ActionBtn onClick={() => setModal({ type: "rename", row: h })}>Rename</ActionBtn>}
                    {can("house.suspend") &&
                      (h.is_suspended ? (
                        <ActionBtn onClick={() => unsuspend(h)}>Unsuspend</ActionBtn>
                      ) : (
                        <ActionBtn onClick={() => setModal({ type: "suspend", row: h })}>Suspend</ActionBtn>
                      ))}
                    {can("house.create") && (
                      <ActionBtn danger onClick={() => remove(h)}>
                        Delete
                      </ActionBtn>
                    )}
                  </div>
                </div>

                {/* Projects, shown right here */}
                <div className="border-t border-line bg-mist/60 p-4">
                  {projects.length === 0 ? (
                    <p className="text-sm text-ink/55">
                      No projects yet.{" "}
                      <Link to={`/houses/${h.id}`} state={{ name: h.name }} className="font-semibold text-brand hover:underline">
                        Create the first project →
                      </Link>
                    </p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {projects.map((p) => (
                        <Link
                          key={p.id}
                          to={`/projects/${p.id}`}
                          state={{ name: p.name, orgId: h.id, houseName: h.name }}
                          className="rounded-xl border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-brand hover:shadow-md"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge tone={p.status === "active" ? "dark" : "neutral"}>{STATUSES[p.status] || p.status}</Badge>
                            <span className="text-xs font-semibold text-ink/50">{TYPES[p.project_type] || p.project_type}</span>
                          </div>
                          <p className="mt-2 font-extrabold">{p.name}</p>
                          <p className="mt-0.5 text-xs text-ink/55">
                            {fmtDate(p.start_date)} → {fmtDate(p.end_date)}
                          </p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === "create" && (
        <FormModal
          title="New house"
          submitLabel="Create"
          fields={[{ name: "name", label: "House name", required: true }]}
          onSubmit={async (v) => {
            await houses.createHouse(v.name.trim());
            await finish("House created");
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "rename" && (
        <FormModal
          title="Rename house"
          fields={[{ name: "name", label: "House name", required: true }]}
          initial={{ name: modal.row.name }}
          onSubmit={async (v) => {
            await houses.updateHouse(modal.row.id, { name: v.name.trim() });
            await finish("House renamed");
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "suspend" && (
        <FormModal
          title={`Suspend ${modal.row.name}`}
          submitLabel="Suspend"
          fields={[{ name: "reason", label: "Reason", required: true, hint: "Shown to admins, for example: Payment pending" }]}
          onSubmit={async (v) => {
            await houses.updateHouse(modal.row.id, { is_suspended: true, suspended_reason: v.reason.trim() });
            await finish(`${modal.row.name} suspended`);
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
