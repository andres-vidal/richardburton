"use client";

import {
  FloatingFocusManager,
  FloatingNode,
  FloatingOverlay,
  FloatingPortal,
  FloatingTree,
  useFloating,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from "@floating-ui/react";
import { Key } from "app";
import CloseIcon from "assets/close.svg";
import Logo from "assets/logo.svg";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  FC,
  MouseEvent,
  PropsWithChildren,
  ReactNode,
  useCallback,
  useId,
  useState,
} from "react";
import { useHotkey } from "utils/useHotkey";
import ModalHeading from "./ModalHeading";

/** Whether a modal is open, and the functions that open and close it. */
interface ModalInterface {
  open: () => void;
  close: () => void;
  isOpen: boolean;
}

/** Returns the open state of a modal kept in component state. It starts closed. */
function useModal(): ModalInterface {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, open, close };
}

/**
 * Returns the open state of a modal kept in the URL's `param` query parameter.
 * The modal is open while the parameter has a value. `open` sets it to `true`
 * and `close` removes it. Both replace the current history entry, keep the rest
 * of the query and leave the scroll position alone.
 */
function useURLQueryModal(param: string): ModalInterface {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const replace = useCallback(
    (isOpen: boolean) => {
      const params = new URLSearchParams(searchParams);
      if (isOpen) params.set(param, "true");
      else params.delete(param);

      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [router, pathname, searchParams, param],
  );

  const open = useCallback(() => replace(true), [replace]);
  const close = useCallback(() => replace(false), [replace]);

  return { isOpen: Boolean(searchParams.get(param)), open, close };
}

/**
 * The bar a modal has on a small screen, where the dialog fills the screen: the
 * app's logo and name, and a button that closes the modal. It is hidden from
 * the `sm` breakpoint up.
 */
const Header: FC<{ onClose: () => void }> = ({ onClose }) => {
  const t = useTranslations();

  return (
    <header className="flex sticky top-0 z-50 justify-between items-center text-white bg-indigo-700 sm:hidden">
      <Logo className="p-2 h-11" />
      <span className="font-normal">{t("layout.appName")}</span>
      <button
        type="button"
        aria-label={t("common.close")}
        className="flex z-50 justify-center items-center h-11 aspect-square"
        onClick={onClose}
      >
        <CloseIcon aria-hidden className="h-8" />
      </button>
    </header>
  );
};

/**
 * Returns the elements marked `data-live-region`, which stay visible to
 * assistive technology while a modal is open.
 */
function liveRegions(): Element[] {
  return Array.from(document.querySelectorAll("[data-live-region]"));
}

type Props = PropsWithChildren<{
  isOpen: boolean;
  onClose: () => void;
}> &
  (
    | {
        /** What the dialog is called, rendered as its pinned `h1`. */
        heading: ReactNode;
        /** A line under the heading, pinned with it. */
        subheading?: ReactNode;
        /** Set against the heading at the end of its bar, such as a position. */
        aside?: ReactNode;
        /** The accessible name, when it should differ from the heading. */
        label?: string;
      }
    | {
        heading?: undefined;
        subheading?: undefined;
        aside?: undefined;
        /** The accessible name of a dialog without a heading. */
        label: string;
      }
  );

/**
 * The modal of `Modal`, as a node of the floating tree it is rendered in (see
 * `FloatingTree` in `@floating-ui/react`).
 */
const ModalNode: FC<Props> = ({
  children,
  isOpen,
  onClose,
  label,
  heading,
  subheading,
  aside,
}) => {
  const headingId = useId();
  const nodeId = useFloatingNodeId();
  const { context, refs } = useFloating({ nodeId });

  useHotkey(Key.ESCAPE, onClose, isOpen);

  function handleOverlayMouseDown(event: MouseEvent) {
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <FloatingNode id={nodeId}>
      <AnimatePresence>
        {isOpen && (
          <FloatingPortal>
            <FloatingOverlay lockScroll className="z-50">
              <FloatingFocusManager
                context={context}
                initialFocus={refs.floating}
                getInsideElements={liveRegions}
              >
                <motion.div
                  ref={refs.setFloating}
                  className="fixed inset-0 z-50 bg-indigo-900/30"
                  onMouseDown={handleOverlayMouseDown}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <Header onClose={onClose} />
                  <motion.dialog
                    open
                    role="dialog"
                    aria-modal="true"
                    aria-label={label}
                    aria-labelledby={
                      label === undefined && heading !== undefined
                        ? headingId
                        : undefined
                    }
                    tabIndex={0}
                    className={`
                    mb-5 sm:rounded-lg bg-white text-gray-900 shadow-lg scrollbar-thin scrollbar-thumb-indigo-600
                    overflow-y-auto overflow-x-clip overscroll-none
                    absolute left-1/2 absolute-center-x top-0 sm:top-[12%]
                    w-full sm:w-11/12 lg:w-2/3 xl:w-1/2
                    h-full sm:h-auto sm:max-h-[85%] lg:max-h-[80%] min-h-0
                  `}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                  >
                    {heading === undefined ? (
                      children
                    ) : (
                      <div className="flex flex-col gap-6 p-8 min-h-full">
                        <ModalHeading
                          id={headingId}
                          heading={heading}
                          subheading={subheading}
                          aside={aside}
                        />
                        {children}
                      </div>
                    )}
                  </motion.dialog>
                </motion.div>
              </FloatingFocusManager>
            </FloatingOverlay>
          </FloatingPortal>
        )}
      </AnimatePresence>
    </FloatingNode>
  );
};

/**
 * A dialog over a dimmed overlay, rendered in a portal while `isOpen`. It calls
 * `onClose` on Escape and on a press on the overlay outside the dialog, keeps
 * focus inside the dialog and locks the page's scroll. On a small screen the
 * dialog fills the screen under the `Header` bar.
 *
 * Given a `heading`, the modal renders it as a `ModalHeading`, with
 * `subheading` and `aside`, at the top of a padded body. The heading stays
 * pinned while the body scrolls, and names the dialog unless `label` is given.
 * The children follow the heading as the items of a column, 1.5rem apart.
 * Without a heading, the modal renders the children alone, and `label` names
 * the dialog.
 *
 * The modal hides the rest of the page from assistive technology while it is
 * open, except the elements marked `data-live-region`, such as the stack of
 * notifications, so what they announce is still read.
 *
 * The modal is a node of a floating tree, and starts one when it is not inside
 * one. A floating element opened from its content that registers as a child
 * node, such as a popover with its own portal, is part of the dialog: focus may
 * move into it, and the rest of the page is hidden without it.
 *
 * The dialog scrolls when its content is taller than the dialog, so it takes
 * focus with `tabIndex={0}` for the keyboard to reach that scrolling region.
 * Its overscroll is turned off, because the overscroll bounce moves the pinned
 * heading along with the content.
 */
const Modal: FC<Props> = (props) =>
  useFloatingParentNodeId() === null ? (
    <FloatingTree>
      <ModalNode {...props} />
    </FloatingTree>
  ) : (
    <ModalNode {...props} />
  );

export { Modal, useModal, useURLQueryModal };
