import { useEffect, useRef, useState } from "react";
import useDebounce from "./useDebounce";

/**
 * How long a field waits after the last keystroke before it searches with what
 * was typed. The pause is long enough that a typist does not start a search on
 * every letter.
 */
const TYPING_DELAY_MS = 350;

/** The functions and the state `useLookup` returns. */
type Lookup<T> = {
  /** Looks up the options for a term, as `useLookup` describes. */
  lookup: (term: string) => Promise<T[] | undefined>;
  /** Drops the pending lookup, which then resolves with `undefined`. */
  cancel: () => void;
  /** Whether a lookup is waiting for its delay or for its options. */
  busy: boolean;
};

/**
 * Looks up the options a field offers for what is typed into it.
 *
 * `lookup(term)` calls `getOptions` with the term in lower case once no other
 * lookup has started for `TYPING_DELAY_MS`. It resolves with the options that
 * `getOptions` returns, or with an empty list when `getOptions` fails.
 *
 * Only the newest lookup is answered. An older lookup resolves with `undefined`
 * as soon as a later call to `lookup` or to `cancel` replaces it, and so does a
 * lookup that is still pending when the component unmounts. `lookup("")`
 * replaces the pending lookup and resolves with `undefined` at once, without
 * calling `getOptions`.
 *
 * `busy` is true from a call to `lookup` with a term until that lookup resolves
 * or is replaced.
 */
function useLookup<T>(
  getOptions: (term: string) => Promise<T[]> | T[],
): Lookup<T> {
  const [busy, setBusy] = useState(false);

  // Resolves the pending lookup's promise. It is null when no lookup is pending.
  const pending = useRef<((options: T[] | undefined) => void) | null>(null);

  const ask = useDebounce(async (term: string) => {
    const answer = pending.current;

    let options: T[];
    try {
      options = await getOptions(term.toLowerCase());
    } catch {
      options = [];
    }

    if (answer && pending.current === answer) {
      pending.current = null;
      setBusy(false);
      answer(options);
    }
  }, TYPING_DELAY_MS);

  function cancel() {
    ask.cancel();
    pending.current?.(undefined);
    pending.current = null;
    setBusy(false);
  }

  function lookup(term: string): Promise<T[] | undefined> {
    cancel();
    if (!term) return Promise.resolve(undefined);

    setBusy(true);
    return new Promise((resolve) => {
      pending.current = resolve;
      ask(term);
    });
  }

  useEffect(
    () => () => {
      ask.cancel();
      pending.current?.(undefined);
      pending.current = null;
    },
    [ask],
  );

  return { lookup, cancel, busy };
}

export { TYPING_DELAY_MS };
export default useLookup;
