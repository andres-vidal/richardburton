import type { FullHistoryEntry, SnapshotDiff } from "./model";
import { keyOf, presentAbsorbed, presentChanges, withChanges } from "./history";

function snapshot(
  fields: Partial<FullHistoryEntry["snapshot"]> = {},
): FullHistoryEntry["snapshot"] {
  return {
    title: "Dom Casmurro",
    authors: ["Helen Caldwell"],
    originalTitle: "Dom Casmurro",
    originalAuthors: ["Machado de Assis"],
    year: 1953,
    countries: ["US"],
    publishers: ["Noonday Press"],
    sources: [],
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
        sources: null,
      }),
    ).toEqual([{ kind: "field", attribute: "year", from: "1953", to: "1954" }]);
  });

  test("orders fields by the database's attributes, not the payload", () => {
    // Deliberately reversed relative to ATTRIBUTES: the wire is a map, so its
    // order means nothing and this module imposes the app's own.
    const labels = presentChanges({
      fields: {
        publishers: { from: "A", to: "B" },
        title: { from: "A", to: "B" },
      },
      sources: null,
    }).map((change) =>
      change.kind === "field" ? change.attribute : "sources",
    );

    expect(labels).toEqual(["title", "publishers"]);
  });

  test("sources come last, as the one change that is a list", () => {
    const kinds = presentChanges({
      fields: { title: { from: "A", to: "B" } },
      sources: { added: ["x"], removed: [], reordered: false },
    }).map((change) => change.kind);

    expect(kinds).toEqual(["field", "sources"]);
  });

  test("nothing to diff renders nothing", () => {
    expect(presentChanges(null)).toEqual([]);
    expect(presentChanges({ fields: {}, sources: null })).toEqual([]);
  });
});

describe("withChanges", () => {
  test("resolves every entry's changes once, up front", () => {
    const [update, created] = withChanges([
      entry(1, 2, "updated", {}, { fields: {}, sources: null }),
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
      { fields: { title: { from: "A", to: "B" } }, sources: null },
    );
    const [decorated] = withChanges([original]);

    expect(decorated).toMatchObject(original);
    expect(decorated.changes).toEqual([
      { kind: "field", attribute: "title", from: "A", to: "B" },
    ]);
  });
});

describe("keyOf", () => {
  test("identifies an entry by publication and version", () => {
    expect(keyOf(entry(7, 3, "updated"))).toBe("7:3");
  });
});

describe("presentAbsorbed", () => {
  const absorbing = (
    action: FullHistoryEntry["action"],
    absorbed: FullHistoryEntry["absorbed"],
  ) => ({ ...entry(1, 2, action), absorbed });

  test("spells out a record a merge took in, field by field", () => {
    const [change] = presentAbsorbed(
      absorbing("merged", [
        { id: 9, ...snapshot({ title: "A British Printing" }) },
      ]),
    );

    expect(change).toMatchObject({ kind: "absorbed", direction: "in" });
    if (change.kind !== "absorbed")
      throw new Error("expected an absorbed change");

    const [record] = change.records;
    expect(record.title).toBe("A British Printing");
    // Every field it held, so the log says what became of the data — not only
    // that something was taken in.
    expect(record.fields.map((field) => field.attribute)).toContain("authors");
    expect(record.fields.map((field) => field.attribute)).toContain("year");
    expect(record.fields.map((field) => field.attribute)).not.toContain(
      "title",
    );
  });

  test("an un-merge gives them back", () => {
    const [change] = presentAbsorbed(
      absorbing("unmerged", [{ id: 9, ...snapshot() }]),
    );

    expect(change).toMatchObject({ kind: "absorbed", direction: "back" });
  });

  test("an entry that moved no records adds nothing", () => {
    expect(presentAbsorbed(entry(1, 2, "updated"))).toEqual([]);
    expect(presentAbsorbed(absorbing("merged", []))).toEqual([]);
  });

  test("the whole record travels with the entry, sources included", () => {
    const [change] = presentAbsorbed(
      absorbing("merged", [
        {
          id: 9,
          ...snapshot({ sources: ["Sousa, J. Bibliografia, 1955."] }),
        },
      ]),
    );

    if (change.kind !== "absorbed")
      throw new Error("expected an absorbed change");
    expect(change.records[0].sources).toEqual([
      "Sousa, J. Bibliografia, 1955.",
    ]);
  });
});
