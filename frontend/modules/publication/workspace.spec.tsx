import { render, screen } from "@testing-library/react";
import { useAtomValue } from "jotai";

import { empty, type Publication } from "./model";
import {
  forget,
  knownIds,
  publicationIdsAtom,
  type PublicationIndex,
} from "./store";
import { PublicationStoreProvider } from "./workspace";

/** A page of the database holding the publications `ids`. */
function page(ids: number[]): PublicationIndex {
  const entries: Publication[] = ids.map((id) => ({
    ...empty(),
    id,
    title: `Title ${id}`,
  }));

  return { entries, matched: [], total: 10, order: ids, perPage: 50 };
}

/** Renders the keys of the rows in the store, separated by commas. */
const Ids = () => (
  <output>{useAtomValue(publicationIdsAtom)?.join(",") ?? "unloaded"}</output>
);

/** Renders `Ids` inside a provider given `index`. */
const seeded = (index: PublicationIndex) => (
  <PublicationStoreProvider index={index}>
    <Ids />
  </PublicationStoreProvider>
);

beforeEach(() => forget(knownIds()));

describe("PublicationStoreProvider", () => {
  test("holds the rows of the index when its children first render", () => {
    render(seeded(page([1, 2])));

    expect(screen.getByRole("status").textContent).toBe("1,2");
  });

  test("takes the rows of each new index it is given", () => {
    const { rerender } = render(seeded(page([1, 2])));

    rerender(seeded(page([3])));

    expect(screen.getByRole("status").textContent).toBe("3");
  });
});
