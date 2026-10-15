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
import { useTranslations } from "next-intl";
import { usePublicationStore } from "modules/publication/workspace";
import {
  resetAttributes,
  setAttributesVisible,
} from "modules/publication/store";
import { FC, useState } from "react";
import Button from "./Button";

// The columns that can be hidden. The titles always show.
const TOGGLEABLE_ATTRIBUTES = Publication.ATTRIBUTES.filter(
  (key) => Publication.ATTRIBUTE_IS_TOGGLEABLE[key],
);

/**
 * A toggle button that shows or hides the column `colId`. It is pressed while
 * the column shows, and draws a checked box then. A toggle button rather than
 * a menu item keeps the popover a group that Tab moves through.
 */
const ColumnToggle: FC<{ colId: PublicationKey }> = ({ colId }) => {
  const t = useTranslations("attributes");
  const store = usePublicationStore();
  const visible = useIsAttributeVisible(colId);
  return (
    <button
      type="button"
      aria-pressed={visible}
      onClick={() => setAttributesVisible(store, [colId], !visible)}
      className="flex gap-2 items-center px-2 py-1.5 text-xs text-left text-gray-700 rounded cursor-pointer group hover:text-indigo-700 hover:bg-indigo-100"
    >
      <span
        aria-hidden
        className="flex justify-center items-center w-4 h-4 rounded border border-gray-300 transition-colors group-aria-pressed:text-white group-aria-pressed:bg-indigo-600 group-aria-pressed:border-indigo-600"
      >
        {visible && <CheckIcon className="w-3 h-3" />}
      </span>
      {t(colId)}
    </button>
  );
};

/**
 * The "Columns" button, which opens a popover with a toggle for each column
 * that can be hidden, and a button that shows them all. While a column is
 * hidden, the button counts the columns shown.
 */
const ColumnMenu: FC = () => {
  const t = useTranslations("columns");

  const store = usePublicationStore();
  const [isOpen, setIsOpen] = useState(false);
  const hiddenCount = useHiddenAttributes().filter(
    (key) => Publication.ATTRIBUTE_IS_TOGGLEABLE[key],
  ).length;
  const totalCount = Publication.ATTRIBUTES.length;

  const { refs, floatingStyles, context } = useFloating({
    open: isOpen,
    onOpenChange: setIsOpen,
    placement: "bottom-end",
    strategy: "fixed",
    middleware: [offset(4), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
  ]);

  return (
    <>
      <Button
        ref={refs.setReference}
        {...getReferenceProps()}
        label={t("label")}
        aria-haspopup="true"
        aria-expanded={isOpen}
        variant="outline"
        width="fit"
        size="medium"
        right={
          <>
            {hiddenCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-medium text-indigo-700 rounded-full bg-indigo-100 tabular-nums">
                {t("shown", {
                  shown: totalCount - hiddenCount,
                  total: totalCount,
                })}
              </span>
            )}
            <ChevronDownIcon
              aria-hidden
              data-open={isOpen}
              className="w-4 h-4 text-gray-400 transition-transform data-[open=true]:rotate-180"
            />
          </>
        }
      />
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
                onClick={() => resetAttributes(store)}
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
