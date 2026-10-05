import { Link } from "react-router";

export function ForgotPasswordPage() {
  return (
    <section className="auth-shell" aria-labelledby="recovery-heading">
      <div className="auth-intro">
        <span className="eyebrow">ACCOUNT RECOVERY // STATUS</span>
        <h1 id="recovery-heading">RECOVERY CHANNEL OFFLINE.</h1>
        <p>
          Password reset is not connected to the current authentication service yet. This
          screen does not collect or pretend to send an email while that endpoint is absent.
        </p>
      </div>

      <div className="auth-card panel auth-status-card">
        <header className="panel-heading"><span>PASSWORD RESET</span><span>NOT CONNECTED</span></header>
        <div className="panel-body form-stack">
          <div className="system-notice auth-recovery-notice">
            <strong>NO RESET REQUEST WAS SENT.</strong>
            <span>The product will expose recovery here when the backend flow exists.</span>
          </div>
          <Link className="button button-primary" to="/login">RETURN TO SIGN IN</Link>
          <Link className="button button-quiet" to="/register">CREATE A NEW ACCOUNT</Link>
        </div>
      </div>
    </section>
  );
}
