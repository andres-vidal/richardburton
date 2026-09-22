import { describe, expect, test } from "vitest";
import * as Y from "yjs";

import * as Doc from "./doc";
import { empty, type Publication } from "./model";

function publication(fields: Partial<Publication> = {}): Publication {
  return { ...empty(), ...fields };
}

/** Two documents of one workspace, as two people editing it would have. */
function pair() {
  const here = new Y.Doc();
  const there = new Y.Doc();

  /** Hand each document everything the other knows, in both directions. */
  const sync = () => {
    Y.applyUpdate(
      there,
      Y.encodeStateAsUpdate(here, Y.encodeStateVector(there)),
    );
    Y.applyUpdate(
      here,
      Y.encodeStateAsUpdate(there, Y.encodeStateVector(here)),
    );
  };

  return { here, there, sync };
}

describe("reading and writing", () => {
  test("a row goes in and comes back out", () => {
    const doc = new Y.Doc();
    const row = publication({
      title: "Dom Casmurro",
      authors: ["Helen Caldwell"],
      year: "1953",
      sources: ["Caldwell, Helen. Introduction, 1953."],
    });

    Doc.addRow(doc, "a", row);

    expect(Doc.readRow(doc, "a")).toEqual(row);
    expect(Doc.keys(doc)).toEqual(["a"]);
  });

  test("a row the document does not hold reads as nothing", () => {
    expect(Doc.readRow(new Y.Doc(), "missing")).toBeNull();
  });

  test("rows keep the order they were given, not the order of their keys", () => {
    const doc = new Y.Doc();

    Doc.addRow(doc, "z", publication({ title: "Iracema" }));
    Doc.addRow(doc, "a", publication({ title: "Dom Casmurro" }));

    expect(Doc.keys(doc)).toEqual(["z", "a"]);
  });

  test("a duplicate is placed right after the row it came from", () => {
    const doc = new Y.Doc();

    Doc.addRow(doc, "a", publication({ title: "Dom Casmurro" }));
    Doc.addRow(doc, "b", publication({ title: "Iracema" }));
    Doc.addRowAfter(
      doc,
      "a",
      "a-again",
      publication({ title: "Dom Casmurro" }),
    );

    expect(Doc.keys(doc)).toEqual(["a", "a-again", "b"]);
  });

  test("removing a row takes it out of the order too", () => {
    const doc = new Y.Doc();

    Doc.addRow(doc, "a", publication({ title: "Dom Casmurro" }));
    Doc.addRow(doc, "b", publication({ title: "Iracema" }));
    Doc.removeRow(doc, "a");

    expect(Doc.keys(doc)).toEqual(["b"]);
    expect(Doc.readRow(doc, "a")).toBeNull();
  });

  test("an upload replaces whatever the workspace held", () => {
    const doc = new Y.Doc();

    Doc.addRow(doc, "old", publication({ title: "Barren Lives" }));
    Doc.setAll(doc, [
      { id: "a", publication: publication({ title: "Dom Casmurro" }) },
      { id: "b", publication: publication({ title: "Iracema" }) },
    ]);

    expect(Doc.keys(doc)).toEqual(["a", "b"]);
    expect(Doc.readRow(doc, "old")).toBeNull();
  });
});

describe("two people at once", () => {
  test("editing different fields of one row keeps both edits", () => {
    const { here, there, sync } = pair();

    Doc.addRow(here, "a", publication({ title: "Dom Casmuro", year: "1952" }));
    sync();

    // Neither has seen the other's change when they make their own.
    Doc.setField(here, "a", "title", "Dom Casmurro");
    Doc.setField(there, "a", "year", "1953");
    sync();

    expect(Doc.readRow(here, "a")).toMatchObject({
      title: "Dom Casmurro",
      year: "1953",
    });
    expect(Doc.readRow(there, "a")).toEqual(Doc.readRow(here, "a"));
  });

  test("editing one field from both sides settles on the same answer", () => {
    const { here, there, sync } = pair();

    Doc.addRow(here, "a", publication({ title: "Dom Casmuro" }));
    sync();

    Doc.setField(here, "a", "title", "Dom Casmurro");
    Doc.setField(there, "a", "title", "Dom Casmurro (1953)");
    sync();

    // One of the two wins — which one does not matter, that both documents
    // agree does. A title merged character by character would be neither.
    expect(Doc.readRow(here, "a")?.title).toEqual(
      Doc.readRow(there, "a")?.title,
    );
    expect(["Dom Casmurro", "Dom Casmurro (1953)"]).toContain(
      Doc.readRow(here, "a")?.title,
    );
  });

  test("a source added on each side keeps both", () => {
    const { here, there, sync } = pair();

    Doc.addRow(here, "a", publication({ title: "Dom Casmurro", sources: [] }));
    sync();

    Doc.setSources(here, "a", ["Caldwell, Helen. Introduction, 1953."]);
    Doc.setSources(there, "a", ["Gledson, John. Deceptive Realism, 1984."]);
    sync();

    const kept = Doc.readRow(here, "a")?.sources ?? [];

    expect(kept).toHaveLength(2);
    expect(kept).toEqual(
      expect.arrayContaining([
        "Caldwell, Helen. Introduction, 1953.",
        "Gledson, John. Deceptive Realism, 1984.",
      ]),
    );
    expect(Doc.readRow(there, "a")?.sources).toEqual(kept);
  });

  test("a row added on each side keeps both", () => {
    const { here, there, sync } = pair();

    Doc.addRow(here, "a", publication({ title: "Dom Casmurro" }));
    Doc.addRow(there, "b", publication({ title: "Iracema" }));
    sync();

    expect(Doc.keys(here)).toHaveLength(2);
    expect(Doc.keys(here)).toEqual(Doc.keys(there));
  });
});

describe("undo", () => {
  test("walks back this client's own edit", () => {
    const doc = new Y.Doc();
    const undo = Doc.undoManager(doc);

    Doc.addRow(doc, "a", publication({ title: "Dom Casmuro" }));

    // Adding the row and editing it are different steps, or one undo of a row
    // typed into straight away would take the row away rather than the typing.
    undo.stopCapturing();
    Doc.setField(doc, "a", "title", "Dom Casmurro");

    undo.undo();

    expect(Doc.readRow(doc, "a")?.title).toBe("Dom Casmuro");
  });

  test("without that boundary a new row and its first edit are one step", () => {
    const doc = new Y.Doc();
    const undo = Doc.undoManager(doc);

    Doc.addRow(doc, "a", publication({ title: "Dom Casmuro" }));
    Doc.setField(doc, "a", "title", "Dom Casmurro");

    undo.undo();

    // Both went, which is why the caller marks the boundary.
    expect(Doc.readRow(doc, "a")).toBeNull();
  });

  test("leaves what arrived from elsewhere alone", () => {
    const { here, there, sync } = pair();

    Doc.addRow(here, "a", publication({ title: "Dom Casmurro" }));
    sync();

    // Only edits made here are tracked, so the manager is made after the row
    // exists on both sides and before either of them edits it.
    const undo = Doc.undoManager(here);

    Doc.setField(here, "a", "title", "Dom Casmurro (revised)");
    Doc.setField(there, "a", "year", "1953");
    sync();

    undo.undo();

    // Mine is walked back; theirs stands.
    expect(Doc.readRow(here, "a")).toMatchObject({
      title: "Dom Casmurro",
      year: "1953",
    });
  });
});

describe("observing", () => {
  test("names the rows whose content changed", () => {
    const doc = new Y.Doc();
    const changed: string[][] = [];

    Doc.addRow(doc, "a", publication({ title: "Dom Casmurro" }));
    Doc.addRow(doc, "b", publication({ title: "Iracema" }));

    const stop = Doc.observe(doc, {
      onRows: (ids) => changed.push(ids as string[]),
      onOrder: () => {},
    });

    Doc.setField(doc, "b", "title", "Iraçéma");

    expect(changed).toEqual([["b"]]);

    stop();
    Doc.setField(doc, "a", "title", "Dom Casmuro");

    // Nothing arrives once the observer is gone.
    expect(changed).toEqual([["b"]]);
  });

  test("reports a changed reading order", () => {
    const doc = new Y.Doc();
    let reordered = 0;

    Doc.addRow(doc, "a", publication({ title: "Dom Casmurro" }));

    Doc.observe(doc, { onRows: () => {}, onOrder: () => (reordered += 1) });

    Doc.addRow(doc, "b", publication({ title: "Iracema" }));

    expect(reordered).toBe(1);
  });

  test("a local change is readable in the tick it was made", () => {
    const doc = new Y.Doc();
    let seen: string[] = [];

    Doc.addRow(doc, "a", publication({ title: "Dom Casmuro" }));
    Doc.observe(doc, {
      onRows: (ids) => (seen = ids as string[]),
      onOrder: () => {},
    });

    Doc.setField(doc, "a", "title", "Dom Casmurro");

    // No await: a keystroke has to land in the same tick, or the cell it was
    // typed into would render a tick behind the typing.
    expect(seen).toEqual(["a"]);
    expect(Doc.readRow(doc, "a")?.title).toBe("Dom Casmurro");
  });
});
