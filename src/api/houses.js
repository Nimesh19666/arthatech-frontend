import { api } from "./client";

// Lists may come back as an array or as { results: [] }
export const asList = (d) => (Array.isArray(d) ? d : d?.results || d?.data || []);

// ---- Houses (organisations) ----
export const listHouses = () => api("/organisations");
export const createHouse = (name) => api("/organisations", { method: "POST", body: { name } });
export const updateHouse = (id, body) => api(`/organisations/${id}`, { method: "PATCH", body });
export const deleteHouse = (id) => api(`/organisations/${id}`, { method: "DELETE" });

// ---- Projects ----
export const listProjects = (orgId) => api(`/organisations/${orgId}/projects`);
export const createProject = (orgId, body) => api(`/organisations/${orgId}/projects`, { method: "POST", body });
export const updateProject = (id, body) => api(`/projects/${id}`, { method: "PATCH", body });
export const deleteProject = (id) => api(`/projects/${id}`, { method: "DELETE" });

// ---- Teams ----
export const listTeams = (projectId) => api(`/projects/${projectId}/teams`);
export const createTeam = (projectId, body) => api(`/projects/${projectId}/teams`, { method: "POST", body });
export const updateTeam = (id, body) => api(`/teams/${id}`, { method: "PATCH", body });
export const deleteTeam = (id) => api(`/teams/${id}`, { method: "DELETE" });

// ---- Team members ----
export const listMembers = (teamId) => api(`/teams/${teamId}/members`);
export const addMember = (teamId, body) => api(`/teams/${teamId}/members`, { method: "POST", body });
export const updateMember = (id, body) => api(`/members/${id}`, { method: "PATCH", body });
export const deleteMember = (id) => api(`/members/${id}`, { method: "DELETE" });
