import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import { listCharacters, type Character } from "../../services/characters";
import type {
  AdventureCatalogItem,
  AdventureListItem,
} from "../../services/game";
import { rememberGameRoute } from "../../services/gameRouteMemory";
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

export function GameHomePage() {
  const navigate = useNavigate();

  const {
    connected,
    catalog,
    adventures,
    directoryReady,
    latestError,
    clearError,
    createRoom,
    joinRoom,
    leaveAdventure,
    abandonAdventure,
    lastRoomEntry,
    clearRoomEntry,
  } = useGameSocket();

  const [heroes, setHeroes] = useState<Character[]>([]);
  const [heroError, setHeroError] = useState("");
  const [selectedHeroId, setSelectedHeroId] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [pendingAdventure, setPendingAdventure] = useState<AdventureCatalogItem | null>(null);
  const [pendingJourneyExit, setPendingJourneyExit] = useState<{
    adventure: AdventureListItem;
    mode: "leave" | "abandon";
  } | null>(null);

  useEffect(() => {
    rememberGameRoute("/game");
  }, []);

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
    if (!lastRoomEntry) return;

    const code = lastRoomEntry.room.code;
    const characterId = lastRoomEntry.character_id;

    clearRoomEntry();

    navigate(
      `/game/adventure/${encodeURIComponent(code)}?hero=${encodeURIComponent(characterId)}`,
    );
  }, [lastRoomEntry, clearRoomEntry, navigate]);

  const occupiedHeroIds = useMemo(
    () => new Set(adventures.map((item) => item.character_id)),
    [adventures],
  );

  const selectableHeroes = useMemo(
    () => heroes.filter((hero) => !occupiedHeroIds.has(hero.character_id)),
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

  const visibleCatalog = catalog.filter(
    (adventure) => !HIDDEN_INTERNAL_ADVENTURES.has(adventure.adventure_id),
  );

  const selectedHero = heroes.find(
    (hero) => hero.character_id === selectedHeroId,
  ) ?? null;

  function inspectAdventure(adventure: AdventureCatalogItem) {
    if (!selectedHeroId) return;
    setPendingAdventure(adventure);
  }

  function beginPendingAdventure() {
    if (!selectedHeroId || !pendingAdventure) return;

    const adventureId = pendingAdventure.adventure_id;
    setPendingAdventure(null);
    createRoom(selectedHeroId, adventureId);
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
        eyebrow="ADVENTURE HALL"
        title="WHERE DOES THE TROUBLE START?"
        actions={
          <>
            <span className={`network-badge ${connected ? "is-online" : "is-offline"}`}>
              {connected ? "STORY NETWORK ONLINE" : "PICKING UP THE SIGNAL_"}
            </span>
            <Link className="button" to="/game/arcade">ARCADE LAB</Link>
            <Link className="button" to="/game/heroes">MANAGE HEROES</Link>
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

      <section className="adventure-hall-grid">
        <Panel title="YOUR ACTIVE JOURNEYS" className="journey-list-panel">
          {!directoryReady ? (
            <p className="muted-copy">CONSULTING THE ARCHIVE_</p>
          ) : null}

          {directoryReady && adventures.length === 0 ? (
            <div className="empty-state">
              <strong>NO JOURNEYS CURRENTLY UNDERWAY.</strong>
              <span>That seems fixable.</span>
            </div>
          ) : null}

          <div className="journey-list">
            {adventures.map((adventure) => {
              const recoveryState = adventure.director_request_active
                ? "DIRECTOR WORKING"
                : adventure.director_retry_required
                  ? "RECOVERY REQUIRED"
                  : adventure.turn_pending
                    ? "TURN FROZEN"
                    : "READY";

              return (
              <article
                className="journey-row"
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
                      : `TURN ${adventure.turn_number} // ${recoveryState}`}
                  </span>
                  <strong>{adventure.adventure_title}</strong>
                  <small>{adventure.scene_title}</small>
                  </div>

                  <div className="journey-row-meta">
                    <span>{adventure.character_name}</span>
                    <span>{adventure.room_code}</span>
                    <span>{adventure.play_mode.toUpperCase()}</span>
                  </div>
                </Link>

                {!adventure.completed ? (
                  <div className="journey-row-actions">
                    <Link
                      className="button"
                      to={`/game/adventure/${encodeURIComponent(adventure.room_code)}?hero=${encodeURIComponent(adventure.character_id)}`}
                    >
                      {adventure.director_retry_required ? "RECOVER" : "RESUME"}
                    </Link>
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
              );
            })}
          </div>
        </Panel>

        <Panel title="JOIN BY ROOM CODE">
          <div className="join-room-form">
            <label>
              <span>ENTER AS</span>
              <select
                value={selectedHeroId}
                onChange={(event) => setSelectedHeroId(event.target.value)}
                disabled={selectableHeroes.length === 0}
              >
                {selectableHeroes.map((hero) => (
                  <option value={hero.character_id} key={hero.character_id}>
                    {hero.name} // LVL {hero.level}
                  </option>
                ))}
              </select>
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

      <section className="adventure-catalog-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">AVAILABLE SIMULATIONS</span>
            <h2>PICK A BAD IDEA.</h2>
          </div>

          <label className="catalog-hero-select">
            <span>ENTER AS</span>
            <select
              value={selectedHeroId}
              onChange={(event) => setSelectedHeroId(event.target.value)}
              disabled={selectableHeroes.length === 0}
            >
              {selectableHeroes.map((hero) => (
                <option value={hero.character_id} key={hero.character_id}>
                  {hero.name} // LVL {hero.level}
                </option>
              ))}
            </select>
          </label>
        </div>

        {heroes.length === 0 && !heroError ? (
          <div className="system-notice">
            NO ONE HAS VOLUNTEERED FOR THIS YET.{" "}
            <Link to="/game/heroes/new">CREATE A HERO →</Link>
          </div>
        ) : null}

        {heroes.length > 0 && selectableHeroes.length === 0 ? (
          <div className="system-notice">
            EVERY HERO YOU OWN IS ALREADY BUSY MAKING CONSEQUENCES.
          </div>
        ) : null}

        <div className="adventure-catalog-grid">
          {visibleCatalog.map((adventure) => (
            <article className="adventure-card panel" key={adventure.adventure_id}>
              <div className="panel-body">
                <div className="eyebrow">
                  {adventure.tags.length
                    ? adventure.tags.join(" // ").toUpperCase()
                    : "ADVENTURE"}
                </div>
                <h3>{adventure.title}</h3>
                <p>{adventure.description}</p>

                <button
                  className="button button-primary"
                  type="button"
                  disabled={!connected || !selectedHeroId}
                  onClick={() => inspectAdventure(adventure)}
                >
                  OPEN SYNOPSIS
                </button>
              </div>
            </article>
          ))}
        </div>

        {directoryReady && visibleCatalog.length === 0 ? (
          <div className="empty-state">
            <strong>THE SHELF IS SUSPICIOUSLY EMPTY.</strong>
            <span>No public adventure definitions are currently available.</span>
          </div>
        ) : null}
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
                <span className="eyebrow">AI-GENERATED PLAYER SYNOPSIS</span>
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

              <div className="synopsis-meta-grid">
                <div>
                  <span>HERO</span>
                  <strong>{selectedHero?.name ?? "UNASSIGNED"}</strong>
                </div>
                <div>
                  <span>MODE</span>
                  <strong>CO-OP ROOM</strong>
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
                CO-OP WILL WAIT FOR THE REQUIRED PARTY BEFORE RESOLVING TURN ONE.
                YOU CAN EXPLICITLY SWITCH THE ROOM TO SOLO AFTER ENTERING IF YOU MEAN TO PLAY ALONE.
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
                ENTER THE STORY
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
