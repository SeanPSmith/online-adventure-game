import { Link, isRouteErrorResponse, useRouteError } from "react-router";

export function RouteErrorPage() {
  const error = useRouteError();

  let detail = "Something slipped between the pages.";

  if (isRouteErrorResponse(error)) {
    detail = `${error.status} ${error.statusText}`;
  } else if (error instanceof Error) {
    detail = error.message;
  }

  return (
    <main className="not-found">
      <div className="eyebrow">SYSTEM INCIDENT</div>
      <h1>THE STORY MACHINE HAS MISPLACED A GEAR.</h1>
      <p className="muted-copy">{detail}</p>
      <Link className="button button-primary" to="/game">
        RETURN TO KNOWN REALITY
      </Link>
    </main>
  );
}
