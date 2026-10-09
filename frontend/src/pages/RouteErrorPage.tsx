import { Link, isRouteErrorResponse, useRouteError } from "react-router";

const CHUNK_LOAD_FAILURE = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk .+ failed|unable to preload css/i;

export function RouteErrorPage() {
  const error = useRouteError();
  const isAssetFailure = error instanceof Error && CHUNK_LOAD_FAILURE.test(error.message);

  let detail = "Something slipped between the pages.";

  if (isAssetFailure) {
    detail = "This page could not finish loading. Your connection may have dropped, or the site was updated while you had it open. Reload to request the latest version.";
  } else if (isRouteErrorResponse(error)) {
    detail = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <main className="not-found" role="alert">
      <div className="eyebrow">SYSTEM INCIDENT</div>
      <h1>THE STORY MACHINE HAS MISPLACED A GEAR.</h1>
      <p className="muted-copy">{detail}</p>
      <div className="route-error-actions">
        <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
          RELOAD PAGE
        </button>
        <Link className="button" to="/game">
          RETURN TO KNOWN REALITY
        </Link>
      </div>
    </main>
  );
}
