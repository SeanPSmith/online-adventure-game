const LAST_GAME_ROUTE_KEY = "tot:last-game-route";

function validGameRoute(value: string | null | undefined) {
  const clean = String(value ?? "").trim();

  if (!clean.startsWith("/game")) {
    return "";
  }

  return clean;
}

export function rememberGameRoute(route: string) {
  const clean = validGameRoute(route);
  if (!clean) return;

  try {
    sessionStorage.setItem(LAST_GAME_ROUTE_KEY, clean);
  } catch {
    // Route memory is a convenience only.
  }
}

export function readLastGameRoute(fallback = "/game") {
  try {
    return validGameRoute(sessionStorage.getItem(LAST_GAME_ROUTE_KEY)) || fallback;
  } catch {
    return fallback;
  }
}
