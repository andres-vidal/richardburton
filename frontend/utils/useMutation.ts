import { useRouter } from "i18n/navigation";
import { useCallback, useTransition } from "react";

/** An action that changes data on the server and says whether it succeeded. */
type Action = () => Promise<boolean>;

/**
 * Runs actions that change data on the server, and reads the page again from
 * the server after each one that succeeds.
 *
 * `run(action)` calls `action` inside a React transition. When the action
 * returns true, `run` calls `router.refresh()` in the same transition. `pending`
 * is true from the call until the action has finished and, after a success,
 * until the refreshed page has rendered.
 *
 * `run` returns a promise of the action's result. The promise settles when the
 * action finishes, which is before the refreshed page renders. When the action
 * throws, the promise rejects with the error and nothing is refreshed.
 */
function useMutation(): {
  pending: boolean;
  run: (action: Action) => Promise<boolean>;
} {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (action: Action) =>
      new Promise<boolean>((resolve, reject) => {
        startTransition(async () => {
          try {
            const succeeded = await action();

            // An update made after an `await` belongs to the transition only
            // when it is wrapped in `startTransition` again.
            if (succeeded) startTransition(() => router.refresh());
            resolve(succeeded);
          } catch (error) {
            reject(error);
          }
        });
      }),
    [router],
  );

  return { pending, run };
}

export { useMutation };
