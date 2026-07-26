import { fireEvent, renderHook } from "@testing-library/react";
import { Key } from "app";
import { useHotkey } from "./useHotkey";

describe("useHotkey", () => {
  test("the event handler is executed after pressing the given single string key", () => {
    const handle = vi.fn();
    renderHook(() => useHotkey(Key.ENTER, handle));

    fireEvent.keyDown(document, { key: Key.ENTER });

    expect(handle).toHaveBeenCalledTimes(1);
  });

  test("the event handler is executed after pressing the given single array key", () => {
    const handle = vi.fn();
    renderHook(() => useHotkey([Key.ENTER], handle));

    fireEvent.keyDown(document, { key: Key.ENTER });

    expect(handle).toHaveBeenCalledTimes(1);
  });

  test("the event handler is executed after pressing each of the given key array", () => {
    const handle = vi.fn();
    const hotkeys = [Key.ENTER, Key.ESCAPE];
    renderHook(() => useHotkey(hotkeys, handle));

    for (const key of hotkeys) {
      fireEvent.keyDown(document, { key });
    }

    expect(handle).toHaveBeenCalledTimes(2);
  });

  test("the event handler is executed after pressing the given single string hotkey", () => {
    const handle = vi.fn();
    renderHook(() => useHotkey("Control+Enter", handle));

    fireEvent.keyDown(document, { key: Key.ENTER, ctrlKey: true });

    expect(handle).toHaveBeenCalledTimes(1);
  });

  test("the event handler is executed after pressing the given single array hotkey", () => {
    const handle = vi.fn();
    renderHook(() => useHotkey(["Control+Enter"], handle));

    fireEvent.keyDown(document, { key: Key.ENTER, ctrlKey: true });

    expect(handle).toHaveBeenCalledTimes(1);
  });

  test("the event handler is executed after pressing each of the given hotkey array", () => {
    const handle = vi.fn();

    renderHook(() => useHotkey(["Control+Enter", "Control+Escape"], handle));

    fireEvent.keyDown(document, { key: Key.ENTER, ctrlKey: true });
    fireEvent.keyDown(document, { key: Key.ESCAPE, ctrlKey: true });

    expect(handle).toHaveBeenCalledTimes(2);
  });
  test("a disabled hotkey does not answer the press", () => {
    const handle = vi.fn();
    renderHook(() => useHotkey(Key.ESCAPE, handle, false));

    fireEvent.keyDown(document, { key: Key.ESCAPE });

    expect(handle).not.toHaveBeenCalled();
  });

  test("enabling and disabling follows the flag, so a hidden component stops answering", () => {
    const handle = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useHotkey(Key.ESCAPE, handle, enabled),
      { initialProps: { enabled: true } },
    );

    fireEvent.keyDown(document, { key: Key.ESCAPE });
    expect(handle).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    fireEvent.keyDown(document, { key: Key.ESCAPE });
    expect(handle).toHaveBeenCalledTimes(1);

    rerender({ enabled: true });
    fireEvent.keyDown(document, { key: Key.ESCAPE });
    expect(handle).toHaveBeenCalledTimes(2);
  });
});
