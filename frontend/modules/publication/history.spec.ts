import type { FullHistoryEntry, SnapshotDiff } from "./model";
import { keyOf, presentChanges, withChanges } from "./history";

function snapshot(
  fields: Partial<FullHistoryEntry["snapshot"]> = {},
): FullHistoryEntry["snapshot"] {
  return {
    title: "Dom Casmurro",
    authors: "Helen Caldwell",
    originalTitle: "Dom Casmurro",
    originalAuthors: "Machado de Assis",
    year: 1953,
    countries: "US",
    publishers: "Noonday Press",
    references: [],
    ...fields,
  };
}

function entry(
  publicationId: number,
  version: number,
  action: FullHistoryEntry["action"],
  fields: Partial<FullHistoryEntry["snapshot"]> = {},
  diff: SnapshotDiff | null = null,
): FullHistoryEntry {
  return {
    publicationId,
    version,
    action,
    actor: "admin@rb.test",
    timestamp: "2026-07-24T12:00:00",
    snapshot: snapshot(fields),
    diff,
    undoable: false,
  };
}

describe("presentChanges", () => {
  test("labels fields and stringifies raw values", () => {
    expect(
      presentChanges({
        fields: { year: { from: 1953, to: 1954 } },
        references: null,
      }),
    ).toEqual([{ kind: "field", label: "Year", from: "1953", to: "1954" }]);
  });

  test("orders fields by the catalogue's attributes, not the payload", () => {
    // Deliberately reversed relative to ATTRIBUTES: the wire is a map, so its
    // order means nothing and this module imposes the app's own.
    const labels = presentChanges({
      fields: {
        publishers: { from: "A", to: "B" },
        title: { from: "A", to: "B" },
      },
      references: null,
    }).map((change) => (change.kind === "field" ? change.label : "references"));

    expect(labels).toEqual(["Title", "Publishers"]);
  });

  test("references come last, as the one change that is a list", () => {
    const kinds = presentChanges({
      fields: { title: { from: "A", to: "B" } },
      references: { added: ["x"], removed: [], reordered: false },
    }).map((change) => change.kind);

    expect(kinds).toEqual(["field", "references"]);
  });

  test("nothing to diff renders nothing", () => {
    expect(presentChanges(null)).toEqual([]);
    expect(presentChanges({ fields: {}, references: null })).toEqual([]);
  });
});

describe("withChanges", () => {
  test("resolves every entry's changes once, up front", () => {
    const [update, created] = withChanges([
      entry(1, 2, "updated", {}, { fields: {}, references: null }),
      entry(1, 1, "created"),
    ]);

    expect(update.changes).toEqual([]);
    expect(created.changes).toEqual([]);
  });

  test("carries the entry through untouched apart from the changes", () => {
    const original = entry(
      1,
      2,
      "updated",
      {},
      { fields: { title: { from: "A", to: "B" } }, references: null },
    );
    const [decorated] = withChanges([original]);

    expect(decorated).toMatchObject(original);
    expect(decorated.changes).toEqual([
      { kind: "field", label: "Title", from: "A", to: "B" },
    ]);
  });
});

describe("keyOf", () => {
  test("identifies an entry by publication and version", () => {
    expect(keyOf(entry(7, 3, "updated"))).toBe("7:3");
  });
});
