# Pass 66.71 — Password recovery by email

Closes the launch blocker "password recovery is not connected". Login, registration, sessions, gameplay,
dice, HP/XP, sockets, narration and persistence are unchanged.

## Flow
1. `/forgot-password` asks the server whether recovery is available (`GET /api/auth/password-reset/status`).
2. The player enters an email or username. `POST /api/auth/password-reset/request` always answers with the
   same message; lookup, token creation and the email run after the response, so neither the reply nor
   its timing reveals whether an account exists.
3. The email links to `/reset-password#token=...`. The token is in the fragment, which browsers never send
   to servers or in Referer, and the page removes it from the address bar on load.
4. `POST /api/auth/password-reset/confirm` validates the new password (10+ characters), spends the token
   atomically, changes the password, signs the account out of every session and retires other tokens.

## Guarantees (all covered by `tests/auth/test_pass66_71_password_reset.py`)
- 256-bit random tokens, stored only as SHA-256 hashes, single use, 30-minute lifetime.
- 60-second per-account cooldown (no inbox flooding); a newer link retires the older one.
- A weak password does not spend the token; inactive accounts and unknown identifiers receive no email.
- Requests need the same `X-TOT-Account-Request` header and same-site check as other account writes.
- Mail failures are logged and never surfaced to the caller.

## Operations
Uses the existing SES wiring: `TOT_NOTIFICATION_EMAIL_FROM` (verified SES sender) and `TOT_PUBLIC_BASE_URL`
(for example `https://onlinetextadventure.com`). If either is empty the feature reports itself unavailable
and sends nothing. The backend IAM role already allows `ses:SendEmail`. A new table, `password_reset_tokens`,
is created automatically at startup (`CREATE TABLE IF NOT EXISTS`, SQLite and PostgreSQL compatible).

## Verify after deploy
Request a reset for a real test account, confirm the email arrives from the verified sender, follow the link,
set a new password, confirm old sessions are signed out and the old link no longer works. SES sandbox mode
only delivers to verified addresses; production access must be granted for real players.
