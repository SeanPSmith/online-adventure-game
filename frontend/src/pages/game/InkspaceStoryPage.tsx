import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { SCENE_COMPOSITING, sceneRectStyle } from "../../features/cosmetics/environmentCatalog";
import { INKSPACE_MODES, INKSPACE_STORIES, type InkspaceMode, type InkspacePageArt, type InkspacePageContent } from "./inkspaceStorySamples";
import "./inkspaceStory.css";

// Derive the page side from existing scene geometry: older catalogs do not export PageSide.
type PageSide = keyof typeof SCENE_COMPOSITING.contentSafeZones;

// Pass 64.4I — story SURFACE experiment only. Scene and header are owned by the
// unchanged playground shell; masks apply exclusively to the two ink layers.
const MASK_FRAMES = 33;
const maskURL = (step: number) => `url("/art/pass64/ink-masks/ink-${String(Math.min(32, Math.max(0, step))).padStart(2, "0")}.webp")`;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const eased = (v: number) => { const t = clamp01(v); return t * t * (3 - 2 * t); };
const tabMode = (tab: string): InkspaceMode => tab === "Discover" || tab === "My Adventures" ? "art-forward" : tab === "Heroes" || tab === "Wardrobe" ? "illuminated" : "narrative";
const sceneStyle = (side: PageSide): CSSProperties => {
  const pos = sceneRectStyle(SCENE_COMPOSITING.contentSafeZones[side]);
  return { "--leaf-x": pos.left, "--leaf-y": pos.top, "--leaf-width": pos.width, "--leaf-height": pos.height } as CSSProperties;
};

function InkspaceArt({ art, secondary = false }: { art: InkspacePageArt; secondary?: boolean }) {
  return (
    <figure className={`inkspace-figure ${secondary ? "inkspace-figure--small" : ""}`}>
      <img src={art.src} alt={art.alt} loading="eager" decoding="async" draggable={false} />
      {art.caption ? <figcaption>{art.caption}</figcaption> : null}
    </figure>
  );
}

function DropCapParagraph({ value, illuminated }: { value: string; illuminated: boolean }) {
  const initial = value.slice(0, 1);
  return <p className={`inkspace-opening ${illuminated ? "inkspace-opening--illuminated" : ""}`}>
    <span className="inkspace-dropcap" aria-hidden="true">{initial}</span><span className="sr-only">{initial}</span>{value.slice(1)}
  </p>;
}

function ManuscriptPage({ page, mode, side }: { page: InkspacePageContent; mode: InkspaceMode; side: PageSide }) {
  const illuminated = mode === "illuminated";
  return <div className={`inkspace-manuscript inkspace-manuscript--${mode} inkspace-manuscript--${side}`}>
    {page.ornaments?.includes("botanical") ? <span className="inkspace-flora" aria-hidden="true">❧</span> : null}
    {page.eyebrow ? <p className="inkspace-eyebrow">{page.eyebrow}</p> : null}
    {page.title ? <h1 className="inkspace-title">{page.title}</h1> : null}
    {page.subtitle ? <p className="inkspace-subtitle">{page.subtitle}</p> : null}
    {page.title || page.subtitle ? <div className="inkspace-rule" aria-hidden="true"><span>✦</span></div> : null}
    {page.artPrimary?.placement === "opening" ? <InkspaceArt art={page.artPrimary} /> : null}
    {page.openingParagraph ? <DropCapParagraph value={page.openingParagraph} illuminated={illuminated} /> : null}
    {page.artPrimary?.placement !== "opening" && page.artPrimary ? <InkspaceArt art={page.artPrimary} /> : null}
    {page.bodyParagraphs?.map((text, index) => <p className="inkspace-paragraph" key={`${side}-${index}`}>{text}</p>)}
    {page.rubricLabel ? <p className="inkspace-rubric">{page.rubricLabel}</p> : null}
    {page.artSecondary ? <InkspaceArt art={page.artSecondary} secondary /> : null}
    {page.callout ? <aside className="inkspace-marginalia" aria-label={page.callout.label || "Marginal note"}>
      {page.callout.label ? <span>{page.callout.label}</span> : null}<p>{page.callout.text}</p>
    </aside> : null}
    {page.quote ? <blockquote className="inkspace-quote">“{page.quote.text}”
      {page.quote.attribution ? <cite>— {page.quote.attribution}</cite> : null}
    </blockquote> : null}
    {page.ornaments?.includes("filigree") ? <p className="inkspace-filigree" aria-hidden="true">❦ <span>✧</span> ❦</p> : null}
  </div>;
}

/** Exported for future reuse with actual Director content; never owns game facts. */
export function InkspaceStorySurface({ activeTab }: { activeTab: string }) {
  const [selected, setSelected] = useState<InkspaceMode>(tabMode(activeTab));
  const [displayed, setDisplayed] = useState<InkspaceMode>(tabMode(activeTab));
  const [replay, setReplay] = useState(0);
  const [quick, setQuick] = useState(false);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const progressRef = useRef(1);
  const displayedRef = useRef<InkspaceMode>(tabMode(activeTab));
  const mountedRef = useRef(false);
  const activeRef = useRef(selected);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSelected(tabMode(activeTab)); }, [activeTab]);
  useEffect(() => { activeRef.current = selected; }, [selected]);

  const paint = useCallback((value: number) => {
    progressRef.current = clamp01(value);
    // The folio's two leaves absorb ink at subtly different rates.
    const leftStep = Math.round(progressRef.current * (MASK_FRAMES - 1));
    const rightStep = Math.round(clamp01((progressRef.current - 0.07) / 0.93) * (MASK_FRAMES - 1));
    if (leftRef.current) { leftRef.current.style.maskImage = maskURL(leftStep); leftRef.current.style.webkitMaskImage = maskURL(leftStep); }
    if (rightRef.current) { rightRef.current.style.maskImage = maskURL(rightStep); rightRef.current.style.webkitMaskImage = maskURL(rightStep); }
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const images: HTMLImageElement[] = [];
    for (let i = 0; i < MASK_FRAMES; i += 1) {
      const img = new Image(); img.src = `/art/pass64/ink-masks/ink-${String(i).padStart(2, "0")}.webp`; images.push(img);
    }
    return () => { images.length = 0; };
  }, []);

  useEffect(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      displayedRef.current = selected;
      setDisplayed(selected);
      setBusy(false);
      paint(1);
      return;
    }
    let disposed = false;
    const duration = quick ? 390 : 820;
    const animate = (from: number, to: number, ms: number, finish: () => void) => {
      const start = performance.now();
      const tick = (now: number) => {
        if (disposed) return;
        const ratio = clamp01((now - start) / ms);
        paint(from + (to - from) * eased(ratio));
        if (ratio < 1) rafRef.current = requestAnimationFrame(tick);
        else { rafRef.current = null; finish(); }
      };
      rafRef.current = requestAnimationFrame(tick);
    };
    setBusy(true);
    const reveal = () => animate(0, 1, duration, () => { if (!disposed) { paint(1); setBusy(false); } });
    if (!mountedRef.current) {
      mountedRef.current = true;
      paint(0);
      reveal();
    } else if (displayedRef.current !== selected) {
      animate(progressRef.current, 0, duration * 0.65, () => {
        if (disposed) return;
        paint(0);
        // Swap copy only after the old page has fully dissolved.
        displayedRef.current = activeRef.current;
        setDisplayed(displayedRef.current);
        rafRef.current = requestAnimationFrame(() => { if (!disposed) reveal(); });
      });
    } else {
      paint(0);
      reveal();
    }
    return () => { disposed = true; if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [selected, replay, quick, paint]);

  const spread = INKSPACE_STORIES[displayed];
  return <div className={`inkspace-projection inkspace-stage--${spread.mode}`} aria-label="Living manuscript story surface">
    <section className="inkspace-leaf inkspace-leaf--left" style={sceneStyle("left")} aria-label="Left page">
      <div className="inkspace-page-ink" ref={leftRef}><ManuscriptPage page={spread.leftPage} mode={spread.mode} side="left" /></div>
    </section>
    <section className="inkspace-leaf inkspace-leaf--right" style={sceneStyle("right")} aria-label="Right page">
      <div className="inkspace-page-ink" ref={rightRef}><ManuscriptPage page={spread.rightPage} mode={spread.mode} side="right" /></div>
      <nav className="inkspace-page-chooser" aria-label="Story composition styles">
        {INKSPACE_MODES.map((option) => <button key={option.id} type="button" className={selected === option.id ? "is-selected" : ""}
          aria-pressed={selected === option.id} onClick={() => setSelected(option.id)}>{option.name}</button>)}
        <button type="button" className="inkspace-replay" aria-label="Replay ink reveal" onClick={() => setReplay((value) => value + 1)}>↺</button>
      </nav>
    </section>
    <span className="inkspace-announce sr-only" role="status" aria-live="polite">{busy ? "Writing the next spread" : `${spread.mode} story spread ready`}</span>
    <button className="inkspace-motion" type="button" onClick={() => setQuick((value) => !value)} aria-label={`Ink speed: ${quick ? "quick" : "poetic"}. Change speed`}>
      {quick ? "Quick ink" : "Poetic ink"}
    </button>
  </div>;
}

/** Router component for the isolated, protected /game/inkspace-story route. */
export { InkspaceStorySurface as InkspaceStoryPage };
