import { Link } from "react-router";

export function NotFoundPage() {
  return (
    <main className="not-found">
      <div className="eyebrow">404</div>
      <h1>THIS PATH IS NOT IN THE CHRONICLE.</h1>
      <Link className="button button-primary" to="/">RETURN HOME</Link>
    </main>
  );
}
