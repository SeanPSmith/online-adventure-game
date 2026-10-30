import { useAuth } from "../../state/AuthContext";
import { useInkboundPaper } from "../../features/appearance/inkboundPaper";

/** Route-only placeholders; no page data, auth mutations, timers, or artwork downloads. */
function classifyRoute(path: string) {
  if (path.startsWith("/game/adventure/")) return "reader";
  if (/^\/game\/(heroes|graveyard|adventures|history)/.test(path)) return "collection";
  if (path === "/game" || path === "/game/") return "worlds";
  if (path.startsWith("/account") || path.startsWith("/author") || path.startsWith("/admin")) return "workspace";
  return "public";
}

function InkLines({ count = 4 }: { count?: number }) {
  return <div className="q661-skeleton-lines" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => <span key={index} />)}
  </div>;
}

export function RouteSkeleton({ path }: { path?: string }) {
  const { user } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  const route = classifyRoute(path ?? (typeof window !== "undefined" ? window.location.pathname : "/"));
  const isReader = route === "reader";
  const isCollection = route === "collection" || route === "worlds";
  return (
    <div className={`q661-route-skeleton is-${route}`} data-ink-paper={paper} role="status" aria-live="polite" aria-label="Opening page">
      <div className="q661-skeleton-topline" aria-hidden="true"><span className="q661-skeleton-brand">QUILLAIRO</span><span className="q661-skeleton-rule" /></div>
      {isReader ? (
        <div className="q661-skeleton-grid is-reader" aria-hidden="true">
          <aside className="q661-skeleton-folio"><div className="q661-skeleton-portrait" /><InkLines count={3} /></aside>
          <section className="q661-skeleton-manuscript"><div className="q661-skeleton-heading"/><InkLines count={7}/><div className="q661-skeleton-choices"><span/><span/></div></section>
          <aside className="q661-skeleton-aside"><div className="q661-skeleton-heading"/><div className="q661-skeleton-dice"/><InkLines count={3}/></aside>
        </div>
      ) : isCollection ? (
        <div className="q661-skeleton-collection" aria-hidden="true">
          <div className="q661-skeleton-heading"/><InkLines count={2}/>
          <div className="q661-skeleton-card-grid"><article><div className="q661-skeleton-art"/><InkLines count={3}/></article><article><div className="q661-skeleton-art"/><InkLines count={3}/></article><article><div className="q661-skeleton-art"/><InkLines count={3}/></article></div>
        </div>
      ) : (
        <div className="q661-skeleton-workspace" aria-hidden="true"><div className="q661-skeleton-heading"/><InkLines count={3}/><div className="q661-skeleton-panel"><InkLines count={6}/></div></div>
      )}
      <p className="q661-skeleton-status">Opening the {isReader ? "manuscript" : route === "worlds" ? "worlds" : route === "collection" ? "archives" : "page"}…</p>
    </div>
  );
}
