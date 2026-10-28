import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../../state/AuthContext";

const ART = "/art/quillairo-public/";
const examples = [
  { key: "fantasy", title: "Roads of Emberfall", genre: "FANTASY", description: "Forgotten kingdoms, improbable companions, and the road nobody dared take.", cover: `${ART}home-vista-cover.webp` },
  { key: "scifi", title: "The Ashen Belt", genre: "SCIENCE FICTION", description: "Silent stations, unfamiliar stars, and secrets waiting beyond the airlock.", cover: "/art/pass64/scifi.webp" },
  { key: "mystery", title: "The Hollow Manor", genre: "MYSTERY & HORROR", description: "A house full of questions. Some answers should have stayed buried.", cover: "/art/pass64/gothic.webp" },
];
const choices = [
  { title: "Follow the lantern light", detail: "You step from the road. The flame holds steady, as if someone expected you." },
  { title: "Wake your companion", detail: "Your companion sits up before you speak. ‘I heard it too,’ they whisper." },
  { title: "Cut through the trees", detail: "The branches part around a trail that does not appear on your map." },
];

export function PublicHomePage() {
  const { authenticated } = useAuth();
  const [sampleChoice, setSampleChoice] = useState<number | null>(null);
  const startHref = authenticated ? "/game" : "/register";

  return (
    <div className="qpub-home" id="about">
      <section className="qpub-hero" aria-labelledby="qpub-headline">
        <div className="qpub-hero-copy">
          <span className="qpub-overline">AI-POWERED ADVENTURES · SOLO OR CO-OP</span>
          <h1 id="qpub-headline">Living adventures,<br /><em>written as you play.</em></h1>
          <p>Quillairo is a literary adventure game where your choices shape the story, the dice decide the risk, and the world remembers what you do. Play alone or share the journey with someone else.</p>
          <div className="qpub-cta-pair">
            <Link className="qpub-button qpub-button-primary" to={startHref}>{authenticated ? "Continue your adventure" : "Begin your adventure"}<span aria-hidden="true">↗</span></Link>
            <a className="qpub-button qpub-button-secondary" href="#story-preview">See a sample story <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <img className="qpub-hero-illustration" src={`${ART}home-vista.png`} alt="Two travelers looking toward a castle, a strange planet and distant city rendered in hand-painted ink" fetchPriority="high" />
      </section>

      <section className="qpub-pillar-row" aria-label="What makes Quillairo different">
        <div><span className="qpub-pillar-glyph" aria-hidden="true">✧</span><div><strong>YOUR STORY, YOUR WAY</strong><small>Solo or cooperative adventures</small></div></div>
        <div><span className="qpub-pillar-glyph" aria-hidden="true">✒</span><div><strong>THE STORY DIRECTOR</strong><small>Chapters shaped by your actions</small></div></div>
        <div><span className="qpub-pillar-glyph" aria-hidden="true">◇</span><div><strong>HEROES THAT GROW</strong><small>Identity, abilities and lasting consequences</small></div></div>
        <div><span className="qpub-pillar-glyph" aria-hidden="true">✺</span><div><strong>WORLD AFTER WORLD</strong><small>Fantasy, science fiction and mystery</small></div></div>
      </section>

      <section className="qpub-worlds" id="worlds" aria-labelledby="qpub-worlds-title">
        <div className="qpub-section-title"><span className="qpub-rule" /><div><span className="qpub-overline">THE WORLDS ARE WAITING</span><h2 id="qpub-worlds-title">Where will your story begin?</h2></div><span className="qpub-rule" /></div>
        <p className="qpub-caption">A glimpse of the genres and journeys you can imagine in Quillairo. Browse the live adventure catalog after entering the game.</p>
        <div className="qpub-worlds-grid">
          {examples.map((world) => <article className="qpub-world-card" key={world.key}>
            <div className="qpub-world-frame"><img src={world.cover} alt={`${world.genre} setting illustration`} loading="lazy" /></div>
            <div className="qpub-world-heading"><span>{world.genre}</span><h3>{world.title}</h3></div>
            <p>{world.description}</p>
          </article>)}
        </div>
        <Link to="/game" className="qpub-text-link">Browse playable adventures <span aria-hidden="true">↗</span></Link>
      </section>

      <section className="qpub-how" id="how-it-works" aria-labelledby="qpub-how-title">
        <div className="qpub-section-title"><span className="qpub-rule" /><div><span className="qpub-overline">FIVE STEPS INTO THE UNKNOWN</span><h2 id="qpub-how-title">How the story unfolds</h2></div><span className="qpub-rule" /></div>
        <div className="qpub-how-grid">
          {[
            ["01", "Choose a world", "Enter a setting worth getting lost in."],
            ["02", "Create your Hero", "Your identity and abilities matter."],
            ["03", "Make choices", "Decide what happens next."],
            ["04", "Roll the dice", "Risk and consequences are real."],
            ["05", "Live the story", "The next chapter remembers."],
          ].map(([number, heading, copy]) => <div key={number}><span>{number}</span><strong>{heading}</strong><p>{copy}</p></div>)}
        </div>
      </section>

      <section className="qpub-story-preview" id="story-preview" aria-labelledby="qpub-preview-title">
        <img className="qpub-preview-art" src={`${ART}living-worlds.png`} alt="An ink-illustrated book opening into multiple imagined worlds" loading="lazy" />
        <div className="qpub-preview-prose">
          <span className="qpub-overline">AN INTERACTIVE SAMPLE · NOT A LIVE GAME</span>
          <h2 id="qpub-preview-title">The Road North</h2>
          <p className="qpub-drop">The road was a ribbon of mud and memory, leading toward a forgotten crown. Beside you, your companion had fallen silent. Ahead, a lantern appeared between the trees.</p>
          <p className="qpub-sample-outcome" aria-live="polite">{sampleChoice === null ? "One road. Three choices. None without consequences." : choices[sampleChoice].detail}</p>
        </div>
        <div className="qpub-choice-demo" aria-label="Try a sample choice">
          <span className="qpub-overline">WHAT DO YOU DO?</span>
          {choices.map((choice, index) => <button key={choice.title} className={sampleChoice === index ? "is-chosen" : ""} type="button" aria-pressed={sampleChoice === index} onClick={() => setSampleChoice(index)}>{choice.title}<span aria-hidden="true">↗</span></button>)}
          <small>This is an illustrative choice preview. Real adventures use your Hero, dice and Story Director.</small>
        </div>
      </section>

      <section className="qpub-last-word">
        <div><span className="qpub-overline">SOME STORIES ARE BETTER SHARED</span><h2>Your next story is waiting to be written.</h2></div>
        <Link className="qpub-button qpub-button-primary" to={startHref}>{authenticated ? "Return to the adventure hall" : "Begin your first adventure"}<span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
