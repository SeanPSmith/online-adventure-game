import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { resourcePrefix } from "./naming";

export interface DataStackProps extends cdk.StackProps {
  readonly projectName: string;
  readonly environmentName: string;
  readonly vpc: ec2.IVpc;
  readonly databaseSecurityGroup: ec2.ISecurityGroup;
}

export class DataStack extends cdk.Stack {
  public readonly database: rds.DatabaseInstance;
  public readonly databaseSecret: secretsmanager.ISecret;
  public readonly openAiApiKeySecret: secretsmanager.Secret;

  public constructor(scope: Construct, id: string, props: DataStackProps) {
    super(scope, id, props);

    const prefix = resourcePrefix(props.projectName, props.environmentName);

    this.database = new rds.DatabaseInstance(this, "Postgres", {
      databaseName: "adventure_platform",
      instanceIdentifier: `${prefix}-postgres`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      credentials: rds.Credentials.fromGeneratedSecret("adventure_app"),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      storageEncrypted: true,
      multiAz: false,
      publiclyAccessible: false,
      deletionProtection: false,
      backupRetention: cdk.Duration.days(1),
      deleteAutomatedBackups: true,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [props.databaseSecurityGroup],
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    if (!this.database.secret) {
      throw new Error("RDS generated credentials secret was not created.");
    }

    this.databaseSecret = this.database.secret;

    // The initial value is intentionally random and unusable as an OpenAI
    // credential. scripts/aws/set-openai-secret.sh replaces it before the
    // backend is deployed.
    this.openAiApiKeySecret = new secretsmanager.Secret(this, "OpenAiApiKey", {
      secretName: `${prefix}/openai-api-key`,
      description: "OpenAI API key used by the staging Director runtime.",
      generateSecretString: {
        passwordLength: 48,
        excludePunctuation: true,
      },
    });
    this.openAiApiKeySecret.applyRemovalPolicy(cdk.RemovalPolicy.DESTROY);

    cdk.Tags.of(this).add("Project", props.projectName);
    cdk.Tags.of(this).add("Environment", props.environmentName);
    cdk.Tags.of(this).add("ManagedBy", "AWS-CDK");

    new cdk.CfnOutput(this, "DatabaseEndpoint", {
      value: this.database.dbInstanceEndpointAddress,
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: this.databaseSecret.secretArn,
    });

    new cdk.CfnOutput(this, "OpenAiSecretName", {
      value: this.openAiApiKeySecret.secretName,
    });
  }
}
