"use client";

import {
  ForwardedRef,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Pill from "./Pill";

import { Key } from "app";
import { isString } from "lodash";
import { useTranslations } from "next-intl";
import { z } from "zod";
import MenuProvider from "./MenuProvider";
import TextInput from "./TextInput";

type Item = { id: string; label: string };

type Props<ItemType extends string | Item> = {
  placeholder?: string;
  value: ItemType[];
  error?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  onChange: (value: ItemType[]) => void;
  getOptions: (search: string) => Promise<ItemType[]> | ItemType[];
  forwardedRef?: ForwardedRef<HTMLDivElement>;
  bordered?: boolean;
  /**
   * Shown when a search matches nothing. Callers word it, because only they
   * know whether the field accepts values outside the offered options.
   */
  emptyMessage?: string;
};

function isStringArray(value: unknown): value is string[] {
  return z.string().array().safeParse(value).success;
}

/** What makes two entries the same: the trimmed text, or an item's id. */
function identity<ItemType extends string | Item>(item: ItemType): string {
  return isString(item) ? item.trim() : item.id;
}

/**
 * A comma normally ends a value, so a name that contains one is written in
 * quotes — the same way the CSV says it. While a quote is open the comma is
 * just a character.
 */
function isQuoting(input: string): boolean {
  return (input.match(/"/g)?.length ?? 0) % 2 === 1;
}

function unquote(value: string): string {
  const trimmed = value.trim();

  return trimmed.length > 1 && trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}

export default function Multicombobox<ItemType extends string | Item>({
  value,
  placeholder,
  getOptions,
  onChange,
  onKeyDown,
  error,
  forwardedRef,
  emptyMessage,
  ...props
}: Props<ItemType>) {
  const t = useTranslations("common");
  const [inputValue, setInputValue] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [options, setOptions] = useState<ItemType[]>([]);

  const isEnum = isStringArray(value) && isStringArray(options);

  const [isOpen, setIsOpen] = useState(false);

  function unselect(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function isSelected(item: ItemType) {
    return value.some((selected) => identity(selected) === identity(item));
  }

  function select(item: ItemType) {
    const trimmed = (isString(item) ? unquote(item) : item) as ItemType;

    if (!isSelected(trimmed) && identity(trimmed) !== "") {
      onChange([...value, trimmed]);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    const isInputValueBlank = inputValue.trim() === "";

    if (event.key === Key.COMMA && !isQuoting(inputValue)) {
      event.preventDefault();

      if (isEnum) {
        setOptions([]);
      }

      if (!isInputValueBlank) {
        setInputValue("");
        setOptions([]);
        select(inputValue as ItemType);
      }
    }

    if (
      (event.key === Key.ENTER || event.key === Key.ARROW_RIGHT) &&
      !isInputValueBlank
    ) {
      event.preventDefault();
      setInputValue("");
      setOptions([]);
      setIsOpen(false);
      setActiveIndex(null);
      if (activeIndex != null && options[activeIndex]) {
        select(options[activeIndex]);
      } else {
        select(inputValue as ItemType);
      }
    }

    if (event.key === Key.BACKSPACE && inputValue === "") {
      unselect(value.length - 1);
    }

    onKeyDown?.(event);
  }

  // Which lookup the field is still interested in.
  //
  // A lookup outlives the keystroke that asked for it, so one already on its
  // way can arrive after a later keystroke, after an option has been taken, or
  // after the field itself has gone — and writing what to offer then is a write
  // to something no longer there. Retiring the ticket on the way out is what
  // says so.
  const wanted = useRef(0);

  useEffect(
    () => () => {
      wanted.current = -1;
    },
    [],
  );

  async function handleChange(v: string) {
    setInputValue(v);

    const asking = ++wanted.current;

    if (!v) {
      setIsOpen(false);
      return;
    }

    const found = await getOptions(v.toLowerCase());

    if (asking !== wanted.current) return;

    setIsOpen(true);
    setActiveIndex(0);
    setOptions(found.filter((option) => !isSelected(option)));
  }

  function handleOptionSelect(option: ItemType) {
    wanted.current += 1;
    select(option);
    setInputValue("");
    inputRef.current?.focus();
  }

  const inputRef = useRef<HTMLInputElement>(null);

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
        ref={forwardedRef}
        inputRef={inputRef}
        value={inputValue}
        error={error}
        placeholder={value.length === 0 ? placeholder : t("addAnother")}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        aria-autocomplete="list"
        data-multiselect-input="true"
        left={
          <>
            {value.map((item, index) => (
              <Pill
                key={`${item}-${index}`}
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
