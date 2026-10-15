import { act, renderHook } from "@testing-library/react";
import useLookup, { TYPING_DELAY_MS } from "./useLookup";

describe("useLookup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const render = (getOptions: (term: string) => Promise<string[]>) =>
    renderHook(() => useLookup(getOptions));

  test("asks for the lower-case term once typing pauses, and is busy until it is answered", async () => {
    const getOptions = vi.fn(async () => ["Machado de Assis"]);
    const { result } = render(getOptions);

    let found: Promise<string[] | undefined>;
    act(() => {
      found = result.current.lookup("Machado");
    });

    expect(result.current.busy).toBe(true);
    expect(getOptions).not.toHaveBeenCalled();

    await act(() => vi.advanceTimersByTimeAsync(TYPING_DELAY_MS));

    expect(getOptions).toHaveBeenCalledExactlyOnceWith("machado");
    await expect(found!).resolves.toEqual(["Machado de Assis"]);
    expect(result.current.busy).toBe(false);
  });

  test("answers only the newest lookup", async () => {
    const getOptions = vi.fn(async (term: string) => [term]);
    const { result } = render(getOptions);

    let older: Promise<string[] | undefined>;
    let newer: Promise<string[] | undefined>;
    act(() => {
      older = result.current.lookup("dom");
    });
    act(() => {
      newer = result.current.lookup("dom cas");
    });

    await expect(older!).resolves.toBeUndefined();

    await act(() => vi.advanceTimersByTimeAsync(TYPING_DELAY_MS));

    expect(getOptions).toHaveBeenCalledExactlyOnceWith("dom cas");
    await expect(newer!).resolves.toEqual(["dom cas"]);
  });

  test("drops an answer that arrives after a newer lookup started", async () => {
    let answer: (options: string[]) => void = () => {};
    const getOptions = vi.fn(
      (term: string) =>
        new Promise<string[]>((resolve) => {
          if (term === "dom") answer = resolve;
          else resolve([term]);
        }),
    );
    const { result } = render(getOptions);

    let older: Promise<string[] | undefined>;
    act(() => {
      older = result.current.lookup("dom");
    });
    await act(() => vi.advanceTimersByTimeAsync(TYPING_DELAY_MS));

    act(() => {
      void result.current.lookup("dom cas");
    });
    await act(async () => answer(["Dom Casmurro"]));

    await expect(older!).resolves.toBeUndefined();
    expect(result.current.busy).toBe(true);
  });

  test("an empty term and a cancel resolve the pending lookup with nothing", async () => {
    const getOptions = vi.fn(async () => ["Knopf"]);
    const { result } = render(getOptions);

    let pending: Promise<string[] | undefined>;
    let empty: Promise<string[] | undefined>;
    act(() => {
      pending = result.current.lookup("kno");
    });
    act(() => {
      empty = result.current.lookup("");
    });

    await expect(pending!).resolves.toBeUndefined();
    await expect(empty!).resolves.toBeUndefined();
    expect(result.current.busy).toBe(false);

    act(() => {
      pending = result.current.lookup("kno");
    });
    act(() => result.current.cancel());
    await act(() => vi.advanceTimersByTimeAsync(TYPING_DELAY_MS));

    await expect(pending!).resolves.toBeUndefined();
    expect(getOptions).not.toHaveBeenCalled();
  });

  test("a lookup that fails offers no options", async () => {
    const { result } = render(async () => {
      throw new Error("offline");
    });

    let found: Promise<string[] | undefined>;
    act(() => {
      found = result.current.lookup("knopf");
    });
    await act(() => vi.advanceTimersByTimeAsync(TYPING_DELAY_MS));

    await expect(found!).resolves.toEqual([]);
  });

  test("unmounting drops the pending lookup without asking for it", async () => {
    const getOptions = vi.fn(async () => ["Knopf"]);
    const { result, unmount } = render(getOptions);

    let pending: Promise<string[] | undefined>;
    act(() => {
      pending = result.current.lookup("knopf");
    });
    unmount();
    await vi.advanceTimersByTimeAsync(TYPING_DELAY_MS);

    await expect(pending!).resolves.toBeUndefined();
    expect(getOptions).not.toHaveBeenCalled();
  });
});
