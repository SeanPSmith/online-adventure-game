import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { getPasswordResetStatus, requestPasswordReset } from "../../services/auth";
import { QuillairoAuthFrame } from "./QuillairoAuthFrame";

type Availability = "checking" | "available" | "unavailable";

export function ForgotPasswordPage() {
  const [availability, setAvailability] = useState<Availability>("checking");
  const [identifier, setIdentifier] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [sentMessage, setSentMessage] = useState("");

  useEffect(() => {
    let active = true;
    getPasswordResetStatus()
      .then((status) => { if (active) setAvailability(status.available ? "available" : "unavailable"); })
      .catch(() => { if (active) setAvailability("unavailable"); });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setWorking(true); setError("");
    try { const result = await requestPasswordReset(identifier.trim()); setSentMessage(result.message); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We could not start recovery. Try again in a moment."); }
    finally { setWorking(false); }
  }

  return <QuillairoAuthFrame title="Find your way back." intro="Tell us the email or username on your account and we will send a link to choose a new password." overline="ACCOUNT RECOVERY">
    {sentMessage ? <div className="qpub-auth-fields qpub-recovery">
      <p role="status"><strong>Check your inbox.</strong> {sentMessage} If nothing arrives within a few minutes, look in spam, then try again.</p>
      <Link className="qpub-button qpub-button-primary qpub-auth-action" to="/login">Return to sign in <span aria-hidden="true">↗</span></Link>
    </div> : availability === "unavailable" ? <div className="qpub-auth-fields qpub-recovery">
      <p role="status"><strong>Email recovery is not available right now.</strong> No email has been requested or sent. Please try again later.</p>
      <Link className="qpub-button qpub-button-primary qpub-auth-action" to="/login">Return to sign in <span aria-hidden="true">↗</span></Link>
      <Link className="qpub-button qpub-button-secondary qpub-auth-action" to="/register">Create another account <span aria-hidden="true">↗</span></Link>
    </div> : <form className="qpub-auth-fields qpub-recovery" onSubmit={submit} aria-label="Recover your account">
      <label htmlFor="qpub-recovery-identifier">Email or username</label>
      <input id="qpub-recovery-identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} autoComplete="username" maxLength={254} required autoFocus />
      {error ? <div className="qpub-form-error" role="alert">{error}</div> : null}
      <button className="qpub-button qpub-button-primary qpub-auth-action" type="submit" disabled={working || availability === "checking"}>{working ? "Sending…" : "Send reset link"}<span aria-hidden="true">↗</span></button>
      <p className="qpub-auth-footer">Remembered it? <Link to="/login">Return to your story.</Link></p>
    </form>}
  </QuillairoAuthFrame>;
}
