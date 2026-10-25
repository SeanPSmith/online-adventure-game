import { useCallback, useEffect, useRef, useState } from "react";
import { getGameSocket } from "../services/socket";
import type {
  ChatMessage,
  ChoiceAcceptedPayload,
  FinalePayload,
  GameState,
  IntermissionResult,
  MicroEventUpdatedPayload,
  QuickEvent,
  ResumeSuccessPayload,
  RoomState,
  ServerErrorPayload,
  StoryAdvancingPayload,
  TurnLockCountdownPayload,
  TurnResolvedPayload,
} from "../services/game";

let pendingDetachTimer: ReturnType<typeof setTimeout> | null = null;

function cancelPendingDetach() {
  if (pendingDetachTimer !== null) {
    clearTimeout(pendingDetachTimer);
    pendingDetachTimer = null;
  }
}

function scheduleDetach() {
  cancelPendingDetach();

  pendingDetachTimer = setTimeout(() => {
    pendingDetachTimer = null;

    const socket = getGameSocket();
    if (socket.connected) {
      socket.emit("exit_adventure_view", {});
    }
  }, 100);
}

export interface LiveAdventureState {
  status: "waiting" | "resuming" | "ready" | "error";
  resumeEpoch: number;
  room: RoomState | null;
  game: GameState | null;
  playerId: string | null;
  messages: ChatMessage[];
  choiceAccepted: ChoiceAcceptedPayload | null;
  turnLockCountdown: TurnLockCountdownPayload | null;
  storyAdvancing: StoryAdvancingPayload | null;
  intermissionResult: IntermissionResult | null;
  microEventResolution: QuickEvent | null;
  turnReceipt: TurnResolvedPayload | null;
  lastTurn: TurnResolvedPayload | null;
  finale: FinalePayload | null;
  error: string;
  retryableError: ServerErrorPayload | null;
  submitChoice: (choiceId: string) => void;
  retryPendingTurn: () => void;
  startAdventure: () => void;
  requestWrapUp: () => void;
  submitMicroEventChoice: (optionId: string) => void;
  submitIntermissionScore: (turnNumber: number, gameId: string, score: number) => void;
  sendChat: (text: string) => void;
  sync: () => void;
  restore: () => void;
  clearError: () => void;
  clearRetryableError: () => void;
  dismissMicroEventResolution: () => void;
}

export function useLiveAdventure(
  roomCode: string | undefined,
  characterId: string | undefined,
): LiveAdventureState {
  const normalizedRoomCode = roomCode?.trim().toUpperCase();
  const normalizedCharacterId = characterId?.trim();

  const [status, setStatus] = useState<LiveAdventureState["status"]>("waiting");
  const [resumeEpoch, setResumeEpoch] = useState(0);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [choiceAccepted, setChoiceAccepted] = useState<ChoiceAcceptedPayload | null>(null);
  const [turnLockCountdown, setTurnLockCountdown] = useState<TurnLockCountdownPayload | null>(null);
  const [storyAdvancing, setStoryAdvancing] = useState<StoryAdvancingPayload | null>(null);
  const [intermissionResult, setIntermissionResult] = useState<IntermissionResult | null>(null);
  const [microEventResolution, setMicroEventResolution] = useState<QuickEvent | null>(null);
  const [turnReceipt, setTurnReceipt] = useState<TurnResolvedPayload | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResolvedPayload | null>(null);
  const [finale, setFinale] = useState<FinalePayload | null>(null);
  const [error, setError] = useState("");
  const [retryableError, setRetryableError] = useState<ServerErrorPayload | null>(null);

  const readyRef = useRef(false);
  const restoreRef = useRef<() => void>(() => undefined);
  // A Socket.IO transport may stay connected after its server-side room binding
  // disappears. A plain sync is then ignored: refresh worked only because it
  // re-ran resume_adventure. Escalate one unanswered sync to that same safe
  // authenticated handshake, without submitting a choice or rerolling dice.
  const syncWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSyncWatchdog = useCallback(() => {
    if (syncWatchdogRef.current !== null) clearTimeout(syncWatchdogRef.current);
    syncWatchdogRef.current = null;
  }, []);
  const restore = useCallback(() => restoreRef.current(), []);
  const canSend = useCallback(() => {
    if (getGameSocket().connected && readyRef.current) return true;
    setError("Wait for the adventure to reconnect and restore before sending an action.");
    return false;
  }, []);
  const identityRef = useRef("");
  const lastGameTurnRef = useRef<number | null>(null);

  const sync = useCallback(() => {
    if (!normalizedRoomCode || !normalizedCharacterId) return;

    const socket = getGameSocket();
    if (!socket.connected) {
      restoreRef.current();
      return;
    }
    // Only one outstanding sync at a time. Any game_state response clears
    // this watchdog. Missing replies are not evidence of Director failure:
    // resuming the view rebinds the socket and retrieves the SAVED scene.
    if (syncWatchdogRef.current !== null) return;
    if (typeof console !== "undefined") console.info("[Quillairo Turn] syncing saved chapter");
    socket.emit("sync_adventure_state", {
      room_code: normalizedRoomCode,
    });
    syncWatchdogRef.current = setTimeout(() => {
      syncWatchdogRef.current = null;
      if (typeof console !== "undefined") console.warn("[Quillairo Turn] no snapshot reply; rejoining room");
      restoreRef.current();
    }, 5000);
  }, [normalizedRoomCode, normalizedCharacterId]);

  useEffect(() => {
    readyRef.current = false;
    if (!normalizedRoomCode || !normalizedCharacterId) {
      setStatus("waiting");
      return;
    }

    cancelPendingDetach();
    clearSyncWatchdog();

    setRoom(null);
    setGame(null);
    setPlayerId(null);
    setMessages([]);
    setChoiceAccepted(null);
    setTurnLockCountdown(null);
    setStoryAdvancing(null);
    setIntermissionResult(null);
    setMicroEventResolution(null);
    setTurnReceipt(null);
    setLastTurn(null);
    setFinale(null);
    setError("");
    setRetryableError(null);
    lastGameTurnRef.current = null;

    const socket = getGameSocket();
    const identity = `${normalizedRoomCode}:${normalizedCharacterId}`;
    identityRef.current = identity;
    let resumeConfirmed = false;
    let snapshotReceived = false;
    let restoring = false;
    let resumeWatchdog: ReturnType<typeof setTimeout> | null = null;

    const clearResumeWatchdog = () => {
      if (resumeWatchdog !== null) {
        clearTimeout(resumeWatchdog);
        resumeWatchdog = null;
      }
    };

    const matchesRoom = (candidate?: string | null) =>
      !candidate || candidate.trim().toUpperCase() === normalizedRoomCode;

    const finishRestore = () => {
      if (!resumeConfirmed || !snapshotReceived) return;
      clearResumeWatchdog();
      restoring = false;
      readyRef.current = true;
      setStatus("ready");
      setError("");
    };

    const resume = () => {
      if (identityRef.current !== identity || !socket.connected || restoring) return;
      restoring = true;
      readyRef.current = false;
      resumeConfirmed = false;
      snapshotReceived = false;

      clearResumeWatchdog();
      setChoiceAccepted(null);
      setTurnLockCountdown(null);
      setStoryAdvancing(null);
      setStatus("resuming");
      setError("");
      setRetryableError(null);

      socket.emit("resume_adventure", {
        room_code: normalizedRoomCode,
        character_id: normalizedCharacterId,
      });

      // Resuming an existing room is a local DB/state operation and should be
      // fast.  Never leave the page displaying RESTORING THE THREAD forever if
      // a socket event is lost or the server encounters an unexpected stall.
      resumeWatchdog = setTimeout(() => {
        if (identityRef.current !== identity) return;

        restoring = false;
        readyRef.current = false;
        setStatus("error");
        setError(
          "The adventure server did not finish restoring this room. Return to the Adventure Hall to recover or abandon it.",
        );
      }, 12000);
    };

    const onDisconnect = () => {
      clearSyncWatchdog();
      clearResumeWatchdog();
      restoring = false;
      readyRef.current = false;
      resumeConfirmed = false;
      snapshotReceived = false;
      setStatus("waiting");
      setError("Connection lost. Your last received scene remains visible while we reconnect.");
    };
    const onConnectError = () => {
      onDisconnect();
      setStatus("error");
      setError("Unable to connect. Check your connection, then try restoring again. If your session expired, sign in again.");
    };
    restoreRef.current = () => {
      if (socket.connected) resume();
      else socket.connect();
    };

    const onResumeSuccess = (payload: ResumeSuccessPayload) => {
      if (!matchesRoom(payload?.room?.code) || payload.character_id !== normalizedCharacterId) return;

      resumeConfirmed = true;
      if (typeof console !== "undefined") console.info("[Quillairo Turn] resume_success; rebuilding theater from saved state", { completed: payload.completed });
      // A successful rejoin reconstructs the client theater from the saved
      // snapshot, just as a hard reload would, without remounting the page.
      setResumeEpoch((current) => current + 1);
      setRoom(payload.room);
      setPlayerId(payload.player_id);
      setFinale(payload.completed ? payload.finale ?? null : null);
      finishRestore();
    };

    const onRoomState = (payload: RoomState) => {
      if (!matchesRoom(payload?.code)) return;
      setRoom(payload);
    };

    const onGameState = (payload: GameState) => {
      if (!matchesRoom(payload?.room_code)) return;

      clearSyncWatchdog();
      snapshotReceived = true;
      // Flat, copyable diagnostics: Chrome collapses object payloads in the
      // console, hiding precisely the receipt fields needed to diagnose a
      // stalled Arcade. Never log story prose or personal data.
      if (typeof console !== "undefined") console.info(
        `[Quillairo Turn] game_state turn=${payload.turn_number}` +
        ` pending=${Boolean(payload.turn_pending)}` +
        ` directorActive=${Boolean(payload.director_request_active)}` +
        ` retryRequired=${Boolean(payload.director_retry_required)}` +
        ` completed=${Boolean(payload.director_complete)}` +
        ` receipt=${payload.last_turn_result?.resolved_turn_number ?? payload.last_turn_result?.turn_number ?? "MISSING"}` +
        ` preliminary=${Boolean(payload.last_turn_result?.preliminary)}` +
        ` diceChecks=${payload.last_turn_result?.results?.filter((r) => Boolean(r.check)).length ?? 0}`,
      );

      if (
        lastGameTurnRef.current !== null &&
        lastGameTurnRef.current !== payload.turn_number
      ) {
        setChoiceAccepted(null);
        setTurnLockCountdown(null);
        setStoryAdvancing(null);
        setTurnReceipt(null);
        setRetryableError(null);
      }

      lastGameTurnRef.current = payload.turn_number;
      setGame(payload);

      if (payload.last_turn_result) {
        setLastTurn(payload.last_turn_result);
        // The persisted final receipt is authoritative on reconnection.
        // A missed turn_resolved event must not silently hide the finale.
        if (payload.director_complete && payload.last_turn_result.finale) {
          setFinale(payload.last_turn_result.finale);
        }
      }

      // A reconnect during generation recovers the same frozen dice facts.
      if (payload.pending_turn_receipt) {
        setTurnReceipt(payload.pending_turn_receipt);
      }

      if (payload.last_intermission_result) {
        setIntermissionResult(payload.last_intermission_result);
      }

      if (!payload.director_retry_required) {
        setRetryableError((current) =>
          current?.retryable ? null : current,
        );
      }

      finishRestore();
    };

    const onChatHistory = (payload: { room_code: string; messages: ChatMessage[] }) => {
      if (!matchesRoom(payload?.room_code)) return;
      setMessages(Array.isArray(payload?.messages) ? payload.messages : []);
    };

    const onChatMessage = (message: ChatMessage) => {
      setMessages((current) => {
        if (current.some((item) => item.id === message.id)) return current;
        return [...current, message].slice(-100);
      });
    };

    const onChoiceAccepted = (payload: ChoiceAcceptedPayload) => {
      if (!matchesRoom(payload?.room_code)) return;
      setChoiceAccepted(payload);
      setError("");
    };

    const onTurnLockCountdown = (payload: TurnLockCountdownPayload) => {
      if (!matchesRoom(payload?.room_code)) return;
      setTurnLockCountdown(payload);
      setRetryableError(null);
    };

    const onStoryAdvancing = (payload: StoryAdvancingPayload) => {
      if (!matchesRoom(payload?.room_code)) return;
      setStoryAdvancing(payload);
      setRetryableError(null);
    };

    const onIntermissionResult = (payload: IntermissionResult & { room_code: string }) => {
      if (!matchesRoom(payload?.room_code)) return;
      setIntermissionResult(payload);
    };

    const onMicroEventUpdated = (payload: MicroEventUpdatedPayload) => {
      if (!matchesRoom(payload?.room_code)) return;

      setGame((current) => {
        if (!current) return current;

        return {
          ...current,
          pending_micro_event: payload.completed ? null : payload.event,
        };
      });

      if (payload.completed) {
        // Resolution is player-facing feedback, not a transient toast.  Keep it
        // visible until the player explicitly acknowledges what their reaction did.
        setMicroEventResolution(payload.event);
      }
    };

    const onTurnReceiptReady = (payload: TurnResolvedPayload) => {
      if (!matchesRoom(payload?.room_code)) return;
      if (typeof console !== "undefined") console.info("[Quillairo Turn] preliminary receipt (dice frozen; story still writing)", {
        turn: payload.resolved_turn_number ?? payload.turn_number,
        checks: payload.results?.filter((r) => Boolean(r.check)).length ?? 0,
      });
      setTurnReceipt(payload);
      setRetryableError(null);
    };

    const onTurnResolved = (payload: TurnResolvedPayload) => {
      if (!matchesRoom(payload?.room_code)) return;
      if (typeof console !== "undefined") console.info("[Quillairo Turn] COMMITTED turn_resolved", {
        resolvedTurn: payload.resolved_turn_number ?? payload.turn_number,
        diceChecks: payload.results?.filter((r) => Boolean(r.check)).length ?? 0,
        completed: Boolean(payload.completed),
      });

      setLastTurn(payload);
      setTurnReceipt(payload);
      setTurnLockCountdown(null);
      setStoryAdvancing(null);
      setRetryableError(null);
      setError("");

      if (payload.completed && payload.finale) {
        setFinale(payload.finale);
      }
      // The committed result is authoritative. It can arrive before (or
      // without) the game's subsequent broadcast_game_state. Recover the
      // freshly saved scene independently, while the theater displays the
      // already committed dice. Do not regenerate or roll again.
      if (!payload.preliminary && normalizedRoomCode) {
        console.info("[Quillairo Turn] commit received; requesting saved next scene", {
          turn: payload.resolved_turn_number ?? payload.turn_number,
        });
        sync();
      }
    };

    const onRoomError = (payload: ServerErrorPayload) => {
      if (!matchesRoom(payload?.room_code)) return;
      clearResumeWatchdog();
      restoring = false;
      setError(String(payload?.message ?? "The thread slipped."));
      setStatus((current) => current === "resuming" ? "error" : current);
    };

    const onGameError = (payload: ServerErrorPayload) => {
      if (!matchesRoom(payload?.room_code)) return;

      if (payload?.retryable) {
        setRetryableError(payload);
        if (readyRef.current) setStatus("ready");
        return;
      }

      setError(String(payload?.message ?? "The story machine objected."));
      setStatus((current) => current === "resuming" ? "error" : current);
    };

    const onChatError = (payload: ServerErrorPayload) => {
      if (!matchesRoom(payload?.room_code)) return;
      setError(String(payload?.message ?? "The message vanished into the machinery."));
    };

    socket.on("connect", resume);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("resume_success", onResumeSuccess);
    socket.on("room_state", onRoomState);
    socket.on("game_state", onGameState);
    socket.on("chat_history", onChatHistory);
    socket.on("chat_message", onChatMessage);
    socket.on("choice_accepted", onChoiceAccepted);
    socket.on("turn_lock_countdown", onTurnLockCountdown);
    socket.on("story_advancing", onStoryAdvancing);
    socket.on("intermission_result", onIntermissionResult);
    socket.on("micro_event_updated", onMicroEventUpdated);
    socket.on("turn_receipt_ready", onTurnReceiptReady);
    socket.on("turn_resolved", onTurnResolved);
    socket.on("room_error", onRoomError);
    socket.on("game_error", onGameError);
    socket.on("chat_error", onChatError);

    if (socket.connected) {
      resume();
    }

    return () => {
      identityRef.current = "";
      readyRef.current = false;
      restoreRef.current = () => undefined;
      clearResumeWatchdog();
      clearSyncWatchdog();

      socket.off("connect", resume);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("resume_success", onResumeSuccess);
      socket.off("room_state", onRoomState);
      socket.off("game_state", onGameState);
      socket.off("chat_history", onChatHistory);
      socket.off("chat_message", onChatMessage);
      socket.off("choice_accepted", onChoiceAccepted);
      socket.off("turn_lock_countdown", onTurnLockCountdown);
      socket.off("story_advancing", onStoryAdvancing);
      socket.off("intermission_result", onIntermissionResult);
      socket.off("micro_event_updated", onMicroEventUpdated);
      socket.off("turn_receipt_ready", onTurnReceiptReady);
      socket.off("turn_resolved", onTurnResolved);
      socket.off("room_error", onRoomError);
      socket.off("game_error", onGameError);
      socket.off("chat_error", onChatError);

      scheduleDetach();
    };
  }, [normalizedRoomCode, normalizedCharacterId, clearSyncWatchdog, sync]);

  const submitChoice = useCallback((choiceId: string) => {
    if (!canSend()) return;
    const clean = choiceId.trim();
    if (!clean) return;

    setError("");
    getGameSocket().emit("submit_choice", {
      choice_id: clean,
    });
  }, [canSend]);

  const retryPendingTurn = useCallback(() => {
    if (!canSend()) return;
    if (!normalizedRoomCode) return;

    setRetryableError(null);
    setError("");

    getGameSocket().emit("retry_pending_turn", {
      room_code: normalizedRoomCode,
    });
  }, [normalizedRoomCode, canSend]);

  const startAdventure = useCallback(() => {
    if (!canSend()) return;
    if (!normalizedRoomCode) return;
    setError("");
    getGameSocket().emit("start_adventure", {
      room_code: normalizedRoomCode,
    });
  }, [normalizedRoomCode, canSend]);

  const requestWrapUp = useCallback(() => {
    if (!canSend()) return;
    if (!normalizedRoomCode) return;

    getGameSocket().emit("request_wrap_up", {
      room_code: normalizedRoomCode,
    });
  }, [normalizedRoomCode, canSend]);

  const submitMicroEventChoice = useCallback((optionId: string) => {
    if (!canSend()) return;
    if (!normalizedRoomCode) return;

    const clean = optionId.trim();
    if (!clean) return;

    getGameSocket().emit("submit_micro_event_choice", {
      room_code: normalizedRoomCode,
      option_id: clean,
    });
  }, [normalizedRoomCode, canSend]);

  const submitIntermissionScore = useCallback((
    turnNumber: number,
    gameId: string,
    score: number,
  ) => {
    if (!canSend()) return;
    if (!normalizedRoomCode) return;

    const cleanGameId = gameId.trim();
    if (!cleanGameId) return;

    getGameSocket().emit("submit_intermission_score", {
      room_code: normalizedRoomCode,
      turn_number: Math.max(1, Math.trunc(turnNumber)),
      game_id: cleanGameId,
      score: Math.max(0, Math.min(999, Math.round(score))),
    });
  }, [normalizedRoomCode, canSend]);

  const sendChat = useCallback((text: string) => {
    if (!canSend()) return;
    const clean = text.trim();

    if (!clean || clean.length > 500) return;

    getGameSocket().emit("send_chat", {
      text: clean,
    });
  }, [canSend]);

  const clearError = useCallback(() => setError(""), []);
  const clearRetryableError = useCallback(() => setRetryableError(null), []);
  const dismissMicroEventResolution = useCallback(() => setMicroEventResolution(null), []);

  return {
    status,
    resumeEpoch,
    room,
    game,
    playerId,
    messages,
    choiceAccepted,
    turnLockCountdown,
    storyAdvancing,
    intermissionResult,
    microEventResolution,
    turnReceipt,
    lastTurn,
    finale,
    error,
    retryableError,
    submitChoice,
    retryPendingTurn,
    startAdventure,
    requestWrapUp,
    submitMicroEventChoice,
    submitIntermissionScore,
    sendChat,
    sync,
    restore,
    clearError,
    clearRetryableError,
    dismissMicroEventResolution,
  };
}
