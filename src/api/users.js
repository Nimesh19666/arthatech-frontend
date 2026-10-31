import { api } from "./client";

export const listUsers = ({ search, role_code, organisation_id } = {}) => {
  const q = new URLSearchParams();
  if (search) q.set("search", search);
  if (role_code) q.set("role_code", role_code);
  if (organisation_id) q.set("organisation_id", organisation_id);
  const qs = q.toString();
  return api(`/users${qs ? `?${qs}` : ""}`);
};

/** Returns { profile_id, user_id, generated_password } - show the password once, never store it. */
export const createUser = (body) => api("/users", { method: "POST", body });

export const updateUser = (userId, body) => api(`/users/${userId}`, { method: "PATCH", body });
export const updateProfile = (profileId, body) => api(`/profiles/${profileId}`, { method: "PATCH", body });

/** Returns { generated_password } - show once. */
export const resetPassword = (userId) => api(`/users/${userId}/reset-password`, { method: "POST" });

/** action: lock | unlock | deactivate | activate */
export const userAction = (userId, action) => api(`/users/${userId}/${action}`, { method: "POST" });

/** Replaces the WHOLE list. Send [] to clear. */
export const setProfilePermissions = (profileId, permissions) =>
  api(`/profiles/${profileId}/permissions`, { method: "PUT", body: { permissions } });

export const listOrganisations = () => api("/organisations");

/**
 * GET /users returns one entry per PERSON, with a "profiles" list (one per role / hat):
 *   { id, email, full_name, is_active, is_locked, profiles: [
 *       { profile_id, is_active, role:{code,name}, organisation:{id,name},
 *         project:{id,name}|null, teams:[], team_member_id, extra_permissions:[] } ] }
 * We make one row per PROFILE, because permissions, role and project belong to a profile.
 */
export function normalizeUsers(data) {
  const list = Array.isArray(data) ? data : data?.results || data?.users || data?.data || [];
  const rows = [];
  for (const u of list) {
    const profiles = Array.isArray(u.profiles) && u.profiles.length ? u.profiles : [null];
    for (const p of profiles) {
      const userId = u.id ?? u.user_id;
      const profileId = p?.profile_id ?? p?.id ?? null;
      rows.push({
        raw: u,
        key: `${userId}-${profileId ?? "x"}`,
        userId,
        profileId,
        email: u.email ?? "",
        name: u.full_name ?? "",
        roleCode: p?.role?.code ?? "",
        roleName: p?.role?.name ?? "",
        orgId: p?.organisation?.id ?? null,
        orgName: p?.organisation?.name ?? "",
        projectId: p?.project?.id ?? null,
        projectName: p?.project?.name ?? "",
        teams: p?.teams ?? [],
        active: (u.is_active ?? true) && (p?.is_active ?? true),
        profileActive: p?.is_active ?? true,
        teamMemberId: p?.team_member_id ?? null,
        lastLogin: u.last_login_at ?? null,
        mustChange: Boolean(u.must_change_password),
        locked: Boolean(u.is_locked),
        extra: p?.extra_permissions ?? [],
      });
    }
  }
  return rows;
}
