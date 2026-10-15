import { useCallback, useEffect, useRef } from "react";

/**
 * Runs `onVisible` whenever the attached element enters the viewport extended
 * by `rootMargin`. Returns a callback ref to put on that element.
 *
 * The observer is attached in the ref callback, so it starts observing the
 * moment the element mounts, and again whenever it remounts. An element that
 * appears only while there is more to load is therefore observed as soon as it
 * appears. The observer calls the `onVisible` of the latest render, so it is
 * built once per element rather than on every render.
 */
export default function useOnVisible<T extends HTMLElement>(
  onVisible: () => void,
  rootMargin = "0px",
): (node: T | null) => void {
  const callback = useRef(onVisible);

  useEffect(() => {
    callback.current = onVisible;
  });

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
