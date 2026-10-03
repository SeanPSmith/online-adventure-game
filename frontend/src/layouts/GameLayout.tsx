import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../state/AuthContext";

export function GameLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const canAuthor = user?.permissions.includes("author") ?? false;
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

        <nav className="header-nav game-nav">
          <NavLink to="/game" end>ADVENTURES</NavLink>
          <NavLink to="/game/heroes">HEROES</NavLink>
          <NavLink to="/game/history">HISTORY</NavLink>
          <NavLink to="/game/rulebook">RULEBOOK</NavLink>
          {canAuthor ? <NavLink to="/author">AUTHOR</NavLink> : null}
          <NavLink to="/account">ACCOUNT</NavLink>
          <button className="button button-quiet" type="button" onClick={() => void logout()}>
            LOG OUT
          </button>
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
