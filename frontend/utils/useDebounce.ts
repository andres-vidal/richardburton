import { debounce, DebounceSettings } from "lodash";
import { useCallback } from "react";

function useDebounce<F extends (...args: never[]) => unknown>(
  factory: F,
  delay: number,
  opts?: DebounceSettings,
): F {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(debounce(factory, delay, opts) as unknown as F, [
    factory,
    delay,
  ]);
}

export default useDebounce;
