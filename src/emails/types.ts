export interface EmailContent {
  subject: string;
  html: string;
}

/**
 * Values interpolated into templates. `firstName` and `url` are HTML-escaped
 * by the caller (`src/utils/email.ts`) before reaching a template.
 */
export interface LinkEmailParams {
  firstName: string;
  url: string;
  expiresInHours: number;
}

export interface AccountDeletedEmailParams {
  firstName: string;
}

// Every locale must implement every template; TypeScript fails the build otherwise.
export interface EmailTemplates {
  verification: (params: LinkEmailParams) => EmailContent;
  passwordReset: (params: LinkEmailParams) => EmailContent;
  accountDeleted: (params: AccountDeletedEmailParams) => EmailContent;
}
