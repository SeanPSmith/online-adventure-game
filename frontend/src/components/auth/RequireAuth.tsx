import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../../state/AuthContext";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <div className="route-loading">AUTHENTICATING_</div>;
  }

  if (status !== "authenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ returnTo: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <Outlet />;
}
