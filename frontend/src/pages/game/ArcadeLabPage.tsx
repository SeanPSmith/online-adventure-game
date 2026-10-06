import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import { arcadeGameById, arcadeGamesForLab } from "../../features/arcade/ArcadeGameRegistry";
import { getArcadeCatalog, setArcadeGameLive, type ArcadePublicationEntry } from "../../services/arcade";
import { useAuth } from "../../state/AuthContext";

export function ArcadeLabPage() {
  const { user } = useAuth();
  const isAdmin = user?.permissions.includes("admin") ?? false;
  const allGames = useMemo(() => arcadeGamesForLab(), []);
  const [publication, setPublication] = useState<Record<string, ArcadePublicationEntry>>({});
  const [catalogReady, setCatalogReady] = useState(false);
  const [selectedId, setSelectedId] = useState(allGames[0]?.id ?? "outlier");
  const [score, setScore] = useState(0);
  const [runId, setRunId] = useState(1);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void getArcadeCatalog()
      .then((response) => {
        if (cancelled) return;
        setPublication(Object.fromEntries(response.games.map((entry) => [entry.game_id, entry])));
        setCatalogReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setCatalogError(error instanceof Error ? error.message : "Arcade publication status unavailable.");
        setCatalogReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  function isLive(gameId: string) {
    const remote = publication[gameId];
    if (remote) return remote.is_live;
    return arcadeGameById(gameId).live;
  }

  const games = useMemo(
    () => isAdmin
      ? allGames
      : catalogReady && !catalogError
        ? allGames.filter((game) => publication[game.id]?.is_live === true)
        : [],
    [allGames, catalogError, catalogReady, isAdmin, publication],
  );

  useEffect(() => {
    if (!catalogReady || isAdmin || games.some((game) => game.id === selectedId)) return;
    setSelectedId(games[0]?.id ?? "");
    setScore(0);
    setRunId((value) => value + 1);
  }, [catalogReady, games, isAdmin, selectedId]);

  const selected = games.find((game) => game.id === selectedId) ?? games[0] ?? null;
  const Game = selected?.component ?? null;

  function selectGame(gameId: string) {
    setSelectedId(gameId);
    setScore(0);
    setRunId((value) => value + 1);
  }

  function restart() {
    setScore(0);
    setRunId((value) => value + 1);
  }

  async function toggleLive(gameId: string) {
    if (!isAdmin || publishingId) return;
    const nextLive = !isLive(gameId);
    setPublishingId(gameId);
    setCatalogError("");
    try {
      const response = await setArcadeGameLive(gameId, nextLive);
      setPublication((current) => ({ ...current, [gameId]: response.game }));
    } catch (error) {
      setCatalogError(error instanceof Error ? error.message : "Could not update arcade publication state.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <>
      <PageTitle
        eyebrow={isAdmin ? "ARCADE LAB // PUBLICATION CONTROL" : "ARCADE // LIVE CABINETS"}
        title={isAdmin ? "TEST IT. THEN PUSH IT LIVE." : "WASTE TIME PRODUCTIVELY."}
        actions={<span className={`network-badge ${catalogError ? "is-warning" : "is-online"}`}>{isAdmin ? "ADMIN CABINET ACCESS" : "LIVE ROTATION"}</span>}
      />

      {catalogError ? <div className="form-error arcade-catalog-error">{catalogError}</div> : null}

      <section className="arcade-lab-layout">
        <Panel title={isAdmin ? "CABINET DIRECTORY // ADMIN" : "LIVE CABINETS"} className="arcade-lab-directory">
          <div className="arcade-lab-list">
            {games.map((game) => {
              const live = isLive(game.id);
              return (
                <div className={`arcade-lab-list-row ${game.id === selected?.id ? "is-active" : ""}`} key={game.id}>
                  <button
                    type="button"
                    className={`arcade-lab-list-item ${game.id === selected?.id ? "is-active" : ""}`}
                    onClick={() => selectGame(game.id)}
                  >
                    <span>{game.title}</span>
                    <small>{game.category.toUpperCase()} // {live ? "LIVE" : "LAB"}</small>
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      className={`arcade-publish-toggle ${live ? "is-live" : ""}`}
                      aria-pressed={live}
                      disabled={publishingId === game.id}
                      onClick={() => void toggleLive(game.id)}
                      title={live ? "Pull this cabinet from the player arcade" : "Publish this cabinet to the player arcade"}
                    >
                      <span aria-hidden="true">{live ? "●" : "○"}</span>
                      {publishingId === game.id ? "..." : live ? "PULL" : "PUSH"}
                    </button>
                  ) : null}
                </div>
              );
            })}
            {!games.length && catalogReady ? <div className="empty-state"><strong>ARCADE OFFLINE_</strong><span>No cabinets are currently published.</span></div> : null}
          </div>
        </Panel>

        {selected && Game ? (
          <Panel title={`${selected.title} // ${selected.category.toUpperCase()}`} className="arcade-lab-cabinet">
            <div className="arcade-lab-meta">
              <div><span>SCORE</span><strong>{String(score).padStart(3, "0")}</strong></div>
              <div><span>CONTROLS</span><strong>{selected.controls}</strong></div>
              <div><span>STATUS</span><strong>{isLive(selected.id) ? "LIVE ARCADE" : "ADMIN LAB ONLY"}</strong></div>
            </div>

            <p className="muted-copy">{selected.description}</p>

            <div className="arcade-lab-game-shell">
              <Game
                key={`${selected.id}:${runId}`}
                score={score}
                onScoreChange={setScore}
                storyReady={false}
                turnNumber={runId}
                playMode="solo"
              />
            </div>

            <div className="arcade-lab-actions">
              <button className="button" type="button" onClick={restart}>RESTART CABINET</button>
              {isAdmin ? (
                <button className={`button ${isLive(selected.id) ? "button-quiet" : "primary"}`} type="button" disabled={publishingId === selected.id} onClick={() => void toggleLive(selected.id)}>
                  {isLive(selected.id) ? "PULL FROM LIVE ARCADE" : "PUSH TO LIVE ARCADE"}
                </button>
              ) : null}
            </div>
          </Panel>
        ) : (
          <Panel title="ARCADE OFFLINE"><div className="empty-state"><strong>NO LIVE CABINETS_</strong><span>An administrator can publish cabinets from the Arcade Lab.</span></div></Panel>
        )}
      </section>
    </>
  );
}
