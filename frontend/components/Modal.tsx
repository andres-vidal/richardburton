import {
  FloatingFocusManager,
  FloatingPortal,
  useFloating,
} from "@floating-ui/react";
import { Key } from "app";
import CloseIcon from "assets/close.svg";
import Logo from "assets/logo.svg";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/router";
import {
  FC,
  MouseEvent,
  PropsWithChildren,
  useCallback,
  useState,
} from "react";
import { useMediaQuery } from "react-responsive";
import { useHotkey } from "utils/useHotkey";

interface ModalInterface {
  open: (value?: string) => void;
  close: () => void;
  isOpen: boolean;
}

function useModal(): ModalInterface {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { isOpen, open, close };
}

interface URLModalInterface extends ModalInterface {
  value?: string | string[];
}

function useURLQueryModal(param: string): URLModalInterface {
  const router = useRouter();

  const { [param]: value, ...rest } = router.query;

  const open = useCallback(
    (value: string = "true") => {
      router.replace({ query: { ...rest, [param]: value } });
    },
    [router, param, rest],
  );

  const close = useCallback(() => {
    router.replace({ query: rest });
  }, [router, rest]);

  return { isOpen: Boolean(value), value, open, close };
}

const Header: FC<{ onClose: Props["onClose"] }> = ({ onClose }) => (
  <header className="flex sticky top-0 z-50 justify-between items-center text-white bg-indigo-700 sm:hidden">
    <Logo className="p-2 h-11" />
    <span className="font-normal">Richard & Isabel Burton Platform</span>
    <button
      className="flex z-50 justify-center items-center h-11 aspect-square"
      onClick={onClose}
    >
      <CloseIcon className="h-8" />
    </button>
  </header>
);

interface Props extends PropsWithChildren {
  isOpen: boolean;
  onClose: () => void;
  /** Accessible name for the dialog (announced by screen readers). */
  label?: string;
}

const Modal: FC<Props> = ({ children, isOpen, onClose, label = "Dialog" }) => {
  function handleOverlayMouseDown(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  useHotkey(Key.ESCAPE, onClose);

  const isWiderThanSmall = useMediaQuery({ query: "(min-width: 640px)" });

  const { context, refs } = useFloating();

  return (
    <AnimatePresence>
      {isOpen && (
        <FloatingPortal>
          <FloatingFocusManager context={context} initialFocus={refs.floating}>
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
                className={`
                  mb-5 sm:rounded-lg bg-white text-gray-900 shadow-lg scrollbar-thin scrollbar-thumb-indigo-600
                  overflow-y-auto overflow-x-clip
                  absolute left-1/2 absolute-center-x
                  w-full sm:w-11/12 lg:w-2/3 xl:w-1/2
                  h-full sm:h-auto sm:max-h-[85%] lg:max-h-[80%] min-h-0
                `}
                initial={{ scale: 0.9, transform: "translateX(-50%)" }}
                animate={{
                  scale: 1,
                  top: isWiderThanSmall ? "12%" : "0",
                  transform: "translateX(-50%)",
                }}
                exit={{ scale: 0.9, top: 0 }}
              >
                {children}
              </motion.dialog>
            </motion.div>
          </FloatingFocusManager>
        </FloatingPortal>
      )}
    </AnimatePresence>
  );
};

export { Modal, useModal, useURLQueryModal };
export type { Props as ModalProps };
