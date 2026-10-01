import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "./game";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getGameSocket(): GameSocket {
  if (!socket) {
    // socket.io-client's exported io() factory is not generic in the installed
    // client typings. Keep our strongly typed Socket alias and narrow the
    // factory result to that authoritative event contract here.
    socket = io({
      autoConnect: false,
      withCredentials: true,
      transports: ["websocket", "polling"],
    }) as GameSocket;
  }

  return socket;
}

export function connectGameSocket(): GameSocket {
  const current = getGameSocket();

  if (!current.connected) {
    current.connect();
  }

  return current;
}

export function disconnectGameSocket(): void {
  socket?.disconnect();
}
