import { getSyncScope } from "../lib/outbox";
import { api, download } from "./client";

const list = (d) => (Array.isArray(d) ? d : d?.results || []);

// A list fetched a moment ago can be reused by the next screen (pass { reuse: true }).
const recentLists = new Map();
export const listDays = async (projectId, { reuse = false } = {}) => {
  const hit = recentLists.get(`${getSyncScope()}:${projectId}`);
  if (reuse && hit && Date.now() - hit.t < 30000) return hit.v;
  const v = list(await api(`/projects/${projectId}/shoot-days`));
  recentLists.set(`${getSyncScope()}:${projectId}`, { t: Date.now(), v });
  return v;
};
export const createDay = (projectId, body) => {
  recentLists.delete(`${getSyncScope()}:${projectId}`);
  return api(`/projects/${projectId}/shoot-days`, { method: "POST", body });
};

// A day fetched in advance (when the pointer reaches its card) is used once by the screen that opens it.
const warmDays = new Map();
export const warmDay = (id) => {
  const p = api(`/shoot-days/${id}`);
  warmDays.set(`${getSyncScope()}:${id}`, { t: Date.now(), p });
  p.catch(() => warmDays.delete(`${getSyncScope()}:${id}`));
  return p;
};
export const getDay = (id) => {
  const w = warmDays.get(`${getSyncScope()}:${id}`);
  warmDays.delete(`${getSyncScope()}:${id}`);
  if (w && Date.now() - w.t < 15000) return w.p;
  return api(`/shoot-days/${id}`);
};
export const deleteDay = (id) => api(`/shoot-days/${id}`, { method: "DELETE" });
export const reviewers = (id) => api(`/shoot-days/${id}/reviewers`);
export const submitDay = (id, body) => api(`/shoot-days/${id}/submit`, { method: "POST", body });
export const reviewDay = (id, body) => api(`/shoot-days/${id}/review`, { method: "POST", body });

export const getTab = (dayTeamId) => api(`/day-teams/${dayTeamId}`);
// These two need small backend additions (POST /shoot-days/<id>/teams, DELETE /day-teams/<id>)
export const addTeamToDay = (dayId, teamId) => api(`/shoot-days/${dayId}/teams`, { method: "POST", body: { team_id: teamId } });
export const removeDayTeam = (dayTeamId) => api(`/day-teams/${dayTeamId}`, { method: "DELETE" });

export const listProjectTeams = async (projectId) => list(await api(`/projects/${projectId}/teams`));
export const listMembers = async (teamId) => list(await api(`/teams/${teamId}/members`));

export const receipts = (dayId) => api(`/shoot-days/${dayId}/receipts`);
export const uploadReceipt = (dayId, form) => api(`/shoot-days/${dayId}/receipts`, { method: "POST", body: form });
export const deleteReceipt = (id) => api(`/receipts/${id}`, { method: "DELETE" });

export const reportXlsx = (projectId, from, to, approvedOnly) =>
  download(`/projects/${projectId}/reports/shoot-days.xlsx?date_from=${from}&date_to=${to}${approvedOnly ? "&approved_only=1" : ""}`);
