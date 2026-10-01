import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { resourcePrefix } from "./naming";

export interface FrontendStackProps extends cdk.StackProps {
  readonly projectName: string;
  readonly environmentName: string;
  readonly loadBalancer: elbv2.IApplicationLoadBalancer;
}

export class FrontendStack extends cdk.Stack {
  public readonly siteBucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  public constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props);

    const prefix = resourcePrefix(props.projectName, props.environmentName);

    this.siteBucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const staticOrigin = origins.S3BucketOrigin.withOriginAccessControl(
      this.siteBucket,
    );

    // The ALB remains HTTP-only inside this staging pass. CloudFront is the
    // public HTTPS boundary. The browser therefore sees one secure origin for
    // React, REST, and Socket.IO while CloudFront talks HTTP to the ALB.
    const backendOrigin = new origins.HttpOrigin(
      props.loadBalancer.loadBalancerDnsName,
      {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        httpPort: 80,
        connectionAttempts: 3,
        connectionTimeout: cdk.Duration.seconds(10),
      },
    );

    // API and Socket.IO must never be cached. Forwarding all viewer headers
    // except Host preserves cookies, query strings, Socket.IO transport
    // parameters, and WebSocket upgrade headers while letting CloudFront send
    // the ALB's hostname as Host.
    const dynamicBehavior: cloudfront.AddBehaviorOptions = {
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      compress: true,
    };

    // Do SPA routing at viewer-request time instead of distribution-wide
    // 403/404 error rewrites. That prevents a genuine /api/* 404 from being
    // silently turned into React's index.html.
    const spaRewrite = new cloudfront.Function(this, "SpaRewrite", {
      functionName: `${prefix}-spa-rewrite`,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);

  if (uri === '/' || lastSegment.indexOf('.') === -1) {
    request.uri = '/index.html';
  }

  return request;
}
`),
    });

    this.distribution = new cloudfront.Distribution(this, "Distribution", {
      comment: `${prefix} React + API gateway`,
      defaultRootObject: "index.html",
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin: staticOrigin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [
          {
            function: spaRewrite,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      additionalBehaviors: {
        "api/*": {
          origin: backendOrigin,
          ...dynamicBehavior,
        },
        "socket.io/*": {
          origin: backendOrigin,
          ...dynamicBehavior,
        },
        health: {
          origin: backendOrigin,
          ...dynamicBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        "author-console*": {
          origin: backendOrigin,
          ...dynamicBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        "static/author/*": {
          origin: backendOrigin,
          ...dynamicBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
      },
    });

    cdk.Tags.of(this).add("Project", props.projectName);
    cdk.Tags.of(this).add("Environment", props.environmentName);
    cdk.Tags.of(this).add("ManagedBy", "AWS-CDK");

    new cdk.CfnOutput(this, "FrontendBucketName", {
      value: this.siteBucket.bucketName,
    });

    new cdk.CfnOutput(this, "CloudFrontDistributionId", {
      value: this.distribution.distributionId,
    });

    new cdk.CfnOutput(this, "CloudFrontDomainName", {
      value: this.distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, "CloudFrontUrl", {
      value: `https://${this.distribution.distributionDomainName}`,
    });
  }
}
