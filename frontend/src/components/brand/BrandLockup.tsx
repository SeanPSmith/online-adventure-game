/** Approved Quillairo lockups. Never typeset/recreate the Q/quill/gold AI as live text. */
import type { CSSProperties } from "react";
import type { InkPaper } from "../../features/appearance/inkboundPaper";

type BrandSize = "navigation" | "hero" | "footer";
export function BrandLockup({size="navigation", className="", style, paper="ivory"}: {
  size?: BrandSize; className?: string; style?: CSSProperties; paper?: InkPaper;
}) {
  // Render only ONE approved logo image. The old CSS-based two-image switch
  // could display both variants because legacy image rules use !important.
  const dark = paper === "navy" || paper === "phosphor" || paper === "midnight";
  const src = dark ? "/brand/secondary-dark.png" : "/brand/primary-light.png";
  return <span className={`quillairo-lockup quillairo-lockup--${size} ${className}`} style={style}
    role="img" aria-label="Quillairo" data-brand-tone={dark ? "dark" : "light"} data-brand-paper={paper}>
    <img className="quillairo-lockup__art" src={src} alt="" aria-hidden="true" draggable={false} />
  </span>;
}
export function QuillairoMonogram({className="", paper="ivory"}: {className?: string; paper?: InkPaper}) {
  const dark = paper === "navy" || paper === "phosphor" || paper === "midnight";
  return <img className={`quillairo-monogram ${className}`} src={dark ? "/brand/monogram-gold-original.png" : "/brand/monogram-ink.png"} alt="Quillairo Q and quill" draggable={false} />;
}
export function QuillairoSeal({className=""}: {className?: string}) {
  return <img className={`quillairo-seal ${className}`} src="/brand/seal-gold.png" alt="Quillairo publisher seal" draggable={false} />;
}
