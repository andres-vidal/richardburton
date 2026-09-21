import { request } from "app";

/** One name a publication is built from, and how much rests on it. */
type Name = {
  id: number;
  name: string;
  /** How many publications carry it. What tells a name to keep from a stray. */
  publications: number;
  /**
   * The ids of the other names near enough to be this one spelt differently.
   *
   * Ids rather than names, because the names they point at are in the same
   * list. Empty on a name the rest of the vocabulary is nothing like.
   */
  resembles: number[];
};

/** The kinds of name that can be managed, as the routes spell them. */
type Kind = "authors" | "publishers";

/** What a rename turned out to be. */
type Outcome = "renamed" | "merged";

/** A publication caught in a clash, named so it can be gone and looked at. */
type Clashing = { id: number; title: string; year: string };

/**
 * One name a batch would enter, answered against what is already here.
 *
 * `held` says the vocabulary has this name exactly, so entering it joins what
 * is there rather than adding to it. `resembles` lists the names near it, most
 * used first, which is how a misspelling shows: not held, but close to
 * something that is.
 */
type Resemblance = { name: string; held: boolean; resembles: Name[] };

async function list(kind: Kind): Promise<Name[]> {
  return request(async (http) => {
    const { data } = await http.get<{ entries: Name[] }>(`vocabulary/${kind}`);

    return data.entries;
  });
}

/**
 * Rename one.
 *
 * Renaming to a name nothing else holds corrects a spelling; renaming to one
 * already taken folds the two together, since a vocabulary cannot hold the same
 * name twice.
 *
 * The two are not equally undoable, so a fold has to be asked for. Without
 * `fold`, a rename onto a taken name writes nothing and comes back as
 * `{ folds }` naming who holds it — put that to the person, then call again
 * with `fold`.
 *
 * Refused outright where the correction would give two publications one
 * identity — the duplicate the misspelling was hiding. Those publications come
 * back so they can be dealt with first.
 */
async function rename(
  kind: Kind,
  id: number,
  name: string,
  fold = false,
): Promise<{ outcome: Outcome } | { folds: Name } | { collides: Clashing[] }> {
  return request(async (http) => {
    try {
      const { data } = await http.patch<{ outcome: Outcome }>(
        `vocabulary/${kind}/${id}`,
        { name, fold },
      );

      return { outcome: data.outcome };
    } catch (error) {
      const refusal = refused(error);

      if (refusal?.error === "would_fold" && refusal.into) {
        return { folds: refusal.into };
      }

      if (refusal) return { collides: refusal.publications ?? [] };

      throw error;
    }
  });
}

/** What the server said it would not do, or nothing if it failed some other way. */
function refused(error: unknown) {
  const response = (
    error as {
      response?: {
        status?: number;
        data?: { error?: string; into?: Name; publications?: Clashing[] };
      };
    }
  ).response;

  return response?.status === 409 ? (response.data ?? {}) : null;
}

/**
 * Ask about a batch of names at once.
 *
 * Posted rather than queried, because a batch being entered can carry more
 * names than a URL should. Nothing is written.
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
export type { Clashing, Kind, Name, Outcome, Resemblance };
