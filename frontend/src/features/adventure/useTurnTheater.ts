import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GameState,
  ServerErrorPayload,
  StoryAdvancingPayload,
  TurnLockCountdownPayload,
  TurnResolvedPayload,
} from "../../services/game";
import { latestTurnReceipt, mergeTurnReceipt, receiptKey } from "./turnFlow";

export type TurnTheaterPhase =
  | "none"
  | "lock-countdown"
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
  retryMessage: string;
  finishIntermissionStoryReady: () => void;
  acknowledgeResolution: () => void;
}

export function useTurnTheater({
  roomCode, characterId, game, lockCountdown, storyAdvancing,
  turnReceipt, lastTurn, retryableError, error,
}: {
  roomCode: string;
  characterId: string;
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
  const lastLockSignalRef = useRef("");
  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  const clearTimers = useCallback(() => {
    if (lockTimerRef.current !== null) clearInterval(lockTimerRef.current);
    if (readyTimerRef.current !== null) clearInterval(readyTimerRef.current);
    lockTimerRef.current = null;
    readyTimerRef.current = null;
  }, []);

  const finishTurnPresentation = useCallback(() => {
    clearTimers();
    pendingReceiptRef.current = null;
    showReceipt(null);
    rememberIntermission(null);
    setCountdownValue(0);
    transition("none");
  }, [clearTimers, showReceipt, rememberIntermission, transition]);

  const finishIntermissionStoryReady = useCallback(() => {
    // The dice were already displayed BEFORE the Arcade. Never show them again.
    finishTurnPresentation();
  }, [finishTurnPresentation]);

  const beginStoryReady = useCallback(() => {
    if (phaseRef.current === "story-ready") return;
    clearTimers();
    transition("story-ready");
    const started = performance.now();
    const durationMs = 3000;
    const tick = () => {
      const remaining = Math.max(0, durationMs - (performance.now() - started));
      setCountdownValue(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        clearTimers();
        // Arcade component completes its score submission before releasing the overlay.
        // A plain writing intermission has no arcade runtime to call us back.
        if (!intermissionRef.current) finishTurnPresentation();
      }
    };
    tick();
    readyTimerRef.current = setInterval(tick, 80);
  }, [clearTimers, transition, finishTurnPresentation]);

  const beginLockCountdown = useCallback((seconds: number) => {
    clearTimers();
    transition("lock-countdown");
    const started = performance.now();
    const durationMs = Math.max(1, seconds) * 1000;
    const tick = () => {
      const remaining = Math.max(0, durationMs - (performance.now() - started));
      setCountdownValue(Math.ceil(remaining / 1000));
      if (remaining > 0) return;
      clearTimers();
      setCountdownValue(0);
      const receipt = pendingReceiptRef.current;
      pendingReceiptRef.current = null;
      if (receipt && readAcknowledgedReceipt(roomCode, characterId) !== receiptKey(receipt)) {
        showReceipt(receipt);
        transition("resolution");
      } else if (latestGameRef.current?.director_retry_required) {
        transition("retry");
      } else if (latestGameRef.current?.turn_pending || intermissionRef.current) {
        transition("intermission");
      } else {
        transition("none");
      }
    };
    tick();
    lockTimerRef.current = setInterval(tick, 80);
  }, [clearTimers, transition, roomCode, characterId, showReceipt]);

  useEffect(() => {
    acknowledgedRef.current = readAcknowledgedReceipt(roomCode, characterId);
    lastLockSignalRef.current = "";
    finishTurnPresentation();
  }, [roomCode, characterId, finishTurnPresentation]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    if (game?.started) return;
    if (phaseRef.current !== "none" || receiptRef.current || intermissionRef.current) {
      finishTurnPresentation();
    }
  }, [game?.started, finishTurnPresentation]);

  useEffect(() => {
    if (!game?.started || !lockCountdown || lockCountdown.room_code !== roomCode) return;
    if (lockCountdown.turn_number !== game.turn_number) return;
    const key = `${roomCode}:${lockCountdown.turn_number}:${lockCountdown.duration_seconds}`;
    if (lastLockSignalRef.current === key) return;
    lastLockSignalRef.current = key;
    if (phaseRef.current === "none") beginLockCountdown(lockCountdown.duration_seconds);
  }, [lockCountdown, roomCode, game?.started, game?.turn_number, beginLockCountdown]);

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

  // A single pipeline reconciles the preliminary event, final socket event and
  // durable room snapshot. Previously two effects raced and replayed the receipt.
  useEffect(() => {
    if (!game?.started) return;
    const incoming = latestTurnReceipt(roomCode, game.turn_number, game.turn_pending,
      [turnReceipt, lastTurn, game.last_turn_result]);
    if (!incoming) return;
    const key = receiptKey(incoming);
    const alreadyRead = acknowledgedRef.current === key
      || readAcknowledgedReceipt(roomCode, characterId) === key;
    const current = receiptRef.current;

    if (current && receiptKey(current) === key) {
      showReceipt(mergeTurnReceipt(current, incoming));
      if (alreadyRead && !incoming.preliminary && phaseRef.current === "intermission") {
        beginStoryReady();
      }
      return;
    }

    if (alreadyRead) {
      // An acknowledged early receipt never comes back when the final event
      // arrives, even if the socket event and snapshot are reordered.
      if (!incoming.preliminary && phaseRef.current === "intermission") {
        beginStoryReady();
      }
      // Snapshots always carry the last completed receipt. Seeing it again
      // must NEVER cancel a new countdown or interrupt a later story turn.
      return;
    }

    if (phaseRef.current === "lock-countdown") {
      pendingReceiptRef.current = incoming;
      return;
    }
    clearTimers();
    showReceipt(incoming);
    setCountdownValue(0);
    transition("resolution");
  }, [game?.started, game?.turn_number, game?.turn_pending, game?.last_turn_result,
    turnReceipt, lastTurn, roomCode, characterId, showReceipt, clearTimers,
    transition, beginStoryReady, finishTurnPresentation]);

  // Reconstruct missed writing events after reconnect; never infer a countdown
  // from party-presence flags. Only the server's actual lock signal can do that.
  useEffect(() => {
    if (!game?.started) return;
    if (game.director_retry_required) {
      if (phaseRef.current === "none" || phaseRef.current === "intermission") {
        clearTimers();
        transition("retry");
      }
    } else if (game.turn_pending) {
      if (phaseRef.current === "none") transition("intermission");
    } else if (phaseRef.current === "retry") {
      transition("none");
    }
  }, [game?.started, game?.turn_pending, game?.director_retry_required, clearTimers, transition]);

  const acknowledgeResolution = useCallback(() => {
    const receipt = receiptRef.current;
    if (receipt) {
      const key = receiptKey(receipt);
      if (key) {
        acknowledgedRef.current = key;
        writeAcknowledgedReceipt(roomCode, characterId, key);
      }
    }
    showReceipt(null);
    const currentGame = latestGameRef.current;
    if (currentGame?.director_retry_required) {
      transition("retry");
    } else if (currentGame?.turn_pending && receipt?.preliminary !== false) {
      transition("intermission");
    } else {
      finishTurnPresentation();
    }
  }, [roomCode, characterId, showReceipt, transition, finishTurnPresentation]);

  const arcadeAvailable = Boolean(activeIntermission && (
    phase === "story-ready"
    || (game?.turn_pending && acknowledgedRef.current === `${roomCode}:${game.turn_number}`)
  ));

  return {
    phase, countdownValue, activeReceipt, activeIntermission, arcadeAvailable,
    retryMessage, finishIntermissionStoryReady, acknowledgeResolution,
  };
}
