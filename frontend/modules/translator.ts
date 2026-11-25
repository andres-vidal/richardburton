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

/**
 * The milliseconds `canTranslate` waits for the browser to say whether it can
 * translate a pair.
 */
const ANSWER_TIMEOUT = 3000;

/** Returns the browser's `Translator`, or null when the browser has none. */
function translatorFactory(): TranslatorFactory | null {
  return typeof self !== "undefined" && "Translator" in self
    ? (self as unknown as { Translator: TranslatorFactory }).Translator
    : null;
}

/**
 * The answers `canTranslate` has asked each `Translator` for, by language
 * pair, written as `pt>en`.
 */
const answers = new WeakMap<TranslatorFactory, Map<string, Promise<boolean>>>();

/**
 * Asks `factory` whether it can translate from `from` to `to`, and returns
 * false when it fails or has not answered after `ANSWER_TIMEOUT`.
 */
async function ask(
  factory: TranslatorFactory,
  from: Language,
  to: Language,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    const availability = await Promise.race([
      factory.availability({ sourceLanguage: from, targetLanguage: to }),
      new Promise<"unavailable">((resolve) => {
        timer = setTimeout(() => resolve("unavailable"), ANSWER_TIMEOUT);
      }),
    ]);
    return availability !== "unavailable";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns whether this browser can translate from `from` to `to`: true when
 * the model for the pair is on the computer, is downloading, or can be
 * downloaded, and false when the browser has no Translator API or cannot
 * translate the pair. A failure of the API counts as false, and so does an
 * API that has not answered after `ANSWER_TIMEOUT`, which is what a browser
 * that has the API but not its translation service does.
 *
 * The browser's `Translator` is asked once for each pair. Every later call
 * for the pair returns the same answer.
 */
function canTranslate(from: Language, to: Language): Promise<boolean> {
  const factory = translatorFactory();
  if (!factory) return Promise.resolve(false);

  const pairs = answers.get(factory) ?? new Map<string, Promise<boolean>>();
  const pair = `${from}>${to}`;
  const answer = pairs.get(pair) ?? ask(factory, from, to);

  answers.set(factory, pairs);
  pairs.set(pair, answer);

  return answer;
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
