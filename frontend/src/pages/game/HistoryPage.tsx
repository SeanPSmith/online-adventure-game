import { useEffect, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  listCharacters,
  listCharacterStories,
  type CompletedStory,
} from "../../services/characters";

export function HistoryPage() {
  const [stories, setStories] = useState<CompletedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const heroResponse = await listCharacters();

        const results = await Promise.all(
          heroResponse.characters.map((hero) =>
            listCharacterStories(hero.character_id),
          ),
        );

        const deduplicated = new Map<string, CompletedStory>();

        for (const result of results) {
          for (const story of result.stories) {
            deduplicated.set(story.history_id, story);
          }
        }

        const ordered = [...deduplicated.values()].sort(
          (a, b) =>
            new Date(b.completed_at).getTime() -
            new Date(a.completed_at).getTime(),
        );

        if (alive) setStories(ordered);
      } catch (reason) {
        if (alive) {
          setError(
            reason instanceof Error
              ? reason.message
              : "The archive could not be opened.",
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <PageTitle eyebrow="ARCHIVE" title="SEALED CHRONICLES" />

      <Panel title="COMPLETED JOURNEYS">
        {loading ? <p className="muted-copy">DUSTING OFF THE ARCHIVE_</p> : null}
        {error ? <div className="form-error">{error}</div> : null}

        {!loading && !error && stories.length === 0 ? (
          <div className="empty-state">
            <strong>NO TALES TO TELL. YET.</strong>
            <span>This is either peaceful or deeply suspicious.</span>
          </div>
        ) : null}

        <div className="history-grid">
          {stories.map((story) => (
            <article className="history-card" key={story.history_id}>
              <span className="eyebrow">{story.ending_label}</span>
              <h2>{story.adventure_title}</h2>
              <div className="history-meta">
                <span>{story.turn_count} TURNS</span>
                <span>{story.players.map((player) => player.character_name).join(" + ")}</span>
                <span>{story.room_code}</span>
              </div>
              <p>{story.recap || story.final_resolution}</p>
            </article>
          ))}
        </div>
      </Panel>
    </>
  );
}
