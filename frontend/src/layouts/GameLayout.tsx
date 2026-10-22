import { BrandLockup } from "../components/brand/BrandLockup";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useAuth } from "../state/AuthContext";
import { useInkboundPaper } from "../features/appearance/inkboundPaper";
import { useAppearance } from "../features/appearance/AppearanceContext";
import "../styles/pass64Shell.css";
import "../styles/deskShellFidelityPass64.css";
import "../styles/deskScrapbookShell64.css";
import "../styles/pass64_2cPerformance.css";
import "../features/appearance/themePresentation.css";
import { themeCssVars } from "../features/appearance/themePacks";
import { themeEditionCssVars } from "../features/appearance/themeEditions";
import "../features/appearance/themeEditions.css";
import "../styles/brighterWorldShell.css";
import "../pages/game/livingBook644.css";
import type { CSSProperties } from "react";

export function GameLayout() {
  const { user, logout } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  const location = useLocation();
  const { preferences, libraryTheme, edition } = useAppearance();
  const canAuthor = user?.permissions.includes("author") ?? false;
  const isAdmin = user?.permissions.includes("admin") ?? false;
  const isAdventureMode = location.pathname.startsWith("/game/adventure/");
  const isDeskHome = location.pathname === "/game" || location.pathname === "/game/home-lab" || location.pathname === "/dev/home-lab";

  return (
    <div className={`site-shell game-site-shell p64-shell inkbound-system-shell ${isAdventureMode ? "is-adventure-mode" : ""} ${isDeskHome ? "is-desk-home" : ""}`} data-ink-paper={paper} data-platform-skin={preferences.platformSkin} data-edition-family={edition.family} data-edition-mode={edition.mode} data-installed-library-theme={Boolean(libraryTheme)} data-theme-material={libraryTheme?.material} style={(libraryTheme ? themeCssVars(libraryTheme) : themeEditionCssVars(edition)) as CSSProperties}>
      <a className="skip-link" href="#main-content">SKIP TO CONTENT</a>
      <header className={`site-header game-header ${isAdventureMode ? "is-adventure-header" : ""}`}>
        <Link className="brand q-site-brand" to="/game" aria-label="Quillairo home"><BrandLockup /></Link>

        <nav className="header-nav game-nav" aria-label="Primary navigation">
          <NavLink to="/game" end>HOME</NavLink>
          <NavLink to="/game/heroes">HEROES</NavLink>
          <NavLink to="/account?tab=preferences#wardrobe">WARDROBE</NavLink>
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
