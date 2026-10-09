import { Link, isRouteErrorResponse, useRouteError } from "react-router";

const CHUNK_LOAD_FAILURE = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|loading chunk .+ failed|unable to preload css/i;

export function RouteErrorPage() {
  const error = useRouteError();
  const isAssetFailure = error instanceof Error && CHUNK_LOAD_FAILURE.test(error.message);
  const isMissing = isRouteErrorResponse(error) && error.status === 404;
  const detail = isAssetFailure
    ? "The path changed while you were traveling, or your connection faltered. Reload to find the latest page. Your saved progress remains with your adventure."
    : isMissing
      ? "This part of the map has faded from the Chronicle. Return to the Adventure Hall to find a known path."
      : "The Chronicle could not open this page. Try again; if the passage stays closed, return to the Adventure Hall.";

  return (
    <main className="not-found" role="alert">
      <span className="eyebrow">THE CHRONICLE // A LOST PAGE</span>
      <h1>THE INK HAS GONE ASTRAY.</h1>
      <p className="muted-copy">{detail}</p>
      <div className="route-error-actions">
        <button className="button button-primary" type="button" onClick={() => window.location.reload()}>
          TRY THIS PAGE AGAIN
        </button>
        <Link className="button" to="/game">
          RETURN TO ADVENTURE HALL
        </Link>
      </div>
    </main>
  );
}
