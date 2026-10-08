import { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useAuth } from "../state/AuthContext";

const BUILD_ID = (import.meta.env.VITE_BUILD_ID || "DEV").trim();
const FEEDBACK_EMAIL = (import.meta.env.VITE_FEEDBACK_EMAIL || "").trim();

export function PublicLayout() {
  const { authenticated, user } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const feedbackHref = FEEDBACK_EMAIL
    ? `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Tales of Two feedback")}`
    : "";

  return (
    <div className="site-shell public-shell">
      <a className="skip-link" href="#main-content">SKIP TO CONTENT</a>
      <header className="site-header public-header">
        <Link className="brand" to="/" aria-label="Tales of Two home">
          <span className="brand-mark" aria-hidden="true">T2</span>
          <span>
            <strong>TALES OF TWO</strong>
            <small>AI STORY RPG // SOLO + CO-OP_</small>
          </span>
        </Link>

        <button
          className="public-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="public-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          {menuOpen ? "CLOSE" : "MENU"}
        </button>

        <nav
          id="public-navigation"
          className={`header-nav public-nav ${menuOpen ? "is-open" : ""}`}
          aria-label="Primary navigation"
        >
          <a href="/#how-it-works">HOW IT WORKS</a>
          <Link to="/rulebook">RULEBOOK</Link>
          {authenticated ? (
            <>
              <Link to="/account">ACCOUNT{user?.username ? ` // ${user.username}` : ""}</Link>
              <Link className="button button-primary" to="/game">PLAY</Link>
            </>
          ) : (
            <>
              <Link to="/login">SIGN IN</Link>
              <Link className="button button-primary" to="/game/heroes/new">CREATE HERO</Link>
            </>
          )}
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="public-main">
        <Outlet />
      </main>

      <footer className="site-footer public-footer">
        <div className="footer-identity">
          <strong>TALES OF TWO</strong>
          <span>SHARED STORIES. BAD DECISIONS. PERMANENT CONSEQUENCES.</span>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="/#about">ABOUT</a>
          <a href="/#how-it-works">HOW IT WORKS</a>
          <Link to="/rulebook">RULEBOOK</Link>
          <Link to="/privacy">PRIVACY</Link>
          <Link to="/terms">TERMS</Link>
          {feedbackHref ? (
            <a href={feedbackHref}>FEEDBACK</a>
          ) : (
            <span title="Configure VITE_FEEDBACK_EMAIL to enable this channel">FEEDBACK // OFFLINE</span>
          )}
        </nav>

        <div className="footer-meta">
          <span>© {new Date().getFullYear()} TALES OF TWO</span>
          <span className="build-indicator">BUILD // {BUILD_ID}</span>
        </div>
      </footer>
    </div>
  );
}
