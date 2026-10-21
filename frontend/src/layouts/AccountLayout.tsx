import { Link, NavLink, Outlet } from "react-router";
import { readLastGameRoute } from "../services/gameRouteMemory";
import { useAuth } from "../state/AuthContext";
import { useInkboundPaper } from "../features/appearance/inkboundPaper";

export function AccountLayout() {
  const { user } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  const canAuthor = user?.permissions.includes("author") ?? false;
  const isAdmin = user?.permissions.includes("admin") ?? false;
  const returnToGame = readLastGameRoute();

  return (
    <div className="site-shell inkbound-system-shell inkbound-account-shell" data-ink-paper={paper}>
      <a className="skip-link" href="#main-content">SKIP TO CONTENT</a>
      <header className="site-header">
        <Link className="brand" to="/game">
          <span className="brand-mark" aria-hidden="true">✧</span>
          <span><strong>QUILLAIRO</strong><small>THE READING ROOM</small></span>
        </Link>
        <nav className="header-nav">
          <NavLink to="/account">ACCOUNT</NavLink>
          {canAuthor ? <NavLink to="/account/author">AUTHOR</NavLink> : null}
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
