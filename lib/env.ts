export { MAX_BROWSER_UPLOAD_BYTES } from "./upload-constants";

export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  databaseUrl: process.env.DATABASE_URL || "",
  directUrl:
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.DIRECT_URL ||
    process.env.DATABASE_URL ||
    "",
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
  r2AccountId: process.env.R2_ACCOUNT_ID || "",
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || "",
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  r2BucketName: process.env.R2_BUCKET_NAME || "",
  r2PublicUrl:
    process.env.R2_PUBLIC_URL || process.env.NEXT_PUBLIC_R2_PUBLIC_URL || "",
  nextPublicR2PublicUrl:
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL || process.env.R2_PUBLIC_URL || "",
  r2Endpoint:
    process.env.R2_ENDPOINT ||
    (process.env.R2_ACCOUNT_ID
      ? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : ""),
  r2KeyPrefix:
    (process.env.R2_KEY_PREFIX || "tovolana_writers").replace(
      /^\/+|\/+$/g,
      ""
    ) || "tovolana_writers",
};

function isPlaceholder(value: string | undefined | null): boolean {
  if (!value) return true;
  const trimmed = value.trim().toLowerCase();
  if (trimmed.length === 0) return true;
  return (
    trimmed.includes("your-") ||
    trimmed.includes("replace-") ||
    trimmed.includes("changeme") ||
    trimmed.includes("example")
  );
}

export function hasR2Config(
  config: {
    r2AccountId?: string;
    r2Endpoint?: string;
    r2AccessKeyId?: string;
    r2SecretAccessKey?: string;
    r2BucketName?: string;
  } = env
): boolean {
  const hasAccountOrEndpoint =
    !isPlaceholder(config.r2AccountId) || !isPlaceholder(config.r2Endpoint);

  return (
    hasAccountOrEndpoint &&
    !isPlaceholder(config.r2AccessKeyId) &&
    !isPlaceholder(config.r2SecretAccessKey) &&
    !isPlaceholder(config.r2BucketName)
  );
}

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
