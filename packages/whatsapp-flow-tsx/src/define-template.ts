/** Meta message-template category. UTILITY must be transactional; MARKETING is
 * promotional; AUTHENTICATION is for one-time-passcode style messages. */
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

/** Per-file config for a message template, exported as `template` from a
 * template `.tsx` file. Its presence is what marks a file as a template (rather
 * than a flow) to the compiler. */
export interface TemplateConfig {
  /** Template name. Defaults to the app `namePrefix` + file basename, lowercased.
   * Must match `[a-z0-9_]+`. */
  name?: string;
  /** Language/locale code, e.g. "en_US". Defaults to the app `language` or "en_US". */
  language?: string;
  /** Meta template category. Required. */
  category: TemplateCategory;
  /** Allow Meta to re-categorize the template during review. Defaults to false,
   * so the category you author is the one Meta must approve (or reject). */
  allowCategoryChange?: boolean;
  /** Treat warnings as errors. Defaults to true. */
  strict?: boolean;
}

/** Identity helper that gives a typed template config and marks the file as a
 * message template. Pair it with a default export that returns `<Template>`. */
export function defineTemplate(config: TemplateConfig): TemplateConfig {
  return config;
}
