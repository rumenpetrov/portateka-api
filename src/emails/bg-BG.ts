import type { EmailTemplates } from "./types";

const formatHours = (hours: number): string =>
  hours === 1 ? "1 час" : `${hours} часа`;

export const bgBG: EmailTemplates = {
  verification: ({ firstName, url, expiresInHours }) => ({
    subject: "Потвърдете имейл адреса си в Portateka",
    html: `
      <p>Здравейте, ${firstName},</p>
      <p>Моля, потвърдете имейл адреса си, като кликнете на линка по-долу:</p>
      <p><a href="${url}">${url}</a></p>
      <p>Линкът е валиден ${formatHours(expiresInHours)}.</p>
    `.trim(),
  }),
  passwordReset: ({ firstName, url, expiresInHours }) => ({
    subject: "Смяна на паролата за Portateka",
    html: `
      <p>Здравейте, ${firstName},</p>
      <p>Получихме заявка за смяна на паролата Ви. Кликнете на линка по-долу, за да изберете нова парола:</p>
      <p><a href="${url}">${url}</a></p>
      <p>Линкът е валиден ${formatHours(expiresInHours)}. Ако не сте заявили смяна на паролата, можете спокойно да игнорирате този имейл.</p>
    `.trim(),
  }),
  accountDeleted: ({ firstName }) => ({
    subject: "Профилът Ви в Portateka беше изтрит",
    html: `
      <p>Здравейте, ${firstName},</p>
      <p>Профилът Ви в Portateka и всички свързани данни за имоти бяха изтрити окончателно по Ваше искане.</p>
      <p>Ако не сте извършили това действие, моля, свържете се незабавно с поддръжката.</p>
    `.trim(),
  }),
};
