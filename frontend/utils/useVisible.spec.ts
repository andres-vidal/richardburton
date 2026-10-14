import { act, renderHook } from "@testing-library/react";
import useVisible from "./useVisible";

/**
 * A stand-in for `IntersectionObserver` that records every instance, and lets
 * a test report an element entering or leaving the viewport.
 */
class FakeObserver {
  static made: FakeObserver[] = [];

  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(
    private readonly callback: IntersectionObserverCallback,
    readonly options: IntersectionObserverInit,
  ) {
    FakeObserver.made.push(this);
  }

  observe(element: Element) {
    this.observed.add(element);
  }

  unobserve(element: Element) {
    this.observed.delete(element);
  }

  disconnect() {
    this.disconnected = true;
  }

  report(element: Element, isIntersecting: boolean) {
    this.callback(
      [{ target: element, isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

/** Renders `useVisible` for a new element, with `rootMargin`. */
function watch(rootMargin?: string) {
  const ref = { current: document.createElement("div") };
  const hook = renderHook(() => useVisible(ref, rootMargin));

  return { element: ref.current, ...hook };
}

beforeEach(() => {
  FakeObserver.made = [];
  vi.stubGlobal("IntersectionObserver", FakeObserver);
});

afterEach(() => vi.unstubAllGlobals());

describe("useVisible", () => {
  test("follows its element in and out of view", () => {
    const { element, result } = watch();
    const [observer] = FakeObserver.made;

    expect(result.current).toBe(false);

    act(() => observer.report(element, true));
    expect(result.current).toBe(true);

    act(() => observer.report(element, false));
    expect(result.current).toBe(false);
  });

  test("elements with the same margin share one observer, and each hears only its own", () => {
    const first = watch("800px");
    const second = watch("800px");

    expect(FakeObserver.made).toHaveLength(1);

    act(() => FakeObserver.made[0].report(second.element, true));

    expect(first.result.current).toBe(false);
    expect(second.result.current).toBe(true);
  });

  test("a different margin has an observer of its own", () => {
    watch("800px");
    watch();

    expect(FakeObserver.made.map(({ options }) => options.rootMargin)).toEqual([
      "800px",
      "0px",
    ]);
  });

  test("the observer is disconnected once its last element unmounts", () => {
    const first = watch();
    const second = watch();
    const [observer] = FakeObserver.made;

    first.unmount();
    expect(observer.observed).toEqual(new Set([second.element]));
    expect(observer.disconnected).toBe(false);

    second.unmount();
    expect(observer.disconnected).toBe(true);

    // The next element observed gets a new observer.
    watch();
    expect(FakeObserver.made).toHaveLength(2);
  });
});
