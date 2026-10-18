import { useCallback, useEffect, useRef, useState } from "react";
import "./inkLabBook.css";

// PASS 64.4E — A deliberately isolated visual/motion experiment.
// No gameplay, API calls, generated stories, route changes, or mutations.
// Ink masks are precomputed transparent WebP textures, not an opacity-only fade.
const FRAMES = 33;
const MASK_ROOT = "/art/pass64/ink-masks";
const maskUrl = (index: number) => `url("${MASK_ROOT}/ink-${String(Math.min(FRAMES - 1, Math.max(0, index))).padStart(2, "0")}.webp")`;

const EXAMPLES = {
  Home: {
    label: "A NOTE FROM THE LIBRARY", title: "Every story begins with a mark.",
    prose: "An empty page is an invitation. Watch the letters gather like pigment in paper, until a new world has taken shape.",
    quote: "The worlds have been behaving suspiciously well without you.",
    art: "/art/pass64/p644-ink-lab-watercolor.webp",
    alt: "Watercolor illustration of a traveler and their dog overlooking a harbor and distant castle.",
    caption: "I. THE FIRST JOURNEY", style: "landscape",
  },
  Heroes: {
    label: "NAMES WORTH REMEMBERING", title: "Every hero leaves a trace.",
    prose: "A life written in courage, chaos, and the occasional spectacularly poor decision. No two names stain the page in quite the same way.",
    quote: "A hero is a story that refuses to stay unwritten.",
    art: "/art/pass64/p644-ink-lab-portrait.webp",
    alt: "Illustrative watercolor-style Hero portrait placeholder on parchment.",
    caption: "II. IN THE HERO HALL", style: "portrait",
  },
  Wardrobe: {
    label: "THE WARDROBE", title: "Same soul. Different worlds.",
    prose: "Let the parchment drink a different shade. The coat may change, the compass may turn, but the tale is still yours.",
    quote: "The finest disguises are made of possibilities.",
    art: "/art/pass64/p644-ink-lab-watercolor.webp",
    alt: "Soft watercolor view of a sunlit fantasy valley and an adventurous traveler.",
    caption: "III. A NEW APPEARANCE", style: "landscape",
  },
  "My Adventures": {
    label: "THE CHRONICLE", title: "The road remembers.",
    prose: "Chapters fade into memory, but nothing is truly lost. Come back, turn the page, and pick up where your last impossible idea began.",
    quote: "And then, naturally, everything got stranger.",
    art: "/art/pass64/p644-ink-lab-watercolor.webp",
    alt: "Illustrated mountain kingdom and waterways in a fantasy travel journal.",
    caption: "IV. THE LONG ROAD", style: "landscape",
  },
  Discover: {
    label: "THE ATLAS OF POSSIBILITIES", title: "A world for every whim.",
    prose: "Beyond the edge of this page: impossible mountains, forgotten cities, and a thousand stories waiting to be carried into the light.",
    quote: "Strange places. Braver choices. Better company.",
    art: "/art/pass64/p644-ink-lab-watercolor.webp",
    alt: "Hand-painted fantasy coastline beneath towering mountains and a castle.",
    caption: "V. BEYOND THE MAP", style: "landscape",
  },
  System: {
    label: "THE BOOKBINDER'S NOTES", title: "Made of paper. Made of magic.",
    prose: "This is a living page, not a collection of floating panels. Touch a chapter above, and watch the last one surrender its ink.",
    quote: "The book stays. The ink changes.",
    art: "/art/pass64/p644-ink-lab-watercolor.webp",
    alt: "Painterly landscape, made to resemble watercolor absorbed into ivory paper.",
    caption: "VI. THE INK LABORATORY", style: "landscape",
  },
} as const;

type Tab = keyof typeof EXAMPLES;

function setMask(element: HTMLElement | null, frame: number) {
  if (!element) return;
  const value = maskUrl(frame);
  element.style.webkitMaskImage = value;
  element.style.maskImage = value;
}

export function InkLabBook({ activeTab }: { activeTab: Tab }) {
  const [displayed, setDisplayed] = useState<Tab>(activeTab);
  const textRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLElement>(null);
  const rightRef = useRef<HTMLElement>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const progressRef = useRef(0);
  const displayedRef = useRef<Tab>(activeTab);
  const wantedRef = useRef<Tab>(activeTab);
  const reducedRef = useRef(false);
  const [replayKey, setReplayKey] = useState(0);
  const [speed, setSpeed] = useState<"poetic" | "quick">("poetic");

  const paint = useCallback((value: number) => {
    progressRef.current = Math.min(1, Math.max(0, value));
    const textFrame = Math.round(progressRef.current * (FRAMES - 1));
    const artFrame = Math.round(Math.max(0, (progressRef.current - 0.10) / 0.88) * (FRAMES - 1));
    setMask(textRef.current, textFrame);
    setMask(rightRef.current, textFrame);
    setMask(artRef.current, artFrame);
    // A slightly broader, blurred pigment halo precedes the actual watercolor.
    setMask(bloomRef.current, Math.min(FRAMES - 1, artFrame + 2));
  }, []);

  useEffect(() => {
    // Ensure everything is in the image cache before anyone switches pages.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < FRAMES; i += 1) {
      const image = new Image();
      image.src = `${MASK_ROOT}/ink-${String(i).padStart(2, "0")}.webp`;
      images.push(image);
    }
    return () => { images.length = 0; };
  }, []);

  useEffect(() => {
    wantedRef.current = activeTab;
    reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (reducedRef.current) {
      displayedRef.current = activeTab;
      setDisplayed(activeTab);
      paint(1);
      return;
    }

    let dead = false;
    const duration = speed === "quick" ? 480 : 940;
    const start = (from: number, to: number, ms: number, complete: () => void) => {
      const started = performance.now();
      let lastFrame = -1;
      const tick = (now: number) => {
        if (dead) return;
        const t = Math.min(1, (now - started) / ms);
        const eased = t * t * (3 - 2 * t);
        const p = from + (to - from) * eased;
        const frame = Math.round(p * (FRAMES - 1));
        if (frame !== lastFrame || t === 1) { paint(p); lastFrame = frame; }
        if (t < 1) frameRef.current = requestAnimationFrame(tick);
        else complete();
      };
      frameRef.current = requestAnimationFrame(tick);
    };
    const reveal = () => start(0, 1, duration, () => { frameRef.current = null; paint(1); });
    if (displayedRef.current === activeTab) {
      // The initial visit or Replay: start on ivory, soak in over time.
      const from = replayKey ? 0 : progressRef.current;
      if (replayKey) paint(0);
      start(from, 1, duration, () => { frameRef.current = null; paint(1); });
    } else {
      // Exit -> change content *only once blank* -> reveal. No double-printed ghost.
      start(progressRef.current, 0, duration * .66, () => {
        if (dead) return;
        paint(0);
        displayedRef.current = wantedRef.current;
        setDisplayed(displayedRef.current);
        frameRef.current = requestAnimationFrame(() => { if (!dead) reveal(); });
      });
    }
    return () => { dead = true; if (frameRef.current !== null) cancelAnimationFrame(frameRef.current); };
  }, [activeTab, replayKey, speed, paint]);

  const ex = EXAMPLES[displayed];
  return (
    <div className="ink-lab-spread" aria-label="Ink absorption experiment">
      <section className="ink-lab-leaf ink-lab-leaf--left" aria-label="Live ink typography">
        <div className="ink-lab-type" ref={textRef}>
          <p className="ink-lab-kicker"><span aria-hidden="true">✧</span> {ex.label}</p>
          <h1>{ex.title}</h1>
          <span className="ink-lab-rule" aria-hidden="true"><span>✧</span></span>
          <p className="ink-lab-prose">{ex.prose}</p>
          <blockquote className="ink-lab-quote">“{ex.quote}”</blockquote>
          <p className="ink-lab-chapter">A TALES OF TWO INK STUDY <span aria-hidden="true">✦</span> 64.4E</p>
        </div>
      </section>
      <section className="ink-lab-leaf ink-lab-leaf--right" ref={rightRef} aria-label="Watercolor absorption experiment">
        <p className="ink-lab-overline">THE LIVING MANUSCRIPT <span aria-hidden="true">✧</span></p>
        <div className={`ink-lab-illustration ink-lab-illustration--${ex.style}`}>
          <div className="ink-lab-pigment" ref={bloomRef} aria-hidden="true"><img src={ex.art} alt="" draggable={false}/></div>
          <figure className="ink-lab-image" ref={artRef}>
            <img src={ex.art} alt={ex.alt} draggable={false} />
            <figcaption>{ex.caption}</figcaption>
          </figure>
        </div>
        <div className="ink-lab-controls" aria-label="Ink laboratory controls">
          <button type="button" className="ink-lab-replay" onClick={() => setReplayKey((k) => k + 1)} aria-label="Replay the ink reveal">
            <span aria-hidden="true">↺</span> Replay the ink
          </button>
          <button type="button" className="ink-lab-speed" aria-label={`Animation speed: ${speed}. Change speed`} onClick={() => setSpeed((s) => s === "poetic" ? "quick" : "poetic")}>
            {speed === "poetic" ? "Slow · atmospheric" : "Quick · practical"} <span aria-hidden="true">◇</span>
          </button>
        </div>
      </section>
    </div>
  );
}
