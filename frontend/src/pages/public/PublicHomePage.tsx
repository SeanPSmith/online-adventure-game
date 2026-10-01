import { Link } from "react-router";

export function PublicHomePage() {
  return (
    <div className="landing-grid">
      <section className="landing-hero">
        <div className="eyebrow">COOPERATIVE AI STORY RPG</div>
        <h1>EVERY BAD DECISION BECOMES CANON.</h1>
        <p>
          Create a Hero, enter an adventure alone or with a partner, and make
          choices inside a persistent story world that remembers what you did.
        </p>
        <div className="button-row">
          <Link className="button button-primary" to="/register">CREATE A HERO</Link>
          <Link className="button" to="/login">SIGN IN</Link>
        </div>
      </section>

      <section className="ascii-landing" aria-label="Decorative terminal illustration">
        <pre>{String.raw`
      ┌───────────────────┐
      │   TALES OF TWO    │
      │                   │
      │   YOU > CHOOSE_   │
      │   WORLD > REACTS  │
      │   STORY > REMEMBERS
      └───────────────────┘
        `}</pre>
      </section>
    </div>
  );
}
