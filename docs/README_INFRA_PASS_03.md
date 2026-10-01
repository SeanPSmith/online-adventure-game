# AWS Infrastructure Pass 03 — Public React Edge

This pass turns the already-running AWS backend into a single public HTTPS staging application.

## What changes

### React/static frontend
- Creates a private S3 bucket.
- Uses CloudFront Origin Access Control (OAC); the bucket is not public.
- Serves the existing React/Vite production build through CloudFront HTTPS.
- Keeps the existing React source architecture intact. No game logic moves into React.

### Same-origin backend routing
CloudFront routes:

- `/*` -> private S3 React bundle
- `/api/*` -> existing public ALB -> ECS/Fargate Python backend
- `/socket.io/*` -> existing public ALB -> ECS/Fargate Socket.IO backend
- `/health` -> existing public ALB -> backend health endpoint

API and Socket.IO behaviors:
- cache disabled
- all HTTP methods allowed where required
- viewer cookies forwarded
- viewer query strings forwarded
- viewer headers forwarded except `Host`
- WebSocket/Socket.IO upgrade headers therefore reach the origin

### SPA routing
A CloudFront Function rewrites extensionless frontend routes such as `/login`, `/heroes`, and `/adventure/...` to `/index.html`.

This intentionally replaces the earlier distribution-wide 403/404 fallback design. API 404s must remain API 404s instead of being transformed into React HTML.

### Session security
`AUTH_COOKIE_SECURE` flips from `false` to `true` because the browser-facing origin is now CloudFront HTTPS.

The ALB remains HTTP-only for this staging pass. CloudFront is the browser TLS boundary.

### Production bundle
`frontend/vite.config.ts` disables production source maps. Local Vite development and its `/api` + `/socket.io` proxy remain unchanged.

## Deliberately not included
- Cognito
- custom domain / Route53
- ACM custom certificate
- WAF
- Redis / multi-task realtime coordination
- Fargate sleep/wake automation
- Aurora Serverless
- closing public registration
- author/admin role management

Those remain later passes. The purpose here is one public URL that the existing two-player game can actually use.

## Apply

Overlay this ZIP onto the project root:

`/Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root`

Append `PROJECT_CHANGELOG_APPEND.md` to `docs/PROJECT_CHANGELOG.md` rather than replacing the existing changelog.

## 1. Inspect the infrastructure diff

From the project root:

```bash
./scripts/aws/frontend-diff.sh
```

Expected meaningful changes:
- Backend stack: ECS task definition/environment changes because `AUTH_COOKIE_SECURE=true`; service rolls to the new task definition.
- Frontend stack: new private S3 bucket, OAC/bucket policy, CloudFront Function, CloudFront distribution, and related custom-resource/IAM resources needed by `autoDeleteObjects`.

The Data stack should not be recreated.

## 2. Deploy Backend secure-cookie change + Frontend stack

```bash
./scripts/aws/deploy-frontend-stack.sh
```

CloudFront provisioning can take several minutes.

## 3. Build and upload React

```bash
./scripts/aws/deploy-frontend-assets.sh
```

This:
1. runs the existing `frontend` production build,
2. resolves the S3 bucket from CloudFormation outputs,
3. syncs `frontend/dist`,
4. sets `index.html` to revalidate,
5. invalidates `/*`,
6. prints the public CloudFront URL.

No `VITE_API_BASE` is needed in AWS. The React API client already defaults to relative URLs and Socket.IO already defaults to the current origin, so CloudFront provides the same-origin boundary.

## 4. Automated edge smoke test

```bash
./scripts/aws/frontend-smoke.sh
```

It verifies:
- React root through CloudFront
- SPA deep-link rewrite (`/login`)
- `/health` through CloudFront -> ALB -> Fargate
- Socket.IO Engine.IO polling handshake through CloudFront

## 5. Manual application test

Open the printed CloudFront URL in a normal browser.

Verify:
1. register/login
2. refresh and remain logged in
3. create a Hero
4. create or resume an adventure
5. second browser/device joins
6. both players lock a choice
7. Director generation completes
8. intermission runs
9. dice/result theater runs
10. QTE works
11. refresh/reconnect restores state
12. complete/resume history behaves correctly

For the real remote test, use two devices on different networks if possible.

## Useful status command

```bash
./scripts/aws/frontend-status.sh
```

## If something fails

Backend/ECS diagnostics remain:

```bash
./scripts/aws/diagnose-backend.sh
```

For a frontend routing issue, capture:

```bash
curl -i "$(aws cloudformation describe-stacks \
  --stack-name AdventurePlatformFrontend-staging \
  --region us-east-1 \
  --profile adventure-staging \
  --query \"Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue | [0]\" \
  --output text)/health"
```

Do not make console-side infrastructure edits unless we intentionally reconcile them back into CDK.
