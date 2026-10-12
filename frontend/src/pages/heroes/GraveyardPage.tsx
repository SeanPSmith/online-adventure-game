import { useEffect, useState } from "react";
import { Link } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { listGraveyard, type HeroMemorial } from "../../services/characters";

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

  return <>
    <PageTitle eyebrow="THE LAST RESTING PLACE // ALL PLAYERS" title="THE GRAVEYARD"
      actions={<Link className="button" to="/game/heroes">RETURN TO HERO HALL</Link>} />
    <section className="graveyard-intro">
      <pre aria-hidden="true">{String.raw`         _  _
       _| || |_          .      .
      |_  __  _|        / \    / \
        | || |       __/___\__/___\__
        |_||_|       |    REST HERE    |
                     |_________________|`}</pre>
      <p>Beyond the last campfire lie the heroes whose stories ended on the road. These stones were placed by their players. Their adventures may be over; their names endure.</p>
      <span className="eyebrow">{memorials.length} REMEMBERED SOUL{memorials.length === 1 ? "" : "S"}</span>
    </section>
    {loading ? <p className="route-loading">WALKING AMONG THE STONES_</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {!loading && !error && memorials.length === 0 ? <section className="graveyard-empty"><pre aria-hidden="true">{String.raw`     _____
    /     \
   |  ...  |
   |_______|`}</pre><p>The earth is quiet. No stones have been placed yet.</p></section> : null}
    <div className="graveyard-stones">
      {memorials.map((hero) => <article className="graveyard-stone" key={hero.character_id}>
        <pre aria-hidden="true">{String.raw`       .----------.
      /   R.I.P.   \
     |              |
     |______________|
     |______________|`}</pre>
        <h2>{hero.name}</h2>
        <span className="eyebrow">LEVEL {hero.level} · XP {hero.experience}</span>
        {hero.epitaph ? <blockquote>{hero.epitaph}</blockquote> : <p className="graveyard-quiet">A story written in courage.</p>}
        {hero.cause ? <p className="graveyard-cause">{hero.cause}</p> : null}
        <small>LAID TO REST {hero.buried_at.slice(0, 10)}</small>
      </article>)}
    </div>
  </>;
}
