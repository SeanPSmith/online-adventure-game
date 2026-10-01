# Adventure Platform AWS Architecture

## Current staging target

```text
React/Vite browser client
        |
        v
CloudFront (future runtime pass)
   |               |
   v               v
private S3      /api + /socket.io
                   |
                   v
                  ALB
                   |
                   v
             ECS Fargate (1 task)
             FastAPI + Socket.IO
                   |
                   v
             PostgreSQL / RDS
```

Backend container images are built remotely:

```text
Mac source -> S3 source artifact -> CodeBuild -> ECR -> ECS/Fargate
```

The Mac does not need Docker Desktop.

## Pass 01 safety boundary

Only these stacks are enabled:

- `AdventurePlatformNetwork-staging`
- `AdventurePlatformBuild-staging`

They establish:

- a two-AZ VPC with public application and isolated data subnets
- no NAT Gateway
- ALB/backend/database security-group boundaries for later stacks
- a private versioned S3 source bucket
- an ECR backend repository
- a privileged CodeBuild project that can build Linux/amd64 Docker images remotely

The following stacks exist in code but are disabled in `infra/config/staging.ts`:

- PostgreSQL/RDS
- ECS/Fargate + ALB
- S3/CloudFront web runtime

Do not enable them until the SQLite -> PostgreSQL migration and backend runtime preflight are complete.

## State ownership

React remains presentation only. Python remains authoritative for game state and rules.

AWS infrastructure must not move gameplay rules into the client.
