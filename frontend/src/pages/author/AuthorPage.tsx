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
    <>
      <PageTitle eyebrow="THE WRITER’S DESK" title="Worlds waiting to be written" />
      <div className="inkbound-author-intro">
        <div>
          <p>Begin with a world. Follow it with an adventure. All your drafts, versions,
            AI proposals, previews, and publishing tools remain in the full studio.</p>
          <Link className="inkbound-author-enter" to="/author-console">
            Open Author Studio <span aria-hidden="true">→</span>
          </Link>
        </div>
        <p className="inkbound-author-aside">The ink remembers what you write.</p>
      </div>

      <Panel title="ADVENTURE DOCUMENTS">
        {loading ? <p className="muted-copy">OPENING THE WORKSHOP_</p> : null}
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
            <strong>THE WORKSHOP IS EMPTY.</strong>
            <span>Probably safer this way.</span>
          </div>
        ) : null}

        <p className="muted-copy author-migration-note">
          Open Author Studio to edit, review AI proposals, autosave, version, preview,
          and publish. This page lists your live documents; no authoring features were removed.
        </p>
      </Panel>
    </>
  );
}
