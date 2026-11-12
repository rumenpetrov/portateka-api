import type { EmailTemplates } from "./types";

const formatHours = (hours: number): string =>
  hours === 1 ? "1 hour" : `${hours} hours`;

export const enUS: EmailTemplates = {
  verification: ({ firstName, url, expiresInHours }) => ({
    subject: "Verify your Portateka email address",
    html: `
      <p>Hello ${firstName},</p>
      <p>Please verify your email address by clicking the link below:</p>
      <p><a href="${url}">${url}</a></p>
      <p>This link will expire in ${formatHours(expiresInHours)}.</p>
    `.trim(),
  }),
  passwordReset: ({ firstName, url, expiresInHours }) => ({
    subject: "Reset your Portateka password",
    html: `
      <p>Hello ${firstName},</p>
      <p>We received a request to reset your password. Click the link below to choose a new password:</p>
      <p><a href="${url}">${url}</a></p>
      <p>This link will expire in ${formatHours(expiresInHours)}. If you did not request a password reset, you can safely ignore this email.</p>
    `.trim(),
  }),
  accountDeleted: ({ firstName }) => ({
    subject: "Your Portateka account has been deleted",
    html: `
      <p>Hello ${firstName},</p>
      <p>Your Portateka account and all associated property data have been permanently deleted as requested.</p>
      <p>If you did not perform this action, please contact support immediately.</p>
    `.trim(),
  }),
};
