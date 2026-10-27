import { installFakeTranslator } from "test/translator";
import { canTranslate, translateAll } from "./translator";

describe("canTranslate", () => {
  test("is false in a browser without the Translator API", async () => {
    expect(await canTranslate("pt", "en")).toBe(false);
  });

  test("is true for a pair the browser can download or has", async () => {
    const uninstall = installFakeTranslator();

    try {
      expect(await canTranslate("pt", "en")).toBe(true);
    } finally {
      uninstall();
    }
  });

  test("is false for a pair the browser cannot translate, and when the API fails", async () => {
    const answers = ["unavailable", new Error("The API failed.")];

    Object.defineProperty(self, "Translator", {
      configurable: true,
      value: {
        availability: async () => {
          const answer = answers.shift();
          if (answer instanceof Error) throw answer;
          return answer;
        },
      },
    });

    try {
      expect(await canTranslate("pt", "en")).toBe(false);
      expect(await canTranslate("pt", "en")).toBe(false);
    } finally {
      delete (self as { Translator?: unknown }).Translator;
    }
  });
});

describe("translateAll", () => {
  test("translates each text in order, passes blank ones through, and reports the download", async () => {
    const uninstall = installFakeTranslator();
    const progress = vi.fn();

    try {
      expect(
        await translateAll(
          ["Um clássico.", "  ", "Reeditado em 1922."],
          "pt",
          "en",
          progress,
        ),
      ).toEqual(["[en] Um clássico.", "  ", "[en] Reeditado em 1922."]);
      expect(progress.mock.calls).toEqual([[0.5], [1]]);
    } finally {
      uninstall();
    }
  });

  test("rejects in a browser without the Translator API", async () => {
    await expect(translateAll(["Um clássico."], "pt", "en")).rejects.toThrow();
  });
});
