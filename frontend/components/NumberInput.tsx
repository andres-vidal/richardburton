import { Key } from "app";
import { clamp, isString, parseInt, toString } from "lodash";
import { FC, forwardRef, HTMLProps, KeyboardEvent, ReactNode } from "react";
import TextInput from "./TextInput";
import ChevronUpIcon from "assets/chevron-up.svg";
import ChevronDownIcon from "assets/chevron-down.svg";
import c from "classnames";

type Props = Omit<HTMLProps<HTMLInputElement>, "value" | "onChange"> & {
  value?: number;
  error?: string;
  onChange?: (value: number) => void;
};

const IncrementButton: FC<{
  onClick: () => void;
  icon: ReactNode;
  label: string;
  error?: string;
}> = ({ icon, onClick, label, error }) => {
  return (
    <button
      type="button"
      aria-label={label}
      className={c(
        "flex items-center justify-center h-2 rounded-full",
        "hover:bg-indigo-500 hover:text-white",
        "focus:bg-indigo-500 focus:text-white outline-none",
        "error:text-white focus:error:bg-red-500",
      )}
      onClick={onClick}
      data-error={Boolean(error)}
    >
      {icon}
    </button>
  );
};

export default forwardRef<HTMLDivElement, Props>(function NumberInput(
  { value, onChange, max = Infinity, min = -Infinity, error, ...props },
  ref,
) {
  function fit(value: number) {
    const lower = isString(min) ? parseInt(min) : min;
    const upper = isString(max) ? parseInt(max) : max;
    return clamp(value, lower, upper);
  }

  function increment(value: number = 0, offset: number) {
    onChange?.(fit(value + offset));
  }

  function handleChange(string: string) {
    const value = parseInt(string);

    if (!isNaN(value)) {
      onChange?.(fit(value));
    }
  }

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
            label="Increase"
            error={error}
          />
          <IncrementButton
            onClick={() => increment(value, -1)}
            icon={<ChevronDownIcon className="w-3 aspect-square" />}
            label="Decrease"
            error={error}
          />
        </div>
      }
    />
  );
});
