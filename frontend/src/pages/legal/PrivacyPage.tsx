import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";

export function PrivacyPage() {
  return (
    <article className="legal-page public-legal-page">
      <PageTitle eyebrow="LEGAL // LAST UPDATED OCTOBER 9, 2026" title="PRIVACY" />

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

        <Panel title="STORY TIME // OPTIONAL ON-DEVICE NARRATION">
          <p>
            Story Time is optional. If you choose to enable it, your browser downloads
            the voice model and supporting files from a third-party model host. This
            initial download is approximately 350 MB and may be cached on your device.
            Your browser may download the files again if its cache is cleared.
          </p>
          <p>
            Story Time turns visible chapter and choice text into audio locally on your
            device. The passage being narrated is not sent to a separate speech server.
            Download hosts can receive technical request information such as your IP
            address when your browser retrieves the model files. Narration does not
            request microphone access or record your voice. Story generation itself
            still uses the AI processing described above.
          </p>
          <p>
            You can disable Story Time in your audio settings at any point. Disabling
            it stops narration; it does not necessarily delete model files that your
            browser has cached. Clear site data using your browser controls to remove
            downloaded model files and local narration preferences.
          </p>
          <p>
            <a href="/legal/story-time-third-party-notices.txt" target="_blank" rel="noopener noreferrer">
              Story Time technology and open-source license notices
            </a>
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
