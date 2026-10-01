import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import {
  connectGameSocket,
  disconnectGameSocket,
  getGameSocket,
} from "../services/socket";
import type {
  AdventureCatalogItem,
  AdventureListItem,
  RoomJoinedPayload,
  ServerErrorPayload,
} from "../services/game";

interface GameSocketContextValue {
  connected: boolean;
  catalog: AdventureCatalogItem[];
  adventures: AdventureListItem[];
  directoryReady: boolean;
  latestError: string;
  clearError: () => void;
  createRoom: (characterId: string, adventureId: string) => void;
  joinRoom: (characterId: string, roomCode: string) => void;
  startSolo: (roomCode: string) => void;
  leaveAdventure: (roomCode: string, characterId: string) => void;
  abandonAdventure: (roomCode: string) => void;
  lastRoomEntry: RoomJoinedPayload | null;
  clearRoomEntry: () => void;
}

const GameSocketContext = createContext<GameSocketContextValue | null>(null);

export function GameSocketProvider({ children }: { children: ReactNode }) {
  const { authenticated } = useAuth();

  const [connected, setConnected] = useState(false);
  const [catalog, setCatalog] = useState<AdventureCatalogItem[]>([]);
  const [adventures, setAdventures] = useState<AdventureListItem[]>([]);
  const [directoryReady, setDirectoryReady] = useState(false);
  const [latestError, setLatestError] = useState("");
  const [lastRoomEntry, setLastRoomEntry] = useState<RoomJoinedPayload | null>(null);

  useEffect(() => {
    if (!authenticated) {
      disconnectGameSocket();
      setConnected(false);
      setCatalog([]);
      setAdventures([]);
      setDirectoryReady(false);
      setLastRoomEntry(null);
      return;
    }

    const socket = getGameSocket();

    const onConnect = () => {
      setConnected(true);
      setLatestError("");
    };

    const onDisconnect = () => setConnected(false);

    const onCatalog = (payload: { adventures: AdventureCatalogItem[] }) => {
      setCatalog(Array.isArray(payload?.adventures) ? payload.adventures : []);
      setDirectoryReady(true);
    };

    const onAdventureList = (payload: { adventures: AdventureListItem[] }) => {
      setAdventures(Array.isArray(payload?.adventures) ? payload.adventures : []);
      setDirectoryReady(true);
    };

    const onRoomJoined = (payload: RoomJoinedPayload) => {
      setLastRoomEntry(payload);
    };

    const onRoomError = (payload: ServerErrorPayload) => {
      setLatestError(String(payload?.message ?? "The story machine objected."));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("adventure_catalog", onCatalog);
    socket.on("adventure_list", onAdventureList);
    socket.on("room_joined", onRoomJoined);
    socket.on("room_error", onRoomError);

    connectGameSocket();

    if (socket.connected) {
      setConnected(true);
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("adventure_catalog", onCatalog);
      socket.off("adventure_list", onAdventureList);
      socket.off("room_joined", onRoomJoined);
      socket.off("room_error", onRoomError);

      // Keeping the connection lifecycle tied to this provider makes React
      // StrictMode deterministic: the development remount cleanly reconnects
      // and receives a fresh catalog + adventure list from Python.
      disconnectGameSocket();
      setConnected(false);
    };
  }, [authenticated]);

  const createRoom = useCallback((characterId: string, adventureId: string) => {
    setLatestError("");
    getGameSocket().emit("create_room", {
      character_id: characterId,
      adventure_id: adventureId,
    });
  }, []);

  const joinRoom = useCallback((characterId: string, roomCode: string) => {
    setLatestError("");
    getGameSocket().emit("join_room", {
      character_id: characterId,
      room_code: roomCode.trim().toUpperCase(),
    });
  }, []);

  const startSolo = useCallback((roomCode: string) => {
    setLatestError("");
    getGameSocket().emit("start_solo", {
      room_code: roomCode.trim().toUpperCase(),
    });
  }, []);

  const leaveAdventure = useCallback((roomCode: string, characterId: string) => {
    setLatestError("");
    getGameSocket().emit("leave_adventure", {
      room_code: roomCode.trim().toUpperCase(),
      character_id: characterId.trim(),
    });
  }, []);

  const abandonAdventure = useCallback((roomCode: string) => {
    setLatestError("");
    getGameSocket().emit("abandon_adventure", {
      room_code: roomCode.trim().toUpperCase(),
    });
  }, []);

  const clearError = useCallback(() => setLatestError(""), []);
  const clearRoomEntry = useCallback(() => setLastRoomEntry(null), []);

  const value = useMemo<GameSocketContextValue>(
    () => ({
      connected,
      catalog,
      adventures,
      directoryReady,
      latestError,
      clearError,
      createRoom,
      joinRoom,
      startSolo,
      leaveAdventure,
      abandonAdventure,
      lastRoomEntry,
      clearRoomEntry,
    }),
    [
      connected,
      catalog,
      adventures,
      directoryReady,
      latestError,
      clearError,
      createRoom,
      joinRoom,
      startSolo,
      leaveAdventure,
      abandonAdventure,
      lastRoomEntry,
      clearRoomEntry,
    ],
  );

  return (
    <GameSocketContext.Provider value={value}>
      {children}
    </GameSocketContext.Provider>
  );
}

export function useGameSocket() {
  const context = useContext(GameSocketContext);

  if (!context) {
    throw new Error("useGameSocket must be used inside GameSocketProvider.");
  }

  return context;
}
