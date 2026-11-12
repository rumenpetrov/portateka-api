export const SYSTEM_CONFIG = {
  projectName: "Portateka API",
  apiVersion: "v1",
  jwtExpiresIn: "8h",
  // Numeric hours so the same value drives both JWT expiry and localized email copy.
  emailVerificationExpiresInHours: 24,
  passwordResetExpiresInHours: 1,
  emailFrom: "Portateka <noreply@portateka-api.rpetrov.dev>",
  maxBodySizeBytes: 16 * 1024,
} as const;

// BCP 47 tags shared with the web app (`portateka-web/src/i18n`).
export const SUPPORTED_LOCALES = ["en-US", "bg-BG"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en-US";
