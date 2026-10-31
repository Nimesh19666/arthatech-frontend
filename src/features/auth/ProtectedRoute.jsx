import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { Spinner } from "../../components/ui.jsx";

/**
 * Wrap a route. `anyOf` is an optional list of permission codes:
 * the person needs at least one of them to see the page.
 */
export default function ProtectedRoute({ children, anyOf }) {
  const { status, can } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-6 w-6 text-brand" />
      </div>
    );
  }
  if (status === "anon") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (anyOf && !anyOf.some((code) => can(code))) {
    return (
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="text-5xl font-black text-brand">403</p>
        <h1 className="mt-3 text-xl font-extrabold">You do not have access to this page</h1>
        <p className="mt-2 text-sm text-ink/60">Ask your admin if you think this is a mistake.</p>
      </div>
    );
  }
  return children;
}
