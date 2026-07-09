import CloseIcon from "assets/close.svg";
import { FC } from "react";

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
        className="inline-flex justify-center items-center rounded-full transition-colors outline-none hover:bg-indigo-500 hover:text-white focus:bg-indigo-500 focus:text-white"
        onClick={onRemove}
      >
        <CloseIcon className="inline w-3 aspect-square" />
      </button>
    </span>
  );
};

export default Pill;
