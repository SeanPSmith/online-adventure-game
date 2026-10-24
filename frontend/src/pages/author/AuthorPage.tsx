import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { PageTitle } from "../../components/ui/PageTitle";
import { Panel } from "../../components/ui/Panel";
import {
  getAuthorIdentity,
  listAuthorDocuments,
  type AuthorDocument,
} from "../../services/author";
import { useAuth } from "../../state/AuthContext";
import "./quillairoAuthorHomePass6627.css";

export function AuthorPage() {
  const { user } = useAuth();
  const canAuthor = user?.permissions.includes("author") ?? false;

  const [documents, setDocuments] = useState<AuthorDocument[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!canAuthor) {
      setLoading(false);
      return;
    }

    let alive = true;

    Promise.all([
      getAuthorIdentity(),
      listAuthorDocuments(),
    ])
      .then(([, documentResponse]) => {
        if (!alive) return;
        setDocuments(documentResponse.adventures);
      })
      .catch((reason) => {
        if (!alive) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Author workspace unavailable.",
        );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [canAuthor]);

  if (!canAuthor) {
    return <Navigate to="/game" replace />;
  }

  return (
    <div className="q27-author-home">
      <PageTitle eyebrow="THE WRITER’S DESK" title="At the writer’s desk" />
      <div className="inkbound-author-intro">
        <div>
          <p>Create a world bible or begin with a short adventure brief. Your drafts,
            AI proposals, version history, previews, and publishing controls live together in the Author Studio.</p>
          <Link className="inkbound-author-enter" to="/author-console">
            Enter the Author Studio <span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="inkbound-author-aside">The ink remembers what you write.</p>
      </div>

      <Panel title="YOUR MANUSCRIPTS">
        {loading ? <p className="muted-copy">Opening your manuscript library…</p> : null}
        {error ? <div className="form-error">{error}</div> : null}

        <div className="author-document-grid">
          {documents.map((document, index) => (
            <article
              className="author-document"
              key={String(document.document_id ?? document.slug ?? index)}
            >
              <span className="eyebrow">
                {String(document.document_kind ?? "DOCUMENT").toUpperCase()}
              </span>
              <strong>{String(document.title ?? document.slug ?? "UNTITLED")}</strong>
              <small>{String(document.slug ?? "")}</small>
            </article>
          ))}
        </div>

        {!loading && !error && documents.length === 0 ? (
          <div className="empty-state">
            <strong>A blank page awaits.</strong>
            <span>Begin with a world or a single adventure brief in the Author Studio.</span>
          </div>
        ) : null}

        <p className="muted-copy author-migration-note">
          The Author Studio holds the full editing workflow: autosave, AI suggestions,
          version history, preview, and publishing. Select a manuscript there to continue writing.
        </p>
      </Panel>
    </div>
  );
}
