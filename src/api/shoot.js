import { api } from "./client";

const list = (d) => (Array.isArray(d) ? d : d?.results || []);

export const listDays = async (projectId) => list(await api(`/projects/${projectId}/shoot-days`));
export const createDay = (projectId, body) => api(`/projects/${projectId}/shoot-days`, { method: "POST", body });
export const getDay = (id) => api(`/shoot-days/${id}`);
export const deleteDay = (id) => api(`/shoot-days/${id}`, { method: "DELETE" });
export const signoff = (id, body) => api(`/shoot-days/${id}/audit`, { method: "POST", body });

export const getTab = (dayTeamId) => api(`/day-teams/${dayTeamId}`);
// These two need small backend additions (POST /shoot-days/<id>/teams, DELETE /day-teams/<id>)
export const addTeamToDay = (dayId, teamId) => api(`/shoot-days/${dayId}/teams`, { method: "POST", body: { team_id: teamId } });
export const removeDayTeam = (dayTeamId) => api(`/day-teams/${dayTeamId}`, { method: "DELETE" });

export const listProjectTeams = async (projectId) => list(await api(`/projects/${projectId}/teams`));
export const listMembers = async (teamId) => list(await api(`/teams/${teamId}/members`));
