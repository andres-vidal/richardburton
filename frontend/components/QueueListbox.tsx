"use client";

import { useFormatter } from "next-intl";
import {
  FC,
  KeyboardEvent,
  Key,
  ReactNode,
  useEffect,
  useId,
  useRef,
} from "react";

type QueueListboxProps<T> = {
  /** The heading above the list. */
  heading: string;
  /** The number in the pill beside the heading. */
  count: number;
  /** The accessible name of the list. */
  label: string;
  items: T[];
  /** Returns the React key of an item. */
  itemKey: (item: T) => Key;
  /** Renders what an item's option shows. */
  renderOption: (item: T) => ReactNode;
  /** The position of the selected option, or -1 when none is selected. */
  position: number;
  /** Called with the position of the option to select. */
  onSelect: (position: number) => void;
  /** What the column shows below the list. */
  children?: ReactNode;
};

/**
 * A heading in a queue column, with `count` in a pill beside it. `quiet` sets
 * the pill in grey rather than indigo, for a count that is not the work still
 * to do.
 */
const QueueHeading: FC<{
  heading: string;
  count: number;
  quiet?: boolean;
}> = ({ heading, count, quiet = false }) => {
  const format = useFormatter();

  return (
    <div className="flex gap-2 justify-between items-baseline px-3 py-2">
      <span className="text-xs font-semibold tracking-wide text-gray-600 uppercase">
        {heading}
      </span>
      <span
        data-quiet={quiet}
        className="px-1.5 py-0.5 text-xs font-medium text-indigo-700 bg-indigo-100 rounded-full tabular-nums data-[quiet=true]:text-gray-700 data-[quiet=true]:bg-gray-100"
      >
        {format.number(count)}
      </span>
    </div>
  );
};

/**
 * One option. It scrolls itself into view when it becomes selected, so the
 * selection stays visible as the arrow keys move it through a long list.
 */
const Option: FC<{
  id: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}> = ({ id, selected, onSelect, children }) => {
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <li
      ref={ref}
      id={id}
      role="option"
      aria-selected={selected}
      data-selected={selected}
      onClick={onSelect}
      className="flex gap-2 items-center px-3 py-2 text-sm rounded transition-colors cursor-pointer hover:bg-gray-100 data-[selected=true]:bg-indigo-100 data-[selected=true]:text-indigo-900"
    >
      {children}
    </li>
  );
};

/**
 * A column with a `QueueHeading` and a single-select listbox of `items` under
 * it. `renderOption` renders what each option shows.
 *
 * The list is one tab stop. While it has focus, the up and down arrows select
 * the previous and next option, and Home and End select the first and last.
 * The list points `aria-activedescendant` at the selected option, and a click
 * on an option selects it. The component holds no selection of its own: it
 * calls `onSelect` with a position, and shows the option at `position` as
 * selected.
 */
function QueueListbox<T>({
  heading,
  count,
  label,
  items,
  itemKey,
  renderOption,
  position,
  onSelect,
  children,
}: QueueListboxProps<T>) {
  const id = useId();
  const optionId = (index: number) => `${id}-option-${index}`;

  const move = (event: KeyboardEvent, next: number) => {
    event.preventDefault();
    if (items.length > 0) {
      onSelect(Math.max(0, Math.min(next, items.length - 1)));
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const key = event.key;
    if (key === "ArrowDown") move(event, position + 1);
    else if (key === "ArrowUp") move(event, position - 1);
    else if (key === "Home") move(event, 0);
    else if (key === "End") move(event, items.length - 1);
  };

  return (
    <div className="flex flex-col w-72 border-r border-gray-200 shrink-0">
      <header className="border-b border-gray-200">
        <QueueHeading heading={heading} count={count} />
      </header>
      <ul
        role="listbox"
        aria-label={label}
        tabIndex={0}
        aria-activedescendant={
          position >= 0 && position < items.length
            ? optionId(position)
            : undefined
        }
        onKeyDown={onKeyDown}
        className="overflow-y-auto flex-1 p-2 space-y-0.5 min-h-0 scrollbar scrollbar-thin scrollbar-thumb-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400"
      >
        {items.map((item, index) => (
          <Option
            key={itemKey(item)}
            id={optionId(index)}
            selected={index === position}
            onSelect={() => onSelect(index)}
          >
            {renderOption(item)}
          </Option>
        ))}
      </ul>
      {children}
    </div>
  );
}

export default QueueListbox;
export { QueueHeading };
export type { QueueListboxProps };
