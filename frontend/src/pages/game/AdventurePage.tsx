import { genreInkIllustration } from "../../features/appearance/quillairoGenreArt";
import "./adventureLiterary643.css";
import { NarratorVoicePicker } from "../../components/game/NarratorVoicePicker";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { observeStoryTime, prepareStoryTime, stopStoryTimeEngine, keepStoryTimeAlive, type StoryTimeState } from "../../services/storyTimeEngine";
import { RoomInviteButton } from "../../components/game/RoomInviteButton";
import { InkboundLiveRoom } from "./InkboundLiveRoom";
import { useSceneArtwork } from "../../features/adventure/useSceneArtwork";
import { InkboundLobby } from "./InkboundLobby";
import "./adventureRestorePass6673.css";
import { ShareMomentButton } from "../../components/game/ShareMomentButton";
import { LevelUpModal } from "../../features/adventure/LevelUpModal";
import { HeroDeathModal } from "../../features/adventure/HeroDeathModal";
import { QuickEventModal } from "../../features/adventure/QuickEventModal";
import { TurnTheater } from "../../features/adventure/TurnTheater";
import { useTurnTheater } from "../../features/adventure/useTurnTheater";
import { getCharacter, type Character } from "../../services/characters";
import type { SceneChoice } from "../../services/game";
import { rememberGameRoute } from "../../services/gameRouteMemory";
import {
  readAudioPreferences, writeAudioPreferences, AUDIO_PREFERENCES_CHANGED, NARRATION_PLAYBACK_SPEEDS,
  type AudioPreferences, narratorVoiceLabel,
} from "../../services/audioPreferences";
import { activateAudioFromGesture, playSound } from "../../services/audioDirector";
import {
  adjustNarrationVolume, choiceNarrationItems, observeNarration,
  pauseNarration, playNarration, resumeNarration, sceneNarrationItems, stopNarration,
  setAdventureNarratorVoice, setAdventureNarratorRoom, observeNarrationDiagnostics, resetNarrationDiagnostics,
  type NarrationDiagnostics, type NarrationState,
} from "../../services/storyNarrator";
import { createAutoReadGate } from "../../services/storyAutoReadGate";
import { readStoryDisplayPreferences, type StoryDisplayPreferences } from "../../services/storyPreferences";
import { useGameSocket } from "../../state/GameSocketContext";
import { useAuth } from "../../state/AuthContext";
import { useInkboundPaper } from "../../features/appearance/inkboundPaper";
import "./inkboundAdventurePass657.css";
import "./inkboundPass658.css";
import "./inkboundTurnPass659.css";
import "./inkboundPass6628.css";
import "./quillairoCinematicTurnPass6643.css";
import { useLiveAdventure } from "../../state/useLiveAdventure";
import { useModal } from "../../state/ModalContext";

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

export function AdventurePage() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const [inkPaper] = useInkboundPaper(user?.user_id ?? "");
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Quillairo (Inkbound) is the only reader. Retired ?reader= values are simply ignored.
  // Preserve the selected edition throughout reconnects, loading and turn
  // transitions; data readiness must never flash legacy terminal dialogs.
  const inkspacePaper = inkPaper;
  const { openModal, closeModal } = useModal();

  const {
    adventures,
    catalog,
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

  // Resolve story artwork and document IDs from the authoritative catalog.
  // This metadata is independent of the retired appearance/edition system.
  const worldCatalogItem = catalog.find(
    (item) => item.adventure_id === (live.game?.adventure_id ?? matchingAdventure?.adventure_id),
  );

  const normalizedRoomCode = roomId?.toUpperCase() ?? "";
  const turnNumber = live.game?.turn_number ?? matchingAdventure?.turn_number ?? 1;

  const theater = useTurnTheater({
    roomCode: normalizedRoomCode,
    characterId: characterId ?? "",
    resumeEpoch: live.resumeEpoch,
    game: live.game,
    lockCountdown: live.turnLockCountdown,
    storyAdvancing: live.storyAdvancing,
    turnReceipt: live.turnReceipt,
    lastTurn: live.lastTurn,
    retryableError: live.retryableError,
    error: live.error,
  });

  const [fieldNotes, setFieldNotes] = useState("");
  const [hero, setHero] = useState<Character | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState("");
  const [lockPending, setLockPending] = useState(false);
  const [dismissedLevelUpKey, setDismissedLevelUpKey] = useState("");
  const [dismissedDeathKey, setDismissedDeathKey] = useState("");
  const [storyPreferences, setStoryPreferences] = useState<StoryDisplayPreferences>(() =>
    readStoryDisplayPreferences(),
  );
  const [audioPreferences, setAudioPreferences] = useState<AudioPreferences>(() => readAudioPreferences());
  const [narration, setNarration] = useState<NarrationState>({ phase: "idle", label: "", error: "", cue: null });
  const [speechDiagnostics, setSpeechDiagnostics] = useState<NarrationDiagnostics>({
    localHits: 0, memoryHits: 0, s3Hits: 0, generated: 0, unknownResponses: 0,
    lastSource: null, lastWaitMs: null, lastServerMs: null, lastInferenceMs: null,
  });
  const [followVoice, setFollowVoice] = useState(true);
  const lastAutoNarration = useRef("");
  const autoReadGate = useRef(createAutoReadGate());
  const [storyTime, setStoryTime] = useState<StoryTimeState>({ phase: "idle", percent: null, message: "" });
  const narratorAvailable = storyTime.phase === "ready";

  const scene = live.game?.scene;
  const readiness = live.game?.readiness ?? [];
  const turnHistory = live.game?.turn_history ?? [];

  const localReadiness = readiness.find(
    (player) => player.player_id === live.playerId,
  );

  const localRoomPlayer = live.room?.players.find(
    (player) => player.character_id === characterId,
  );

  const partyHeroes = live.game?.party_heroes ?? [];

  const choiceLocked = Boolean(
    live.game?.started && (localReadiness?.ready || live.choiceAccepted),
  );

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

  // Progression is keyed by PLAYER ID on the server, not Character ID.
  // The old Character ID lookup silently hid death and level-up notices.
  const lastLocalProgression = live.lastTurn?.hero_progression
    ? (live.playerId ? live.lastTurn.hero_progression[live.playerId] : null)
      ?? Object.values(live.lastTurn.hero_progression).find(
        (update) => update.character_id === characterId,
      ) ?? null
    : null;

  const levelUpKey = lastLocalProgression?.leveled_up
    ? [
        normalizedRoomCode,
        live.lastTurn?.turn_number ?? turnNumber,
        characterId,
        lastLocalProgression.level_after,
      ].join(":")
    : "";

  const deathKey = lastLocalProgression?.died_this_turn
    ? `${normalizedRoomCode}:${live.lastTurn?.resolved_turn_number ?? turnNumber}:${characterId}:fallen`
    : "";
  const showDeath = Boolean(
    deathKey && dismissedDeathKey !== deathKey && theater.chapterReleased,
  );
  const showLevelUp = Boolean(
    levelUpKey &&
    dismissedLevelUpKey !== levelUpKey &&
    !lastLocalProgression?.died_this_turn &&
    theater.chapterReleased,
  );

  const canBeginAdventure = Boolean(live.game?.can_begin_adventure);

  const choicesBlocked =
    !connected ||
    live.status !== "ready" ||
    choiceLocked ||
    lockPending ||
    Boolean(live.game?.turn_pending) ||
    Boolean(live.game?.director_request_active) ||
    Boolean(live.game?.director_retry_required) ||
    Boolean(live.game?.pending_micro_event) ||
    theater.phase !== "none" ||
    !theater.chapterReleased;

  useEffect(() => {
    rememberGameRoute(`${location.pathname}${location.search}`);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const syncStoryPreferences = () => setStoryPreferences(readStoryDisplayPreferences());
    window.addEventListener("tot:story-display-changed", syncStoryPreferences);
    return () => window.removeEventListener("tot:story-display-changed", syncStoryPreferences);
  }, []);

  useEffect(() => {
    const syncAudio = () => setAudioPreferences(readAudioPreferences());
    window.addEventListener(AUDIO_PREFERENCES_CHANGED, syncAudio);
    return () => window.removeEventListener(AUDIO_PREFERENCES_CHANGED, syncAudio);
  }, []);

  useEffect(() => observeNarration(setNarration), []);
  useEffect(() => observeNarrationDiagnostics(setSpeechDiagnostics), []);
  useEffect(() => () => stopNarration(), []);
  useEffect(() => observeStoryTime(setStoryTime), []);
  useEffect(() => {
    if (audioPreferences.narrationEnabled && audioPreferences.storyTimeApproved && live.game?.started) {
      void prepareStoryTime().catch(() => {});
    }
  }, [audioPreferences.narrationEnabled, audioPreferences.storyTimeApproved, live.game?.started]);

  useEffect(() => {
    if (!normalizedRoomCode || live.status !== "ready" || !live.game) return;
    const enabled = audioPreferences.narrationEnabled && audioPreferences.storyTimeApproved;
    if (!enabled) {
      void keepStoryTimeAlive(normalizedRoomCode, false);
      return;
    }
    // Wake during the synopsis/lobby, NOT after Chapter One is revealed.
    void keepStoryTimeAlive(normalizedRoomCode);
    const interval = window.setInterval(() => { void keepStoryTimeAlive(normalizedRoomCode); }, 60_000);
    return () => {
      window.clearInterval(interval);
      void keepStoryTimeAlive(normalizedRoomCode, false);
    };
  }, [audioPreferences.narrationEnabled, audioPreferences.storyTimeApproved,
      normalizedRoomCode, live.status, Boolean(live.game)]);

  function toggleStoryTime() {
    if (audioPreferences.narrationEnabled) {
      setAudioPreferences(writeAudioPreferences({ narrationEnabled: false }));
      stopNarration();
      stopStoryTimeEngine();
      return;
    }
    setAudioPreferences(writeAudioPreferences({ storyTimeApproved: true, narrationEnabled: true }));
    void prepareStoryTime().catch(() => {});
  }

  function cycleNarrationSpeed() {
    const at = NARRATION_PLAYBACK_SPEEDS.findIndex(rate => rate === audioPreferences.narrationSpeed);
    const next = NARRATION_PLAYBACK_SPEEDS[(at + 1) % NARRATION_PLAYBACK_SPEEDS.length];
    setAudioPreferences(writeAudioPreferences({ narrationSpeed: next }));
  }

  // The host voice is only an initial room default/prefetch hint; each
  // participant's actual narration voice is their independent browser choice.
  const roomVoiceId = live.game?.narrator_voice ?? null;
  useEffect(() => {
    setAdventureNarratorVoice(live.game?.narrator_voice ?? null);
    setAdventureNarratorRoom(normalizedRoomCode);
    return () => { setAdventureNarratorVoice(null); setAdventureNarratorRoom(null); };
  }, [roomVoiceId, normalizedRoomCode]);

  // Existing restored chapters are not new chapter events. Record the first
  // authoritative snapshot for this mount (including private-browser sessions
  // with sessionStorage unavailable) before the auto-read effect can fire.
  const currentSpokenScene = live.game?.started && scene?.body
    ? `${normalizedRoomCode}:${turnNumber}:${scene.id}` : "";
  const autoReadIdentity = `${normalizedRoomCode}:${characterId ?? ""}`;
  useEffect(() => {
    autoReadGate.current.observe(autoReadIdentity, connected && live.status === "ready" && Boolean(live.game), currentSpokenScene);
  }, [autoReadIdentity, connected, live.status, live.game, currentSpokenScene]);

  // Never let a previous chapter, another room's voice, or disconnected player
  // keep speaking. Reconnect restores gameplay but NEVER replays old audio.
  useEffect(() => { stopNarration(); }, [normalizedRoomCode, characterId, roomVoiceId, scene?.id, turnNumber]);
  useEffect(() => {
    if (!connected || live.status !== "ready") stopNarration();
  }, [connected, live.status]);
  // Update the live audio element immediately when either personal playback setting changes.
  useEffect(() => { adjustNarrationVolume(); }, [audioPreferences.narrationVolume, audioPreferences.narrationSpeed]);
  useEffect(() => {
    if (!audioPreferences.narrationEnabled || !theater.chapterReleased ||
        !live.game?.started || live.game?.pending_micro_event || choiceLocked || showDeath || showLevelUp) {
      stopNarration();
    }
  }, [audioPreferences.narrationEnabled, theater.chapterReleased, live.game?.started,
      live.game?.pending_micro_event, choiceLocked, showDeath, showLevelUp]);

  // Mark each scene before attempting auto-play, so reconnects and repeated
  // Socket.IO snapshots never re-read old narration. Manual READ always works.
  useEffect(() => {
    if (!connected || !audioPreferences.narrationEnabled || !audioPreferences.narrationAutoPlay ||
        narratorAvailable !== true || !live.game?.started || !scene?.body ||
        !theater.chapterReleased || live.game?.pending_micro_event ||
        choiceLocked || showDeath || showLevelUp || live.status !== "ready") return;
    const key = `tot:spoken:${currentSpokenScene}`;
    if (!autoReadGate.current.isNewScene(autoReadIdentity, currentSpokenScene)) return;
    if (lastAutoNarration.current === key) return;
    lastAutoNarration.current = key;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch { /* Session storage is optional; in-memory identity below still applies. */ }
    void playNarration(sceneNarrationItems(scene.body, scene.choices, audioPreferences.narrationAutoChoices));
  }, [audioPreferences.narrationEnabled, audioPreferences.narrationAutoPlay,
      audioPreferences.narrationAutoChoices, narratorAvailable, live.game?.started,
      live.game?.pending_micro_event, live.status, scene?.id, scene?.body,
      theater.chapterReleased, choiceLocked, showDeath, showLevelUp, normalizedRoomCode, turnNumber,
      connected, currentSpokenScene, autoReadIdentity]);

  function narrateChapter() {
    if (!connected || live.status !== "ready" || !audioPreferences.narrationEnabled || !theater.chapterReleased || !scene?.body) return;
    void playNarration(sceneNarrationItems(scene.body, scene.choices, audioPreferences.narrationAutoChoices));
  }

  function narrateChoices() {
    if (!connected || live.status !== "ready" || !audioPreferences.narrationEnabled || !theater.chapterReleased) return;
    void playNarration(choiceNarrationItems(scene?.choices ?? []));
  }

  // A browser may suspend its audio engine on reload. Resume only from a real
  // user interaction, never on load or in response to a socket snapshot.
  useEffect(() => {
    if (!audioPreferences.effectsEnabled) return;
    const unlock = () => { activateAudioFromGesture(); };
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [audioPreferences.effectsEnabled]);

  useEffect(() => {
    if (live.game?.started && scene?.id && theater.chapterReleased) {
      playSound("chapter", `chapter:${normalizedRoomCode}:${turnNumber}:${scene.id}`);
    }
  }, [live.game?.started, scene?.id, theater.chapterReleased, normalizedRoomCode, turnNumber]);

  useEffect(() => {
    if (showDeath) playSound("death", `death:${deathKey}`);
  }, [showDeath, deathKey]);

  useEffect(() => {
    if (showLevelUp) playSound("level-up", `level:${levelUpKey}`);
  }, [showLevelUp, levelUpKey]);


  useEffect(() => {
    if (!characterId) return;

    let alive = true;

    getCharacter(characterId)
      .then((value) => {
        if (!alive) return;
        setHero(value);
      })
      .catch(() => {
        // The reader keeps the last known Hero record; a failed refresh is not fatal.
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

  useEffect(() => {
    if (live.status !== "ready") setLockPending(false);
  }, [live.status]);

  function selectChoice(choice: SceneChoice) {
    if (choicesBlocked) return;
    playSound("ui");

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

  function confirmSoloStart() {
    openModal({
      title: "SWITCH ROOM TO SOLO?",
      body: (
        <div className="modal-copy-stack">
          <p>This locks the journey to your Hero. A second Hero will no longer be able to join this room.</p>
          <div className="system-notice">The opening chapter is generated only after you begin the adventure.</div>
        </div>
      ),
      actions: (
        <div className="button-row modal-action-row">
          <button className="button" type="button" onClick={closeModal}>KEEP CO-OP</button>
          <button
            className="button button-primary"
            type="button"
            onClick={() => {
              closeModal();
              startSolo(normalizedRoomCode);
            }}
          >
            PLAY SOLO
          </button>
        </div>
      ),
    });
  }

  function lockChoice() {
    if (!selectedChoiceId || choicesBlocked) return;
    playSound("lock", `lock:${normalizedRoomCode}:${turnNumber}:${characterId}`);

    setLockPending(true);
    live.clearError();
    live.submitChoice(selectedChoiceId);
  }

  // Presentation-only mount point. The existing authoritative resolution receipt
  // is shown in the manuscript rail at desktop widths, not reimplemented here.
  const [resolutionHost, setResolutionHost] = useState<HTMLDivElement | null>(null);
  const inkboundReady = Boolean(live.status === "ready" && live.game?.started && scene);
  const inkboundLobbyReady = Boolean(live.status === "ready" && live.game && !live.game.started);
  const fantasyIllustration = Boolean(worldCatalogItem?.tags?.some((tag) => /fantasy|medieval|fairy|sword/i.test(tag)));
  const sceneArtReady = inkboundReady && theater.chapterReleased && theater.phase === "none"
    && !live.game?.director_request_active && !live.game?.turn_pending;
  const { imageUrl: sceneArtUrl, onImageError: onSceneArtError } = useSceneArtwork(
    normalizedRoomCode, scene?.id ?? "", sceneArtReady,
  );

  // Single existing finale presentation reused by Classic and the Inkbound
  // manuscript. The Inkbound layout hides Classic's DOM, so its summary must
  // live in the reader itself after the acknowledged dice/turn receipt.
  const finalePanel = live.finale ? (
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
                    title={`${live.finale.adventure_title} — Quillairo`}
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
                    // The finale panel is assembled before the no-Hero route guard below.
                    // Only leave the socket room when a valid Hero ID is available.
                    if (characterId) {
                      leaveAdventure(normalizedRoomCode, characterId);
                    }
                    navigate("/game");
                  }}
                >
                  END ADVENTURE HERE // RETURN TO HALL
                </button>
              </div>
            </section>
  ) : null;

  // Older completed rooms can lack the separate finale payload. In that
  // case there are no choices, but the player must still be able to leave.
  // This is a recovery affordance, not a second finale implementation.
  const completedRoomRecovery = live.game?.director_complete && !live.finale ? (
    <section className="finale-inline journey-finale-summary journey-recovery-summary" role="status">
      <header className="finale-summary-header"><div>
        <span className="eyebrow">THE ADVENTURE HAS ENDED</span>
        <h2>Your Hero may return to the Hall.</h2>
      </div></header>
      <p>This earlier adventure closed without its final Chronicle screen. You can release your Hero without deleting the character.</p>
      <div className="finale-actions">
        <button type="button" className="button button-primary" onClick={() => {
          if (characterId) leaveAdventure(normalizedRoomCode, characterId);
          navigate("/game");
        }} disabled={!connected}>RELEASE HERO // RETURN TO HALL</button>
      </div>
    </section>
  ) : null;

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
      {inkboundLobbyReady && live.game && <InkboundLobby
        roomCode={normalizedRoomCode}
        paper={inkPaper}
        title={live.game.adventure_title ?? matchingAdventure?.adventure_title ?? "Your next story"}
        synopsis={live.game.adventure_synopsis ?? ""}
        fantasyArtwork={fantasyIllustration}
        playMode={live.room?.play_mode ?? "solo"}
        players={live.room?.players ?? []}
        readiness={readiness}
        playerId={live.playerId}
        isHost={Boolean(localRoomPlayer?.is_host)}
        connected={connected && live.status === "ready"}
        canBeginAdventure={canBeginAdventure}
        chapterPreparing={Boolean(live.game.chapter_preparing)}
        canStartSolo={Boolean(live.game.can_start_solo)}
        onStartSolo={confirmSoloStart}
        narratorEnabled={audioPreferences.narrationEnabled}
        narratorName={narratorVoiceLabel(audioPreferences.narrationVoice)}
        onToggleNarrator={toggleStoryTime}
        onBeginAdventure={live.startAdventure}
      />}
      {inkboundReady && scene && <InkboundLiveRoom
        onResolutionHost={setResolutionHost}
        roomCode={normalizedRoomCode}
        adventureTitle={live.game?.adventure_title ?? matchingAdventure?.adventure_title ?? "The Chronicle"}
        paper={inkPaper}
        illustrationSrc={genreInkIllustration(worldCatalogItem?.title ?? (live.game?.adventure_title || ""), worldCatalogItem?.tags)}
        sceneArtUrl={sceneArtUrl}
        onSceneArtError={onSceneArtError}
        worldDocumentId={(worldCatalogItem?.metadata?.world_document_id as string | undefined) ?? null}
        briefDocumentId={(worldCatalogItem?.metadata?.brief_document_id as string | undefined) ?? null}
        turnNumber={turnNumber}
        scene={scene}
        chapterReleased={theater.chapterReleased && theater.phase === "none" && !live.game?.director_request_active && !live.game?.turn_pending || Boolean(completedRoomRecovery)}
        finalePanel={completedRoomRecovery ?? (theater.chapterReleased ? finalePanel : null)}
        narrativePacing={live.game?.narrative_pacing ?? null}
        lastResult={lastLocalResult}
        turnPhase={theater.phase}
        lastProgression={lastLocalProgression}
        wrapUpCallout={live.game?.wrap_up_active ? (
          <div className="ibl-ending-invitation" role="status">
            <strong>The final chapter has been called.</strong>
            <span>{live.game.wrap_up_turns_remaining} resolution turn(s) remain. Your choices still shape the ending.</span>
          </div>
        ) : live.game?.wrap_up_available && (live.game?.narrative_pacing?.act === 3 || (live.game?.target_turns != null && live.game.turn_number >= live.game.target_turns)) ? (
          <div className="ibl-ending-invitation">
            <strong>Ready to end this adventure?</strong>
            <p>Call the final chapter when the journey feels ready. Your next choice will shape the ending; in co-op, your companions must agree. Short solo stories also conclude at their selected length limit.</p>
            <button type="button" onClick={live.requestWrapUp}
              disabled={!connected || live.status !== "ready" || Boolean(live.playerId && live.game.wrap_up_votes.includes(live.playerId))}>
              {live.playerId && live.game.wrap_up_votes.includes(live.playerId) ? "Waiting for your companions" : "End this adventure here →"}
            </button>
          </div>
        ) : null}
        playerName={localRoomPlayer?.name ?? "Adventurer"}
        hero={partyHeroes.find((p) => p.character_id === characterId) ?? hero ?? null}
        party={live.room?.players ?? []}
        history={turnHistory}
        messages={live.messages}
        connected={connected && live.status === "ready"}
        selectedChoiceId={selectedChoiceId}
        choiceLocked={choiceLocked}
        lockPending={lockPending}
        choicesBlocked={choicesBlocked}
        onSelectChoice={selectChoice}
        canListenChoice={audioPreferences.narrationEnabled && connected && live.status === "ready" && narratorAvailable === true && theater.chapterReleased && !live.game?.pending_micro_event && !choiceLocked && !showDeath}
        onListenChoice={(choice, index) => { void playNarration([{ text: `Option ${index + 1}. ${choice.label}`, label: `CHOICE ${index + 1}`, kind: "choice" }]); }}
        onLockChoice={lockChoice}
        onSendChat={(message) => { if (connected && live.status === "ready") live.sendChat(message); }}
        notes={fieldNotes}
        onNotesChange={setFieldNotes}
        narrationEnabled={audioPreferences.narrationEnabled}
        wordRevealEnabled={storyPreferences.wordReveal}
        decorativeInitials={storyPreferences.decorativeInitials}
        followNarration={audioPreferences.narrationEnabled && followVoice && narration.cue?.kind === "story" && (narration.phase === "playing" || narration.phase === "paused")}
        narrationCue={theater.chapterReleased && (narration.phase === "playing" || narration.phase === "paused") ? narration.cue : null}
        onToggleStoryTime={toggleStoryTime}
        sessionUtilities={<>
          <button type="button" aria-pressed={audioPreferences.effectsEnabled} onClick={() => {
            const next = writeAudioPreferences({ effectsEnabled: !audioPreferences.effectsEnabled });
            setAudioPreferences(next);
            if (next.effectsEnabled) { activateAudioFromGesture(); playSound("ui"); }
          }}>{audioPreferences.effectsEnabled ? "Sound effects · on" : "Sound effects · off"}</button>
          {audioPreferences.narrationEnabled && <>
            <span className="ibl-utility-label">Narrator voice</span>
            <NarratorVoicePicker value={audioPreferences.narrationVoice} onChange={(voice) => setAudioPreferences(writeAudioPreferences({ narrationVoice: voice }))} />
            <span className="ibl-utility-label" title="Voice selection belongs to your browser and can change during the adventure.">Your voice · {narratorVoiceLabel(audioPreferences.narrationVoice)} · volume {audioPreferences.narrationVolume}%</span>
            <button type="button" onClick={cycleNarrationSpeed}>Reading speed · {audioPreferences.narrationSpeed}×</button>
            <button type="button" aria-pressed={audioPreferences.narrationDramaticPacing} onClick={() => setAudioPreferences(writeAudioPreferences({ narrationDramaticPacing: !audioPreferences.narrationDramaticPacing }))}>Dramatic pacing · {audioPreferences.narrationDramaticPacing ? "on" : "off"}</button>
            <button type="button" aria-pressed={followVoice} aria-label="Follow the approximate spoken sentence in the visible chapter" onClick={() => setFollowVoice((value) => !value)}>Follow voice · {followVoice ? "on" : "off"}</button>
            <button type="button" onClick={narrateChapter} disabled={!connected || !narratorAvailable || !theater.chapterReleased || !scene?.body || Boolean(live.game?.pending_micro_event) || showDeath}>Read this chapter aloud →</button>
            <button type="button" onClick={narrateChoices} disabled={!connected || !narratorAvailable || !theater.chapterReleased || !scene?.choices.length || Boolean(live.game?.pending_micro_event) || choiceLocked || showDeath}>Read choices aloud →</button>
            {(narration.phase === "playing" || narration.phase === "loading" || narration.phase === "buffering") && <button type="button" onClick={pauseNarration}>Pause narration</button>}
            {narration.phase === "paused" && <button type="button" onClick={() => { void resumeNarration(); }}>Resume narration</button>}
            {narration.phase !== "idle" && <button type="button" onClick={stopNarration}>Stop narration</button>}
            <span className="ibl-utility-label" role="status" aria-live="polite">
              {!narratorAvailable
                ? storyTime.phase === "error" ? `Story Time error · ${storyTime.message}` : "Connecting to Story Time…"
                : narration.phase === "error" ? narration.error
                : narration.phase === "loading" ? `Preparing voice · ${narration.label}`
                : narration.phase === "buffering" ? `Buffering next passage · ${narration.label}`
                : narration.phase === "playing" ? `Reading · ${narration.label}`
                : narration.phase === "paused" ? "Narration paused" : ""}
            </span>
            <details className="ibl-voice-performance">
              <summary>Voice performance · this browser</summary>
              <div className="ibl-voice-performance-body">
                <span>Replay {speechDiagnostics.localHits} · Memory {speechDiagnostics.memoryHits} · S3 {speechDiagnostics.s3Hits} · Generated {speechDiagnostics.generated}</span>
                {speechDiagnostics.unknownResponses > 0 ? <span>Unreported {speechDiagnostics.unknownResponses}</span> : null}
                <span>Last {speechDiagnostics.lastSource?.toUpperCase() ?? "—"} · Wait {speechDiagnostics.lastWaitMs ?? "—"}ms · Server {speechDiagnostics.lastServerMs ?? "—"}ms · Inference {speechDiagnostics.lastInferenceMs ?? "—"}ms</span>
                <span>Estimated timings from completed requests. Cold-start waits and network time affect Wait; local replays need no new request.</span>
                <button type="button" onClick={resetNarrationDiagnostics}>Reset counters</button>
              </div>
            </details>
          </>}
          {live.room?.play_mode === "coop" && localRoomPlayer?.is_host && live.room.player_count < live.room.max_players &&
            <RoomInviteButton roomCode={normalizedRoomCode} adventureTitle={live.game?.adventure_title} className="ibl-utility-invite" label="Invite another player →" />}
          {live.game?.can_start_solo && localRoomPlayer?.is_host && <button type="button" onClick={confirmSoloStart}>Continue as solo →</button>}
          {live.game?.wrap_up_available && !live.game.wrap_up_active && <button type="button"
            disabled={!connected || live.status !== "ready" || Boolean(live.playerId && live.game.wrap_up_votes.includes(live.playerId))}
            onClick={live.requestWrapUp}>
            {live.playerId && live.game.wrap_up_votes.includes(live.playerId) ? "Final chapter requested" : "End this adventure here →"}
          </button>}
          {live.game?.wrap_up_active && <span className="ibl-utility-label" role="status">Final chapter · {live.game.wrap_up_turns_remaining} turns remaining</span>}
          {theater.chapterReleased && scene?.body && <ShareMomentButton title={`${scene.title} — Quillairo`}
            text={`${live.game?.adventure_title ?? "Quillairo"} // ${scene.title}\n${scene.body.slice(0,260)}`}
            url={`${window.location.origin}/`} label="Share this moment →" />}
        </>}
      />}
      {!inkboundReady && !inkboundLobbyReady && <main className="ink-restore" data-ink-paper={inkPaper} aria-live="polite">
        {completedRoomRecovery ?? (live.status === "ready" && theater.chapterReleased ? finalePanel : null)}
        {!completedRoomRecovery && !(live.status === "ready" && theater.chapterReleased && finalePanel) ? <section className="ink-restore-card" role="status">
          <span className="ink-restore-kicker">THE CHRONICLE</span>
          <h1>{live.status === "ready" ? "The next page is being prepared." : connected ? "Finding your place in the Chronicle." : "The thread was interrupted."}</h1>
          <p>{live.error || (live.status === "ready" ? "Your Hero and choices are safe. The story will appear here the moment it is ready." : "Your journey has been saved. Actions unlock once your place is restored.")}</p>
          <div className="ink-restore-actions">
            <button type="button" onClick={live.restore} disabled={live.status === "resuming"}>Reconnect</button>
            {live.error ? <button type="button" onClick={live.clearError}>Dismiss message</button> : null}
            <Link to="/game/adventures">My adventures</Link>
            <Link to="/game">Return to the Adventure Hall</Link>
          </div>
        </section> : null}
      </main>}


      {showDeath && lastLocalProgression ? (
        <HeroDeathModal
          heroName={hero?.name ?? localRoomPlayer?.name ?? "Hero"}
          update={lastLocalProgression}
          onContinue={() => setDismissedDeathKey(deathKey)}
        />
      ) : null}

      {showLevelUp && lastLocalProgression ? (
        <LevelUpModal
          heroName={hero?.name ?? localRoomPlayer?.name ?? "Hero"}
          update={lastLocalProgression}
          inkPaper={inkspacePaper}
          onContinue={() => setDismissedLevelUpKey(levelUpKey)}
        />
      ) : null}

      <QuickEventModal
        inkPaper={inkspacePaper}
        fantasyArtwork={fantasyIllustration}
        event={
          theater.phase === "none" && !showLevelUp && !showDeath
            ? live.game?.pending_micro_event ?? null
            : null
        }
        resolution={
          theater.phase === "none" && !showLevelUp && !showDeath
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
        resolutionHost={inkboundReady ? resolutionHost : null}
        inkPaper={inkspacePaper}
        choiceLabel={choiceLocked ? (live.choiceAccepted?.choice_label ?? selectedChoice?.label) : null}
        hero={(() => {
          const current = partyHeroes.find((item) => item.character_id === characterId);
          return current ? {
            name: current.name, level: current.level,
            health: current.health, maxHealth: current.max_health,
            xpPercent: current.xp_progress_percent,
          } : null;
        })()}
        partyCount={live.room?.players.length}
        theater={theater}
        playerId={live.playerId}
        intermissionResult={live.intermissionResult}
        onSubmitIntermissionScore={live.submitIntermissionScore}
        onSync={live.sync}
        onRecover={live.restore}
        committedTurnReady={Boolean(
          theater.activeIntermission && live.game && !live.game.turn_pending &&
          live.game.last_turn_result && !live.game.last_turn_result.preliminary &&
          Number(live.game.last_turn_result.resolved_turn_number ?? live.game.last_turn_result.turn_number) ===
            theater.activeIntermission.turn_number
        )}
        onRetry={() => {
          live.clearRetryableError();
          live.retryPendingTurn();
        }}
      />
    </>
  );
}
