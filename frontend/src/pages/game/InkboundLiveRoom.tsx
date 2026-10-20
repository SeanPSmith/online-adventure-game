/** Pass 65.1: Opt-in Inkbound reader for the ACTUAL active adventure.
 * All room state, choice submission, chat, narration and effects remain owned
 * by AdventurePage/useLiveAdventure. This is presentation only.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import type { Character } from "../../services/characters";
import type { ChatMessage, PartyHeroSnapshot, RoomPlayer, SceneChoice, TurnHistoryEntry } from "../../services/game";
import "./inkboundFoundation.css";
import "./inkboundLiveRoom.css";

type Hero = Character | PartyHeroSnapshot;
type Panel = "journal" | "notes" | "party" | "chat" | "hero" | "history" | null;
export type InkboundLiveRoomProps = Readonly<{
  roomCode: string;
  adventureTitle: string;
  turnNumber: number;
  scene: { id: string; title: string; body: string; ascii_art?: string; choices: readonly SceneChoice[] };
  chapterReleased: boolean;
  playerName: string;
  hero: Hero | null;
  party: readonly RoomPlayer[];
  history: readonly TurnHistoryEntry[];
  messages: readonly ChatMessage[];
  connected: boolean;
  selectedChoiceId: string;
  choiceLocked: boolean;
  choicesBlocked: boolean;
  lockPending: boolean;
  onSelectChoice: (choice: SceneChoice) => void;
  onLockChoice: () => void;
  onSendChat: (text: string) => void;
  notes: string;
  onNotesChange: (text: string) => void;
  onToggleStoryTime: () => void;
  narrationEnabled: boolean;
  onClose: () => void;
}>;

function Prose({ body }: { body: string }) {
  const paragraphs = body.trim().split(/\n\s*\n/).filter(Boolean);
  return <section aria-label="Story narration" className="ibl-prose">
    {paragraphs.map((paragraph, index) => <p key={index} className={index === 0 ? "ibl-opening" : undefined}>
      {index === 0 && paragraph.length > 0 ? <><span className="ibl-dropcap" aria-hidden="true">{paragraph[0]}</span><span className="sr-only">{paragraph[0]}</span>{paragraph.slice(1)}</> : paragraph}
    </p>)}
  </section>;
}

export function InkboundLiveRoom(props: InkboundLiveRoomProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [chatText, setChatText] = useState("");
  const chatLog = useRef<HTMLDivElement>(null);
  const healthy = props.hero ? Math.max(0, Math.min(100, (props.hero.health / Math.max(1, props.hero.max_health)) * 100)) : 0;
  const xp = props.hero?.experience ?? 0;
  const xpPercent = props.hero?.xp_progress_percent ?? 0;
  const closeButton = useRef<HTMLButtonElement>(null);
  const selected = props.scene.choices.find((choice) => choice.id === props.selectedChoiceId);
  const liveChoices = props.chapterReleased && !props.choicesBlocked && !props.choiceLocked;
  useEffect(() => {
    if (panel === "chat" && chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [panel, props.messages.length]);
  useEffect(() => { setPanel(null); }, [props.roomCode]);
  useEffect(() => { if (panel) closeButton.current?.focus(); }, [panel]);
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatText.trim();
    if (!text || !props.connected) return;
    props.onSendChat(text); setChatText("");
  };
  const toggle = (next: NonNullable<Panel>) => setPanel((old) => old === next ? null : next);
  return <div className="inkbound inkbound-live" data-ink-paper="ivory" aria-label="Inkbound adventure reader">
    <a className="inkbound-skip" href="#ibl-chapter">Skip to chapter</a>
    <header className="ibl-topbar">
      <Link to="/game" className="ibl-brand">✧ <span>Tales of Two</span></Link>
      <nav aria-label="Adventure navigation" className="ibl-nav">
        <Link to="/game">Hall</Link><Link to="/game/heroes">Heroes</Link><Link to="/game/adventures">Adventures</Link>
        <button type="button" onClick={() => toggle("journal")}>Journal</button>
        <button type="button" aria-pressed={props.narrationEnabled} onClick={props.onToggleStoryTime}>
          {props.narrationEnabled ? "Sound on" : "Sound off"}
        </button>
        <button type="button" onClick={props.onClose}>Standard reader ↗</button>
      </nav>
    </header>
    <div className="ibl-layout">
      <main id="ibl-chapter" className="ibl-main" tabIndex={-1}>
        <div className="ibl-meta"><span>Chapter · Turn {props.turnNumber}</span><span>{props.adventureTitle}</span><span>Room {props.roomCode}</span></div>
        {props.chapterReleased ? <article className="ibl-chapter" key={`${props.roomCode}-${props.scene.id}-${props.turnNumber}`}>
          <h1>{props.scene.title}</h1>
          <div className="ibl-flourish" aria-hidden="true">── ✧ ──</div>
          {props.scene.ascii_art?.trim() ? <pre aria-label="Scene illustration" className="ibl-scene-ascii">{props.scene.ascii_art.trim()}</pre> : <div className="ibl-scene-ornament" aria-hidden="true">✧ ✦ ✧</div>}
          <Prose body={props.scene.body} />
          <div className="ibl-section-heading"><span />What do you do?<span /></div>
          <div className="ibl-choices">
            {props.scene.choices.map((choice, index) => <button key={choice.id} type="button" className={`ibl-choice ${props.selectedChoiceId === choice.id ? "is-chosen" : ""}`}
              aria-pressed={props.selectedChoiceId === choice.id}
              disabled={!liveChoices}
              onClick={() => props.onSelectChoice(choice)}>
              <span className="ibl-choice-index">{String(index + 1).padStart(2,"0")}</span>
              <span className="ibl-choice-body"><strong>{choice.label}</strong><small>{choice.description || `${choice.risk_level || "Unknown"} risk · ${choice.xp_reward} XP`}</small></span>
              <span className="ibl-choice-arrow" aria-hidden="true">→</span>
            </button>)}
          </div>
          <div className="ibl-commit" aria-live="polite">
            {props.choiceLocked ? <span>Your choice is locked; waiting for the story.</span>
              : selected ? <><span>Selected: {selected.label}</span><button type="button" onClick={props.onLockChoice} disabled={!liveChoices || props.lockPending}>{props.lockPending ? "Recording…" : "Commit this choice →"}</button></>
              : <span>Select your next action. Only the server decides the outcome.</span>}
          </div>
        </article> : <section className="ibl-sealed" role="status" aria-live="polite"><div className="ibl-flourish" aria-hidden="true">── ✧ ──</div><h1>The ink is settling</h1><p>The next chapter is still sealed. Your choices, dice results, and effects are being resolved.</p></section>}
      </main>
      <aside className="ibl-sidebar" aria-label="Adventure instruments">
        <section className="ibl-sidebar-section ibl-hero">
          <div className="ibl-sidebar-head"><h2>Hero</h2><button type="button" onClick={() => toggle("hero")}>Character sheet ↗</button></div>
          <div className="ibl-hero-name"><span className="ibl-avatar" aria-hidden="true">✦</span><span><strong>{props.hero?.name ?? props.playerName}</strong><small>Level {props.hero?.level ?? "–"} · {props.hero?.is_alive === false ? "Fallen" : "Adventurer"}</small></span></div>
          <div className="ibl-resource"><span>HP</span><div className="ibl-progress"><span style={{width:`${healthy}%`}} /></div><span>{props.hero ? `${props.hero.health}/${props.hero.max_health}` : "–"}</span></div>
          <div className="ibl-resource"><span>XP</span><div className="ibl-progress"><span style={{width:`${Math.max(0,Math.min(100,xpPercent))}%`}} /></div><span>{xp}</span></div>
          <div className="ibl-active-effects"><span>Active effects</span>{props.hero?.effects?.length ? props.hero.effects.filter(e=>e.active !== false).slice(0,4).map((effect,index)=><small key={String(effect.effect_id ?? effect.source_key ?? index)}>{String(effect.name ?? "Effect")} {effect.remaining_turns != null ? `· ${String(effect.remaining_turns)} turns` : ""}</small>) : <small>None</small>}</div>
        </section>
        <section className="ibl-sidebar-section">
          <div className="ibl-sidebar-head"><h2>Party</h2><button type="button" onClick={() => toggle("party")}>Details ↗</button></div>
          <div className="ibl-party-list">{props.party.map((person) => <div key={person.player_id}><span className="ibl-party-avatar">✧</span><span><strong>{person.name}</strong><small>{person.is_online ? "Online" : "Offline"}{person.is_host ? " · Host" : ""}</small></span></div>)}</div>
        </section>
        <section className="ibl-sidebar-section">
          <div className="ibl-sidebar-head"><h2>Journal</h2><button type="button" onClick={() => toggle("journal")}>Open ↗</button></div>
          <button className="ibl-journal-link" type="button" onClick={() => toggle("notes")}>✎ &nbsp; Field notes <span>↗</span></button>
          <button className="ibl-journal-link" type="button" onClick={() => toggle("history")}>▤ &nbsp; Chronicle ({props.history.length}) <span>↗</span></button>
        </section>
        <section className="ibl-sidebar-section ibl-chat-section">
          <div className="ibl-sidebar-head"><h2>Party chat</h2><button type="button" onClick={() => toggle("chat")}>Expand ↗</button></div>
          <div className="ibl-chat-log" aria-label="Recent party messages" role="log">{props.messages.length ? props.messages.slice(-3).map((message) => <p key={message.id}><b>{message.player_name}</b>{message.text}</p>) : <p className="ibl-sidebar-note">Your fellow travelers have been quiet.</p>}</div>
          <form className="ibl-chat-form" onSubmit={send}><input aria-label="Message your party" maxLength={500} placeholder="Write to your party…" value={chatText} onChange={(event)=>setChatText(event.target.value)} disabled={!props.connected} /><button type="submit" disabled={!props.connected || !chatText.trim()} aria-label="Send message">→</button></form>
        </section>
      </aside>
    </div>
    <footer className="ibl-footer"><span>Some stories are better shared</span><span>{props.connected ? "Connected" : "Reconnecting"} · Turn {props.turnNumber}</span></footer>
    {panel && <div className="ibl-drawer-scrim" onMouseDown={(event) => { if (event.target === event.currentTarget) setPanel(null); }}>
      <aside className="ibl-drawer" role="dialog" aria-modal="true" aria-label={`${panel} panel`} onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); setPanel(null); return; }
          if (event.key !== "Tab") return;
          const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled)'));
          const first=controls[0],last=controls[controls.length-1];
          if (!first || !last) return;
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}>
        <header><span className="ibl-kicker">Traveler's folio</span><button ref={closeButton} type="button" onClick={()=>setPanel(null)} aria-label="Close panel">×</button></header>
        <h2>{panel === "hero" ? "Character" : panel === "history" ? "Chronicle" : panel[0].toUpperCase()+panel.slice(1)}</h2>
        {panel === "hero" && <><p>{props.hero?.name ?? props.playerName}</p>{props.hero && <p>Level {props.hero.level} · HP {props.hero.health}/{props.hero.max_health} · XP {props.hero.experience}</p>}<Link to={props.hero ? `/game/heroes/${encodeURIComponent(props.hero.character_id)}` : "/game/heroes"}>Open character sheet →</Link></>}
        {panel === "party" && props.party.map((p)=><p key={p.player_id}>{p.name} · {p.is_online ? "Online" : "Offline"}</p>)}
        {panel === "journal" && <><p>The story is shaped by every choice.</p><button onClick={()=>setPanel("notes")}>Open your notes →</button><button onClick={()=>setPanel("history")}>Open Chronicle →</button></>}
        {panel === "history" && <div className="ibl-history-list">{props.history.length ? [...props.history].reverse().map((entry) => <article key={entry.turn_number}><h3>Turn {entry.turn_number} · {entry.scene_title || "Previous scene"}</h3>{entry.choices.map((c,index)=><p key={`${c.player_name}:${index}`}><strong>{c.player_name}:</strong> {c.choice_label}{c.outcome ? ` · ${c.outcome.replaceAll("_", " ")}` : ""}</p>)}{entry.resolution && <p>{entry.resolution}</p>}</article>) : <p>No resolved turns yet.</p>}</div>}
        {panel === "notes" && <><label htmlFor="ibl-notes">Notes for this adventure</label><textarea id="ibl-notes" value={props.notes} onChange={(e)=>props.onNotesChange(e.target.value)} placeholder="A name, a clue, a promise…" rows={12}/><p className="ibl-sidebar-note">Temporary draft: these notes may be lost when leaving the adventure.</p></>}
        {panel === "chat" && <><div ref={chatLog} className="ibl-drawer-chat" role="log">{props.messages.map(m=><p key={m.id}><b>{m.player_name}</b> {m.text}</p>)}</div><form className="ibl-chat-form" onSubmit={send}><input aria-label="Send party message" maxLength={500} value={chatText} onChange={e=>setChatText(e.target.value)} disabled={!props.connected}/><button disabled={!props.connected || !chatText.trim()}>Send →</button></form></>}
      </aside>
    </div>}
  </div>;
}
