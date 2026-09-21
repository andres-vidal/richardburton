import { request } from "app";

/** One name a publication is built from, and how much rests on it. */
type Name = {
  id: number;
  name: string;
  /** How many publications carry it. What tells a name to keep from a stray. */
  publications: number;
};

/** The kinds of name that can be managed, as the routes spell them. */
type Kind = "authors" | "publishers";

/** What a rename turned out to be. */
type Outcome = "renamed" | "merged";

/** A publication caught in a clash, named so it can be gone and looked at. */
type Clashing = { id: number; title: string; year: string };

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
 * Refused where the correction would give two publications one identity — the
 * duplicate the misspelling was hiding. Those publications come back so they
 * can be dealt with first.
 */
async function rename(
  kind: Kind,
  id: number,
  name: string,
): Promise<{ outcome: Outcome } | { collides: Clashing[] }> {
  return request(async (http) => {
    try {
      const { data } = await http.patch<{ outcome: Outcome }>(
        `vocabulary/${kind}/${id}`,
        { name },
      );

      return { outcome: data.outcome };
    } catch (error) {
      const response = (
        error as {
          response?: { status?: number; data?: { publications?: Clashing[] } };
        }
      ).response;

      if (response?.status === 409) {
        return { collides: response.data?.publications ?? [] };
      }

      throw error;
    }
  });
}

export { list, rename };
export type { Clashing, Kind, Name, Outcome };
