#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { BackendStack } from "../lib/backend-stack";
import { BuildStack } from "../lib/build-stack";
import { DataStack } from "../lib/data-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { NetworkStack } from "../lib/network-stack";
import { stagingConfig } from "../config/staging";

const app = new cdk.App();
const config = stagingConfig;

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: config.region,
};

const common = {
  projectName: config.projectName,
  environmentName: config.environmentName,
  env,
};

const network = new NetworkStack(
  app,
  "AdventurePlatformNetwork-staging",
  common,
);

const build = new BuildStack(
  app,
  "AdventurePlatformBuild-staging",
  {
    ...common,
    backendImageTag: config.backendImageTag,
  },
);

let data: DataStack | undefined;
if (config.enableDataStack) {
  data = new DataStack(
    app,
    "AdventurePlatformData-staging",
    {
      ...common,
      vpc: network.vpc,
      databaseSecurityGroup: network.databaseSecurityGroup,
    },
  );
  data.addDependency(network);
}

let backend: BackendStack | undefined;
if (config.enableBackendStack) {
  if (!data) {
    throw new Error("Backend stack requires enableDataStack=true.");
  }

  backend = new BackendStack(
    app,
    "AdventurePlatformBackend-staging",
    {
      ...common,
      vpc: network.vpc,
      albSecurityGroup: network.albSecurityGroup,
      backendSecurityGroup: network.backendSecurityGroup,
      repository: build.repository,
      imageTag: config.backendImageTag,
      cpu: config.backendCpu,
      memoryLimitMiB: config.backendMemoryMiB,
      desiredCount: config.backendDesiredCount,
      cookieSecure: config.backendCookieSecure,
      adminUsernames: config.adminUsernames,
      database: data.database,
      databaseSecret: data.databaseSecret,
      openAiApiKeySecret: data.openAiApiKeySecret,
    },
  );
  backend.addDependency(network);
  backend.addDependency(build);
  backend.addDependency(data);
}

if (config.enableFrontendStack) {
  if (!backend) {
    throw new Error("Frontend stack requires enableBackendStack=true.");
  }

  const frontend = new FrontendStack(
    app,
    "AdventurePlatformFrontend-staging",
    {
      ...common,
      loadBalancer: backend.loadBalancer,
    },
  );
  frontend.addDependency(backend);
}

app.synth();
