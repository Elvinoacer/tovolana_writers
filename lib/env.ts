export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL || "",
  directUrl: process.env.DIRECT_URL || process.env.DATABASE_URL || "",
  redisUrl: process.env.REDIS_URL || "redis://127.0.0.1:6379",
  upstashRestUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  authSecret:
    process.env.AUTH_SECRET || "tovolana-dev-fallback-secret-change-in-prod",
  sessionCookieName: process.env.SESSION_COOKIE_NAME || "tovolana_session",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ||
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/auth/google/callback`,
  intasendPublishableKey: process.env.INTASEND_PUBLISHABLE_KEY || "",
  intasendSecretKey: process.env.INTASEND_SECRET_KEY || "",
  intasendIsTest: process.env.INTASEND_IS_TEST !== "false",
  intasendWebhookChallenge:
    process.env.INTASEND_WEBHOOK_CHALLENGE || "dev-intasend-challenge",
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || "",
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || "",
  firebasePrivateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(
    /\\n/g,
    "\n"
  ),
  resendApiKey: process.env.RESEND_API_KEY || "",
  emailFrom:
    process.env.EMAIL_FROM || "Tovolana Writers <noreply@tovolana.example.com>",
  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: Number(process.env.SMTP_PORT || "587"),
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smsProviderApiKey: process.env.SMS_PROVIDER_API_KEY || "",
  smsSenderId: process.env.SMS_SENDER_ID || "TOVOLANA",
  storageSigningSecret:
    process.env.STORAGE_SIGNING_SECRET ||
    process.env.AUTH_SECRET ||
    "tovolana-storage-signing-secret",
  storageBucketUrl: process.env.STORAGE_BUCKET_URL || "",
  cronSecret: process.env.CRON_SECRET || "tovolana-cron-secret",
};

export function hasLiveIntaSendKeys(): boolean {
  return (
    Boolean(env.intasendPublishableKey) &&
    Boolean(env.intasendSecretKey) &&
    !env.intasendSecretKey.startsWith("replace-")
  );
}

export function hasGoogleOAuthKeys(): boolean {
  return Boolean(env.googleClientId) && Boolean(env.googleClientSecret);
}

export function hasFirebaseAdminKeys(): boolean {
  return (
    Boolean(env.firebaseProjectId) &&
    Boolean(env.firebaseClientEmail) &&
    Boolean(env.firebasePrivateKey)
  );
}
