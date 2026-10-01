## 2026-09-30 — AWS Frontend Production Build Hotfix 01

### Practical changes
- Added the Vite client ambient type reference required by the production TypeScript build for CSS imports and `import.meta.env`.
- Removed the unused `allowImportingTsExtensions` Node compiler option that failed the referenced `tsc -b` build.
- Adapted Socket.IO client construction to the installed `socket.io-client` factory typings while retaining the strongly typed server/client event `Socket` contract.
- Pinned the frontend AWS CDK diff/deploy scripts to the known-good `aws-cdk@2.1143.0` CLI invocation so they no longer depend on ambiguous `npx cdk` package resolution.

### Result
- No Python game logic, Director logic, persistence schema, authoritative game state, React gameplay behavior, or AWS data resources are changed by this patch.
- The already-created CloudFront/S3/Fargate/RDS infrastructure remains intact; this patch only unblocks the React production bundle and future frontend CDK command execution.
