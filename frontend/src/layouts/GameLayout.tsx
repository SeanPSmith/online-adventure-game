import { BrandLockup } from "../components/brand/BrandLockup";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../state/AuthContext";
import { canUseAuthorStudio } from "../services/author";
import { useInkboundPaper } from "../features/appearance/inkboundPaper";
import "../styles/quillairoAdventureBoot.css";

export function GameLayout() {
  const { user, logout } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  const location = useLocation();
  const canAuthor = canUseAuthorStudio(user?.permissions);
  const isAdmin = user?.permissions.includes("admin") ?? false;
  const isAdventureMode = location.pathname.startsWith("/game/adventure/");
  // Keep the selected Inkspace shell mounted while its lazy-loaded reader
  // bundle resolves. Classic and physical Book are explicit opt-in exceptions.
  const reader = new URLSearchParams(location.search).get("reader");
  const isInkspaceAdventure = isAdventureMode && reader !== "classic" && reader !== "book";
  // The live Adventure Hall has its own document-scrolling Inkscape surface.
  const isInkspaceHome = location.pathname === "/game" || location.pathname === "/game/";

  return (
    <div className={`site-shell game-site-shell p64-shell inkbound-system-shell ${isAdventureMode ? "is-adventure-mode" : ""} ${isInkspaceAdventure ? "is-inkspace-route" : ""} ${isInkspaceHome ? "is-inkspace-home" : ""}`} data-ink-paper={paper}>
      <a className="skip-link" href="#main-content">SKIP TO CONTENT</a>
      <header className={`site-header game-header ${isAdventureMode ? "is-adventure-header" : ""}`}>
        <Link className="brand q-site-brand" to="/game" aria-label="Quillairo home"><BrandLockup paper={paper} /></Link>

        <nav className="header-nav game-nav" aria-label="Primary navigation">
          <NavLink to="/game" end>HOME</NavLink>
          <NavLink to="/game/heroes">HEROES</NavLink>
          <NavLink to="/account?tab=preferences#inkbound-paper">APPEARANCE</NavLink>
          <NavLink to="/game/adventures">MY ADVENTURES</NavLink>
          <details className="header-system-menu">
            <summary>SYSTEM</summary>
            <div className="header-system-popover">
              <NavLink to="/game/graveyard">GRAVEYARD</NavLink>
              <NavLink to="/game/arcade">ARCADE</NavLink>
              <NavLink to="/game/rulebook">RULEBOOK</NavLink>
              {canAuthor ? <NavLink to="/account/author">AUTHOR</NavLink> : null}
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

      <main id="main-content" tabIndex={-1} className="game-main">
        <Outlet />
      </main>
    </div>
  );
}
