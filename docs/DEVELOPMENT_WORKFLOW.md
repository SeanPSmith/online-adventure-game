# Tales of Two — Development Workflow

The project deliberately keeps validation, source packaging, and AWS deployment
as separate operations.

For a fresh Python development environment, install `requirements-dev.txt`.

## Normal local validation

Run this before a meaningful commit or deployment:

```bash
./scripts/check-project.sh
```

It runs the Python regression suite, syntax-checks the legacy browser JavaScript,
builds the React app, and compiles the AWS CDK TypeScript.

The frontend and infrastructure both require Node 22.22.0 or newer. The repo
includes `.nvmrc`, so an `nvm` user can switch with:

```bash
nvm use
```

## Git / GitHub

Typical change flow:

```bash
git status
git add .
git commit -m "Describe the change"
git push
```

GitHub Actions runs the backend tests, React production build, legacy JavaScript
syntax checks, and CDK compile automatically on pushes and pull requests.

CI does not deploy anything to AWS.

## AWS staging deployment

The existing AWS deployment path remains authoritative:

```bash
./scripts/aws/deploy-game-staging.sh
```

Useful targeted variants:

```bash
./scripts/aws/deploy-game-staging.sh --backend-only
./scripts/aws/deploy-game-staging.sh --frontend-only
```

Infrastructure/CDK changes remain explicit and use the dedicated scripts under
`scripts/aws/` rather than being hidden inside the normal code deploy.

## Review package

To create a small source-only archive for code review or ChatGPT:

```bash
./scripts/package-for-review.sh
```

The archive is written to `_packages/` and excludes dependencies, build output,
backups, caches, local databases, logs, Git history, and secrets.

## CI/CD progression

Current state: CI only. Automatic AWS deployment is intentionally disabled.

When staging deployment is moved into GitHub Actions, use GitHub OIDC with a
restricted AWS deployment role rather than storing long-lived AWS access keys in
GitHub secrets.
