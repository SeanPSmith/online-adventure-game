import { Link, NavLink, Outlet } from "react-router";
import { readLastGameRoute } from "../services/gameRouteMemory";
import { useAuth } from "../state/AuthContext";

export function AccountLayout() {
  const { user } = useAuth();
  const canAuthor = user?.permissions.includes("author") ?? false;
  const isAdmin = user?.permissions.includes("admin") ?? false;
  const returnToGame = readLastGameRoute();

  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">SKIP TO CONTENT</a>
      <header className="site-header">
        <Link className="brand" to="/game">
          <span className="brand-mark">T2</span>
          <span><strong>TALES OF TWO</strong><small>ACCOUNT SYSTEM_</small></span>
        </Link>
        <nav className="header-nav">
          <NavLink to="/account">ACCOUNT</NavLink>
          {canAuthor ? <a href="/author-console">AUTHOR</a> : null}
          {isAdmin ? <NavLink to="/admin">ADMIN</NavLink> : null}
          {isAdmin ? <NavLink to="/game/arcade">ARCADE</NavLink> : null}
          <Link to={returnToGame}>RETURN TO GAME</Link>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="account-main">
        <Outlet />
      </main>
    </div>
  );
}
