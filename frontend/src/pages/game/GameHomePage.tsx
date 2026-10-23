import { genreInkIllustration, coverCandidateIds, coverArtUrl } from "../../features/appearance/quillairoGenreArt";
import "./gameHomePass64.css";
import { InkboundAuthenticatedDashboard } from "./InkboundAuthenticatedDashboard";
import "./deskFidelityPass64.css";
import "./deskScrapbookPass64.css";
import "./gameBrighterWorld.css";
import "./livingBook644.css";
import "./livingBook644Fidelity.css";
import "./livingBook644Ink.css";
import "./inkspaceAuthenticatedHome.css";
import { InkspaceAuthenticatedHome } from "./InkspaceAuthenticatedHome";
import "../../features/appearance/themeEditions.css";
import { useAppearance } from "../../features/appearance/AppearanceContext";
import { FirstRunGuide } from "../../features/onboarding/FirstRunGuide";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Panel } from "../../components/ui/Panel";
import { TerminalSelect } from "../../components/ui/TerminalSelect";
import { RoomInviteButton } from "../../components/game/RoomInviteButton";
import { listCharacters, type Character } from "../../services/characters";
import type {
  AdventureCatalogItem,
  AdventureListItem,
} from "../../services/game";
import { rememberGameRoute } from "../../services/gameRouteMemory";
import { useAuth } from "../../state/AuthContext";
import { useGameSocket } from "../../state/GameSocketContext";

function p64Cover(title: string, tags: string[] = [], metadata: Record<string, unknown> = {}) {
  const candidates = coverCandidateIds(metadata);
  return candidates.length ? coverArtUrl(candidates[0]) : genreInkIllustration(title,tags);
}
function fallbackCover(img: HTMLImageElement, title: string, tags: string[] = [], metadata: Record<string, unknown> = {}) {
  const candidates = coverCandidateIds(metadata).map(coverArtUrl);
  const current = new URL(img.src, window.location.href).pathname;
  const index = candidates.indexOf(current);
  const next = index >= 0 && index + 1 < candidates.length ? candidates[index + 1] : genreInkIllustration(title,tags);
  if (next !== current) img.src = next;
}

const HIDDEN_INTERNAL_ADVENTURES = new Set([
  "old_chapel",
  "windroad_lantern",
]);

function generatedSynopsis(adventure: AdventureCatalogItem) {
  const candidate = adventure.metadata?.player_synopsis;

  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }

  return adventure.description;
}

function journeyState(adventure: AdventureListItem) {
  if (adventure.completed) return "SEALED";
  if (adventure.director_request_active) return "DIRECTOR WORKING";
  if (adventure.director_retry_required) return "RECOVERY REQUIRED";
  if (adventure.turn_pending) return "TURN FROZEN";
  return "READY";
}

function advancementTotal(hero: Character) {
  return (
    hero.unspent_stat_points +
    hero.unspent_skill_points +
    hero.unspent_talent_points
  );
}

export function LivingBookHomeLabPage() {
  return <GameHomePage homeLab />;
}

export function GameHomePage({ homeLab = false }: { homeLab?: boolean } = {}) {
  const navigate = useNavigate();
  const { preferences } = useAppearance();
  const { user, logout } = useAuth();
  const canAuthor = user?.permissions.includes("author") ?? false;
  const isAdmin = user?.permissions.includes("admin") ?? false;

  const {
    connected,
    catalog,
    adventures,
    directoryReady,
    latestError,
    clearError,
    refreshCatalog,
    createRoom,
    joinRoom,
    leaveAdventure,
    abandonAdventure,
    lastRoomEntry,
    clearRoomEntry,
  } = useGameSocket();

  const [starterCreating, setStarterCreating] = useState(false);
  const [bookSpread, setBookSpread] = useState<"home" | "heroes" | "journeys" | "discover" | "wardrobe" | "tools">("home");
  const [inkLeaving, setInkLeaving] = useState(false);
  const inkTimeout = useRef<number | null>(null);
  useEffect(() => () => { if (inkTimeout.current !== null) window.clearTimeout(inkTimeout.current); }, []);
  function openBookSpread(next: typeof bookSpread) {
    if (next === bookSpread || inkLeaving) return;
    if (preferences.reducedMotion) { setBookSpread(next); return; }
    setInkLeaving(true);
    inkTimeout.current = window.setTimeout(() => { setBookSpread(next); setInkLeaving(false); inkTimeout.current = null; }, 120);
  }

  // The scene, paper and binding stay mounted; only this manuscript layer is replaced.
  // Route-independent navigation is already an SPA; no image-backed menu is required.
  const spreadLabel = {home: "Home", heroes: "Heroes", journeys: "Journeys", discover: "Discover", wardrobe: "Wardrobe", tools: "More"}[bookSpread];

  const [heroes, setHeroes] = useState<Character[]>([]);
  const [heroError, setHeroError] = useState("");
  const [selectedHeroId, setSelectedHeroId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState("ALL");
  const [pendingAdventure, setPendingAdventure] = useState<AdventureCatalogItem | null>(null);
  const [pendingPlayMode, setPendingPlayMode] = useState<"solo" | "coop">("solo");
  const [pendingJourneyExit, setPendingJourneyExit] = useState<{
    adventure: AdventureListItem;
    mode: "leave" | "abandon";
  } | null>(null);

  useEffect(() => {
    rememberGameRoute("/game");
    refreshCatalog();

    const refreshOnFocus = () => refreshCatalog();
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [refreshCatalog]);

  useEffect(() => {
    let alive = true;

    listCharacters()
      .then((response) => {
        if (!alive) return;
        setHeroes(response.characters);
      })
      .catch((reason) => {
        if (!alive) return;
        setHeroError(
          reason instanceof Error
            ? reason.message
            : "Unable to summon the Hero roster.",
        );
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!starterCreating) return;
    const timeout = window.setTimeout(() => setStarterCreating(false), 15000);
    return () => window.clearTimeout(timeout);
  }, [starterCreating]);

  useEffect(() => {
    if (latestError || !connected) setStarterCreating(false);
  }, [latestError, connected]);

  useEffect(() => {
    if (!lastRoomEntry) return;

    const code = lastRoomEntry.room.code;
    const characterId = lastRoomEntry.character_id;

    clearRoomEntry();

    navigate(
      `/game/adventure/${encodeURIComponent(code)}?hero=${encodeURIComponent(characterId)}`,
    );
  }, [lastRoomEntry, clearRoomEntry, navigate]);

  const occupiedHeroIds = useMemo(
    () => new Set(adventures.filter((item) => !item.completed).map((item) => item.character_id)),
    [adventures],
  );

  // All hero-picker entry points must agree: no fallen, buried or retired Hero.
  const playableHeroes = useMemo(
    () => heroes.filter((hero) => hero.is_alive && hero.hero_status === "active"),
    [heroes],
  );
  const selectableHeroes = useMemo(
    () => playableHeroes.filter((hero) => !occupiedHeroIds.has(hero.character_id)),
    [playableHeroes, occupiedHeroIds],
  );

  useEffect(() => {
    if (
      selectedHeroId &&
      selectableHeroes.some((hero) => hero.character_id === selectedHeroId)
    ) {
      return;
    }

    setSelectedHeroId(selectableHeroes[0]?.character_id ?? "");
  }, [selectedHeroId, selectableHeroes]);

  const visibleCatalog = useMemo(
    () => catalog.filter(
      (adventure) => !HIDDEN_INTERNAL_ADVENTURES.has(adventure.adventure_id),
    ),
    [catalog],
  );

  const catalogTags = useMemo(() => {
    const tags = new Set<string>();
    visibleCatalog.forEach((adventure) => {
      adventure.tags.forEach((tag) => tags.add(tag.toUpperCase()));
    });
    return ["ALL", ...Array.from(tags).sort()];
  }, [visibleCatalog]);

  const filteredCatalog = useMemo(() => {
    const needle = catalogSearch.trim().toLowerCase();

    return visibleCatalog.filter((adventure) => {
      const matchesTag = selectedTag === "ALL" || adventure.tags.some(
        (tag) => tag.toUpperCase() === selectedTag,
      );

      if (!matchesTag) return false;
      if (!needle) return true;

      const haystack = [
        adventure.title,
        adventure.description,
        generatedSynopsis(adventure),
        ...adventure.tags,
      ].join(" ").toLowerCase();

      return haystack.includes(needle);
    });
  }, [visibleCatalog, catalogSearch, selectedTag]);

  const selectedHero = heroes.find(
    (hero) => hero.character_id === selectedHeroId,
  ) ?? null;

  const primaryJourney = adventures.find((adventure) => !adventure.completed) ?? null;

  function inspectAdventure(adventure: AdventureCatalogItem) {
    if (!selectedHeroId) return;
    setPendingPlayMode("solo");
    setPendingAdventure(adventure);
  }

  function beginPendingAdventure() {
    if (!selectedHeroId || !pendingAdventure) return;

    const adventureId = pendingAdventure.adventure_id;
    setPendingAdventure(null);
    createRoom(selectedHeroId, adventureId, pendingPlayMode);
  }

  function joinExistingRoom() {
    if (!selectedHeroId || !roomCode.trim()) return;
    joinRoom(selectedHeroId, roomCode);
  }

  function confirmJourneyExit() {
    if (!pendingJourneyExit) return;

    const { adventure, mode } = pendingJourneyExit;
    setPendingJourneyExit(null);

    if (mode === "abandon") {
      abandonAdventure(adventure.room_code);
      return;
    }

    leaveAdventure(adventure.room_code, adventure.character_id);
  }

  // Production home uses the real Inkbound dashboard. The legacy book remains
  // available only in the protected development workshop while we verify the
  // rest of the game's visual conversion. Both use the same authoritative data.
  if (!homeLab) return (
    <InkboundAuthenticatedDashboard
      username={user?.username ?? "Adventurer"}
      userId={user?.user_id ?? ""}
      isAuthor={canAuthor}
      isAdmin={isAdmin}
      connected={connected}
      directoryReady={directoryReady}
      heroes={heroes}
      catalog={catalog}
      adventures={adventures}
      selectedHeroId={selectedHeroId}
      onSelectHero={setSelectedHeroId}
      onCreate={(item, mode) => {
        // Use the established game socket creation contract directly;
        // navigation still happens through lastRoomEntry.
        if (selectedHeroId) createRoom(selectedHeroId, item.adventure_id, mode);
      }}
      onJoin={(code) => { if (selectedHeroId) joinRoom(selectedHeroId, code); }}
      onLogout={() => { void logout(); }}
      error={latestError || heroError}
      onDismissError={latestError ? clearError : undefined}
    />
  );

  return (
    <div className="p64-desk" data-home-lab={homeLab ? "true" : undefined} data-platform-skin={preferences.platformSkin} data-reduced-motion={preferences.reducedMotion}>
      <div className="p644-scene">
      {(latestError || heroError) ? (
        <div className="form-error p644-error" role="alert">
          {latestError || heroError}
          {latestError ? <button className="inline-dismiss" type="button" onClick={clearError}>DISMISS</button> : null}
        </div>
      ) : null}
      <header className="p644-topbar">
        <button className="p644-wordmark" onClick={() => openBookSpread("home")} type="button" aria-label="Quillairo Home"><span className="p644-emblem" aria-hidden="true">✧</span><span><strong>QUILLAIRO</strong><small>A LIBRARY OF POSSIBILITIES</small></span></button>
        <nav className="p644-toplinks" aria-label="Book navigation">
          <button type="button" aria-current={bookSpread === "home" ? "page" : undefined} onClick={() => openBookSpread("home")}>HOME</button>
          <button type="button" aria-current={bookSpread === "heroes" ? "page" : undefined} onClick={() => openBookSpread("heroes")}>HEROES</button>
          <button type="button" aria-current={bookSpread === "wardrobe" ? "page" : undefined} onClick={() => openBookSpread("wardrobe")}>WARDROBE</button>
          <button type="button" aria-current={bookSpread === "journeys" ? "page" : undefined} onClick={() => openBookSpread("journeys")}>MY ADVENTURES</button>
          <button type="button" aria-current={bookSpread === "discover" ? "page" : undefined} onClick={() => openBookSpread("discover")}>DISCOVER</button>
          <button type="button" aria-current={bookSpread === "tools" ? "page" : undefined} onClick={() => openBookSpread("tools")}>SYSTEM</button>
        </nav>
        <Link to="/account" className="p644-player-tag">{user?.username ?? "PLAYER"} <span aria-hidden="true">⌄</span></Link>
      </header>
      <nav className="p644-bookmarks" aria-label="Journal sections">
        <button type="button" aria-current={bookSpread === "home" ? "page" : undefined} onClick={() => openBookSpread("home")}><span aria-hidden="true">✧</span>Home</button>
        <button type="button" aria-current={bookSpread === "journeys" ? "page" : undefined} onClick={() => openBookSpread("journeys")}><span aria-hidden="true">⚑</span>Journeys</button>
        <button type="button" aria-current={bookSpread === "heroes" ? "page" : undefined} onClick={() => openBookSpread("heroes")}><span aria-hidden="true">♟</span>Heroes</button>
        <button type="button" aria-current={bookSpread === "discover" ? "page" : undefined} onClick={() => openBookSpread("discover")}><span aria-hidden="true">⌖</span>Discover</button>
        <button type="button" aria-current={bookSpread === "wardrobe" ? "page" : undefined} onClick={() => openBookSpread("wardrobe")}><span aria-hidden="true">✦</span>Wardrobe</button>
        <button type="button" aria-current={bookSpread === "tools" ? "page" : undefined} onClick={() => openBookSpread("tools")}><span aria-hidden="true">☷</span>More</button>
      </nav>
      <div className="p64n-scene-plane">
      <div className="p644-bound-book" aria-label="Living adventure book">
        <div className="p644-pages p644-spread-content">
          <div className="p644-paper-leaf p644-paper-leaf-left" aria-hidden="true" />
          <div className="p644-paper-leaf p644-paper-leaf-right" aria-hidden="true" />
          <div className="p644-ink-layer" key={bookSpread} data-ink-leaving={inkLeaving}>
          {bookSpread === "home" ? (
            homeLab ? (
              <InkspaceAuthenticatedHome
                username={user?.username ?? "Adventurer"} connected={connected} directoryReady={directoryReady}
                heroes={heroes} playableHeroes={playableHeroes} selectedHeroId={selectedHeroId}
                occupiedHeroIds={occupiedHeroIds} adventures={adventures} catalog={visibleCatalog}
                onChooseHero={setSelectedHeroId} onNavigate={openBookSpread}
                onInspectAdventure={inspectAdventure}
              />
            ) : <>
              <section className="p644-page p644-page-left p644-home-left" aria-label="Featured story">
                <div className="p644-home-heading"><span className="p644-ink-star" aria-hidden="true">✧</span><h1>Welcome back,<br/><em>troublemaker.</em></h1><p>The worlds have been behaving suspiciously well without you.</p></div>
                <div className="p644-watercolor-plate" role="img" aria-label="Watercolor view across a sunlit fantasy coast" />
                <div className="p644-journey-note" aria-label="Continue your adventure">
                  <span className="p644-eyebrow">✧ CONTINUE YOUR JOURNEY</span>
                  {primaryJourney ? <><h2>{primaryJourney.adventure_title}</h2><p>Chapter {primaryJourney.turn_number} · {primaryJourney.scene_title || journeyState(primaryJourney)}</p><Link className="p644-primary-button" to={`/game/adventure/${encodeURIComponent(primaryJourney.room_code)}?hero=${encodeURIComponent(primaryJourney.character_id)}`}>{primaryJourney.director_retry_required ? "Recover your story" : "Return to your story"} <span aria-hidden="true">↗</span></Link></> : <><h2>Something wonderful awaits.</h2><p>Or at least something interesting. Shall we find out?</p><button type="button" className="p644-primary-button" onClick={() => openBookSpread("discover")}>Explore adventures ↗</button></>}
                </div>
              </section>
              <section className="p644-page p644-page-right p644-home-right" aria-label="Heroes and adventures">
                <div className="p644-section-caption"><span>✧ YOUR HEROES</span><button type="button" onClick={() => openBookSpread("heroes")}>View all →</button></div>
                <div className="p644-featured-heroes">
                  {playableHeroes.slice(0, 2).map((hero) => <div key={hero.character_id} className="p644-mini-hero"><button type="button" title={`Play as ${hero.name}`} aria-label={`Select ${hero.name} as your Hero`} className={`p644-painted-portrait ${selectedHeroId === hero.character_id ? "is-selected" : ""}`} onClick={() => !occupiedHeroIds.has(hero.character_id) && setSelectedHeroId(hero.character_id)} disabled={occupiedHeroIds.has(hero.character_id)}><span>{hero.name.slice(0,1)}</span></button><Link to={`/game/heroes/${encodeURIComponent(hero.character_id)}`}>{hero.name} ↗</Link><small>Level {hero.level} · {occupiedHeroIds.has(hero.character_id) ? "In a story" : selectedHeroId === hero.character_id ? "Selected" : "Available"}</small></div>)}
                  {playableHeroes.length === 0 ? <Link className="p644-empty-inline" to="/game/heroes/new">Meet your first Hero →</Link> : null}
                </div>
                <div className="p644-section-caption"><span>✧ RECENT ADVENTURES</span><button type="button" onClick={() => openBookSpread("journeys")}>View all →</button></div>
                <div className="p644-postcard-strip">
                  {adventures.slice(0, 3).map((a) => <Link className="p644-story-postcard" key={`${a.room_code}:${a.character_id}`} to={`/game/adventure/${encodeURIComponent(a.room_code)}?hero=${encodeURIComponent(a.character_id)}`}><img alt={`Illustrated cover for ${a.adventure_title}`} src={p64Cover(a.adventure_title)} loading="lazy"/><strong>{a.adventure_title}</strong><small>{a.completed ? "Finished" : `Chapter ${a.turn_number}`}</small></Link>)}
                  {adventures.length === 0 ? visibleCatalog.slice(0,3).map((a) => <button type="button" className="p644-story-postcard" key={a.adventure_id} onClick={() => { openBookSpread("discover"); setCatalogSearch(a.title); }}><img src={p64Cover(a.title, a.tags, a.metadata)} onError={event => { fallbackCover(event.currentTarget, a.title, a.tags, a.metadata); }} alt={`Illustrated cover for ${a.title}`} loading="lazy"/><strong>{a.title}</strong><small>Ready to begin</small></button>) : null}
                </div>
                <div className="p644-section-caption"><span>✧ DISCOVER NEW WORLDS</span><button type="button" onClick={() => openBookSpread("discover")}>Browse all →</button></div>
                <button className="p644-discover-note" type="button" onClick={() => openBookSpread("discover")}><span className="p644-small-landscape" aria-hidden="true"/><span><strong>New adventures await</strong><small>Strange places. Braver choices. Better company.</small><b>Explore the Library ↗</b></span></button>
                {playableHeroes.length === 0 ? (
                  <div className="p644-newcomer-guide">
                    <FirstRunGuide
                      heroes={selectableHeroes}
                      selectedHeroId={selectedHeroId}
                      onSelectHero={setSelectedHeroId}
                      connected={connected}
                      starterAvailable={catalog.some(adventure => adventure.adventure_id === "first_light")}
                      creating={starterCreating}
                      onStart={mode => { clearError(); setStarterCreating(true); createRoom(selectedHeroId, "first_light", mode); }}
                    />
                  </div>
                ) : null}
                <button className="p644-pinned-note" type="button" onClick={() => openBookSpread("tools")}>Good stories find good people. <span aria-hidden="true">✧</span></button>
              </section>
            </>
          ) : null}
          {bookSpread === "journeys" ? <>
            <section className="p644-page p644-page-left p644-interior-page p644-inner-scroll" aria-label="Active journeys"><div className="p644-spread-heading"><span className="p644-eyebrow">THE CHRONICLES</span><h1>Your unfinished business.</h1><p>It followed you home. Every last questionable decision.</p></div><div className="dashboard-command-grid">
        <Panel title="CONTINUE JOURNEY" className="dashboard-journey-panel">
          {!directoryReady ? (
            <p className="muted-copy">CONSULTING THE ARCHIVE_</p>
          ) : null}

          {directoryReady && adventures.length === 0 ? (
            <div className="dashboard-empty-callout">
              <span className="eyebrow">NO ACTIVE THREAD</span>
              <strong>YOU ARE BETWEEN BAD DECISIONS.</strong>
              <p>Pick an adventure below or join somebody else's room.</p>
            </div>
          ) : null}

          <div className="journey-list dashboard-journey-list">
            {adventures.map((adventure) => (
              <article
                className={`journey-row dashboard-journey-row ${adventure.director_retry_required ? "needs-recovery" : ""}`}
                key={`${adventure.room_code}:${adventure.character_id}`}
              >
                <Link
                  className="journey-row-main"
                  to={`/game/adventure/${encodeURIComponent(adventure.room_code)}?hero=${encodeURIComponent(adventure.character_id)}`}
                >
                  <div>
                    <span className="eyebrow">
                      {adventure.completed
                        ? "SEALED CHRONICLE"
                        : `TURN ${adventure.turn_number} // ${journeyState(adventure)}`}
                    </span>
                    <strong>{adventure.adventure_title}</strong>
                    <small>{adventure.scene_title}</small>
                  </div>

                  <div className="journey-row-meta">
                    <span>{adventure.character_name}</span>
                    <span>{adventure.play_mode.toUpperCase()} // {adventure.online_count}/{adventure.player_count} ONLINE</span>
                    <span>ROOM {adventure.room_code}</span>
                  </div>
                </Link>

                {!adventure.completed ? (
                  <div className="journey-row-actions">
                    <Link
                      className="button button-primary"
                      to={`/game/adventure/${encodeURIComponent(adventure.room_code)}?hero=${encodeURIComponent(adventure.character_id)}`}
                    >
                      {adventure.director_retry_required ? "RECOVER" : "RESUME"}
                    </Link>
                    {adventure.is_host && adventure.play_mode === "coop" && adventure.player_count < adventure.max_players ? (
                      <RoomInviteButton
                        roomCode={adventure.room_code}
                        adventureTitle={adventure.adventure_title}
                        className="button"
                        label="INVITE"
                      />
                    ) : null}
                    <button
                      className="button journey-danger-button"
                      type="button"
                      disabled={!connected}
                      onClick={() => setPendingJourneyExit({
                        adventure,
                        mode: adventure.is_host ? "abandon" : "leave",
                      })}
                    >
                      {adventure.is_host ? "ABANDON" : "LEAVE"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </Panel>


</div></section>
            <section className="p644-page p644-page-right p644-interior-page p644-inner-scroll" aria-label="Join a friend"><div className="p644-spread-heading"><span className="p644-eyebrow">IN GOOD COMPANY</span><h1>Bring a friend.</h1><p>Even heroes need someone to blame the dice on.</p></div><div className="dashboard-command-grid">
        <Panel title="JOIN A FRIEND" className="dashboard-join-panel">
          <div className="join-room-form dashboard-join-form">
            <label>
              <span>ENTER AS</span>
              <TerminalSelect
                value={selectedHeroId}
                onChange={setSelectedHeroId}
                disabled={selectableHeroes.length === 0}
                ariaLabel="Hero used to join the room"
                options={selectableHeroes.map((hero) => ({
                  value: hero.character_id,
                  label: `${hero.name} // LVL ${hero.level}`,
                }))}
              />
            </label>

            <label>
              <span>ROOM CODE</span>
              <input
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABC123"
              />
            </label>

            <button
              className="button button-primary"
              type="button"
              disabled={!connected || !selectedHeroId || !roomCode.trim()}
              onClick={joinExistingRoom}
            >
              ENTER THE THREAD
            </button>
          </div>
        </Panel>
      

</div><div className="p644-small-scene" aria-hidden="true" /></section>
          </> : null}
          {bookSpread === "heroes" ? <>
            <section className="p644-page p644-page-left p644-interior-page p644-inner-scroll" aria-label="Hero Hall"><div className="p644-spread-heading"><span className="p644-eyebrow">THE HERO HALL</span><h1>Meet the legends.</h1><p>Most of them are still working on the legendary part.</p></div>
            <section className="dashboard-hero-browser">
        <div className="dashboard-section-header">
          <div>
            <span className="eyebrow">YOUR HEROES</span>
            <h2>WHO ARE YOU BRINGING?</h2>
            <p>Your selected Hero is used for new adventures and room invites.</p>
          </div>
          <Link className="button" to="/game/heroes">MANAGE HEROES</Link>
        </div>

        {heroes.length === 0 && !heroError ? (
          <div className="dashboard-empty-callout">
            <strong>NO HEROES YET.</strong>
            <Link className="button button-primary" to="/game/heroes/new">CREATE YOUR FIRST HERO</Link>
          </div>
        ) : null}

        {heroes.length > playableHeroes.length ? (
          <p className="muted-copy">
            Fallen and archived Heroes are preserved in the <Link to="/game/heroes">HERO HALL</Link>,
            not selectable for new adventures. <Link to="/game/graveyard">VISIT THE GRAVEYARD →</Link>
          </p>
        ) : null}
        <div className="dashboard-hero-stack dashboard-hero-grid">
          {playableHeroes.slice(0, 4).map((hero) => {
            const busy = occupiedHeroIds.has(hero.character_id);
            const points = advancementTotal(hero);
            const selected = hero.character_id === selectedHeroId;

            return (
              <article className={`dashboard-hero-card p64b-portrait ${selected ? "is-selected" : ""}`} key={hero.character_id}>
                <span className="p64-hero-medallion" aria-hidden="true">{hero.name.slice(0, 1)}</span>
                <div className="dashboard-hero-copy">
                  <span className="eyebrow">
                    LVL {hero.level} // {!hero.is_alive ? "FALLEN" : hero.hero_status === "retired" ? "RETIRED" : hero.hero_status === "buried" ? "LAID TO REST" : busy ? "IN JOURNEY" : selected ? "SELECTED" : "AVAILABLE"}
                  </span>
                  <strong>{hero.name}</strong>
                  <p>{hero.bio || "No background written yet."}</p>
                </div>
                <div className="dashboard-hero-vitals">
                  <span>HP {hero.health}/{hero.max_health}</span>
                  {hero.health > 0 && hero.health < hero.max_health && !busy ? (
                    <span title="Passive recovery while not in an adventure">REST +{Math.max(1, Math.ceil(hero.max_health * 0.1))} HP/H</span>
                  ) : null}
                  <span>XP {Math.round(hero.xp_progress_percent)}%</span>
                  {points > 0 ? <b>{points} ADVANCEMENT WAITING</b> : null}
                </div>
                <div className="dashboard-hero-actions">
                  {!busy && hero.is_alive && hero.hero_status === "active" ? (
                    <button
                      className={`button ${selected ? "button-primary" : ""}`}
                      type="button"
                      onClick={() => setSelectedHeroId(hero.character_id)}
                    >
                      {selected ? "ACTIVE HERO" : "PLAY AS"}
                    </button>
                  ) : null}
                  <Link className="button" to={`/game/heroes/${encodeURIComponent(hero.character_id)}`}>
                    OPEN SHEET
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </section>


            </section>
            <section className="p644-page p644-page-right p644-interior-page p644-inner-scroll" aria-label="Hero tools"><div className="p644-spread-heading"><span className="p644-eyebrow">A HERO'S WORK</span><h1>Choose your next move.</h1></div><div className="p644-action-stack"><Link className="p644-action-card" to="/game/heroes/new">✧ Create a Hero <span>Someone has to save the day.</span></Link><button className="p644-action-card" type="button" onClick={() => openBookSpread("discover")}>⌖ Find an Adventure <span>Entire worlds are waiting.</span></button><Link className="p644-action-card" to="/game/graveyard">✧ The Graveyard <span>Some stories leave a mark.</span></Link><Link className="p644-action-card" to="/game/heroes">✦ Open the Hero Hall <span>Character records and progression.</span></Link></div></section>
          </> : null}
          {bookSpread === "discover" ? <>
            <section className="p644-page p644-page-left p644-interior-page p644-discover-intro" aria-label="Discover world introductions"><div className="p644-spread-heading"><span className="p644-eyebrow">THE ATLAS OF POSSIBILITIES</span><h1>A world for every whim.</h1><p>And probably a few poor decisions, too.</p></div><div className="p644-discover-art" aria-hidden="true"/><div className="p644-bottom-script">Different roads.<br/>Different worlds.<br/>Same wonderful people.</div></section>
            <section className="p644-page p644-page-right p644-interior-page p644-inner-scroll p644-discovery-body" aria-label="Adventure catalog">
      <section id="p64-library" className="dashboard-adventure-browser p64b-atlas">
        <div className="dashboard-section-header">
          <div>
            <span className="eyebrow">ADVENTURE LIBRARY</span>
            <h2>FIND YOUR NEXT PROBLEM.</h2>
            <p>Search the shelf, filter by flavor, then choose who is walking into it.</p>
          </div>
          <label className="catalog-hero-select">
            <span>ENTER AS</span>
            <TerminalSelect
              value={selectedHeroId}
              onChange={setSelectedHeroId}
              disabled={selectableHeroes.length === 0}
              ariaLabel="Hero used to start an adventure"
              options={selectableHeroes.map((hero) => ({
                value: hero.character_id,
                label: `${hero.name} // LVL ${hero.level}`,
              }))}
            />
          </label>
        </div>

        {heroes.length > 0 && selectableHeroes.length === 0 ? (
          <div className="system-notice">
            {playableHeroes.length === 0
              ? "NO LIVING ACTIVE HEROES REMAIN. CREATE A NEW HERO OR VISIT THE HERO HALL."
              : "EVERY AVAILABLE HERO IS CURRENTLY IN AN ADVENTURE."}
            <Link className="button" to="/game/heroes">HERO HALL →</Link>
          </div>
        ) : null}

        <div className="catalog-toolbar">
          <label className="catalog-search-field">
            <span>SEARCH</span>
            <input
              type="search"
              value={catalogSearch}
              onChange={(event) => setCatalogSearch(event.target.value)}
              placeholder="TITLE, SETTING, TAG, VIBE..."
            />
          </label>

          <label className="catalog-filter-field">
            <span>FILTER</span>
            <TerminalSelect
              value={selectedTag}
              onChange={setSelectedTag}
              ariaLabel="Adventure catalog filter"
              options={catalogTags.map((tag) => ({ value: tag, label: tag }))}
            />
          </label>

          <div className="catalog-result-count">
            <span className="eyebrow">FOUND</span>
            <strong>{filteredCatalog.length}</strong>
          </div>
        </div>

        <div className="p64b-atlas-intro" aria-hidden="true"><span>PLACES TO GET LOST</span><span>✧</span><span>NO TWO ROADS ALIKE</span></div>
        <div className="adventure-catalog-grid dashboard-adventure-grid">
          {filteredCatalog.map((adventure) => (
            <article className="adventure-card dashboard-adventure-card p64b-postcard panel" key={adventure.adventure_id}>
              <div className="p64-catalog-art"><img src={p64Cover(adventure.title, adventure.tags, adventure.metadata)} onError={event => { fallbackCover(event.currentTarget, adventure.title, adventure.tags, adventure.metadata); }} alt={`Illustrated cover for ${adventure.title}`} loading="lazy" /></div>
              <div className="panel-body">
                <div className="adventure-card-tags">
                  {(adventure.tags.length ? adventure.tags : ["ADVENTURE"]).slice(0, 4).map((tag) => (
                    <span key={tag}>{tag.toUpperCase()}</span>
                  ))}
                </div>
                <h3>{adventure.title}</h3>
                <p>{generatedSynopsis(adventure)}</p>

                <button
                  className="button button-primary"
                  type="button"
                  disabled={!connected || !selectedHeroId}
                  onClick={() => inspectAdventure(adventure)}
                >
                  VIEW ADVENTURE
                </button>
              </div>
            </article>
          ))}
        </div>

        {directoryReady && filteredCatalog.length === 0 ? (
          <div className="empty-state">
            <strong>NOTHING MATCHED THAT SEARCH.</strong>
            <span>Clear the search or change the filter.</span>
          </div>
        ) : null}
      </section>

            </section>
          </> : null}
          {bookSpread === "wardrobe" ? <>
            <section className="p644-page p644-page-left p644-interior-page p644-tools-left" aria-label="Wardrobe illustrated page">
              <div className="p644-spread-heading"><span className="p644-eyebrow">THE WARDROBE</span><h1>Dress for the story.</h1><p>Same Hero. Entirely different atmosphere.</p></div>
              <div className="p644-tools-illustration" role="img" aria-label="Watercolor illustration representing the Wardrobe and its changing worlds" />
            </section>
            <section className="p644-page p644-page-right p644-interior-page p644-inner-scroll" aria-label="Your appearance settings">
              <div className="p644-spread-heading"><span className="p644-eyebrow">CUSTOMIZE YOUR JOURNAL</span><h2>Make yourself at home.</h2><p>Pick a look for your library, and let your stories dress for their own worlds.</p></div>
              <div className="p644-action-stack">
                <Link className="p644-action-card" to="/account?tab=preferences#wardrobe">Open the Skin Workshop <span>Choose editions, day/night, and your personal skins.</span></Link>
                <Link className="p644-action-card" to="/account?tab=preferences">Reading preferences <span>Typefaces, opening initials and a clean-reading option.</span></Link>
              </div>
              <p className="p644-bottom-script">A good book deserves a proper cover.</p>
            </section>
          </> : null}
          {bookSpread === "tools" ? <>
            <section className="p644-page p644-page-left p644-interior-page p644-tools-left" aria-label="The Wardrobe"><div className="p644-spread-heading"><span className="p644-eyebrow">THE WARDROBE</span><h1>Same soul.<br/>Different worlds.</h1><p>Find an outfit for your next chapter.</p></div><div className="p644-tools-illustration" aria-hidden="true"/><Link className="p644-primary-button" to="/account?tab=preferences#wardrobe">Explore your themes ↗</Link></section>
            <section className="p644-page p644-page-right p644-interior-page p644-inner-scroll" aria-label="System tools">
      <section className="dashboard-system-section">
        <Panel title="SYSTEM MENU" className="dashboard-system-panel">
          <nav className="dashboard-system-menu" aria-label="Game tools">
            <Link to="/game/adventures"><strong>MY ADVENTURES</strong><span>Continue journeys, read Chronicles, and view abandoned stories.</span></Link>
            <Link to="/game/arcade"><strong>ARCADE</strong><span>Practice cabinets and intermission games.</span></Link>
            <Link to="/game/rulebook"><strong>RULEBOOK</strong><span>Checks, XP, Talents and progression.</span></Link>
            <Link to="/account"><strong>ACCOUNT CENTER</strong><span>Profile, preferences, alerts, security, and billing.</span></Link>
            {canAuthor ? <a href="/author-console"><strong>AUTHOR</strong><span>Worlds, lore and adventure seeds.</span></a> : null}
            {isAdmin ? <Link to="/admin"><strong>CONTROL ROOM</strong><span>Users, live rooms and site analytics.</span></Link> : null}
          </nav>
        </Panel>
      </section>


              <div className="p644-account-actions"><Link to="/account">Account &amp; Preferences →</Link><button type="button" onClick={() => void logout()}>Sign out ↗</button></div>
            </section>
          </> : null}
          </div>
        </div>
      </div>
      </div>
      <span className="sr-only" role="status">{spreadLabel} spread displayed</span>
      <div className="p644-bottom-marker" aria-hidden="true">✧ Two people · A thousand possibilities ✧</div>
      {pendingAdventure ? (
        <div
          className="adventure-synopsis-backdrop"
          role="presentation"
          onMouseDown={() => setPendingAdventure(null)}
        >
          <section
            className="adventure-synopsis-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adventure-synopsis-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="adventure-synopsis-header">
              <div>
                <span className="eyebrow">ADVENTURE SYNOPSIS</span>
                <h2 id="adventure-synopsis-title">{pendingAdventure.title}</h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Close synopsis"
                onClick={() => setPendingAdventure(null)}
              >
                ×
              </button>
            </header>

            <div className="adventure-synopsis-body">
              <p>{generatedSynopsis(pendingAdventure)}</p>

              <div className="synopsis-play-mode" role="group" aria-label="Choose adventure party mode">
                <span className="eyebrow">HOW DO YOU WANT TO PLAY?</span>
                <div className="button-row">
                  <button
                    className={`button ${pendingPlayMode === "solo" ? "button-primary" : ""}`}
                    type="button"
                    aria-pressed={pendingPlayMode === "solo"}
                    onClick={() => setPendingPlayMode("solo")}
                  >
                    SOLO
                  </button>
                  <button
                    className={`button ${pendingPlayMode === "coop" ? "button-primary" : ""}`}
                    type="button"
                    aria-pressed={pendingPlayMode === "coop"}
                    onClick={() => setPendingPlayMode("coop")}
                  >
                    WITH A FRIEND
                  </button>
                </div>
              </div>

              <div className="synopsis-meta-grid">
                <div>
                  <span>HERO</span>
                  <strong>{selectedHero?.name ?? "UNASSIGNED"}</strong>
                </div>
                <div>
                  <span>MODE</span>
                  <strong>{pendingPlayMode === "solo" ? "SOLO" : "CO-OP / 2 HEROES"}</strong>
                </div>
                <div>
                  <span>TAGS</span>
                  <strong>
                    {pendingAdventure.tags.length
                      ? pendingAdventure.tags.join(" / ").toUpperCase()
                      : "ADVENTURE"}
                  </strong>
                </div>
              </div>

              <div className="system-notice synopsis-party-note">
                {pendingPlayMode === "solo"
                  ? "YOU'LL ENTER A SOLO LOBBY. PRESS BEGIN ADVENTURE TO BEGIN IMMEDIATELY."
                  : "YOU'LL ENTER A TWO-HERO LOBBY. INVITE YOUR FRIEND, THEN PRESS BEGIN ADVENTURE WHEN BOTH HEROES ARE ONLINE."}
              </div>
            </div>

            <footer className="adventure-synopsis-actions">
              <button className="button" type="button" onClick={() => setPendingAdventure(null)}>
                NOT YET
              </button>
              <button
                className="button button-primary"
                type="button"
                disabled={!connected || !selectedHeroId}
                onClick={beginPendingAdventure}
              >
                ENTER LOBBY
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {pendingJourneyExit ? (
        <div
          className="adventure-synopsis-backdrop"
          role="presentation"
          onMouseDown={() => setPendingJourneyExit(null)}
        >
          <section
            className="adventure-synopsis-modal journey-exit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="journey-exit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="adventure-synopsis-header">
              <div>
                <span className="eyebrow">EMERGENCY EXIT</span>
                <h2 id="journey-exit-title">
                  {pendingJourneyExit.mode === "abandon"
                    ? "ABANDON THIS ADVENTURE?"
                    : "LEAVE THIS ADVENTURE?"}
                </h2>
              </div>
              <button
                className="icon-button"
                type="button"
                aria-label="Cancel"
                onClick={() => setPendingJourneyExit(null)}
              >
                ×
              </button>
            </header>

            <div className="adventure-synopsis-body">
              <p>
                {pendingJourneyExit.mode === "abandon"
                  ? "This permanently ends the active room and clears its frozen turn state. Your Hero record is not deleted, but this unfinished adventure cannot be resumed afterward."
                  : "This removes this Hero from the active room. The remaining player keeps the adventure and becomes host if necessary."}
              </p>
              <div className="system-notice">
                {pendingJourneyExit.adventure.adventure_title.toUpperCase()}
                {" // ROOM "}
                {pendingJourneyExit.adventure.room_code}
              </div>
            </div>

            <footer className="adventure-synopsis-actions">
              <button
                className="button"
                type="button"
                onClick={() => setPendingJourneyExit(null)}
              >
                KEEP PLAYING
              </button>
              <button
                className="button journey-danger-button"
                type="button"
                onClick={confirmJourneyExit}
              >
                {pendingJourneyExit.mode === "abandon"
                  ? "ABANDON FOR GOOD"
                  : "LEAVE ROOM"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      </div>
    </div>
  );
}
