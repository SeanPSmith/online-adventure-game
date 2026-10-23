/**
 * Pass 65.5: read-only, live character folio within the protected Inkbound atelier.
 * Uses existing Hero APIs; never fabricates character class, origin, inventory,
 * talents, XP, or active effects. Advancement stays with the canonical Hero Sheet.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { HeroEffectList } from "../../features/adventure/HeroEffectList";
import { getCharacter, getCreationRules, listCharacters, type Character, type CreationRules } from "../../services/characters";

const folioArt = "/art/inkbound";
const humanize = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : 0;
function InkDots({ value, max }: { value: number; max: number }) {
  const ceiling = Math.max(1, Math.min(max, 12));
  const filled = Math.max(0, Math.min(ceiling, Math.round(value)));
  return <span className="i655-dot-track" role="img" aria-label={`${value} points`}>
    {Array.from({ length: ceiling }, (_, index) => <span key={index} className={index < filled ? "is-inked" : ""} />)}
  </span>;
}
function SectionName({children}:{children:string}) { return <h2 className="i655-section-name"><span>{children}</span></h2>; }

export function InkboundHeroFolio({ heroId, onBack }: { heroId: string | null; onBack: () => void }) {
  const [hero, setHero] = useState<Character | null>(null);
  const [rules, setRules] = useState<CreationRules | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  useEffect(() => {
    let active = true;
    setState("loading"); setHero(null);
    (async () => {
      try {
        const id = heroId ?? (await listCharacters()).characters.find(item => item.is_alive && item.hero_status === "active")?.character_id;
        if (!id) { if (active) setState("empty"); return; }
        const result = await getCharacter(id);
        if (active) { setHero(result); setState("ready"); }
      } catch { if (active) setState("error"); }
    })();
    getCreationRules().then(value => { if (active) setRules(value); }).catch(() => { /* optional labels are noncritical */ });
    return () => { active = false; };
  }, [heroId]);
  if (state !== "ready" || !hero) return <section className="i655-folio-loading" aria-live="polite">
    <span className="i653-eyebrow">The character folio · Real account data</span>
    <h1>{state === "loading" ? "Opening the folio…" : state === "empty" ? "A blank page awaits." : "The folio could not be opened."}</h1>
    <p>{state === "loading" ? "Retrieving your Hero’s record." : state === "empty" ? "Create a Hero to begin your chronicle." : "Your character information has not been changed."}</p>
    <div className="i655-folio-actions"><button type="button" onClick={onBack}>← Return to the Hero Hall</button><Link to="/game/heroes">Open the original Hero Hall ↗</Link></div>
  </section>;
  const stats = Object.entries(hero.stats ?? {});
  const skills = Object.entries(hero.skills ?? {});
  const skillLabels = new Map((rules?.skills ?? []).map(item => [item.id, item.label]));
  const statLabels = new Map((rules?.stats ?? []).map(item => [item.id, item.label]));
  const talentLabels = new Map((rules?.talents ?? []).map(item => [item.id, item]));
  const xpPercent = Math.max(0, Math.min(100, finite(hero.xp_progress_percent)));
  return <article className="i655-hero-folio" aria-label={`Inkbound character folio for ${hero.name}`}>
    <div className="i655-folio-top"><button type="button" onClick={onBack}>← The Hero Hall</button><span>The character folio / live record</span><Link to={`/game/heroes/${encodeURIComponent(hero.character_id)}`}>Full Hero controls ↗</Link></div>
    <div className="i655-folio-intro"><p className="i655-kicker">✳ &nbsp; An account of a wandering soul &nbsp; ✳</p><h1>{hero.name}</h1><p className="i655-hero-byline">Level {hero.level} · {hero.hero_status === "active" ? "An unfinished story" : humanize(hero.hero_status)}</p></div>
    <div className="i655-folio-opening">
      <figure className="i655-folio-landscape"><img src={`${folioArt}/north-road-editorial.png`} alt="Two travelers overlooking a distant ruined city, independently illustrated in monochrome ink"/><figcaption>A road, a horizon, a story still being written.</figcaption></figure>
      <div className="i655-folio-identity"><span className="i655-ledger-label">From the Hero's own account</span><p className="i655-hero-bio">{hero.bio?.trim() || "Their story has yet to be recorded."}</p><div className="i655-status-ledger">
        <div><span>Health</span><b>{hero.health} / {hero.max_health}</b><progress max={Math.max(1, hero.max_health)} value={Math.max(0, hero.health)} aria-label="Health" /></div>
        <div><span>Experience</span><b>{hero.xp_into_level} / {hero.xp_level_span}</b><progress max={100} value={xpPercent} aria-label="Experience progress" /></div>
        <div><span>Next chapter of growth</span><b>{hero.xp_needed_for_next_level} XP needed</b></div>
      </div><p className="i655-ink-note">Every scar has a story.</p></div>
    </div>
    <div className="i655-folio-ledgers">
      <section className="i655-folio-attributes"><SectionName>Attributes</SectionName>{stats.length ? stats.map(([key,value]) => <div className="i655-attribute" key={key}><span>{statLabels.get(key) ?? humanize(key)}</span><InkDots value={value} max={rules?.advancement_stat_cap ?? Math.max(5, value)} /><b>{value}</b></div>) : <p className="i655-none">No attributes in this record.</p>}
      <SectionName>Learned skills</SectionName>{skills.length ? skills.map(([key,value]) => <div className="i655-skill" key={key}><span>{skillLabels.get(key) ?? humanize(key)}</span><b>{value}</b></div>) : <p className="i655-none">No skills yet.</p>}</section>
      <section className="i655-folio-talents"><SectionName>Traits & talents</SectionName>{hero.talents?.length ? hero.talents.map(id => {const talent=talentLabels.get(id);return <div className="i655-folio-trait" key={id}><b>{talent?.label ?? humanize(id)}</b>{talent?.description ? <small>{talent.description}</small> : null}</div>;}) : <p className="i655-none">No talents recorded.</p>}
        <SectionName>Active effects</SectionName><HeroEffectList effects={hero.effects} /></section>
      <section className="i655-folio-kit"><SectionName>Inventory</SectionName><div className="i655-kit-illustration" aria-hidden="true"><img src={`${folioArt}/lantern-books.png`} alt="" /></div>{hero.inventory?.length ? <ul className="i655-inventory">{hero.inventory.map((item,index)=><li key={`${item}-${index}`}><span>✦</span>{item}</li>)}</ul> : <p className="i655-none">Nothing in the satchel yet.</p>}
        <p className="i655-folio-annotation">Filed in the margins,<br/>never forgotten.</p></section>
    </div>
    <footer className="i655-folio-footer"><span>Unspent points: {hero.unspent_stat_points} attributes · {hero.unspent_skill_points} skills · {hero.unspent_talent_points} talents</span><Link to={`/game/heroes/${encodeURIComponent(hero.character_id)}`}>Spend points, edit biography & manage this Hero ↗</Link></footer>
  </article>;
}
