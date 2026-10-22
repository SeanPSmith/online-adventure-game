/** Approved Quillairo lockups. Never typeset/recreate the Q/quill/gold AI as live text. */
import type { CSSProperties } from "react";

type BrandSize = "navigation" | "hero" | "footer";
export function BrandLockup({size="navigation", className="", style}: {
  size?: BrandSize; className?: string; style?: CSSProperties;
}) {
  return <span className={`quillairo-lockup quillairo-lockup--${size} ${className}`} style={style} role="img" aria-label="Quillairo">
    <img className="quillairo-lockup__on-light" src="/brand/primary-light.png" alt="" aria-hidden="true" draggable={false} />
    <img className="quillairo-lockup__on-dark" src="/brand/secondary-dark.png" alt="" aria-hidden="true" draggable={false} />
  </span>;
}
export function QuillairoMonogram({className=""}: {className?: string}) {
  return <img className={`quillairo-monogram ${className}`} src="/brand/monogram-ink.png" alt="Quillairo Q and quill" draggable={false} />;
}
export function QuillairoSeal({className=""}: {className?: string}) {
  return <img className={`quillairo-seal ${className}`} src="/brand/seal-gold.png" alt="Quillairo publisher seal" draggable={false} />;
}
