import { useAuth } from "../../state/AuthContext";
import { INKBOUND_PAPERS, useInkboundPaper } from "./inkboundPaper";
import "./inkboundPaperPreferences.css";

/** Player-controlled palette preview, intentionally kept in Account > Preferences. */
export function InkboundPaperPreferences() {
  const { user } = useAuth();
  const [selectedPaper, changePaper] = useInkboundPaper(user?.user_id ?? "");
  return <section id="inkbound-paper" className="inkpaper-preferences" aria-labelledby="inkpaper-title">
    <p className="inkpaper-kicker">THE READING ROOM / APPEARANCE</p>
    <h2 id="inkpaper-title">Paper &amp; ink</h2>
    <p className="inkpaper-description">Choose the atmosphere of your journal. Your stories and Heroes stay exactly as they are. This preference is saved in this browser for your account.</p>
    <div className="inkpaper-options" role="group" aria-label="Inkbound paper and ink theme">
      {INKBOUND_PAPERS.map((paper) => <button
        type="button" key={paper.id} className="inkpaper-option" data-ink-paper={paper.id}
        aria-pressed={selectedPaper === paper.id} onClick={() => changePaper(paper.id)}
      >
        <span className="inkpaper-sample" aria-hidden="true"><span className="inkpaper-sample-title">Once upon a time.</span><span className="inkpaper-sample-rule"/><span className="inkpaper-sample-lines">A story unfolds<br/>one choice at a time.</span></span>
        <span className="inkpaper-option-foot"><span className="inkpaper-option-name">{paper.name}</span><span className="inkpaper-option-check" aria-hidden="true">{selectedPaper === paper.id ? "✓" : ""}</span></span>
        <span className="inkpaper-option-description">{paper.description}</span>
      </button>)}
    </div>
    <p className="inkpaper-footnote" role="status">Selected: {INKBOUND_PAPERS.find((paper) => paper.id === selectedPaper)?.name}. <a href="/game">Return to your journal ↗</a></p>
  </section>;
}
