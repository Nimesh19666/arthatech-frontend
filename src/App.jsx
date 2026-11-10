import { Link, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./features/auth/AuthContext.jsx";
import AppShell from "./components/AppShell.jsx";
import ProtectedRoute from "./features/auth/ProtectedRoute.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import ChangePasswordPage from "./pages/ChangePasswordPage.jsx";
import HousesPage from "./pages/HousesPage.jsx";
import HouseDetailPage from "./pages/HouseDetailPage.jsx";
import ProjectDetailPage from "./pages/ProjectDetailPage.jsx";
import AuditLogPage from "./pages/AuditLogPage.jsx";
import ShootDaysPage from "./pages/ShootDaysPage.jsx";
import ShootDayPage from "./pages/ShootDayPage.jsx";

/** Auditors land on the shoot days of their own project. Everyone else sees the dashboard. */
function Home() {
  const { me, can } = useAuth();
  const pid = me?.profile?.project_id ?? me?.project_id ?? me?.project?.id ?? me?.profile?.project?.id;
  const fieldOnly = me?.profile?.role_code === "auditor" || (can("shoot_day.view") && !can("house.create") && !can("users.view") && !can("project.create"));
  if (fieldOnly && pid) return <Navigate to={`/projects/${pid}/shoot-days`} replace />;
  return <DashboardPage />;
}

function NotFound() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <p className="text-5xl font-black text-brand">404</p>
      <h1 className="mt-3 text-xl font-extrabold">Page not found</h1>
      <Link to="/" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">
        Go to dashboard
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route
          path="users"
          element={
            <ProtectedRoute anyOf={["users.view", "users.create.user", "users.create.admin"]}>
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route path="houses" element={<HousesPage />} />
        <Route path="houses/:orgId" element={<HouseDetailPage />} />
        <Route path="projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="projects/:projectId/shoot-days" element={<ProtectedRoute anyOf={["shoot_day.view"]}><ShootDaysPage /></ProtectedRoute>} />
        <Route path="shoot-days/:dayId" element={<ProtectedRoute anyOf={["shoot_day.view"]}><ShootDayPage /></ProtectedRoute>} />
        <Route
          path="audit"
          element={
            <ProtectedRoute anyOf={["audit.view"]}>
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        <Route path="change-password" element={<ChangePasswordPage />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
