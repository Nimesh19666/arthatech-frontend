export const ROLES = [
  { code: "super_admin", name: "Super Admin", level: "platform" },
  { code: "admin", name: "Admin", level: "platform" },
  { code: "producer", name: "Producer", level: "house" },
  { code: "line_producer", name: "Line Producer", level: "house" },
  { code: "project_manager", name: "Project Manager", level: "house" },
  { code: "auditor", name: "Auditor", level: "house" },
  { code: "accountant", name: "Accountant", level: "house" },
  { code: "finance", name: "Finance", level: "house" },
  { code: "team_head", name: "Team Head", level: "house" },
];

export const roleName = (code) => ROLES.find((r) => r.code === code)?.name || code || "—";

export const isPlatformRole = (code) =>
  ROLES.find((r) => r.code === code)?.level === "platform";
