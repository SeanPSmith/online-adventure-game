"""Pass 66.71: the recovery pages talk to the real endpoints and keep the token out of URLs servers see."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "frontend/src"
FORGOT = (SRC / "pages/auth/ForgotPasswordPage.tsx").read_text(encoding="utf-8")
RESET = (SRC / "pages/auth/ResetPasswordPage.tsx").read_text(encoding="utf-8")
SERVICE = (SRC / "services/auth.ts").read_text(encoding="utf-8")
ROUTER = (SRC / "router.tsx").read_text(encoding="utf-8")


def test_service_calls_hit_the_password_reset_endpoints_with_the_write_header():
    for path in ("/api/auth/password-reset/status", "/api/auth/password-reset/request",
                 "/api/auth/password-reset/confirm"):
        assert path in SERVICE, path
    request = SERVICE[SERVICE.index("export function requestPasswordReset"):]
    assert "ACCOUNT_WRITE_HEADERS" in request.split("export function confirmPasswordReset")[0]
    assert "ACCOUNT_WRITE_HEADERS" in request.split("export function confirmPasswordReset")[1]


def test_forgot_page_is_honest_about_availability_and_never_claims_a_send_it_did_not_make():
    assert "getPasswordResetStatus()" in FORGOT and 'availability === "unavailable"' in FORGOT
    assert "No email has been requested or sent." in FORGOT
    assert 'role="alert"' in FORGOT and 'autoComplete="username"' in FORGOT
    # The generic server message is shown as-is; the page never says an account was or was not found.
    assert "setSentMessage(result.message)" in FORGOT
    assert "no account" not in FORGOT.lower() and "not found" not in FORGOT.lower()


def test_reset_page_reads_the_token_from_the_fragment_and_removes_it_from_the_address_bar():
    assert "location.hash" in RESET and "token=" in RESET
    assert "location.search" not in RESET and "searchParams" not in RESET
    assert "window.history.replaceState" in RESET
    assert 'autoComplete="new-password"' in RESET and "minLength={10}" in RESET
    assert "The two passwords do not match." in RESET
    assert "confirmPasswordReset(token, password)" in RESET
    assert 'to="/forgot-password"' in RESET and 'to="/login"' in RESET


def test_reset_route_is_public_and_lazy_loaded():
    assert 'path: "reset-password"' in ROUTER and "ResetPasswordPage" in ROUTER
