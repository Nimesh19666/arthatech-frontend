// Permission codes with readable names, grouped for the permissions editor.
const p = (code, label) => ({ code, label });

export const PERMISSION_GROUPS = [
  {
    group: "Platform",
    items: [
      p("house.create", "Create houses"),
      p("house.suspend", "Suspend houses"),
      p("usage.view", "View platform usage"),
      p("data.export", "Export data"),
      p("audit.view", "View audit log"),
      p("login_history.view", "View login history"),
    ],
  },
  {
    group: "Users",
    items: [
      p("users.create.user", "Create users"),
      p("users.create.admin", "Create admins"),
      p("users.deactivate.user", "Deactivate users"),
      p("users.deactivate.admin", "Deactivate admins"),
      p("users.reset_password.user", "Reset user passwords"),
      p("users.reset_password.admin", "Reset admin passwords"),
      p("roles.manage", "Manage roles"),
      p("profile_permission.manage", "Edit extra permissions"),
    ],
  },
  {
    group: "Projects",
    items: [
      p("project.create", "Create projects"),
      p("project.import_excel", "Import project from Excel"),
      p("project.view", "View projects"),
    ],
  },
  {
    group: "Budget",
    items: [
      p("budget.view", "View budget"),
      p("budget.set_initial", "Set first budget (Version 1)"),
      p("budget.change", "Change budget"),
      p("dashboard.view", "View dashboard"),
    ],
  },
  {
    group: "Teams",
    items: [
      p("team.manage", "Manage teams"),
      p("team.budget.set", "Set team budgets"),
      p("team.advance.set", "Set team advances"),
      p("overtime_rate.set", "Set overtime rates"),
    ],
  },
  {
    group: "Daily work",
    items: [
      p("daily_plan.send", "Send expected-people list"),
      p("daily_work.record", "Record daily work"),
      p("daily_work.submit", "Submit daily work for approval"),
      p("daily_work.view", "View daily work"),
      p("daily_work.view_pay", "View crew pay"),
      p("daily_work.send_to_accounts", "Send daily work to accountant"),
    ],
  },
  {
    group: "Expenses",
    items: [
      p("expense.raise", "Raise expenses"),
      p("expense.view", "View expenses"),
      p("expense.cancel", "Cancel expenses"),
      p("expense.mark_cash", "Mark expense as paid in cash"),
    ],
  },
  {
    group: "Approvals",
    items: [
      p("expense.approve", "Approve expenses"),
      p("daily_work.approve", "Approve daily work"),
    ],
  },
  {
    group: "Ledger",
    items: [
      p("commitment.create", "Create commitments"),
      p("estimate.set", "Set estimates"),
      p("ledger.view", "View ledger"),
    ],
  },
  {
    group: "Payments",
    items: [
      p("invoice.create", "Create invoices"),
      p("invoice.check", "Check invoices (GST / TDS)"),
      p("tax_rate.manage", "Manage tax rates"),
      p("team_head_tax.manage", "Manage team head tax"),
      p("payment.mark_paid", "Mark payments as paid"),
    ],
  },
  { group: "Reports", items: [p("report.export", "Export reports")] },
  {
    group: "Notifications",
    items: [p("notification.view", "View notifications")],
  },
];
