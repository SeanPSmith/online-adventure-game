import { useMemo, useState, type FormEvent } from "react";
import { useModal } from "../../state/ModalContext";
import { getGameSocket } from "../../services/socket";
import type { RoomInviteAck } from "../../services/game";

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

function sendDirectInvite(roomCode: string, identifier: string) {
  return new Promise<RoomInviteAck>((resolve, reject) => {
    const socket = getGameSocket();
    if (!socket.connected) {
      reject(new Error("The live game connection is offline."));
      return;
    }

    const timer = window.setTimeout(() => {
      reject(new Error("The invite request timed out."));
    }, 8000);

    socket.emit(
      "send_room_invite",
      { room_code: roomCode, identifier },
      (response) => {
        window.clearTimeout(timer);
        resolve(response);
      },
    );
  });
}

function InviteShareBody({ roomCode, adventureTitle }: { roomCode: string; adventureTitle?: string }) {
  const [status, setStatus] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [sending, setSending] = useState(false);
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
      setStatus("(^_^)/ INVITE LINK COPIED");
    } catch {
      copyFallback(url);
      setStatus("(^_^)/ INVITE LINK COPIED");
    }
  }

  async function nativeShare() {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({ title, text, url });
      setStatus("(^_^)/ SHARE SHEET OPENED");
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setStatus(":/ SHARE UNAVAILABLE — COPY THE LINK INSTEAD");
    }
  }

  async function directInvite(event: FormEvent) {
    event.preventDefault();
    const target = identifier.trim();
    if (!target) {
      setStatus(":/ ENTER A TALES OF TWO USERNAME OR EMAIL");
      return;
    }

    setSending(true);
    setStatus("");
    try {
      const response = await sendDirectInvite(code, target);
      setStatus(response.ok ? `(^_^)/ ${response.message}` : `:/ ${response.message}`);
      if (response.ok) setIdentifier("");
    } catch (reason) {
      setStatus(`:/ ${reason instanceof Error ? reason.message : "INVITE FAILED"}`);
    } finally {
      setSending(false);
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
          [↗] SHARE...
        </button>
        <button className="button" type="button" onClick={() => void copyLink()}>
          [::] COPY LINK
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

      <form className="room-direct-invite" onSubmit={(event) => void directInvite(event)}>
        <div>
          <span className="eyebrow">REAL ACCOUNT PING</span>
          <p className="muted-copy">
            Send this room through Tales of Two itself. If your partner has Web Push,
            email, or SMS enabled, the server can reach them even when this page is closed.
          </p>
        </div>
        <div className="room-direct-invite-controls">
          <input
            className="input"
            type="text"
            autoComplete="off"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="USERNAME OR EMAIL"
            aria-label="Partner username or email"
            maxLength={254}
          />
          <button className="button button-primary" type="submit" disabled={sending}>
            {sending ? "SENDING..." : "PING ACCOUNT"}
          </button>
        </div>
      </form>

      <p className="muted-copy room-invite-help">
        SHARE uses your device share sheet. PING ACCOUNT is different: it targets an existing
        Tales of Two account and uses that player's notification preferences.
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
