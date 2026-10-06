import { useState } from "react";

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

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  copyFallback(value);
}

export function ShareMomentButton({
  title,
  text,
  url,
  className = "button button-quiet",
  label = "[↗] SHARE",
}: {
  title: string;
  text: string;
  url?: string;
  className?: string;
  label?: string;
}) {
  const [status, setStatus] = useState("");

  async function share() {
    const targetUrl = url ?? window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: targetUrl });
        setStatus("(^_^)/ SHARED");
      } else {
        await copyText(`${text}\n${targetUrl}`);
        setStatus("(^_^)/ COPIED");
      }
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") return;

      try {
        await copyText(`${text}\n${targetUrl}`);
        setStatus("(^_^)/ COPIED");
      } catch {
        setStatus(":/ SHARE FAILED");
      }
    }

    window.setTimeout(() => setStatus(""), 2400);
  }

  return (
    <span className="share-moment-control">
      <button className={className} type="button" onClick={() => void share()}>
        {label}
      </button>
      {status ? <small className="share-moment-status" aria-live="polite">{status}</small> : null}
    </span>
  );
}
