import { SYSTEM_CONFIG } from "../config";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendVerificationEmailParams {
  to: string;
  firstName: string;
  token: string;
  webAppBaseUrl: string;
  verifyEmailPrefix: string;
  resendApiKey?: string;
}

export const buildVerificationUrl = (
  baseUrl: string,
  prefix: string,
  token: string,
): string => {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return `${normalizedBase}${normalizedPrefix}?token=${encodeURIComponent(token)}`;
};

export const sendVerificationEmail = async ({
  to,
  firstName,
  token,
  webAppBaseUrl,
  verifyEmailPrefix,
  resendApiKey,
}: SendVerificationEmailParams): Promise<void> => {
  const verificationUrl = buildVerificationUrl(
    webAppBaseUrl,
    verifyEmailPrefix,
    token,
  );

  // Local dev and automated test fallback: skip network call when RESEND_API_KEY is not set
  if (!resendApiKey || resendApiKey.trim() === "") {
    console.info(
      `[email:dev] To: ${to} | Verify URL: ${verificationUrl}`,
    );
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SYSTEM_CONFIG.emailFrom,
      to: [to],
      subject: "Verify your Portateka email address",
      html: `
        <p>Hello ${firstName},</p>
        <p>Please verify your email address by clicking the link below:</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>This link will expire in ${SYSTEM_CONFIG.emailVerificationExpiresIn}.</p>
      `.trim(),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Resend API error (${response.status}): ${errorBody}`,
    );
  }
};

export interface SendPasswordResetEmailParams {
  to: string;
  firstName: string;
  token: string;
  webAppBaseUrl: string;
  resetPasswordPrefix: string;
  resendApiKey?: string;
}

export const sendPasswordResetEmail = async ({
  to,
  firstName,
  token,
  webAppBaseUrl,
  resetPasswordPrefix,
  resendApiKey,
}: SendPasswordResetEmailParams): Promise<void> => {
  const resetUrl = buildVerificationUrl(
    webAppBaseUrl,
    resetPasswordPrefix,
    token,
  );

  // Local dev and automated test fallback: skip network call when RESEND_API_KEY is not set
  if (!resendApiKey || resendApiKey.trim() === "") {
    console.info(`[email:dev] To: ${to} | Reset Password URL: ${resetUrl}`);
    return;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: SYSTEM_CONFIG.emailFrom,
      to: [to],
      subject: "Reset your Portateka password",
      html: `
        <p>Hello ${firstName},</p>
        <p>We received a request to reset your password. Click the link below to choose a new password:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>This link will expire in ${SYSTEM_CONFIG.passwordResetExpiresIn}. If you did not request a password reset, you can safely ignore this email.</p>
      `.trim(),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Resend API error (${response.status}): ${errorBody}`,
    );
  }
};
