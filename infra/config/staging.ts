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
  readonly notificationEmailFrom: string;
  readonly notificationPublicBaseUrl: string;
  readonly notificationSmsEnabled: boolean;
  readonly vapidContact: string;
  readonly kokoroBaseUrl: string;
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

  // Real notification channels. Web Push needs no AWS messaging product and
  // creates its VAPID key in the durable application database. SES remains
  // disabled until a verified From address is deliberately supplied during
  // the notification-infrastructure deploy. SMS is opt-in and requires phone
  // verification before gameplay texts can be sent.
  notificationEmailFrom: process.env.TOT_NOTIFICATION_EMAIL_FROM?.trim() ?? "",
  notificationPublicBaseUrl: process.env.TOT_PUBLIC_BASE_URL?.trim() ?? "",
  notificationSmsEnabled: true,
  vapidContact: process.env.TOT_VAPID_CONTACT?.trim() ?? "mailto:push@example.com",
  // Optional PRIVATE Kokoro inference endpoint. Requires explicit infrastructure
  // deployment; a normal source-only release does not change ECS env vars.
  kokoroBaseUrl: process.env.TOT_KOKORO_BASE_URL?.trim() ?? "",
};
