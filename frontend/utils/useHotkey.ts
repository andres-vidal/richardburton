import isHotkey from "is-hotkey";
import { useEffect, useRef } from "react";

/**
 * Runs `handle` when a key press anywhere in the document matches `hotkey`, or
 * any of the combinations in `hotkey` when it is a list.
 *
 * A combination is matched by key, in the syntax of `is-hotkey`, such as
 * `"Escape"` or `"ctrl+shift+z"`. A modifier that a combination does not name
 * must not be held. A modifier marked with `?`, as in `"ctrl+meta?+z"`, may be
 * held or not.
 *
 * `enabled` takes a component out of the running without unmounting it: a key
 * press belongs to whatever is on screen. Several listeners can match one press
 * and all of them run, so a dormant listener can undo the work of the one that
 * should have acted.
 *
 * The listener reads the `hotkey` and `handle` of the latest render, so it is
 * added once and stays in place while they change.
 */
function useHotkey(
  hotkey: string | string[],
  handle: (event: KeyboardEvent) => void,
  enabled = true,
) {
  const latest = useRef({ hotkey, handle });

  useEffect(() => {
    latest.current = { hotkey, handle };
  });

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const { hotkey, handle } = latest.current;
      if (isHotkey(hotkey, { byKey: true }, event)) handle(event);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [enabled]);
}

export { useHotkey };
