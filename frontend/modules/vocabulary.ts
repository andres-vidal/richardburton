import { request } from "app";
import { ApiError } from "modules/http";

/** An author or publisher name stored in the database. */
type Name = {
  id: number;
  name: string;
  /** How many publications credit this name. */
  publications: number;
  /**
   * The ids of the other names of the same kind that this name resembles.
   * Each id is also in the list that `list` returns. Empty when the name
   * resembles no other name.
   */
  resembles: number[];
};

/** The kinds of name, as the vocabulary routes spell them. */
type Kind = "authors" | "publishers";

/** The result of a rename: a plain rename, or a fold into another name. */
type Outcome = "renamed" | "merged";

/** A publication as the vocabulary routes list it. */
type Listed = { id: number; title: string; year: number };

/**
 * The server's answer for one name passed to `resemblances`.
 *
 * `held` is true when the database already has this exact name, so entering
 * it adds no new record. `resembles` lists the stored names that resemble it,
 * most used first. A name that is not held but resembles a stored name may be
 * a misspelling.
 */
type Resemblance = {
  name: string;
  held: boolean;
  resembles: Omit<Name, "resembles">[];
};

async function list(kind: Kind): Promise<Name[]> {
  return request(async (http) => {
    const { data } = await http.get<{ entries: Name[] }>(`vocabulary/${kind}`);

    return data.entries;
  });
}

/**
 * Renames a name. When another name of the same kind already has the new name,
 * the two are folded into one.
 *
 * A fold cannot be undone, so it happens only when `fold` is true. Without it,
 * a rename onto a taken name writes nothing and returns `{ folds, publications }`:
 * the name that has it, and the publications that credit the renamed name and
 * would be credited to `folds` instead. Call again with `fold` once the person
 * confirms.
 *
 * When the rename would give two publications the same identity, nothing is
 * written and the result is `{ collides }`, listing those publications.
 */
async function rename(
  kind: Kind,
  id: number,
  name: string,
  fold = false,
): Promise<
  | { outcome: Outcome }
  | { folds: Name; publications: Listed[] }
  | { collides: Listed[] }
> {
  try {
    const { data } = await request((http) =>
      http.patch<{ outcome: Outcome }>(`vocabulary/${kind}/${id}`, {
        name,
        fold,
      }),
    );

    return { outcome: data.outcome };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;

    const { into, publications = [] } = (error.body ?? {}) as {
      into?: Name;
      publications?: Listed[];
    };

    if (error.code === "would_fold" && into) {
      return { folds: into, publications };
    }
    if (error.code === "would_collide") return { collides: publications };

    throw error;
  }
}

/**
 * Asks the server which of these names it already has, and which resemble a
 * stored name. Returns one answer per distinct, non-blank name.
 *
 * It sends a POST because the list can be too long for a URL. Nothing is
 * written.
 */
async function resemblances(
  kind: Kind,
  names: string[],
): Promise<Resemblance[]> {
  return request(async (http) => {
    const { data } = await http.post<{ entries: Resemblance[] }>(
      `vocabulary/${kind}/resemblances`,
      { names },
    );

    return data.entries;
  });
}

export { list, rename, resemblances };
export type { Kind, Listed, Name, Outcome, Resemblance };
