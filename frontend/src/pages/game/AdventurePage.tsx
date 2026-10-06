import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { Panel } from "../../components/ui/Panel";
import { RoomInviteButton } from "../../components/game/RoomInviteButton";
import { ShareMomentButton } from "../../components/game/ShareMomentButton";
import { ChoiceInspector } from "../../features/adventure/ChoiceInspector";
import { LevelUpModal } from "../../features/adventure/LevelUpModal";
import { QuickEventModal } from "../../features/adventure/QuickEventModal";
import { TurnTheater } from "../../features/adventure/TurnTheater";
import { useTurnTheater } from "../../features/adventure/useTurnTheater";
import { getCharacter, type Character } from "../../services/characters";
import type { PartyHeroSnapshot, SceneChoice } from "../../services/game";
import { rememberGameRoute } from "../../services/gameRouteMemory";
import { useGameSocket } from "../../state/GameSocketContext";
import { useLiveAdventure } from "../../state/useLiveAdventure";
import { useModal } from "../../state/ModalContext";
import {
  ASCII_REACTIONS,
  ASCII_REACTION_GROUPS,
  presenceFace,
} from "../../features/social/asciiSocial";

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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { openModal } = useModal();

  const {
    adventures,
    connected,
    startSolo,
    leaveAdventure,
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
  const [inspectedCharacterId, setInspectedCharacterId] = useState(characterId ?? "");
  const [selectedChoiceId, setSelectedChoiceId] = useState("");
  const [lockPending, setLockPending] = useState(false);
  const [dismissedLevelUpKey, setDismissedLevelUpKey] = useState("");
  const storyPaneRef = useRef<HTMLElement | null>(null);

  const scene = live.game?.scene;
  const readiness = live.game?.readiness ?? [];

  const localReadiness = readiness.find(
    (player) => player.player_id === live.playerId,
  );

  const localRoomPlayer = live.room?.players.find(
    (player) => player.character_id === characterId,
  );

  const partyHeroes = live.game?.party_heroes ?? [];
  const inspectedRoomPlayer = live.room?.players.find(
    (player) => player.character_id === inspectedCharacterId,
  );
  const inspectedPartyHero = partyHeroes.find(
    (partyHero) => partyHero.character_id === inspectedCharacterId,
  ) ?? null;
  const isInspectingSelf = inspectedCharacterId === characterId;
  const displayHero: Character | PartyHeroSnapshot | null =
    isInspectingSelf && hero ? hero : inspectedPartyHero;

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

  const inspectedResult = useMemo(
    () =>
      live.lastTurn?.results?.find(
        (result) => result.character_id === inspectedCharacterId,
      ) ?? null,
    [inspectedCharacterId, live.lastTurn],
  );

  const inspectedProgression = inspectedCharacterId
    ? live.lastTurn?.hero_progression?.[inspectedCharacterId] ?? null
    : null;

  const levelUpKey = lastLocalProgression?.leveled_up
    ? [
        normalizedRoomCode,
        live.lastTurn?.turn_number ?? turnNumber,
        characterId,
        lastLocalProgression.level_after,
      ].join(":")
    : "";

  const showLevelUp = Boolean(
    levelUpKey &&
    dismissedLevelUpKey !== levelUpKey &&
    theater.phase === "none",
  );

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
    // A new Director scene should always begin at the top of the story pane.
    // The turn theater/intermission can leave desktop and mobile users scrolled
    // near the choices from the previous turn, which makes fresh prose appear
    // to be missing.
    const timer = window.setTimeout(() => {
      storyPaneRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [turnNumber, scene?.id, live.finale?.ending_label]);

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
    if (!characterId) return;

    const availableIds = new Set(
      live.room?.players.map((player) => player.character_id) ?? [characterId],
    );

    if (!inspectedCharacterId || !availableIds.has(inspectedCharacterId)) {
      setInspectedCharacterId(characterId);
    }
  }, [characterId, inspectedCharacterId, live.room?.players]);

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
        <section className="story-pane panel" ref={storyPaneRef}>
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
                  <span>
                    <b className="status-ascii" aria-hidden="true">{presenceFace(player.online, player.ready)}</b>
                    {player.player_id === live.playerId ? "YOU" : player.name}
                  </span>
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
              {live.room?.play_mode === "coop" && localRoomPlayer?.is_host && live.room.player_count < live.room.max_players ? (
                <RoomInviteButton
                  roomCode={normalizedRoomCode}
                  adventureTitle={live.game?.adventure_title ?? matchingAdventure?.adventure_title}
                  className="button button-quiet"
                  label="[+] INVITE / SHARE"
                />
              ) : null}

              {scene?.body ? (
                <ShareMomentButton
                  title={`${scene.title} — Tales of Two`}
                  text={`${live.game?.adventure_title ?? "Tales of Two"} // ${scene.title}
${scene.body.slice(0, 260)}`}
                  url={`${window.location.origin}/`}
                  label="[↗] SHARE MOMENT"
                />
              ) : null}

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
            <section className="finale-inline journey-finale-summary">
              <header className="finale-summary-header">
                <div>
                  <span className="eyebrow">*** THE CHRONICLE IS COMPLETE ***</span>
                  <h2>{live.finale.ending_label}</h2>
                  <strong>{live.finale.adventure_title}</strong>
                </div>
                <div className="finale-party-rank">
                  <span>PARTY RENOWN</span>
                  <strong>{live.finale.party_rank}</strong>
                  <ShareMomentButton
                    title={`${live.finale.adventure_title} — Tales of Two`}
                    text={`${live.finale.ending_label} // ${live.finale.final_resolution}`}
                    url={`${window.location.origin}/`}
                    label="[↗] SHARE ENDING"
                    className="button button-quiet"
                  />
                </div>
              </header>

              <div className="finale-meta-strip">
                <span>{live.finale.turn_count} TURNS</span>
                <span>{live.finale.play_mode.toUpperCase()}</span>
                <span>{live.finale.heroes.length} HERO{live.finale.heroes.length === 1 ? "" : "ES"}</span>
              </div>

              <section className="finale-resolution-copy">
                <span className="eyebrow">HOW IT ENDED</span>
                <p>{live.finale.final_resolution}</p>
              </section>

              <div className="finale-hero-grid">
                {live.finale.heroes.map((finalHero) => (
                  <article className="finale-hero-card" key={finalHero.character_id}>
                    <header>
                      <div>
                        <span className="eyebrow">{finalHero.is_alive ? "SURVIVED" : "FALLEN"}</span>
                        <strong>{finalHero.character_name}</strong>
                      </div>
                      <span className="finale-hero-rank">RANK {finalHero.rank}</span>
                    </header>

                    <div className="finale-hero-progression">
                      <strong>LVL {finalHero.starting_level} → {finalHero.ending_level}</strong>
                      <span>+{finalHero.xp_earned} XP</span>
                    </div>

                    <div className="finale-stat-grid">
                      <div><span>CHECKS</span><strong>{finalHero.checks_total}</strong></div>
                      <div><span>SUCCESS</span><strong>{Math.round(finalHero.success_rate)}%</strong></div>
                      <div><span>CRIT+</span><strong>{finalHero.critical_successes}</strong></div>
                      <div><span>CRIT-</span><strong>{finalHero.critical_failures}</strong></div>
                      <div><span>HP</span><strong>{finalHero.health}/{finalHero.max_health}</strong></div>
                      <div><span>LEVELS</span><strong>+{finalHero.levels_gained}</strong></div>
                    </div>

                    {(finalHero.advancement_stat_points_earned + finalHero.advancement_skill_points_earned + finalHero.advancement_talent_points_earned) > 0 ? (
                      <div className="finale-advancement-earned">
                        ADVANCEMENT // +{finalHero.advancement_stat_points_earned} ATTR // +{finalHero.advancement_skill_points_earned} SKILL // +{finalHero.advancement_talent_points_earned} TALENT
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>

              <div className="finale-actions">
                <Link className="button" to="/game/history">
                  OPEN SEALED CHRONICLE
                </Link>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => {
                    leaveAdventure(normalizedRoomCode, characterId);
                    navigate("/game");
                  }}
                >
                  CLOSE JOURNEY // RETURN TO HALL
                </button>
              </div>
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
          <Panel title="HERO // PARTY VIEW" className="hero-panel">
            {(live.room?.players.length ?? 0) > 1 ? (
              <div className="party-hero-switcher" role="tablist" aria-label="Room Heroes">
                {live.room?.players.map((player) => {
                  const selected = player.character_id === inspectedCharacterId;
                  return (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      className={selected ? "is-active" : ""}
                      key={player.player_id}
                      onClick={() => setInspectedCharacterId(player.character_id)}
                    >
                      <span aria-hidden="true">{presenceFace(player.is_online, false)}</span>
                      <strong>{player.character_id === characterId ? "YOU" : player.name}</strong>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {displayHero ? (
              <div className="live-hero">
                <div className="live-hero-heading">
                  <div>
                    <span className="eyebrow">LEVEL {displayHero.level}</span>
                    <strong>{displayHero.name}</strong>
                  </div>
                  <span className={`hero-hp ${displayHero.is_alive ? "" : "is-fallen"}`}>
                    {displayHero.is_alive ? `HP ${displayHero.health}/${displayHero.max_health}` : "FALLEN"}
                  </span>
                </div>

                {displayHero.bio ? <p className="hero-bio-snippet">{displayHero.bio}</p> : null}

                <div className="hero-vital-row">
                  <span>HP</span>
                  <div className="meter" aria-label={`HP ${displayHero.health} of ${displayHero.max_health}`}>
                    <span
                      style={{
                        width: `${Math.max(0, Math.min(100, (displayHero.health / displayHero.max_health) * 100))}%`,
                      }}
                    />
                  </div>
                  <strong>{displayHero.health}/{displayHero.max_health}</strong>
                </div>

                <div className="xp-readout">
                  <div>
                    <span>XP {displayHero.experience}</span>
                    <span>{displayHero.xp_needed_for_next_level} TO NEXT</span>
                  </div>
                  <div className="xp-meter">
                    <span style={{ width: `${displayHero.xp_progress_percent}%` }} />
                  </div>
                </div>

                <div className="hero-stat-segments" aria-label="Core Hero attributes">
                  {CORE_STATS.map(([key, label]) => {
                    const value = Math.max(0, Math.min(7, displayHero.stats[key] ?? 0));
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

                {isInspectingSelf && hero && (hero.unspent_stat_points + hero.unspent_skill_points + hero.unspent_talent_points) > 0 ? (
                  <div className="hero-advancement-alert">
                    <strong>ADVANCEMENT READY</strong>
                    <span>
                      {hero.unspent_stat_points} ATTR // {hero.unspent_skill_points} SKILL // {hero.unspent_talent_points} TALENT
                    </span>
                  </div>
                ) : null}

                {inspectedResult ? (
                  <section className={`hero-last-check ${inspectedResult.check?.outcome ? `is-${inspectedResult.check.outcome}` : ""}`}>
                    <div className="hero-last-check-heading">
                      <span className="eyebrow">LAST CHECK</span>
                      <strong>+{inspectedResult.xp_reward} XP</strong>
                    </div>

                    {inspectedResult.check ? (
                      <>
                        <div className="hero-dice-readout">
                          <div>
                            <span>D20</span>
                            <strong>{inspectedResult.check.roll}</strong>
                          </div>
                          <span>+</span>
                          <div>
                            <span>MOD</span>
                            <strong>{signed(inspectedResult.check.total_modifier)}</strong>
                          </div>
                          <span>=</span>
                          <div>
                            <span>TOTAL</span>
                            <strong>{inspectedResult.check.total}</strong>
                          </div>
                          <span>/</span>
                          <div>
                            <span>DC</span>
                            <strong>{inspectedResult.check.difficulty}</strong>
                          </div>
                        </div>
                        <div className="hero-check-outcome">
                          <strong>{outcomeLabel(inspectedResult.check.outcome)}</strong>
                          <span>
                            {(inspectedResult.check.skill ?? inspectedResult.check.stat ?? "CHECK").toUpperCase()}
                            {inspectedResult.check.challenge_tier
                              ? ` // ${inspectedResult.check.challenge_tier.toUpperCase()}`
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

                    {inspectedProgression?.leveled_up ? (
                      <div className="hero-level-flash">
                        LEVEL UP // {inspectedProgression.level_before} → {inspectedProgression.level_after}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {displayHero.effects.length > 0 ? (
                  <div className="hero-effect-list">
                    {displayHero.effects
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

                {isInspectingSelf ? (
                  <Link className="hero-sheet-link" to={`/game/heroes/${encodeURIComponent(characterId)}`}>
                    OPEN YOUR CHARACTER SHEET →
                  </Link>
                ) : (
                  <div className="party-hero-readonly">
                    READ-ONLY PARTY VIEW // {inspectedRoomPlayer?.is_online ? "ONLINE" : "OFFLINE"}
                  </div>
                )}
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
              <div className="ascii-picker ascii-reaction-library" aria-label="ASCII reaction picker">
                {ASCII_REACTION_GROUPS.map((group) => (
                  <section className="ascii-reaction-group" key={group}>
                    <span>{group}</span>
                    <div>
                      {ASCII_REACTIONS.filter((reaction) => reaction.group === group).map((reaction) => (
                        <button
                          type="button"
                          key={`${group}:${reaction.value}`}
                          title={reaction.label}
                          aria-label={`${reaction.label}: ${reaction.value}`}
                          onClick={() => insertAsciiFace(reaction.value)}
                        >
                          {reaction.value}
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : null}
          </Panel>
        </aside>
      </div>

      {showLevelUp && lastLocalProgression ? (
        <LevelUpModal
          heroName={hero?.name ?? localRoomPlayer?.name ?? "Hero"}
          update={lastLocalProgression}
          onContinue={() => setDismissedLevelUpKey(levelUpKey)}
        />
      ) : null}

      <QuickEventModal
        event={
          theater.phase === "none" && !showLevelUp
            ? live.game?.pending_micro_event ?? null
            : null
        }
        resolution={
          theater.phase === "none" && !showLevelUp
            ? live.microEventResolution
            : null
        }
        playerId={live.playerId}
        requiredResponses={
          live.game?.readiness.filter(
            (player) => player.online,
          ).length ?? 1
        }
        playMode={live.game?.play_mode}
        onChoose={live.submitMicroEventChoice}
        onDismissResolution={live.dismissMicroEventResolution}
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
