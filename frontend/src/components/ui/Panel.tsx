import type { ReactNode } from "react";

export function Panel({
  title,
  children,
  className = "",
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      {title ? <header className="panel-heading">{title}</header> : null}
      <div className="panel-body">{children}</div>
    </section>
  );
}
