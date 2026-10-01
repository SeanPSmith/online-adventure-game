# Frontend Build Hotfix 01

This patch addresses the first production React bundle failure after AWS Infrastructure Pass 03.

## Fixes

- Restores Vite ambient client declarations so CSS side-effect imports and `import.meta.env` type-check under the production TypeScript build.
- Removes the unnecessary `allowImportingTsExtensions` option from the Node/Vite TypeScript project, eliminating TS5096 without changing runtime imports.
- Keeps the typed Socket.IO event contract while adapting to the installed `socket.io-client` factory typings, whose `io()` export accepts no generic type arguments.
- Pins the AWS CDK CLI invocation in the frontend diff/deploy scripts to the known-good `aws-cdk@2.1143.0`, avoiding accidental resolution of the unrelated/nonexistent `cdk@2.1144.0` path.

## Apply

Overlay this archive onto the project root.

Append `PROJECT_CHANGELOG_APPEND.md` to `docs/PROJECT_CHANGELOG.md`.

Then run from the project root:

```bash
./scripts/aws/deploy-frontend-assets.sh
```

Do not redeploy the frontend CloudFormation stack first; it already deployed successfully. If the asset build/upload completes, run:

```bash
./scripts/aws/frontend-smoke.sh
```
