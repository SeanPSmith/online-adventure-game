import { useCallback, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useModal } from "../../state/ModalContext";
import "./inkboundFoundation.css";

/**
 * Pass 65.0 / admin-only, isolated React design foundation.
 * Sample text is intentionally deterministic. NO game state or socket calls occur
 * in this preview. The real room remains owned by AdventurePage/useLiveAdventure.
 */
type PageMode = "landing" | "reader";
const art = "/art/inkbound";
const choices = [
  { title: "Follow the lantern light.", caption: "Trust what you can see", image: `${art}/lantern-books.png` },
  { title: "Wake your companion.", caption: "No decision made alone", image: `${art}/camp-cups.png` },
  { title: "Leave the road for the trees.", caption: "The quieter path", image: `${art}/signpost.png` },
];
const story = [
  "The road climbed through broken hills, its stones slick with last night's rain. Mist hung in the valley below, swallowing the river and whatever lay beyond it. You and your companion had traveled since dawn, and the cold was beginning to seep through your cloak, a quiet reminder that the north was less forgiving than the maps had suggested.",
  "Ahead, a faint glow flickered between the trees — a lantern, perhaps, or a small fire. Your companion, who had walked in silence for the last hour, now sits upon a stone, shoulders heavy with fatigue.",
  "The night is still young, but the road offers more than one way forward.",
];

function Feature({ image, title, children }: { image: string; title: string; children: ReactNode }) {
  return <article className="inkbound-feature">
    <img src={image} alt="" loading="lazy" className="inkbound-feature-art" />
    <h3>{title}</h3><span className="inkbound-small-rule" aria-hidden="true" />
    <p>{children}</p>
  </article>;
}

export function InkboundFoundationPage() {
  const [mode, setMode] = useState<PageMode>("reader");
  const [paper, setPaper] = useState<"ivory" | "parchment">("ivory");
  const [chapter, setChapter] = useState(1);
  const [choice, setChoice] = useState<number | null>(null);
  const [committed, setCommitted] = useState(false);
  const { openModal } = useModal();

  const reset = useCallback((newMode: PageMode) => {
    setMode(newMode); setChoice(null); setCommitted(false); setChapter(1);
  }, []);
  const viewJournal = () => openModal({
    title: "The Wanderer's Journal",
    body: <div className="inkbound-dialog-copy"><p className="inkbound-dialog-rubric">A note in the margin</p>
      <p>The road north. A distant light. A stranger whose name you still do not know.</p>
      <p>These are sample notes for the Inkbound visual workshop. The live Chronicle and journal remain untouched.</p></div>,
    dismissLabel: "Return to the chapter",
  });
  const viewHero = () => openModal({
    title: "The Wanderer",
    body: <div className="inkbound-dialog-copy"><p className="inkbound-dialog-rubric">Hero · Level One</p>
      <p><strong>Vitality</strong> &nbsp; ♥ ♥ ♡</p><p><strong>Experience</strong> &nbsp; 20 / 100</p>
      <p>A design-state demonstration. Live hero values are never changed from this workshop.</p></div>,
    dismissLabel: "Close character sheet",
  });
  const turnPage = () => { setChoice(null); setCommitted(false); setChapter((n) => n + 1); };

  return <div className="inkbound" data-ink-paper={paper}>
    <a className="inkbound-skip" href="#inkbound-main">Skip to chapter</a>
    <header className="inkbound-header">
      <Link to="/game" className="inkbound-wordmark" aria-label="Return to Tales of Two game">Tales of Two</Link>
      <span className="inkbound-header-rule" aria-hidden="true" />
      <nav className="inkbound-header-nav" aria-label="Inkbound workshop navigation">
        <button type="button" className={mode === "landing" ? "is-active" : ""} onClick={() => reset("landing")}>Frontispiece</button>
        <button type="button" className={mode === "reader" ? "is-active" : ""} onClick={() => reset("reader")}>The Story</button>
        <button type="button" onClick={viewJournal}>Journal</button>
        <button type="button" onClick={() => setPaper(paper === "ivory" ? "parchment" : "ivory")} aria-label={`Change paper tone, current: ${paper}`} title="Switch paper tone">◑ <span>Paper</span></button>
        <Link className="inkbound-header-return" to="/dev">Workshop ↗</Link>
      </nav>
    </header>
    <main id="inkbound-main" className="inkbound-main">
      {mode === "landing" ? <div className="inkbound-landing">
        <section className="inkbound-landing-hero">
          <div className="inkbound-landing-copy">
            <div className="inkbound-kicker"><i /> An interactive text adventure</div>
            <h1>Tales <em>of</em> Two</h1>
            <p className="inkbound-deck">A story unfolds one choice at a time.</p>
            <p className="inkbound-drop-opening"><span className="inkbound-dropcap">T</span>he road was a ribbon of mud and memory, leading north toward a forgotten crown. Behind you, a home. Beside you, a stranger. Ahead, a hundred possibilities.</p>
            <div className="inkbound-landing-actions">
              <button type="button" className="inkbound-action-primary" onClick={() => reset("reader")}>Begin your story <span aria-hidden="true">→</span></button>
              <Link to="/game" className="inkbound-text-link">Enter the actual game <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          <div className="inkbound-landing-image inkbound-fade" key="frontispiece">
            <img src={`${art}/hero-vista.png`} alt="Two travelers looking across a misty mountain valley toward a ruined castle, rendered in black ink wash" />
          </div>
        </section>
        <section className="inkbound-features" aria-label="Adventure features">
          <Feature title="Branching Choices" image={`${art}/signpost.png`}>Your decisions shape the world, its people, and each other.</Feature>
          <Feature title="Rich Story Chapters" image={`${art}/lantern-books.png`}>An unfolding narrative of strange places, consequences, and hidden paths.</Feature>
          <Feature title="Cooperative Play" image={`${art}/camp-cups.png`}>Two perspectives. One journey. Play together or venture alone.</Feature>
        </section>
      </div> : <div className="inkbound-reader">
        <header className="inkbound-chapter-header">
          <div className="inkbound-kicker inkbound-chapter-kicker"><i /> Chapter {chapter === 1 ? "One" : chapter === 2 ? "Two" : chapter}</div>
          <h1>{chapter === 1 ? "The Road North" : "Beyond the Lantern"}</h1>
          <div className="inkbound-ornament" aria-hidden="true"><span />✧<span /></div>
        </header>
        <div className="inkbound-reader-art inkbound-fade" key={`chapter-${chapter}`}>
          <img src={`${art}/north-road.png`} alt="Two travelers overlook a mist-filled river valley beneath a ruined northern castle" />
        </div>
        <section className="inkbound-prose" aria-label="Chapter narration">
          {chapter === 1 ? <>
            <p className="inkbound-prose-start"><span className="inkbound-dropcap">T</span>{story[0].slice(1)}</p>
            <p>{story[1]}</p><p>{story[2]}</p>
          </> : <>
            <p className="inkbound-prose-start"><span className="inkbound-dropcap">B</span>eyond the lantern, the road bends sharply beneath the trees. The distant ruins disappear behind a veil of mist, and the sound of running water grows louder.</p>
            <p>Your companion pauses. Somewhere in the dark, a bell begins to toll.</p>
          </>}
        </section>
        <section className="inkbound-choices" aria-label="Narrative choices">
          <div className="inkbound-choices-label"><span /> What do you do? <span /></div>
          <div className="inkbound-choice-grid">
            {choices.map((item, index) => <button className={`inkbound-choice ${choice === index ? "is-picked" : ""}`} type="button" key={item.title} disabled={committed} aria-pressed={choice === index} onClick={() => setChoice(index)}>
              <img src={item.image} alt="" /><span className="inkbound-choice-text"><strong>{item.title}</strong><small>{item.caption}</small></span><span className="inkbound-choice-arrow" aria-hidden="true">→</span>
            </button>)}
          </div>
          <div className="inkbound-decision-state" aria-live="polite">
            {committed ? <><span>Your choice is recorded in this visual demonstration.</span><button type="button" onClick={turnPage}>Continue the preview →</button></>
              : choice === null ? <span>Choose the path your story will take.</span> : <><span>Selected: {choices[choice].title}</span><button type="button" onClick={() => setCommitted(true)}>Confirm choice →</button></>}
          </div>
        </section>
        <footer className="inkbound-status" aria-label="Sample hero and party status">
          <button type="button" className="inkbound-status-hero" onClick={viewHero}><span className="inkbound-avatar">✦</span><span><strong>Hero</strong><small>Lv. 1 &nbsp; The Wanderer</small></span></button>
          <div className="inkbound-stat"><span>HP</span><strong aria-label="Two of three hearts">♥ ♥ <span className="is-empty">♥</span></strong></div>
          <div className="inkbound-stat inkbound-exp"><span>XP</span><div className="inkbound-meter" aria-label="20 of 100 experience points"><span /></div><small>20 / 100</small></div>
          <button type="button" className="inkbound-party" onClick={viewJournal}>Journal <span aria-hidden="true">↗</span></button>
        </footer>
      </div>}
    </main>
    <footer className="inkbound-footer"><span>✧ &nbsp; Some stories are better shared.</span><span className="inkbound-footer-rule" /><span>Inkbound / Design workshop · Sample content only</span></footer>
  </div>;
}
