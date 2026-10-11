import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { Construct } from "constructs";
import { resourcePrefix } from "./naming";
import * as path from "node:path";

export interface NarratorStackProps extends cdk.StackProps {
  readonly projectName: string;
  readonly environmentName: string;
  readonly vpc: ec2.IVpc;
  readonly backendSecurityGroup: ec2.ISecurityGroup;
}

/** Created only by an explicit TOT_ENABLE_NARRATOR_STACK=1 CDK deploy. */
export class NarratorStack extends cdk.Stack {
  public readonly instance: ec2.Instance;
  public readonly audioBucket: s3.Bucket;
  public readonly activityTable: dynamodb.Table;

  public constructor(scope: Construct, id: string, props: NarratorStackProps) {
    super(scope, id, props);
    const prefix = resourcePrefix(props.projectName, props.environmentName);
    const sg = new ec2.SecurityGroup(this, "NarratorSecurityGroup", {
      vpc: props.vpc,
      description: "Private Story Time inference: only ECS backend may connect",
      allowAllOutbound: true,
    });
    sg.addIngressRule(props.backendSecurityGroup, ec2.Port.tcp(8880), "Backend-only speech access");

    const role = new iam.Role(this, "NarratorInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
    });
    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "set -euxo pipefail",
      // Amazon Linux 2023 ships curl-minimal. Installing full curl alongside it
      // causes dnf to fail before Docker can be configured (cloud-init scripts-user).
      "dnf install -y docker",
      "systemctl enable --now docker",
      // Pin digest in production after benchmark/acceptance; do not add a host bind mount
      // that would shadow the image's already-baked model files.
      "docker pull ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.0",
      "docker rm -f story-time || true",
      "docker run -d --name story-time --restart unless-stopped --memory=3g --cpus=2 --pids-limit=512 -p 8880:8880 -e API_LOG_LEVEL=WARNING ghcr.io/remsky/kokoro-fastapi-cpu:v0.8.0",
    );
    this.instance = new ec2.Instance(this, "NarratorInstance", {
      instanceName: `${prefix}-story-time`,
      vpc: props.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      associatePublicIpAddress: true, // Outbound image pull / SSM, without NAT fees.
      instanceType: new ec2.InstanceType("t3a.medium"),
      creditSpecification: ec2.CpuCredits.STANDARD,
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.X86_64 }),
      securityGroup: sg,
      role,
      userData,
      requireImdsv2: true,
      blockDevices: [{ deviceName: "/dev/xvda", volume: ec2.BlockDeviceVolume.ebs(30, {
        encrypted: true,
        volumeType: ec2.EbsDeviceVolumeType.GP3,
        deleteOnTermination: true,
      }) }],
    });

    this.audioBucket = new s3.Bucket(this, "AudioCache", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      lifecycleRules: [{ expiration: cdk.Duration.days(30) }],
    });
    this.activityTable = new dynamodb.Table(this, "ActivityTable", {
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expires_at_epoch",
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const watchdog = new lambda.Function(this, "NarratorWatchdog", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "watchdog.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../narrator")),
      timeout: cdk.Duration.seconds(30),
      environment: {
        INSTANCE_ID: this.instance.instanceId,
        TABLE_NAME: this.activityTable.tableName,
        IDLE_SECONDS: "1800",
        MAX_MONTHLY_SECONDS: "216000", // 60 hours. Approximate, checked every five minutes.
      },
    });
    watchdog.addToRolePolicy(new iam.PolicyStatement({
      actions: ["ec2:DescribeInstances"], resources: ["*"],
    }));
    watchdog.addToRolePolicy(new iam.PolicyStatement({
      actions: ["ec2:StopInstances"], resources: [this.formatArn({
        service: "ec2", resource: "instance", resourceName: this.instance.instanceId,
      })],
    }));
    this.activityTable.grantReadWriteData(watchdog);
    new events.Rule(this, "WatchdogSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(watchdog)],
    });
    cdk.Tags.of(this).add("Project", props.projectName);
    cdk.Tags.of(this).add("Environment", props.environmentName);
    cdk.Tags.of(this).add("Purpose", "OptionalStoryTime");
    new cdk.CfnOutput(this, "NarratorInstanceId", { value: this.instance.instanceId });
    new cdk.CfnOutput(this, "NarratorPrivateUrl", { value: `http://${this.instance.instancePrivateIp}:8880` });
    new cdk.CfnOutput(this, "NarratorCacheBucket", { value: this.audioBucket.bucketName });
    new cdk.CfnOutput(this, "NarratorActivityTable", { value: this.activityTable.tableName });
  }
}
