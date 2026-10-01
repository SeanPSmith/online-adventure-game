import { Link, Outlet } from "react-router";
import { useAuth } from "../state/AuthContext";

export function PublicLayout() {
  const { authenticated } = useAuth();

  return (
    <div className="site-shell public-shell">
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-mark">T2</span>
          <span>
            <strong>TALES OF TWO</strong>
            <small>SHARED STORY SYSTEM_</small>
          </span>
        </Link>

        <nav className="header-nav">
          <Link to="/privacy">PRIVACY</Link>
          <Link to="/terms">TERMS</Link>
          {authenticated ? (
            <Link className="button button-primary" to="/game">ENTER GAME</Link>
          ) : (
            <>
              <Link to="/login">SIGN IN</Link>
              <Link className="button button-primary" to="/register">CREATE ACCOUNT</Link>
            </>
          )}
        </nav>
      </header>

      <main className="public-main">
        <Outlet />
      </main>
    </div>
  );
}
