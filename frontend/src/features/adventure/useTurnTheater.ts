import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GameState,
  ServerErrorPayload,
  StoryAdvancingPayload,
  TurnLockCountdownPayload,
  TurnResolvedPayload,
} from "../../services/game";
import { latestTurnReceipt, mergeTurnReceipt, receiptKey, resolvedTurnNumber } from "./turnFlow";

export type TurnTheaterPhase =
  | "none"
  | "intermission"
  | "story-ready"
  | "resolution"
  | "retry";

function acknowledgementStorageKey(roomCode: string, characterId: string) {
  return `tot:turn-receipt:${roomCode}:${characterId}`;
}

function readAcknowledgedReceipt(roomCode: string, characterId: string) {
  try {
    return sessionStorage.getItem(acknowledgementStorageKey(roomCode, characterId)) ?? "";
  } catch {
    return "";
  }
}

function writeAcknowledgedReceipt(roomCode: string, characterId: string, key: string) {
  try {
    sessionStorage.setItem(acknowledgementStorageKey(roomCode, characterId), key);
  } catch {
    // Storage permissions must never strand gameplay.
  }
}

export interface TurnTheaterState {
  phase: TurnTheaterPhase;
  countdownValue: number;
  activeReceipt: TurnResolvedPayload | null;
  activeIntermission: StoryAdvancingPayload | null;
  arcadeAvailable: boolean;
  chapterReleased: boolean;
  retryMessage: string;
  serverProgress: string;
  finishIntermissionStoryReady: () => void;
  acknowledgeResolution: () => void;
}

/**
 * Server: choice -> frozen Python dice -> Director generates with those facts.
 * Browser: choice -> intermission -> close Arcade -> show frozen dice -> chapter.
 * A PRELIMINARY receipt is internal information, NEVER a signal to show dice.
 */
export function useTurnTheater({
  roomCode, characterId, resumeEpoch, game, lockCountdown, storyAdvancing,
  turnReceipt, lastTurn, retryableError, error,
}: {
  roomCode: string;
  characterId: string;
  resumeEpoch?: number;
  game: GameState | null;
  lockCountdown: TurnLockCountdownPayload | null;
  storyAdvancing: StoryAdvancingPayload | null;
  turnReceipt: TurnResolvedPayload | null;
  lastTurn: TurnResolvedPayload | null;
  retryableError: ServerErrorPayload | null;
  error: string;
}): TurnTheaterState {
  const [phase, setPhase] = useState<TurnTheaterPhase>("none");
  const [countdownValue, setCountdownValue] = useState(0);
  const [activeReceipt, setActiveReceipt] = useState<TurnResolvedPayload | null>(null);
  const [activeIntermission, setActiveIntermission] = useState<StoryAdvancingPayload | null>(null);
  const phaseRef = useRef<TurnTheaterPhase>("none");
  const receiptRef = useRef<TurnResolvedPayload | null>(null);
  const intermissionRef = useRef<StoryAdvancingPayload | null>(null);
  const pendingReceiptRef = useRef<TurnResolvedPayload | null>(null);
  const readyReceiptRef = useRef<TurnResolvedPayload | null>(null);
  const lastLockSignalRef = useRef("");
  const readyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const acknowledgedRef = useRef("");
  const latestGameRef = useRef<GameState | null>(game);
  latestGameRef.current = game;

  const retryMessage = useMemo(() => retryableError?.message
    || (game?.director_retry_required ? error : "")
    || "The Story Director paused before finishing this turn.",
  [retryableError, game?.director_retry_required, error]);

  const transition = useCallback((next: TurnTheaterPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const showReceipt = useCallback((next: TurnResolvedPayload | null) => {
    receiptRef.current = next;
    setActiveReceipt(next);
  }, []);

  const rememberIntermission = useCallback((next: StoryAdvancingPayload | null) => {
    intermissionRef.current = next;
    setActiveIntermission(next);
  }, []);

  const clearTimer = useCallback(() => {
    if (readyTimerRef.current !== null) clearInterval(readyTimerRef.current);
    readyTimerRef.current = null;
  }, []);

  const finishTurnPresentation = useCallback(() => {
    clearTimer();
    pendingReceiptRef.current = null;
    readyReceiptRef.current = null;
    showReceipt(null);
    rememberIntermission(null);
    setCountdownValue(0);
    transition("none");
  }, [clearTimer, showReceipt, rememberIntermission, transition]);

  const finishIntermissionStoryReady = useCallback(() => {
    // Intermission closes FIRST. The committed dice appear NEXT, and the
    // freshly authored chapter is revealed only after the dice are acknowledged.
    if (phaseRef.current !== "story-ready") return;
    const final = readyReceiptRef.current;
    // A late commit must not strand the UI in Story Ready after removing the
    // Arcade. Preserve the stage until the authoritative final receipt arrives.
    if (!final || final.preliminary) return; // Never display unfinished results.
    clearTimer();
    rememberIntermission(null);
    readyReceiptRef.current = null;
    showReceipt(final);
    transition("resolution");
  }, [clearTimer, rememberIntermission, showReceipt, transition]);

  const beginStoryReady = useCallback(() => {
    if (phaseRef.current !== "intermission" || !readyReceiptRef.current) return;
    clearTimer();
    transition("story-ready");
    const started = performance.now();
    const durationMs = 3000;
    const tick = () => {
      const remaining = Math.max(0, durationMs - (performance.now() - started));
      setCountdownValue(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        clearTimer();
        // Let IntermissionRuntime submit its final score and close its UI.
        // If no Arcade is available, this stage still closes before dice.
        if (!intermissionRef.current) finishIntermissionStoryReady();
      }
    };
    tick();
    readyTimerRef.current = setInterval(tick, 80);
  }, [clearTimer, transition, finishIntermissionStoryReady]);

  // Once the server has COMMITTED the new chapter, the page must not depend
  // forever on an Arcade component's optional animation/close callback. Give
  // the game time to save its score first, then advance exactly the same frozen
  // receipt through resolution. A missing final receipt never triggers this.
  useEffect(() => {
    if (phase !== "story-ready" || countdownValue > 0 ||
        !readyReceiptRef.current || readyReceiptRef.current.preliminary) return;
    // The recovery clock uses the same platform-neutral timer API as the
    // story-ready countdown. Keep it one-shot and cancel it on a phase change;
    // the turn-flow simulator also exercises this path without a DOM/window.
    const fallback = setInterval(() => {
      clearInterval(fallback);
      if (phaseRef.current === "story-ready" && readyReceiptRef.current &&
          !readyReceiptRef.current.preliminary) finishIntermissionStoryReady();
    }, 900);
    return () => clearInterval(fallback);
  }, [phase, countdownValue, activeIntermission, finishIntermissionStoryReady]);

  useEffect(() => {
    acknowledgedRef.current = readAcknowledgedReceipt(roomCode, characterId);
    lastLockSignalRef.current = "";
    finishTurnPresentation();
  // A socket rejoin is NOT a new adventure. Resetting on resumeEpoch erased
  // a committed receipt that might already have arrived just before the
  // resume_success event. Snapshot reconciliation above handles rejoin safely.
  }, [roomCode, characterId, finishTurnPresentation]);

  useEffect(() => () => clearTimer(), [clearTimer]);

  useEffect(() => {
    if (game?.started) return;
    if (phaseRef.current !== "none" || receiptRef.current || intermissionRef.current) {
      finishTurnPresentation();
    }
  }, [game?.started, finishTurnPresentation]);

  // The lock event is a notification that BOTH choices are committed, not a
  // reason to reveal or animate a die. Go straight to the writing intermission.
  useEffect(() => {
    if (!game?.started || !lockCountdown || lockCountdown.room_code !== roomCode) return;
    if (lockCountdown.turn_number !== game.turn_number) return;
    const key = `${roomCode}:${lockCountdown.turn_number}`;
    if (lastLockSignalRef.current === key) return;
    lastLockSignalRef.current = key;
    if (phaseRef.current === "none") transition("intermission");
  }, [lockCountdown, roomCode, game?.started, game?.turn_number, transition]);

  useEffect(() => {
    if (!game?.started || !game.pending_intermission) return;
    rememberIntermission({
      room_code: game.room_code,
      turn_number: game.turn_number,
      game_id: game.pending_intermission.game_id,
      play_mode: game.pending_intermission.play_mode,
      intermission_stats: game.pending_intermission.intermission_stats,
      submitted_player_ids: game.pending_intermission.submitted_player_ids ?? [],
    });
  }, [game?.started, game?.pending_intermission, game?.turn_number, game?.room_code, rememberIntermission]);

  useEffect(() => {
    if (!game?.started || !storyAdvancing || storyAdvancing.room_code !== roomCode) return;
    if (storyAdvancing.turn_number !== game.turn_number || !game.turn_pending) return;
    rememberIntermission({ ...storyAdvancing,
      submitted_player_ids: storyAdvancing.submitted_player_ids ?? [],
    });
  }, [storyAdvancing, roomCode, game?.started, game?.turn_number, game?.turn_pending, rememberIntermission]);

  useEffect(() => {
    if (!game?.started) return;
    const incoming = latestTurnReceipt(roomCode, game.turn_number, game.turn_pending,
      [turnReceipt, lastTurn, game.last_turn_result]);
    if (!incoming) return;
    const key = receiptKey(incoming);
    const alreadyRead = acknowledgedRef.current === key
      || readAcknowledgedReceipt(roomCode, characterId) === key;
    if (alreadyRead) return; // Stale snapshots never interrupt later turns.

    // Save the first authoritative dice, but DO NOT display them during writing.
    if (incoming.preliminary) {
      const current = pendingReceiptRef.current;
      if (!current || receiptKey(current) !== key) pendingReceiptRef.current = incoming;
      return;
    }

    const frozen = pendingReceiptRef.current;
    const committed = frozen && receiptKey(frozen) === key
      ? mergeTurnReceipt(frozen, incoming) : incoming;
    pendingReceiptRef.current = null;

    if (receiptRef.current && receiptKey(receiptRef.current) === key) {
      showReceipt(mergeTurnReceipt(receiptRef.current, committed));
      return;
    }

    // Non-final Director commits advance the turn number; a finale deliberately
    // retains its resolved turn number. Both are *committed* stories. Requiring
    // turn_number to advance strands the final dice and epilogue forever.
    let committedSceneReady = false;
    if (!game.turn_pending && game.turn_number > resolvedTurnNumber(committed)) {
      committedSceneReady = true;
    }
    if (!game.turn_pending && game.director_complete &&
        game.turn_number === resolvedTurnNumber(committed)) {
      committedSceneReady = true;
    }

    // turn_resolved is emitted by the server ONLY AFTER the new scene and
    // original dice receipt have been durably persisted. Its presence is
    // sufficient to begin the dice presentation even when a separate
    // game_state socket event is lost and this snapshot still says pending.
    // Restrict the fast path to the exact pending turn: a previous turn's
    // committed receipt cannot release the next turn's Arcade.
    const committedEventForPendingTurn = Boolean(
      game.turn_pending && resolvedTurnNumber(committed) === game.turn_number &&
      [turnReceipt, lastTurn].some((event) => Boolean(event && !event.preliminary &&
        receiptKey(event) === key)),
    );
    if (committedEventForPendingTurn) committedSceneReady = true;

    // An AI turn must finish and commit the authored scene before showing dice.
    // The next chapter remains behind the overlay until the player continues.
    const hadIntermission = Boolean(intermissionRef.current)
      || phaseRef.current === "intermission" || phaseRef.current === "story-ready";
    if (hadIntermission) {
      readyReceiptRef.current = committed;
      if (committedSceneReady) {
        if (phaseRef.current === "story-ready") {
          if (countdownValue === 0) finishIntermissionStoryReady();
        } else if (phaseRef.current === "intermission") {
          beginStoryReady();
        } else {
          // Reconnection may restore a committed receipt after the Arcade UI
          // was already discarded. Don't leave it sealed behind a dead stage.
          clearTimer();
          rememberIntermission(null);
          readyReceiptRef.current = null;
          showReceipt(committed);
          transition("resolution");
        }
      }
      return;
    }

    // Static/tutorial turns, and reconnect after a fully committed result,
    // have no running Arcade to close. Present the same durable dice once.
    if (committedSceneReady) {
      clearTimer();
      showReceipt(committed);
      transition("resolution");
    } else {
      readyReceiptRef.current = committed;
    }
  }, [game?.started, game?.turn_number, game?.turn_pending, game?.director_complete, game?.last_turn_result, resumeEpoch,
    turnReceipt, lastTurn, roomCode, characterId, showReceipt, clearTimer,
    transition, beginStoryReady, finishIntermissionStoryReady]);

  // PASS 66.38: a saved committed receipt is the authority for leaving the
  // Arcade, not a socket event, optional game callback, or a change of turn
  // number. Re-evaluate the current snapshot on *every* resumeEpoch/phase
  // transition as well as when a fresh game_state is received. Previously a
  // resume_success could reset the theater after game_state processing, with
  // nothing left to trigger receipt presentation until a hard page refresh.
  useEffect(() => {
    if (!game?.started || game.turn_pending) return;
    const saved = game.last_turn_result;
    if (!saved || saved.preliminary || saved.room_code !== roomCode) return;
    const turn = resolvedTurnNumber(saved);
    if (turn <= 0 || turn > game.turn_number || turn < game.turn_number - 1) return;
    const key = receiptKey(saved);
    if (!key || key === acknowledgedRef.current ||
        key === readAcknowledgedReceipt(roomCode, characterId)) return;
    if (phaseRef.current === "resolution" && receiptKey(receiptRef.current) === key) return;
    // The regular receipt effect may already be sequencing this same turn.
    // Do not restart it, discard its preliminary frozen dice, or cut short
    // the three-second 'story ready' countdown.
    if (readyReceiptRef.current && receiptKey(readyReceiptRef.current) === key) return;

    const preliminary = pendingReceiptRef.current;
    const committed = preliminary && receiptKey(preliminary) === key
      ? mergeTurnReceipt(preliminary, saved) : saved;
    pendingReceiptRef.current = null;

    if (phaseRef.current === "intermission") {
      readyReceiptRef.current = committed;
      beginStoryReady();
    } else if (phaseRef.current === "story-ready") {
      readyReceiptRef.current = committed;
      if (countdownValue === 0 && readyTimerRef.current === null) finishIntermissionStoryReady();
    } else if (phaseRef.current !== "resolution") {
      clearTimer();
      rememberIntermission(null);
      readyReceiptRef.current = null;
      showReceipt(committed);
      transition("resolution");
    }
  }, [game?.started, game?.turn_pending, game?.turn_number, game?.last_turn_result,
    resumeEpoch, phase, countdownValue, roomCode, characterId, beginStoryReady,
    finishIntermissionStoryReady, clearTimer, rememberIntermission, showReceipt, transition]);

  // The production console records exactly what the player can see, without
  // logging story text, auth tokens, or personal identifiers.
  // A full room resume is explicitly requesting the saved turn. Skip the
  // Arcade's optional countdown when a committed receipt is already there;
  // resetting that countdown on every socket rejoin used to strand the dice.
  const lastPresentedResumeEpochRef = useRef(resumeEpoch);
  useEffect(() => {
    const isNewResume = lastPresentedResumeEpochRef.current !== resumeEpoch;
    lastPresentedResumeEpochRef.current = resumeEpoch;
    if (!isNewResume || !game?.started || game.turn_pending) return;
    const saved = game.last_turn_result;
    if (!saved || saved.preliminary || saved.room_code !== roomCode) return;
    const key = receiptKey(saved);
    if (!key || key === acknowledgedRef.current ||
        key === readAcknowledgedReceipt(roomCode, characterId)) return;
    if (phaseRef.current === "resolution" && receiptKey(receiptRef.current) === key) return;
    clearTimer();
    pendingReceiptRef.current = null;
    readyReceiptRef.current = null;
    rememberIntermission(null);
    showReceipt(saved);
    transition("resolution");
  }, [resumeEpoch, game?.started, game?.turn_pending, game?.last_turn_result,
    roomCode, characterId, clearTimer, rememberIntermission, showReceipt, transition]);

  const lastLoggedRef = useRef("");
  useEffect(() => {
    if (!game?.started) return;
    const saved = game.last_turn_result;
    const info = {
      phase, turn: game.turn_number, serverPending: Boolean(game.turn_pending),
      directorActive: Boolean(game.director_request_active),
      retryRequired: Boolean(game.director_retry_required),
      savedReceipt: saved ? receiptKey(saved) : null,
      savedPreliminary: Boolean(saved?.preliminary),
      diceVisible: phase === "resolution" && Boolean(activeReceipt),
      nextChapterVisible: phase === "none" && !game.turn_pending,
    };
    const sig = JSON.stringify(info);
    if (lastLoggedRef.current === sig) return;
    lastLoggedRef.current = sig;
    if (typeof console !== "undefined") console.info("[Quillairo Turn] theater", info);
  }, [phase, game?.started, game?.turn_number, game?.turn_pending,
    game?.director_request_active, game?.director_retry_required,
    game?.last_turn_result, activeReceipt]);

  // On reconnect, reconstruct a pending Arcade and never treat lobby readiness
  // as a player choice. Retry does not re-roll the saved Python results.
  useEffect(() => {
    if (!game?.started) return;
    if (game.director_retry_required) {
      // Errors can arrive after the countdown has started. Always expose the
      // server's recovery action instead of trapping the player in Story Ready.
      if (phaseRef.current !== "resolution" && phaseRef.current !== "retry") {
        clearTimer();
        rememberIntermission(null);
        transition("retry");
      }
    } else if (game.turn_pending) {
      // A committed turn_resolved can reach the client before its game_state.
      // Once its dice have been acknowledged, do not reopen the old Arcade
      // while awaiting the saved next-scene snapshot.
      const justCommitted = [turnReceipt, lastTurn].find((receipt) => Boolean(
        receipt && !receipt.preliminary &&
        resolvedTurnNumber(receipt) === game.turn_number &&
        receiptKey(receipt) === acknowledgedRef.current,
      ));
      if (justCommitted) return;
      // A server-accepted retry keeps the same frozen dice and turn facts.
      // Leaving the theater on its error page after the request resumes makes
      // a healthy Director look stuck (especially after a reconnect). Only
      // leave retry once the *server* confirms the generation is active.
      if (phaseRef.current === "none" ||
          (phaseRef.current === "retry" && game.director_request_active)) {
        transition("intermission");
      }
    } else if (phaseRef.current === "retry") {
      if (readyReceiptRef.current) {
        showReceipt(readyReceiptRef.current);
        readyReceiptRef.current = null;
        transition("resolution");
      } else transition("none");
    }
  }, [game?.started, game?.turn_pending, game?.turn_number, game?.director_retry_required,
    game?.director_request_active, turnReceipt, lastTurn, clearTimer, showReceipt, transition]);

  const acknowledgeResolution = useCallback(() => {
    const receipt = receiptRef.current;
    if (!receipt || receipt.preliminary) return;
    const key = receiptKey(receipt);
    if (key) {
      acknowledgedRef.current = key;
      writeAcknowledgedReceipt(roomCode, characterId, key);
    }
    finishTurnPresentation();
  }, [roomCode, characterId, resumeEpoch, finishTurnPresentation]);

  const arcadeAvailable = Boolean(activeIntermission && (
    phase === "intermission" || phase === "story-ready"
  ));

  // A game_state snapshot can contain the NEXT scene before effects process
  // its final receipt. Keep that prose sealed even for the intervening render.
  const lastCommitted = game?.last_turn_result;
  const chapterReleased = phase === "none" && !game?.turn_pending && (
    !lastCommitted || readAcknowledgedReceipt(roomCode, characterId) === receiptKey({
      ...lastCommitted, room_code: roomCode,
    })
  );

  const serverProgress = !game ? "Reconnecting to saved room"
    : game.director_retry_required ? "Director stopped — retry available"
    : game.turn_pending && activeReceipt && !activeReceipt.preliminary
      ? "D20 results ready — refreshing the saved chapter"
    : game.turn_pending ? (game.director_request_active
      ? "Director still generating — checking saved chapter"
      : "Director not active — recovery needed")
    : game.last_turn_result && !game.last_turn_result.preliminary
      ? (phase === "resolution" ? "D20 results ready — continue after the consequences"
        : phase === "story-ready" ? "CHAPTER SAVED — revealing the D20"
        : phase === "none" ? "Chapter ready to read"
        : "CHAPTER SAVED — closing the Arcade")
      : "Waiting for committed story receipt";

  return {
    phase, countdownValue, activeReceipt, activeIntermission, arcadeAvailable, chapterReleased,
    retryMessage, serverProgress, finishIntermissionStoryReady, acknowledgeResolution,
  };
}
