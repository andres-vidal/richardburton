import isHotkey from "is-hotkey";
import { useEffect } from "react";

/**
 * Run `handle` when the hotkey is pressed anywhere in the document.
 *
 * `enabled` takes a component out of the running without unmounting it: a key
 * press belongs to whatever is on screen. Several listeners can match one press
 * and all of them run, so a dormant one is not merely useless — it can undo the
 * work of the one that should have acted.
 */
function useHotkey(
  hotkey: string | string[],
  handle: (event: KeyboardEvent) => void,
  enabled = true,
) {
  const hotkeys = Array.isArray(hotkey) ? hotkey : [hotkey];

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isHotkey(hotkeys, { byKey: true })(event)) handle(event);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...hotkeys, handle, enabled]);
}

export { useHotkey };
