import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../state/AuthContext";

export function GameLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const canAuthor = user?.permissions.includes("author") ?? false;
  const isAdmin = user?.permissions.includes("admin") ?? false;
  const isAdventureMode = location.pathname.startsWith("/game/adventure/");

  return (
    <div className={`site-shell game-site-shell ${isAdventureMode ? "is-adventure-mode" : ""}`}>
      <header className={`site-header game-header ${isAdventureMode ? "is-adventure-header" : ""}`}>
        <Link className="brand" to="/game">
          <span className="brand-mark">T2</span>
          <span>
            <strong>TALES OF TWO</strong>
            <small>{isAdventureMode ? "LIVE ADVENTURE_" : "SHARED STORY SYSTEM_"}</small>
          </span>
        </Link>

        <nav className="header-nav game-nav" aria-label="Primary navigation">
          <NavLink to="/game" end>HOME</NavLink>
          <NavLink to="/game/heroes">HEROES</NavLink>
          <NavLink to="/game/history">CHRONICLES</NavLink>
          <details className="header-system-menu">
            <summary>SYSTEM</summary>
            <div className="header-system-popover">
              <NavLink to="/game/arcade">ARCADE</NavLink>
              <NavLink to="/game/rulebook">RULEBOOK</NavLink>
              {canAuthor ? <a href="/author-console">AUTHOR</a> : null}
              {isAdmin ? <NavLink to="/admin">CONTROL ROOM</NavLink> : null}
              <NavLink to="/account">ACCOUNT</NavLink>
                  <button className="button button-quiet" type="button" onClick={() => void logout()}>
                LOG OUT
              </button>
            </div>
          </details>
        </nav>

        <div className="header-user">
          <span className="eyebrow">SIGNED IN</span>
          <strong>{user?.username ?? "PLAYER"}</strong>
        </div>
      </header>

      <main className="game-main">
        <Outlet />
      </main>
    </div>
  );
}
