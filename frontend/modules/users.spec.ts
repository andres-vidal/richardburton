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
  describe("canEditPublications", () => {
    // Asking for the least a surface needs means a role above it is admitted
    // without every surface being revisited.
    test("a contributor and an admin may both edit publications", () => {
      expect(
        User.canEditPublications({ email: "a@b.c", role: "contributor" }),
      ).toBe(true);
      expect(User.canEditPublications({ email: "a@b.c", role: "admin" })).toBe(
        true,
      );
    });

    test("a reader does not", () => {
      expect(User.canEditPublications({ email: "a@b.c", role: "reader" })).toBe(
        false,
      );
    });

    test("nobody signed in does not", () => {
      expect(User.canEditPublications(null)).toBe(false);
      expect(User.canEditPublications(undefined)).toBe(false);
    });
  });

  describe("canManageAccess", () => {
    test("only an admin decides who has access", () => {
      expect(User.canManageAccess({ email: "a@b.c", role: "admin" })).toBe(
        true,
      );
      expect(
        User.canManageAccess({ email: "a@b.c", role: "contributor" }),
      ).toBe(false);
      expect(User.canManageAccess({ email: "a@b.c", role: "reader" })).toBe(
        false,
      );
      expect(User.canManageAccess(null)).toBe(false);
    });
  });
});
