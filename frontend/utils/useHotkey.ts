import isHotkey from "is-hotkey";
import { useEffect } from "react";

function useHotkey(
  hotkey: string | string[],
  handle: (event: KeyboardEvent) => void,
) {
  const hotkeys = Array.isArray(hotkey) ? hotkey : [hotkey];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isHotkey(hotkeys, { byKey: true })(event)) handle(event);
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...hotkeys, handle]);
}

export { useHotkey };
