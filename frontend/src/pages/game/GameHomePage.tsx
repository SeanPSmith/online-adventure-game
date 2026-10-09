import { FirstRunGuide } from "../../features/onboarding/FirstRunGuide";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
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

export function GameHomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const selectableHeroes = useMemo(
    () => heroes.filter((hero) => hero.is_alive && !occupiedHeroIds.has(hero.character_id)),
    [heroes, occupiedHeroIds],
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

  return (
    <>
      <PageTitle
        eyebrow="PLAYER DASHBOARD"
        title="WHAT HAPPENS NEXT?"
        actions={
          <>
            <span className={`network-badge ${connected ? "is-online" : "is-offline"}`}>
              {connected ? "STORY NETWORK ONLINE" : "PICKING UP THE SIGNAL_"}
            </span>
            {primaryJourney ? (
              <Link
                className="button button-primary"
                to={`/game/adventure/${encodeURIComponent(primaryJourney.room_code)}?hero=${encodeURIComponent(primaryJourney.character_id)}`}
              >
                {primaryJourney.director_retry_required ? "RECOVER JOURNEY" : "CONTINUE JOURNEY"}
              </Link>
            ) : null}
          </>
        }
      />

      {(latestError || heroError) ? (
        <div className="form-error">
          {latestError || heroError}
          {latestError ? (
            <button className="inline-dismiss" type="button" onClick={clearError}>
              DISMISS
            </button>
          ) : null}
        </div>
      ) : null}

      <FirstRunGuide
        heroes={selectableHeroes}
        selectedHeroId={selectedHeroId}
        onSelectHero={setSelectedHeroId}
        connected={connected}
        starterAvailable={catalog.some(adventure => adventure.adventure_id === "first_light")}
        creating={starterCreating}
        onStart={mode => {
          clearError();
          setStarterCreating(true);
          createRoom(selectedHeroId, "first_light", mode);
        }}
      />

      <section className="dashboard-command-grid">
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
      </section>

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

        <div className="dashboard-hero-stack dashboard-hero-grid">
          {heroes.slice(0, 4).map((hero) => {
            const busy = occupiedHeroIds.has(hero.character_id);
            const points = advancementTotal(hero);
            const selected = hero.character_id === selectedHeroId;

            return (
              <article className={`dashboard-hero-card ${selected ? "is-selected" : ""}`} key={hero.character_id}>
                <div className="dashboard-hero-copy">
                  <span className="eyebrow">
                    LVL {hero.level} // {busy ? "IN JOURNEY" : selected ? "SELECTED" : "AVAILABLE"}
                  </span>
                  <strong>{hero.name}</strong>
                  <p>{hero.bio || "No background written yet."}</p>
                </div>
                <div className="dashboard-hero-vitals">
                  <span>HP {hero.health}/{hero.max_health}</span>
                  <span>XP {Math.round(hero.xp_progress_percent)}%</span>
                  {points > 0 ? <b>{points} ADVANCEMENT WAITING</b> : null}
                </div>
                <div className="dashboard-hero-actions">
                  {!busy ? (
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

      <section className="dashboard-adventure-browser">
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
            EVERY HERO YOU OWN IS ALREADY BUSY MAKING CONSEQUENCES.
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

        <div className="adventure-catalog-grid dashboard-adventure-grid">
          {filteredCatalog.map((adventure) => (
            <article className="adventure-card dashboard-adventure-card panel" key={adventure.adventure_id}>
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
                  ? "YOU'LL ENTER A SOLO LOBBY. PRESS GET STARTED TO BEGIN IMMEDIATELY."
                  : "YOU'LL ENTER A TWO-HERO LOBBY. INVITE YOUR FRIEND, THEN PRESS GET STARTED WHEN BOTH HEROES ARE ONLINE."}
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
    </>
  );
}
