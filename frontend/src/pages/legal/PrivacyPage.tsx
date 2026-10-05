import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";

export function PrivacyPage() {
  return (
    <article className="legal-page public-legal-page">
      <PageTitle eyebrow="LEGAL // LAST UPDATED OCTOBER 4, 2026" title="PRIVACY" />

      <div className="legal-copy-grid">
        <Panel title="WHAT THE GAME KEEPS">
          <p>
            Tales of Two stores the account information required to identify you and keep a
            session active, plus the game data needed to preserve Heroes, progression,
            adventures, room participation, and completed story history.
          </p>
        </Panel>

        <Panel title="STORY + AI PROCESSING">
          <p>
            Story generation can use the Hero, adventure, choices, mechanical results, and
            other story context needed to produce the next scene. Do not put information in a
            Hero Bio or story input that you would not want processed as part of gameplay.
          </p>
        </Panel>

        <Panel title="OPERATIONS">
          <p>
            The service may retain technical and product information needed to operate,
            secure, diagnose, and improve the game, including session state and aggregate
            gameplay or completion information exposed through the administrative tools.
          </p>
        </Panel>

        <Panel title="PLAYER CONTROL">
          <p>
            Account and data-management controls are still evolving with the product. This
            notice describes the current application behavior and should receive formal legal
            review before a broader commercial launch.
          </p>
        </Panel>
      </div>
    </article>
  );
}
