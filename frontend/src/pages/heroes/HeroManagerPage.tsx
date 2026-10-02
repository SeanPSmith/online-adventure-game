import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import { listCharacters, type Character } from "../../services/characters";

export function HeroManagerPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    listCharacters()
      .then((response) => {
        if (alive) setCharacters(response.characters);
      })
      .catch((reason) => {
        if (alive) setError(reason instanceof Error ? reason.message : "Unable to load Heroes.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <PageTitle
        eyebrow="HERO HALL"
        title="MANAGE HEROES"
        actions={<Link className="button button-primary" to="/game/heroes/new">CREATE HERO</Link>}
      />

      {loading ? <div className="route-loading">LOADING HEROES_</div> : null}
      {error ? <div className="form-error">{error}</div> : null}

      <div className="hero-card-grid">
        {characters.map((hero) => (
          <Link className="hero-card panel" key={hero.character_id} to={`/game/heroes/${hero.character_id}`}>
            <div className="panel-body">
              <div className="eyebrow">LEVEL {hero.level}</div>
              <h2>{hero.name}</h2>
              {hero.bio ? <p className="hero-card-bio">{hero.bio}</p> : null}
              <div className="hero-card-stats">
                <span>HP {hero.health}/{hero.max_health}</span>
                <span>XP {hero.experience}</span>
                <span>PTS {hero.unspent_stat_points + hero.unspent_skill_points + hero.unspent_talent_points}</span>
                <span>TALENTS {hero.talents.length}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {!loading && !error && characters.length === 0 ? (
        <Panel title="NO HEROES YET">
          <Link to="/game/heroes/new">CREATE YOUR FIRST HERO →</Link>
        </Panel>
      ) : null}
    </>
  );
}
