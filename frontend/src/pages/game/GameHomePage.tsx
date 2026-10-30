/** Production Adventure Hall. The retired physical-book lab has been removed.
 * Data, authorization, Hero eligibility, room creation and recovery remain
 * supplied by existing live state/services; presentation is the Inkbound dashboard.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { InkboundAuthenticatedDashboard } from "./InkboundAuthenticatedDashboard";
import { listCharacters, type Character } from "../../services/characters";
import { rememberGameRoute } from "../../services/gameRouteMemory";
import { useAuth } from "../../state/AuthContext";
import { canUseAuthorStudio } from "../../services/author";
import { useGameSocket } from "../../state/GameSocketContext";

export function GameHomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const canAuthor = canUseAuthorStudio(user?.permissions);
  const isAdmin = user?.permissions.includes("admin") ?? false;

  const {
    connected, catalog, adventures, directoryReady, latestError, clearError,
    refreshCatalog, createRoom, joinRoom, leaveAdventure, abandonAdventure,
    lastRoomEntry, clearRoomEntry,
  } = useGameSocket();

  const [heroes, setHeroes] = useState<Character[]>([]);
  const [heroError, setHeroError] = useState("");
  const [selectedHeroId, setSelectedHeroId] = useState("");

  useEffect(() => {
    rememberGameRoute("/game");
    refreshCatalog();
    const refreshOnFocus = () => refreshCatalog();
    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [refreshCatalog]);

  useEffect(() => {
    let alive = true;
    listCharacters()
      .then((response) => { if (alive) setHeroes(response.characters); })
      .catch((reason) => {
        if (alive) setHeroError(reason instanceof Error ? reason.message : "Unable to summon the Hero roster.");
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!lastRoomEntry) return;
    const code = lastRoomEntry.room.code;
    const characterId = lastRoomEntry.character_id;
    clearRoomEntry();
    navigate(`/game/adventure/${encodeURIComponent(code)}?hero=${encodeURIComponent(characterId)}`);
  }, [lastRoomEntry, clearRoomEntry, navigate]);

  const occupiedHeroIds = useMemo(
    () => new Set(adventures.filter((item) => !item.completed).map((item) => item.character_id)),
    [adventures],
  );
  const playableHeroes = useMemo(
    () => heroes.filter((hero) => hero.is_alive && hero.hero_status === "active"),
    [heroes],
  );
  const selectableHeroes = useMemo(
    () => playableHeroes.filter((hero) => !occupiedHeroIds.has(hero.character_id)),
    [playableHeroes, occupiedHeroIds],
  );

  useEffect(() => {
    if (selectedHeroId && selectableHeroes.some((hero) => hero.character_id === selectedHeroId)) return;
    setSelectedHeroId(selectableHeroes[0]?.character_id ?? "");
  }, [selectedHeroId, selectableHeroes]);

  return (
    <InkboundAuthenticatedDashboard
      username={user?.username ?? "Adventurer"}
      userId={user?.user_id ?? ""}
      isAuthor={canAuthor}
      isAdmin={isAdmin}
      connected={connected}
      directoryReady={directoryReady}
      heroes={heroes}
      catalog={catalog}
      adventures={adventures}
      selectedHeroId={selectedHeroId}
      onSelectHero={setSelectedHeroId}
      onCreate={(item, mode) => {
        // Use the established game socket creation contract directly;
        // navigation still happens through lastRoomEntry.
        if (selectedHeroId) createRoom(selectedHeroId, item.adventure_id, mode);
      }}
      onJoin={(code) => { if (selectedHeroId) joinRoom(selectedHeroId, code); }}
      onLeaveAdventure={leaveAdventure}
      onAbandonAdventure={abandonAdventure}
      onLogout={() => { void logout(); }}
      error={latestError || heroError}
      onDismissError={latestError ? clearError : undefined}
    />
  );
}
