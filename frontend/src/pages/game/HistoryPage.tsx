import { useEffect, useState } from "react";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import "./quillairoChronicleArchivePass6622.css";
import { ShareMomentButton } from "../../components/game/ShareMomentButton";
import { ArchivedChronicleAudio } from "../../components/game/ArchivedChronicleAudio";
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
    <div className="q22-archive q22-sealed-archive">
      <PageTitle eyebrow="THE STORY ARCHIVE" title="Sealed chronicles" />
      <section className="q22-archive-intro" aria-label="Completed story archive introduction">
        <div className="q22-archive-intro-copy">
          <span className="q22-folio-label">THE CHRONICLE SHELF · VOL. II</span>
          <h2>Some endings stay with us.</h2>
          <p>Read the stories your Heroes brought to their final page, and listen again whenever their narration was saved.</p>
        </div>
        <div className="q22-archive-ledger" aria-label="Completed chronicle count">
          <span className="q22-folio-label">SEALED &amp; SAVED</span>
          <strong>{loading ? "—" : stories.length}</strong>
          <span>finished chronicles</span>
        </div>
      </section>

      <Panel title="THE COMPLETED COLLECTION">
        {loading ? <p className="muted-copy">Opening the archive…</p> : null}
        {error ? <div className="form-error" role="alert">{error}</div> : null}

        {!loading && !error && stories.length === 0 ? (
          <div className="empty-state">
            <strong>No finished chronicles yet.</strong>
            <span>When an adventure reaches its ending, you can revisit it here.</span>
          </div>
        ) : null}

        <div className="history-grid">
          {stories.map((story) => (
            <article className="history-card q22-chronicle" key={story.history_id}>
              <span className="eyebrow">{story.ending_label}</span>
              <h2>{story.adventure_title}</h2>
              <div className="history-meta">
                <span>{story.turn_count} TURNS</span>
                <span>{story.players.map((player) => player.character_name).join(" + ")}</span>
                <span>{story.room_code}</span>
              </div>
              <p>{story.recap || story.final_resolution}</p>
              <ArchivedChronicleAudio historyId={story.history_id} />
              <div className="history-card-actions">
                <ShareMomentButton
                  title={`${story.adventure_title} — Quillairo`}
                  text={`${story.ending_label} // ${story.recap || story.final_resolution}`}
                  url={`${window.location.origin}/`}
                  label="SHARE CHRONICLE"
                  className="button button-quiet"
                />
              </div>
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}