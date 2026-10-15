"use client";

import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import BoldIcon from "assets/format-bold.svg";
import ItalicIcon from "assets/format-italic.svg";
import BulletedListIcon from "assets/bulleted-list.svg";
import LinkIcon from "assets/link.svg";
import NumberedListIcon from "assets/numbered-list.svg";
import isHotkey from "is-hotkey";
import {
  linkTarget,
  parse,
  serialize,
  type NotesMark,
  type NotesValue,
  type ListKind,
} from "modules/notes";
import {
  activeLink,
  activeList,
  applyLink,
  indent,
  isMarkActive,
  removeLink,
  replaceValue,
  toggleList,
  toggleMark,
  withNotes,
} from "modules/notes-editor";
import { useTranslations } from "next-intl";
import {
  FC,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  createEditor,
  Editor,
  Range,
  Transforms,
  type Descendant,
  type RangeRef,
} from "slate";
import { withHistory } from "slate-history";
import {
  Editable,
  ReactEditor,
  Slate,
  useSlate,
  withReact,
  type RenderElementProps,
  type RenderLeafProps,
  type RenderPlaceholderProps,
} from "slate-react";
import Button from "./Button";
import TextInput from "./TextInput";

/**
 * Keeps the editor's focus and selection when a toolbar button is pressed, so
 * the button acts on the text that was selected.
 */
const keepSelection = (event: MouseEvent) => event.preventDefault();

/**
 * A toolbar button that toggles a mark or a list. It is pressed, and outlined
 * in the primary colour, while the selection has what it toggles.
 */
const ToggleButton: FC<{
  label: string;
  Icon: FC<{ className: string; "aria-hidden"?: boolean }>;
  pressed: boolean;
  onToggle: () => void;
}> = ({ label, Icon, pressed, onToggle }) => (
  <Button
    label={label}
    labelSrOnly
    Icon={Icon}
    variant={pressed ? "outline-primary" : "outline"}
    width="fit"
    size="small"
    aria-pressed={pressed}
    onMouseDown={keepSelection}
    onClick={onToggle}
  />
);

/**
 * The form of the link dialog: the address the link goes to and, for a new
 * link with no text selected, the text it shows. Apply takes the address
 * through `linkTarget`, so an email address or a bare domain is accepted, and
 * says so under the field when the address is neither. Remove link is offered
 * when `canRemove`.
 *
 * Escape cancels, and goes no further than the form, so a dialog the editor
 * sits in stays open. The form is in a portal, and its submit event stops at
 * the form, so it does not submit a form the editor sits in.
 */
const LinkForm: FC<{
  initialUrl: string;
  asksText: boolean;
  canRemove: boolean;
  urlRef: RefObject<HTMLInputElement | null>;
  onApply: (url: string, text: string) => void;
  onRemove: () => void;
  onCancel: () => void;
}> = ({
  initialUrl,
  asksText,
  canRemove,
  urlRef,
  onApply,
  onRemove,
  onCancel,
}) => {
  const t = useTranslations("notes");
  const errorId = useId();
  const [address, setAddress] = useState(initialUrl);
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();

    const url = linkTarget(address);

    if (url === null) setInvalid(true);
    else onApply(url, text);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      onCancel();
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="flex flex-col gap-2"
    >
      <TextInput
        bordered
        inputRef={urlRef}
        value={address}
        onChange={(next) => {
          setAddress(next);
          setInvalid(false);
        }}
        error={invalid ? t("invalidLink") : undefined}
        aria-label={t("linkAddress")}
        aria-describedby={invalid ? errorId : undefined}
        placeholder={t("linkAddressPlaceholder")}
        inputMode="url"
        autoComplete="off"
      />
      {invalid && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {t("invalidLink")}
        </p>
      )}
      {asksText && (
        <TextInput
          bordered
          value={text}
          onChange={setText}
          aria-label={t("linkText")}
          placeholder={t("linkTextPlaceholder")}
          autoComplete="off"
        />
      )}
      <div className="flex gap-2 justify-end">
        {canRemove && (
          <Button
            label={t("removeLink")}
            variant="outline"
            width="fit"
            size="small"
            onClick={onRemove}
          />
        )}
        <Button
          label={t("cancel")}
          variant="outline"
          width="fit"
          size="small"
          onClick={onCancel}
        />
        <Button label={t("applyLink")} type="submit" width="fit" size="small" />
      </div>
    </form>
  );
};

/**
 * The Link button of the toolbar, and the link dialog it opens under itself
 * while `at` holds the selection the link is for. The dialog edits the link
 * the selection is in, or adds one, and closes through `onClose`, which
 * receives the change to make, or nothing when the dialog was cancelled. A
 * press outside the dialog cancels it.
 */
const LinkControl: FC<{
  at: RangeRef | null;
  onOpen: () => void;
  onClose: (change?: (at: Range) => void) => void;
}> = ({ at, onOpen, onClose }) => {
  const t = useTranslations("notes");
  const editor = useSlate();
  const urlRef = useRef<HTMLInputElement>(null);
  const open = at !== null;
  const range = at?.current ?? null;
  const link = activeLink(editor, range ?? editor.selection);

  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange: (next) => (next ? onOpen() : onClose()),
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useDismiss(context, { escapeKey: false }),
  ]);

  return (
    <>
      <Button
        ref={refs.setReference}
        {...getReferenceProps()}
        label={t("link")}
        labelSrOnly
        Icon={LinkIcon}
        variant={link ? "outline-primary" : "outline"}
        width="fit"
        size="small"
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseDown={keepSelection}
        onClick={() => (open ? onClose() : onOpen())}
      />
      <FloatingPortal>
        {open && (
          <FloatingFocusManager
            context={context}
            modal={false}
            initialFocus={urlRef}
            returnFocus={false}
          >
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              role="dialog"
              aria-label={t("linkDialog")}
              className="z-50 p-3 w-80 max-w-[calc(100vw-1rem)] bg-white rounded border border-gray-200 shadow-md"
            >
              <LinkForm
                initialUrl={link?.[0].url ?? ""}
                asksText={!link && (range === null || Range.isCollapsed(range))}
                canRemove={Boolean(link)}
                urlRef={urlRef}
                onApply={(url, text) =>
                  onClose((target) => applyLink(editor, target, url, text))
                }
                onRemove={() => onClose((target) => removeLink(editor, target))}
                onCancel={() => onClose()}
              />
            </div>
          </FloatingFocusManager>
        )}
      </FloatingPortal>
    </>
  );
};

/**
 * The toolbar over the editor: Bold, Italic, Bulleted list, Numbered list and
 * Link. It reads the editor on every change, so each button shows whether the
 * selection has what it toggles.
 */
const Toolbar: FC<{
  linking: RangeRef | null;
  onLink: () => void;
  onLinked: (change?: (at: Range) => void) => void;
}> = ({ linking, onLink, onLinked }) => {
  const t = useTranslations("notes");
  const editor = useSlate();
  const list = activeList(editor);

  const mark = (name: NotesMark) => ({
    pressed: isMarkActive(editor, name),
    onToggle: () => toggleMark(editor, name),
  });

  const listButton = (kind: ListKind) => ({
    pressed: list === kind,
    onToggle: () => toggleList(editor, kind),
  });

  return (
    <div
      role="toolbar"
      aria-label={t("toolbar")}
      className="flex flex-wrap gap-1 p-1 border-b border-gray-200"
    >
      <ToggleButton label={t("bold")} Icon={BoldIcon} {...mark("bold")} />
      <ToggleButton label={t("italic")} Icon={ItalicIcon} {...mark("italic")} />
      <ToggleButton
        label={t("bulletedList")}
        Icon={BulletedListIcon}
        {...listButton("bulleted")}
      />
      <ToggleButton
        label={t("numberedList")}
        Icon={NumberedListIcon}
        {...listButton("numbered")}
      />
      <LinkControl at={linking} onOpen={onLink} onClose={onLinked} />
    </div>
  );
};

/**
 * Renders an element of the value. A list item carries its kind and depth in
 * `data-list` and `data-depth`, and both together in `data-marker`, which the
 * CSS counters that number the items read. Its marker is drawn before it, so
 * the marker is not text that can be edited. A link is wrapped in empty
 * spans that keep the cursor placeable at its edges in Chromium.
 */
function renderElement({ attributes, children, element }: RenderElementProps) {
  switch (element.type) {
    case "link":
      return (
        <a {...attributes} href={element.url} className="anchor">
          <EdgeSpacer />
          {children}
          <EdgeSpacer />
        </a>
      );
    case "list-item":
      return (
        <div
          {...attributes}
          data-list={element.list}
          data-depth={element.depth}
          data-marker={`${element.list}-${element.depth}`}
          className="
            relative pl-6 mb-0.5
            data-[depth=1]:ml-6 data-[depth=2]:ml-12
            before:absolute before:left-0 before:w-5 before:text-right before:text-gray-500 before:tabular-nums before:select-none
            data-[marker=bulleted-0]:[counter-reset:list-0_list-1_list-2] data-[marker=bulleted-0]:before:content-['•']
            data-[marker=bulleted-1]:[counter-reset:list-1_list-2] data-[marker=bulleted-1]:before:content-['◦']
            data-[marker=bulleted-2]:[counter-reset:list-2] data-[marker=bulleted-2]:before:content-['▪']
            data-[marker=numbered-0]:[counter-reset:list-1_list-2] data-[marker=numbered-0]:[counter-increment:list-0] data-[marker=numbered-0]:before:content-[counter(list-0)_'.']
            data-[marker=numbered-1]:[counter-reset:list-2] data-[marker=numbered-1]:[counter-increment:list-1] data-[marker=numbered-1]:before:content-[counter(list-1)_'.']
            data-[marker=numbered-2]:[counter-increment:list-2] data-[marker=numbered-2]:before:content-[counter(list-2)_'.']
          "
        >
          {children}
        </div>
      );
    default:
      return (
        <p
          {...attributes}
          className="mb-2 last:mb-0 [counter-reset:list-0_list-1_list-2]"
        >
          {children}
        </p>
      );
  }
}

/**
 * The placeholder of an empty editor, in grey that keeps the contrast text
 * needs. Slate gives it an inline opacity, which the class overrides.
 */
function renderPlaceholder({ attributes, children }: RenderPlaceholderProps) {
  return (
    <span {...attributes} className="text-gray-500 opacity-100!">
      {children}
    </span>
  );
}

/** A run of text, bold or italic as its marks say. */
function renderLeaf({ attributes, children, leaf }: RenderLeafProps) {
  return (
    <span
      {...attributes}
      data-bold={Boolean(leaf.bold)}
      data-italic={Boolean(leaf.italic)}
      className="data-[bold=true]:font-semibold data-[italic=true]:italic"
    >
      {children}
    </span>
  );
}

/**
 * An empty, uneditable span at the edge of a link. Without it, Chromium does
 * not let the cursor sit just inside or just outside a link.
 */
const EdgeSpacer: FC = () => (
  <span contentEditable={false} className="text-[0px]">
    {String.fromCodePoint(160)}
  </span>
);

/**
 * Edits a publication's notes: rich text with paragraphs and line breaks,
 * bold and italic text, bulleted and numbered lists, and links. `value` is the
 * notes in Markdown, or null for none, and `onChange` receives the Markdown
 * the edited text is written as (see `serialize`), each time that Markdown
 * changes. Changing only the selection, or typing what Markdown cannot hold,
 * such as an empty paragraph, calls nothing.
 *
 * The editor keeps its own value while it is typed in. When `value` changes to
 * Markdown other than what it last passed to `onChange`, as when another
 * person edits the same notes, the editor shows the new value and forgets
 * its undo history.
 *
 * The toolbar's buttons, and Ctrl or Cmd with B, I and K, set bold and italic
 * and open the link dialog. In a list item, Tab and Shift+Tab move the item a
 * level deeper or shallower, and Enter on an empty item leaves the list. Undo
 * and redo are the editor's own, with the usual shortcuts. A bare URL or email
 * address that is typed or pasted becomes a link (see `withNotes`).
 *
 * The text area is a labelled multi-line textbox, described by the hint under
 * the label and by `error`, which is shown under the editor.
 */
const NotesEditor: FC<{
  value: string | null;
  onChange: (markdown: string) => void;
  error?: string;
}> = ({ value, onChange, error }) => {
  const t = useTranslations("notes");
  const attribute = useTranslations("attributes");
  const labelId = useId();
  const hintId = useId();
  const errorId = useId();

  const [editor] = useState(() =>
    withNotes(withHistory(withReact(createEditor()))),
  );
  const [initialValue] = useState(() => parse(value));
  const reported = useRef(value ?? "");
  const [linking, setLinking] = useState<RangeRef | null>(null);

  useEffect(() => {
    const incoming = value ?? "";

    if (incoming !== reported.current) {
      reported.current = incoming;
      replaceValue(editor, parse(incoming));
    }
  }, [editor, value]);

  function handleValueChange(next: Descendant[]) {
    const markdown = serialize(next as NotesValue);

    if (markdown !== reported.current) {
      reported.current = markdown;
      onChange(markdown);
    }
  }

  // Opens the link dialog for the selection, or for the end of the text when
  // the editor has none.
  function openLink() {
    const end = Editor.end(editor, []);
    const at = editor.selection ?? { anchor: end, focus: end };

    setLinking(Editor.rangeRef(editor, at));
  }

  // Closes the link dialog, makes `change` on the selection it was opened for,
  // when that selection still exists, and puts the focus back in the editor.
  function closeLink(change?: (at: Range) => void) {
    const at = linking?.unref() ?? null;
    setLinking(null);

    if (at) {
      Transforms.select(editor, at);
      change?.(at);
    }
    ReactEditor.focus(editor);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isHotkey("mod+b", { byKey: true }, event)) {
      event.preventDefault();
      toggleMark(editor, "bold");
    } else if (isHotkey("mod+i", { byKey: true }, event)) {
      event.preventDefault();
      toggleMark(editor, "italic");
    } else if (isHotkey("mod+k", { byKey: true }, event)) {
      event.preventDefault();
      openLink();
    } else if (
      isHotkey(["tab", "shift+tab"], { byKey: true }, event) &&
      indent(editor, event.shiftKey ? -1 : 1)
    ) {
      event.preventDefault();
    }
  }

  return (
    <Slate
      editor={editor}
      initialValue={initialValue}
      onValueChange={handleValueChange}
    >
      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span id={labelId} className="text-sm text-gray-600">
            {attribute("notes")}
          </span>
          <span id={hintId} className="text-xs text-gray-500">
            {t("hint")}
          </span>
        </div>
        <div
          data-error={Boolean(error)}
          className="bg-white rounded border transition-colors data-[error=false]:border-gray-300 data-[error=false]:focus-within:border-indigo-400 data-[error=true]:border-red-400"
        >
          <Toolbar linking={linking} onLink={openLink} onLinked={closeLink} />
          <Editable
            role="textbox"
            aria-multiline
            aria-labelledby={labelId}
            aria-describedby={error ? `${hintId} ${errorId}` : hintId}
            aria-invalid={Boolean(error)}
            placeholder={t("placeholder")}
            renderElement={renderElement}
            renderLeaf={renderLeaf}
            renderPlaceholder={renderPlaceholder}
            onKeyDown={handleKeyDown}
            className="overflow-y-auto py-2 px-3 max-h-80 text-sm text-gray-800 outline-none min-h-28 [counter-reset:list-0_list-1_list-2]"
          />
        </div>
        {error && (
          <p id={errorId} className="text-xs text-red-600">
            {error}
          </p>
        )}
      </section>
    </Slate>
  );
};

export default NotesEditor;
