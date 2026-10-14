import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as logs from "aws-cdk-lib/aws-logs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as rds from "aws-cdk-lib/aws-rds";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { resourcePrefix } from "./naming";

export interface BackendStackProps extends cdk.StackProps {
  readonly projectName: string;
  readonly environmentName: string;
  readonly vpc: ec2.IVpc;
  readonly albSecurityGroup: ec2.ISecurityGroup;
  readonly backendSecurityGroup: ec2.ISecurityGroup;
  readonly repository: ecr.IRepository;
  readonly imageTag: string;
  readonly cpu: number;
  readonly memoryLimitMiB: number;
  readonly desiredCount: number;
  readonly cookieSecure: boolean;
  readonly adminUsernames: readonly string[];
  readonly database: rds.IDatabaseInstance;
  readonly databaseSecret: secretsmanager.ISecret;
  readonly openAiApiKeySecret: secretsmanager.ISecret;
  readonly notificationEmailFrom: string;
  readonly notificationPublicBaseUrl: string;
  readonly notificationSmsEnabled: boolean;
  readonly vapidContact: string;
  readonly kokoroBaseUrl: string;
  readonly narratorInstance?: ec2.IInstance;
  readonly narratorActivityTable?: dynamodb.ITable;
  readonly narratorCacheBucket?: s3.IBucket;
  readonly kokoroCacheVersion?: string;
  readonly kokoroMaxMonthlySeconds?: number;
}

export class BackendStack extends cdk.Stack {
  public readonly loadBalancer: elbv2.ApplicationLoadBalancer;
  public readonly service: ecs.FargateService;

  public constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    const prefix = resourcePrefix(props.projectName, props.environmentName);

    const cluster = new ecs.Cluster(this, "Cluster", {
      clusterName: `${prefix}-cluster`,
      vpc: props.vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    const logGroup = new logs.LogGroup(this, "BackendLogs", {
      logGroupName: `/adventure-platform/${props.environmentName}/backend`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Completed-story audio stays private and outlives the 30-day narrator cache.
    // Unfinished room uploads expire after 30 days. Only completed/* is retained.
    const narrationArchive = new s3.Bucket(this, "NarrationArchive", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
      lifecycleRules: [{ prefix: "pending/", expiration: cdk.Duration.days(30) }],
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "TaskDefinition", {
      family: `${prefix}-backend`,
      cpu: props.cpu,
      memoryLimitMiB: props.memoryLimitMiB,
      runtimePlatform: {
        cpuArchitecture: ecs.CpuArchitecture.X86_64,
        operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
      },
    });

    const container = taskDefinition.addContainer("Backend", {
      containerName: "backend",
      image: ecs.ContainerImage.fromEcrRepository(props.repository, props.imageTag),
      logging: ecs.LogDrivers.awsLogs({
        logGroup,
        streamPrefix: "python",
      }),
      environment: {
        APP_ENV: props.environmentName,
        AUTH_COOKIE_SECURE: props.cookieSecure ? "true" : "false",
        PYTHONUNBUFFERED: "1",
        DB_BACKEND: "postgres",
        DB_HOST: props.database.dbInstanceEndpointAddress,
        DB_PORT: props.database.dbInstanceEndpointPort,
        DB_NAME: "adventure_platform",
        TOT_ADMIN_USERNAMES: props.adminUsernames.join(","),
        TOT_SMS_ENABLED: props.notificationSmsEnabled ? "true" : "false",
        TOT_NOTIFICATION_EMAIL_FROM: props.notificationEmailFrom,
        TOT_PUBLIC_BASE_URL: props.notificationPublicBaseUrl,
        TOT_VAPID_CONTACT: props.vapidContact,
        KOKORO_BASE_URL: props.kokoroBaseUrl,
        KOKORO_CACHE_VERSION: props.kokoroCacheVersion ?? "kokoro-cpu-v0.8.0",
        KOKORO_MAX_MONTHLY_SECONDS: String(props.kokoroMaxMonthlySeconds ?? 216000),
        KOKORO_INSTANCE_ID: props.narratorInstance?.instanceId ?? "",
        KOKORO_ACTIVITY_TABLE: props.narratorActivityTable?.tableName ?? "",
        KOKORO_CACHE_BUCKET: props.narratorCacheBucket?.bucketName ?? "",
        KOKORO_ARCHIVE_BUCKET: narrationArchive.bucketName,
      },
      secrets: {
        DB_USER: ecs.Secret.fromSecretsManager(props.databaseSecret, "username"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(props.databaseSecret, "password"),
        OPENAI_API_KEY: ecs.Secret.fromSecretsManager(props.openAiApiKeySecret),
      },
      healthCheck: {
        command: [
          "CMD-SHELL",
          "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)\" || exit 1",
        ],
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
        retries: 3,
        startPeriod: cdk.Duration.seconds(45),
      },
    });

    container.addPortMappings({
      containerPort: 8000,
      protocol: ecs.Protocol.TCP,
    });

    narrationArchive.grantReadWrite(taskDefinition.taskRole);

    if (props.narratorInstance && props.narratorActivityTable && props.narratorCacheBucket) {
      taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ["ec2:StartInstances", "ec2:DescribeInstances"],
        resources: [this.formatArn({
          service: "ec2", resource: "instance", resourceName: props.narratorInstance.instanceId,
        })],
      }));
      // EC2 DescribeInstances only supports resource="*" in IAM.
      taskDefinition.taskRole.addToPrincipalPolicy(new iam.PolicyStatement({
        actions: ["ec2:DescribeInstances"], resources: ["*"],
      }));
      props.narratorActivityTable.grantReadWriteData(taskDefinition.taskRole);
      props.narratorCacheBucket.grantReadWrite(taskDefinition.taskRole);
    }

    if (props.notificationSmsEnabled) {
      taskDefinition.taskRole.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: ["sns:Publish"],
          resources: ["*"],
        }),
      );
    }

    if (props.notificationEmailFrom) {
      taskDefinition.taskRole.addToPrincipalPolicy(
        new iam.PolicyStatement({
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"],
        }),
      );
    }

    this.service = new ecs.FargateService(this, "Service", {
      serviceName: `${prefix}-backend`,
      cluster,
      taskDefinition,
      desiredCount: props.desiredCount,
      assignPublicIp: true,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      securityGroups: [props.backendSecurityGroup],
      enableExecuteCommand: false,
      circuitBreaker: {
        rollback: true,
      },
      minHealthyPercent: 0,
      maxHealthyPercent: 100,
      healthCheckGracePeriod: cdk.Duration.seconds(90),
    });

    this.loadBalancer = new elbv2.ApplicationLoadBalancer(this, "LoadBalancer", {
      loadBalancerName: `${prefix}-alb`,
      vpc: props.vpc,
      internetFacing: true,
      securityGroup: props.albSecurityGroup,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      idleTimeout: cdk.Duration.minutes(5),
    });

    const listener = this.loadBalancer.addListener("HttpListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      open: false,
    });

    listener.addTargets("BackendTarget", {
      port: 8000,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [
        this.service.loadBalancerTarget({
          containerName: "backend",
          containerPort: 8000,
        }),
      ],
      healthCheck: {
        path: "/health",
        healthyHttpCodes: "200",
        interval: cdk.Duration.seconds(30),
        timeout: cdk.Duration.seconds(5),
      },
      deregistrationDelay: cdk.Duration.seconds(30),
    });

    cdk.Tags.of(this).add("Project", props.projectName);
    cdk.Tags.of(this).add("Environment", props.environmentName);
    cdk.Tags.of(this).add("ManagedBy", "AWS-CDK");

    new cdk.CfnOutput(this, "BackendAlbDnsName", {
      value: this.loadBalancer.loadBalancerDnsName,
    });

    new cdk.CfnOutput(this, "BackendHealthUrl", {
      value: `http://${this.loadBalancer.loadBalancerDnsName}/health`,
    });

    new cdk.CfnOutput(this, "BackendClusterName", {
      value: cluster.clusterName,
    });

    new cdk.CfnOutput(this, "BackendServiceName", {
      value: this.service.serviceName,
    });

    new cdk.CfnOutput(this, "BackendLogGroupName", {
      value: logGroup.logGroupName,
    });
  }
}
