## 2026-09-30 — AWS Infrastructure Pass 03: Public React Edge

### Infrastructure
- Enabled `AdventurePlatformFrontend-staging` after successful Data/Backend staging deployment.
- Added a private S3 React origin protected by CloudFront Origin Access Control (OAC).
- Added a CloudFront HTTPS distribution as the browser-facing staging origin.
- Added same-origin CloudFront routing for `/api/*`, `/socket.io/*`, and `/health` to the existing ALB/Fargate backend.
- Disabled caching for API and Socket.IO behaviors and forward viewer cookies, query strings, and headers except `Host` to preserve session auth and Socket.IO/WebSocket transport data.
- Added a CloudFront Function SPA rewrite for extensionless React routes instead of distribution-wide 403/404 rewrites, so backend 404 responses remain backend responses.
- Limited the staging distribution to CloudFront Price Class 100.

### Auth/session
- Flipped staging `AUTH_COOKIE_SECURE` from `false` to `true` now that browsers reach the application over CloudFront HTTPS.
- Preserved the existing Python/Postgres HttpOnly session system; Cognito is not introduced in this pass.

### Frontend deployment
- Kept React API and Socket.IO networking same-origin; no cloud-specific API URL is compiled into the SPA.
- Disabled production Vite source maps for the public staging bundle.
- Added `frontend-diff.sh` for the Backend + Frontend CDK preflight.
- Added `deploy-frontend-stack.sh` for the secure-cookie backend rollout plus frontend stack deployment.
- Added `deploy-frontend-assets.sh` to build React, sync `dist` to the generated S3 bucket, set `index.html` revalidation metadata, and invalidate CloudFront.
- Added `frontend-smoke.sh` to verify static React delivery, SPA deep links, backend health routing, and Socket.IO polling through CloudFront.
- Added `frontend-status.sh` for CloudFormation output/status inspection.

### Architectural contract
- Python remains authoritative for auth, rooms, game state, dice/checks, progression, persistence, QTEs, and Director orchestration.
- React remains presentation/state-of-view only.
- The ALB remains the backend origin for staging; custom domain, Cognito, sleep/wake infrastructure, Aurora Serverless, Redis/multi-task scaling, and stricter private-origin hardening remain future work.
