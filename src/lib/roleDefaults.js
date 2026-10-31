// DRAFT: worked out from the product brief, not from permissions-matrix.md.
// Check each role against the real matrix and fix any mistakes here.
const D = {
  admin: [
    "usage.view",
    "data.export",
    "users.create.user",
    "users.deactivate.user",
    "users.reset_password.user",
    "profile_permission.manage",
    "project.create",
    "project.import_excel",
    "project.view",
    "budget.view",
    "budget.set_initial",
    "dashboard.view",
    "ledger.view",
    "report.export",
    "notification.view",
  ],
  producer: [
    "project.view",
    "budget.view",
    "budget.change",
    "dashboard.view",
    "team.manage",
    "team.budget.set",
    "team.advance.set",
    "overtime_rate.set",
    "expense.view",
    "expense.approve",
    "daily_work.view",
    "daily_work.view_pay",
    "daily_work.approve",
    "ledger.view",
    "report.export",
    "notification.view",
  ],
  line_producer: [
    "project.view",
    "budget.view",
    "dashboard.view",
    "expense.view",
    "expense.approve",
    "daily_work.view",
    "daily_work.approve",
    "notification.view",
  ],
  project_manager: [
    "project.view",
    "expense.raise",
    "expense.view",
    "expense.mark_cash",
    "expense.approve",
    "daily_work.approve",
    "notification.view",
  ],
  auditor: [
    "project.view",
    "daily_work.record",
    "daily_work.submit",
    "daily_work.view",
    "daily_work.view_pay",
    "daily_work.send_to_accounts",
    "expense.raise",
    "expense.view",
    "notification.view",
  ],
  accountant: [
    "project.view",
    "invoice.create",
    "invoice.check",
    "tax_rate.manage",
    "team_head_tax.manage",
    "payment.mark_paid",
    "expense.view",
    "ledger.view",
    "report.export",
    "notification.view",
  ],
  finance: [
    "project.view",
    "payment.mark_paid",
    "expense.view",
    "ledger.view",
    "report.export",
    "notification.view",
  ],
  team_head: ["daily_plan.send", "daily_work.view", "notification.view"],
};

const SETS = Object.fromEntries(
  Object.entries(D).map(([r, list]) => [r, new Set(list)]),
);

/** Does this role have the permission by default? Super Admin has everything. */
export function roleHas(roleCode, code) {
  if (roleCode === "super_admin") return true;
  return SETS[roleCode]?.has(code) ?? false;
}
