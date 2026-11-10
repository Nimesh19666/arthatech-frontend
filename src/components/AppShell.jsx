import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/auth/AuthContext.jsx";
import HatSwitcher from "./HatSwitcher.jsx";
import SyncBadge, { SyncToasts, useSyncStatus } from "./SyncBadge.jsx";
import { useConfirm } from "./Confirm.jsx";

function Logo() {
  return (
    <div className="flex items-center gap-2 text-lg font-black tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-white">A</span>
      <span>
        Artha<span className="text-brand">Tech</span>
      </span>
    </div>
  );
}

export default function AppShell() {
  const { me, user, profile, can, logout: doLogout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false); // mobile sidebar
  const [userMenu, setUserMenu] = useState(false);
  const sync = useSyncStatus();
  const confirm = useConfirm();
  const pid = me?.profile?.project_id ?? me?.project_id ?? me?.project?.id ?? me?.profile?.project?.id;

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!userMenu) return undefined;
    const close = () => setUserMenu(false);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [userMenu]);

  // The menu is built from permissions. Later modules get added to this list.
  const isAuditor = profile?.role_code === "auditor";
  const daysTo = pid ? `/projects/${pid}/shoot-days` : null;
  const onDays = (path) => path.startsWith("/shoot-days/") || /^\/projects\/[^/]+\/shoot-days/.test(path);
  const nav = [
    // Auditors work only on shoot days, so a dashboard would be an empty page for them
    { to: "/", label: "Dashboard", end: true, show: !isAuditor },
    ...(daysTo && can("shoot_day.view") ? [{ to: daysTo, label: "Shoot days", show: true, match: onDays }] : []),
    { to: "/houses", label: "Houses", show: can("house.create") || (can("project.view") && !isAuditor) },
    {
      to: "/users",
      label: "Users",
      show: can("users.view") || can("users.create.user") || can("users.create.admin"),
    },
    { to: "/audit", label: "Audit log", show: can("audit.view") },
  ].filter((i) => i.show);

  async function logout() {
    if (sync.pending > 0) {
      const ok = await confirm({
        title: "Log out with unsaved changes?",
        message: `${sync.pending} change${sync.pending === 1 ? " is" : "s are"} still waiting to be saved. Log out only after you are online, or they will stay on this device until you log in again.`,
        confirmLabel: "Log out anyway",
      });
      if (!ok) return;
    }
    doLogout();
  }

  const initials = (user?.full_name || user?.email || "?")
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  const sidebar = (
    <nav className="flex h-full flex-col bg-ink p-5 text-white">
      <div className="mb-8 text-white">
        <Logo />
      </div>
      <div className="space-y-1">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `block rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
                (item.match ? item.match(location.pathname) : isActive) ? "bg-brand text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
      <p className="mt-auto text-xs text-white/35">Money in rupees · v1 records only</p>
    </nav>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Mobile sidebar */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/60" onClick={() => setMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-lg border border-line lg:hidden"
          >
            ☰
          </button>
          <div className="hidden sm:block lg:hidden">
            <Logo />
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <SyncBadge />
          <HatSwitcher />
          <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setUserMenu(!userMenu)}
              aria-label="User menu"
              className="grid h-10 w-10 cursor-pointer place-items-center rounded-full bg-brand text-sm font-bold text-white hover:bg-brand-dark"
            >
              {initials}
            </button>
            {userMenu && (
              <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-line bg-white p-2 shadow-xl">
                <div className="border-b border-line px-3 pb-3 pt-2">
                  <p className="truncate text-sm font-bold">{user?.full_name || "—"}</p>
                  <p className="truncate text-xs text-ink/50">{user?.email}</p>
                  <p className="mt-1 text-xs font-semibold text-brand">{profile?.role_name}</p>
                </div>
                <button
                  onClick={() => navigate("/change-password")}
                  className="mt-1 block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-mist"
                >
                  Change password
                </button>
                <button
                  onClick={logout}
                  className="block w-full cursor-pointer rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-brand hover:bg-brand-light"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <SyncToasts />
        <Outlet />
      </main>
    </div>
  );
}
