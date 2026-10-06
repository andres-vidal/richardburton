import { debounce, DebounceSettings, type DebouncedFunc } from "lodash";
import { useEffect, useMemo, useRef } from "react";

/**
 * Debounce a callback, and run whichever one the latest render supplied.
 *
 * The debounced wrapper is made once, so a caller that hands over a fresh
 * function each render — anything typed into, which re-renders as it goes —
 * still shares one timer instead of buying each call its own. It is lodash's
 * debounced function, so `flush` runs a pending call at once and `cancel`
 * drops it.
 */
function useDebounce<F extends (...args: never[]) => unknown>(
  factory: F,
  delay: number,
  opts?: DebounceSettings,
): DebouncedFunc<F> {
  const latest = useRef(factory);

  useEffect(() => {
    latest.current = factory;
  });

  const settings = useRef(opts);

  return useMemo(
    () =>
      debounce(
        (...args: Parameters<F>) => latest.current(...args),
        delay,
        settings.current,
      ),
    [delay],
  ) as unknown as DebouncedFunc<F>;
}

export default useDebounce;
