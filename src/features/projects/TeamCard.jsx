import { useCallback, useEffect, useState } from "react";
import * as houses from "../../api/houses";
import { Alert, Badge, Button, Spinner } from "../../components/ui.jsx";
import { useToast } from "../../components/Toast.jsx";
import { ActionBtn } from "../../components/Table.jsx";
import FormModal from "../../components/FormModal.jsx";
import { errorText } from "../../lib/errors.js";
import { formatPaise } from "../../lib/money.js";
import { useConfirm } from "../../components/Confirm.jsx";
import CreateUserModal from "../users/CreateUserModal.jsx";
import PasswordModal from "../users/PasswordModal.jsx";

const FIELDS = [
  { name: "name", label: "Full name", required: true },
  { name: "phone", label: "Phone", type: "tel" },
  { name: "job_title", label: "Job title", hint: "For example: Gaffer" },
  { name: "is_team_head", type: "checkbox", label: "This person is the Team Head (only one per team)" },
];

const toBody = (v) => ({
  name: v.name.trim(),
  phone: v.phone.trim(),
  job_title: v.job_title.trim(),
  is_team_head: Boolean(v.is_team_head),
});

/** One team. Opens to show its members right here, so there is no extra page to click into. */
export default function TeamCard({ team, open, onToggle, canManage, onEdit, onDelete, orgId, projectId, canUser }) {
  const confirm = useConfirm();
  const [loginFor, setLoginFor] = useState(null); // member who gets a Team Head login
  const [secret, setSecret] = useState(null);
  const [members, setMembers] = useState(null); // null = not loaded yet
  const [error, setError] = useState(null);
  const { success: setNotice } = useToast(); // shows a pop-up message
  const [modal, setModal] = useState(null); // { type: "add" | "edit", row? }

  const load = useCallback(async () => {
    try {
      const d = await houses.listMembers(team.id);
      setMembers(Array.isArray(d) ? d : d?.results || []);
      setError(null);
    } catch (e) {
      setError(e);
      setMembers([]);
    }
  }, [team.id]);

  useEffect(() => {
    if (open && members === null) load();
  }, [open, members, load]);

  async function finish(message) {
    setModal(null);
    setNotice(message);
    await load();
  }

  async function setActive(m, active) {
    setNotice("");
    try {
      await houses.updateMember(m.id, { is_active: active });
      await finish(`${m.name} ${active ? "activated" : "deactivated"}`);
    } catch (e) {
      setError(e);
    }
  }

  async function remove(m) {
    const ok = await confirm({
      title: `Delete ${m.name}?`,
      message: "This only works if they have no pay rates. Otherwise deactivate them instead.",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    setNotice("");
    try {
      await houses.deleteMember(m.id);
      await finish(`Deleted ${m.name}`);
    } catch (e) {
      setError(e);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      {/* Team header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <button onClick={onToggle} className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left">
          <span
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-light text-xs text-brand transition ${
              open ? "rotate-90" : ""
            }`}
          >
            ▸
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-extrabold">{team.name}</span>
            <span className="block text-xs text-ink/55">
              {team.headcount ?? 0} people planned
              {team.budget_paise != null && <> · Budget {formatPaise(team.budget_paise)}</>}
              {team.advance_paise != null && <> · Advance {formatPaise(team.advance_paise)}</>}
              {members && <> · {members.length} added</>}
            </span>
          </span>
        </button>
        {canManage && (
          <div className="flex gap-1">
            <ActionBtn onClick={onEdit}>Edit team</ActionBtn>
            <ActionBtn danger onClick={onDelete}>
              Delete
            </ActionBtn>
          </div>
        )}
      </div>

      {/* Members */}
      {open && (
        <div className="border-t border-line bg-mist/60 px-5 py-4">
          <Alert className="mb-3">{error && errorText(error)}</Alert>

          {members === null ? (
            <Spinner className="h-5 w-5 text-brand" />
          ) : (
            <>
              {members.length === 0 ? (
                <p className="py-2 text-sm text-ink/55">No members in this team yet.</p>
              ) : (
                <ul className="divide-y divide-line rounded-xl border border-line bg-white">
                  {members.map((m) => {
                    const active = m.is_active ?? true;
                    return (
                      <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {m.name}{" "}
                            {m.is_team_head && <Badge tone="red">Team Head</Badge>}{" "}
                            {(m.has_login || m.user_id) && <Badge tone="dark">Has login</Badge>}{" "}
                            {!active && <Badge>Inactive</Badge>}
                          </p>
                          <p className="text-xs text-ink/50">
                            {[m.job_title, m.phone].filter(Boolean).join(" · ") || "No details"}
                          </p>
                        </div>
                        {(canManage || (canUser && m.is_team_head)) && (
                          <div className="flex flex-wrap gap-1">
                            {canUser && orgId && m.is_team_head && !(m.has_login || m.user_id) && (
                              <ActionBtn onClick={() => setLoginFor(m)}>Create login</ActionBtn>
                            )}
                            {canManage && (
                              <>
                            <ActionBtn onClick={() => setModal({ type: "edit", row: m })}>Edit</ActionBtn>
                            <ActionBtn onClick={() => setActive(m, !active)}>{active ? "Deactivate" : "Activate"}</ActionBtn>
                            <ActionBtn danger onClick={() => remove(m)}>
                              Delete
                            </ActionBtn>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {canManage && (
                <Button variant="outline" className="mt-3 !py-2" onClick={() => setModal({ type: "add" })}>
                  + Add member
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {loginFor && (
        <CreateUserModal
          presetOrgId={orgId}
          presetProjectId={projectId}
          presetTeamId={team.id}
          presetMemberId={loginFor.id}
          presetRole="team_head"
          presetName={loginFor.name}
          onClose={() => setLoginFor(null)}
          onCreated={({ email, password }) => {
            setLoginFor(null);
            setSecret({ title: "Team Head login created", email, password });
            load();
          }}
        />
      )}
      {secret && <PasswordModal {...secret} onClose={() => setSecret(null)} />}
      {modal?.type === "add" && (
        <FormModal
          title={`Add member to ${team.name}`}
          submitLabel="Add"
          fields={FIELDS}
          onSubmit={async (v) => {
            await houses.addMember(team.id, toBody(v));
            await finish("Member added");
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "edit" && (
        <FormModal
          title="Edit member"
          fields={FIELDS}
          initial={{
            name: modal.row.name,
            phone: modal.row.phone || "",
            job_title: modal.row.job_title || "",
            is_team_head: Boolean(modal.row.is_team_head),
          }}
          onSubmit={async (v) => {
            await houses.updateMember(modal.row.id, toBody(v));
            await finish("Member saved");
          }}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
