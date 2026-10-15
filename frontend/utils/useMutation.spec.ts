import { act, renderHook, waitFor } from "@testing-library/react";
import { useMutation } from "./useMutation";

const refresh = vi.fn();

vi.mock("i18n/navigation", () => ({ useRouter: () => ({ refresh }) }));

beforeEach(() => vi.clearAllMocks());

/** An action that finishes when the test says so, with the result it is given. */
function deferred() {
  let finish!: (succeeded: boolean) => void;
  let fail!: (error: unknown) => void;
  const action = () =>
    new Promise<boolean>((resolve, reject) => {
      finish = resolve;
      fail = reject;
    });

  return {
    action,
    finish: (ok: boolean) => finish(ok),
    fail: (e: unknown) => fail(e),
  };
}

describe("useMutation", () => {
  test("is pending while the action runs, and refreshes once it succeeds", async () => {
    const { result } = renderHook(() => useMutation());
    const { action, finish } = deferred();

    let ran!: Promise<boolean>;
    act(() => {
      ran = result.current.run(action);
    });

    expect(result.current.pending).toBe(true);
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => finish(true));

    await expect(ran).resolves.toBe(true);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  test("does not refresh after an action that failed", async () => {
    const { result } = renderHook(() => useMutation());

    let ran!: Promise<boolean>;
    await act(async () => {
      ran = result.current.run(async () => false);
    });

    await expect(ran).resolves.toBe(false);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(refresh).not.toHaveBeenCalled();
  });

  test("rejects with the error an action throws, and stops being pending", async () => {
    const { result } = renderHook(() => useMutation());
    const { action, fail } = deferred();
    const error = new Error("offline");

    let ran!: Promise<boolean>;
    act(() => {
      ran = result.current.run(action);
    });
    const settled = ran.catch((thrown: unknown) => thrown);

    await act(async () => fail(error));

    await expect(settled).resolves.toBe(error);
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(refresh).not.toHaveBeenCalled();
  });
});
