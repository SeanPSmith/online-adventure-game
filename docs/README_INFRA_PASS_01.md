# AWS Infrastructure Pass 01

This is the first safe AWS deployment scaffold for the Adventure/Simulore project.

It does **not** cut the game over to AWS yet.

## What this pass creates

When deployed, only two stacks are active:

1. `AdventurePlatformNetwork-staging`
   - VPC
   - two public application subnets
   - two isolated data subnets
   - no NAT Gateway
   - ALB/backend/database security-group boundaries

2. `AdventurePlatformBuild-staging`
   - private versioned S3 source bucket
   - ECR backend repository
   - CodeBuild project capable of Docker builds

RDS, ECS/Fargate, ALB runtime, CloudFront, and the production React site are already scaffolded in TypeScript but are disabled by configuration for Pass 01.

## Why runtime deployment is disabled

The current application stores auth, Heroes, game state, generation state, and authoring data in `data/game_state.sqlite3` through multiple SQLite stores.

Fargate task-local disk is not the durable persistence layer we want. The runtime stacks stay disabled until the persistence boundary is migrated to PostgreSQL.

## Install into the project

Copy the contents of this patch into the project root:

```text
/Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root
```

It adds only new infrastructure/deployment files. It does not replace gameplay code.

## Step 1 - install infrastructure dependencies

Normal Mac terminal, not the Python venv:

```bash
cd /Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root/infra
npm install
```

## Step 2 - typecheck + synth

```bash
cd /Users/prodigitalvr/PERSONAL/OnlineAdventureGame/root
./scripts/aws/synth.sh
```

This should list/synthesize the Network and Build stacks. No application infrastructure is deployed by synth.

## Step 3 - inspect the deployment

```bash
cd infra
npx cdk diff \
  AdventurePlatformNetwork-staging \
  AdventurePlatformBuild-staging \
  --profile adventure-staging
```

Review the diff before deploying.

## Step 4 - deploy the foundation

From the project root:

```bash
./scripts/aws/deploy-foundation.sh
```

This verifies that the CLI is still pointed at staging account `120737642380`, typechecks the CDK project, then deploys Network + Build.

## Step 5 - package the Python backend

The backend source archive deliberately excludes `data/*.sqlite3`, `.venv`, frontend, backups, and tests.

```bash
./scripts/aws/package-backend.sh
```

It creates:

```text
.aws-build/backend-source.zip
```

## Step 6 - upload source to the remote builder

```bash
./scripts/aws/upload-backend-source.sh
```

## Step 7 - remote Docker build

```bash
./scripts/aws/start-backend-build.sh
```

CodeBuild builds the image inside AWS and pushes two ECR tags:

- `staging-current`
- `build-<CodeBuild build number>`

This verifies that the Python backend can be containerized without requiring Docker Desktop on the Mac.

## Important runtime dependency note

`requirements-aws.txt` layers the current `requirements.txt` plus the OpenAI Python SDK required by `app/generation/openai_provider.py`.

No OpenAI key is placed in the image or source archive.

## What not to do yet

Do not change these flags to `true` yet:

```ts
enableDataStack: false
enableBackendStack: false
enableFrontendStack: false
```

The next infrastructure/application pass is the persistence migration boundary:

```text
SQLite stores
    -> shared database abstraction
    -> local SQLite implementation retained for tests/dev
    -> PostgreSQL implementation for AWS
```

After that passes the full game test suite, we enable RDS, ECS/Fargate, ALB, and CloudFront in that order.
