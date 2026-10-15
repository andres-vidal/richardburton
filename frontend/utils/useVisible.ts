import { RefObject, useEffect, useState } from "react";

/** Called with whether an observed element is within the root margin. */
type Listener = (visible: boolean) => void;

/** An observer and the listeners of each element it observes. */
type Shared = {
  observer: IntersectionObserver;
  listeners: Map<Element, Set<Listener>>;
};

/**
 * One `IntersectionObserver` for each root margin in use, shared by every
 * element observed with that margin. A list of many rows then has one observer
 * rather than one per row.
 */
const shared = new Map<string, Shared>();

// Calls `listener` whenever `element` enters or leaves the viewport extended
// by `rootMargin`, through the shared observer for that margin. Returns a
// function that stops, and disconnects the observer once nothing uses it.
function observe(
  element: Element,
  rootMargin: string,
  listener: Listener,
): () => void {
  let entry = shared.get(rootMargin);

  if (!entry) {
    const listeners = new Map<Element, Set<Listener>>();
    const observer = new IntersectionObserver(
      (changes) =>
        changes.forEach((change) =>
          listeners
            .get(change.target)
            ?.forEach((listen) => listen(change.isIntersecting)),
        ),
      { rootMargin },
    );

    entry = { observer, listeners };
    shared.set(rootMargin, entry);
  }

  const { observer, listeners } = entry;
  const own = listeners.get(element) ?? new Set();

  listeners.set(element, own.add(listener));
  observer.observe(element);

  return () => {
    own.delete(listener);
    if (own.size > 0) return;

    listeners.delete(element);
    observer.unobserve(element);

    if (listeners.size === 0) {
      observer.disconnect();
      shared.delete(rootMargin);
    }
  };
}

/**
 * Returns whether the element in `ref` is within the viewport extended by
 * `rootMargin`. It is false until the element is first observed.
 *
 * Every element observed with the same `rootMargin` shares one
 * `IntersectionObserver`.
 */
export default function useVisible<T extends HTMLElement>(
  ref: RefObject<T | null>,
  rootMargin: string = "0px",
): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    return observe(element, rootMargin, setVisible);
  }, [ref, rootMargin]);

  return visible;
}
