import { BrandLockup } from "../../components/brand/BrandLockup";
/** Pass 65.1: Opt-in Inkbound reader for the ACTUAL active adventure.
 * All room state, choice submission, chat, narration and effects remain owned
 * by AdventurePage/useLiveAdventure. This is presentation only.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import type { Character } from "../../services/characters";
import { StoryReveal } from "../../features/adventure/StoryReveal";
import { baseSuccessChance } from "../../features/adventure/choicePreview";
import type { NarrationCue } from "../../services/storyNarrator";
import type { InkPaper } from "../../features/appearance/inkboundPaper";
import type { ChatMessage, PartyHeroSnapshot, RoomPlayer, SceneChoice, TurnHistoryEntry } from "../../services/game";
import "./inkboundFoundation.css";
import "./inkboundLiveRoom.css";

type Hero = Character | PartyHeroSnapshot;
type Panel = "menu" | "journal" | "notes" | "party" | "chat" | "hero" | "history" | null;
export type InkboundLiveRoomProps = Readonly<{
  roomCode: string;
  paper: InkPaper;
  illustrationSrc?: string;
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
  wordRevealEnabled?: boolean;
  decorativeInitials?: boolean;
  followNarration?: boolean;
  narrationCue?: NarrationCue | null;
  sessionUtilities?: ReactNode;
  onClose: () => void;
}>;

function Prose({ sceneId, body, wordRevealEnabled, decorativeInitials, followNarration, narrationCue }: {
  sceneId: string;
  body: string;
  wordRevealEnabled: boolean;
  decorativeInitials: boolean;
  followNarration: boolean;
  narrationCue: NarrationCue | null;
}) {
  return <section aria-label="Story narration" className="ibl-prose">
    <StoryReveal
      sceneId={sceneId}
      text={body}
      enabled={wordRevealEnabled}
      followNarration={followNarration}
      narrationCue={narrationCue}
      decorativeInitials={decorativeInitials}
      readingTypeface="literary"
    />
  </section>;
}

export function InkboundLiveRoom(props: InkboundLiveRoomProps) {
  const [panel, setPanel] = useState<Panel>(null);
  const [chatText, setChatText] = useState("");
  const chatLog = useRef<HTMLDivElement>(null);
  const chapterScroller = useRef<HTMLElement>(null);
  const healthy = props.hero ? Math.max(0, Math.min(100, (props.hero.health / Math.max(1, props.hero.max_health)) * 100)) : 0;
  const xp = props.hero?.experience ?? 0;
  const xpPercent = props.hero?.xp_progress_percent ?? 0;
  const closeButton = useRef<HTMLButtonElement>(null);
  const panelOpener = useRef<HTMLElement | null>(null);
  const selected = props.scene.choices.find((choice) => choice.id === props.selectedChoiceId);
  const liveChoices = props.chapterReleased && !props.choicesBlocked && !props.choiceLocked;
  useEffect(() => {
    chapterScroller.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [props.roomCode, props.scene.id, props.turnNumber]);
  useEffect(() => {
    if (panel === "chat" && chatLog.current) chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [panel, props.messages.length]);
  useEffect(() => { setPanel(null); }, [props.roomCode]);
  useEffect(() => {
    if (!panel) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = oldOverflow;
      if (panelOpener.current?.isConnected) panelOpener.current.focus();
    };
  }, [panel]);
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatText.trim();
    if (!text || !props.connected) return;
    props.onSendChat(text); setChatText("");
  };
  const toggle = (next: NonNullable<Panel>) => {
    if (!panel) panelOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPanel((old) => old === next ? null : next);
  };
  return <div className="inkbound inkbound-live" data-ink-paper={props.paper} aria-label="Inkbound adventure reader">
    <a className="inkbound-skip" href="#ibl-chapter">Skip to chapter</a>
    <header className="ibl-topbar">
      <Link to="/game" className="ibl-brand" aria-label="Quillairo home"><BrandLockup /></Link>
      <span className="ibl-header-rule" aria-hidden="true" />
      <nav aria-label="Adventure navigation" className="ibl-nav">
        <button type="button" onClick={() => toggle("journal")}>▤ <span>Journal</span></button>
        <button type="button" onClick={() => toggle("party")}>♧ <span>Party</span></button>
        <button type="button" aria-pressed={props.narrationEnabled} onClick={props.onToggleStoryTime}>
          ◖)) <span>{props.narrationEnabled ? "Sound on" : "Sound off"}</span>
        </button>
        <button type="button" onClick={() => toggle("menu")}>☰ <span>Menu</span></button>
      </nav>
    </header>
    <div className="ibl-layout">
      <main id="ibl-chapter" ref={chapterScroller} className="ibl-main" tabIndex={-1}>
        <div className="ibl-meta"><span>Chapter {props.turnNumber}</span><span>{props.adventureTitle}</span><span>Room {props.roomCode}</span></div>
        {props.chapterReleased ? <article className="ibl-chapter" key={`${props.roomCode}-${props.scene.id}-${props.turnNumber}`}>
          <h1>{props.scene.title}</h1>
          <div className="ibl-flourish" aria-hidden="true"><span />✧<span /></div>
          {props.illustrationSrc ? <figure className="ibl-chapter-illustration"><img src={props.illustrationSrc} alt="Monochrome ink landscape for this adventure" /></figure> : null}
          <Prose sceneId={props.scene.id} body={props.scene.body} wordRevealEnabled={props.wordRevealEnabled ?? false} decorativeInitials={props.decorativeInitials ?? true} followNarration={props.followNarration ?? false} narrationCue={props.narrationCue ?? null} />
          <div className="ibl-section-heading"><span />What do you do?<span /></div>
          <div className="ibl-choices">
            {props.scene.choices.map((choice, index) => <button key={choice.id} type="button" className={`ibl-choice ${props.selectedChoiceId === choice.id ? "is-chosen" : ""}`}
              aria-pressed={props.selectedChoiceId === choice.id}
              disabled={!liveChoices}
              onClick={() => props.onSelectChoice(choice)}>
              <span className="ibl-choice-index">{String(index + 1).padStart(2,"0")}</span>
              <span className="ibl-choice-body"><strong>{choice.label}</strong><small>{choice.description}</small>
                <span className="ibl-choice-statline">
                  <span>{choice.check ? `DC ${choice.check.difficulty}` : "No check"}</span>
                  {choice.check ? <span>{(choice.check.skill || choice.check.stat || "Check").replaceAll("_", " ")}</span> : null}
                  <span>{choice.risk_level || "Unknown"} risk</span>
                  <span>+{choice.xp_reward} XP</span>
                  {choice.check ? <span>{(() => {
                    const chance = baseSuccessChance(choice, props.hero && "skills" in props.hero ? props.hero as Character : null);
                    return chance == null ? "Odds vary" : `Base chance ≈ ${chance}%`;
                  })()}</span> : null}
                </span>
                {choice.possible_gains?.length || choice.possible_costs?.length ? <span className="ibl-choice-stakes">
                  {choice.possible_gains?.length ? `Possible: ${choice.possible_gains.slice(0, 2).join(", ")}` : ""}
                  {choice.possible_costs?.length ? ` · At risk: ${choice.possible_costs.slice(0, 2).join(", ")}` : ""}
                </span> : null}
              </span>
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
      <details className="ibl-instruments-disclosure" open>
        <summary>More from your adventure <span aria-hidden="true">＋</span></summary>
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
        <section className="ibl-sidebar-section ibl-session-utilities" aria-label="Adventure controls">
          <div className="ibl-sidebar-head"><h2>Adventure tools</h2></div>
          <button className="ibl-journal-link" type="button" onClick={() => toggle("menu")}>Open tools and preferences <span aria-hidden="true">↗</span></button>
        </section>
        <section className="ibl-sidebar-section ibl-chat-section">
          <div className="ibl-sidebar-head"><h2>Party chat</h2><button type="button" onClick={() => toggle("chat")}>Expand ↗</button></div>
          <div className="ibl-chat-log" aria-label="Recent party messages" role="log">{props.messages.length ? props.messages.slice(-3).map((message) => <p key={message.id}><b>{message.player_name}</b>{message.text}</p>) : <p className="ibl-sidebar-note">Your fellow travelers have been quiet.</p>}</div>
          <form className="ibl-chat-form" onSubmit={send}><input aria-label="Message your party" maxLength={500} placeholder="Write to your party…" value={chatText} onChange={(event)=>setChatText(event.target.value)} disabled={!props.connected} /><button type="submit" disabled={!props.connected || !chatText.trim()} aria-label="Send message">→</button></form>
        </section>
      </aside>
      </details>
    </div>
      <section className="ibl-status-strip" aria-label="Current Hero and party status">
        <button type="button" className="ibl-status-hero" onClick={() => toggle("hero")} aria-label="Open character sheet">
          <span aria-hidden="true" className="ibl-status-mark">✧</span>
          <span><strong>{props.hero?.name ?? props.playerName}</strong><small>Hero · Level {props.hero?.level ?? "–"}</small></span>
        </button>
        <div className="ibl-status-resource"><span>HP</span><div className="ibl-progress" aria-hidden="true"><span style={{width:`${healthy}%`}} /></div><strong>{props.hero ? `${props.hero.health}/${props.hero.max_health}` : "–"}</strong></div>
        <div className="ibl-status-resource"><span>XP</span><div className="ibl-progress" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(100,xpPercent))}%`}} /></div><strong>{xp}</strong></div>
        <button type="button" className="ibl-status-party" onClick={() => toggle("party")}>Party · {props.party.length} <span aria-hidden="true">↗</span></button>
        <button type="button" className="ibl-status-party" onClick={() => toggle("chat")}>Chat{props.messages.length ? ` · ${props.messages.length}` : ""} <span aria-hidden="true">↗</span></button>
      </section>
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
        {panel === "menu" && <nav className="ibl-drawer-menu" aria-label="Game menu"><Link to="/game">Adventure hall →</Link><Link to="/game/heroes">Heroes →</Link><Link to="/game/adventures">My adventures →</Link><button type="button" onClick={props.onClose}>Switch to Classic view →</button>{props.sessionUtilities && <section className="ibl-utility-actions" aria-label="In-game controls">{props.sessionUtilities}</section>}</nav>}
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
