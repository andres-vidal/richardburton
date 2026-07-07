import { RefObject, useEffect, useState } from "react";

// Sourced from https://usehooks.com/useOnScreen/

export default function useVisible<T extends HTMLElement>(
  ref: RefObject<T | null>,
  rootMargin: string = "0px",
): boolean {
  // State and setter for storing whether element is visible
  const [isIntersecting, setIntersecting] = useState<boolean>(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Update our state when observer callback fires
        setIntersecting(entry.isIntersecting);
      },
      { rootMargin },
    );
    if (ref.current) {
      const el = ref.current;

      observer.observe(el);
      return () => {
        observer.unobserve(el);
      };
    }
  }, [ref, rootMargin]);
  return isIntersecting;
}
