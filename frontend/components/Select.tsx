"use client";

import { Key } from "app";
import ChevronDownIcon from "assets/chevron-down.svg";
import { useTranslations } from "next-intl";
import {
  FocusEvent,
  forwardRef,
  HTMLProps,
  KeyboardEvent,
  MouseEvent,
  useRef,
  useState,
} from "react";
import MenuProvider, { MenuOption } from "./MenuProvider";
import TextInput from "./TextInput";

type Option = MenuOption;

type Props = Omit<
  HTMLProps<HTMLInputElement>,
  "value" | "onChange" | "className"
> & {
  /** Marks the field invalid when it is not empty. */
  error: string;
  value?: Option;
  /** Draws the input and its menu outlined. */
  bordered?: boolean;
  onChange: (option: Option) => void;
  /** Returns the options matching `search`, or all of them for `""`. */
  getOptions: (search: string) => Promise<Option[]>;
};

/**
 * A combobox for one value: an input that shows the label of `value`, and a
 * menu of the options `getOptions` returns. Focusing or clicking the input, or
 * clicking the chevron, opens the menu on every option. Typing asks for the
 * options matching what was typed and highlights the first. Clicking an option,
 * or pressing Enter or the right arrow on the highlighted one, calls
 * `onChange` with it, closes the menu and keeps focus in the input.
 *
 * The typed text lasts while the menu is open. When the menu closes, the input
 * shows the label of `value` again.
 */
export default forwardRef<HTMLInputElement, Props>(function Select(
  {
    value,
    error,
    bordered,
    onChange,
    onFocus,
    onKeyDown,
    onClick,
    getOptions,
    ...props
  },
  ref,
) {
  const t = useTranslations("common");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [search, setSearch] = useState<string | undefined>();
  const [options, setOptions] = useState<Option[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  /** Loads every option into the menu. */
  function loadOptions() {
    getOptions("").then(setOptions);
  }

  /** Opens the menu on every option, dropping any typed text. */
  function open() {
    setSearch("");
    setIsOpen(true);
    loadOptions();
  }

  /** Opens the menu when the input takes focus. */
  function handleFocus(event: FocusEvent<HTMLInputElement>) {
    open();
    onFocus?.(event);
  }

  /**
   * Opens a closed menu. An input that keeps focus after an option was picked
   * gets no focus event when it is clicked again, so the click opens it.
   */
  function handleClick(event: MouseEvent<HTMLInputElement>) {
    if (!isOpen) open();
    onClick?.(event);
  }

  /**
   * Keeps the typed text, and opens the menu on the options matching it with
   * the first highlighted. Emptying the input closes the menu.
   */
  async function handleInputChange(v: string) {
    setSearch(v);

    if (v) {
      const options = await getOptions(v.toLowerCase());
      setIsOpen(true);
      setActiveIndex(0);
      setOptions(options);
    } else {
      setIsOpen(false);
    }
  }

  /** Picks the highlighted option on Enter or the right arrow. */
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      (event.key === Key.ENTER || event.key === Key.ARROW_RIGHT) &&
      activeIndex != null
    ) {
      onChange(options[activeIndex]);
      setIsOpen(false);
    }

    onKeyDown?.(event);
  }

  /**
   * Toggles the menu from the chevron. Opening it focuses the input and loads
   * every option, and closing it takes focus from the input.
   */
  function handleToggleClick() {
    setIsOpen((isOpen) => !isOpen);
    if (!isOpen) {
      inputRef.current?.focus();
      loadOptions();
    } else {
      inputRef.current?.blur();
    }
  }

  const inputValue = search === undefined ? value?.label || "" : search;

  // Drops the typed text when the menu closes, during render rather than in an
  // effect, so the input never shows a stale search.
  const [wasOpen, setWasOpen] = useState(isOpen);

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (!isOpen) setSearch(undefined);
  }

  return (
    <MenuProvider
      options={options}
      isOpen={isOpen}
      activeIndex={activeIndex}
      setIsOpen={setIsOpen}
      setActiveIndex={setActiveIndex}
      onSelect={onChange}
      bordered={bordered}
    >
      <TextInput
        {...props}
        bordered={bordered}
        ref={ref}
        inputRef={inputRef}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        value={inputValue}
        error={error}
        aria-autocomplete="list"
        right={
          <button
            type="button"
            aria-label={isOpen ? t("hideOptions") : t("showOptions")}
            tabIndex={-1}
            disabled={props.disabled}
            className={`
              flex items-center justify-center h-5 aspect-square transition-transform rounded-full
              outline-none focus:bg-indigo-500 focus:text-white
              error:text-white focus:error:bg-red-500
              data-[open=true]:rotate-180
            `}
            onClick={handleToggleClick}
            data-error={Boolean(error)}
            data-open={isOpen}
          >
            <ChevronDownIcon className="h-5" />
          </button>
        }
      />
    </MenuProvider>
  );
});

export type { Option as SelectOption };
