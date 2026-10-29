import { useEffect, useState } from "react";

import "./inkscapeArchivePass6652.css";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import "./quillairoChronicleArchivePass6622.css";
import "./inkscapeChroniclesPass6654.css";
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
  const [search, setSearch] = useState("");

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

  const searchTerm = search.trim().toLowerCase();
  const displayedStories = stories.filter((story) =>
    [story.adventure_title, story.ending_label, story.final_scene_title,
      ...story.players.map((player) => player.character_name)]
      .join(" ").toLowerCase().includes(searchTerm),
  );

  return (
    <div className="q22-archive q22-sealed-archive">
      <PageTitle eyebrow="THE STORY ARCHIVE" title="Sealed chronicles" />
      <section className="q22-archive-intro" aria-label="Completed story archive introduction">
        <div className="q22-archive-intro-copy">
          <span className="q22-folio-label">COMPLETED STORIES</span>
          <h2>Some endings stay with us.</h2>
          <p>Return to the endings your Heroes reached and any narration saved along the way.</p>
        </div>
        <div className="q22-archive-ledger" aria-label="Completed chronicle count">
          <span className="q22-folio-label">SEALED &amp; SAVED</span>
          <strong>{loading ? "—" : stories.length}</strong>
          <span>finished chronicles</span>
        </div>
      </section>

      <Panel title="FINISHED STORIES">
        {!loading && !error && stories.length > 0 ? (
          <div className="q54-browser-tools">
            <label className="catalog-search-field q22-archive-search">
              <span>SEARCH FINISHED STORIES</span>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Story, Hero, or ending" />
            </label>
            {search ? <button type="button" className="button q54-clear-search" onClick={() => setSearch("")}>Clear search</button> : null}
            <p className="q54-results" role="status" aria-live="polite">Showing {displayedStories.length} of {stories.length} {stories.length === 1 ? "chronicle" : "chronicles"}</p>
          </div>
        ) : null}
        {loading ? <p className="muted-copy">Opening the archive…</p> : null}
        {error ? <div className="form-error" role="alert">{error}</div> : null}

        {!loading && !error && stories.length === 0 ? (
          <div className="empty-state">
            <strong>No finished chronicles yet.</strong>
            <span>When an adventure reaches its ending, you can revisit it here.</span>
          </div>
        ) : null}

        {!loading && !error && stories.length > 0 && displayedStories.length === 0 ? (
          <div className="empty-state"><strong>No matching chronicles</strong><span>Try a different story, Hero, or ending.</span></div>
        ) : null}

        <div className="history-grid">
          {displayedStories.map((story) => (
            <article className="history-card q22-chronicle q54-chronicle-card" key={story.history_id}>
              <span className="eyebrow">{story.ending_label}</span>
              <h2>{story.adventure_title}</h2>
              <div className="history-meta">
                <span>{story.turn_count} TURNS</span>
                <span>{story.players.map((player) => player.character_name).join(" + ")}</span>
                <span>{story.room_code}</span>
              </div>
              {story.completed_at ? <small>Completed: {new Date(story.completed_at).toLocaleDateString()}</small> : null}
              <p>{story.recap || story.final_resolution}</p>
              {story.final_resolution && story.final_resolution !== story.recap ? (
                <details className="q54-ending">
                  <summary>READ ENDING</summary>
                  {story.final_scene_title ? <strong>{story.final_scene_title}</strong> : null}
                  <p>{story.final_resolution}</p>
                </details>
              ) : null}
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