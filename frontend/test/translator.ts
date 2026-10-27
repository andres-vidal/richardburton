/**
 * Installs a fake of the browser's built-in Translator API on `self`, for
 * stories and end-to-end journeys, and returns a function that removes it.
 *
 * Neither Playwright's Chromium nor the Storybook test runner has the real
 * API. The fake translates any pair: it returns the text it is given, prefixed
 * with the target language in brackets, so "Um clássico" translated to English
 * is "[en] Um clássico". A pair is `downloadable` until a translator is first
 * created for it, which reports a download in two steps, half and whole, and
 * `available` after that.
 *
 * The function uses nothing outside its own body, so `page.addInitScript` can
 * send it to the browser as it is written.
 */
export function installFakeTranslator(): () => void {
  const downloaded = new Set<string>();
  const wait = () => new Promise((resolve) => setTimeout(resolve, 100));

  const fake = {
    async availability(pair: {
      sourceLanguage: string;
      targetLanguage: string;
    }) {
      return downloaded.has(`${pair.sourceLanguage}>${pair.targetLanguage}`)
        ? "available"
        : "downloadable";
    },

    async create(options: {
      sourceLanguage: string;
      targetLanguage: string;
      monitor?: (monitor: EventTarget) => void;
    }) {
      const key = `${options.sourceLanguage}>${options.targetLanguage}`;
      const monitor = new EventTarget();
      options.monitor?.(monitor);

      if (!downloaded.has(key)) {
        for (const loaded of [0.5, 1]) {
          await wait();
          monitor.dispatchEvent(
            Object.assign(new Event("downloadprogress"), { loaded }),
          );
        }
        downloaded.add(key);
      }

      return {
        async translate(input: string) {
          return `[${options.targetLanguage}] ${input}`;
        },
        destroy() {},
      };
    },
  };

  Object.defineProperty(self, "Translator", {
    value: fake,
    configurable: true,
    writable: true,
  });

  return () => {
    delete (self as { Translator?: unknown }).Translator;
  };
}
