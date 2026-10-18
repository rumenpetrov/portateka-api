export const SYSTEM_CONFIG = {
  projectName: "Portateka API",
  apiVersion: "v1",
  jwtExpiresIn: "8h",
  emailVerificationExpiresIn: "24h",
  passwordResetExpiresIn: "1h",
  emailFrom: "Portateka <noreply@portateka-api.rpetrov.dev>",
  maxBodySizeBytes: 16 * 1024,
} as const;
