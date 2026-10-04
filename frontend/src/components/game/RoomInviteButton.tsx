import { useMemo, useState } from "react";
import { useModal } from "../../state/ModalContext";

function roomInviteUrl(roomCode: string) {
  const code = roomCode.trim().toUpperCase();
  return `${window.location.origin}/join/${encodeURIComponent(code)}`;
}

function copyFallback(value: string) {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  document.body.removeChild(input);
}

function InviteShareBody({ roomCode, adventureTitle }: { roomCode: string; adventureTitle?: string }) {
  const [status, setStatus] = useState("");
  const code = roomCode.trim().toUpperCase();
  const url = useMemo(() => roomInviteUrl(code), [code]);
  const title = adventureTitle ? `Join ${adventureTitle}` : "Join my Tales of Two adventure";
  const text = `Join me in Tales of Two. Room ${code}.`;
  const encodedBody = encodeURIComponent(`${text}\n${url}`);

  async function copyLink() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        copyFallback(url);
      }
      setStatus("INVITE LINK COPIED");
    } catch {
      copyFallback(url);
      setStatus("INVITE LINK COPIED");
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title, text, url });
      setStatus("SHARE SHEET OPENED");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setStatus("SHARE UNAVAILABLE — COPY THE LINK INSTEAD");
    }
  }

  return (
    <div className="room-invite-modal-body">
      <div className="room-invite-code-block">
        <span className="eyebrow">ROOM CODE</span>
        <strong>{code}</strong>
        <small>THE LINK WILL BRING YOUR PARTNER DIRECTLY TO THIS ROOM.</small>
      </div>

      <div className="room-invite-url" aria-label="Invite link">{url}</div>

      <div className="room-invite-actions">
        <button className="button button-primary" type="button" onClick={() => void nativeShare()}>
          SHARE...
        </button>
        <button className="button" type="button" onClick={() => void copyLink()}>
          COPY LINK
        </button>
        <a className="button" href={`sms:?&body=${encodedBody}`}>
          TEXT
        </a>
        <a
          className="button"
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodedBody}`}
        >
          EMAIL
        </a>
      </div>

      <p className="muted-copy room-invite-help">
        On phones, SHARE opens the device share sheet so installed apps such as Messages,
        Mail, Snapchat, and other share targets can appear when the browser supports them.
      </p>

      {status ? <div className="system-notice room-invite-status">{status}</div> : null}
    </div>
  );
}

export function RoomInviteButton({
  roomCode,
  adventureTitle,
  className = "button button-quiet",
  label = "INVITE",
}: {
  roomCode: string;
  adventureTitle?: string;
  className?: string;
  label?: string;
}) {
  const { openModal } = useModal();

  function openInvite() {
    openModal({
      title: "INVITE A PARTNER",
      dismissLabel: "DONE",
      body: <InviteShareBody roomCode={roomCode} adventureTitle={adventureTitle} />,
    });
  }

  return (
    <button className={className} type="button" onClick={openInvite}>
      {label}
    </button>
  );
}
