import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { SCENE_COMPOSITING, sceneRectStyle } from "../../features/cosmetics/environmentCatalog";
import { clearInkMask, preloadInkMasks } from "./inkMaskAssets";
import { paginateReader, READER_DEMO, type ReaderLeaf, type ReaderDimensions } from "./inkspaceReaderPagination";
import "./inkspaceReaderLab.css";

type Side = keyof typeof SCENE_COMPOSITING.contentSafeZones;
type JournalTab = "character" | "chat" | "notes";
const JOURNAL_TABS: ReadonlyArray<Readonly<{ id: JournalTab; label: string; icon: string }>> = [
  { id: "character", label: "Character", icon: "♙" },
  { id: "chat", label: "Chat", icon: "✉" },
  { id: "notes", label: "Notes", icon: "✎" },
];
const maskURL = (index: number) => `url("/art/pass64/ink-masks/ink-${String(index).padStart(2, "0")}.webp")`;
const projected = (side: Side): CSSProperties => {
  const rect = sceneRectStyle(SCENE_COMPOSITING.contentSafeZones[side]);
  return { "--reader-x": rect.left, "--reader-y": rect.top, "--reader-width": rect.width, "--reader-height": rect.height } as CSSProperties;
};
const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function ManuscriptLeaf({ leaf, side, attach }: { leaf: ReaderLeaf; side: Side; attach: (el: HTMLDivElement | null) => void }) {
  return (
    <section className={`reader-leaf reader-leaf--${side}`} style={projected(side)} aria-label={`${side} manuscript page ${leaf.index + 1}`}>
      <div className="reader-ink" ref={attach}>
        {leaf.title ? <header className="reader-opening-head">
          <p className="reader-rubric">{READER_DEMO.eyebrow}</p>
          <h1>{READER_DEMO.title}</h1>
          <p className="reader-subtitle">{READER_DEMO.subtitle}</p>
          <div className="reader-flourish" aria-hidden="true">✧ ─ ❦ ─ ✧</div>
        </header> : null}
        {leaf.art ? <figure className="reader-art">
          <img src={READER_DEMO.art.src} alt={READER_DEMO.art.alt} decoding="async" />
          {READER_DEMO.art.caption ? <figcaption>{READER_DEMO.art.caption}</figcaption> : null}
        </figure> : null}
        <div className="reader-prose">
          {leaf.text.map((p, idx) => <p key={`${leaf.index}-${idx}`} className={leaf.index === 0 && idx === 0 ? "reader-lead" : ""}>{p}</p>)}
        </div>
        {leaf.choices ? <section className="reader-choices" aria-label="Preview choices">
          <p className="reader-rubric">THE CHOICE IS YOURS</p>
          <p>Three roads wait beneath the same restless sky.</p>
          <ReaderChoicePreview />
        </section> : null}
      </div>
      <span className="reader-folio" aria-hidden="true">{leaf.index + 17}</span>
    </section>
  );
}

function ReaderChoicePreview() {
  const [highlight, setHighlight] = useState<string | null>(null);
  return <div className="reader-choice-list">
    {READER_DEMO.choices?.map((choice, idx) => <button type="button" key={choice.id}
      className={highlight === choice.id ? "is-chosen" : ""} aria-pressed={highlight === choice.id}
      onClick={() => setHighlight(choice.id)}>
      <span aria-hidden="true">{["Ⅰ", "Ⅱ", "Ⅲ"][idx]}</span> {choice.label}
    </button>)}
    <p className="reader-demo-disclaimer">Choice highlighting is a visual preview. No roll or gameplay action is sent.</p>
  </div>;
}

function JournalSheet({ tab, close }: { tab: JournalTab; close: () => void }) {
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [chat, setChat] = useState<string[]>(["The road is quiet. Too quiet, perhaps."]);
  const sheetTitle = JOURNAL_TABS.find((x) => x.id === tab)?.label ?? "Journal";
  const header = useRef<HTMLHeadingElement>(null);
  useEffect(() => { header.current?.focus(); }, [tab]);
  const send = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setChat((items) => [...items, draft.trim()]);
    setDraft("");
  };
  return <aside className={`reader-journal reader-journal--${tab}`} role="dialog" aria-modal="false" aria-label={`${sheetTitle} journal preview`}>
    <header><div><small>THE TRAVELER'S JOURNAL</small><h2 tabIndex={-1} ref={header}>{sheetTitle}</h2></div>
      <button type="button" className="reader-close" onClick={close} aria-label="Close journal sheet">×</button>
    </header>
    {tab === "character" ? <div className="reader-journal-body">
      <p className="reader-preview-label">SAMPLE HERO · DEMONSTRATION</p>
      <div className="reader-character-seal" aria-hidden="true">✦</div>
      <h3>Kael of the Green Road</h3><p className="reader-hero-subtitle">Ranger · Level 12</p>
      <dl><div><dt>Heart</dt><dd>18 / 22</dd></div><div><dt>Resolve</dt><dd>7 / 10</dd></div><div><dt>Experience</dt><dd>2,150 XP</dd></div></dl>
      <p className="reader-journal-note">Live Hero stats will come from the game server; these values are sample presentation data.</p>
    </div> : null}
    {tab === "chat" ? <div className="reader-journal-body reader-chat-sheet">
      <p className="reader-preview-label">LOCAL CHAT COMPOSER PREVIEW</p>
      <div className="reader-chat-messages" aria-live="polite">{chat.map((line, i) => <p key={i}><strong>{i === 0 ? "Companion" : "You (preview)"}</strong>{line}</p>)}</div>
      <form onSubmit={send}><label htmlFor="reader-chat-draft">Draft a message</label><input id="reader-chat-draft" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={280} placeholder="The ink awaits…" />
        <button type="submit" disabled={!draft.trim()}>Add to preview</button></form>
      <p className="reader-journal-note">Not connected to co-op chat. Messages are visible only here until you leave this page.</p>
    </div> : null}
    {tab === "notes" ? <div className="reader-journal-body reader-notes-sheet">
      <label htmlFor="reader-field-notes">Field notes (unsaved preview)</label>
      <textarea id="reader-field-notes" rows={8} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="The northward bell. The seventh arch. The bird who knew my name…" />
      <p className="reader-journal-note">Notes are temporary in this laboratory; nothing is saved or sent to an adventure.</p>
    </div> : null}
  </aside>;
}

/** Isolated 64.4J reader proof. Not connected to Director/gameplay APIs. */
export function InkspaceReaderLab() {
  const [size, setSize] = useState<ReaderDimensions>({ width: 405, height: 500, fontSize: 15 });
  const measureRef = useRef<HTMLDivElement | null>(null);
  const inkRefs = useRef<[HTMLDivElement | null, HTMLDivElement | null]>([null, null]);
  const animationRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);
  const [displayed, setDisplayed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [journal, setJournal] = useState<JournalTab | null>(null);
  const pendingReveal = useRef(false);
  const mounted = useRef(true);
  const spreads = useMemo(() => paginateReader(READER_DEMO, size), [size]);
  const last = Math.max(0, spreads.length - 1);
  const visible = spreads[Math.min(displayed, last)];

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const resize = () => {
      const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight);
      const fontSize = parseFloat(getComputedStyle(el).fontSize) || 15;
      if (w > 0 && h > 0) setSize((prev) => prev.width === w && prev.height === h && prev.fontSize === fontSize ? prev : { width: w, height: h, fontSize });
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    mounted.current = true;
    void preloadInkMasks().then((ok) => { if (mounted.current) setReady(ok); });
    return () => { mounted.current = false; if (animationRef.current !== null) cancelAnimationFrame(animationRef.current); };
  }, []);
  const mask = useCallback((progress: number) => {
    const i = Math.max(0, Math.min(32, Math.round(progress * 32)));
    const value = maskURL(i);
    for (const el of inkRefs.current) if (el) {
      if (el.style.maskImage !== value) el.style.maskImage = value;
      if (el.style.webkitMaskImage !== value) el.style.webkitMaskImage = value;
    }
  }, []);
  const animate = useCallback((from: number, to: number, duration: number, end: () => void) => {
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    const begun = performance.now();
    const tick = (time: number) => {
      if (!mounted.current) return;
      const p = Math.max(0, Math.min(1, (time - begun) / duration));
      const eased = p * p * (3 - 2 * p);
      mask(from + (to - from) * eased);
      if (p < 1) animationRef.current = requestAnimationFrame(tick);
      else { animationRef.current = null; end(); }
    };
    animationRef.current = requestAnimationFrame(tick);
  }, [mask]);
  const goTo = (target: number) => {
    if (busy || target < 0 || target > last || target === index) return;
    setIndex(target);
    if (!ready || prefersReducedMotion()) { setDisplayed(target); return; }
    setBusy(true);
    animate(1, 0, 340, () => { pendingReveal.current = true; setDisplayed(target); });
  };
  useLayoutEffect(() => {
    if (!pendingReveal.current) return;
    pendingReveal.current = false;
    mask(0);
    // This layout effect runs after React has committed the new pages.
    animate(0, 1, 600, () => { if (mounted.current) setBusy(false); });
  }, [displayed, animate, mask]);
  const replay = () => {
    if (busy || !ready || prefersReducedMotion()) return;
    setBusy(true); mask(0);
    animate(0, 1, 750, () => { if (mounted.current) setBusy(false); });
  };
  useEffect(() => { if (!ready) for (const el of inkRefs.current) clearInkMask(el); }, [ready]);
  return <div className="reader-stage" aria-label="Paginated manuscript reader demonstration">
    <div className="reader-leaves">
      <div className="reader-measure" ref={measureRef} aria-hidden="true" />
      <ManuscriptLeaf side="left" leaf={visible.left} attach={(el) => { inkRefs.current[0] = el; }} />
      <ManuscriptLeaf side="right" leaf={visible.right} attach={(el) => { inkRefs.current[1] = el; }} />
    </div>
    <nav className="reader-journal-tabs" aria-label="Extra journal pages">
      {JOURNAL_TABS.map((tab) => <button type="button" key={tab.id} className={`reader-tab reader-tab--${tab.id} ${journal === tab.id ? "is-open" : ""}`}
        aria-label={`Open ${tab.label} journal`} aria-pressed={journal === tab.id} onClick={() => setJournal((was) => was === tab.id ? null : tab.id)}>
        <span className="reader-tab-icon" aria-hidden="true">{tab.icon}</span><span>{tab.label}</span>
      </button>)}
    </nav>
    {journal ? <JournalSheet tab={journal} close={() => setJournal(null)} /> : null}
    <nav className="reader-pager" aria-label="Turn manuscript pages">
      <button type="button" onClick={() => goTo(index - 1)} disabled={busy || index <= 0}>← Previous</button>
      <span aria-live="polite" aria-atomic="true">Leaves {index * 2 + 17}–{index * 2 + 18} · {index + 1} / {spreads.length}</span>
      <button type="button" onClick={() => goTo(index + 1)} disabled={busy || index >= last}>Next →</button>
      <button type="button" className="reader-replay" onClick={replay} disabled={busy || !ready} aria-label="Replay ink appearing">↺</button>
    </nav>
    <span className="sr-only" role="status" aria-live="polite">{busy ? "Ink is changing pages" : "Reader ready"}</span>
  </div>;
}
