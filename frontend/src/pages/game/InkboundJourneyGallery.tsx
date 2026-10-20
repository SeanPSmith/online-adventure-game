/**
 * Pass 65.3 — Inkbound journey atlas.
 * Protected design workshop only. The dashboard and Hero index read REAL
 * account/game data; dice, results and intermission are explicitly illustrative
 * and may NEVER call backend roll/progression/Arcade endpoints.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { listCharacters, type Character } from "../../services/characters";
import { useGameSocket } from "../../state/GameSocketContext";

type FolioPage = "dashboard" | "heroes" | "dice" | "intermission" | "result" | "arcade";
type Step = "dice" | "intermission" | "result";
export type { FolioPage };

type AtlasProps = {
  page: FolioPage;
  onNavigate: (page: FolioPage | "chapter") => void;
  selectedChoice?: string;
};
const atlasArt = "/art/inkbound";
const challenges = [
  { title: "Lantern in the Fog", type: "Timing", description: "Follow the beat through an unfamiliar forest.", glyph: "⌛" },
  { title: "Old Tavern Dice", type: "Chance", description: "A quiet wager while the Director writes.", glyph: "⚄" },
  { title: "The Missing Word", type: "Wordplay", description: "Find the letter hidden in an old inscription.", glyph: "✎" },
  { title: "A Hand of Cards", type: "Cards", description: "One last hand before the road calls.", glyph: "♠" },
];

function FolioEyebrow({ children }: { children: ReactNode }) {
  return <span className="i653-eyebrow">{children}</span>;
}
function ScreenHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <header className="i653-screen-header"><FolioEyebrow>{eyebrow}</FolioEyebrow><h1>{title}</h1><p>{subtitle}</p><div className="i653-hand-rule" aria-hidden="true"><span/>✳<span/></div></header>;
}
function JourneySteps({ active, go }: { active: Step; go: AtlasProps["onNavigate"] }) {
  return <nav className="i653-sequence" aria-label="Turn sequence preview">
    {(["dice", "intermission", "result"] as Step[]).map((step, index) => <button key={step} type="button" aria-current={step === active ? "step" : undefined} onClick={() => go(step)}>
      <small>0{index+1}</small><span>{step === "dice" ? "The roll" : step === "intermission" ? "Between pages" : "The outcome"}</span>
    </button>)}
  </nav>;
}

function InkDieSketch({ face = "?" }: { face?: string }) {
  return <svg className="i654-ink-die" viewBox="0 0 420 420" role="img" aria-label={face === "?" ? "Hand-sketched twenty-sided die awaiting its result" : `Hand-sketched twenty-sided die showing ${face}`}>
    <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
      <path d="M211 30 L347 104 L371 253 L275 364 L129 364 L45 252 L72 109 Z" strokeWidth="3.1" />
      <path d="M208 33 L158 154 L275 157 L347 104 M72 109 L158 154 L45 252 L154 281 L129 364 M275 157 L371 253 L259 286 L275 364 M158 154 L154 281 L259 286 L275 157 M154 281 L211 361 L259 286 M45 252 L114 218 L72 109 M347 104 L326 225 L371 253" strokeWidth="2.3" />
      <path d="M211 30 L217 42 L340 107 M49 253 L132 357 M277 359 L365 255" strokeWidth=".85" opacity=".5" />
      <path d="M157 161 l-25 75 M164 160 l-23 67 M170 160 l-25 64 M291 167 l27 50 M300 164 l22 48 M302 273 l42 -32 M145 293 l-14 42" strokeWidth="1" opacity=".32" />
      <path d="M14 115 l21 -10 M10 123 l17 -8 M367 67 l24 -10 M371 74 l17 -7 M31 298 l-17 18 M380 309 l16 12 M193 13 l1 -10 M209 12 l1 -8 M228 13 l3 -10" strokeWidth="1.4" />
    </g>
    <g fill="currentColor" opacity=".78"><circle cx="26" cy="146" r="2"/><circle cx="386" cy="161" r="3"/><circle cx="394" cy="181" r="1.7"/><circle cx="57" cy="340" r="1.3"/><circle cx="304" cy="394" r="1.6"/></g>
    <text x="215" y="251" textAnchor="middle" className="i654-die-face">{face}</text>
  </svg>;
}

function Dashboard({ go }: { go: AtlasProps["onNavigate"] }) {
  const { adventures, catalog, connected, directoryReady } = useGameSocket();
  const active = adventures.filter((x) => !x.completed);
  const recent = active.slice(0, 3);
  return <section className="i653-screen i653-dashboard" aria-label="Authenticated dashboard design">
    <div className="i653-note-top"><FolioEyebrow>The personal chronicle · Vol. I</FolioEyebrow><span className="i653-handwriting">A little farther, every day.</span></div>
    <div className="i653-dashboard-lead"><div className="i654-dashboard-letter"><h1>Where shall we <em>begin?</em></h1><p>Old stories to continue. New places to get lost. A hero worth remembering.</p><div className="i653-button-line"><Link className="i653-main-link" to="/game">Enter the adventure hall →</Link><button type="button" onClick={() => go("heroes")}>Your heroes ↗</button></div></div><img src={`${atlasArt}/north-road-editorial.png`} alt="Two travelers overlooking a valley painted in charcoal ink" /><div className="i654-plate-note" aria-hidden="true"><span>Fig. 01</span> The road beyond the vale <svg viewBox="0 0 90 35"><path d="M2 5 Q25 3 39 16 T84 18 l-9 -7 M84 18 l-12 7" stroke="currentColor" fill="none" strokeWidth="1.4" strokeLinecap="round" /></svg></div></div>
    <div className="i653-dashboard-table">
      <div className="i653-dashboard-chapters"><div className="i653-section-head"><FolioEyebrow>Open chapters</FolioEyebrow><Link to="/game/adventures">All journeys ↗</Link></div>
        {recent.length ? recent.map((adv,i) => <Link className="i653-chapter-link" key={adv.room_code} to={`/game/adventure/${encodeURIComponent(adv.room_code)}?hero=${encodeURIComponent(adv.character_id)}`}><b>0{i+1}</b><span><strong>{adv.adventure_title}</strong><small>{adv.character_name} · Turn {adv.turn_number} · {adv.play_mode === "coop" ? "Two travelers" : "Solo"}</small></span><span aria-hidden="true">↗</span></Link>) : <p className="i653-empty">{directoryReady ? "Your chronicle awaits its first chapter." : "Reading your adventures…"}</p>}
      </div>
      <aside className="i653-dashboard-margin"><FolioEyebrow>From the desk</FolioEyebrow><p className="i653-margin-count">{directoryReady ? String(active.length).padStart(2,"0") : "—"}</p><p>Journeys in progress</p><p className="i653-margin-count">{directoryReady ? String(catalog.length).padStart(2,"0") : "—"}</p><p>Adventures to discover</p><small>{connected ? "● The adventure server is connected" : "○ Reconnecting to the adventure server"}</small><span className="i653-handwriting">Every tale begins somewhere.</span></aside>
    </div>
    <div className="i653-foot-links"><Link to="/game/heroes">Hero hall ↗</Link><Link to="/game/history">Completed tales ↗</Link><Link to="/game/arcade">The Arcade ↗</Link><Link to="/author">Worldmaking ↗</Link></div>
  </section>;
}

function Heroes() {
  const [heroes,setHeroes]=useState<Character[]>([]);
  const [state,setState]=useState<"loading"|"loaded"|"error">("loading");
  useEffect(() => { let live=true;listCharacters().then(data=>{if(live){setHeroes(data.characters);setState("loaded");}}).catch(()=>{if(live)setState("error");});return()=>{live=false;};},[]);
  const active=heroes.filter(h=>h.is_alive && h.hero_status==="active");
  return <section className="i653-screen i653-hero-hall" aria-label="Real Hero roster in Inkbound style">
    <ScreenHeader eyebrow="The hero hall · Account data" title="The people we become" subtitle="Your characters, preserved in ink and consequence." />
    <div className="i653-hero-intro"><p className="i653-intro"><span className="i653-dropcap" aria-hidden="true">E</span><span className="sr-only">E</span>very wanderer has a history. Some wear it proudly. Others leave it scattered beside the road.</p><span className="i653-handwriting">Drawn from your actual Hero Hall ↓</span></div>
    {state==="error" ? <p role="status" className="i653-empty">Could not retrieve your Heroes. <Link to="/game/heroes">Open the Hero Hall ↗</Link></p> : state==="loading" ? <p role="status" className="i653-empty">Turning the pages of your Hero Hall…</p> : active.length ? <div className="i653-roster">{active.map((hero,i)=><article key={hero.character_id} className="i653-roster-entry"><span className="i653-roster-index">{String(i+1).padStart(2,"0")} /</span><div className="i653-roster-emblem" aria-hidden="true">✥</div><div className="i653-roster-bio"><h2>{hero.name}</h2><p>Level {hero.level} · {hero.bio || "Another story waiting to be told."}</p><div className="i653-meter-line"><span>HP {hero.health}/{hero.max_health}</span><span>XP {hero.experience}</span></div></div><Link to={`/game/heroes/${encodeURIComponent(hero.character_id)}`} aria-label={`Open ${hero.name}'s character sheet`}>View folio ↗</Link></article>)}</div> : <div className="i653-empty"><p>No living heroes yet. The first page is yours to write.</p><Link to="/game/heroes/new">Create a hero ↗</Link></div>}
    <div className="i653-foot-links"><Link to="/game/heroes/new">Create a new hero ↗</Link><Link to="/game/graveyard">Visit the graveyard ↗</Link><Link to="/game/heroes">Full Hero Hall ↗</Link></div>
  </section>;
}

function Dice({go,selectedChoice}:{go:AtlasProps["onNavigate"];selectedChoice?:string}) {
  return <section className="i653-screen i653-fate" aria-label="Dice resolution visual design preview"><ScreenHeader eyebrow="The passage of fate · Visual preview" title="The dice are cast" subtitle="An editorial treatment for the game's existing authoritative dice results."/><JourneySteps active="dice" go={go}/>
    <div className="i653-dice-stage"><div className="i653-die-paper"><InkDieSketch /><small>THE FATES AWAIT</small></div><div className="i653-dice-caption"><FolioEyebrow>Recorded intention</FolioEyebrow><blockquote>{selectedChoice || "Follow the lantern light"}</blockquote><p>The server—not this preview—will determine the roll, modifiers and consequences. This page demonstrates the arrangement and timing only.</p><p className="i653-handwriting">Chance leaves its mark.</p><button type="button" className="i653-main-link" onClick={()=>go("intermission")}>View the next stage →</button></div></div>
    <p className="i653-demo-watermark">DESIGN PREVIEW · NO DIE HAS BEEN ROLLED</p>
  </section>;
}
function Intermission({go}:{go:AtlasProps["onNavigate"]}) {return <section className="i653-screen i653-intermission" aria-label="Intermission visual preview"><ScreenHeader eyebrow="An interlude · Visual preview" title="While the ink dries" subtitle="The Director prepares the next chapter. Take a moment between pages."/><JourneySteps active="intermission" go={go}/>
  <div className="i653-interlude-body"><img src={`${atlasArt}/lantern-books.png`} alt="An ink sketch of a lantern resting beside a stack of travel books"/><div><FolioEyebrow>Between chapters</FolioEyebrow><h2>A little diversion?</h2><p>Intermission can hold a small game while the next passage is written. The page stays quiet; the story never leaks before it is ready.</p><div className="i653-word-game"><span>THE MISSING WORD</span><strong>F _ T E</strong><small>Fate waits in the missing letters.</small></div><div className="i653-button-line"><button className="i653-main-link" type="button" onClick={()=>go("arcade")}>Explore Arcade design ↗</button><button type="button" onClick={()=>go("result")}>View result page →</button></div></div></div><p className="i653-demo-watermark">VISUAL PREVIEW · ACTUAL ARCADE GAMES REMAIN IN THE LIVE GAME</p>
</section>}
function Result({go}:{go:AtlasProps["onNavigate"]}) {return <section className="i653-screen i653-result" aria-label="Resolution visual preview"><ScreenHeader eyebrow="The book of consequences · Visual preview" title="What became of it" subtitle="The roll is over. The record is written. The adventure continues."/><JourneySteps active="result" go={go}/>
  <div className="i653-outcome"><div className="i653-outcome-mark"><InkDieSketch face="14" /><small>SUCCESS · SAMPLE</small></div><div><FolioEyebrow>Illustrative result · Not your live game</FolioEyebrow><h2>The lantern was no ordinary light.</h2><p>Through the bracken, a flicker answers your footsteps. Something knows you have come.</p><div className="i653-outcome-ledger"><div><span>The throw</span><strong>14 <small>/ d20</small></strong></div><div><span>Fortune</span><strong>+ 2</strong></div><div><span>Experience</span><strong>+ 15 XP</strong></div></div><p className="i653-handwriting">A good roll changes everything…</p><button type="button" className="i653-main-link" onClick={()=>go("chapter")}>Return to the story →</button></div></div><p className="i653-demo-watermark">ILLUSTRATIVE VALUES ONLY · THE SERVER OWNS ACTUAL HP, XP AND OUTCOMES</p>
</section>}
function Arcade({go}:{go:AtlasProps["onNavigate"]}) {return <section className="i653-screen i653-arcade" aria-label="Arcade visual exploration"><ScreenHeader eyebrow="The intermission collection · Design preview" title="Games in the margins" subtitle="A game between the pages, never in the way of the story."/>
  <div className="i653-arcade-intro"><img src={`${atlasArt}/camp-cups.png`} alt="Ink illustration of small cups resting by a campfire"/><p>Our Arcade already has real mechanics. We're planning a lighter, hand-printed presentation for those games—not replacing their working logic with static illustrations.</p></div>
  <div className="i653-arcade-index" aria-label="An illustrated index of intermission games">{challenges.map((item,index)=><article key={item.title}><span className="i653-arcade-num">{String(index+1).padStart(2,"0")}</span><span className="i653-arcade-glyph" aria-hidden="true">{item.glyph}</span><div><small>{item.type}</small><h2>{item.title}</h2><p>{item.description}</p></div></article>)}</div><div className="i653-foot-links"><Link to="/game/arcade">Open actual Arcade ↗</Link><button type="button" onClick={()=>go("intermission")}>Back to intermission ↗</button></div><p className="i653-demo-watermark">DESIGN PREVIEW · THE FOUR ENTRIES ABOVE ARE VISUAL CONCEPTS</p>
</section>}
export function InkboundJourneyGallery({page,onNavigate,selectedChoice}:AtlasProps) {
  if(page==="dashboard")return <Dashboard go={onNavigate}/>;
  if(page==="heroes")return <Heroes/>;
  if(page==="dice")return <Dice go={onNavigate} selectedChoice={selectedChoice}/>;
  if(page==="intermission")return <Intermission go={onNavigate}/>;
  if(page==="result")return <Result go={onNavigate}/>;
  return <Arcade go={onNavigate}/>;
}
