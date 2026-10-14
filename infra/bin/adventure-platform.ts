#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { BackendStack } from "../lib/backend-stack";
import { BuildStack } from "../lib/build-stack";
import { DataStack } from "../lib/data-stack";
import { FrontendStack } from "../lib/frontend-stack";
import { NetworkStack } from "../lib/network-stack";
import { NarratorStack } from "../lib/narrator-stack";
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

// Normal releases have NO narrator stack by default. GPU is a distinct stack;
// enabling its synthesis never replaces the known-good CPU instance.
const cpuNarrator = process.env.TOT_ENABLE_NARRATOR_STACK === "1"
  ? new NarratorStack(app, "AdventurePlatformNarrator-staging", {
      ...common, vpc: network.vpc, backendSecurityGroup: network.backendSecurityGroup,
    })
  : undefined;
if (cpuNarrator) cpuNarrator.addDependency(network);
const gpuNarrator = process.env.TOT_ENABLE_GPU_NARRATOR_STACK === "1"
  ? new NarratorStack(app, "AdventurePlatformNarratorGpu-staging", {
      ...common, vpc: network.vpc, backendSecurityGroup: network.backendSecurityGroup,
      gpuMode: true,
    })
  : undefined;
if (gpuNarrator) gpuNarrator.addDependency(network);
const gpuCutover = process.env.TOT_STORY_TIME_GPU_CUTOVER === "1";
if (gpuCutover && !gpuNarrator) {
  throw new Error("GPU cutover requires TOT_ENABLE_GPU_NARRATOR_STACK=1 and an explicitly provisioned GPU narrator.");
}
const narrator = gpuCutover ? gpuNarrator : cpuNarrator;

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
      notificationEmailFrom: config.notificationEmailFrom,
      notificationPublicBaseUrl: config.notificationPublicBaseUrl,
      notificationSmsEnabled: config.notificationSmsEnabled,
      vapidContact: config.vapidContact,
      kokoroBaseUrl: narrator ? `http://${narrator.instance.instancePrivateIp}:8880` : config.kokoroBaseUrl,
      narratorInstance: narrator?.instance,
      narratorActivityTable: narrator?.activityTable,
      narratorCacheBucket: narrator?.audioBucket,
      kokoroCacheVersion: gpuCutover ? "kokoro-gpu-v0.9.0-cu126" : "kokoro-cpu-v0.8.0",
      kokoroMaxMonthlySeconds: gpuCutover ? 108000 : 216000,
    },
  );
  backend.addDependency(network);
  backend.addDependency(build);
  backend.addDependency(data);
  if (narrator) backend.addDependency(narrator);
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
