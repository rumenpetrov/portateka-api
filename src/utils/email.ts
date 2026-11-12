import { SYSTEM_CONFIG } from "@/config";
import type { Locale } from "@/config";
import { EMAIL_TEMPLATES } from "@/emails";
import type { EmailContent } from "@/emails/types";

const RESEND_API_URL = "https://api.resend.com/emails";

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]!);

export const buildVerificationUrl = (
  baseUrl: string,
  prefix: string,
  token: string,
): string => {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return `${normalizedBase}${normalizedPrefix}?token=${encodeURIComponent(token)}`;
};

interface SendEmailParams {
  to: string;
  content: EmailContent;
  resendApiKey?: string;
  // Short summary logged instead of sending when RESEND_API_KEY is not set.
  devSummary: string;
}

const sendEmail = async ({
  to,
  content,
  resendApiKey,
  devSummary,
}: SendEmailParams): Promise<void> => {
  // Local dev and automated test fallback: skip network call when RESEND_API_KEY is not set
  if (!resendApiKey || resendApiKey.trim() === "") {
    console.info(`[email:dev] To: ${to} | ${devSummary}`);
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
      subject: content.subject,
      html: content.html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }
};

export interface SendVerificationEmailParams {
  to: string;
  firstName: string;
  locale: Locale;
  token: string;
  webAppBaseUrl: string;
  verifyEmailPrefix: string;
  resendApiKey?: string;
}

export const sendVerificationEmail = async ({
  to,
  firstName,
  locale,
  token,
  webAppBaseUrl,
  verifyEmailPrefix,
  resendApiKey,
}: SendVerificationEmailParams): Promise<void> => {
  const url = buildVerificationUrl(webAppBaseUrl, verifyEmailPrefix, token);

  await sendEmail({
    to,
    resendApiKey,
    devSummary: `Locale: ${locale} | Verify URL: ${url}`,
    content: EMAIL_TEMPLATES[locale].verification({
      firstName: escapeHtml(firstName),
      url: escapeHtml(url),
      expiresInHours: SYSTEM_CONFIG.emailVerificationExpiresInHours,
    }),
  });
};

export interface SendPasswordResetEmailParams {
  to: string;
  firstName: string;
  locale: Locale;
  token: string;
  webAppBaseUrl: string;
  resetPasswordPrefix: string;
  resendApiKey?: string;
}

export const sendPasswordResetEmail = async ({
  to,
  firstName,
  locale,
  token,
  webAppBaseUrl,
  resetPasswordPrefix,
  resendApiKey,
}: SendPasswordResetEmailParams): Promise<void> => {
  const url = buildVerificationUrl(webAppBaseUrl, resetPasswordPrefix, token);

  await sendEmail({
    to,
    resendApiKey,
    devSummary: `Locale: ${locale} | Reset Password URL: ${url}`,
    content: EMAIL_TEMPLATES[locale].passwordReset({
      firstName: escapeHtml(firstName),
      url: escapeHtml(url),
      expiresInHours: SYSTEM_CONFIG.passwordResetExpiresInHours,
    }),
  });
};

export interface SendAccountDeletedEmailParams {
  to: string;
  firstName: string;
  locale: Locale;
  resendApiKey?: string;
}

export const sendAccountDeletedEmail = async ({
  to,
  firstName,
  locale,
  resendApiKey,
}: SendAccountDeletedEmailParams): Promise<void> => {
  await sendEmail({
    to,
    resendApiKey,
    devSummary: `Locale: ${locale} | Account Deleted`,
    content: EMAIL_TEMPLATES[locale].accountDeleted({
      firstName: escapeHtml(firstName),
    }),
  });
};
