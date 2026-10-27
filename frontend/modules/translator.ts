import type { Language } from "modules/publication/model";

/**
 * Machine translation with the browser's built-in Translator API.
 *
 * The API translates on the reader's computer, with a model the browser
 * downloads the first time a site asks for a language pair. It costs nothing,
 * needs no key, and sends no text to a server. Chrome and Edge on desktop have
 * it. Other browsers do not, and `availability` says so.
 *
 * The API takes and returns plain text. Translating many texts runs them one
 * after another, since the API runs one translation at a time.
 *
 * TypeScript's DOM library does not declare the API yet, so its shape is
 * declared here, with only the members this module uses.
 */

/**
 * Whether a language pair can be translated: `available` when the model is on
 * the computer, `downloadable` when the browser can download it, `downloading`
 * while it does, and `unavailable` when the browser cannot translate the pair.
 */
type TranslatorAvailability =
  "available" | "downloadable" | "downloading" | "unavailable";

/** The languages a translator translates from and to. */
type LanguagePair = { sourceLanguage: string; targetLanguage: string };

/** A `downloadprogress` event: `loaded` is the share downloaded, from 0 to 1. */
type DownloadProgressEvent = Event & { loaded: number };

/** A translator for one language pair. */
type BuiltInTranslator = {
  translate(input: string): Promise<string>;
  destroy(): void;
};

/** The `Translator` the API puts on `self`. */
type TranslatorFactory = {
  availability(pair: LanguagePair): Promise<TranslatorAvailability>;
  create(
    pair: LanguagePair & { monitor?: (monitor: EventTarget) => void },
  ): Promise<BuiltInTranslator>;
};

/** Returns the browser's `Translator`, or null when the browser has none. */
function translatorFactory(): TranslatorFactory | null {
  return typeof self !== "undefined" && "Translator" in self
    ? (self as unknown as { Translator: TranslatorFactory }).Translator
    : null;
}

/**
 * Returns whether this browser can translate from `from` to `to`: true when
 * the model for the pair is on the computer, is downloading, or can be
 * downloaded, and false when the browser has no Translator API or cannot
 * translate the pair. A failure of the API counts as false.
 */
async function canTranslate(from: Language, to: Language): Promise<boolean> {
  const factory = translatorFactory();
  if (!factory) return false;

  try {
    const availability = await factory.availability({
      sourceLanguage: from,
      targetLanguage: to,
    });
    return availability !== "unavailable";
  } catch {
    return false;
  }
}

/**
 * Translates each of `texts` from `from` to `to`, and returns the
 * translations in the same order. A blank text comes back as it is, without
 * being sent to the translator.
 *
 * The translator is created first, which downloads the model when the
 * computer does not have it yet. The browser lets a page start that download
 * only right after the person acts, so call this from a click. While the model
 * downloads, `onProgress` receives the share downloaded, from 0 to 1. The
 * translator is destroyed once the texts are translated, and when a
 * translation fails, in which case the returned promise rejects.
 */
async function translateAll(
  texts: string[],
  from: Language,
  to: Language,
  onProgress?: (loaded: number) => void,
): Promise<string[]> {
  const factory = translatorFactory();
  if (!factory) throw new Error("This browser has no Translator API.");

  const translator = await factory.create({
    sourceLanguage: from,
    targetLanguage: to,
    monitor: (monitor) =>
      monitor.addEventListener("downloadprogress", (event) =>
        onProgress?.((event as DownloadProgressEvent).loaded),
      ),
  });

  try {
    const translated: string[] = [];

    for (const text of texts) {
      translated.push(
        text.trim() === "" ? text : await translator.translate(text),
      );
    }

    return translated;
  } finally {
    translator.destroy();
  }
}

export { canTranslate, translateAll };
export type { TranslatorAvailability, TranslatorFactory };
