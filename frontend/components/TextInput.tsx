"use client";

import {
  ChangeEvent,
  forwardRef,
  HTMLProps,
  ReactNode,
  Ref,
  useId,
} from "react";

type Props = Omit<
  HTMLProps<HTMLInputElement>,
  "value" | "onChange" | "className" | "label"
> & {
  value: string;
  error?: string;
  onChange?: (value: string) => void;
  left?: ReactNode;
  right?: ReactNode;
  inputRef?: Ref<HTMLInputElement>;
  label?: string;
  /** Stretch to fill the parent's height (e.g. a table cell). Defaults to
   * fitting the content. */
  fill?: boolean;
  /** Draw a visible bordered box — for standalone forms. Off by default, which
   * keeps the subtle look the dense table cells rely on. */
  bordered?: boolean;
};

export default forwardRef<HTMLDivElement, Props>(function TextInput(
  {
    value,
    error,
    left,
    right,
    inputRef,
    onChange,
    label,
    fill,
    bordered,
    ...props
  },
  ref,
) {
  const labelId = useId();
  const errorId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div
      ref={ref}
      data-fill={Boolean(fill)}
      data-labeled={Boolean(label)}
      data-bordered={Boolean(bordered)}
      className={`
        relative group bg-white
        w-full gap-1 inline-flex items-center rounded scrollbar scrollbar-none
        error-within:shadow-sm
        has-disabled:opacity-60 has-disabled:cursor-not-allowed
        data-[fill=true]:h-full
        data-[fill=false]:h-fit
        data-[labeled=true]:mt-2 data-[labeled=true]:px-2 data-[labeled=true]:py-2 data-[labeled=true]:shadow-sm data-[labeled=true]:not-error-within:bg-gray-active data-[labeled=true]:not-error-within:focus-within:bg-indigo-500/10
        data-[labeled=false]:data-[bordered=false]:text-xs data-[labeled=false]:data-[bordered=false]:p-1 data-[labeled=false]:overflow-x-scroll data-[labeled=false]:focus-within:shadow-sm data-[labeled=false]:not-error-within:focus-within:bg-gray-active
        data-[bordered=false]:error-within:bg-red-300/40 data-[bordered=false]:error-within:focus-within:bg-red-300/70
        data-[bordered=true]:border data-[bordered=true]:px-2.5 data-[bordered=true]:py-1.5 data-[bordered=true]:text-sm data-[bordered=true]:not-error-within:border-gray-300 data-[bordered=true]:not-error-within:focus-within:border-indigo-400 data-[bordered=true]:error-within:border-red-400 data-[bordered=true]:error-within:focus-within:border-red-500
      `}
    >
      {left}
      <input
        {...props}
        ref={inputRef}
        value={value}
        className="px-1 w-full bg-transparent outline-none peer shrink grow placeholder:text-xs disabled:cursor-not-allowed"
        onChange={handleChange}
        data-error={Boolean(error)}
        placeholder={label ? "" : props.placeholder}
        aria-labelledby={label ? labelId : undefined}
        aria-errormessage={label && error ? errorId : undefined}
        aria-invalid={Boolean(error)}
      />
      {label && (
        <label
          id={labelId}
          className="absolute top-0 left-0 text-xs text-indigo-600 transition-all -translate-y-full pointer-events-none peer-placeholder-shown:text-gray-600 peer-placeholder-shown:text-sm peer-focus:text-xs peer-focus:text-indigo-600 peer-placeholder-shown:left-2 peer-focus:left-0 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-1/2 peer-focus:-translate-y-full peer-focus:top-0 peer-error:text-red-700 peer-error:-translate-y-full peer-error:top-0 peer-error:left-0 peer-error:text-xs"
        >
          {label}{" "}
          {error && (
            <span id={errorId} aria-live="polite">
              ({error})
            </span>
          )}
        </label>
      )}
      {right}
    </div>
  );
});
