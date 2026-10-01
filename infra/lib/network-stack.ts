import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { resourcePrefix } from "./naming";

export interface NetworkStackProps extends cdk.StackProps {
  readonly projectName: string;
  readonly environmentName: string;
}

export class NetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly albSecurityGroup: ec2.SecurityGroup;
  public readonly backendSecurityGroup: ec2.SecurityGroup;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;

  public constructor(scope: Construct, id: string, props: NetworkStackProps) {
    super(scope, id, props);

    const prefix = resourcePrefix(props.projectName, props.environmentName);

    // Staging deliberately uses no NAT Gateway. The future Fargate service
    // runs in public subnets with a public IP but accepts inbound traffic only
    // from the ALB security group. Database resources stay isolated/private.
    this.vpc = new ec2.Vpc(this, "Vpc", {
      vpcName: `${prefix}-vpc`,
      ipAddresses: ec2.IpAddresses.cidr("10.42.0.0/16"),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          name: "public-app",
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: "isolated-data",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 24,
        },
      ],
    });

    this.albSecurityGroup = new ec2.SecurityGroup(this, "AlbSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `${prefix}-alb-sg`,
      description: "Public ALB ingress for the staging web/API edge.",
      allowAllOutbound: true,
    });

    this.albSecurityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "HTTP ingress; CloudFront-only restriction is added before production cutover.",
    );

    this.backendSecurityGroup = new ec2.SecurityGroup(this, "BackendSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `${prefix}-backend-sg`,
      description: "Python/FastAPI backend; ingress only from the ALB.",
      allowAllOutbound: true,
    });

    this.backendSecurityGroup.addIngressRule(
      this.albSecurityGroup,
      ec2.Port.tcp(8000),
      "ALB to FastAPI/Socket.IO.",
    );

    this.databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc: this.vpc,
      securityGroupName: `${prefix}-database-sg`,
      description: "PostgreSQL ingress only from the backend service.",
      allowAllOutbound: false,
    });

    this.databaseSecurityGroup.addIngressRule(
      this.backendSecurityGroup,
      ec2.Port.tcp(5432),
      "Backend to PostgreSQL.",
    );

    cdk.Tags.of(this).add("Project", props.projectName);
    cdk.Tags.of(this).add("Environment", props.environmentName);
    cdk.Tags.of(this).add("ManagedBy", "AWS-CDK");

    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
    });
  }
}
