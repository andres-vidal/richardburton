const get = vi.hoisted(() => vi.fn());

vi.mock("app", () => ({
  request: (call: (http: { get: typeof get }) => unknown) => call({ get }),
}));

// `test/unit.setup.ts` replaces every search in `LOOKUP` with a stub, so each
// test reads the searches from a fresh copy of the module.
async function lookups() {
  vi.resetModules();
  return (await import("./lookup")).LOOKUP;
}

describe("LOOKUP", () => {
  beforeEach(() => {
    get.mockReset();
    get.mockResolvedValue({ data: [] });
  });

  test("asks the server for the countries a term finds, named in the given locale", async () => {
    const netherlands = { id: "NL", label: "Países Baixos" };
    get.mockResolvedValue({ data: [netherlands] });

    const LOOKUP = await lookups();

    await expect(LOOKUP.countries("holanda", "pt")).resolves.toEqual([
      netherlands,
    ]);
    expect(get).toHaveBeenCalledWith("/countries", {
      params: { search: "holanda", locale: "pt" },
    });
  });

  test.each([
    ["authors", "/authors"],
    ["publishers", "/publishers"],
    ["originalBooks", "/original-books"],
  ] as const)("%s asks %s for what the term finds", async (name, path) => {
    const LOOKUP = await lookups();

    await LOOKUP[name]("machado");

    expect(get).toHaveBeenCalledWith(path, { params: { search: "machado" } });
  });
});
