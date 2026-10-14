import { get } from "app/api";
import type { Kind, Name } from "modules/vocabulary";

/** Reads every stored name of `kind` as the signed-in user. */
export async function readNames(kind: Kind): Promise<Name[]> {
  const { entries } = await get<{ entries: Name[] }>(`/vocabulary/${kind}`);

  return entries;
}
