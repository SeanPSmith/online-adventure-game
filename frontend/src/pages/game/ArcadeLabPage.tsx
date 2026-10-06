import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import { arcadeGameById, arcadeGamesForLab, scoreFeedbackModeForGame } from "../../features/arcade/ArcadeGameRegistry";
import { ArcadeFeedback, useArcadeFeedback } from "../../features/arcade/engine/ArcadeFeedback";
import { getArcadeCatalog, setArcadeGameLive, type ArcadePublicationEntry } from "../../services/arcade";
import { useAuth } from "../../state/AuthContext";

export function ArcadeLabPage() {
  const { user } = useAuth();
  const isAdmin = user?.permissions.includes("admin") ?? false;
  const allGames = useMemo(() => arcadeGamesForLab(), []);
  const [publication, setPublication] = useState<Record<string, ArcadePublicationEntry>>({});
  const [catalogReady, setCatalogReady] = useState(false);
  const [selectedId, setSelectedId] = useState(allGames[0]?.id ?? "outlier");
  const [arcadeMode, setArcadeMode] = useState<"solo" | "coop">("solo");
  const [score, setScore] = useState(0);
  const [hotseatScores, setHotseatScores] = useState<[number, number]>([0, 0]);
  const [activePlayer, setActivePlayer] = useState<0 | 1>(0);
  const [matchComplete, setMatchComplete] = useState(false);
  const [runId, setRunId] = useState(1);
  const [matchSeed, setMatchSeed] = useState(1);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const { feedback: scoreFeedback, showFeedback: showScoreFeedback, clearFeedback: clearScoreFeedback } = useArcadeFeedback(1100);

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
    setHotseatScores([0, 0]);
    setActivePlayer(0);
    setMatchComplete(false);
    setRunId((value) => value + 1);
  }, [catalogReady, games, isAdmin, selectedId]);

  const selected = games.find((game) => game.id === selectedId) ?? games[0] ?? null;
  const Game = selected?.component ?? null;
  const hotseatWinner = hotseatScores[0] === hotseatScores[1]
    ? null
    : hotseatScores[0] > hotseatScores[1] ? 0 : 1;

  function resetMatch(nextMode: "solo" | "coop" = arcadeMode) {
    setArcadeMode(nextMode);
    setScore(0);
    setHotseatScores([0, 0]);
    setActivePlayer(0);
    setMatchComplete(false);
    clearScoreFeedback();
    setMatchSeed((value) => value + 1);
    setRunId((value) => value + 1);
  }

  function selectGame(gameId: string) {
    clearScoreFeedback();
    setSelectedId(gameId);
    setScore(0);
    setHotseatScores([0, 0]);
    setActivePlayer(0);
    setMatchComplete(false);
    setMatchSeed((value) => value + 1);
    setRunId((value) => value + 1);
  }

  function restart() {
    resetMatch();
  }

  function changeMode(nextMode: "solo" | "coop") {
    if (nextMode === arcadeMode) return;
    resetMatch(nextMode);
  }

  function bankHotseatTurn() {
    if (arcadeMode !== "coop" || matchComplete) return;
    const nextScores: [number, number] = [...hotseatScores] as [number, number];
    nextScores[activePlayer] = score;
    setHotseatScores(nextScores);

    if (activePlayer === 0) {
      setActivePlayer(1);
      setScore(0);
      clearScoreFeedback();
      setRunId((value) => value + 1);
      return;
    }

    setMatchComplete(true);
  }

  function updateCabinetScore(nextScore: number) {
    const normalized = Math.max(0, Math.min(999, Math.round(nextScore)));
    const delta = normalized - score;
    setScore(normalized);
    if (arcadeMode === "coop") {
      setHotseatScores((current) => {
        const next: [number, number] = [...current] as [number, number];
        next[activePlayer] = normalized;
        return next;
      });
    }
    if (!selected || selected.managesFeedback || delta === 0) return;
    const mode = scoreFeedbackModeForGame(selected);
    showScoreFeedback({
      title: delta > 0 ? "SCORE" : "PENALTY",
      detail: selected.title,
      delta,
      tone: delta > 0 ? "good" : "bad",
    }, mode === "compact" ? 650 : 1350);
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
                    <small>{game.category.toUpperCase()} // {game.multiplayerStyle.replace("_", " ").toUpperCase()} // {live ? "LIVE" : "LAB"}</small>
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
            <div className="arcade-mode-switch" role="group" aria-label="Arcade play mode">
              <button type="button" className={`button ${arcadeMode === "solo" ? "primary" : "button-quiet"}`} aria-pressed={arcadeMode === "solo"} onClick={() => changeMode("solo")}>SOLO</button>
              <button type="button" className={`button ${arcadeMode === "coop" ? "primary" : "button-quiet"}`} aria-pressed={arcadeMode === "coop"} onClick={() => changeMode("coop")}>2 PLAYER</button>
              <span>{arcadeMode === "coop" ? `HOTSEAT // ${selected.multiplayerStyle.replace("_", " ").toUpperCase()}` : "SOLO CABINET"}</span>
            </div>

            <div className="arcade-lab-meta">
              <div><span>SCORE</span><strong>{String(score).padStart(3, "0")}</strong></div>
              <div><span>CONTROLS</span><strong>{selected.controls}</strong></div>
              <div><span>MODE</span><strong>{arcadeMode === "solo" ? "SOLO" : `2P // P${activePlayer + 1}`}</strong></div>
              <div><span>STATUS</span><strong>{isLive(selected.id) ? "LIVE ARCADE" : "ADMIN LAB ONLY"}</strong></div>
            </div>

            {arcadeMode === "coop" ? (
              <div className="arcade-hotseat-strip" aria-label="Two player hotseat scores">
                {[0, 1].map((slot) => (
                  <div key={slot} className={`${activePlayer === slot && !matchComplete ? "is-active" : ""} ${matchComplete && hotseatWinner === slot ? "is-winner" : ""}`}>
                    <span>PLAYER {slot + 1}</span>
                    <strong>{String(hotseatScores[slot] ?? 0).padStart(3, "0")}</strong>
                  </div>
                ))}
              </div>
            ) : null}

            <p className="muted-copy">{selected.description}</p>

            <div className="arcade-lab-game-shell">
              {matchComplete && arcadeMode === "coop" ? (
                <div className="arcade-hotseat-result">
                  <span>MATCH COMPLETE</span>
                  <strong>{hotseatWinner === null ? "DRAW" : `PLAYER ${hotseatWinner + 1} WINS`}</strong>
                  <p>P1 {hotseatScores[0]} // P2 {hotseatScores[1]}</p>
                  <button className="button primary" type="button" onClick={() => resetMatch("coop")}>REMATCH</button>
                </div>
              ) : (
                <>
                  <Game
                    key={`${selected.id}:${runId}:p${activePlayer}`}
                    score={score}
                    onScoreChange={updateCabinetScore}
                    storyReady={false}
                    turnNumber={arcadeMode === "coop" ? matchSeed : runId}
                    playMode={arcadeMode}
                  />
                  {!selected.managesFeedback ? <ArcadeFeedback feedback={scoreFeedback} mode={scoreFeedbackModeForGame(selected)} /> : null}
                </>
              )}
            </div>

            <div className="arcade-lab-actions">
              <button className="button" type="button" onClick={restart}>{arcadeMode === "coop" ? "RESTART MATCH" : "RESTART CABINET"}</button>
              {arcadeMode === "coop" && !matchComplete ? (
                <button className="button primary" type="button" onClick={bankHotseatTurn}>
                  {activePlayer === 0 ? "BANK P1 SCORE // PLAYER 2" : "FINISH MATCH"}
                </button>
              ) : null}
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
