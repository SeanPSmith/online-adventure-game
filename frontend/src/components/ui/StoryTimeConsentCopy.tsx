/** Informational privacy notice: Story Time runs remotely, never in a browser model. */
export function StoryTimeConsentCopy() {
  return <div className="modal-copy-stack">
    <p>Story Time optionally reads story passages and choices aloud through a hosted narrator.</p>
    <p>No large model download, voice recording, microphone, or voice input is required.</p>
    <p>The passage chosen for narration is processed by the speech service.</p>
    <p><a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy details</a></p>
  </div>;
}
