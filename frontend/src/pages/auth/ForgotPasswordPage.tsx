import { Link } from "react-router";

export function ForgotPasswordPage() {
  return (
    <section className="auth-card panel">
      <header className="panel-heading">RESET PASSWORD</header>
      <div className="panel-body form-stack">
        <p>
          Presentation scaffold only. The current Python auth service has login,
          registration, session lookup, and logout, but no password-reset endpoint yet.
        </p>
        <label>
          <span>EMAIL</span>
          <input type="email" disabled placeholder="Backend reset endpoint not connected yet" />
        </label>
        <button className="button" disabled>SEND RESET LINK</button>
        <Link to="/login">RETURN TO SIGN IN</Link>
      </div>
    </section>
  );
}
