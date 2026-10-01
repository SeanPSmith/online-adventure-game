export interface StagingConfig {
  readonly projectName: string;
  readonly environmentName: string;
  readonly region: string;
  readonly enableDataStack: boolean;
  readonly enableBackendStack: boolean;
  readonly enableFrontendStack: boolean;
  readonly backendImageTag: string;
  readonly backendCpu: number;
  readonly backendMemoryMiB: number;
  readonly backendDesiredCount: number;
  readonly backendCookieSecure: boolean;
  readonly adminUsernames: readonly string[];
}

export const stagingConfig: StagingConfig = {
  projectName: "adventure-platform",
  environmentName: "staging",
  region: "us-east-1",

  // Pass 03 exposes the existing backend through a same-origin CloudFront URL
  // and serves the React SPA from a private S3 bucket.
  enableDataStack: true,
  enableBackendStack: true,
  enableFrontendStack: true,

  backendImageTag: "staging-current",
  backendCpu: 512,
  backendMemoryMiB: 1024,
  backendDesiredCount: 1,

  // The browser now talks to CloudFront over HTTPS, so the server-issued
  // HttpOnly session cookie must be Secure.
  backendCookieSecure: true,

  // Bootstrap-only superuser identities. The backend converts this into a
  // durable admin/author/publish permission on startup. Admin rights are never
  // delegable from the web control room.
  adminUsernames: ["SeanSteezy"],
};
