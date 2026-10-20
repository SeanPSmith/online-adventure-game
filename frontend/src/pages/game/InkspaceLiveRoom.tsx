/** Pass 64.4K — opt-in view of the EXISTING, server-owned live adventure.
 * Receives state and callbacks from AdventurePage; never creates a socket.
 * The photographic environment remains fixed; only manuscript ink animates.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { Link } from "react-router";
import { SCENE_COMPOSITING, sceneRectStyle } from "../../features/cosmetics/environmentCatalog";
import type { SceneChoice, ChatMessage, PartyHeroSnapshot } from "../../services/game";
import type { Character } from "../../services/characters";
import { clearInkMask, preloadInkMasks } from "./inkMaskAssets";
import { LiveTabletopInstruments } from "./LiveTabletopInstruments";
import { paginateReader, type ReaderDocument, type ReaderDimensions, type ReaderLeaf } from "./inkspaceReaderPagination";
import "./visualBookPlayground.css";
import "./inkspaceReaderLab.css";
import "./inkspaceLiveRoom.css";

type PageSide = keyof typeof SCENE_COMPOSITING.contentSafeZones;
type JournalTab = "character" | "chat" | "notes";
export type LiveInkspaceProps = Readonly<{
  roomCode: string;
  turnNumber: number;
  adventureTitle: string;
  scene: Readonly<{ id: string; title: string; body: string; choices: readonly SceneChoice[] }>;
  hero: Character | PartyHeroSnapshot | null;
  playerName: string;
  messages: readonly ChatMessage[];
  selectedChoiceId: string;
  choiceLocked: boolean;
  lockPending: boolean;
  choicesBlocked: boolean;
  connected: boolean;
  onSelectChoice: (choice: SceneChoice) => void;
  onLockChoice: () => void;
  onSendChat: (message: string) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  onClose: () => void;
}>;

const zone = (side: PageSide): CSSProperties => {
  const r = sceneRectStyle(SCENE_COMPOSITING.contentSafeZones[side]);
  return { "--reader-x": r.left, "--reader-y": r.top, "--reader-width": r.width, "--reader-height": r.height } as CSSProperties;
};
const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const inkURL = (n: number) => `url("/art/pass64/ink-masks/ink-${String(n).padStart(2, "0")}.webp")`;

/** Retain the Director's prose exactly, only separating actual paragraph breaks. */
export function storyParagraphs(body: string): string[] {
  return body.replace(/\r\n?/g, "\n").split(/\n\s*\n/).map((p) => p.replace(/\n/g, " ").trim()).filter(Boolean);
}

export function liveReaderDocument(scene: LiveInkspaceProps["scene"], adventureTitle: string, turn: number): ReaderDocument {
  return {
    id: scene.id,
    eyebrow: `THE LIVING CHRONICLE · TURN ${turn}`,
    title: scene.title || adventureTitle,
    subtitle: adventureTitle,
    paragraphs: storyParagraphs(scene.body),
    // No invented scene illustrations: art appears only after a genuine, trusted
    // story-art attachment pipeline has been introduced.
    choices: scene.choices.map((choice) => ({ id: choice.id, label: choice.label })),
  };
}

function LiveLeaf({ leaf, doc, side, choices, selectedId, locked, pending, blocked, onSelect, onLock, attach }: {
  leaf: ReaderLeaf;
  doc: ReaderDocument;
  side: PageSide;
  choices: readonly SceneChoice[];
  selectedId: string;
  locked: boolean;
  pending: boolean;
  blocked: boolean;
  onSelect: (choice: SceneChoice) => void;
  onLock: () => void;
  attach: (element: HTMLDivElement | null) => void;
}) {
  return <section className={`reader-leaf reader-leaf--${side}`} style={zone(side)} aria-label={`${side} manuscript page ${leaf.index + 1}`}>
    <div className="reader-ink" ref={attach}>
      {leaf.title && <header className="reader-opening-head">
        <p className="reader-rubric">{doc.eyebrow}</p>
        <h1>{doc.title}</h1>
        {doc.subtitle && <p className="reader-subtitle">{doc.subtitle}</p>}
        <div className="reader-flourish" aria-hidden="true">✧ ─ ❦ ─ ✧</div>
      </header>}
      {leaf.art && doc.art && <figure className="reader-art"><img src={doc.art.src} alt={doc.art.alt} decoding="async" />{doc.art.caption && <figcaption>{doc.art.caption}</figcaption>}</figure>}
      <div className="reader-prose">{leaf.text.map((p, i) => <p key={`${leaf.index}-${i}`} className={leaf.index === 0 && i === 0 ? "reader-lead" : ""}>{p}</p>)}</div>
      {leaf.choices && <section className="reader-choices" aria-label="Current turn choices">
        <p className="reader-rubric">YOUR NEXT MOVE</p>
        {choices.length === 0 ? <p>The Director has not offered a choice yet.</p> : <div className="reader-choice-list">
          {choices.map((choice, idx) => <button type="button" key={choice.id} disabled={blocked && selectedId !== choice.id}
            className={selectedId === choice.id ? "is-chosen" : ""}
            aria-pressed={selectedId === choice.id}
            onClick={() => onSelect(choice)}>
            <span aria-hidden="true">{["Ⅰ", "Ⅱ", "Ⅲ", "Ⅳ", "Ⅴ"][idx] ?? `${idx + 1}.`}</span>
            {choice.label}
          </button>)}
        </div>}
        {selectedId && <p className="reader-selected-caption">{choices.find((c) => c.id === selectedId)?.description ?? ""}</p>}
        <button type="button" className="reader-lock-intent" disabled={blocked || !selectedId} onClick={onLock}>
          {locked ? "CHOICE LOCKED" : pending ? "RECORDING INTENT…" : "LOCK IN CHOICE"}
        </button>
        <p className="reader-choices-explainer">The game server determines the roll, outcome, and XP. Selecting a choice alone does not commit it.</p>
      </section>}
    </div>
    <span className="reader-folio" aria-hidden="true">{leaf.index + 1}</span>
  </section>;
}

function LiveJournal({ tab, hero, playerName, messages, connected, notes, onNotesChange, onSend, onClose }: {
  tab: JournalTab; hero: LiveInkspaceProps["hero"]; playerName: string; messages: readonly ChatMessage[];
  connected: boolean; notes: string; onNotesChange: (value: string) => void; onSend: (text: string) => void; onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), [tab]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    onSend(text); setDraft("");
  };
  return <aside className={`reader-journal reader-journal--${tab}`} role="region" aria-label={`${tab} journal`}>
    <header><div><small>THE TRAVELER'S JOURNAL</small><h2 ref={heading} tabIndex={-1}>{tab[0].toUpperCase() + tab.slice(1)}</h2></div>
      <button className="reader-close" onClick={onClose} aria-label="Close journal sheet" type="button">×</button></header>
    {tab === "character" && <div className="reader-journal-body">
      <p className="reader-preview-label">LIVE HERO · SERVER DATA</p>
      <div className="reader-character-seal" aria-hidden="true">✦</div>
      <h3>{hero?.name ?? playerName}</h3>
      {hero ? <><p className="reader-hero-subtitle">Level {hero.level}</p>
        <dl><div><dt>Health</dt><dd>{hero.health} / {hero.max_health}</dd></div>
          <div><dt>Experience</dt><dd>{hero.experience} XP</dd></div>
          <div><dt>Status</dt><dd>{hero.is_alive ? "Living" : "Fallen"}</dd></div></dl></>
        : <p className="reader-journal-note">Hero details are loading from the active room.</p>}
    </div>}
    {tab === "chat" && <div className="reader-journal-body reader-chat-sheet">
      <p className="reader-preview-label">LIVE ROOM CHAT</p>
      <div className="reader-chat-messages" role="log" aria-label="Room conversation">
        {messages.length ? messages.map((msg) => <p key={msg.id}><strong>{msg.player_name}</strong>{msg.text}</p>) : <p>No messages yet.</p>}
      </div>
      <form onSubmit={submit}><label htmlFor="inkspace-live-chat">Message your party</label>
        <input id="inkspace-live-chat" maxLength={500} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!connected} placeholder="Write to the party…" />
        <button type="submit" disabled={!connected || !draft.trim()}>Send to room</button></form>
    </div>}
    {tab === "notes" && <div className="reader-journal-body reader-notes-sheet">
      <label htmlFor="inkspace-live-notes">Field notes · temporary</label>
      <textarea id="inkspace-live-notes" rows={8} value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="A name, a clue, a promise…" />
      <p className="reader-journal-note">Unsaved scratch notes: closing this journal or leaving the adventure may discard them.</p>
    </div>}
  </aside>;
}

/** This visual shell does not join another room and does not own gameplay effects. */
export function InkspaceLiveRoom(props: LiveInkspaceProps) {
  const doc = useMemo(() => liveReaderDocument(props.scene, props.adventureTitle, props.turnNumber), [props.scene, props.adventureTitle, props.turnNumber]);
  const [dims, setDims] = useState<ReaderDimensions>({ width: 395, height: 495, fontSize: 15 });
  const measure = useRef<HTMLDivElement | null>(null);
  const refs = useRef<[HTMLDivElement | null, HTMLDivElement | null]>([null, null]);
  const animation = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [page, setPage] = useState(0);
  const [shown, setShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [journal, setJournal] = useState<JournalTab | null>(null);
  const [journalStyle, setJournalStyle] = useState<"floating" | "attached">("floating");
  const needReveal = useRef(false);
  const mounted = useRef(false);
  const spreads = useMemo(() => paginateReader(doc, dims), [doc, dims]);
  const last = Math.max(0, spreads.length - 1);
  const visible = spreads[Math.min(shown, last)];
  useEffect(() => {
    const node = measure.current;
    if (!node) return;
    const update = () => {
      const next = { width: Math.round(node.clientWidth), height: Math.round(node.clientHeight), fontSize: parseFloat(getComputedStyle(node).fontSize) || 15 };
      if (next.width > 0 && next.height > 0) setDims((prev) => prev.width === next.width && prev.height === next.height && prev.fontSize === next.fontSize ? prev : next);
    };
    update(); const ro = new ResizeObserver(update); ro.observe(node);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    mounted.current = true;
    void preloadInkMasks().then((ok) => { if (mounted.current) setReady(ok); });
    return () => { mounted.current = false; if (animation.current !== null) cancelAnimationFrame(animation.current); };
  }, []);
  const setInk = useCallback((value: number) => {
    const image = inkURL(Math.round(Math.max(0, Math.min(1, value)) * 32));
    for (const node of refs.current) if (node) {
      if (node.style.maskImage !== image) node.style.maskImage = image;
      if (node.style.webkitMaskImage !== image) node.style.webkitMaskImage = image;
    }
  }, []);
  const tween = useCallback((from: number, to: number, duration: number, done: () => void) => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    const start = performance.now();
    const frame = (time: number) => {
      if (!mounted.current) return;
      const t = Math.max(0, Math.min(1, (time - start) / duration));
      const smooth = t * t * (3 - 2 * t);
      setInk(from + (to - from) * smooth);
      if (t < 1) animation.current = requestAnimationFrame(frame);
      else { animation.current = null; done(); }
    };
    animation.current = requestAnimationFrame(frame);
  }, [setInk]);
  // Authoritative turn changed: never leave a reader on pages from a prior turn.
  useLayoutEffect(() => {
    if (animation.current !== null) cancelAnimationFrame(animation.current);
    needReveal.current = false;
    setPage(0); setShown(0); setBusy(false);
    for (const node of refs.current) clearInkMask(node);
  }, [doc.id, props.turnNumber]);
  const move = (next: number) => {
    if (busy || next < 0 || next > last || next === page) return;
    setPage(next);
    if (!ready || reduced()) { setShown(next); return; }
    setBusy(true);
    tween(1, 0, 270, () => { needReveal.current = true; setShown(next); });
  };
  useLayoutEffect(() => {
    if (!needReveal.current) return;
    needReveal.current = false;
    setInk(0);
    tween(0, 1, 510, () => { if (mounted.current) setBusy(false); });
  }, [shown, setInk, tween]);
  useEffect(() => { if (!ready) for (const node of refs.current) clearInkMask(node); }, [ready]);
  return <div className="vb-lab has-reader has-instruments inkspace-live" aria-label="Live illuminated manuscript reader">
    <img className="vb-scene" src="/art/pass64/pass64-4d-tabletop-book.webp" alt="Open ivory book on a wooden tabletop surrounded by stationery and botanical decorations" draggable={false} />
    <header className="vb-header inkspace-live-header">
      <Link className="vb-identity" to="/game" aria-label="Tales of Two · Adventure Hall">
        <span className="inkspace-live-compass" aria-hidden="true">✧</span><span className="vb-wordmark"><strong>TALES OF TWO</strong><span>A LIBRARY OF POSSIBILITIES</span></span>
      </Link>
      <nav className="vb-parchment inkspace-live-menu" aria-label="Live book navigation">
        <button type="button" className="vb-nav-item is-active" onClick={props.onClose}>STANDARD READER</button>
        <Link className="vb-nav-item" to="/game/heroes">HEROES</Link>
        <Link className="vb-nav-item" to="/game/adventures">MY ADVENTURES</Link>
        <Link className="vb-nav-item" to="/game">HALL</Link>
      </nav>
      <button type="button" className="inkspace-live-exit" onClick={props.onClose}>EXIT BOOK VIEW ×</button>
    </header>
    <main className="vb-book-space" aria-label="Current adventure manuscript">
      <div className="reader-stage">
        <div className="reader-leaves">
          <div className="reader-measure" ref={measure} aria-hidden="true" />
          <LiveLeaf side="left" leaf={visible.left} doc={doc} choices={props.scene.choices} selectedId={props.selectedChoiceId} locked={props.choiceLocked} pending={props.lockPending} blocked={props.choicesBlocked} onSelect={props.onSelectChoice} onLock={props.onLockChoice} attach={(node) => { refs.current[0] = node; }} />
          <LiveLeaf side="right" leaf={visible.right} doc={doc} choices={props.scene.choices} selectedId={props.selectedChoiceId} locked={props.choiceLocked} pending={props.lockPending} blocked={props.choicesBlocked} onSelect={props.onSelectChoice} onLock={props.onLockChoice} attach={(node) => { refs.current[1] = node; }} />
        </div>
        <button type="button" className="reader-journal-style" aria-pressed={journalStyle === "attached"}
          onClick={() => { setJournalStyle((value) => value === "floating" ? "attached" : "floating"); setJournal(null); }}>
          {journalStyle === "floating" ? "Use attached journal tabs" : "Use floating instruments"}
        </button>
        {journalStyle === "attached" && <nav className="reader-journal-tabs" aria-label="Other journal sections">
          {(["character", "chat", "notes"] as const).map((tab) => <button type="button" key={tab} aria-label={`Open ${tab} journal`} aria-pressed={journal === tab}
            className={`reader-tab reader-tab--${tab} ${journal === tab ? "is-open" : ""}`} onClick={() => setJournal((v) => v === tab ? null : tab)}>
            <span className="reader-tab-icon" aria-hidden="true">{tab === "character" ? "♙" : tab === "chat" ? "✉" : "✎"}</span><span>{tab[0].toUpperCase() + tab.slice(1)}</span>
          </button>)}
        </nav>}
        {journalStyle === "attached" && journal && <LiveJournal key={journal} tab={journal} hero={props.hero} playerName={props.playerName} messages={props.messages} connected={props.connected} notes={props.notes} onNotesChange={props.onNotesChange} onSend={props.onSendChat} onClose={() => setJournal(null)} />}
        <nav className="reader-pager" aria-label="Turn manuscript pages">
          <button type="button" disabled={busy || page <= 0} onClick={() => move(page - 1)}>← Previous</button>
          <span aria-live="polite">TURN {props.turnNumber} · SPREAD {page + 1} / {spreads.length}</span>
          <button type="button" disabled={busy || page >= last} onClick={() => move(page + 1)}>Next →</button>
        </nav>
      </div>
    </main>
    {journalStyle === "floating" && <LiveTabletopInstruments
      hero={props.hero} playerName={props.playerName} messages={props.messages}
      connected={props.connected} onSendChat={props.onSendChat}
      notes={props.notes} onNotesChange={props.onNotesChange}
    />}
    <span className="sr-only" role="status" aria-live="polite">{busy ? "Manuscript ink transitioning" : props.choiceLocked ? "Choice locked" : "Book ready"}</span>
  </div>;
}
