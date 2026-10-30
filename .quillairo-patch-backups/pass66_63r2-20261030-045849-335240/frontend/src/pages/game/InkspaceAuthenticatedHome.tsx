/**
 * Pass 64.4N — the authenticated Home leaf. All inputs come from the existing
 * GameHomePage hooks; there is no second socket, mock account, or game-state path.
 */
import { Link } from "react-router";
import type { Character } from "../../services/characters";
import type { AdventureCatalogItem, AdventureListItem } from "../../services/game";

const ROOT = "/art/pass64/";
function coverFor(title: string, tags: string[] = []) {
  const text = `${title} ${tags.join(" ")}`.toLowerCase();
  if (/space|star|galaxy|sci.fi|cyber|future/.test(text)) return `${ROOT}scifi.webp`;
  if (/horror|gothic|haunt|shadow|blood|ashes/.test(text)) return `${ROOT}gothic.webp`;
  if (/sea|harbor|light|coast|ocean|water/.test(text)) return `${ROOT}harbor.webp`;
  if (/fantasy|castle|dragon|king|crown/.test(text)) return `${ROOT}fantasy.webp`;
  return `${ROOT}explorer.webp`;
}

export type HomeLeaf = "home" | "heroes" | "journeys" | "discover" | "wardrobe" | "tools";
export interface InkspaceAuthenticatedHomeProps {
  username: string;
  connected: boolean;
  directoryReady: boolean;
  heroes: Character[];
  playableHeroes: Character[];
  selectedHeroId: string;
  occupiedHeroIds: ReadonlySet<string>;
  adventures: AdventureListItem[];
  catalog: AdventureCatalogItem[];
  onChooseHero: (id: string) => void;
  onNavigate: (page: HomeLeaf) => void;
  onInspectAdventure: (adventure: AdventureCatalogItem) => void;
}

export function InkspaceAuthenticatedHome({
  username, connected, directoryReady, heroes, playableHeroes,
  selectedHeroId, occupiedHeroIds, adventures, catalog,
  onChooseHero, onNavigate, onInspectAdventure,
}: InkspaceAuthenticatedHomeProps) {
  const activeJourneys = adventures.filter((item) => !item.completed);
  const resume = activeJourneys[0];
  const recentJourneys = adventures.slice(0, 3);
  const discovery = catalog[0];
  return (
    <>
      <section className="p64n-leaf p64n-leaf-left p644-page" aria-label="Your living storybook homepage">
        <div className="p64n-intro">
          <span className="p64n-rubric">✧ A NOTE FROM THE LIBRARY ✧</span>
          <h1>Welcome back,<br /><em>troublemaker.</em></h1>
          <p>The worlds have been behaving suspiciously well without you.</p>
        </div>
        <img
          className="p64n-watercolor"
          src={`${ROOT}inkspace/harbor-traveler-cutout.png`}
          alt="Watercolor traveler overlooking a sunlit fantasy harbor, painted directly onto parchment"
          decoding="async"
        />
        <div className="p64n-continuation" aria-label="Continue your journey">
          <span className="p64n-rubric">✧ {resume ? "YOUR STORY AWAITS" : "A NEW CHAPTER AWAITS"}</span>
          {resume ? (
            <>
              <h2>{resume.adventure_title}</h2>
              <p>Turn {resume.turn_number}{resume.scene_title ? ` · ${resume.scene_title}` : ""}</p>
              <Link className="p64n-seal-action" to={`/game/adventure/${encodeURIComponent(resume.room_code)}?hero=${encodeURIComponent(resume.character_id)}`}>
                {resume.director_retry_required ? "Recover your story" : "Return to your story"} <span aria-hidden="true">↗</span>
              </Link>
            </>
          ) : (
            <>
              <h2>{!directoryReady ? "Consulting the chronicles…" : "The next tale is yours."}</h2>
              <p>{heroes.length ? "Every great adventure starts with a questionable decision." : "Every legend begins with a Hero."}</p>
              {heroes.length ? (
                <button className="p64n-seal-action" type="button" onClick={() => onNavigate("discover")}>Explore the library <span aria-hidden="true">↗</span></button>
              ) : (
                <Link className="p64n-seal-action" to="/game/heroes/new">Create your first Hero <span aria-hidden="true">↗</span></Link>
              )}
            </>
          )}
        </div>
        <div className="p64n-leaf-footer" aria-hidden="true">✧ The next page is waiting ✧</div>
      </section>
      <section className="p64n-leaf p64n-leaf-right p644-page" aria-label="Your Heroes, adventures and discoveries">
        <div className="p64n-section-head">
          <h2><span aria-hidden="true">✧</span> YOUR HEROES</h2>
          <button type="button" onClick={() => onNavigate("heroes")}>View all →</button>
        </div>
        <div className="p64n-heroes">
          {playableHeroes.slice(0, 2).map((hero) => {
            const busy = occupiedHeroIds.has(hero.character_id);
            const selected = hero.character_id === selectedHeroId;
            return (
              <div className="p64n-hero" key={hero.character_id}>
                <button type="button" className={`p64n-hero-medallion ${selected ? "is-selected" : ""}`}
                  disabled={busy} onClick={() => onChooseHero(hero.character_id)}
                  aria-label={`${busy ? "Currently adventuring: " : selected ? "Selected Hero: " : "Choose Hero: "}${hero.name}`}
                  aria-pressed={selected} title={busy ? `${hero.name} is already in a journey` : `Play as ${hero.name}`}>
                  <span aria-hidden="true">{hero.name.slice(0, 1).toLocaleUpperCase()}</span>
                </button>
                <Link to={`/game/heroes/${encodeURIComponent(hero.character_id)}`}>{hero.name} ↗</Link>
                <small>Level {hero.level} · {busy ? "In a story" : selected ? "Selected" : "Available"}</small>
                <div className="p64n-hero-vital" role="img" aria-label={`${hero.name}: ${hero.health} of ${hero.max_health} health points`}>
                  <span style={{ width: `${Math.min(100, Math.max(0, hero.max_health ? hero.health / hero.max_health * 100 : 0))}%` }} />
                </div>
              </div>
            );
          })}
          {!playableHeroes.length ? (
            <div className="p64n-empty-hero">
              <span aria-hidden="true">✧</span>
              <p>{heroes.length ? "No active Heroes available." : "Your first Hero is waiting to be written."}</p>
              <Link to={heroes.length ? "/game/heroes" : "/game/heroes/new"}>{heroes.length ? "Open Hero Hall" : "Create a Hero"} →</Link>
            </div>
          ) : null}
        </div>
        <div className="p64n-section-head">
          <h2><span aria-hidden="true">✧</span> RECENT ADVENTURES</h2>
          <button type="button" onClick={() => onNavigate("journeys")}>View all →</button>
        </div>
        <div className="p64n-journeys">
          {recentJourneys.map((item) => (
            <Link className="p64n-journey" key={`${item.room_code}:${item.character_id}`}
              to={item.completed ? "/game/adventures" : `/game/adventure/${encodeURIComponent(item.room_code)}?hero=${encodeURIComponent(item.character_id)}`}>
              <img src={coverFor(item.adventure_title)} alt={`Watercolor cover representing ${item.adventure_title}`} loading="lazy" />
              <strong>{item.adventure_title}</strong>
              <small>{item.completed ? "Completed" : `Turn ${item.turn_number} · ${item.character_name}`}</small>
            </Link>
          ))}
          {recentJourneys.length === 0 && (
            <p className="p64n-empty-adventures">{directoryReady ? "Your chronicles begin with the next adventure." : "Reading the adventure register…"}</p>
          )}
        </div>
        <div className="p64n-section-head p64n-last-heading">
          <h2><span aria-hidden="true">✧</span> DISCOVER NEW WORLDS</h2>
          <button type="button" onClick={() => onNavigate("discover")}>Browse all →</button>
        </div>
        <div className="p64n-discovery">
          <img src={`${ROOT}inkspace/forgotten-crossroads-cutout.png`} alt="Isolated watercolor of a winding trail leading into an unknown valley" loading="lazy" />
          <div>
            <strong>{discovery?.title ?? "New adventures await"}</strong>
            <p>{discovery ? discovery.description : "Strange places. Braver choices. Better company."}</p>
            {discovery && connected && selectedHeroId ? (
              <button type="button" onClick={() => onInspectAdventure(discovery)}>Read synopsis ↗</button>
            ) : (
              <button type="button" onClick={() => onNavigate("discover")}>Explore the library ↗</button>
            )}
          </div>
        </div>
        <p className="p64n-footer-script">Good stories find good people. ✧</p>
        <span className="p64n-screenreader" role="status">{connected ? `${username}'s adventure library connected` : "Reconnecting to the adventure library"}</span>
      </section>
    </>
  );
}
