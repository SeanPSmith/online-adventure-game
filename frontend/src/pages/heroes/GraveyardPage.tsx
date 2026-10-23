import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { listGraveyard, type HeroMemorial } from "../../services/characters";
import "./quillairoHeroArchivePass6615.css";

export function GraveyardPage() {
  const [memorials, setMemorials] = useState<HeroMemorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    listGraveyard()
      .then((value) => { if (alive) setMemorials(value.memorials); })
      .catch((reason) => { if (alive) setError(reason instanceof Error ? reason.message : "The cemetery gates could not be opened."); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return <div className="qh15-graveyard">
    <PageTitle eyebrow="THE LAST RESTING PLACE · ALL PLAYERS" title="A place to remember"
      actions={<Link className="button" to="/game/heroes">RETURN TO HERO HALL</Link>} />
    <section className="qh15-grave-intro">
      <div>
        <span className="qh15-kicker">THE SHARED GRAVEYARD</span>
        <h2>Some stories<br/>become legends.</h2>
        <p>Beyond the last campfire lie the Heroes whose journeys ended on the road. These memorials were placed by their players. Their adventures may be over; their names endure.</p>
        <span className="qh15-grave-count">{memorials.length} REMEMBERED SOUL{memorials.length === 1 ? "" : "S"}</span>
      </div>
      <img src="/art/quillairo-heroes/memorial-crossroads.png" alt="" aria-hidden="true" />
    </section>
    {loading ? <p className="route-loading" role="status">Opening the memorial book…</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {!loading && !error && memorials.length === 0 ? (
      <section className="qh15-grave-empty"><span aria-hidden="true">✧</span><p>For now, the memorial book is blank. May it stay that way a little longer.</p></section>
    ) : null}
    <div className="qh15-memorials">
      {memorials.map((hero) => <article className="qh15-memorial" key={hero.character_id}>
        <span className="qh15-memorial-ornament" aria-hidden="true">✦</span>
        <span className="qh15-kicker">A LIFE REMEMBERED · LEVEL {hero.level}</span>
        <h2>{hero.name}</h2>
        <p className="qh15-memorial-level">{hero.experience} experience earned</p>
        {hero.epitaph ? <blockquote>{hero.epitaph}</blockquote> : <blockquote>“A story written in courage.”</blockquote>}
        {hero.cause ? <p className="qh15-memorial-cause">{hero.cause}</p> : null}
        <small>LAID TO REST {hero.buried_at.slice(0, 10)}</small>
      </article>)}
    </div>
  </div>;
}
