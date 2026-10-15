"use client";

import { Key } from "app";
import ChevronDownIcon from "assets/chevron-down.svg";
import ChevronUpIcon from "assets/chevron-up.svg";
import { clamp, isString, parseInt, toString } from "lodash";
import { useTranslations } from "next-intl";
import { FC, forwardRef, HTMLProps, KeyboardEvent, ReactNode } from "react";
import TextInput from "./TextInput";

type Props = Omit<HTMLProps<HTMLInputElement>, "value" | "onChange"> & {
  value?: number;
  /** Marks the field invalid when it is not empty. */
  error?: string;
  onChange?: (value: number) => void;
  /** Draws a visible box, as `TextInput` does. */
  bordered?: boolean;
};

/** A small round button with `icon` that steps the number by one. */
const IncrementButton: FC<{
  onClick: () => void;
  icon: ReactNode;
  label: string;
  error?: string;
}> = ({ icon, onClick, label, error }) => (
  <button
    type="button"
    aria-label={label}
    className="flex justify-center items-center h-2 rounded-full focus-ring hover:bg-indigo-500 hover:text-white focus-visible:bg-indigo-500 focus-visible:text-white error:text-white focus-visible:error:bg-red-500"
    onClick={onClick}
    data-error={Boolean(error)}
  >
    {icon}
  </button>
);

/**
 * A `TextInput` for a whole number, with buttons to step it up and down by one,
 * which the up and down arrow keys also do. Typing calls `onChange` with the
 * number typed, and ignores text that does not start with a number. Every value
 * is clamped between `min` and `max`.
 */
export default forwardRef<HTMLDivElement, Props>(function NumberInput(
  { value, onChange, max = Infinity, min = -Infinity, error, ...props },
  ref,
) {
  const t = useTranslations("common");

  /** Returns `value` clamped between `min` and `max`. */
  function fit(value: number) {
    const lower = isString(min) ? parseInt(min) : min;
    const upper = isString(max) ? parseInt(max) : max;
    return clamp(value, lower, upper);
  }

  /** Calls `onChange` with `value`, or 0 when empty, moved by `offset`. */
  function increment(value: number = 0, offset: number) {
    onChange?.(fit(value + offset));
  }

  /** Calls `onChange` with the number `string` starts with, if any. */
  function handleChange(string: string) {
    const value = parseInt(string);

    if (!isNaN(value)) {
      onChange?.(fit(value));
    }
  }

  /** Steps the number with the up and down arrow keys. */
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === Key.ARROW_UP) {
      event.preventDefault();
      increment(value, 1);
    }

    if (event.key === Key.ARROW_DOWN) {
      event.preventDefault();
      increment(value, -1);
    }
  }

  return (
    <TextInput
      {...props}
      ref={ref}
      value={toString(value)}
      error={error}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      right={
        <div className="flex flex-col">
          <IncrementButton
            onClick={() => increment(value, 1)}
            icon={<ChevronUpIcon className="w-3 aspect-square" />}
            label={t("increase")}
            error={error}
          />
          <IncrementButton
            onClick={() => increment(value, -1)}
            icon={<ChevronDownIcon className="w-3 aspect-square" />}
            label={t("decrease")}
            error={error}
          />
        </div>
      }
    />
  );
});
