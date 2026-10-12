import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  deleteCharacter, listCharacters, setHeroDisposition, type Character,
} from "../../services/characters";

type Action = "bury" | "retire" | "restore" | "delete";

function fateLabel(hero: Character) {
  if (hero.hero_status === "buried") return "LAID TO REST";
  if (!hero.is_alive) return "FALLEN IN ADVENTURE";
  if (hero.hero_status === "retired") return "RETIRED";
  return "LIVING HERO";
}

export function HeroManagerPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<{ id: string; action: Action } | null>(null);
  const [epitaph, setEpitaph] = useState("");
  const [confirmName, setConfirmName] = useState("");

  useEffect(() => {
    let alive = true;
    listCharacters()
      .then((response) => { if (alive) setCharacters(response.characters); })
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
  const fallen = characters.filter((hero) => !hero.is_alive && hero.hero_status !== "buried").length;
  const archived = characters.filter((hero) => hero.hero_status === "retired" || hero.hero_status === "buried").length;

  return (
    <>
      <PageTitle eyebrow="HERO HALL // THE CHRONICLE ENDURES" title="MANAGE HEROES"
        actions={<Link className="button button-primary" to="/game/heroes/new">CREATE HERO</Link>} />
      <div className="hero-hall-intro">
        <pre aria-hidden="true">{String.raw`           /\
      ___ /  \ ___
     | LEST WE FORGET |
     |________________|`}</pre>
        <div>
          <span className="eyebrow">EVERY HERO HAS A STORY. NOT EVERY STORY HAS A HAPPY ENDING.</span>
          <p>Those who fall are remembered. Those who retire may return. Those laid to rest join the shared graveyard.</p>
          <div className="hero-hall-counts"><span>{living} LIVING</span><span>{fallen} FALLEN</span><span>{archived} ARCHIVED</span></div>
          <Link className="button" to="/game/graveyard">VISIT THE GRAVEYARD →</Link>
        </div>
      </div>
      {loading ? <div className="route-loading">LOADING HEROES_</div> : null}
      {error ? <div className="form-error" role="alert">{error}</div> : null}
      <div className="hero-card-grid hero-memorial-grid">
        {characters.map((hero) => {
          const dead = !hero.is_alive;
          const archivedHero = hero.hero_status !== "active";
          const activePrompt = pending?.id === hero.character_id ? pending.action : null;
          return (
            <article className={`hero-card panel hero-legacy-card ${dead ? "is-fallen" : archivedHero ? "is-archived" : ""}`} key={hero.character_id}>
              <div className="panel-body">
                <div className="hero-legacy-heading">
                  <span className="eyebrow">LEVEL {hero.level} // {fateLabel(hero)}</span>
                  {dead ? <pre aria-hidden="true" className="hero-card-stone">{String.raw`  .----.
 / R.I.P\
 |_____|`}</pre> : null}
                </div>
                <h2><Link to={`/game/heroes/${hero.character_id}`}>{hero.name}</Link></h2>
                {dead ? (
                  <p className="hero-legacy-obituary">{String(hero.death_record?.cause || "Their final chapter has been written.")}</p>
                ) : hero.bio ? <p className="hero-card-bio">{hero.bio}</p> : null}
                <div className="hero-card-stats">
                  <span>HP {hero.health}/{hero.max_health}</span>
                  <span>XP {hero.experience}</span>
                  <span>PTS {hero.unspent_stat_points + hero.unspent_skill_points + hero.unspent_talent_points}</span>
                </div>
                <div className="hero-legacy-actions">
                  <Link className="button" to={`/game/heroes/${hero.character_id}`}>OPEN CHRONICLE</Link>
                  {!dead && hero.hero_status === "active" ? <button className="button" type="button" onClick={() => ask(hero.character_id, "retire")}>RETIRE</button> : null}
                  {!dead && hero.hero_status === "retired" ? <button className="button" type="button" onClick={() => ask(hero.character_id, "restore")}>RETURN TO ACTIVE DUTY</button> : null}
                  {dead && hero.hero_status === "active" ? <button className="button hero-bury-button" type="button" onClick={() => ask(hero.character_id, "bury")}>LAY TO REST</button> : null}
                  <button className="button hero-delete-button" type="button" onClick={() => ask(hero.character_id, "delete")}>DELETE PERMANENTLY</button>
                </div>
                {activePrompt ? <div className="hero-legacy-confirm" role="group" aria-label={`Confirm ${activePrompt} of ${hero.name}`}>
                  <strong>{activePrompt === "bury" ? `A FINAL FAREWELL TO ${hero.name.toUpperCase()}` : activePrompt === "delete" ? "ERASE THIS HERO?" : activePrompt === "retire" ? "CLOSE THIS CHAPTER?" : "WELCOME THIS HERO BACK?"}</strong>
                  <p>{activePrompt === "bury" ? "This publishes a public gravestone in the shared Graveyard. This Hero can never adventure again." : activePrompt === "delete" ? "PERMANENT: This removes the character record, including any public gravestone. This action cannot be undone." : activePrompt === "retire" ? "This Hero will disappear from adventure selectors. You can restore a living retired Hero later." : "This living Hero becomes selectable for new adventures again."}</p>
                  {activePrompt === "bury" ? <label>EPITAPH (OPTIONAL)<textarea maxLength={160} rows={2} value={epitaph} onChange={(event) => setEpitaph(event.target.value)} placeholder="Here lies a soul who braved the darkness…" /></label> : null}
                  {activePrompt === "delete" ? <label>TYPE THE HERO'S EXACT NAME TO CONFIRM<input value={confirmName} onChange={(event) => setConfirmName(event.target.value)} placeholder={hero.name}/></label> : null}
                  <div className="hero-legacy-actions">
                    <button className="button button-primary" disabled={busy || (activePrompt === "delete" && confirmName !== hero.name)} type="button" onClick={() => void confirm()}>{busy ? "SAVING_" : activePrompt === "delete" ? "DELETE FOREVER" : activePrompt === "bury" ? "COMMIT TO MEMORY" : "CONFIRM"}</button>
                    <button className="button" disabled={busy} type="button" onClick={() => setPending(null)}>CANCEL</button>
                  </div>
                </div> : null}
              </div>
            </article>
          );
        })}
      </div>
      {!loading && !error && characters.length === 0 ? (
        <Panel title="NO HEROES YET"><Link to="/game/heroes/new">CREATE YOUR FIRST HERO →</Link></Panel>
      ) : null}
    </>
  );
}
