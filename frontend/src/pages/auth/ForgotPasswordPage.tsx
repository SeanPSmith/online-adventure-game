import { Link } from "react-router";
import { QuillairoAuthFrame } from "./QuillairoAuthFrame";

export function ForgotPasswordPage() {
  return <QuillairoAuthFrame title="Find your way back." intro="Account recovery is not yet available in this version of Quillairo." overline="ACCOUNT RECOVERY">
    <div className="qpub-auth-fields qpub-recovery">
      <p role="status"><strong>Password reset is not connected.</strong> No email has been requested or sent. This page will offer secure recovery once that backend service is available.</p>
      <Link className="qpub-button qpub-button-primary qpub-auth-action" to="/login">Return to sign in <span aria-hidden="true">↗</span></Link>
      <Link className="qpub-button qpub-button-secondary qpub-auth-action" to="/register">Create another account <span aria-hidden="true">↗</span></Link>
    </div>
  </QuillairoAuthFrame>;
}
