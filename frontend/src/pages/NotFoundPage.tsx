import { Link } from "react-router";
import { useAuth } from "../state/AuthContext";
import { useInkboundPaper } from "../features/appearance/inkboundPaper";

export function NotFoundPage() {
  const { user } = useAuth();
  const [paper] = useInkboundPaper(user?.user_id ?? "");
  return (
    <main className="not-found inkscape-route-state" data-ink-paper={paper} role="main">
      <span className="eyebrow">404 // UNCHARTED PATH</span>
      <h1>THIS ROAD LEADS BEYOND THE MAP.</h1>
      <p className="muted-copy">Even the oldest chronicles hold a few missing pages. The path you followed has vanished, but your adventure has not.</p>
      <Link className="button button-primary" to="/">RETURN TO THE CROSSROADS</Link>
    </main>
  );
}
