import type { ReactNode } from "react";

export function PageTitle({
  eyebrow,
  title,
  actions,
}: {
  eyebrow?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        <h1>{title}</h1>
      </div>
      {actions ? <div className="page-title-actions">{actions}</div> : null}
    </header>
  );
}
