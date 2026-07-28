import { act, renderHook } from "@testing-library/react";
import useDebounce from "./useDebounce";

const DELAY = 350;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDebounce", () => {
  test("calls in quick succession settle into one, with the last arguments", () => {
    const run = vi.fn();
    const { result } = renderHook(() => useDebounce(run, DELAY));

    result.current("m");
    result.current("ma");
    result.current("mac");

    act(() => void vi.advanceTimersByTime(DELAY));

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("mac");
  });

  test("a caller that passes a fresh function each render still shares one timer", () => {
    const run = vi.fn();
    // A component re-renders as it types, so the callback it hands over is a new
    // one every keystroke. That must not buy each keystroke its own timer.
    const { result, rerender } = renderHook(() =>
      useDebounce((value: string) => run(value), DELAY),
    );

    result.current("m");
    rerender();
    result.current("ma");
    rerender();
    result.current("mac");

    act(() => void vi.advanceTimersByTime(DELAY));

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith("mac");
  });

  test("runs the callback the latest render supplied", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(
      ({ run }: { run: (value: string) => void }) => useDebounce(run, DELAY),
      { initialProps: { run: first } },
    );

    result.current("typed");
    rerender({ run: second });

    act(() => void vi.advanceTimersByTime(DELAY));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("typed");
  });

  test("waits out the delay before running at all", () => {
    const run = vi.fn();
    const { result } = renderHook(() => useDebounce(run, DELAY));

    result.current("m");
    act(() => void vi.advanceTimersByTime(DELAY - 1));
    expect(run).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(1));
    expect(run).toHaveBeenCalledTimes(1);
  });
});
