import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";

export function TermsPage() {
  return (
    <article className="legal-page public-legal-page">
      <PageTitle eyebrow="LEGAL // LAST UPDATED OCTOBER 4, 2026" title="TERMS" />

      <div className="legal-copy-grid">
        <Panel title="THE SERVICE">
          <p>
            Tales of Two is an evolving online game. Features, generated content, balance,
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
