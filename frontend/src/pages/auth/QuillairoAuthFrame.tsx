import type { ReactNode } from "react";
import { Link } from "react-router";
import { QuillairoMonogram } from "../../components/brand/BrandLockup";
import { useAuth } from "../../state/AuthContext";
import { useInkboundPaper } from "../../features/appearance/inkboundPaper";

export function QuillairoAuthFrame({ title, intro, overline, children }: {
  title: string;
  intro: string;
  overline: string;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  return (
    <section className="qpub-auth" aria-label={title}>
      <div className="qpub-auth-art">
        <img src="/art/quillairo-public/auth-journey.png" alt="A cloaked traveler writing at a desk overlooking a distant ink-drawn kingdom" />
        <div className="qpub-auth-art-copy"><span className="qpub-overline">A WORLD THAT REMEMBERS</span><p>Every journey begins<br />with a single choice.</p><Link to="/">Explore Quillairo ↗</Link></div>
      </div>
      <div className="qpub-auth-content">
        <div className="qpub-auth-heading">
          <QuillairoMonogram className="qpub-auth-monogram" paper={paper} />
          <span className="qpub-overline">{overline}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        <div className="qpub-auth-form">{children}</div>
      </div>
    </section>
  );
}
