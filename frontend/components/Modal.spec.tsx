import { act, fireEvent, renderHook } from "@testing-library/react";
import { render, screen, waitFor, within } from "test/render";
import { Key } from "app";
import React, { FC } from "react";
import { Modal, useModal, useURLQueryModal } from "./Modal";
import Select from "./Select";

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

// The components navigate through `i18n/navigation`, so that is what is stood
// in for. `useSearchParams` still comes from Next itself.
vi.mock("i18n/navigation", () => ({
  useRouter: () => ({ replace: nav.replace }),
  usePathname: () => "/",
}));

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

/**
 * A modal named Outer with a button that opens a modal named Inner from its
 * content. Each close is reported to its spy, and Inner's also closes it.
 */
const NestedModals: FC<{
  onOuterClose: () => void;
  onInnerClose: () => void;
}> = ({ onOuterClose, onInnerClose }) => {
  const inner = useModal();

  return (
    <Modal isOpen onClose={onOuterClose} label="Outer">
      <button type="button" onClick={inner.open}>
        Open inner
      </button>
      <Modal
        isOpen={inner.isOpen}
        onClose={() => {
          onInnerClose();
          inner.close();
        }}
        label="Inner"
      />
    </Modal>
  );
};

describe("Modal", () => {
  it("renders a dialog named by its label", () => {
    render(<Modal isOpen onClose={vi.fn()} label="Test dialog" />);

    expect(
      screen
        .getByRole("dialog", { name: "Test dialog" })
        .getAttribute("aria-modal"),
    ).toBe("true");
  });

  it("renders its heading as the dialog's h1 and is named by it", () => {
    render(
      <Modal isOpen onClose={vi.fn()} heading="Merge" subheading="Two records">
        <p>Body</p>
      </Modal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Merge" });

    expect(
      within(dialog).getByRole("heading", { level: 1, name: "Merge" }),
    ).toBeTruthy();
    expect(within(dialog).getByText("Two records")).toBeTruthy();
    expect(within(dialog).getByText("Body")).toBeTruthy();
  });

  it("is named by its label rather than its heading when given both", () => {
    render(
      <Modal
        isOpen
        onClose={vi.fn()}
        heading="Contact Us"
        label="Contact us"
      />,
    );

    expect(screen.getByRole("dialog", { name: "Contact us" })).toBeTruthy();
  });

  it("closes when the backdrop is moused down", () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} label="Test dialog" />);

    // The backdrop is the dialog's parent, outside the dialog itself.
    fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);

    expect(onClose).toHaveBeenCalled();
  });

  it("closes when Escape is pressed in the dialog", () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} label="Test dialog" />);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: Key.ESCAPE });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when Escape is pressed with the focus outside the dialog", () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} label="Test dialog" />);

    fireEvent.keyDown(document, { key: Key.ESCAPE });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape while a key is being composed", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} label="Test dialog">
        <input aria-label="Name" />
      </Modal>,
    );
    const input = screen.getByRole("textbox", { name: "Name" });

    // Escape while a key is being composed, as with an input method, leaves
    // the modal open.
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: Key.ESCAPE, isComposing: true });
    expect(onClose).not.toHaveBeenCalled();

    // Once the composition has ended, Escape closes the modal again.
    fireEvent.compositionEnd(input);
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)));
    fireEvent.keyDown(input, { key: Key.ESCAPE });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes only the modal opened over it on Escape", () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(
      <NestedModals onOuterClose={onOuterClose} onInnerClose={onInnerClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open inner" }));

    fireEvent.keyDown(screen.getByRole("dialog", { name: "Inner" }), {
      key: Key.ESCAPE,
    });

    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();

    // With the inner modal closed, the next Escape closes the outer one.
    fireEvent.keyDown(document, { key: Key.ESCAPE });

    expect(onOuterClose).toHaveBeenCalledTimes(1);
    expect(onInnerClose).toHaveBeenCalledTimes(1);
  });

  it("closes only the modal opened over it when Escape is pressed outside both", () => {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(
      <NestedModals onOuterClose={onOuterClose} onInnerClose={onInnerClose} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open inner" }));

    fireEvent.keyDown(document, { key: Key.ESCAPE });

    expect(onInnerClose).toHaveBeenCalledTimes(1);
    expect(onOuterClose).not.toHaveBeenCalled();
  });

  it("leaves Escape to an open menu inside it", async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} label="Test dialog">
        <Select
          aria-label="Country"
          error=""
          onChange={vi.fn()}
          getOptions={async () => [{ id: "BR", label: "Brazil" }]}
        />
      </Modal>,
    );
    const combobox = screen.getByRole("combobox", { name: "Country" });

    fireEvent.focus(combobox);
    await screen.findByRole("option", { name: "Brazil" });
    fireEvent.keyDown(combobox, { key: Key.ESCAPE });

    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(onClose).not.toHaveBeenCalled();

    // With the menu closed, Escape closes the modal.
    fireEvent.keyDown(combobox, { key: Key.ESCAPE });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes from the named button of its small-screen bar", () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} label="Test dialog" />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("does not close when the dialog is clicked", () => {
    const onClose = vi.fn();
    render(<Modal isOpen onClose={onClose} label="Test dialog" />);

    fireEvent.click(screen.getByRole("dialog"));

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

  test("the close function is idempotent relative to isOpen", () => {
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open());
    act(() => result.current.close());
    act(() => result.current.close());

    expect(result.current.isOpen).toBe(false);
  });

  test("opening and closing keep the rest of the query", () => {
    nav.replace("?search=iracema");
    const { result } = renderHook(() => useURLQueryModal("modal"));

    act(() => result.current.open());
    expect(nav.get().toString()).toBe("search=iracema&modal=true");

    act(() => result.current.close());
    expect(nav.get().toString()).toBe("search=iracema");
  });
});
