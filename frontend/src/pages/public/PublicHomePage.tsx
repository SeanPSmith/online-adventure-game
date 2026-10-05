import { Link } from "react-router";
import { useAuth } from "../../state/AuthContext";

export function PublicHomePage() {
  const { authenticated } = useAuth();

  return (
    <div className="public-home">
      <section className="home-hero" id="about">
        <div className="home-hero-copy">
          <div className="eyebrow">AI-DIRECTED TEXT ADVENTURE // ONE OR TWO PLAYERS</div>
          <h1>MAKE A CHOICE.<br />THE STORY HAS TO LIVE WITH IT.</h1>
          <p className="home-lede">
            Tales of Two is a persistent text adventure RPG built around your Hero and your
            decisions. Play alone or share a story with a partner while the game handles the
            rolls, consequences, progression, and continuity behind the screen.
          </p>

          <div className="home-primary-actions" aria-label="Start playing">
            <Link className="button button-primary home-play-button" to="/game">PLAY</Link>
            <Link className="button" to="/game/heroes/new">CREATE HERO</Link>
            {!authenticated ? <Link className="button button-quiet" to="/login">SIGN IN</Link> : null}
          </div>

          <div className="home-mode-strip" aria-label="Play modes">
            <div>
              <span>01 // SOLO</span>
              <strong>YOUR HERO. YOUR CALLS.</strong>
            </div>
            <div>
              <span>02 // CO-OP</span>
              <strong>TWO HEROES. ONE CANON.</strong>
            </div>
            <div>
              <span>03 // PERSISTENT</span>
              <strong>THE WORLD REMEMBERS.</strong>
            </div>
          </div>
        </div>

        <div className="home-terminal" aria-label="Example Tales of Two story terminal">
          <div className="home-terminal-bar">
            <span>STORY://THE_GUTTER_KINGDOM</span>
            <span className="network-badge is-online">DIRECTOR ONLINE</span>
          </div>
          <div className="home-terminal-body">
            <div className="home-terminal-status">
              <span>TURN 12</span>
              <span>HERO // MARA</span>
              <span>PARTNER // ELI</span>
            </div>
            <p>
              The bridge chain snaps somewhere below you. The lanterns on the far tower
              answer one by one, which would be comforting if anyone had lit them.
            </p>
            <div className="home-choice-list">
              <div><b>01</b><span>CROSS BEFORE THE SECOND CHAIN FAILS.</span></div>
              <div><b>02</b><span>CLIMB DOWN AND FIND WHO CUT IT.</span></div>
              <div className="is-selected"><b>03</b><span>WAIT. LISTEN. LET THEM REVEAL THEMSELVES.</span></div>
            </div>
            <div className="home-terminal-command">CHOICE 03 LOCKED // WAITING FOR PARTNER_</div>
          </div>
        </div>
      </section>

      <section className="home-loop-section" id="how-it-works">
        <div className="home-section-heading">
          <span className="eyebrow">THE LOOP</span>
          <h2>THREE THINGS. THEN THE STORY MOVES.</h2>
        </div>

        <div className="home-loop-grid">
          <article>
            <span className="home-step-number">01</span>
            <h3>BUILD A HERO</h3>
            <p>
              Give them a name, Bio, Attributes, and Skills. Their build persists across
              adventures and grows as they earn XP.
            </p>
          </article>
          <article>
            <span className="home-step-number">02</span>
            <h3>CHOOSE WHAT HAPPENS</h3>
            <p>
              Pick an authored option or make the decision the story deserves. In co-op,
              both players commit before the turn resolves.
            </p>
          </article>
          <article>
            <span className="home-step-number">03</span>
            <h3>LIVE WITH THE RESULT</h3>
            <p>
              The server owns the mechanics. The Story Director turns those facts into the
              next scene without quietly rewriting the roll.
            </p>
          </article>
        </div>
      </section>

      <section className="home-play-modes">
        <article className="home-mode-panel">
          <header>
            <span>SOLO MODE</span>
            <strong>NO PARTY REQUIRED.</strong>
          </header>
          <p>
            Run a complete adventure at your own pace. Your Hero, progression, checks,
            intermissions, and story history use the same systems as co-op.
          </p>
          <Link to="/game">PLAY SOLO →</Link>
        </article>

        <article className="home-mode-panel">
          <header>
            <span>CO-OP MODE</span>
            <strong>DISAGRE PRODUCTIVELY.</strong>
          </header>
          <p>
            Invite one partner into the same room. Each Hero makes their own choice, and the
            Director has to reconcile both actions into one shared story.
          </p>
          <Link to="/game/heroes/new">CREATE YOUR HERO →</Link>
        </article>
      </section>

      <section className="home-bottom-cta">
        <div>
          <span className="eyebrow">READY WHEN YOU ARE</span>
          <h2>THE FIRST BAD DECISION IS FREE.</h2>
        </div>
        <div className="button-row">
          <Link className="button button-primary" to="/game">PLAY</Link>
          <Link className="button" to="/rulebook">READ THE RULEBOOK</Link>
        </div>
      </section>
    </div>
  );
}
