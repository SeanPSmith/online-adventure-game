import { genreInkIllustration, coverCandidateIds, coverArtUrl } from "../../features/appearance/quillairoGenreArt";
import { BrandLockup } from "../../components/brand/BrandLockup";
/**
 * Pass 65.6 — the REAL authenticated Inkbound home.
 * This is presentation only. All Hero, room, catalog and lobby actions come from
 * GameHomePage's existing services and socket handlers. No demo gameplay state.
 */
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { TerminalSelect } from "../../components/ui/TerminalSelect";
import type { Character } from "../../services/characters";
import type { AdventureCatalogItem, AdventureListItem } from "../../services/game";
import { useInkboundPaper } from "../../features/appearance/inkboundPaper";
import "./inkboundAuthenticatedDashboard.css";
import "./quillairoAtlasPass6645.css";
import "./inkscapeWorldsPass6655.css";

type Page = "home" | "worlds" | "heroes" | "journeys" | "join";

const HIDDEN_INTERNAL_ADVENTURES = new Set(["old_chapel", "windroad_lantern"]);
const homeArt = "/art/inkbound/north-road-editorial.png";
function storyCover(title: string, tags: string[], metadata: Record<string, unknown> = {}) {
  const candidates = coverCandidateIds(metadata);
  return candidates.length ? coverArtUrl(candidates[0]) : genreInkIllustration(title, tags);
}
function nextCoverSource(img: HTMLImageElement, title: string, tags: string[], metadata: Record<string, unknown> = {}) {
  const candidates = coverCandidateIds(metadata).map(coverArtUrl);
  const current = new URL(img.src, window.location.href).pathname;
  const index = candidates.indexOf(current);
  const fallback = genreInkIllustration(title, tags);
  const next = index >= 0 && index + 1 < candidates.length ? candidates[index + 1] : fallback;
  if (current !== next) img.src = next;
}
function synopsis(item: AdventureCatalogItem) {
  const value = item.metadata?.player_synopsis;
  return typeof value === "string" && value.trim() ? value.trim() : item.description;
}
function journeyHref(item: AdventureListItem) {
  return `/game/adventure/${encodeURIComponent(item.room_code)}?hero=${encodeURIComponent(item.character_id)}`;
}
function usableHero(hero: Character) {
  return hero.is_alive && hero.hero_status === "active";
}
export type InkboundDashboardProps = {
  username: string;
  userId: string;
  isAuthor: boolean;
  isAdmin: boolean;
  connected: boolean;
  directoryReady: boolean;
  heroes: Character[];
  catalog: AdventureCatalogItem[];
  adventures: AdventureListItem[];
  selectedHeroId: string;
  onSelectHero: (id: string) => void;
  onCreate: (item: AdventureCatalogItem, mode: "solo" | "coop") => void;
  onJoin: (code: string) => void;
  onLeaveAdventure: (roomCode: string, characterId: string) => void;
  onAbandonAdventure: (roomCode: string) => void;
  onLogout: () => void;
  error?: string;
  onDismissError?: () => void;
};

/** Purely presentational. The selected Hero and all stats come from the live Character record. */
function TravelHeroFolio({ hero }: { hero: Character | undefined }) {
  if (!hero) return null;
  return <aside className="i656-travel-folio" aria-label={`Selected Hero: ${hero.name}`}>
    <span className="i656-travel-emblem" aria-hidden="true">✦</span>
    <div className="i656-travel-info">
      <p className="i656-eyebrow">Your companion through the pages</p>
      <strong>{hero.name}</strong>
      <span>Level {hero.level} · Health {hero.health}/{hero.max_health}</span>
    </div>
    <Link to={`/game/heroes/${encodeURIComponent(hero.character_id)}`}>View Hero folio <span aria-hidden="true">↗</span></Link>
  </aside>;
}

export function InkboundAuthenticatedDashboard({
  username, userId, isAuthor, isAdmin, connected, directoryReady,
  heroes, catalog, adventures, selectedHeroId, onSelectHero, onCreate, onJoin,
  onLeaveAdventure, onAbandonAdventure, onLogout, error, onDismissError,
}: InkboundDashboardProps) {
  const [page, setPage] = useState<Page>("home");
  const [paper] = useInkboundPaper(userId);
  const [needle, setNeedle] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [roomCode, setRoomCode] = useState("");
  const [selectedStory, setSelectedStory] = useState<AdventureCatalogItem | null>(null);
  const [exitJourney, setExitJourney] = useState<AdventureListItem | null>(null);
  const [mode, setMode] = useState<"solo" | "coop">("coop");
  const modalCloseRef = useRef<HTMLButtonElement>(null);
  const modalOpener = useRef<HTMLElement | null>(null);
  const active = adventures.filter((a) => !a.completed);
  const completedRooms = adventures.filter((a) => a.completed);
  const available = heroes.filter(usableHero);
  const occupied = new Set(active.map((a) => a.character_id));
  const freeHeroes = available.filter((hero) => !occupied.has(hero.character_id));
  const visibleCatalog = catalog.filter((item) => !HIDDEN_INTERNAL_ADVENTURES.has(item.adventure_id));
  const tags = ["ALL", ...Array.from(new Set(visibleCatalog.flatMap((item) => item.tags.map((tag) => tag.toUpperCase())))).sort()];
  const found = visibleCatalog.filter((item) => {
    if (filter !== "ALL" && !item.tags.some((tag) => tag.toUpperCase() === filter)) return false;
    const haystack = `${item.title} ${synopsis(item)} ${item.tags.join(" ")}`.toLowerCase();
    return haystack.includes(needle.trim().toLowerCase());
  });
  const primary = active[0];
  const selectedHero = freeHeroes.find((hero) => hero.character_id === selectedHeroId);
  const canEnter = Boolean(connected && selectedHero);
  // One Hero option list drives Discover, joining by room code, and synopsis.
  // Reuse the app's custom control; never reintroduce a browser-native dropdown.
  const heroOptions = [
    { value: "", label: "Choose your Hero" },
    ...freeHeroes.map((hero) => ({
      value: hero.character_id,
      label: `${hero.name} · Level ${hero.level}`,
    })),
  ];
  const filterOptions = tags.map((tag) => ({ value: tag, label: tag === "ALL" ? "All worlds" : tag }));

  // Match the rest of Quillairo's keyboard-friendly confirmation dialogs.
  useEffect(() => {
    if (!exitJourney) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setExitJourney(null); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [exitJourney]);

  useEffect(() => {
    if (!selectedStory) return;
    modalCloseRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setSelectedStory(null); modalOpener.current?.focus(); }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>(".i656-dialog");
      const focusable = Array.from(dialog?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href]") || []);
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedStory]);

  function inspect(item: AdventureCatalogItem) {
    modalOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMode("coop"); setSelectedStory(item);
  }
  function closeInspect() { setSelectedStory(null); modalOpener.current?.focus(); }
  function enterRoom(event: FormEvent) { event.preventDefault(); if (canEnter && roomCode.trim()) onJoin(roomCode.trim().toUpperCase()); }
  const navigation: { id: Page; label: string }[] = [
    { id: "home", label: "Home" }, { id: "worlds", label: "Discover" },
    { id: "heroes", label: "Heroes" }, { id: "journeys", label: "My stories" },
    { id: "join", label: "Join a friend" },
  ];
  return <div className="inkbound-home" data-ink-paper={paper}>
    <a href="#i656-main" className="i656-skip">Skip to your adventures</a>
    <div className="i656-sheet">
      <header className="i656-header">
        <button type="button" className="i656-wordmark" onClick={() => setPage("home")} aria-label="Quillairo home"><BrandLockup paper={paper} /></button>
        <nav className="i656-nav" aria-label="Library navigation">
          {navigation.map((item) => <button key={item.id} type="button" aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}>{item.label}</button>)}
        </nav>
        <div className="i656-header-tools">
          <Link to="/account" className="i656-account">{username} ↗</Link>
        </div>
      </header>
      {error && <div className="i656-error" role="alert">{error} {onDismissError && <button type="button" onClick={onDismissError}>Dismiss ×</button>}</div>}
      <main id="i656-main" className="i656-main">
        {page === "home" && <>
          <section className="i656-hero" aria-label="Your adventure library">
            <div className="i656-hero-copy">
              <p className="i656-eyebrow">A journal of impossible places</p>
              <h1>Every story<br/>starts <em>somewhere.</em></h1>
              <p className="i656-hero-lede">Welcome back, {username}. There are roads yet to wander, companions to find, and chapters still unwritten.</p>
              {primary ? <Link className="i656-primary-action" to={journeyHref(primary)}>{primary.director_retry_required ? "Recover your story" : "Continue your story"} <span aria-hidden="true">→</span></Link>
                : <button className="i656-primary-action" type="button" onClick={() => setPage("worlds")}>Enter the adventure hall <span aria-hidden="true">→</span></button>}
              <button type="button" className="i656-text-link" onClick={() => setPage("heroes")}>Your Heroes ↗</button>
              <div className="i656-hero-meta">{active.length ? `${active.length} open ${active.length === 1 ? "journey" : "journeys"}` : "A clean first page"}<span aria-hidden="true"> · </span>{available.length} living {available.length === 1 ? "Hero" : "Heroes"}</div>
              {completedRooms.length > 0 && <button type="button" className="i656-text-link" onClick={() => setPage("journeys")}>Finished journeys · Release a Hero ↗</button>}
            </div>
            <img className="i656-hero-ink" src={homeArt} alt="Two wanderers overlooking a ruined kingdom, painted in black ink and gray watercolor on transparent paper" />
          </section>
          <div className="i656-bookmark-rule" aria-hidden="true"><span>✧</span></div>
          <section className="i656-open-chapters" aria-label="Continue adventures">
            <div className="i656-section-heading"><div><p className="i656-eyebrow">Your unwritten pages</p><h2>Open chapters</h2></div><button className="i656-text-link" type="button" onClick={() => setPage("journeys")}>All adventures ↗</button></div>
            {active.length ? <div className="i656-chapter-list">{active.slice(0,3).map((item, index) => <Link key={`${item.room_code}:${item.character_id}`} to={journeyHref(item)} className="i656-chapter-entry"><span className="i656-entry-index">{String(index + 1).padStart(2,"0")}</span><span className="i656-entry-copy"><strong>{item.adventure_title}</strong><small>{item.scene_title || (item.director_retry_required ? "Story recovery required" : "The next page awaits")} · {item.character_name} · {item.play_mode === "coop" ? "Co-op" : "Solo"}</small></span><span className="i656-entry-side">{item.director_retry_required ? "Recover" : `Chapter ${Math.max(1,item.turn_number)}`} <b aria-hidden="true">↗</b></span></Link>)}</div> : <p className="i656-empty-line">No unfinished chapters yet. The first page is yours to write. <button type="button" onClick={() => setPage("worlds")}>Browse the worlds →</button></p>}
          </section>
          <section className="i656-hero-and-discovery">
            <div className="i656-personal-note"><p className="i656-eyebrow">Your traveling company</p><h2>The Hero Hall</h2>{available.slice(0,3).map((hero) => <div className="i656-person" key={hero.character_id}><span aria-hidden="true" className="i656-person-glyph">✧</span><div><Link to={`/game/heroes/${encodeURIComponent(hero.character_id)}`}>{hero.name}</Link><small>Level {hero.level} · {occupied.has(hero.character_id) ? "On a journey" : "Ready"}</small></div></div>)}{!available.length && <p className="i656-muted">Every story needs someone to live it.</p>}<Link className="i656-text-link" to="/game/heroes">Meet your Heroes ↗</Link></div>
            <div className="i656-discovery-note"><p className="i656-eyebrow">An atlas of possibilities</p><h2>Somewhere new awaits.</h2><p>Fantasy, mystery, faraway futures—each world begins with a choice. Pick a setting and invite someone along.</p><button className="i656-text-link" type="button" onClick={() => setPage("worlds")}>Discover stories →</button></div>
          </section>
        </>}
        {page === "worlds" && <section className="i656-interior q55-atlas" aria-label="Discover adventures"><div className="i656-interior-intro"><p className="i656-eyebrow">The adventure atlas</p><h1>Choose a world<br/><em>to get lost in.</em></h1><p>Every cover is an invitation. The story inside is never quite the same twice.</p></div>
          <div className="i656-library-tools">
            <label>Search the atlas<input type="search" value={needle} onChange={(event) => setNeedle(event.target.value)} placeholder="Title, setting, or a whisper…" /></label>
            <div className="i656-choice-field"><span className="i656-field-label">Find your kind of story</span>
              <TerminalSelect className="i656-select" ariaLabel="Find your kind of story" value={filter} onChange={setFilter} options={filterOptions} />
            </div>
            <div className="i656-choice-field"><span className="i656-field-label">Enter as</span>
              <TerminalSelect className="i656-select" ariaLabel="Hero used to start an adventure" value={selectedHeroId} onChange={onSelectHero} options={heroOptions} disabled={!freeHeroes.length} />
            </div>
          </div>
          <div className="q55-atlas-status" aria-live="polite" aria-atomic="true">
            <p>{directoryReady ? `${found.length} ${found.length === 1 ? "world" : "worlds"} ${needle.trim() || filter !== "ALL" ? "match your search" : "available"}` : "Loading the world atlas…"}</p>
            {(needle.trim() || filter !== "ALL") && <button type="button" onClick={() => { setNeedle(""); setFilter("ALL"); }}>Clear filters</button>}
          </div>
          <TravelHeroFolio hero={selectedHero} />
          {!freeHeroes.length && <p className="i656-availability-note">{available.length ? "Your living Heroes are already in adventures. Resume a story, or create another Hero." : "Create a living Hero before starting a new adventure."} <Link to="/game/heroes/new">Create a Hero →</Link></p>}
          <div className="i656-worlds-list">{found.map((item) => <article className="i656-world" key={item.adventure_id}><button className="i656-world-cover" type="button" onClick={() => inspect(item)} aria-label={`Read ${item.title} synopsis`}><img src={storyCover(item.title,item.tags,item.metadata)} onError={event => nextCoverSource(event.currentTarget,item.title,item.tags,item.metadata)} alt={`Illustrated cover for ${item.title}`} loading="lazy"/></button><div><p className="i656-eyebrow">{item.tags.slice(0,2).join(" · ") || "Adventure"}</p><h2>{item.title}</h2><p>{synopsis(item)}</p><button type="button" className="i656-text-link" onClick={() => inspect(item)}>Read the introduction ↗</button></div></article>)}</div>
          {directoryReady && !found.length && <div className="q55-atlas-empty" role="status"><h2>No worlds found.</h2><p>Try a different title or genre.</p>{(needle.trim() || filter !== "ALL") && <button type="button" onClick={() => { setNeedle(""); setFilter("ALL"); }}>Show all worlds →</button>}</div>}{!directoryReady && <p className="i656-empty-line" role="status">The atlas is being prepared…</p>}
        </section>}
        {page === "heroes" && <section className="i656-interior i656-heroes" aria-label="Hero Hall"><div className="i656-interior-intro"><p className="i656-eyebrow">Portraits of the living</p><h1>Every Hero<br/><em>has a history.</em></h1><p>Some are still writing theirs.</p><Link className="i656-primary-action" to="/game/heroes/new">Create a Hero →</Link></div>
          <div className="i656-records">{heroes.map((hero, index) => <article key={hero.character_id} className="i656-hero-record"><span className="i656-entry-index">{String(index+1).padStart(2,"0")}</span><div><h2>{hero.name}</h2><p>{hero.bio || "An unwritten past."}</p><small>Level {hero.level} · HP {hero.health}/{hero.max_health} · {hero.is_alive ? hero.hero_status : "Fallen"}</small></div><div className="i656-record-actions">{usableHero(hero) && !occupied.has(hero.character_id) && <button type="button" aria-pressed={selectedHeroId === hero.character_id} onClick={() => onSelectHero(hero.character_id)}>{selectedHeroId === hero.character_id ? "Selected ✓" : "Choose Hero"}</button>}<Link to={`/game/heroes/${encodeURIComponent(hero.character_id)}`}>Character folio ↗</Link></div></article>)}{!heroes.length && <p className="i656-empty-line">No Heroes have entered your story yet.</p>}</div><Link className="i656-text-link" to="/game/graveyard">Visit the Graveyard ↗</Link></section>}
        {page === "journeys" && <section className="i656-interior" aria-label="My adventures">
          <div className="i656-interior-intro"><p className="i656-eyebrow">The story so far</p><h1>Journeys, open<br/><em>and remembered.</em></h1><p>Release a Hero from a finished room to use them again. Your sealed Chronicle is preserved.</p></div>
          <div className="i656-chapter-list">
            {adventures.map((item, index) => <article key={`${item.room_code}:${item.character_id}`} className="i656-journey-with-actions">
              <Link to={journeyHref(item)} className="i656-chapter-entry"><span className="i656-entry-index">{String(index + 1).padStart(2, "0")}</span><span className="i656-entry-copy"><strong>{item.adventure_title}</strong><small>{item.character_name} · {item.scene_title || "A story in progress"}</small></span><span className="i656-entry-side">{item.completed ? "Finished" : item.director_retry_required ? "Needs recovery" : `Chapter ${Math.max(1,item.turn_number)}`} ↗</span></Link>
              <div className="i656-journey-actions">
                <button type="button" disabled={!connected} onClick={() => setExitJourney(item)}>{item.completed ? "Release Hero" : "Exit this adventure"}</button>
                {item.completed && <Link to="/game/history">Sealed Chronicle ↗</Link>}
              </div>
            </article>)}
            {!adventures.length && <p className="i656-empty-line">Your journal has no chapters yet.</p>}
          </div>
          <Link className="i656-text-link" to="/game/adventures">Full adventure archive ↗</Link>
        </section>}
        {page === "join" && <section className="i656-interior i656-join" aria-label="Join a friend"><div className="i656-interior-intro"><p className="i656-eyebrow">Two perspectives · One story</p><h1>Better with<br/><em>someone beside you.</em></h1><p>Ask your companion for their six-character room code. Choose your Hero, then step into the same adventure.</p></div><form className="i656-join-form" onSubmit={enterRoom}><div className="i656-choice-field"><span className="i656-field-label">Your Hero</span><TerminalSelect className="i656-select" ariaLabel="Hero used to join the adventure" value={selectedHeroId} onChange={onSelectHero} options={heroOptions} disabled={!freeHeroes.length}/></div><label>Room code<input value={roomCode} onChange={(event) => setRoomCode(event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0,6))} placeholder="ABC123" maxLength={6} autoComplete="off" /></label><button className="i656-primary-action" type="submit" disabled={!canEnter || roomCode.length !== 6}>Join the adventure →</button>{!connected && <p className="i656-muted">Waiting for a connection to the game server.</p>}</form></section>}
      </main>
      <footer className="i656-footer"><span>✧ &nbsp; Some stories are better shared.</span><nav aria-label="More game pages"><Link to="/game/arcade">Arcade</Link><Link to="/game/rulebook">Rulebook</Link>{isAuthor && <a href="/author-console">Create</a>}{isAdmin && <Link to="/admin">Admin</Link>}<Link to="/account?tab=preferences#inkbound-paper">Paper &amp; Ink</Link><Link to="/account">Account</Link><button type="button" onClick={onLogout}>Sign out</button></nav></footer>
    </div>
    {exitJourney && <div className="i656-veil" onMouseDown={(event) => { if (event.target === event.currentTarget) setExitJourney(null); }}>
      <section className="i656-dialog" role="dialog" aria-modal="true" aria-labelledby="i656-exit-title">
        <p className="i656-eyebrow">Adventure Hall</p><h2 id="i656-exit-title">{exitJourney.completed ? "Release your Hero?" : "Leave this unfinished adventure?"}</h2>
        <p>{exitJourney.completed ? "The adventure has ended. Releasing your Hero clears the old room membership without deleting your Hero or their completed Chronicle." : exitJourney.is_host ? "This will abandon the unfinished adventure and preserve its abandoned record. Your Hero remains available." : "You will leave this active party. The remaining companion may continue, and your Hero becomes available."}</p>
        <p className="i656-muted">{exitJourney.adventure_title} · {exitJourney.character_name}</p>
        <div className="i656-dialog-actions"><button type="button" onClick={() => setExitJourney(null)}>Keep this room</button>
          <button className="i656-primary-action" type="button" disabled={!connected} onClick={() => {
            if (exitJourney.completed || !exitJourney.is_host) onLeaveAdventure(exitJourney.room_code, exitJourney.character_id);
            else onAbandonAdventure(exitJourney.room_code);
            setExitJourney(null);
          }}>{exitJourney.completed ? "Release Hero →" : "Leave adventure →"}</button>
        </div>
      </section>
    </div>}
    {selectedStory && <div className="i656-veil" onMouseDown={(event) => { if(event.target===event.currentTarget) closeInspect(); }}><section className="i656-dialog" role="dialog" aria-modal="true" aria-labelledby="i656-story-title"><div className="i656-dialog-head"><p className="i656-eyebrow">Before the first chapter</p><button ref={modalCloseRef} type="button" onClick={closeInspect} aria-label="Close story introduction">×</button></div><h2 id="i656-story-title">{selectedStory.title}</h2><p>{synopsis(selectedStory)}</p><fieldset className="i656-mode"><legend>How will you travel?</legend><label><input type="radio" name="i656-mode" checked={mode==="solo"} onChange={() => setMode("solo")}/> On my own</label><label><input type="radio" name="i656-mode" checked={mode==="coop"} onChange={() => setMode("coop")}/> With a companion</label></fieldset><div className="i656-dialog-hero i656-choice-field"><span className="i656-field-label">Your Hero</span><TerminalSelect className="i656-select" ariaLabel="Hero used to enter the lobby" value={selectedHeroId} onChange={onSelectHero} options={heroOptions} disabled={!freeHeroes.length}/></div><TravelHeroFolio hero={selectedHero} /><p className="i656-muted">{mode === "coop" ? "You will enter a co-op lobby. Invite your friend and begin only when both players are ready." : "You will enter the solo lobby, then choose when to begin Chapter One."}</p><div className="i656-dialog-actions"><button type="button" onClick={closeInspect}>Not yet</button><button className="i656-primary-action" type="button" disabled={!canEnter} onClick={() => { onCreate(selectedStory,mode); closeInspect(); }}>Enter the lobby →</button></div></section></div>}
  </div>;
}
