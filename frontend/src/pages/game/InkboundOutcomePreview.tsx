/** Pass 65.5: accessible roll-result design preview, never a server roll. */
import { useEffect, useRef, useState } from "react";
const resultArt = "/art/inkbound";
export function InkboundOutcomePreview({ onContinue, choice }: { onContinue: () => void; choice?: string }) {
  const [expanded,setExpanded] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onContinue(); }
      if (event.key !== "Tab" || !dialog.current) return;
      const items = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]'));
      const first = items[0], last = items[items.length-1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown",keydown);
    return () => { document.body.style.overflow = previous; document.removeEventListener("keydown",keydown); };
  },[onContinue]);
  return <div className="i655-outcome-screen" aria-label="Illustrated outcome preview">
    <div className="i655-outcome-underpage" aria-hidden="true"><h2>The Road North</h2><img src={`${resultArt}/north-road-editorial.png`} alt=""/><p>The road climbed through broken hills, its stones slick with last night’s rain.</p></div>
    <div className="i655-outcome-veil"><div className="i655-result-leaf" role="dialog" aria-modal="true" aria-labelledby="i655-result-heading" aria-describedby="i655-result-description" ref={dialog} tabIndex={-1}>
      <div className="i655-result-eyebrow">✳ &nbsp; Roll result · illustrative preview &nbsp; ✳</div>
      <h1 id="i655-result-heading">The Lantern Answers</h1>
      <div className="i655-die-vignette"><img className="i655-result-lantern" src={`${resultArt}/lantern-books.png`} alt=""/><svg viewBox="0 0 260 260" role="img" aria-label="Hand-drawn twenty-sided die, sample result 14" className="i655-result-die"><g stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M130 18 219 73 238 160 165 240 70 240 19 157 40 72Z" strokeWidth="2.7"/><path d="m130 18-40 79 80 0 49-24 M40 72 90 97 19 157l71 39-20 44 M170 97l68 63-73 36v44 M90 97l0 99 75 0 5-99 M90 196l40 42 35-42 M19 157l55-25 M219 73l-27 93" strokeWidth="1.8"/><path d="M120 4v-9 M150 8l5-14 M8 102l-13-7 M245 111l13-4 M26 222l-16 10 M240 215l12 12" strokeWidth="1.1" opacity=".55"/></g><text x="130" y="173" textAnchor="middle" fill="currentColor" fontSize="77" fontFamily="Georgia,serif">14</text></svg><img className="i655-result-signpost" src={`${resultArt}/signpost.png`} alt=""/></div>
      <h2>Success</h2><div className="i655-result-flourish" aria-hidden="true">— ✦ —</div>
      <dl className="i655-result-record"><div><dt>The choice</dt><dd>{choice || "Follow the lantern light"}</dd></div><div><dt>Roll</dt><dd>14</dd></div><div><dt>Bonus</dt><dd>+2 Instinct</dd></div><div><dt>Difficulty</dt><dd>15</dd></div><div><dt>Outcome</dt><dd>Success</dd></div></dl>
      <p id="i655-result-description" className="i655-result-prose">You move quietly through the trees and reach the lantern before its bearer can vanish into the mist.</p>
      <div className="i655-result-consequences"><p><b>+20 XP</b><span>Experience grows</span></p><p><b>No HP loss</b><span>The road spares you</span></p><p><b>A new thread</b><span>The Hermit’s Fire</span></p></div>
      {expanded && <div className="i655-result-breakdown" aria-live="polite"><p>Sample calculation: d20 (14) + Instinct (2) = 16 vs. difficulty 15.</p><p>These values are illustrative. Live game rolls, health and XP are always determined by the server.</p></div>}
      <button type="button" className="i655-result-continue" onClick={onContinue}>Continue the story →</button>
      <button type="button" className="i655-result-details" onClick={() => setExpanded(s=>!s)} aria-expanded={expanded}>{expanded ? "Hide sample calculation" : "View sample roll details"}</button>
      <small className="i655-result-disclaimer">WORKSHOP PREVIEW — NOT A REAL ROLL OR GAME REWARD</small>
    </div></div>
  </div>;
}
