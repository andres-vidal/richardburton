import { useCallback, useRef } from "react";

/**
 * Run `onVisible` whenever the attached element scrolls into view (within
 * `rootMargin`). Returns a callback ref to put on that element.
 *
 * The observer is wired in the ref callback, so it attaches the moment the
 * element mounts and re-attaches if it remounts — a sentinel that only appears
 * while there is more to load is observed as soon as it does. The latest
 * `onVisible` is read through a ref, so the observer is built once per element
 * rather than rebuilt on every render.
 */
export default function useOnVisible<T extends HTMLElement>(
  onVisible: () => void,
  rootMargin = "0px",
): (node: T | null) => void {
  const callback = useRef(onVisible);
  callback.current = onVisible;

  const observer = useRef<IntersectionObserver | null>(null);

  return useCallback(
    (node: T | null) => {
      observer.current?.disconnect();
      if (!node) return;

      observer.current = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) callback.current();
        },
        { rootMargin },
      );
      observer.current.observe(node);
    },
    [rootMargin],
  );
}
