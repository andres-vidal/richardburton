"use client";

import {
  FloatingFocusManager,
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from "@floating-ui/react";
import CheckIcon from "assets/check.svg";
import ChevronDownIcon from "assets/chevron-down.svg";
import {
  useHiddenAttributes,
  useIsAttributeVisible,
} from "modules/publication/hooks";
import { Publication, type PublicationKey } from "modules/publication/model";
import {
  resetAttributes,
  setAttributesVisible,
} from "modules/publication/store";
import { useTranslations } from "next-intl";
import { FC, useState } from "react";

// Only these columns can be hidden; the titles always stay.
const TOGGLEABLE_ATTRIBUTES = Publication.ATTRIBUTES.filter(
  (key) => Publication.ATTRIBUTE_IS_TOGGLEABLE[key],
);

// A checkbox-style row: pressed = the column is shown. Rendered as a toggle button
// (`aria-pressed`) so the popover stays a plain focusable group, no menu keyboard
// model to implement — Tab moves between rows, the checkbox square is decorative.
const ColumnToggle: FC<{ colId: PublicationKey }> = ({ colId }) => {
  const visible = useIsAttributeVisible(colId);

  return (
    <button
      type="button"
      aria-pressed={visible}
      onClick={() => setAttributesVisible([colId], !visible)}
      className="flex gap-2 items-center px-2 py-1.5 text-xs text-left text-gray-700 rounded cursor-pointer hover:text-indigo-700 hover:bg-indigo-100"
    >
      <span
        aria-hidden
        className={`flex justify-center items-center w-4 h-4 rounded border transition-colors ${
          visible
            ? "text-white bg-indigo-600 border-indigo-600"
            : "border-gray-300"
        }`}
      >
        {visible && <CheckIcon className="w-3 h-3" />}
      </span>

      {Publication.ATTRIBUTE_LABELS[colId]}
    </button>
  );
};

// The "Columns" control: a button that opens a popover to show/hide the toggleable
// columns. Replaces the in-place collapse-to-strip UI — hidden columns simply don't
// render, so there's no `grid-template-columns` animation to lag on large lists.
const ColumnMenu: FC = () => {
  const t = useTranslations("columns");

  const [isOpen, setIsOpen] = useState(false);

  const hiddenCount = useHiddenAttributes().filter(
    (key) => Publication.ATTRIBUTE_IS_TOGGLEABLE[key],
  ).length;

  const totalCount = Publication.ATTRIBUTES.length;

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-end",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
  ]);

  return (
    <>
      <button
        ref={refs.setReference}
        {...getReferenceProps()}
        type="button"
        aria-haspopup="true"
        aria-expanded={isOpen}
        className={`flex gap-2 items-center px-3 py-2.5 text-sm text-gray-700 whitespace-nowrap rounded border border-gray-200 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 ${
          isOpen ? "bg-gray-active" : "bg-gray-100 hover:bg-gray-active"
        }`}
      >
        {t("button")}

        {hiddenCount > 0 && (
          <span className="px-1.5 py-0.5 text-xs font-medium text-indigo-700 rounded-full bg-indigo-100 tabular-nums">
            {totalCount - hiddenCount}/{totalCount}
          </span>
        )}

        <ChevronDownIcon
          aria-hidden
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <FloatingPortal>
        {isOpen && (
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={refs.setFloating}
              style={floatingStyles}
              {...getFloatingProps()}
              role="group"
              aria-label={t("showOrHide")}
              className="flex z-30 flex-col gap-0.5 p-1.5 w-48 rounded shadow-sm bg-gray-active"
            >
              {TOGGLEABLE_ATTRIBUTES.map((colId) => (
                <ColumnToggle key={colId} colId={colId} />
              ))}

              <button
                type="button"
                onClick={() => resetAttributes()}
                className="px-2 py-1.5 mt-1 text-xs text-left text-gray-500 rounded border-t border-gray-200 cursor-pointer hover:text-indigo-700 hover:bg-indigo-100"
              >
                {t("showAll")}
              </button>
            </div>
          </FloatingFocusManager>
        )}
      </FloatingPortal>
    </>
  );
};

export default ColumnMenu;