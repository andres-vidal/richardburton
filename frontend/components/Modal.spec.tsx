import { act, fireEvent, render, renderHook } from "@testing-library/react";
import { Key } from "app";
import React from "react";
import { Modal, useModal, useURLQueryModal } from "./Modal";

// A minimal reactive `next/navigation` mock: `router.replace` updates the shared
// search params and notifies subscribers so `useSearchParams()` re-renders — the
// URL round-trip the URL-driven modal hooks depend on, like the real router.
const nav = vi.hoisted(() => {
  let search = new URLSearchParams();
  const listeners = new Set<() => void>();
  return {
    replace(url: string) {
      const i = url.indexOf("?");
      search = new URLSearchParams(i === -1 ? "" : url.slice(i + 1));
      listeners.forEach((fn) => fn());
    },
    get: () => search,
    reset() {
      search = new URLSearchParams();
      listeners.forEach((fn) => fn());
    },
    subscribe(fn: () => void) {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/",
  useSearchParams: () => {
    const [, force] = React.useReducer((n: number) => n + 1, 0);
    React.useEffect(() => nav.subscribe(force), []);
    return nav.get();
  },
}));

beforeEach(() => nav.reset());

describe("Modal", () => {
  it("renders a modal", () => {
    render(<Modal isOpen={true} onClose={vi.fn()} />);
    expect(document.querySelector("[aria-modal=true]")).toBeTruthy();
  });

  it("names the dialog with its label", () => {
    render(<Modal isOpen={true} onClose={vi.fn()} label="Test dialog" />);

    const modal = document.querySelector("[aria-modal=true]")!;

    expect(modal.getAttribute("aria-label")).toBe("Test dialog");
  });

  it("closes when the backdrop is moused down", () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} />);

    // The backdrop is the dialog's parent; mousing it down (outside the dialog)
    // closes the modal.
    const backdrop =
      document.querySelector("[aria-modal=true]")!.parentElement!;
    fireEvent.mouseDown(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the escape key is pressed", () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} />);

    fireEvent.keyDown(document, { key: Key.ESCAPE });

    expect(onClose).toHaveBeenCalled();
  });

  it("renders a dialog", () => {
    render(<Modal isOpen={true} onClose={vi.fn()} />);
    expect(document.querySelector("[role=dialog]")).toBeTruthy();
  });

  it("does not close when the dialog is clicked", () => {
    const onClose = vi.fn();
    render(<Modal isOpen={true} onClose={onClose} />);

    fireEvent.click(document.querySelector("[role=dialog]")!);

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("useModal", () => {
  it("returns an isOpen boolean", () => {
    const { result } = renderHook(() => useModal());
    expect(result.current.isOpen).toBeDefined();
  });

  test("the isOpen boolean is initially false", () => {
    const { result } = renderHook(() => useModal());
    expect(result.current.isOpen).toBe(false);
  });

  it("returns an open function", () => {
    const { result } = renderHook(() => useModal());
    expect(result.current.open).toBeDefined();
  });

  test("the open function sets isOpen to true", () => {
    const { result } = renderHook(() => useModal());

    act(() => result.current.open());

    expect(result.current.isOpen).toBe(true);
  });

  test("the open function is idempotent", () => {
    const { result } = renderHook(() => useModal());

    act(() => result.current.open());
    act(() => result.current.open());

    expect(result.current.isOpen).toBe(true);
  });

  it("returns a close function", () => {
    const { result } = renderHook(() => useModal());
    expect(result.current.close).toBeDefined();
  });

  test("the close function sets isOpen to false", () => {
    const { result } = renderHook(() => useModal());

    act(() => result.current.open());
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
  });

  test("the close function is idempotent", () => {
    const { result } = renderHook(() => useModal());

    act(() => result.current.open());
    act(() => result.current.close());
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
  });
});

describe("useURLQueryModal", () => {
  it("returns an isOpen boolean", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));
    expect(result.current.isOpen).toBeDefined();
  });

  test("the isOpen boolean is initially false if the query param is not set", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));
    expect(result.current.isOpen).toBe(false);
  });

  test("the isOpen boolean is initially true when the query param is set", () => {
    nav.replace("?modal=true");

    const { result } = renderHook(() => useURLQueryModal("modal"));

    expect(result.current.isOpen).toBe(true);
  });

  it("returns an open function", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));
    expect(result.current.open).toBeDefined();
  });

  test("the open function sets isOpen to true", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open());

    expect(result.current.isOpen).toBe(true);
  });

  test("the open function is idempotent relative to isOpen", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open());
    act(() => result.current.open());

    expect(result.current.isOpen).toBe(true);
  });

  test("the open function sets the value", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open("value"));

    expect(result.current.value).toBe("value");
  });

  test("the open function is idempotent relative to the value", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open("value"));
    act(() => result.current.open("value"));

    expect(result.current.value).toBe("value");
  });

  it("returns a close function", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));
    expect(result.current.close).toBeDefined();
  });

  test("the close function sets isOpen to false", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open());
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
  });

  test("the close function is idempotent realtive to isOpen", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open());
    act(() => result.current.close());
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
  });

  test("the close function sets the value to undefined", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open("value"));
    act(() => result.current.close());

    expect(result.current.value).toBeUndefined();
  });

  test("the close function is idempotent relative to the value", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open("value"));
    act(() => result.current.close());
    act(() => result.current.close());

    expect(result.current.value).toBeUndefined();
  });
});
