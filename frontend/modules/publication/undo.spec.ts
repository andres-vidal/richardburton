import { createEvent, fireEvent, renderHook } from "@testing-library/react";
import { ownsShortcut, useUndoShortcuts } from "./undo";

type Modifier = "ctrlKey" | "metaKey" | "shiftKey" | "altKey";

/** Presses `key` on `target` with `modifiers` held, and returns the event. */
const press = (
  key: string,
  modifiers: Modifier[] = [],
  target: Element = document.body,
) => {
  const event = createEvent.keyDown(target, {
    key,
    ...Object.fromEntries(modifiers.map((modifier) => [modifier, true])),
  });
  fireEvent(target, event);
  return event;
};

describe("useUndoShortcuts", () => {
  const bind = () => {
    const undo = vi.fn();
    const redo = vi.fn();
    renderHook(() => useUndoShortcuts({ undo, redo }));
    return { undo, redo };
  };

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  test("Ctrl+Z and Cmd+Z undo, alone or held together", () => {
    const { undo, redo } = bind();

    press("z", ["ctrlKey"]);
    press("z", ["metaKey"]);
    press("z", ["ctrlKey", "metaKey"]);

    expect(undo).toHaveBeenCalledTimes(3);
    expect(redo).not.toHaveBeenCalled();
  });

  // With Shift held, browsers report the key as an upper-case "Z".
  test("Ctrl+Shift+Z, Cmd+Shift+Z and Ctrl+Y redo, with Ctrl and Cmd alone or held together", () => {
    const { undo, redo } = bind();

    press("Z", ["ctrlKey", "shiftKey"]);
    press("Z", ["metaKey", "shiftKey"]);
    press("Z", ["ctrlKey", "metaKey", "shiftKey"]);
    press("y", ["ctrlKey"]);
    press("y", ["ctrlKey", "metaKey"]);

    expect(redo).toHaveBeenCalledTimes(5);
    expect(undo).not.toHaveBeenCalled();
  });

  test("other keys, a plain Z, Alt combinations, Ctrl+Shift+Y and Cmd+Y do nothing", () => {
    const { undo, redo } = bind();

    press("z");
    press("x", ["ctrlKey"]);
    press("z", ["ctrlKey", "altKey"]);
    press("Z", ["metaKey", "shiftKey", "altKey"]);
    press("Y", ["ctrlKey", "shiftKey"]);
    // Cmd+Y opens the history in some Mac browsers, so it is left to them.
    press("y", ["metaKey"]);

    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });

  test("a shortcut that undoes is kept from the browser", () => {
    bind();

    expect(press("z", ["ctrlKey"]).defaultPrevented).toBe(true);
    expect(press("x", ["ctrlKey"]).defaultPrevented).toBe(false);
  });

  test("a press in a text field is left to the field", () => {
    const { undo } = bind();
    document.body.innerHTML = '<input id="title" />';

    const event = press("z", ["ctrlKey"], document.querySelector("#title")!);

    expect(undo).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  test("a press that an earlier listener prevented is left alone", () => {
    const { undo } = bind();
    document.body.innerHTML = '<button id="remove">Remove</button>';
    const button = document.querySelector("#remove")!;
    button.addEventListener("keydown", (event) => event.preventDefault());

    press("z", ["ctrlKey"], button);

    expect(undo).not.toHaveBeenCalled();
  });
});

describe("ownsShortcut", () => {
  const render = (html: string) => {
    document.body.innerHTML = html;
    return (selector: string) => document.querySelector(selector);
  };

  test("a text field keeps its own undo", () => {
    const find = render(
      '<input id="text" /><input id="search" type="search" /><textarea id="area"></textarea><div contenteditable id="rich"><b id="bold">x</b></div>',
    );

    expect(ownsShortcut(find("#text"))).toBe(true);
    expect(ownsShortcut(find("#search"))).toBe(true);
    expect(ownsShortcut(find("#area"))).toBe(true);
    expect(ownsShortcut(find("#bold"))).toBe(true);
  });

  test("an element in an open dialog keeps the shortcut", () => {
    const find = render('<div role="dialog"><button id="ok">OK</button></div>');

    expect(ownsShortcut(find("#ok"))).toBe(true);
  });

  test("buttons, checkboxes and the page itself leave it to the workspace", () => {
    const find = render(
      '<button id="remove">Remove 2</button><input id="check" type="checkbox" />',
    );

    expect(ownsShortcut(find("#remove"))).toBe(false);
    expect(ownsShortcut(find("#check"))).toBe(false);
    expect(ownsShortcut(document.body)).toBe(false);
    expect(ownsShortcut(null)).toBe(false);
  });
});
