import { FC } from "react";
import CloseIcon from "assets/close.svg";
import c from "classnames";

type Props = {
  label: string;
  onRemove: () => void;
};

const Pill: FC<Props> = ({ label, onRemove }) => {
  return (
    <span className="flex items-center space-x-1 shrink-0 px-1 py-0.5 border border-indigo-600 text-indigo-600 rounded">
      <span>{label}</span>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        className={c(
          "inline-flex items-center justify-center transition-colors rounded-full",
          "hover:bg-indigo-500 hover:text-white",
          "focus:bg-indigo-500 focus:text-white outline-none",
        )}
        onClick={onRemove}
      >
        <CloseIcon className="inline w-3 aspect-square" />
      </button>
    </span>
  );
};

export default Pill;
