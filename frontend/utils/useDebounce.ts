import { debounce, DebounceSettings, type DebouncedFunc } from "lodash";
import { useEffect, useMemo, useRef } from "react";

/**
 * Returns a debounced version of `factory` that calls the `factory` of the
 * latest render.
 *
 * The debounced function is made once per `delay`, so a component that passes
 * a new function on each render, as one that re-renders while it is typed into
 * does, still has one timer. It is lodash's debounced function, so `flush`
 * runs a pending call at once and `cancel` drops it.
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
