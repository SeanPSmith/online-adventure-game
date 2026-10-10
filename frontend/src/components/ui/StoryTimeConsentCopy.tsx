/** Shown before any device downloads full-quality local narration weights. */
export function StoryTimeConsentCopy() {
  return (
    <div className="modal-copy-stack">
      <p><strong>STORY TIME</strong> reads adventure chapters and choices aloud, entirely on this device.</p>
      <p>The first time you enable it, your browser downloads approximately <strong>350 MB</strong> of voice model and supporting files. Wi-Fi is recommended.</p>
      <p>Files are normally cached for later visits, but clearing browser data may require downloading them again. Speech generation uses your device's memory and processor and may be slow on some phones.</p>
      <div className="system-notice">NO MICROPHONE. NO VOICE INPUT. NO PER-CHARACTER CHARGE. TEXT FOR NARRATION STAYS ON YOUR DEVICE.</div>
      <p>The download comes from a third-party model host, which may receive your IP address and other request details. Your chapter and choice text is spoken on your device, not uploaded for voice processing.</p>
      <p>Nothing downloads until you choose <strong>DOWNLOAD &amp; ENABLE</strong>. You can turn Story Time off at any time; downloaded files may remain in your browser cache.</p>
      <p><a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy details</a> <span aria-hidden="true">·</span> <a href="/legal/story-time-third-party-notices.txt" target="_blank" rel="noopener noreferrer">Open-source notices</a></p>
    </div>
  );
}
