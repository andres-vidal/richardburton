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
  error: string;
  value?: Option;
  /** Outlined style — applies to the input *and* its dropdown. */
  bordered?: boolean;
  onChange: (option: Option) => void;
  getOptions: (search: string) => Promise<Option[]>;
};

export default forwardRef<HTMLInputElement, Props>(function Select(
  {
    value,
    error,
    bordered,
    onChange,
    onBlur,
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

  function handleBlur(event: FocusEvent<HTMLInputElement>) {
    onBlur?.(event);
  }

  /** The unfiltered list, for a menu that is about to be shown. */
  function loadOptions() {
    getOptions("").then(setOptions);
  }

  /** Opens the menu on the unfiltered list. */
  function open() {
    setSearch("");
    setIsOpen(true);
    loadOptions();
  }

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

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      (event.key === Key.ENTER || event.key === Key.ARROW_RIGHT) &&
      activeIndex != null
    ) {
      handleSelect(options[activeIndex]);
      setIsOpen(false);
      // Keep focus in the input (combobox pattern). Blurring here bounced focus
      // through the menu's focus manager, whose focus-return re-triggered
      // handleFocus and reopened an emptied menu over the fresh selection.
    }

    onKeyDown?.(event);
  }

  function handleToggleClick() {
    setIsOpen((isOpen) => !isOpen);
    if (!isOpen) {
      inputRef.current?.focus();
      loadOptions();
    } else {
      inputRef.current?.blur();
    }
  }

  function handleSelect(option: Option) {
    onChange?.(option);
  }

  const inputRef = useRef<HTMLInputElement>(null);

  const inputValue = search === undefined ? value?.label || "" : search;

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
      onSelect={handleSelect}
      bordered={bordered}
    >
      <TextInput
        {...props}
        bordered={bordered}
        ref={ref}
        inputRef={inputRef}
        onChange={handleInputChange}
        onBlur={handleBlur}
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
