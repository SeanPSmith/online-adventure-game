import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router";
import { Panel } from "../../components/ui/Panel";
import { ChoiceInspector } from "../../features/adventure/ChoiceInspector";
import { QuickEventModal } from "../../features/adventure/QuickEventModal";
import { TurnTheater } from "../../features/adventure/TurnTheater";
import { useTurnTheater } from "../../features/adventure/useTurnTheater";
import { getCharacter, type Character } from "../../services/characters";
import type { SceneChoice } from "../../services/game";
import { rememberGameRoute } from "../../services/gameRouteMemory";
import { useGameSocket } from "../../state/GameSocketContext";
import { useLiveAdventure } from "../../state/useLiveAdventure";
import { useModal } from "../../state/ModalContext";

const CORE_STATS = [
  ["strength", "STR"],
  ["agility", "AGI"],
  ["intellect", "INT"],
  ["perception", "PER"],
  ["presence", "PRE"],
  ["willpower", "WIL"],
  ["luck", "LCK"],
] as const;

function choiceStorageKey(roomCode: string, characterId: string, turnNumber: number) {
  return `tot:choice:${roomCode}:${characterId}:${turnNumber}`;
}

function readStoredChoice(roomCode: string, characterId: string, turnNumber: number) {
  try {
    return sessionStorage.getItem(choiceStorageKey(roomCode, characterId, turnNumber)) ?? "";
  } catch {
    return "";
  }
}

function storeChoice(roomCode: string, characterId: string, turnNumber: number, choiceId: string) {
  try {
    sessionStorage.setItem(
      choiceStorageKey(roomCode, characterId, turnNumber),
      choiceId,
    );
  } catch {
    // Local presentation persistence is optional. Python remains authoritative.
  }
}

function signed(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function outcomeLabel(outcome: string) {
  return outcome.replaceAll("_", " ").toUpperCase();
}

export function AdventurePage() {
  const { roomId } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { openModal } = useModal();

  const {
    adventures,
    connected,
    startSolo,
  } = useGameSocket();

  const matchingAdventure = useMemo(
    () =>
      adventures.find(
        (item) => item.room_code.toUpperCase() === roomId?.toUpperCase(),
      ),
    [adventures, roomId],
  );

  const characterId =
    searchParams.get("hero")?.trim() ||
    matchingAdventure?.character_id ||
    undefined;

  const live = useLiveAdventure(roomId, characterId);

  const normalizedRoomCode = roomId?.toUpperCase() ?? "";
  const turnNumber = live.game?.turn_number ?? matchingAdventure?.turn_number ?? 1;

  const theater = useTurnTheater({
    roomCode: normalizedRoomCode,
    characterId: characterId ?? "",
    game: live.game,
    lockCountdown: live.turnLockCountdown,
    storyAdvancing: live.storyAdvancing,
    lastTurn: live.lastTurn,
    retryableError: live.retryableError,
    error: live.error,
  });

  const [chatText, setChatText] = useState("");
  const [asciiPickerOpen, setAsciiPickerOpen] = useState(false);
  const [hero, setHero] = useState<Character | null>(null);
  const [heroError, setHeroError] = useState("");
  const [selectedChoiceId, setSelectedChoiceId] = useState("");
  const [lockPending, setLockPending] = useState(false);

  const scene = live.game?.scene;
  const readiness = live.game?.readiness ?? [];

  const localReadiness = readiness.find(
    (player) => player.player_id === live.playerId,
  );

  const localRoomPlayer = live.room?.players.find(
    (player) => player.character_id === characterId,
  );

  const choiceLocked = Boolean(localReadiness?.ready || live.choiceAccepted);

  const selectedChoice = scene?.choices.find(
    (choice) => choice.id === selectedChoiceId,
  ) ?? null;

  const lastLocalResult = useMemo(
    () =>
      live.lastTurn?.results?.find(
        (result) => result.character_id === characterId,
      ) ?? null,
    [characterId, live.lastTurn],
  );

  const lastLocalProgression = characterId
    ? live.lastTurn?.hero_progression?.[characterId] ?? null
    : null;

  const directorState = live.game?.director_request_active
    ? "WRITING"
    : live.game?.director_retry_required
      ? "RECOVERY"
      : live.game?.turn_pending
        ? "PENDING"
        : "READY";

  const choicesBlocked =
    choiceLocked ||
    lockPending ||
    Boolean(live.game?.turn_pending) ||
    Boolean(live.game?.director_request_active) ||
    Boolean(live.game?.director_retry_required) ||
    Boolean(live.game?.pending_micro_event) ||
    theater.phase !== "none";

  useEffect(() => {
    rememberGameRoute(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!characterId) return;

    let alive = true;

    getCharacter(characterId)
      .then((value) => {
        if (!alive) return;
        setHero(value);
        setHeroError("");
      })
      .catch((reason) => {
        if (!alive) return;
        setHeroError(
          reason instanceof Error ? reason.message : "Hero record unavailable.",
        );
      });

    return () => {
      alive = false;
    };
  }, [characterId, live.game?.turn_number, live.lastTurn]);

  useEffect(() => {
    if (!characterId || !normalizedRoomCode) return;

    const stored = readStoredChoice(
      normalizedRoomCode,
      characterId,
      turnNumber,
    );

    setSelectedChoiceId(stored);
    setLockPending(false);
  }, [characterId, normalizedRoomCode, turnNumber]);

  useEffect(() => {
    if (!live.choiceAccepted || !characterId || !normalizedRoomCode) return;

    setSelectedChoiceId(live.choiceAccepted.choice_id);
    setLockPending(false);
    storeChoice(
      normalizedRoomCode,
      characterId,
      turnNumber,
      live.choiceAccepted.choice_id,
    );
  }, [
    live.choiceAccepted,
    characterId,
    normalizedRoomCode,
    turnNumber,
  ]);

  useEffect(() => {
    if (live.error && !choiceLocked) {
      setLockPending(false);
    }
  }, [live.error, choiceLocked]);

  function submitChat(event: FormEvent) {
    event.preventDefault();

    const clean = chatText.trim();
    if (!clean) return;

    live.sendChat(clean);
    setChatText("");
  }

  function insertAsciiFace(face: string) {
    setChatText((current) => {
      const trimmed = current.trimEnd();
      return `${trimmed}${trimmed ? " " : ""}${face}`;
    });
    setAsciiPickerOpen(false);
  }

  function selectChoice(choice: SceneChoice) {
    if (choicesBlocked) return;

    setSelectedChoiceId(choice.id);

    if (characterId && normalizedRoomCode) {
      storeChoice(
        normalizedRoomCode,
        characterId,
        turnNumber,
        choice.id,
      );
    }
  }

  function inspectChoice(choice: SceneChoice) {
    openModal({
      title: `CHOICE DOSSIER // ${choice.label.toUpperCase()}`,
      body: <ChoiceInspector choice={choice} />,
      dismissLabel: "RETURN TO CHOICES",
    });
  }

  function lockChoice() {
    if (!selectedChoiceId || choicesBlocked) return;

    setLockPending(true);
    live.clearError();
    live.submitChoice(selectedChoiceId);
  }

  if (!characterId) {
    return (
      <div className="adventure-route-message panel">
        <div className="panel-body">
          <span className="eyebrow">THREAD NOT ATTACHED</span>
          <h1>WE FOUND THE ADVENTURE. YOUR HERO MISPLACED THE INVITATION.</h1>
          <p>
            Return to the Adventure Hall and enter through the saved journey so the
            server can bind the correct Hero to this room.
          </p>
          <Link className="button button-primary" to="/game">
            RETURN TO THE HALL
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="adventure-layout">
        <section className="story-pane panel">
          <div className="scene-art">
            <pre>{scene?.ascii_art?.trim() || "SETTING THE STAGE_"}</pre>
          </div>

          <div className="scene-meta">
            <span>
              {live.game?.adventure_title ?? matchingAdventure?.adventure_title ?? "RESTORING THE THREAD_"}
              {" // "}
              TURN {turnNumber}
            </span>

            <span>
              ROOM {normalizedRoomCode || "—"}
              {" // "}
              {connected ? "CONNECTED" : "RECONNECTING"}
            </span>
          </div>

          <section className="adventure-command-strip" aria-label="Current turn state">
            <div className="turn-status-cluster">
              {readiness.map((player) => (
                <div className={`turn-status-chip ${player.ready ? "is-ready" : ""}`} key={player.player_id}>
                  <span>{player.player_id === live.playerId ? "YOU" : player.name}</span>
                  <strong>
                    {player.ready
                      ? "LOCKED"
                      : player.online
                        ? "CHOOSING"
                        : "OFFLINE"}
                  </strong>
                </div>
              ))}

              <div className={`turn-status-chip director-status is-${directorState.toLowerCase()}`}>
                <span>DIRECTOR</span>
                <strong>{directorState}</strong>
              </div>

              <div className="turn-status-chip">
                <span>MODE</span>
                <strong>{live.room?.play_mode?.toUpperCase() ?? "—"}</strong>
              </div>
            </div>

            <div className="adventure-session-actions">
              {live.game?.can_start_solo && localRoomPlayer?.is_host ? (
                <button
                  className="button button-quiet"
                  type="button"
                  onClick={() => {
                    const confirmed = window.confirm(
                      "Switch this co-op room to SOLO? A second Hero will no longer be able to join this journey.",
                    );

                    if (confirmed) {
                      startSolo(normalizedRoomCode);
                    }
                  }}
                >
                  START SOLO
                </button>
              ) : null}

              {live.game?.wrap_up_available && !live.game.wrap_up_active ? (
                <button
                  className="button button-quiet"
                  type="button"
                  disabled={Boolean(live.playerId && live.game.wrap_up_votes.includes(live.playerId))}
                  onClick={live.requestWrapUp}
                >
                  {live.playerId && live.game.wrap_up_votes.includes(live.playerId)
                    ? "FINAL CHAPTER REQUESTED"
                    : "CALL FINAL CHAPTER"}
                </button>
              ) : null}

              {live.game?.wrap_up_active ? (
                <span className="wrap-up-status compact-wrap-up-status">
                  FINAL CHAPTER // {live.game.wrap_up_turns_remaining} TURNS
                </span>
              ) : null}
            </div>
          </section>

          {live.game?.last_resolution ? (
            <section className="previous-resolution">
              <span className="eyebrow">PREVIOUS TURN // WHAT JUST HAPPENED</span>
              <p>{live.game.last_resolution}</p>
            </section>
          ) : null}

          <article className="story-copy">
            <div className="story-heading-row">
              <span className="eyebrow">CURRENT SCENE</span>
              <span className="story-turn-marker">TURN {String(turnNumber).padStart(2, "0")}</span>
            </div>
            <h1>{scene?.title ?? "PICKING UP THE THREAD_"}</h1>

            {scene?.body ? (
              scene.body.split(/\n{2,}/).map((paragraph, index) => (
                <p key={`${scene.id}:${index}`}>{paragraph}</p>
              ))
            ) : (
              <>
                <p className="muted-copy">
                  {live.status === "error"
                    ? "THE CHRONICLE CANNOT BE OPENED."
                    : "CONSULTING THE CHRONICLE_"}
                </p>
                {live.status === "error" ? (
                  <div className="system-notice adventure-restore-failure">
                    <strong>{live.error || "THE RESTORE DID NOT COMPLETE."}</strong>
                    <span>
                      The Adventure Hall has a recovery/abandon control for this saved room.
                    </span>
                    <Link className="button button-primary" to="/game">
                      RETURN TO ADVENTURE HALL
                    </Link>
                  </div>
                ) : null}
              </>
            )}
          </article>

          {live.finale ? (
            <section className="finale-inline">
              <span className="eyebrow">JOURNEY COMPLETE</span>
              <h2>{live.finale.ending_label}</h2>
              <p>{live.finale.final_resolution}</p>
              <Link className="button button-primary" to="/game/history">
                OPEN THE SEALED CHRONICLE
              </Link>
            </section>
          ) : (
            <section className="choice-area">
              <header className="choice-area-heading">
                <div>
                  <span className="eyebrow">YOUR NEXT MOVE</span>
                  <strong>CHOOSE AN INTENT</strong>
                </div>
                <span>
                  {choiceLocked
                    ? "LOCKED // WAITING FOR THE THREAD"
                    : selectedChoice
                      ? "SELECTED // REVIEW OR LOCK"
                      : "NOTHING IS CANON YET"}
                </span>
              </header>

              <div className="choice-grid">
                {(scene?.choices ?? []).map((choice, index) => {
                  const selected = choice.id === selectedChoiceId;
                  const locked = selected && choiceLocked;
                  const challenge = choice.check?.challenge_tier?.toUpperCase() ?? null;
                  const checkName = choice.check
                    ? (choice.check.skill ?? choice.check.stat ?? "CHECK").toUpperCase()
                    : "NO CHECK";

                  return (
                    <article
                      className={`choice-card ${selected ? "is-selected" : ""} ${locked ? "is-locked" : ""}`}
                      key={choice.id}
                    >
                      <button
                        className="choice-select-button"
                        type="button"
                        disabled={choicesBlocked && !selected}
                        onClick={() => selectChoice(choice)}
                      >
                        <span className="choice-number">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <span className="choice-copy">
                          <strong>{choice.label}</strong>
                          <span className="choice-meta-tags">
                            <small>
                              {choice.check
                                ? `${checkName}${challenge ? ` // ${challenge}` : ""} // DC ${choice.check.difficulty}`
                                : "NO CHECK"}
                            </small>
                            {choice.risk_level ? (
                              <small className={`choice-risk-tag risk-${choice.risk_level.toLowerCase()}`}>
                                {choice.risk_level.toUpperCase()} RISK
                              </small>
                            ) : null}
                            <small>+{choice.xp_reward} XP</small>
                          </span>
                        </span>
                      </button>

                      <button
                        className="choice-info-button"
                        type="button"
                        onClick={() => inspectChoice(choice)}
                        aria-label={`Inspect ${choice.label}`}
                      >
                        i
                      </button>
                    </article>
                  );
                })}
              </div>

              <div className="choice-commit-bar">
                <div className="choice-commit-copy">
                  <span className="eyebrow">TURN INTENT</span>
                  <strong>
                    {choiceLocked
                      ? `LOCKED // ${selectedChoice?.label ?? live.choiceAccepted?.choice_label ?? "CHOICE RECORDED"}`
                      : lockPending
                        ? "LOCKING CHOICE_"
                        : selectedChoice
                          ? selectedChoice.label
                          : "SELECT AN ACTION_"}
                  </strong>
                  {selectedChoice && !choiceLocked ? (
                    <span>{selectedChoice.description}</span>
                  ) : null}
                </div>

                <button
                  className="button button-primary choice-lock-button"
                  type="button"
                  disabled={!selectedChoiceId || choicesBlocked}
                  onClick={lockChoice}
                >
                  {choiceLocked ? "LOCKED" : lockPending ? "LOCKING_" : "LOCK IN CHOICE"}
                </button>
              </div>
            </section>
          )}
        </section>

        <aside className="adventure-sidebar">
          <Panel title="HERO // LIVE SHEET" className="hero-panel">
            {hero ? (
              <div className="live-hero">
                <div className="live-hero-heading">
                  <div>
                    <span className="eyebrow">LEVEL {hero.level}</span>
                    <strong>{hero.name}</strong>
                  </div>
                  <span className={`hero-hp ${hero.is_alive ? "" : "is-fallen"}`}>
                    {hero.is_alive ? `HP ${hero.health}/${hero.max_health}` : "FALLEN"}
                  </span>
                </div>

                {hero.bio ? <p className="hero-bio-snippet">{hero.bio}</p> : null}

                <div className="hero-vital-row">
                  <span>HP</span>
                  <div className="meter" aria-label={`HP ${hero.health} of ${hero.max_health}`}>
                    <span
                      style={{
                        width: `${Math.max(0, Math.min(100, (hero.health / hero.max_health) * 100))}%`,
                      }}
                    />
                  </div>
                  <strong>{hero.health}/{hero.max_health}</strong>
                </div>

                <div className="xp-readout">
                  <div>
                    <span>XP {hero.experience}</span>
                    <span>{hero.xp_needed_for_next_level} TO NEXT</span>
                  </div>
                  <div className="xp-meter">
                    <span style={{ width: `${hero.xp_progress_percent}%` }} />
                  </div>
                </div>

                <div className="hero-stat-segments" aria-label="Core Hero attributes">
                  {CORE_STATS.map(([key, label]) => {
                    const value = Math.max(0, Math.min(7, hero.stats[key] ?? 0));
                    return (
                      <div className="hero-segment-stat" key={key}>
                        <div>
                          <b>{label}</b>
                          <strong>{value}</strong>
                        </div>
                        <span className="segmented-meter" aria-label={`${key} ${value} of 7`}>
                          {Array.from({ length: 7 }, (_, index) => (
                            <i className={index < value ? "is-filled" : ""} key={index} />
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {(hero.unspent_stat_points + hero.unspent_skill_points + hero.unspent_talent_points) > 0 ? (
                  <div className="hero-advancement-alert">
                    <strong>ADVANCEMENT READY</strong>
                    <span>
                      {hero.unspent_stat_points} ATTR // {hero.unspent_skill_points} SKILL // {hero.unspent_talent_points} TALENT
                    </span>
                  </div>
                ) : null}

                {lastLocalResult ? (
                  <section className={`hero-last-check ${lastLocalResult.check?.outcome ? `is-${lastLocalResult.check.outcome}` : ""}`}>
                    <div className="hero-last-check-heading">
                      <span className="eyebrow">LAST CHECK</span>
                      <strong>+{lastLocalResult.xp_reward} XP</strong>
                    </div>

                    {lastLocalResult.check ? (
                      <>
                        <div className="hero-dice-readout">
                          <div>
                            <span>D20</span>
                            <strong>{lastLocalResult.check.roll}</strong>
                          </div>
                          <span>+</span>
                          <div>
                            <span>MOD</span>
                            <strong>{signed(lastLocalResult.check.total_modifier)}</strong>
                          </div>
                          <span>=</span>
                          <div>
                            <span>TOTAL</span>
                            <strong>{lastLocalResult.check.total}</strong>
                          </div>
                          <span>/</span>
                          <div>
                            <span>DC</span>
                            <strong>{lastLocalResult.check.difficulty}</strong>
                          </div>
                        </div>
                        <div className="hero-check-outcome">
                          <strong>{outcomeLabel(lastLocalResult.check.outcome)}</strong>
                          <span>
                            {(lastLocalResult.check.skill ?? lastLocalResult.check.stat ?? "CHECK").toUpperCase()}
                            {lastLocalResult.check.challenge_tier
                              ? ` // ${lastLocalResult.check.challenge_tier.toUpperCase()}`
                              : ""}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="hero-check-outcome">
                        <strong>ACTION RESOLVED</strong>
                        <span>NO CHECK REQUIRED</span>
                      </div>
                    )}

                    {lastLocalProgression?.leveled_up ? (
                      <div className="hero-level-flash">
                        LEVEL UP // {lastLocalProgression.level_before} → {lastLocalProgression.level_after}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {hero.effects.length > 0 ? (
                  <div className="hero-effect-list">
                    {hero.effects
                      .filter((effect) => effect.active !== false)
                      .map((effect, index) => (
                        <div key={String(effect.effect_id ?? effect.source_key ?? index)}>
                          <strong>{String(effect.name ?? "EFFECT").toUpperCase()}</strong>
                          <span>
                            {effect.remaining_turns != null
                              ? `${String(effect.remaining_turns)} TURNS`
                              : String(effect.permanence ?? "ACTIVE").toUpperCase()}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : null}

                <Link className="hero-sheet-link" to={`/game/heroes/${encodeURIComponent(characterId)}`}>
                  OPEN CHARACTER SHEET →
                </Link>
              </div>
            ) : (
              <p className="muted-copy">
                {heroError || "RECOVERING HERO RECORD_"}
              </p>
            )}
          </Panel>

          {live.error && !live.retryableError && !live.game?.director_retry_required ? (
            <div className="adventure-error">
              <strong>SOMETHING SLIPPED OUT OF THE THREAD.</strong>
              <span>{live.error}</span>
              <div className="adventure-error-actions">
                <button className="button" type="button" onClick={live.sync}>
                  ASK THE SERVER WHAT HAPPENED
                </button>
                <button className="button" type="button" onClick={live.clearError}>
                  DISMISS
                </button>
              </div>
            </div>
          ) : null}

          <Panel title={`PARTY CHAT // ${live.messages.length}`} className="chat-panel">
            <div className="chat-log">
              {live.messages.length === 0 ? (
                <span className="system-line">
                  SYSTEM // NO ONE HAS SAID ANYTHING YET. OMINOUS.
                </span>
              ) : (
                live.messages.map((message) => (
                  <div className="chat-message" key={message.id}>
                    <span className="chat-name">{message.player_name}</span>
                    <span className="chat-text">{message.text}</span>
                  </div>
                ))
              )}
            </div>

            <form className="chat-compose" onSubmit={submitChat}>
              <span>&gt;</span>
              <input
                value={chatText}
                onChange={(event) => setChatText(event.target.value)}
                maxLength={500}
                disabled={live.status !== "ready"}
                placeholder="say something regrettable..."
              />
              <button
                type="button"
                aria-expanded={asciiPickerOpen}
                title="ASCII face picker"
                onClick={() => setAsciiPickerOpen((current) => !current)}
              >
                :-)
              </button>
              <button
                type="submit"
                disabled={live.status !== "ready" || !chatText.trim()}
              >
                SEND
              </button>
            </form>

            {asciiPickerOpen ? (
              <div className="ascii-picker" aria-label="ASCII face picker">
                {[
                  ":-)",
                  ":-D",
                  ";-)",
                  ":-(",
                  ":-P",
                  ":-/",
                  "B-)",
                  "<3",
                  "o_O",
                  "^_^",
                  "-_-",
                ].map((face) => (
                  <button
                    type="button"
                    key={face}
                    onClick={() => insertAsciiFace(face)}
                  >
                    {face}
                  </button>
                ))}
              </div>
            ) : null}
          </Panel>
        </aside>
      </div>

      <QuickEventModal
        event={
          theater.phase === "none"
            ? live.game?.pending_micro_event ?? null
            : null
        }
        resolution={
          theater.phase === "none"
            ? live.microEventResolution
            : null
        }
        playerId={live.playerId}
        requiredResponses={
          live.game?.readiness.filter(
            (player) => player.online || player.ready,
          ).length ?? 1
        }
        playMode={live.game?.play_mode}
        onChoose={live.submitMicroEventChoice}
      />

      <TurnTheater
        theater={theater}
        playerId={live.playerId}
        intermissionResult={live.intermissionResult}
        onSubmitIntermissionScore={live.submitIntermissionScore}
        onRetry={() => {
          live.clearRetryableError();
          live.retryPendingTurn();
        }}
      />
    </>
  );
}
