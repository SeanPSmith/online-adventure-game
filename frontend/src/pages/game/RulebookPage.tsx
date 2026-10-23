import { Link } from "react-router";
import { useInkboundPaper } from "../../features/appearance/inkboundPaper";
import { useAuth } from "../../state/AuthContext";
import "./quillairoRulebookPass6614.css";
import { Panel } from "../../components/ui/Panel";

const attributes = [
  ["STRENGTH", "Force, lifting, breaking, grappling, and physical drive."],
  ["AGILITY", "Speed, balance, reflexes, coordination, and precise movement."],
  ["INTELLECT", "Reasoning, memory, technical understanding, and learned expertise."],
  ["PERCEPTION", "Attention, instinct, sensory detail, and reading the environment."],
  ["PRESENCE", "Charm, social pressure, confidence, and performance."],
  ["WILLPOWER", "Nerve, focus, emotional control, and resistance to fear or coercion."],
  ["LUCK", "Timing, chance, coincidence, and improbable breaks when fortune truly matters."],
];

export function RulebookPage() {
  const { user } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  return (
    <article className="rulebook-page q-rulebook" data-ink-paper={paper}>
      <header className="q-rulebook-hero">
        <div className="q-rulebook-intro"><p className="q-rulebook-overline">THE QUILLAIRO COMPANION · PLAYER REFERENCE</p>
          <h1>The rules of <em>the road.</em></h1>
          <p>Stories are living things. Your decisions matter; the dice settle what happens when the outcome is uncertain.</p>
          <Link to="/game" className="q-rulebook-return">← Return to the adventure hall</Link>
        </div>
        <img src="/art/inkbound/lantern-books.png" alt="A lantern and old books drawn in ink" />
      </header>
      <nav className="q-rulebook-toc" aria-label="Rulebook contents"><span>IN THIS VOLUME</span>
        <a href="#q-rules-play">How to play</a><a href="#q-rules-hero">Your Hero</a>
        <a href="#q-rules-progression">Progression</a></nav>

      <div className="rulebook-grid">
        <div id="q-rules-play" className="q-rulebook-section-title">I. How to play</div>
        <Panel title="THE CORE LOOP">
          <p>
            Choose what your Hero attempts. The server decides whether the action needs a
            check, rolls the die, applies your Hero&apos;s permanent abilities and temporary
            conditions, and then gives those authoritative facts to the Story Director.
          </p>
          <p>
            The Director may describe what happens. It cannot secretly change your roll,
            HP, XP, skills, attributes, Talents, or other mechanical state.
          </p>
        </Panel>

        <div id="q-rules-hero" className="q-rulebook-section-title">II. Your Hero</div>
        <Panel title="HERO BIO // CANON">
          <p>
            Your Bio is player-authored canon. Use it for background, temperament, fears,
            habits, relationships, old jobs, or anything else you want the Director to
            remember about who this person is.
          </p>
          <p>
            A short, specific Bio is usually stronger than a novel. The Director can use
            it for callbacks and characterization but should not contradict it.
          </p>
        </Panel>

        <Panel title="CORE ATTRIBUTES" className="hero-sheet-wide">
          <div className="rulebook-definition-grid">
            {attributes.map(([name, description]) => (
              <div key={name}>
                <strong>{name}</strong>
                <span>{description}</span>
              </div>
            ))}
          </div>
          <p className="muted-copy">
            New Heroes can reach 3 in an Attribute. Advancement can eventually raise an
            Attribute to 7.
          </p>
        </Panel>

        <Panel title="SKILLS" className="hero-sheet-wide">
          <p>
            Skills describe trained approaches inside the broader Attributes: Athletics,
            Brawl, Acrobatics, Stealth, Sleight, Investigation, Knowledge, Technology,
            Medicine, Mechanics, Awareness, Survival, Navigation, Insight, Persuasion,
            Deception, Intimidation, Performance, Discipline, and Composure.
          </p>
          <p>
            A skill check adds the linked Attribute and Skill to the d20. A pure Attribute
            check uses the Attribute alone. Temporary effects and permanent Talents may add
            small server-owned modifiers.
          </p>
        </Panel>

        <div id="q-rules-progression" className="q-rulebook-section-title">III. Growth & consequence</div>
        <Panel title="LEVELS // ADVANCEMENT">
          <div className="progression-rules-grid">
            <div><strong>EVERY LEVEL</strong><span>+2 SKILL POINTS</span></div>
            <div><strong>EVEN LEVELS</strong><span>+1 ATTRIBUTE POINT</span></div>
            <div><strong>LEVEL 3, 5, 7...</strong><span>+1 TALENT POINT</span></div>
          </div>
          <p>
            XP still measures experience, but a level is now a permanent build decision.
            Skill Points specialize what you do, Attribute Points strengthen the underlying
            Hero, and Talent Points buy permanent edges.
          </p>
        </Panel>

        <Panel title="TALENTS">
          <p>
            Talents are permanent Hero abilities such as Sleuth, Gearhead, Field Medic,
            Silver Tongue, Hard Case, or Lucky Break. Each Talent has an explicit mechanical
            benefit that the server applies to matching checks.
          </p>
          <p>
            Talents are not temporary story effects. Once learned, they remain part of that
            Hero&apos;s build across adventures.
          </p>
        </Panel>

        <Panel title="CHALLENGE SCALING" className="hero-sheet-wide">
          <p>
            Checks scale with the party without turning ordinary objects into level-scaled
            nonsense. A routine obstacle can become automatic for an experienced Hero; the
            Director is expected to present more consequential problems as Heroes grow.
          </p>
          <p>
            The Director proposes a relative tier — Easy, Standard, Hard, Severe, or Legendary.
            The server then computes the final DC from that tier, the party&apos;s effective level,
            and the authored adventure difficulty. The server owns the final number and the roll.
          </p>
        </Panel>

        <Panel title="XP // SUCCESS AND FAILURE" className="hero-sheet-wide">
          <p>
            Risk drives XP. Success earns the full reward, critical success earns more, and
            failure earns reduced XP based on how close the authoritative total came to the
            difficulty. Trying something dangerous can still teach a Hero; failing is simply
            not worth the same as succeeding.
          </p>
        </Panel>
      </div>
    </article>
  );
}
