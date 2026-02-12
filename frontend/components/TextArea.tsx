import c from "classnames";
import {
  ChangeEvent,
  forwardRef,
  HTMLProps,
  ReactNode,
  Ref,
  useId,
} from "react";

type Props = Omit<
  HTMLProps<HTMLTextAreaElement>,
  "value" | "onChange" | "className" | "label"
> & {
  value: string;
  error?: string;
  onChange?: (value: string) => void;
  left?: ReactNode;
  right?: ReactNode;
  inputRef?: Ref<HTMLTextAreaElement>;
  label?: string;
};

export default forwardRef<HTMLDivElement, Props>(function TextArea(
  { value, error, left, right, inputRef, onChange, label, ...props },
  ref,
) {
  const labelId = useId();
  const errorId = useId();

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div
      ref={ref}
      className={c(
        "relative group",
        "w-full gap-1 inline-flex items-center rounded h-full scrollbar-none",
        "error-within:shadow-sm focus-within:error-within:bg-red-400/80, error-within:bg-red-300/40",
        label
          ? "mt-2 px-2 py-2 bg-gray-active shadow-sm focus-within:bg-indigo-500/10"
          : "text-xs p-1 overflow-x-scroll focus-within:bg-gray-active focus-within:shadow-sm",
      )}
    >
      {left}
      <textarea
        {...props}
        ref={inputRef}
        value={value}
        className="w-full px-1 bg-transparent outline-none min-h-40 peer shrink grow placeholder:text-xs error:focus:text-white error:placeholder:text-white"
        onChange={handleChange}
        data-error={Boolean(error)}
        placeholder={label ? "" : props.placeholder}
        aria-labelledby={labelId}
        aria-errormessage={errorId}
        aria-invalid={Boolean(error)}
      />
      {label && (
        <label
          id={labelId}
          className={c(
            "absolute transition-all pointer-events-none",
            "peer-placeholder-shown:text-gray-600 peer-placeholder-shown:text-sm text-xs peer-focus:text-xs text-indigo-600 peer-focus:text-indigo-600",
            "peer-placeholder-shown:left-2 left-0 peer-focus:left-0 ",
            "peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:top-4 -translate-y-full peer-focus:-translate-y-full top-0 peer-focus:top-0",
            "peer-error:text-red-600 peer-error:-translate-y-full peer-error:top-0 peer-error:left-0 peer-error:text-xs",
          )}
        >
          {label} {error && <span id={errorId}>({error})</span>}
        </label>
      )}
      {right}
    </div>
  );
});
