import { BrandLockup } from "../../components/brand/BrandLockup";
/** Pass 65.1: Opt-in Inkbound reader for the ACTUAL active adventure.
 * All room state, choice submission, chat, narration and effects remain owned
 * by AdventurePage/useLiveAdventure. This is presentation only.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { getHeroPortraits, type Character } from "../../services/characters";
import { StoryReveal } from "../../features/adventure/StoryReveal";
import { HeroEffectList } from "../../features/adventure/HeroEffectList";
import { baseSuccessChance } from "../../features/adventure/choicePreview";
import type { NarrationCue } from "../../services/storyNarrator";
import type { InkPaper } from "../../features/appearance/inkboundPaper";
import type { ChatMessage, HeroProgressionUpdate, PartyHeroSnapshot, RoomPlayer, SceneChoice, TurnHistoryEntry, TurnResult } from "../../services/game";
import "./inkboundFoundation.css";
import "./inkboundLiveRoom.css";
import "./quillairoInkscapeLivePass6648.css";
import "./inkscapeGameplayPass6665.css";
import "./inkscapeResolutionRailPass6666.css";
import "./inkscapeArtworkPass6667.css";

type Hero = Character | PartyHeroSnapshot;
type Panel = "menu" | "journal" | "notes" | "party" | "chat" | "hero" | "history" | null;
export type InkboundLiveRoomProps = Readonly<{
  roomCode: string;
  paper: InkPaper;
  illustrationSrc?: string;
  sceneArtUrl?: string | null;
  onSceneArtError?: () => void;
  genreTags?: readonly string[];
  worldDocumentId?: string | null;
  briefDocumentId?: string | null;
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
  finalePanel?: ReactNode;
  narrativePacing?: { act: number; beat: string; phase: string } | null;
  wrapUpCallout?: ReactNode;
  lastResult?: TurnResult | null;
  turnPhase?: "none" | "intermission" | "story-ready" | "resolution" | "retry";
  onResolutionHost?: (element: HTMLDivElement | null) => void;
  lastProgression?: HeroProgressionUpdate | null;
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
  const [coverAttempt, setCoverAttempt] = useState(0);
  // Artwork presentation only: never conceal the known-good transparent
  // illustration until the scene-specific asset has actually decoded.
  // Comparison by URL also avoids showing a previous chapter's art on navigation.
  const [loadedSceneArtUrl, setLoadedSceneArtUrl] = useState<string | null>(null);
  const sceneArtReady = Boolean(props.sceneArtUrl && loadedSceneArtUrl === props.sceneArtUrl);
  const [selectedPortraitUrl, setSelectedPortraitUrl] = useState<string | null>(null);
  useEffect(() => { setCoverAttempt(0); }, [props.briefDocumentId, props.worldDocumentId]);
  useEffect(() => {
    let active = true;
    setSelectedPortraitUrl(null);
    const heroId = props.hero?.character_id;
    if (!heroId) return;
    // Reuse the owner-private Hero Hall lookup; never expose storage keys or
    // generate/select a portrait from inside an active adventure.
    void getHeroPortraits(heroId).then((book) => {
      const chosen = book.candidates.find((candidate) => candidate.attempt === book.selected_attempt);
      if (active) setSelectedPortraitUrl(chosen?.url ?? null);
    }).catch(() => { if (active) setSelectedPortraitUrl(null); });
    return () => { active = false; };
  }, [props.hero?.character_id]);
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
  return <div className="inkbound inkbound-live" data-ink-paper={props.paper} data-turn-phase={props.turnPhase} aria-label="Inkbound adventure reader">
    <a className="inkbound-skip" href="#ibl-chapter">Skip to chapter</a>
    <header className="ibl-topbar">
      <Link to="/game" className="ibl-brand" aria-label="Quillairo home"><BrandLockup paper={props.paper} /></Link>
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
        <div className="ibl-meta"><span>Chapter {props.turnNumber}</span><span>{props.narrativePacing ? `Act ${props.narrativePacing.act} · ${props.narrativePacing.beat.toLowerCase()}` : props.adventureTitle}</span><span>Room {props.roomCode}</span></div>
        {props.chapterReleased ? <article className="ibl-chapter" key={`${props.roomCode}-${props.scene.id}-${props.turnNumber}`}>
          <h1>{props.scene.title}</h1>
          <div className="ibl-flourish" aria-hidden="true"><span />✧<span /></div>
          <figure className="ibl-chapter-illustration" data-artwork-state={sceneArtReady ? "scene-ready" : props.sceneArtUrl ? "loading-scene" : "fallback"}>
            <div className="ibl-story-art">
              {/* Exactly one illustration is visible: preserve the approved cutout
                  until the optional server-generated scene art has fully loaded. */}
              {coverAttempt < (props.briefDocumentId ? 1 : 0) + (props.worldDocumentId ? 1 : 0) ? (
                <img className="ibl-art-fallback" key={`${props.scene.id}:${coverAttempt}`}
                  src={`/api/story-art/worlds/${encodeURIComponent(coverAttempt === 0 && props.briefDocumentId ? props.briefDocumentId : props.worldDocumentId ?? "")}/image`}
                  alt="Authored story or world ink illustration" aria-hidden={sceneArtReady}
                  onError={() => setCoverAttempt(value => value + 1)} />
              ) : props.illustrationSrc ? <img className="ibl-art-fallback" src={props.illustrationSrc}
                  alt="Genre-specific watercolor illustration" aria-hidden={sceneArtReady} /> : null}
              {props.sceneArtUrl ? <img key={props.sceneArtUrl} className="ibl-art-scene" src={props.sceneArtUrl}
                  alt={`Illustration of ${props.scene.title}`} aria-hidden={!sceneArtReady}
                  onLoad={() => setLoadedSceneArtUrl(props.sceneArtUrl ?? null)}
                  onError={() => { setLoadedSceneArtUrl(null); props.onSceneArtError?.(); }} /> : null}
            </div>
          </figure>
          <Prose sceneId={props.scene.id} body={props.scene.body} wordRevealEnabled={props.wordRevealEnabled ?? false} decorativeInitials={props.decorativeInitials ?? true} followNarration={props.followNarration ?? false} narrationCue={props.narrationCue ?? null} />
          {props.finalePanel ? props.finalePanel : <>
          <div className="ibl-section-heading"><span />What do you do?<span /></div>
          <div className="ibl-finale-before-choices">{props.wrapUpCallout}</div>
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
          </>}
        </article> : <section className="ibl-sealed" role="status" aria-live="polite"><div className="ibl-flourish" aria-hidden="true">── ✧ ──</div><h1>The ink is settling</h1><p>The next chapter is still sealed. Your choices, dice results, and effects are being resolved.</p></section>}
      </main>
      <details className="ibl-instruments-disclosure" open>
        <summary>More from your adventure <span aria-hidden="true">＋</span></summary>
      <aside className="ibl-sidebar" aria-label="Adventure instruments">
        <section className="ibl-sidebar-section ibl-hero">
          <div className="ibl-sidebar-head"><h2>Hero</h2><button type="button" onClick={() => toggle("hero")}>Character sheet ↗</button></div>
          {selectedPortraitUrl ? <div className="ibl-hero-portrait"><img src={selectedPortraitUrl} alt={`Selected illustration of ${props.hero?.name ?? props.playerName}`} /></div> : null}
          <div className="ibl-hero-name"><span className="ibl-avatar" aria-hidden="true">✦</span><span><strong>{props.hero?.name ?? props.playerName}</strong><small>Level {props.hero?.level ?? "–"} · {props.hero?.is_alive === false ? "Fallen" : "Adventurer"}</small></span></div>
          <div className="ibl-resource"><span>HP</span><div className="ibl-progress"><span style={{width:`${healthy}%`}} /></div><span>{props.hero ? `${props.hero.health}/${props.hero.max_health}` : "–"}</span></div>
          <div className="ibl-resource"><span>XP</span><div className="ibl-progress"><span style={{width:`${Math.max(0,Math.min(100,xpPercent))}%`}} /></div><span>{xp}</span></div>
          <div className="ibl-active-effects"><span>Active effects</span><HeroEffectList effects={props.hero?.effects} compact limit={4} /></div>
          {props.lastResult ? <div className="ibl-turn-feedback" role="status" aria-label="Last resolved turn">
            <span className="ibl-turn-feedback-label">Last resolved turn</span>
            <strong>{props.lastResult.check ? `D20 ${props.lastResult.check.roll} · ${props.lastResult.check.outcome.replaceAll("_", " ")}` : "Action resolved · no check"}</strong>
            <span>+{props.lastProgression?.xp_gained ?? props.lastResult.xp_reward} XP · {props.lastProgression?.health_change === undefined ? "HP pending" : props.lastProgression.health_change === 0 ? "HP unchanged" : `${props.lastProgression.health_change > 0 ? "+" : ""}${props.lastProgression.health_change} HP`}</span>
            {props.lastProgression ? <small>HP {props.lastProgression.health_after}/{props.lastProgression.max_health} · Level {props.lastProgression.level_after}</small> : <small>Detailed rewards appear with the dice receipt.</small>}
          </div> : null}
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
      <aside className="ibl-turn-rail" aria-label="Turn record and chapter continuity">
        {/* Render host on every turn, but only display the authoritative receipt here
            while resolving. The desktop rail is not a second gameplay controller. */}
        <div className="ibl-resolution-rail-host" ref={props.onResolutionHost} />
        <section className="ibl-rail-section ibl-rail-current">
          <span className="ibl-rail-kicker">THE CHRONICLE</span>
          <h2>Chapter {props.turnNumber}</h2>
          <p role="status" aria-live="polite">
            {props.turnPhase === "intermission" ? "The Director is composing the next passage."
              : props.turnPhase === "story-ready" ? "The saved chapter is being prepared."
              : props.turnPhase === "resolution" ? "Review the committed dice and consequences."
              : props.turnPhase === "retry" ? "Story recovery is available in the turn controls."
              : !props.chapterReleased ? "The next passage is being prepared."
              : props.choiceLocked ? "Your choice is recorded. Awaiting resolution."
              : "Read the manuscript and choose your next action."}
          </p>
        </section>
        <section className="ibl-rail-section ibl-rail-result" aria-label="Previous resolved turn">
          <span className="ibl-rail-kicker">PREVIOUS TURN · SERVER RECORD</span>
          {props.lastResult ? <>
            <h3>{props.lastResult.choice_label}</h3>
            {props.lastResult.check ? <>
              <div className="ibl-rail-die" aria-label={`Recorded D20 ${props.lastResult.check.roll}`}>
                <span>D20</span><strong>{props.lastResult.check.roll}</strong>
              </div>
              <dl className="ibl-rail-ledger">
                <div><dt>Difficulty</dt><dd>{props.lastResult.check.difficulty}</dd></div>
                <div><dt>Total</dt><dd>{props.lastResult.check.total}</dd></div>
                <div><dt>Outcome</dt><dd>{props.lastResult.check.outcome.replaceAll("_", " ")}</dd></div>
              </dl>
            </> : <p>No check was required for this action.</p>}
            <dl className="ibl-rail-ledger">
              <div><dt>Experience</dt><dd>+{props.lastProgression?.xp_gained ?? props.lastResult.xp_reward} XP</dd></div>
              {props.lastProgression ? <>
                <div><dt>HP change</dt><dd>{props.lastProgression.health_change > 0 ? "+" : ""}{props.lastProgression.health_change}</dd></div>
                <div><dt>Current HP</dt><dd>{props.lastProgression.health_after}/{props.lastProgression.max_health}</dd></div>
              </> : null}
            </dl>
          </> : <p>The first resolved turn will appear here after the server records it.</p>}
        </section>
        <section className="ibl-rail-section ibl-rail-archive">
          <span className="ibl-rail-kicker">YOUR RECORD</span>
          <p>{props.history.length} resolved {props.history.length === 1 ? "turn" : "turns"} in this adventure.</p>
          <button type="button" onClick={() => toggle("history")}>Open chronicle <span aria-hidden="true">→</span></button>
        </section>
      </aside>
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
        {panel === "menu" && <nav className="ibl-drawer-menu ibl-folio-links" aria-label="Game menu">
          <p className="ibl-folio-lede">Keep your place in the story while you adjust your adventure.</p>
          <Link to="/game">Adventure hall <span aria-hidden="true">↗</span></Link>
          <Link to="/game/heroes">Heroes <span aria-hidden="true">↗</span></Link>
          <Link to="/game/adventures">My adventures <span aria-hidden="true">↗</span></Link>
          <button type="button" onClick={props.onClose}>Switch to Classic view <span aria-hidden="true">↗</span></button>
          {props.sessionUtilities && <section className="ibl-utility-actions ibl-folio-utilities" aria-label="In-game controls">
            <h3>Session &amp; preferences</h3>{props.sessionUtilities}
          </section>}
        </nav>}
        {panel === "hero" && <div className="ibl-folio-content">
          <p className="ibl-folio-lede">The adventurer behind this chapter.</p>
          <section className="ibl-folio-card" aria-label="Hero details">
            <div className="ibl-folio-hero-mark" aria-hidden="true">✦</div>
            <h3>{props.hero?.name ?? props.playerName}</h3>
            <p className="ibl-folio-byline">Level {props.hero?.level ?? "–"} · {props.hero?.is_alive === false ? "Fallen Hero" : "Adventurer"}</p>
            <dl className="ibl-folio-stats">
              <div><dt>Health</dt><dd>{props.hero ? `${props.hero.health}/${props.hero.max_health}` : "—"}</dd></div>
              <div><dt>Experience</dt><dd>{props.hero ? props.hero.experience : "—"}</dd></div>
              <div><dt>Current turn</dt><dd>{props.turnNumber}</dd></div>
            </dl>
          </section>
          <section className="ibl-folio-card" aria-label="Current Hero effects">
            <h3>Conditions &amp; boons</h3>
            <HeroEffectList effects={props.hero?.effects} />
          </section>
          <Link className="ibl-folio-primary-link" to={props.hero ? `/game/heroes/${encodeURIComponent(props.hero.character_id)}` : "/game/heroes"}>Open full character sheet <span aria-hidden="true">↗</span></Link>
        </div>}
        {panel === "party" && <div className="ibl-folio-content">
          <p className="ibl-folio-lede">Companions sharing this adventure. Presence updates from the live room.</p>
          <div className="ibl-folio-count">{props.party.length} {props.party.length === 1 ? "traveler" : "travelers"} · {props.party.filter((person) => person.is_online).length} online</div>
          <ul className="ibl-folio-party-list" aria-label="Room party members">{props.party.map((person) => <li key={person.player_id}>
            <span className="ibl-folio-party-mark" aria-hidden="true">✧</span>
            <span className="ibl-folio-party-details"><strong>{person.name}</strong><small>{person.is_host ? "Host · " : ""}{person.is_online ? "Online" : "Offline"}</small></span>
            <span className={`ibl-folio-presence ${person.is_online ? "is-online" : ""}`} aria-label={person.is_online ? "Online" : "Offline"} />
          </li>)}</ul>
        </div>}
        {panel === "journal" && <nav className="ibl-folio-links" aria-label="Journal sections">
          <p className="ibl-folio-lede">Every choice leaves a mark. Read your resolved turns or jot down a clue before it fades.</p>
          <button type="button" onClick={() => setPanel("history")}><span>Chronicle <small>{props.history.length} resolved turns</small></span><span aria-hidden="true">↗</span></button>
          <button type="button" onClick={() => setPanel("notes")}><span>Field notes <small>Personal draft · not saved to the server</small></span><span aria-hidden="true">↗</span></button>
        </nav>}
        {panel === "history" && <div className="ibl-folio-content">
          <p className="ibl-folio-lede">A record of choices and consequences already resolved by the Director.</p>
          <ol className="ibl-history-list ibl-folio-history">{props.history.length ? [...props.history].reverse().map((entry) => <li key={entry.turn_number}>
            <article>
              <span className="ibl-folio-turn-label">Turn {entry.turn_number}</span>
              <h3>{entry.scene_title || "Previous scene"}</h3>
              {entry.choices.map((choice, index) => <p key={`${choice.player_name}:${index}`} className="ibl-folio-decision"><strong>{choice.player_name}</strong><span>{choice.choice_label}</span>{choice.outcome && <small>{choice.outcome.replaceAll("_", " ")}</small>}</p>)}
              {entry.resolution && <p className="ibl-folio-resolution">{entry.resolution}</p>}
            </article>
          </li>) : <li className="ibl-folio-empty">Your first resolved turn will appear here.</li>}</ol>
        </div>}
        {panel === "notes" && <div className="ibl-folio-content ibl-folio-notes">
          <p className="ibl-folio-lede">Keep names, clues, promises, and questions close while the story unfolds.</p>
          <label htmlFor="ibl-notes">Notes for this adventure</label>
          <textarea id="ibl-notes" value={props.notes} onChange={(event) => props.onNotesChange(event.target.value)} placeholder="A name, a clue, a promise…" rows={12}/>
          <p className="ibl-folio-caution">Personal draft only · these notes may be lost when leaving the adventure.</p>
        </div>}
        {panel === "chat" && <div className="ibl-folio-content ibl-folio-chat">
          <p className="ibl-folio-lede">A conversation between your fellow travelers.</p>
          <div className="ibl-drawer-chat" ref={chatLog} role="log" aria-label="Party chat messages" aria-live="polite" aria-relevant="additions text">
            {props.messages.length ? props.messages.map((message) => <p key={message.id} className="ibl-folio-message"><b>{message.player_name}</b><span>{message.text}</span></p>) : <p className="ibl-folio-empty">No messages yet. Be the first to speak.</p>}
          </div>
          <form className="ibl-chat-form ibl-folio-chat-form" onSubmit={send}>
            <input aria-label="Send party message" maxLength={500} placeholder={props.connected ? "Write to your party…" : "Reconnecting to the party…"} value={chatText} onChange={(event) => setChatText(event.target.value)} disabled={!props.connected} />
            <button type="submit" disabled={!props.connected || !chatText.trim()}>Send →</button>
          </form>
          <p className="ibl-folio-connection" role="status">{props.connected ? "Connected to party chat" : "Reconnecting…"}</p>
        </div>}
      </aside>
    </div>}
  </div>;
}
