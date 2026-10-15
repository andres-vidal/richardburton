"use client";

import { Key } from "app";
import { isString } from "lodash";
import { useTranslations } from "next-intl";
import { KeyboardEvent, Ref, useRef, useState } from "react";
import useLookup from "utils/useLookup";
import MenuProvider from "./MenuProvider";
import Pill from "./Pill";
import TextInput, { type TextInputProps } from "./TextInput";

type Item = { id: string; label: string };

type Props<ItemType extends string | Item> = Omit<
  TextInputProps,
  "value" | "onChange" | "left" | "right" | "inputRef" | "label" | "ref"
> & {
  /** Receives the field around the input. */
  ref?: Ref<HTMLDivElement>;
  value: ItemType[];
  onChange: (value: ItemType[]) => void;
  /** Returns the options for a term. `useLookup` decides when to call it. */
  getOptions: (search: string) => Promise<ItemType[]> | ItemType[];
  /**
   * Shown when a search matches nothing. Callers word it, because only they
   * know whether the field accepts values outside the offered options.
   */
  emptyMessage?: string;
  /**
   * Whether typed text can be added as an entry when no option is highlighted.
   * Without it, only an option can be added. Only a field of strings can set
   * it.
   */
  freeText?: boolean;
};

/** What makes two entries the same: the trimmed text, or an item's id. */
function identity<ItemType extends string | Item>(item: ItemType): string {
  return isString(item) ? item.trim() : item.id;
}

/**
 * Returns whether `input` has a quote open. A comma normally ends a value, so
 * a name that contains one is written in quotes, the same way the CSV writes
 * it. While a quote is open the comma is just a character.
 */
function isQuoting(input: string): boolean {
  return (input.match(/"/g)?.length ?? 0) % 2 === 1;
}

/** Returns `value` trimmed, without the quotes around it if it has them. */
function unquote(value: string): string {
  const trimmed = value.trim();

  return trimmed.length > 1 && trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

/**
 * A text field that holds a list of entries, each shown as a removable chip.
 *
 * Typing looks up options for the typed text through `useLookup`, and opens a
 * menu of the options that are not chosen yet. Enter or ArrowRight adds the
 * highlighted option, or, with `freeText`, the typed text when no option is
 * highlighted. With `freeText`, a comma adds the typed text. Backspace in an
 * empty field removes the last entry. Adding an entry empties the field, closes
 * the menu and drops the lookup that is still pending for the typed text.
 *
 * A key the field acts on is `preventDefault`ed, so a form or a row around the
 * field can tell a key the field used from one it left alone. With nothing
 * typed, Enter is left alone. The input carries `aria-busy` while a lookup is
 * pending.
 */
export default function Multicombobox<ItemType extends string | Item>({
  value,
  placeholder,
  getOptions,
  onChange,
  onKeyDown,
  error,
  emptyMessage,
  freeText = false,
  ...props
}: Props<ItemType>) {
  const t = useTranslations("common");
  const [inputValue, setInputValue] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [options, setOptions] = useState<ItemType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { lookup, cancel, busy } = useLookup(getOptions);
  const inputRef = useRef<HTMLInputElement>(null);

  function unselect(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function isSelected(item: ItemType) {
    return value.some((selected) => identity(selected) === identity(item));
  }

  // Adds `item`, unless it is blank or already chosen.
  function select(item: ItemType) {
    const trimmed = (isString(item) ? unquote(item) : item) as ItemType;

    if (!isSelected(trimmed) && identity(trimmed) !== "") {
      onChange([...value, trimmed]);
    }
  }

  // Adds `item`, and leaves the field empty with the menu closed.
  function commit(item: ItemType) {
    cancel();
    setInputValue("");
    setOptions([]);
    setIsOpen(false);
    setActiveIndex(null);
    select(item);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const typed = inputValue.trim() !== "";
    const highlighted =
      isOpen && activeIndex !== null ? options[activeIndex] : undefined;
    const text = freeText ? (inputValue as ItemType) : undefined;

    if (event.key === Key.COMMA && !isQuoting(inputValue)) {
      event.preventDefault();
      if (typed && text !== undefined) commit(text);
    } else if (
      (event.key === Key.ENTER || event.key === Key.ARROW_RIGHT) &&
      typed
    ) {
      event.preventDefault();
      const entry = highlighted ?? text;
      if (entry !== undefined) commit(entry);
    } else if (event.key === Key.BACKSPACE && inputValue === "") {
      unselect(value.length - 1);
    }

    onKeyDown?.(event);
  }

  async function handleChange(typed: string) {
    setInputValue(typed);
    if (!typed) setIsOpen(false);

    const found = await lookup(typed);

    if (found) {
      setIsOpen(true);
      setActiveIndex(0);
      setOptions(found.filter((option) => !isSelected(option)));
    }
  }

  function handleOptionSelect(option: ItemType) {
    cancel();
    select(option);
    setInputValue("");
    inputRef.current?.focus();
  }

  return (
    <MenuProvider<ItemType>
      options={options}
      isOpen={isOpen}
      activeIndex={activeIndex}
      setIsOpen={setIsOpen}
      setActiveIndex={setActiveIndex}
      onSelect={handleOptionSelect}
      bordered={props.bordered}
      emptyMessage={emptyMessage ?? t("noMatches")}
    >
      <TextInput
        {...props}
        inputRef={inputRef}
        value={inputValue}
        error={error}
        placeholder={value.length === 0 ? placeholder : t("addAnother")}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        aria-busy={busy}
        data-multiselect-input="true"
        left={
          <>
            {value.map((item, index) => (
              <Pill
                key={`${identity(item)}-${index}`}
                label={isString(item) ? item : item.label}
                onRemove={() => unselect(index)}
              />
            ))}
          </>
        }
      />
    </MenuProvider>
  );
}
