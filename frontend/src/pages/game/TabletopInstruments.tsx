import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import "./tabletopInstruments.css";

type Instrument = "character" | "chat" | "notes";
const TOOLS = [
  { id: "character", name: "Character", icon: "♙", hint: "Open the traveler's dossier" },
  { id: "chat", name: "Chat", icon: "✉", hint: "Open the correspondence desk" },
  { id: "notes", name: "Journal", icon: "✎", hint: "Open your field journal" },
] as const;

/**
 * PASS 64.4L: Intentional floating tabletop controls, not imitation physical book tabs.
 * Isolated demo: no authoritative Hero, socket chat, server writes, or persistent notes.
 * Keeps local drafts across panel switches. The manuscript/page transitions are unchanged.
 */
export function TabletopInstruments() {
  const [active, setActive] = useState<Instrument | null>(null);
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<string[]>(["The lantern is lit. Meet me at the crossroads."]);
  const [inspected, setInspected] = useState(false);
  const buttons = useRef<Partial<Record<Instrument, HTMLButtonElement | null>>>({});
  const heading = useRef<HTMLHeadingElement | null>(null);

  const close = () => {
    const id = active;
    setActive(null);
    if (id) requestAnimationFrame(() => buttons.current[id]?.focus());
  };
  const toggle = (id: Instrument) => {
    if (active === id) { close(); return; }
    setActive(id);
  };
  useEffect(() => {
    if (!active) return;
    heading.current?.focus();
  }, [active]);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
  const addMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setMessages((prev) => [...prev, message]);
    setDraft("");
  };

  return <div className="tti-root" data-tti-mode="floating">
    <nav className="tti-tools" aria-label="Tabletop instruments">
      <span className="tti-tools-caption" aria-hidden="true">YOUR DESK</span>
      {TOOLS.map((tool) => <button
        key={tool.id}
        ref={(element) => { buttons.current[tool.id] = element; }}
        type="button"
        className={`tti-instrument tti-instrument--${tool.id} ${active === tool.id ? "is-active" : ""}`}
        aria-label={tool.hint}
        aria-pressed={active === tool.id}
        aria-controls="tti-instrument-sheet"
        aria-expanded={active === tool.id}
        onClick={() => toggle(tool.id)}
      >
        <span className="tti-medallion" aria-hidden="true"><span>{tool.icon}</span></span>
        <span className="tti-name">{tool.name}</span>
        {tool.id === "chat" && messages.length > 1 ? <span className="tti-message-count" aria-label={`${messages.length - 1} preview messages added`}>{messages.length - 1}</span> : null}
      </button>)}
      <span className="tti-tools-tail" aria-hidden="true">✧</span>
    </nav>

    {active ? <aside className={`tti-sheet tti-sheet--${active}`} id="tti-instrument-sheet" role="dialog" aria-modal="false" aria-labelledby="tti-sheet-title">
      <header className="tti-sheet-head">
        <div><p>THE TRAVELER'S TABLETOP</p><h2 id="tti-sheet-title" ref={heading} tabIndex={-1}>{TOOLS.find((tool) => tool.id === active)?.name}</h2></div>
        <button type="button" className="tti-sheet-close" onClick={close} aria-label={`Close ${active} instrument`}>×</button>
      </header>
      {active === "character" ? <div className="tti-body tti-character">
        <p className="tti-kicker">ILLUSTRATIVE HERO · NOT LIVE DATA</p>
        <div className="tti-avatar" aria-hidden="true">✦</div>
        <h3>Kael of the Green Road</h3><p className="tti-class">Ranger · Level 12</p>
        <div className="tti-stat"><span>Heart</span><strong>18 / 22</strong></div>
        <div className="tti-meter" aria-label="18 of 22 heart points"><span style={{ width: "82%" }} /></div>
        <div className="tti-stat"><span>Resolve</span><strong>7 / 10</strong></div>
        <div className="tti-meter tti-meter--blue" aria-label="7 of 10 resolve points"><span style={{ width: "70%" }} /></div>
        <div className="tti-stat"><span>Experience</span><strong>2,150 XP</strong></div>
        <button type="button" className="tti-text-action" onClick={() => setInspected((old) => !old)} aria-expanded={inspected}>
          {inspected ? "Hide field observations ↑" : "Inspect field observations ↓"}
        </button>
        {inspected ? <p className="tti-observation">A patient ranger. Suspicious of bells, unusually fond of stray dogs. These details are sample UI copy.</p> : null}
        <p className="tti-disclaimer">Preview only. No Hero stats or progression are changed.</p>
      </div> : null}
      {active === "chat" ? <div className="tti-body tti-chat">
        <p className="tti-kicker">LOCAL CORRESPONDENCE PREVIEW</p>
        <div className="tti-messages" aria-live="polite" aria-label="Preview messages">
          {messages.map((message, index) => <p key={index}>
            <strong>{index === 0 ? "Companion" : "You · draft"}</strong>
            <span>{message}</span>
          </p>)}
        </div>
        <form onSubmit={addMessage}>
          <label htmlFor="tti-chat-input">Compose a note</label>
          <input id="tti-chat-input" type="text" maxLength={280} value={draft} placeholder="Write a message…" onChange={(event) => setDraft(event.target.value)} />
          <button type="submit" disabled={!draft.trim()}>Add to preview ↗</button>
        </form>
        <p className="tti-disclaimer">Local demo. Nothing is sent to co-op chat.</p>
      </div> : null}
      {active === "notes" ? <div className="tti-body tti-notes">
        <p className="tti-kicker">PERSONAL FIELD JOURNAL</p>
        <label htmlFor="tti-note-input">What deserves remembering?</label>
        <textarea id="tti-note-input" rows={9} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="The third bell. The missing bridge arch. A bird that spoke in an old friend's voice…" />
        <p className="tti-note-length" aria-live="polite">{notes.length} characters · unsaved</p>
        <p className="tti-disclaimer">Notes survive switching instruments here, but are not saved to your account.</p>
      </div> : null}
      <div className="tti-sheet-foot">✧ A LITTLE MAGIC, NO EXTRA WINDOWS ✧</div>
    </aside> : null}
    <aside className="tti-experiment-note" aria-label="Interaction comparison">
      <span>FLOATING INSTRUMENT STUDY</span>
      <Link to="/game/inkspace-reader">Compare attached tabs ↗</Link>
    </aside>
  </div>;
}
