import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GameState,
  ServerErrorPayload,
  StoryAdvancingPayload,
  TurnLockCountdownPayload,
  TurnResolvedPayload,
} from "../../services/game";

export type TurnTheaterPhase =
  | "none"
  | "lock-countdown"
  | "intermission"
  | "story-ready"
  | "resolution"
  | "retry";

function receiptKey(receipt: TurnResolvedPayload | null) {
  if (!receipt) return "";

  return [
    receipt.room_code,
    receipt.turn_number ?? "?",
    receipt.previous_scene_id ?? "?",
    receipt.scene_id ?? "?",
  ].join(":");
}

function acknowledgementStorageKey(roomCode: string, characterId: string) {
  return `tot:turn-receipt:${roomCode}:${characterId}`;
}

function readAcknowledgedReceipt(roomCode: string, characterId: string) {
  try {
    return sessionStorage.getItem(
      acknowledgementStorageKey(roomCode, characterId),
    ) ?? "";
  } catch {
    return "";
  }
}

function writeAcknowledgedReceipt(
  roomCode: string,
  characterId: string,
  key: string,
) {
  try {
    sessionStorage.setItem(
      acknowledgementStorageKey(roomCode, characterId),
      key,
    );
  } catch {
    // Presentation recovery should never block the game if storage is denied.
  }
}

export interface TurnTheaterState {
  phase: TurnTheaterPhase;
  countdownValue: number;
  activeReceipt: TurnResolvedPayload | null;
  activeIntermission: StoryAdvancingPayload | null;
  retryMessage: string;
  finishIntermissionStoryReady: () => void;
  acknowledgeResolution: () => void;
}

export function useTurnTheater({
  roomCode,
  characterId,
  game,
  lockCountdown,
  storyAdvancing,
  lastTurn,
  retryableError,
}: {
  roomCode: string;
  characterId: string;
  game: GameState | null;
  lockCountdown: TurnLockCountdownPayload | null;
  storyAdvancing: StoryAdvancingPayload | null;
  lastTurn: TurnResolvedPayload | null;
  retryableError: ServerErrorPayload | null;
}): TurnTheaterState {
  const [phase, setPhase] = useState<TurnTheaterPhase>("none");
  const [countdownValue, setCountdownValue] = useState(0);
  const [activeReceipt, setActiveReceipt] = useState<TurnResolvedPayload | null>(null);
  const [activeIntermission, setActiveIntermission] = useState<StoryAdvancingPayload | null>(null);

  const lockTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const readyFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingReceiptRef = useRef<TurnResolvedPayload | null>(null);
  const activeIntermissionRef = useRef<StoryAdvancingPayload | null>(null);
  const lastLockSignalRef = useRef("");

  const retryMessage = useMemo(
    () => retryableError?.message ?? "The Story Director paused before finishing this turn.",
    [retryableError],
  );

  const clearLockTimer = useCallback(() => {
    if (lockTimerRef.current !== null) {
      clearInterval(lockTimerRef.current);
      lockTimerRef.current = null;
    }
  }, []);

  const clearReadyTimer = useCallback(() => {
    if (readyTimerRef.current !== null) {
      clearInterval(readyTimerRef.current);
      readyTimerRef.current = null;
    }
  }, []);

  const clearReadyFallback = useCallback(() => {
    if (readyFallbackRef.current !== null) {
      clearTimeout(readyFallbackRef.current);
      readyFallbackRef.current = null;
    }
  }, []);

  const rememberIntermission = useCallback((payload: StoryAdvancingPayload | null) => {
    activeIntermissionRef.current = payload;
    setActiveIntermission(payload);
  }, []);

  const finishIntermissionStoryReady = useCallback(() => {
    clearLockTimer();
    clearReadyTimer();
    clearReadyFallback();
    setCountdownValue(0);
    setPhase("resolution");
  }, [clearLockTimer, clearReadyTimer, clearReadyFallback]);

  const beginStoryReady = useCallback((
    receipt: TurnResolvedPayload,
    preserveIntermission: boolean,
  ) => {
    clearLockTimer();
    clearReadyTimer();
    clearReadyFallback();
    pendingReceiptRef.current = null;
    setActiveReceipt(receipt);
    setPhase("story-ready");
    setCountdownValue(3);

    const started = performance.now();
    const durationMs = 3000;

    const tick = () => {
      const elapsed = performance.now() - started;
      const remaining = Math.max(0, durationMs - elapsed);
      setCountdownValue(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        clearReadyTimer();
        setCountdownValue(0);

        if (preserveIntermission) {
          // The React intermission runtime submits the final score before it
          // releases the resolution theater. This safety valve prevents a UI
          // exception from trapping the room forever.
          readyFallbackRef.current = setTimeout(() => {
            readyFallbackRef.current = null;
            setPhase("resolution");
          }, 1200);
          return;
        }

        setPhase("resolution");
      }
    };

    tick();
    readyTimerRef.current = setInterval(tick, 80);
  }, [clearLockTimer, clearReadyTimer, clearReadyFallback]);

  const beginLockCountdown = useCallback((seconds: number) => {
    clearLockTimer();
    clearReadyTimer();
    clearReadyFallback();
    setPhase("lock-countdown");

    const durationMs = Math.max(1, seconds) * 1000;
    const started = performance.now();

    const tick = () => {
      const elapsed = performance.now() - started;
      const remaining = Math.max(0, durationMs - elapsed);
      setCountdownValue(Math.ceil(remaining / 1000));

      if (remaining <= 0) {
        clearLockTimer();
        setCountdownValue(0);

        const queuedReceipt = pendingReceiptRef.current;
        if (queuedReceipt) {
          beginStoryReady(
            queuedReceipt,
            Boolean(activeIntermissionRef.current),
          );
          return;
        }

        setPhase("intermission");
      }
    };

    tick();
    lockTimerRef.current = setInterval(tick, 80);
  }, [beginStoryReady, clearLockTimer, clearReadyTimer, clearReadyFallback]);

  useEffect(() => {
    clearLockTimer();
    clearReadyTimer();
    clearReadyFallback();
    pendingReceiptRef.current = null;
    activeIntermissionRef.current = null;
    lastLockSignalRef.current = "";
    setPhase("none");
    setCountdownValue(0);
    setActiveReceipt(null);
    setActiveIntermission(null);
  }, [roomCode, characterId, clearLockTimer, clearReadyTimer, clearReadyFallback]);

  useEffect(() => {
    return () => {
      clearLockTimer();
      clearReadyTimer();
      clearReadyFallback();
    };
  }, [clearLockTimer, clearReadyTimer, clearReadyFallback]);

  useEffect(() => {
    if (!lockCountdown) return;
    if (lockCountdown.room_code !== roomCode) return;

    const signalKey = `${lockCountdown.turn_number}:${lockCountdown.duration_seconds}`;
    if (lastLockSignalRef.current === signalKey) return;

    lastLockSignalRef.current = signalKey;
    beginLockCountdown(lockCountdown.duration_seconds);
  }, [lockCountdown, roomCode, beginLockCountdown]);

  useEffect(() => {
    if (!storyAdvancing || storyAdvancing.room_code !== roomCode) return;

    rememberIntermission({
      ...storyAdvancing,
      submitted_player_ids: storyAdvancing.submitted_player_ids ?? [],
    });

    if (phase !== "lock-countdown" && phase !== "story-ready" && phase !== "resolution") {
      setPhase("intermission");
    }
  }, [storyAdvancing, roomCode, phase, rememberIntermission]);

  useEffect(() => {
    if (!game) return;

    if (game.pending_intermission) {
      rememberIntermission({
        room_code: game.room_code,
        turn_number: game.turn_number,
        game_id: game.pending_intermission.game_id,
        play_mode: game.pending_intermission.play_mode,
        intermission_stats: game.pending_intermission.intermission_stats,
        submitted_player_ids: game.pending_intermission.submitted_player_ids ?? [],
      });
    }

    if (
      game.turn_pending &&
      phase !== "lock-countdown" &&
      phase !== "story-ready" &&
      phase !== "resolution" &&
      !game.director_retry_required
    ) {
      setPhase("intermission");
    }

    const required = Math.max(1, game.required_players || 1);
    const locked = game.readiness.filter((player) => player.ready).length;

    if (
      !game.turn_pending &&
      locked >= required &&
      phase === "none" &&
      !game.director_retry_required
    ) {
      beginLockCountdown(3);
    }
  }, [game, phase, beginLockCountdown, rememberIntermission]);

  useEffect(() => {
    if (!lastTurn || lastTurn.room_code !== roomCode) return;

    const key = receiptKey(lastTurn);
    if (!key) return;

    const acknowledged = readAcknowledgedReceipt(roomCode, characterId);
    if (acknowledged === key) return;

    const durableKey = receiptKey(game?.last_turn_result ?? null);
    const isFreshEventReceipt = Boolean(durableKey && durableKey !== key) || !durableKey;

    if (game?.turn_pending && activeReceipt === null && !isFreshEventReceipt) {
      pendingReceiptRef.current = null;
      return;
    }

    if (phase === "lock-countdown") {
      pendingReceiptRef.current = lastTurn;
      return;
    }

    if (activeReceipt && receiptKey(activeReceipt) === key) return;

    beginStoryReady(
      lastTurn,
      phase === "intermission" || Boolean(activeIntermissionRef.current),
    );
  }, [
    lastTurn,
    roomCode,
    characterId,
    game?.turn_pending,
    game?.last_turn_result,
    phase,
    activeReceipt,
    beginStoryReady,
  ]);

  useEffect(() => {
    if (!game?.director_retry_required && !retryableError) return;
    if (activeReceipt || phase === "resolution" || phase === "story-ready") return;

    clearLockTimer();
    clearReadyTimer();
    clearReadyFallback();
    setPhase("retry");
  }, [
    game?.director_retry_required,
    retryableError,
    activeReceipt,
    phase,
    clearLockTimer,
    clearReadyTimer,
    clearReadyFallback,
  ]);

  const acknowledgeResolution = useCallback(() => {
    if (activeReceipt) {
      const key = receiptKey(activeReceipt);
      if (key) {
        writeAcknowledgedReceipt(roomCode, characterId, key);
      }
    }

    clearLockTimer();
    clearReadyTimer();
    clearReadyFallback();
    pendingReceiptRef.current = null;
    rememberIntermission(null);
    setActiveReceipt(null);
    setCountdownValue(0);
    setPhase("none");
  }, [
    activeReceipt,
    roomCode,
    characterId,
    clearLockTimer,
    clearReadyTimer,
    clearReadyFallback,
    rememberIntermission,
  ]);

  return {
    phase,
    countdownValue,
    activeReceipt,
    activeIntermission,
    retryMessage,
    finishIntermissionStoryReady,
    acknowledgeResolution,
  };
}
