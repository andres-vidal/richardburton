import { ownsShortcut, shortcutOf } from "./undo";

const press = (
  key: string,
  modifiers: Partial<
    Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>
  > = {},
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...modifiers,
});

describe("shortcutOf", () => {
  test("Ctrl+Z and Cmd+Z undo", () => {
    expect(shortcutOf(press("z", { ctrlKey: true }))).toBe("undo");
    expect(shortcutOf(press("z", { metaKey: true }))).toBe("undo");
  });

  // With Shift held, browsers report the key as an upper-case "Z".
  test("Ctrl+Shift+Z, Cmd+Shift+Z and Ctrl+Y redo", () => {
    expect(shortcutOf(press("Z", { ctrlKey: true, shiftKey: true }))).toBe(
      "redo",
    );
    expect(shortcutOf(press("Z", { metaKey: true, shiftKey: true }))).toBe(
      "redo",
    );
    expect(shortcutOf(press("y", { ctrlKey: true }))).toBe("redo");
  });

  test("other keys, a plain Z, and Alt combinations ask for nothing", () => {
    expect(shortcutOf(press("z"))).toBeNull();
    expect(shortcutOf(press("x", { ctrlKey: true }))).toBeNull();
    expect(shortcutOf(press("z", { ctrlKey: true, altKey: true }))).toBeNull();
    // Cmd+Y opens the history in some Mac browsers, so it is left to them.
    expect(shortcutOf(press("y", { metaKey: true }))).toBeNull();
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
