import { describe, expect, test } from "vitest";
import * as Y from "yjs";

import * as Doc from "./doc";
import { empty, type Publication } from "./model";

function publication(fields: Partial<Publication> = {}): Publication {
  return { ...empty(), ...fields };
}

/** Two copies of one document, one for each of two people editing it. */
function pair() {
  const here = new Y.Doc();
  const there = new Y.Doc();

  /** Applies to each document the changes the other has and it lacks. */
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

    // Both edits are made before either document has the other's.
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

    // Yjs keeps one of the two titles. Which one does not matter, as long as
    // both documents hold the same one. Merging the titles character by
    // character would give neither.
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

    Doc.setField(here, "a", "sources", [
      "Caldwell, Helen. Introduction, 1953.",
    ]);
    Doc.setField(there, "a", "sources", [
      "Gledson, John. Deceptive Realism, 1984.",
    ]);
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

  // `setField` edits the existing `Y.Array` on each write, so after two writes
  // the field reads back as the second value.
  test("sources stay a list that merges however many times they are written", () => {
    const doc = new Y.Doc();
    Doc.addRow(doc, "a", publication({ title: "Dom Casmurro", sources: [] }));

    Doc.setField(doc, "a", "sources", ["Caldwell, Helen. Introduction, 1953."]);
    Doc.setField(doc, "a", "sources", [
      "Caldwell, Helen. Introduction, 1953.",
      "Gledson, John. Deceptive Realism, 1984.",
    ]);

    expect(Doc.readRow(doc, "a")?.sources).toEqual([
      "Caldwell, Helen. Introduction, 1953.",
      "Gledson, John. Deceptive Realism, 1984.",
    ]);
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

    // `stopCapturing` makes adding the row and editing it separate undo steps,
    // so the undo below reverts only the edit.
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

    // The undo removed both the edit and the row.
    expect(Doc.readRow(doc, "a")).toBeNull();
  });

  test("leaves what arrived from elsewhere alone", () => {
    const { here, there, sync } = pair();

    Doc.addRow(here, "a", publication({ title: "Dom Casmurro" }));
    sync();

    // The manager is created after the row is in both documents and before
    // either edits it, so the undo below can only revert the title edit.
    const undo = Doc.undoManager(here);

    Doc.setField(here, "a", "title", "Dom Casmurro (revised)");
    Doc.setField(there, "a", "year", "1953");
    sync();

    undo.undo();

    // The local title edit is undone, and the other person's year edit is kept.
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

    // After `stop`, the handler is not called.
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

    // There is no await. The observer must run in the same tick as the change,
    // or a cell would render one tick behind what was typed into it.
    expect(seen).toEqual(["a"]);
    expect(Doc.readRow(doc, "a")?.title).toBe("Dom Casmurro");
  });
});

describe("discarding", () => {
  test("marks a row without taking it out of the rows or the order", () => {
    const doc = new Y.Doc();

    Doc.addRow(doc, "a", publication({ title: "Dom Casmurro" }));
    Doc.addRow(doc, "b", publication({ title: "Iracema" }));
    Doc.setDiscarded(doc, ["a"], true);

    expect(Doc.isDiscarded(doc, "a")).toBe(true);
    expect(Doc.isDiscarded(doc, "b")).toBe(false);
    expect(Doc.discardedKeys(doc)).toEqual(["a"]);
    expect(Doc.keys(doc)).toEqual(["a", "b"]);
    expect(Doc.readRow(doc, "a")?.title).toBe("Dom Casmurro");
  });

  test("bringing a row back removes its mark", () => {
    const doc = new Y.Doc();

    Doc.addRow(doc, "a", publication());
    Doc.setDiscarded(doc, ["a"], true);
    Doc.setDiscarded(doc, ["a"], false);

    expect(Doc.isDiscarded(doc, "a")).toBe(false);
    expect(Doc.discardedKeys(doc)).toEqual([]);
  });

  test("reaches the other person's copy", () => {
    const { here, there, sync } = pair();

    Doc.addRow(here, "a", publication());
    sync();
    Doc.setDiscarded(there, ["a"], true);
    sync();

    expect(Doc.isDiscarded(here, "a")).toBe(true);
  });

  test("an upload starts with nothing discarded", () => {
    const doc = new Y.Doc();

    Doc.addRow(doc, "a", publication());
    Doc.setDiscarded(doc, ["a"], true);
    Doc.setAll(doc, [{ id: "a", publication: publication() }]);

    expect(Doc.discardedKeys(doc)).toEqual([]);
  });

  test("removing a row removes its mark", () => {
    const doc = new Y.Doc();

    Doc.addRow(doc, "a", publication());
    Doc.setDiscarded(doc, ["a"], true);
    Doc.removeRow(doc, "a");

    expect(Doc.discardedKeys(doc)).toEqual([]);
  });

  test("is walked back by undo", () => {
    const doc = new Y.Doc();
    const undo = Doc.undoManager(doc);

    Doc.addRow(doc, "a", publication());
    undo.stopCapturing();
    Doc.setDiscarded(doc, ["a"], true);

    undo.undo();

    expect(Doc.isDiscarded(doc, "a")).toBe(false);
    expect(Doc.keys(doc)).toEqual(["a"]);
  });

  test("names the rows discarded or brought back to an observer", () => {
    const doc = new Y.Doc();
    const changed: string[][] = [];

    Doc.addRow(doc, "a", publication());
    Doc.addRow(doc, "b", publication());
    Doc.setDiscarded(doc, ["a"], true);

    Doc.observe(doc, {
      onRows: () => {},
      onOrder: () => {},
      onDiscarded: (ids) => changed.push(ids as string[]),
    });

    Doc.setDiscarded(doc, ["a", "b"], false);
    Doc.setDiscarded(doc, ["b"], true);

    // Bringing back "b", which was not discarded, changes nothing, so the first
    // call names "a" alone.
    expect(changed).toEqual([["a"], ["b"]]);
  });
});
