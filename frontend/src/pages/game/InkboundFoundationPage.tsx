import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import "./inkboundFoundation.css";
import "./inkboundEditorial.css";
import "./inkboundJourney.css";
import "./inkboundSketchbook.css";
import "./inkboundFolio.css";
import { InkboundJourneyGallery, type FolioPage } from "./InkboundJourneyGallery";

/**
 * Pass 65.2 — Inkbound Editorial Atelier.
 * Every interaction below is local design-preview state. This page NEVER
 * starts or advances a real adventure, writes to backend services, or rolls
 * an authoritative die. The gameplay reader still owns actual game actions.
 */
type Page = "frontispiece" | "chapter" | FolioPage;
type Panel = "hero" | "party" | "journal" | "chronicle" | "chat" | "inventory" | "dice" | "settings";
type Note = { title: string; text: string };
const art = "/art/inkbound";
const choices = [
  { title: "Follow the lantern light", detail: "Investigate the glow beyond the pines.", image: `${art}/lantern-books.png`, numeral: "I" },
  { title: "Wake your companion", detail: "Decide together before night takes hold.", image: `${art}/camp-cups.png`, numeral: "II" },
  { title: "Leave the road", detail: "Take the unmarked path through the trees.", image: `${art}/signpost.png`, numeral: "III" },
];
const scene = [
  "The road climbed through broken hills, its stones slick with last night’s rain. Mist hung in the valley below, swallowing the river and whatever lay beyond it. You and your companion had traveled since dawn, and the cold was beginning to seep through your cloak, a quiet reminder that the north was less forgiving than the maps had suggested.",
  "Ahead, a faint glow flickered between the trees — a lantern, perhaps, or a small fire. Your companion, who had walked in silence for the last hour, now sits upon a stone, shoulders heavy with fatigue.",
  "The night is still young, but the road offers more than one way forward.",
];
const startNotes: Note[] = [
  { title: "The Road North", text: "A forgotten crown. A distant light. The north is colder than the maps suggested." },
  { title: "The Ashen Vale", text: "Ruins lie across the river, beyond the northern bridge." },
];
function Caption({ children }: { children: ReactNode }) { return <span className="i65-caption">{children}</span>; }
function RuleTitle({ children }: { children: ReactNode }) { return <div className="i65-rule-title"><span />{children}<span /></div>; }

export function InkboundFoundationPage() {
  const [page, setPage] = useState<Page>("chapter");
  const [folioHeroId, setFolioHeroId] = useState<string | null>(null);
  const [paper, setPaper] = useState<"ivory" | "parchment" | "slate" | "midnight">("ivory");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  const [committed, setCommitted] = useState(false);
  const [chapter, setChapter] = useState(1);
  const [narration, setNarration] = useState(false);
  const [notes, setNotes] = useState<Note[]>(startNotes);
  const [scratch, setScratch] = useState("The lantern could be a warning. Remember the bridge.");
  const [chatMessages, setChatMessages] = useState<{ from: string; text: string }[]>([
    { from: "Athena", text: "We should find somewhere to camp before dark." },
    { from: "The Wanderer", text: "That light may be our best chance." },
  ]);
  const [chatText, setChatText] = useState("");
  const closePanelButton = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const openPanel = (p: Panel) => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setPanel(p); };
  const dismiss = () => { setPanel(null); opener.current?.focus(); };

  useEffect(() => {
    if (panel === null) return;
    closePanelButton.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); dismiss(); }
      if (event.key === "Tab") {
        const items = Array.from(document.querySelectorAll<HTMLElement>(".i65-folio button:not(:disabled), .i65-folio a[href], .i65-folio input:not(:disabled), .i65-folio textarea:not(:disabled), .i65-folio select:not(:disabled)"));
        const first = items[0], last = items[items.length - 1];
        if (first && last) {
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => document.removeEventListener("keydown", keydown);
  }, [panel]);

  const changePage = (next: Page) => { setPage(next); setPanel(null); if (next === "frontispiece" || next === "chapter") {setChosen(null);setCommitted(false);} };
  const nextChapter = () => { setChapter(ch => ch + 1); setCommitted(false); setChosen(null); setPage("chapter"); };
  const submitChat = (event: FormEvent) => { event.preventDefault(); const text = chatText.trim(); if (!text) return; setChatMessages(items => [...items, { from: "The Wanderer", text }]); setChatText(""); };

  return <div className="inkbound i65" data-ink-paper={paper}>
    <a className="inkbound-skip" href="#i65-content">Skip to chapter</a>
    <header className="i65-masthead">
      <Link to="/game" className="i65-wordmark"><span className="i65-mark" aria-hidden="true">✧</span><span>Tales <em>of</em> Two</span></Link>
      <nav aria-label="Inkbound design preview" className="i65-mast-nav">
        <button type="button" className={page === "frontispiece" ? "is-current" : ""} onClick={() => changePage("frontispiece")}>Frontispiece</button>
        <button type="button" className={page === "chapter" ? "is-current" : ""} onClick={() => changePage("chapter")}>The story</button>
        <button type="button" className={page === "dashboard" ? "is-current" : ""} onClick={() => changePage("dashboard")}>Dashboard</button>
        <button type="button" className={(page === "heroes" || page === "sheet") ? "is-current" : ""} onClick={() => changePage("heroes")}>Heroes</button>
        <button type="button" className={(["dice","intermission","result"] as Page[]).includes(page) ? "is-current" : ""} onClick={() => changePage("dice")}>The turn</button>
        <button type="button" className={page === "arcade" ? "is-current" : ""} onClick={() => changePage("arcade")}>Arcade</button>
        <button type="button" onClick={() => openPanel("journal")}>Journal</button>
        <button type="button" onClick={() => openPanel("settings")}>Paper & ink</button>
      </nav>
      <div className="i65-mast-actions">
        <button type="button" className="i65-volume" onClick={() => setNarration(s => !s)} aria-pressed={narration} title="Toggle preview narration preference">{narration ? "◖))" : "◖"}<span className="i65-hide-small"> {narration ? "Sound on" : "Sound off"}</span></button>
        <Link to="/dev" className="i65-workshop-link">Workshop ↗</Link>
      </div>
    </header>
    <main id="i65-content" className="i65-canvas">
      {page !== "frontispiece" && page !== "chapter" ? <InkboundJourneyGallery page={page} onNavigate={(next) => next === "chapter" ? nextChapter() : changePage(next)} selectedChoice={chosen === null ? undefined : choices[chosen].title} heroId={folioHeroId} onSelectHero={(id) => { setFolioHeroId(id); changePage("sheet"); }} /> : page === "frontispiece" ? <>
        <section className="i65-frontispiece">
          <div className="i65-frontispiece-copy">
            <Caption>An interactive literary adventure</Caption>
            <h1>Tales <em>of</em> Two</h1>
            <p className="i65-lede">A story unfolds one choice at a time.</p>
            <p className="i65-first-text"><span className="i65-cap">T</span>he road was a ribbon of mud and memory, leading north toward a forgotten crown. Behind you, a home. Beside you, a stranger. Ahead, a hundred possibilities.</p>
            <button type="button" className="i65-dark-action" onClick={() => changePage("chapter")}>Begin your story <span aria-hidden="true">→</span></button>
          </div>
          <img className="i65-frontispiece-image" src={`${art}/north-road-editorial.png`} alt="Two travelers on a rocky outcrop above distant gothic ruins, depicted in monochrome watercolor and ink" />
        </section>
        <section className="i65-frontispiece-features" aria-label="Ways to adventure">
          <div><img src={`${art}/signpost.png`} alt="" /><h2>Decisions with weight</h2><p>Every path changes what happens next.</p></div>
          <div><img src={`${art}/lantern-books.png`} alt="" /><h2>Stories without borders</h2><p>Unexpected places, imperfect heroes, difficult choices.</p></div>
          <div><img src={`${art}/camp-cups.png`} alt="" /><h2>Better with a friend</h2><p>Walk the same road, but write your own story.</p></div>
        </section>
      </> : <>
        <section className="i65-chapter-heading" aria-label="Chapter title">
          <RuleTitle>Chapter {chapter === 1 ? "One" : chapter === 2 ? "Two" : chapter}</RuleTitle>
          <h1>{chapter === 1 ? "The Road North" : "The Lantern Beyond"}</h1>
          <div className="i65-ornament"><span />✧<span /></div>
        </section>
        <figure key={`illustration-${chapter}`} className="i65-panorama">
          <img src={`${art}/north-road-editorial.png`} alt="Two travelers look out across a misty northern valley toward gothic ruins; monochrome watercolor and crosshatched ink" />
          <figcaption>Plate I <span aria-hidden="true">—</span> The Ashen Vale</figcaption>
        </figure>
        <div className="i65-reading-layout">
          <article className="i65-story-leaf">
            <div className="i65-prose">
              {chapter === 1 ? scene.map((p, i) => <p className={i === 0 ? "i65-opening" : ""} key={i}>{i === 0 ? <><span className="i65-cap">{p[0]}</span>{p.slice(1)}</> : p}</p>) : <><p className="i65-opening"><span className="i65-cap">B</span>eyond the lantern, the road bends sharply beneath the trees. The distant ruins disappear behind a veil of mist, and running water grows louder.</p><p>Your companion pauses. Somewhere in the dark, a bell begins to toll.</p></>}
            </div>
            <section className="i65-choice-section" aria-label="Choose your path">
              <RuleTitle>What do you do?</RuleTitle>
              <div className="i65-choice-row" data-layout="manuscript">
                {choices.map((c, index) => <button key={c.numeral} type="button" disabled={committed} className={`i65-choice ${chosen === index ? "is-selected" : ""}`} aria-pressed={chosen === index} onClick={() => setChosen(index)}>
                  <span className="i65-choice-number">{c.numeral}.</span><img src={c.image} alt="" /><span className="i65-choice-copy"><strong>{c.title}</strong><small>{c.detail}</small></span><span className="i65-choice-pointer" aria-hidden="true">↗</span>
                </button>)}
              </div>
              <div className="i65-choice-response" aria-live="polite">
                {committed ? <><em>Your choice is written in the margin.</em><button type="button" onClick={() => changePage("dice")}>See the roll →</button></> : chosen !== null ? <><em>{choices[chosen].title}</em><button type="button" onClick={() => { setCommitted(true); changePage("dice"); }}>Confirm this path →</button></> : <em>Three paths. None without consequence.</em>}
              </div>
            </section>
          </article>
          <aside className="i65-marginalia" aria-label="Adventure utilities"><div className="i654-margin-sketch" aria-hidden="true"><svg viewBox="0 0 150 43"><path d="M4 33 Q25 14 50 29 T103 21 Q119 15 140 5 M132 6 l8 -1 -2 10" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/></svg></div>
            <section className="i65-margin-section i65-margin-location">
              <Caption>From the cartographer</Caption><h2>The Ashen Vale</h2>
              <p>The mist holds its secrets. The northern road holds its promises.</p>
              <span className="i65-hand-note">Somewhere, a lantern burns. ↙</span>
            </section>
            <section className="i65-margin-section">
              <div className="i65-margin-heading"><Caption>Your hero</Caption><button type="button" onClick={() => openPanel("hero")}>Open ↗</button></div>
              <h2>The Wanderer <span className="i65-level">Lv. 1</span></h2>
              <div className="i65-resource"><span>Health</span><strong aria-label="20 of 30 health points">♥ ♥ <span className="i65-empty-heart">♡</span></strong><small>20 / 30</small></div>
              <div className="i65-resource"><span>XP</span><div className="i65-xp-track"><i /></div><small>40 / 100</small></div>
              <p className="i65-margin-micro">Effects: none · Condition: weary</p>
            </section>
            <section className="i65-margin-section">
              <div className="i65-margin-heading"><Caption>Fellow travelers</Caption><button type="button" onClick={() => openPanel("party")}>Party ↗</button></div>
              <p className="i65-companion"><span className="i65-symbol">✦</span> Athena <small>· Online</small></p>
              <p className="i65-companion"><span className="i65-symbol">✧</span> The Wanderer <small>· Host</small></p>
            </section>
            <section className="i65-margin-section">
              <div className="i65-margin-heading"><Caption>Field notes</Caption><button type="button" onClick={() => openPanel("journal")}>Journal ↗</button></div>
              <button type="button" className="i65-margin-note" onClick={() => openPanel("journal")}>“The lantern could be a warning…” <span>✎</span></button>
              <button type="button" className="i65-mini-link" onClick={() => openPanel("chronicle")}>View the chronicle →</button>
            </section>
            <section className="i65-margin-section i65-whispers">
              <div className="i65-margin-heading"><Caption>Whispers</Caption><button type="button" onClick={() => openPanel("chat")}>Chat ↗</button></div>
              <p><i>Athena:</i> {chatMessages[chatMessages.length - 2]?.text ?? "Ready?"}</p>
              <button type="button" className="i65-mini-link" onClick={() => openPanel("chat")}>Write to the party →</button>
            </section>
          </aside>
        </div>
        <footer className="i65-instruments" aria-label="Gameplay instruments">
          <button type="button" onClick={() => openPanel("hero")}><span>♙</span> Hero</button>
          <button type="button" onClick={() => openPanel("inventory")}><span>⚔</span> Inventory</button>
          <button type="button" onClick={() => openPanel("journal")}><span>☷</span> Journal</button>
          <button type="button" onClick={() => openPanel("party")}><span>♧</span> Party</button>
          <button type="button" onClick={() => openPanel("dice")}><span>⚄</span> Dice</button>
          <button type="button" onClick={() => openPanel("chat")}><span>✉</span> Chat</button>
        </footer>
      </>}
    </main>
    <footer className="i65-page-footer"><span>✧ &nbsp; Some stories are better shared.</span><span>Inkbound · Design workshop · Real account data only in Hall and Heroes; other scenes illustrative</span></footer>
    {panel && <div className="i65-folio-veil" onMouseDown={e => { if (e.target === e.currentTarget) dismiss(); }}>
      <section className="i65-folio" role="dialog" aria-modal="true" aria-label={`${panel} preview`}>
        <header className="i65-folio-head"><Caption>Quillairo · A page from the folio</Caption><button type="button" ref={closePanelButton} onClick={dismiss} aria-label="Close folio">×</button></header>
        <h2>{({hero:"The Wanderer",party:"Fellow Travelers",journal:"The Journal",chronicle:"Chronicle",chat:"Whispers",inventory:"The Satchel",dice:"The Fates",settings:"Paper & Ink"} as Record<Panel,string>)[panel]}</h2>
        <div className="i65-folio-ornament" aria-hidden="true">— ✧ —</div>
        {panel === "hero" && <div className="i65-folio-content"><Caption>Character sheet · Level One</Caption><p className="i65-folio-lede">A traveler of uncertain fate, drawn north by a rumor of forgotten crowns.</p><div className="i65-detail-list"><div>Health <b>20 / 30</b></div><div>Experience <b>40 / 100</b></div><div>Active effects <b>None</b></div><div>Disposition <b>Curious</b></div></div><p className="i65-annotation">“We become what our choices make of us.”</p></div>}
        {panel === "party" && <div className="i65-folio-content"><Caption>Travelers in this chapter</Caption><div className="i65-party-entry"><span>✦</span><div><b>The Wanderer</b><small>Level 1 · Host · Online</small></div></div><div className="i65-party-entry"><span>✧</span><div><b>Athena</b><small>Level 1 · Companion · Online</small></div></div><p className="i65-annotation">Two perspectives. A single journey.</p></div>}
        {panel === "journal" && <div className="i65-folio-content"><Caption>Collected observations</Caption>{notes.map((n,i) => <article className="i65-journal-entry" key={`${n.title}-${i}`}><h3>{n.title}</h3><p>{n.text}</p></article>)}<label htmlFor="i65-scratch">Write in the margin</label><textarea id="i65-scratch" rows={4} value={scratch} onChange={e => setScratch(e.target.value)} /><button className="i65-ink-button" type="button" disabled={!scratch.trim()} onClick={() => {setNotes(items => [...items, {title:`Field note ${items.length+1}`,text:scratch.trim()}]);setScratch("");}}>Add a field note ↗</button><p className="i65-honest-label">Preview-only notes; not saved to the real adventure.</p></div>}
        {panel === "chronicle" && <div className="i65-folio-content"><Caption>The record of what has passed</Caption><div className="i65-chronicle-entry"><span>01</span><div><h3>The Road North</h3><p>The travelers reached the Ashen Vale, where a distant lantern lights the darkening woods.</p></div></div>{chapter > 1 && <div className="i65-chronicle-entry"><span>02</span><div><h3>The Lantern Beyond</h3><p>A road chosen. Another left behind.</p></div></div>}</div>}
        {panel === "inventory" && <div className="i65-folio-content"><Caption>What the road has left you</Caption><div className="i65-detail-list"><div>Worn traveling cloak <b>Equipped</b></div><div>Old iron key <b>Quest item</b></div><div>Traveler's bread <b>× 2</b></div></div><p className="i65-annotation">A satchel tells the story of its owner.</p></div>}
        {panel === "dice" && <div className="i65-folio-content i65-dice-demo"><Caption>A visual state for dice, not a game roll</Caption><div className="i65-die" aria-hidden="true">⚄</div><p className="i65-folio-lede">The fates have not yet spoken.</p><p>In the real adventure, the server alone determines dice results and their consequences.</p><button type="button" className="i65-ink-button" onClick={dismiss}>Return to the page →</button></div>}
        {panel === "chat" && <div className="i65-folio-content"><Caption>The party's correspondence</Caption><div className="i65-chat-transcript" role="log" aria-label="Preview party messages">{chatMessages.map((m,i) => <p key={`${m.from}-${i}`}><b>{m.from}</b><span>{m.text}</span></p>)}</div><form className="i65-chat-send" onSubmit={submitChat}><label htmlFor="i65-chat-text">Your message</label><input id="i65-chat-text" value={chatText} onChange={e => setChatText(e.target.value)} maxLength={500} placeholder="A word to your companion…" /><button type="submit" disabled={!chatText.trim()}>Send ↗</button></form><p className="i65-honest-label">Preview correspondence; no message leaves this page.</p></div>}
        {panel === "settings" && <div className="i65-folio-content"><Caption>Reader preferences</Caption><div className="i65-setting"><span>Paper tone</span><div className="i65-setting-options"><button type="button" aria-pressed={paper === "ivory"} onClick={() => setPaper("ivory")}>Fresh ivory</button><button type="button" aria-pressed={paper === "parchment"} onClick={() => setPaper("parchment")}>Warm parchment</button><button type="button" aria-pressed={paper === "slate"} onClick={() => setPaper("slate")}>Slate · mid-ink</button><button type="button" aria-pressed={paper === "midnight"} onClick={() => setPaper("midnight")}>Midnight · dark e-ink</button></div></div><div className="i65-setting"><span>Narration preference</span><button type="button" onClick={() => setNarration(s=>!s)} aria-pressed={narration}>{narration ? "Enabled" : "Disabled"}</button></div><p className="i65-honest-label">Preview settings only; no audio will play from this design workshop.</p></div>}
      </section>
    </div>}
  </div>;
}
