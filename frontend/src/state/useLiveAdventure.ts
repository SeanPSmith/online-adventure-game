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
  room: RoomState | null;
  game: GameState | null;
  playerId: string | null;
  messages: ChatMessage[];
  choiceAccepted: ChoiceAcceptedPayload | null;
  turnLockCountdown: TurnLockCountdownPayload | null;
  storyAdvancing: StoryAdvancingPayload | null;
  intermissionResult: IntermissionResult | null;
  microEventResolution: QuickEvent | null;
  lastTurn: TurnResolvedPayload | null;
  finale: FinalePayload | null;
  error: string;
  retryableError: ServerErrorPayload | null;
  submitChoice: (choiceId: string) => void;
  retryPendingTurn: () => void;
  requestWrapUp: () => void;
  submitMicroEventChoice: (optionId: string) => void;
  submitIntermissionScore: (turnNumber: number, gameId: string, score: number) => void;
  sendChat: (text: string) => void;
  sync: () => void;
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
  const [room, setRoom] = useState<RoomState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [choiceAccepted, setChoiceAccepted] = useState<ChoiceAcceptedPayload | null>(null);
  const [turnLockCountdown, setTurnLockCountdown] = useState<TurnLockCountdownPayload | null>(null);
  const [storyAdvancing, setStoryAdvancing] = useState<StoryAdvancingPayload | null>(null);
  const [intermissionResult, setIntermissionResult] = useState<IntermissionResult | null>(null);
  const [microEventResolution, setMicroEventResolution] = useState<QuickEvent | null>(null);
  const [lastTurn, setLastTurn] = useState<TurnResolvedPayload | null>(null);
  const [finale, setFinale] = useState<FinalePayload | null>(null);
  const [error, setError] = useState("");
  const [retryableError, setRetryableError] = useState<ServerErrorPayload | null>(null);

  const identityRef = useRef("");
  const lastGameTurnRef = useRef<number | null>(null);

  const sync = useCallback(() => {
    if (!normalizedRoomCode) return;

    const socket = getGameSocket();
    if (!socket.connected) return;

    socket.emit("sync_adventure_state", {
      room_code: normalizedRoomCode,
    });
  }, [normalizedRoomCode]);

  useEffect(() => {
    if (!normalizedRoomCode || !normalizedCharacterId) {
      setStatus("waiting");
      return;
    }

    cancelPendingDetach();

    setRoom(null);
    setGame(null);
    setPlayerId(null);
    setMessages([]);
    setChoiceAccepted(null);
    setTurnLockCountdown(null);
    setStoryAdvancing(null);
    setIntermissionResult(null);
    setMicroEventResolution(null);
    setLastTurn(null);
    setFinale(null);
    setError("");
    setRetryableError(null);
    lastGameTurnRef.current = null;

    const socket = getGameSocket();
    const identity = `${normalizedRoomCode}:${normalizedCharacterId}`;
    identityRef.current = identity;
    let resumeWatchdog: ReturnType<typeof setTimeout> | null = null;

    const clearResumeWatchdog = () => {
      if (resumeWatchdog !== null) {
        clearTimeout(resumeWatchdog);
        resumeWatchdog = null;
      }
    };

    const matchesRoom = (candidate?: string | null) =>
      !candidate || candidate.trim().toUpperCase() === normalizedRoomCode;

    const resume = () => {
      if (identityRef.current !== identity) return;

      clearResumeWatchdog();
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

        setStatus("error");
        setError(
          "The adventure server did not finish restoring this room. Return to the Adventure Hall to recover or abandon it.",
        );
      }, 12000);
    };

    const onResumeSuccess = (payload: ResumeSuccessPayload) => {
      if (!matchesRoom(payload?.room?.code)) return;

      clearResumeWatchdog();
      setRoom(payload.room);
      setPlayerId(payload.player_id);
      setFinale(payload.completed ? payload.finale ?? null : null);
      setStatus("ready");
      setError("");
    };

    const onRoomState = (payload: RoomState) => {
      if (!matchesRoom(payload?.code)) return;
      setRoom(payload);
    };

    const onGameState = (payload: GameState) => {
      if (!matchesRoom(payload?.room_code)) return;

      clearResumeWatchdog();

      if (
        lastGameTurnRef.current !== null &&
        lastGameTurnRef.current !== payload.turn_number
      ) {
        setChoiceAccepted(null);
        setTurnLockCountdown(null);
        setStoryAdvancing(null);
        setRetryableError(null);
      }

      lastGameTurnRef.current = payload.turn_number;
      setGame(payload);

      if (payload.last_turn_result) {
        setLastTurn(payload.last_turn_result);
      }

      if (payload.last_intermission_result) {
        setIntermissionResult(payload.last_intermission_result);
      }

      if (!payload.director_retry_required) {
        setRetryableError((current) =>
          current?.retryable ? null : current,
        );
      }

      setStatus("ready");
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

    const onTurnResolved = (payload: TurnResolvedPayload) => {
      if (!matchesRoom(payload?.room_code)) return;

      setLastTurn(payload);
      setTurnLockCountdown(null);
      setStoryAdvancing(null);
      setRetryableError(null);
      setError("");

      if (payload.completed && payload.finale) {
        setFinale(payload.finale);
      }
    };

    const onRoomError = (payload: ServerErrorPayload) => {
      if (!matchesRoom(payload?.room_code)) return;
      clearResumeWatchdog();
      setError(String(payload?.message ?? "The thread slipped."));
      setStatus((current) => current === "resuming" ? "error" : current);
    };

    const onGameError = (payload: ServerErrorPayload) => {
      if (!matchesRoom(payload?.room_code)) return;

      if (payload?.retryable) {
        setRetryableError(payload);
        setStatus("ready");
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
    socket.on("turn_resolved", onTurnResolved);
    socket.on("room_error", onRoomError);
    socket.on("game_error", onGameError);
    socket.on("chat_error", onChatError);

    if (socket.connected) {
      resume();
    }

    return () => {
      identityRef.current = "";
      clearResumeWatchdog();

      socket.off("connect", resume);
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
      socket.off("turn_resolved", onTurnResolved);
      socket.off("room_error", onRoomError);
      socket.off("game_error", onGameError);
      socket.off("chat_error", onChatError);

      scheduleDetach();
    };
  }, [normalizedRoomCode, normalizedCharacterId]);

  const submitChoice = useCallback((choiceId: string) => {
    const clean = choiceId.trim();
    if (!clean) return;

    setError("");
    getGameSocket().emit("submit_choice", {
      choice_id: clean,
    });
  }, []);

  const retryPendingTurn = useCallback(() => {
    if (!normalizedRoomCode) return;

    setRetryableError(null);
    setError("");

    getGameSocket().emit("retry_pending_turn", {
      room_code: normalizedRoomCode,
    });
  }, [normalizedRoomCode]);

  const requestWrapUp = useCallback(() => {
    if (!normalizedRoomCode) return;

    getGameSocket().emit("request_wrap_up", {
      room_code: normalizedRoomCode,
    });
  }, [normalizedRoomCode]);

  const submitMicroEventChoice = useCallback((optionId: string) => {
    if (!normalizedRoomCode) return;

    const clean = optionId.trim();
    if (!clean) return;

    getGameSocket().emit("submit_micro_event_choice", {
      room_code: normalizedRoomCode,
      option_id: clean,
    });
  }, [normalizedRoomCode]);

  const submitIntermissionScore = useCallback((
    turnNumber: number,
    gameId: string,
    score: number,
  ) => {
    if (!normalizedRoomCode) return;

    const cleanGameId = gameId.trim();
    if (!cleanGameId) return;

    getGameSocket().emit("submit_intermission_score", {
      room_code: normalizedRoomCode,
      turn_number: Math.max(1, Math.trunc(turnNumber)),
      game_id: cleanGameId,
      score: Math.max(0, Math.min(999, Math.round(score))),
    });
  }, [normalizedRoomCode]);

  const sendChat = useCallback((text: string) => {
    const clean = text.trim();

    if (!clean || clean.length > 500) return;

    getGameSocket().emit("send_chat", {
      text: clean,
    });
  }, []);

  const clearError = useCallback(() => setError(""), []);
  const clearRetryableError = useCallback(() => setRetryableError(null), []);
  const dismissMicroEventResolution = useCallback(() => setMicroEventResolution(null), []);

  return {
    status,
    room,
    game,
    playerId,
    messages,
    choiceAccepted,
    turnLockCountdown,
    storyAdvancing,
    intermissionResult,
    microEventResolution,
    lastTurn,
    finale,
    error,
    retryableError,
    submitChoice,
    retryPendingTurn,
    requestWrapUp,
    submitMicroEventChoice,
    submitIntermissionScore,
    sendChat,
    sync,
    clearError,
    clearRetryableError,
    dismissMicroEventResolution,
  };
}
