import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from "@/config";
import type { Locale } from "@/config";

/**
 * Picks the best supported locale from an `Accept-Language` header.
 * Matches exact tags first (`bg-BG`), then the primary language (`bg` -> `bg-BG`).
 * Falls back to `DEFAULT_LOCALE` when nothing matches.
 */
export const resolveLocaleFromHeader = (
  header: string | undefined,
): Locale => {
  if (!header) {
    return DEFAULT_LOCALE;
  }

  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";");
      const qParam = params.find((p) => p.trim().startsWith("q="));
      const q = qParam ? Number(qParam.trim().slice(2)) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isNaN(q) ? 0 : q, index };
    })
    .filter((entry) => entry.tag !== "" && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);

  for (const { tag } of ranked) {
    const exact = SUPPORTED_LOCALES.find((l) => l.toLowerCase() === tag);
    if (exact) {
      return exact;
    }

    const language = tag.split("-")[0];
    const byLanguage = SUPPORTED_LOCALES.find(
      (l) => l.split("-")[0]!.toLowerCase() === language,
    );
    if (byLanguage) {
      return byLanguage;
    }
  }

  return DEFAULT_LOCALE;
};
