import { useMemo, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import { arcadeGameById, arcadeGamesForLab } from "../../features/arcade/ArcadeGameRegistry";

export function ArcadeLabPage() {
  const games = useMemo(() => arcadeGamesForLab(), []);
  const [selectedId, setSelectedId] = useState(games[0]?.id ?? "outlier");
  const [score, setScore] = useState(0);
  const [runId, setRunId] = useState(1);
  const selected = arcadeGameById(selectedId);
  const Game = selected.component;

  function selectGame(gameId: string) {
    setSelectedId(gameId);
    setScore(0);
    setRunId((value) => value + 1);
  }

  function restart() {
    setScore(0);
    setRunId((value) => value + 1);
  }

  return (
    <>
      <PageTitle
        eyebrow="INTERMISSION ARCADE // MICRO-ENGINE LAB"
        title="WASTE TIME PRODUCTIVELY."
        actions={<span className="network-badge is-online">LOCAL CABINETS // NO STORY REQUIRED</span>}
      />

      <section className="arcade-lab-layout">
        <Panel title="CABINET DIRECTORY" className="arcade-lab-directory">
          <div className="arcade-lab-list">
            {games.map((game) => (
              <button
                type="button"
                key={game.id}
                className={`arcade-lab-list-item ${game.id === selected.id ? "is-active" : ""}`}
                onClick={() => selectGame(game.id)}
              >
                <span>{game.title}</span>
                <small>{game.category.toUpperCase()} // {game.live ? "LIVE" : "LAB"}</small>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title={`${selected.title} // ${selected.category.toUpperCase()}`} className="arcade-lab-cabinet">
          <div className="arcade-lab-meta">
            <div><span>SCORE</span><strong>{String(score).padStart(3, "0")}</strong></div>
            <div><span>CONTROLS</span><strong>{selected.controls}</strong></div>
            <div><span>STATUS</span><strong>{selected.live ? "LIVE ROTATION" : "LAB ONLY"}</strong></div>
          </div>

          <p className="muted-copy">{selected.description}</p>

          <div className="arcade-lab-game-shell">
            <Game
              key={`${selected.id}:${runId}`}
              score={score}
              onScoreChange={setScore}
              storyReady={false}
              turnNumber={1}
              playMode="solo"
            />
          </div>

          <div className="arcade-lab-actions">
            <button className="button" type="button" onClick={restart}>RESTART CABINET</button>
          </div>
        </Panel>
      </section>
    </>
  );
}
