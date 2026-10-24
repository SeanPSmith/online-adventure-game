# Quillairo Pass 66.30 — Author Studio access repair

## Incident

The Writer's Desk called React Router's `<Link to="/author-console">` even though `/author-console` is served as a separate authenticated HTML application by the FastAPI backend/CloudFront behavior. React intercepted the click instead of requesting the backend document. The backend also redirected unauthenticated or unauthorized requests silently to `/`, making missing permissions indistinguishable from a broken page.

## Resolution

- Use a real `<a href="/author-console">` for full-page navigation from Writer's Desk.
- Treat existing `admin` as author-capable in the Author Studio server gate and in visible navigation, unless explicit `author_denied` is present. No public access is added; server authorization still controls read/write APIs.
- Redirect signed-out users to `/login?returnTo=%2Fauthor-console` and honor only this whitelisted query-based return destination after signing in.
- Direct authenticated accounts without author permissions to `/account/author?access=required`, where the Writer's Desk explains that an administrator must grant access.
- Continue granting a non-admin tester access through the existing **Admin → Users → GRANT AUTHOR** workflow (`PUT /api/auth/admin/users/{user_id}/author-access`). Never auto-grant ordinary accounts.
- Keep the admin user row consistent when admin implies author access even if an older admin account lacks a stored `author` permission.

## What did not change

Author Studio document storage, autosave, AI assistant, publishing, author-write CSRF header, API auth, cookie handling, and private document content remain unchanged. The CloudFront `author-console*` and `static/author/*` backend behaviors remain in effect and need no infrastructure update.

## Check after release

1. Signed-out `/author-console` should send you to sign-in, rather than the public home.
2. Signed-in admin (including admin-only older account) and signed-in author should open the Studio and fetch `/api/author/me` successfully.
3. Signed-in non-author should see an explicit Access Required message from Writer's Desk.
4. Administrators can grant non-admin users author access in the existing Control Room Users tab.
5. Verify Writer's Desk **Enter the Author Studio** loads the backend document (not React's 404), and test a harmless draft autosave.

## Validation

Local focused tests: 34 passed, including backend TestClient route authorization/redirects, explicit denial, prior public login contracts, author wizard contracts, and admin role tests. All seven modified TypeScript/TSX files passed TypeScript syntax transpilation. A full production build and live authenticated browser check were not available in the packaging environment; `release-staging.sh` remains the authority for staging deployment.
