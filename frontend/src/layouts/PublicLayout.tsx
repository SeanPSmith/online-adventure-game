import { BrandLockup } from "../components/brand/BrandLockup";
import { useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { useAuth } from "../state/AuthContext";
import { useInkboundPaper } from "../features/appearance/inkboundPaper";

const BUILD_ID = (import.meta.env.VITE_BUILD_ID || "DEV").trim();
const FEEDBACK_EMAIL = (import.meta.env.VITE_FEEDBACK_EMAIL || "").trim();

export function PublicLayout() {
  const { authenticated, user } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search, location.hash]);

  const feedbackHref = FEEDBACK_EMAIL
    ? `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent("Quillairo feedback")}`
    : "";

  return (
    <div className="site-shell public-shell qpub-shell" data-ink-paper={paper}>
      <a className="skip-link" href="#main-content">SKIP TO CONTENT</a>
      <header className="site-header public-header" onKeyDown={(event) => {
        if (event.key === "Escape" && menuOpen) {
          setMenuOpen(false);
          menuButton.current?.focus();
        }
      }}>
        <Link className="brand q-site-brand" to="/" aria-label="Quillairo home">
          <BrandLockup paper={paper} />
        </Link>

        <button
          className="public-menu-toggle"
          ref={menuButton}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
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
          <a href="/#worlds">WORLDS</a>
          <Link to="/rulebook">RULEBOOK</Link>
          {authenticated ? (
            <>
              <Link to="/account">ACCOUNT{user?.username ? ` // ${user.username}` : ""}</Link>
              <Link className="button button-primary" to="/game">PLAY</Link>
            </>
          ) : (
            <>
              <Link to="/login">SIGN IN</Link>
              <Link className="button button-primary" to="/register">BEGIN ADVENTURE</Link>
            </>
          )}
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="public-main">
        <Outlet />
      </main>

      <footer className="site-footer public-footer">
        <div className="footer-identity">
          <BrandLockup size="footer" paper={paper} />
          <span>SHARED STORIES. UNFORGETTABLE CHOICES.</span>
        </div>

        <nav className="footer-nav" aria-label="Footer navigation">
          <a href="/#about">ABOUT</a>
          <a href="/#how-it-works">HOW IT WORKS</a>
          <a href="/#worlds">WORLDS</a>
          <Link to="/rulebook">RULEBOOK</Link>
          <Link to="/privacy">PRIVACY</Link>
          <Link to="/terms">TERMS</Link>
          {feedbackHref ? (
            <a href={feedbackHref}>FEEDBACK</a>
          ) : null}
        </nav>

        <div className="footer-meta">
          <span>© {new Date().getFullYear()} QUILLAIRO</span>
          <span className="build-indicator">BUILD // {BUILD_ID}</span>
        </div>
      </footer>
    </div>
  );
}
