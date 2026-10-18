import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../state/AuthContext";
import "./visualBookPlayground.css";
import { InkLabBook } from "./InkLabBook";

// PASS 64.4D: deliberately isolated playground, not a replacement for /game.
// The image contains the physical desk and *blank* ivory book only. All menu
// lettering and interactions are accessible DOM elements, never painted pixels.
const MENU = ["Home", "Heroes", "Wardrobe", "My Adventures", "Discover", "System"] as const;
type Tab = (typeof MENU)[number];

export function VisualBookPlaygroundPage() {
  return <VisualBookPlaygroundShell />;
}

// PASS 64.4E: separate effects experiment; the original blank /visual-playground remains intact.
export function InkBookPlaygroundPage() {
  return <VisualBookPlaygroundShell inkLab />;
}

function VisualBookPlaygroundShell({ inkLab = false }: { inkLab?: boolean }) {
  const { user } = useAuth();
  const [active, setActive] = useState<Tab>("Home");
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const username = user?.username || "Adventurer";

  return (
    <div className={`vb-lab ${inkLab ? "has-ink" : ""}`} data-active-tab={active}>
      <a className="vb-skip" href="#vb-book">Skip navigation to book</a>
      <img
        className="vb-scene"
        src="/art/pass64/pass64-4d-tabletop-book.webp"
        alt="An open, blank ivory-paged book on a sunlit wooden desk beside tea, wildflowers, old maps, leather journals, and brass instruments."
        draggable={false}
      />
      <header className="vb-header">
        <Link className="vb-identity" to="/game" aria-label="Tales of Two — return to the live game">
          <svg className="vb-compass" viewBox="0 0 80 80" aria-hidden="true">
            <circle cx="40" cy="40" r="31" fill="none" stroke="currentColor" strokeWidth="1.45" />
            <circle cx="40" cy="40" r="25" fill="none" stroke="currentColor" strokeWidth=".75" />
            <path d="M40 1V79 M1 40H79 M13 13L67 67 M67 13L13 67" stroke="currentColor" strokeWidth="1" opacity=".75" />
            <path d="M40 9 45 35 71 40 45 45 40 71 35 45 9 40 35 35Z" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="m40 12 3.4 24.6L40 40l-3.4-3.4Z M68 40l-24.6 3.4L40 40l3.4-3.4Z M40 68l-3.4-24.6L40 40l3.4 3.4Z M12 40l24.6-3.4L40 40l-3.4 3.4Z" fill="currentColor" />
            <circle cx="40" cy="40" r="3" fill="currentColor" />
          </svg>
          <span className="vb-wordmark">
            <strong>TALES OF TWO</strong>
            <span>A LIBRARY OF POSSIBILITIES</span>
          </span>
        </Link>
        <button className="vb-mobile-toggle" type="button" aria-expanded={menuOpen} aria-controls="vb-menu" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? "Close menu" : "Menu"}
        </button>
        <nav className={`vb-parchment ${menuOpen ? "is-open" : ""}`} id="vb-menu" aria-label="Visual playground — menu style preview">
          {MENU.map((item) => (
            <button
              key={item}
              type="button"
              className={`vb-nav-item ${active === item ? "is-active" : ""}`}
              aria-current={active === item ? "page" : undefined}
              onClick={() => { setActive(item); setMenuOpen(false); }}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="vb-profile-wrap">
          <button type="button" className="vb-profile" aria-label={`${username} — account menu`} aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}>
            <span className="vb-avatar" aria-hidden="true">{username.slice(0, 1).toUpperCase()}</span>
            <span className="vb-username">{username}</span>
            <svg viewBox="0 0 18 18" width="16" height="16" aria-hidden="true"><path d="m4 7 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>
          </button>
          {profileOpen ? (
            <div className="vb-profile-menu">
              <Link to="/game">Return to live game</Link>
              <Link to="/account?tab=preferences">Account preferences</Link>
            </div>
          ) : null}
        </div>
      </header>
      <main id="vb-book" className="vb-book-space" tabIndex={-1} aria-label={inkLab ? "Ink laboratory on ivory pages" : "Blank book for the visual playground"}>
        {inkLab ? <InkLabBook activeTab={active} /> : null}
      </main>
    </div>
  );
}
