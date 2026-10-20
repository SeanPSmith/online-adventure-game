import { Navigate, Outlet } from "react-router";
import { useAuth } from "../../state/AuthContext";

/** Pass 64.4O — protect experiments from general player traffic.
 * UI permission checks are not an authorization boundary for API actions:
 * server endpoints must continue enforcing their own auth/roles.
 */
export function DevLabGate() {
  const { user, status } = useAuth();
  if (status === "loading") return <div className="route-loading">AUTHENTICATING_</div>;
  if (status !== "authenticated") return <Navigate to="/login" replace />;
  if (!user?.permissions.includes("admin")) return <Navigate to="/game" replace />;
  return <Outlet />;
}
