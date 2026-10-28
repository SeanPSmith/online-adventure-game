import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import {
  deleteCharacter, getHeroPortraits, listCharacters, setHeroDisposition, type Character,
} from "../../services/characters";
import "./quillairoHeroArchivePass6615.css";
import "./inkscapeHeroPass6653.css";

type Action = "bury" | "retire" | "restore" | "delete";
type View = "living" | "retired" | "fallen" | "all";

function fateLabel(hero: Character) {
  if (hero.hero_status === "buried") return "LAID TO REST";
  if (!hero.is_alive) return "FALLEN IN ADVENTURE";
  if (hero.hero_status === "retired") return "RETIRED";
  return "LIVING HERO";
}

function heroBelongsToView(hero: Character, view: View) {
  if (view === "living") return hero.is_alive && hero.hero_status === "active";
  if (view === "retired") return hero.is_alive && hero.hero_status === "retired";
  if (view === "fallen") return !hero.is_alive;
  return true;
}

/** Hero portraits are owner-private, loaded in small batches rather than exposing S3 URLs. */
async function selectedHeroPortraits(heroes: Character[], active: () => boolean) {
  const portraits: Record<string, string> = {};
  for (let index = 0; index < heroes.length && active(); index += 4) {
    const batch = heroes.slice(index, index + 4);
    const results = await Promise.allSettled(batch.map((hero) => getHeroPortraits(hero.character_id)));
    results.forEach((result, position) => {
      if (result.status !== "fulfilled") return;
      const chosen = result.value.candidates.find((item) => item.attempt === result.value.selected_attempt);
      if (chosen && active()) portraits[batch[position].character_id] = chosen.url;
    });
  }
  return portraits;
}

export function HeroManagerPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [portraitUrls, setPortraitUrls] = useState<Record<string, string>>({});
  const [view, setView] = useState<View>("living");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ id: string; action: Action } | null>(null);
  const [epitaph, setEpitaph] = useState("");
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    let alive = true;
    listCharacters()
      .then((response) => {
        if (!alive) return;
        setCharacters(response.characters);
        void selectedHeroPortraits(response.characters, () => alive).then((urls) => {
          if (alive) setPortraitUrls(urls);
        });
      })
      .catch((reason) => { if (alive) setError(reason instanceof Error ? reason.message : "Unable to load Heroes."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  function ask(id: string, action: Action) {
    setPending({ id, action });
    setEpitaph("");
    setConfirmName("");
    setError("");
  }

  async function confirm() {
    if (!pending || busy) return;
    const hero = characters.find((item) => item.character_id === pending.id);
    if (!hero) return;
    if (pending.action === "delete" && confirmName !== hero.name) return;
    setBusy(true);
    setError("");
    try {
      if (pending.action === "delete") {
        await deleteCharacter(hero.character_id);
        setCharacters((current) => current.filter((item) => item.character_id !== hero.character_id));
        setPortraitUrls((current) => {
          const next = { ...current };
          delete next[hero.character_id];
          return next;
        });
      } else {
        const updated = await setHeroDisposition(hero.character_id, pending.action, epitaph);
        setCharacters((current) => current.map((item) => item.character_id === hero.character_id ? updated : item));
      }
      setPending(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Hero archive could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  const living = characters.filter((hero) => hero.is_alive && hero.hero_status === "active").length;
  const retired = characters.filter((hero) => hero.is_alive && hero.hero_status === "retired").length;
  const fallen = characters.filter((hero) => !hero.is_alive && hero.hero_status !== "buried").length;
  const archived = characters.filter((hero) => hero.hero_status === "retired" || hero.hero_status === "buried").length;
  const visibleHeroes = useMemo(() => characters.filter((hero) => heroBelongsToView(hero, view)
    && `${hero.name} ${hero.archetype || ""} ${hero.appearance?.species || ""}`.toLowerCase().includes(search.trim().toLowerCase())),
  [characters, search, view]);

  return (
    <div className="qh15-archive">
      <PageTitle eyebrow="THE HERO REGISTER" title="Hero Hall"
        actions={<Link className="button button-primary" to="/game/heroes/new">CREATE HERO →</Link>} />
      <section className="qh15-hall-intro" aria-label="Hero Hall introduction">
        <div className="qh15-intro-copy">
          <span className="qh15-kicker">THE HERO REGISTER</span>
          <h2>Every hero begins<br/>with a name.</h2>
          <p>Your characters cross worlds, gather scars, and become part of the stories they write. Choose a Hero to read their chronicle or continue their journey.</p>
          <div className="qh15-hall-counts" aria-label="Hero archive totals">
            <span><strong>{living}</strong> Living</span>
            <span><strong>{retired}</strong> Retired</span>
            <span><strong>{fallen}</strong> Fallen</span>
            <span><strong>{archived}</strong> Archived</span>
          </div>
          <Link className="qh15-subtle-link" to="/game/graveyard">Visit the Graveyard <span aria-hidden="true">→</span></Link>
        </div>
        <img className="qh15-intro-art" src="/art/quillairo-heroes/hero-hall-vista.png" alt="" aria-hidden="true" />
      </section>

      <div className="qh15-archive-tools">
        <div className="qh15-filter-tabs" role="group" aria-label="Filter Hero Hall">
          {(["living", "retired", "fallen", "all"] as const).map((tab) => (
            <button type="button" key={tab} aria-pressed={view === tab} className={view === tab ? "is-active" : ""}
              onClick={() => setView(tab)}>{tab === "all" ? "All Heroes" : tab === "fallen" ? "Fallen & Remembered" : tab}</button>
          ))}
        </div>
        <label className="qh15-search"><span>Find a Hero</span>
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, calling, species…" />
        </label>
      </div>
      {!loading && !error && characters.length > 0 ? <p className="q53-view-count" role="status">Showing {visibleHeroes.length} of {characters.length} {characters.length === 1 ? "hero" : "heroes"}</p> : null}
      {loading ? <p className="route-loading" role="status">Opening the Hero archive…</p> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      {!loading && !error && characters.length === 0 ? (
        <section className="qh15-empty"><span className="qh15-kicker">THE FIRST PAGE IS YOURS</span>
          <h2>No Heroes yet.</h2><p>Every legend begins with someone willing to take the first step.</p>
          <Link className="button button-primary" to="/game/heroes/new">CREATE YOUR FIRST HERO →</Link>
        </section>
      ) : null}
      {!loading && characters.length > 0 && visibleHeroes.length === 0 ? (
        <p className="qh15-no-results" role="status">No Heroes match this page of the archive. Change your search or choose another chapter above.</p>
      ) : null}
      <div className="qh15-hero-grid">
        {visibleHeroes.map((hero) => {
          const dead = !hero.is_alive;
          const archivedHero = hero.hero_status !== "active";
          const activePrompt = pending?.id === hero.character_id ? pending.action : null;
          return (
            <article className={`qh15-hero-card ${dead ? "is-fallen" : archivedHero ? "is-archived" : ""}`} key={hero.character_id}>
              <div className="qh15-card-image">
                {portraitUrls[hero.character_id]
                  ? <img src={portraitUrls[hero.character_id]} loading="lazy" alt={`Chosen portrait of ${hero.name}`} />
                  : <img className="qh15-card-emblem" src="/brand/monogram-gold-original.png" loading="lazy" alt="" aria-hidden="true" />}
                <span className="qh15-card-fate">{fateLabel(hero)}</span>
              </div>
              <div className="qh15-card-body">
                <span className="qh15-kicker">CHRONICLE · LEVEL {hero.level}</span>
                <h2><Link to={`/game/heroes/${hero.character_id}`}>{hero.name}</Link></h2>
                <p className="qh15-card-identity">{[hero.archetype,hero.appearance?.species,hero.appearance?.origin].filter(Boolean).join(" · ") || "An unwritten beginning"}</p>
                <p className="qh15-card-excerpt">{dead ? String(hero.death_record?.cause || "Their final chapter has been written.") : hero.bio || "Their story is waiting to be told."}</p>
                <div className="qh15-card-ledger">
                  <div><span>HP</span><strong>{hero.health} / {hero.max_health}</strong></div>
                  <div><span>XP</span><strong>{hero.experience}</strong></div>
                  <div><span>UNSPENT</span><strong>{hero.unspent_stat_points + hero.unspent_skill_points + hero.unspent_talent_points}</strong></div>
                </div>
                <div className="qh15-card-actions">
                  <Link className="qh15-subtle-link" to={`/game/heroes/${hero.character_id}`}>OPEN CHRONICLE →</Link>
                  {!dead && hero.hero_status === "active" ? <button type="button" onClick={() => ask(hero.character_id, "retire")}>Retire</button> : null}
                  {!dead && hero.hero_status === "retired" ? <button type="button" onClick={() => ask(hero.character_id, "restore")}>Return to adventure</button> : null}
                  {dead && hero.hero_status === "active" ? <button type="button" onClick={() => ask(hero.character_id, "bury")}>Lay to rest</button> : null}
                  <button type="button" className="qh15-danger-link" onClick={() => ask(hero.character_id, "delete")}>Delete</button>
                </div>
                {activePrompt ? <div className="qh15-confirm" role="group" aria-label={`Confirm ${activePrompt} of ${hero.name}`}>
                  <strong>{activePrompt === "bury" ? `A FINAL FAREWELL TO ${hero.name.toUpperCase()}` : activePrompt === "delete" ? "ERASE THIS HERO?" : activePrompt === "retire" ? "CLOSE THIS CHAPTER?" : "WELCOME THIS HERO BACK?"}</strong>
                  <p>{activePrompt === "bury" ? "This publishes a public gravestone in the shared Graveyard. This Hero can never adventure again." : activePrompt === "delete" ? "PERMANENT: This removes the character record, including any public gravestone. This action cannot be undone." : activePrompt === "retire" ? "This Hero will disappear from adventure selectors. You can restore a living retired Hero later." : "This living Hero becomes selectable for new adventures again."}</p>
                  {activePrompt === "bury" ? <label>EPITAPH (OPTIONAL)<textarea maxLength={160} rows={2} value={epitaph} onChange={(event) => setEpitaph(event.target.value)} placeholder="Here lies a soul who braved the darkness…" /></label> : null}
                  {activePrompt === "delete" ? <label>TYPE THE HERO'S EXACT NAME TO CONFIRM<input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={hero.name}/></label> : null}
                  <div className="qh15-confirm-actions">
                    <button className="button button-primary" disabled={busy || (activePrompt === "delete" && confirmName !== hero.name)} type="button" onClick={() => void confirm()}>{busy ? "SAVING…" : activePrompt === "delete" ? "DELETE FOREVER" : activePrompt === "bury" ? "COMMIT TO MEMORY" : "CONFIRM"}</button>
                    <button className="button" disabled={busy} type="button" onClick={() => setPending(null)}>CANCEL</button>
                  </div>
                </div> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
