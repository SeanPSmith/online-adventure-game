import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";

export function PrivacyPage() {
  return (
    <article className="legal-page public-legal-page">
      <PageTitle eyebrow="LEGAL // LAST UPDATED OCTOBER 13, 2026" title="PRIVACY" />

      <div className="legal-copy-grid">
        <Panel title="WHAT THE GAME KEEPS">
          <p>
            Quillairo stores the account information required to identify you and keep a
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

        <Panel title="STORY TIME // OPTIONAL HOSTED NARRATION">
          <p>
            Story Time is optional and off by default. When enabled, the passage you choose
            to hear (chapter text or a choice) is sent to our hosted speech-generation
            service to produce audio. The voice is selected by the adventure host, while
            each player independently controls their own playback and volume.
          </p>
          <p>
            Story Time does not download a speech model onto your device and does not
            request microphone access, record your voice, or recognize spoken commands.
            The game may cache generated audio to avoid repeat processing. When you
            listen in an adventure, audio segments can be kept temporarily for up to
            30 days while the story is active. Audio from a completed adventure
            can be retained with its Chronicle and replayed by that adventure's
            participants without generating it again. Disabling narration prevents
            future playback requests, but does not remove already archived audio.
            Operational diagnostics may also be stored temporarily.
          </p>
          <p>
            <a href="/legal/story-time-third-party-notices.txt" target="_blank" rel="noopener noreferrer">
              Open-source software notices
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
