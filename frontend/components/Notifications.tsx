"use client";

import { FloatingPortal } from "@floating-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { atom, useAtom } from "jotai";
import { store } from "modules/store";
import { usePathname } from "i18n/navigation";
import { useTranslations } from "next-intl";
import { FC, useEffect } from "react";
import { v4 as uuid } from "uuid";
import Notification, { isFailure, NotificationLevel } from "./Notification";

/**
 * A notification waiting to be shown. It holds the keys of its text in the
 * message catalogue rather than the text, so code without a locale, such as a
 * remote call, can raise one. `Notifications` writes the text when it renders.
 */
type NotificationEntry = {
  id: string;
  /** Names the headline in the message catalogue, whole: `notify.roleChanged`. */
  message: string;
  /** Names the second line, where there is one. */
  detail?: string;
  /** Fills whatever placeholders the two hold. */
  values?: Record<string, string | number>;
  level: NotificationLevel;
};

const notificationsAtom = atom<NotificationEntry[]>([]);

const NOTIFICATION_TIMEOUT_MS = 4000;
const MAX_SNACKBARS = 5;

type Notifier = (notification: Omit<NotificationEntry, "id">) => void;

/**
 * Adds a notification to the stack. It writes to the app store, so code
 * outside React can call it.
 */
const notify: Notifier = ({ message, level, detail, values }) => {
  store.set(notificationsAtom, (current) => [
    ...current,
    { id: uuid(), message, level, detail, values },
  ]);
};

/**
 * Renders the notifications as a stack of `Notification` cards pinned near the
 * top of the page, in a portal. It shows up to five, and summarises any more as
 * a count. A confirmation disappears after four seconds, and a failure stays
 * until it is dismissed. Moving to another page clears them all.
 *
 * The stack is marked `data-live-region`, so a modal that is open leaves it
 * visible to assistive technology and a notification raised from the modal is
 * still announced.
 */
const Notifications: FC = () => {
  // The translator is not scoped to a namespace, so a key can name any message.
  // A key with no message falls back to its last part, so a code the server
  // sent that has no message is still shown.
  const t = useTranslations();
  const write = (key: string, values?: NotificationEntry["values"]) =>
    t.has(key) ? t(key, values) : (key.split(".").pop() ?? key);

  const [notifications, setNotifications] = useAtom(notificationsAtom);
  const pathname = usePathname();

  function dismiss(id: string) {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }

  useEffect(() => {
    // Time out the oldest confirmation; failures wait to be dismissed.
    const transient = notifications.find(({ level }) => !isFailure(level));

    if (transient) {
      const timeout = setTimeout(
        () =>
          setNotifications((current) =>
            current.filter(({ id }) => id !== transient.id),
          ),
        NOTIFICATION_TIMEOUT_MS,
      );
      return () => clearTimeout(timeout);
    }
  }, [notifications, setNotifications]);

  // Clear notifications when navigating to another route.
  useEffect(() => () => setNotifications([]), [pathname, setNotifications]);

  const shownNotificationsCount =
    notifications.length === MAX_SNACKBARS
      ? notifications.length
      : Math.min(MAX_SNACKBARS - 1, notifications.length);

  const stackedNotificationsCount =
    notifications.length - shownNotificationsCount;

  return (
    <FloatingPortal>
      <section
        data-live-region
        aria-label={t("common.notifications")}
        className="flex fixed top-10 left-1/2 flex-col items-center space-y-2 -translate-x-1/2 z-70"
      >
        <AnimatePresence>
          {notifications
            .slice(0, shownNotificationsCount)
            .map(({ id, message, level, detail, values }) => (
              <motion.div
                layout
                key={id}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <Notification
                  level={level}
                  message={write(message, values)}
                  detail={detail && write(detail, values)}
                  onDismiss={() => dismiss(id)}
                />
              </motion.div>
            ))}
          {stackedNotificationsCount > 0 && (
            <motion.div
              layout
              key="notification-stack"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              <Notification
                level="info"
                message={t("common.moreNotifications", {
                  count: stackedNotificationsCount,
                })}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </FloatingPortal>
  );
};

export default Notifications;
export { notify };
