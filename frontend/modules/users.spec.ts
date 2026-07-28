import { describeRole, User } from "./users";

describe("describeRole", () => {
  test("names a role for the middle of a sentence", () => {
    expect(`Ana is now ${describeRole("contributor")}.`).toBe(
      "Ana is now a Contributor.",
    );
  });

  test("takes the article its name calls for", () => {
    expect(describeRole("admin")).toBe("an Administrator");
    expect(describeRole("reader")).toBe("a Reader");
  });
});

describe("User", () => {
  describe("curates", () => {
    // Asking for the least a surface needs means a role above it is admitted
    // without every surface being revisited.
    test("a contributor and an admin both keep the catalogue", () => {
      expect(User.curates({ email: "a@b.c", role: "contributor" })).toBe(true);
      expect(User.curates({ email: "a@b.c", role: "admin" })).toBe(true);
    });

    test("a reader does not", () => {
      expect(User.curates({ email: "a@b.c", role: "reader" })).toBe(false);
    });

    test("nobody signed in does not", () => {
      expect(User.curates(null)).toBe(false);
      expect(User.curates(undefined)).toBe(false);
    });
  });

  describe("administers", () => {
    test("only an admin decides who has access", () => {
      expect(User.administers({ email: "a@b.c", role: "admin" })).toBe(true);
      expect(User.administers({ email: "a@b.c", role: "contributor" })).toBe(
        false,
      );
      expect(User.administers({ email: "a@b.c", role: "reader" })).toBe(false);
      expect(User.administers(null)).toBe(false);
    });
  });
});
