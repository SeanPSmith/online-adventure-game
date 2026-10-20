/** Pass 64.4M: a floating presentation of EXISTING authorized room data.
 * No sockets, REST calls, purchases, gameplay state, or demo Hero facts.
 * The AdventurePage continues to own room connection and chat submission.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { LiveInkspaceProps } from "./InkspaceLiveRoom";
import "./tabletopInstruments.css";
import "./liveTabletopInstruments.css";

type Instrument = "character" | "chat" | "notes";
type LiveToolsProps = Pick<LiveInkspaceProps,
  "hero" | "playerName" | "messages" | "connected" | "onSendChat" | "notes" | "onNotesChange"
>;
const TOOLS = [
  { id: "character", name: "Character", icon: "♙", hint: "Open your live Hero dossier" },
  { id: "chat", name: "Chat", icon: "✉", hint: "Read and send live party messages" },
  { id: "notes", name: "Journal", icon: "✎", hint: "Open unsaved field notes" },
] as const;

export function LiveTabletopInstruments({ hero, playerName, messages, connected, onSendChat, notes, onNotesChange }: LiveToolsProps) {
  const [active, setActive] = useState<Instrument | null>(null);
  const [draft, setDraft] = useState("");
  const [unread, setUnread] = useState(0);
  const [inspected, setInspected] = useState(false);
  const buttons = useRef<Partial<Record<Instrument, HTMLButtonElement | null>>>({});
  const heading = useRef<HTMLHeadingElement | null>(null);
  const activeRef = useRef<Instrument | null>(active);
  const lastMessageIds = useRef<Set<string> | null>(null);

  activeRef.current = active;
  useEffect(() => {
    // Initialise from existing history; reconnect/rehydrate isn't a new notification.
    const ids = new Set(messages.map((message) => message.id));
    if (lastMessageIds.current !== null && activeRef.current !== "chat") {
      const newcomers = messages.filter((message) => !lastMessageIds.current?.has(message.id)).length;
      if (newcomers) setUnread((count) => Math.min(99, count + newcomers));
    }
    lastMessageIds.current = ids;
  }, [messages]);

  const close = () => {
    const previous = activeRef.current;
    setActive(null);
    if (previous) requestAnimationFrame(() => buttons.current[previous]?.focus());
  };
  const toggle = (id: Instrument) => {
    if (activeRef.current === id) { close(); return; }
    if (id === "chat") setUnread(0);
    setActive(id);
  };
  useEffect(() => { if (active) heading.current?.focus(); }, [active]);
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active]);
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text || !connected) return;
    // Exactly one call into the EXISTING AdventurePage handler.
    onSendChat(text);
    setDraft("");
  };
  const healthRatio = hero && hero.max_health > 0
    ? Math.max(0, Math.min(100, (hero.health / hero.max_health) * 100))
    : 0;

  return <div className="tti-root tti-root--live" data-tti-mode="floating-live">
    <nav className="tti-tools" aria-label="Living Book floating instruments">
      <span className="tti-tools-caption" aria-hidden="true">YOUR TABLETOP</span>
      {TOOLS.map((tool) => <button
        type="button" key={tool.id}
        ref={(element) => { buttons.current[tool.id] = element; }}
        className={`tti-instrument tti-instrument--${tool.id} ${active === tool.id ? "is-active" : ""}`}
        aria-label={tool.hint}
        aria-pressed={active === tool.id}
        aria-expanded={active === tool.id}
        aria-controls="tti-live-sheet"
        onClick={() => toggle(tool.id)}
      >
        <span className="tti-medallion" aria-hidden="true"><span>{tool.icon}</span></span>
        <span className="tti-name">{tool.name}</span>
        {tool.id === "chat" && unread > 0 && <span className="tti-message-count" aria-label={`${unread} new messages`}>{unread}</span>}
      </button>)}
      <span className="tti-tools-tail" aria-hidden="true">✧</span>
    </nav>

    {active ? <aside id="tti-live-sheet" className={`tti-sheet tti-sheet--${active}`} role="dialog" aria-modal="false" aria-labelledby="tti-live-title">
      <header className="tti-sheet-head">
        <div><p>THE TRAVELER'S TABLETOP</p><h2 id="tti-live-title" ref={heading} tabIndex={-1}>{TOOLS.find((tool) => tool.id === active)?.name}</h2></div>
        <button type="button" className="tti-sheet-close" onClick={close} aria-label={`Close ${active} instrument`}>×</button>
      </header>
      {active === "character" && <div className="tti-body tti-character">
        <p className="tti-kicker">LIVE HERO · SERVER DATA</p>
        <div className="tti-avatar" aria-hidden="true">✦</div>
        <h3>{hero?.name ?? playerName}</h3>
        {hero ? <>
          <p className="tti-class">Level {hero.level} · {hero.is_alive ? "Living" : "Fallen"}</p>
          <div className="tti-stat"><span>Health</span><strong>{hero.health} / {hero.max_health}</strong></div>
          <div className="tti-meter" role="meter" aria-label="Hero health" aria-valuemin={0} aria-valuemax={Math.max(0, hero.max_health)} aria-valuenow={Math.max(0, hero.health)}><span style={{ width: `${healthRatio}%` }} /></div>
          <div className="tti-stat"><span>Experience</span><strong>{hero.experience} XP</strong></div>
          <button type="button" className="tti-text-action" onClick={() => setInspected((value) => !value)} aria-expanded={inspected}>
            {inspected ? "Hide Hero attributes ↑" : "Inspect Hero attributes ↓"}
          </button>
          {inspected && <dl className="tti-live-stats">{Object.entries(hero.stats).map(([stat, value]) => <div key={stat}><dt>{stat.replaceAll("_", " ")}</dt><dd>{value}</dd></div>)}</dl>}
        </> : <p className="tti-disclaimer">Waiting for the current room's Hero snapshot.</p>}
        <p className="tti-disclaimer">Read-only; rolls and progression remain server-authoritative.</p>
      </div>}
      {active === "chat" && <div className="tti-body tti-chat">
        <p className="tti-kicker">LIVE ROOM CHAT</p>
        <div className="tti-messages" role="log" aria-label="Party conversation" aria-live="polite">
          {messages.length ? messages.map((msg) => <p key={msg.id}><strong>{msg.player_name}</strong><span>{msg.text}</span></p>) : <p>No messages yet.</p>}
        </div>
        <form onSubmit={send}>
          <label htmlFor="tti-live-chat-input">Message your party</label>
          <input id="tti-live-chat-input" maxLength={500} type="text" value={draft} onChange={(event) => setDraft(event.target.value)} disabled={!connected} placeholder={connected ? "Write a message…" : "Waiting for the connection…"} />
          <button type="submit" disabled={!connected || !draft.trim()}>Send to room ↗</button>
        </form>
        <p className="tti-disclaimer">Messages use the current room connection. No second session is opened.</p>
      </div>}
      {active === "notes" && <div className="tti-body tti-notes">
        <p className="tti-kicker">PERSONAL FIELD JOURNAL</p>
        <label htmlFor="tti-live-note-input">What deserves remembering?</label>
        <textarea id="tti-live-note-input" rows={8} value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="A clue, a promise, a suspiciously specific prophecy…" />
        <p className="tti-note-length" aria-live="polite">{notes.length} characters · unsaved</p>
        <p className="tti-disclaimer">Temporary notes remain while this adventure page is mounted; they are not saved to your account.</p>
      </div>}
      <div className="tti-sheet-foot">✧ THE STORY STAYS ON THE PAGE ✧</div>
    </aside> : null}
    <span className="sr-only" aria-live="polite">{unread > 0 ? `${unread} unread party messages` : ""}</span>
  </div>;
}
