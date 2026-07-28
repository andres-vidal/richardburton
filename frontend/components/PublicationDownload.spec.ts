import { FALLBACK_FILENAME, filenameFrom } from "./PublicationDownload";

describe("filenameFrom", () => {
  test("takes the name the server gave the file", () => {
    expect(
      filenameFrom('attachment; filename="publications-machado.csv"'),
    ).toBe("publications-machado.csv");
  });

  test("accepts an unquoted name", () => {
    expect(filenameFrom("attachment; filename=publications.csv")).toBe(
      "publications.csv",
    );
  });

  test("falls back when the header is missing", () => {
    // What the header reads as when it is absent — and what it read as for every
    // download while the client looked for it under the wrong name.
    expect(filenameFrom(undefined)).toBe(FALLBACK_FILENAME);
  });

  test("falls back when the header says nothing about a name", () => {
    expect(filenameFrom("attachment")).toBe(FALLBACK_FILENAME);
  });

  test("falls back when the name is empty", () => {
    expect(filenameFrom('attachment; filename=""')).toBe(FALLBACK_FILENAME);
  });
});
