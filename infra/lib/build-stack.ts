import * as cdk from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as iam from "aws-cdk-lib/aws-iam";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { resourcePrefix } from "./naming";

export interface BuildStackProps extends cdk.StackProps {
  readonly projectName: string;
  readonly environmentName: string;
  readonly backendImageTag: string;
}

export class BuildStack extends cdk.Stack {
  public readonly repository: ecr.Repository;
  public readonly sourceBucket: s3.Bucket;
  public readonly backendBuildProject: codebuild.Project;

  public constructor(scope: Construct, id: string, props: BuildStackProps) {
    super(scope, id, props);

    const prefix = resourcePrefix(props.projectName, props.environmentName);

    this.repository = new ecr.Repository(this, "BackendRepository", {
      repositoryName: `${prefix}-backend`,
      imageScanOnPush: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      emptyOnDelete: true,
      lifecycleRules: [
        {
          description: "Keep the most recent staging images.",
          maxImageCount: 12,
        },
      ],
    });

    this.sourceBucket = new s3.Bucket(this, "BuildSourceBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.backendBuildProject = new codebuild.Project(this, "BackendBuildProject", {
      projectName: `${prefix}-backend-build`,
      description: "Remote Docker build for the Python FastAPI/Socket.IO backend.",
      source: codebuild.Source.s3({
        bucket: this.sourceBucket,
        path: "backend/source.zip",
      }),
      buildSpec: codebuild.BuildSpec.fromSourceFilename("buildspec.yml"),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        computeType: codebuild.ComputeType.SMALL,
        privileged: true,
      },
      environmentVariables: {
        ECR_REPOSITORY_URI: {
          value: this.repository.repositoryUri,
        },
        IMAGE_TAG: {
          value: props.backendImageTag,
        },
      },
      timeout: cdk.Duration.minutes(20),
      queuedTimeout: cdk.Duration.minutes(30),
    });

    this.sourceBucket.grantRead(this.backendBuildProject);
    this.repository.grantPullPush(this.backendBuildProject);
    this.backendBuildProject.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ecr:GetAuthorizationToken"],
        resources: ["*"],
      }),
    );

    cdk.Tags.of(this).add("Project", props.projectName);
    cdk.Tags.of(this).add("Environment", props.environmentName);
    cdk.Tags.of(this).add("ManagedBy", "AWS-CDK");

    new cdk.CfnOutput(this, "BackendRepositoryUri", {
      value: this.repository.repositoryUri,
    });

    new cdk.CfnOutput(this, "SourceBucketName", {
      value: this.sourceBucket.bucketName,
    });

    new cdk.CfnOutput(this, "BackendBuildProjectName", {
      value: this.backendBuildProject.projectName,
    });
  }
}
