## 2026-09-29 — AWS Infrastructure Pass 01

### AWS foundation
- Added an AWS CDK v2 TypeScript infrastructure project under `infra/`.
- Added a two-AZ staging VPC with public application subnets and isolated data subnets.
- Staging networking intentionally uses zero NAT Gateways to avoid idle NAT cost.
- Added explicit ALB -> backend -> database security-group boundaries.

### Remote container build
- Added a private versioned S3 build-source bucket.
- Added an ECR repository for the Python backend.
- Added a privileged AWS CodeBuild project that builds Linux/amd64 backend images remotely so the development Mac does not require Docker Desktop.
- Added source packaging, upload, build-start, AWS identity-check, synthesis, and foundation-deployment scripts.
- Added a production-style Python Dockerfile using `uvicorn app.main:app` with reload disabled.
- Added `requirements-aws.txt` so the cloud image explicitly installs the OpenAI Python SDK used by the generation provider.

### Runtime scaffold
- Added disabled CDK scaffolds for PostgreSQL/RDS, ECS/Fargate + ALB, and S3/CloudFront.
- Runtime stacks remain disabled until SQLite persistence is migrated to PostgreSQL and validated.
- Preserved the one-task staging topology for the current in-memory room/session architecture.

### Safety
- No local SQLite database is copied into the backend build artifact or Docker image.
- No secrets or OpenAI API keys are embedded in CDK, Docker, buildspec, or React.
- AWS deployment scripts verify the staging AWS account before foundation deployment.
