import type { Locale } from "@/config";
import { bgBG } from "./bg-BG";
import { enUS } from "./en-US";
import type { EmailTemplates } from "./types";

export const EMAIL_TEMPLATES: Record<Locale, EmailTemplates> = {
  "en-US": enUS,
  "bg-BG": bgBG,
};
