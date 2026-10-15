import { notify } from "components/Notifications";

/** A notification, in the shape `notify` takes. */
type Notice = Parameters<typeof notify>[0];

/**
 * Runs `action` and returns true when it finishes, or false when it throws.
 *
 * When `action` throws, `attempt` notifies `failure`. When `failure` is a
 * function, it notifies the notice that `failure` returns for the error.
 */
async function attempt(
  action: () => Promise<unknown>,
  failure: Notice | ((error: unknown) => Notice),
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (error) {
    notify(typeof failure === "function" ? failure(error) : failure);
    return false;
  }
}

export { attempt };
export type { Notice };
