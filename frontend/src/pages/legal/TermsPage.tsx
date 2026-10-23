import { Link } from "react-router";
import { useAuth } from "../../state/AuthContext";
import { useInkboundPaper } from "../../features/appearance/inkboundPaper";
import "../game/quillairoRulebookPass6614.css";
import { Panel } from "../../components/ui/Panel";

export function TermsPage() {
  const { user } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  return (
    <article className="legal-page public-legal-page q-rulebook q-legal" data-ink-paper={paper}>
      <header className="q-rulebook-hero q-legal-hero"><div className="q-rulebook-intro">
        <p className="q-rulebook-overline">QUILLAIRO · LEGAL · LAST UPDATED OCTOBER 4, 2026</p>
        <h1>A shared adventure, fairly played.</h1><p>The expectations that keep our stories enjoyable for everyone.</p>
        <Link to="/" className="q-rulebook-return">← Return to Quillairo</Link></div>
        <img src="/art/inkbound/lantern-books.png" alt="A lantern and journals drawn in ink" /></header>

      <div className="legal-copy-grid">
        <Panel title="THE SERVICE">
          <p>
            Quillairo is an evolving online game. Features, generated content, balance,
            availability, and saved-state behavior may change as the service is developed and
            tested.
          </p>
        </Panel>

        <Panel title="YOUR ACCOUNT">
          <p>
            You are responsible for the credentials used to access your account and for the
            content you intentionally submit through that account, including Hero Bios,
            authored material, and player-entered story actions.
          </p>
        </Panel>

        <Panel title="GENERATED STORIES">
          <p>
            AI-generated narrative can be surprising, imperfect, or inconsistent. The game
            separates authoritative mechanics from narrative generation, but generated prose
            should still be treated as game content rather than professional, factual, or
            real-world advice.
          </p>
        </Panel>

        <Panel title="FAIR USE OF THE GAME">
          <p>
            Do not interfere with the service, attempt unauthorized access, abuse other
            players, or use the game to submit content that you do not have the right to use.
            A production launch should replace or supplement this product notice with
            counsel-reviewed terms appropriate to the final service.
          </p>
        </Panel>
      </div>
    </article>
  );
}
