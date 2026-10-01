import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";

export function SettingsPage() {
  return (
    <>
      <PageTitle eyebrow="ACCOUNT" title="SETTINGS" />
      <Panel title="PREFERENCES">
        <p className="muted-copy">
          Scaffold for audio, accessibility, animation/reduced-motion, chat-event visibility,
          notifications, and future account preferences.
        </p>
      </Panel>
    </>
  );
}
