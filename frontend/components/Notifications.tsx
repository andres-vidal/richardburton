"use client";

import { FloatingPortal } from "@floating-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { atom, useAtom } from "jotai";
import { store } from "modules/store";
import { usePathname } from "next/navigation";
import { FC, useEffect } from "react";
import { v4 as uuid } from "uuid";
import Notification, { isFailure, NotificationLevel } from "./Notification";

type NotificationEntry = {
  id: string;
  message: string;
  level: NotificationLevel;
  detail?: string;
};

const notificationsAtom = atom<NotificationEntry[]>([]);

const NOTIFICATION_TIMEOUT_MS = 4000;
const MAX_SNACKBARS = 5;

type Notifier = (notification: Omit<NotificationEntry, "id">) => void;

/**
 * Push a notification imperatively. Safe to call outside React (e.g. from the
 * publication remote layer) since it writes straight to the app store.
 */
const notify: Notifier = ({ message, level, detail }) => {
  store.set(notificationsAtom, (current) => [
    ...current,
    { id: uuid(), message, level, detail },
  ]);
};

function useNotify(): Notifier {
  return notify;
}

/**
 * Where notifications live and how long: a stack pinned near the top, capped,
 * with confirmations timing out and failures waiting to be dismissed. The
 * cards themselves are `Notification`.
 */
const Notifications: FC = () => {
  const [notifications, setNotifications] = useAtom(notificationsAtom);
  const pathname = usePathname();

  function dismiss(id: string) {
    setNotifications((current) => current.filter((n) => n.id !== id));
  }

  useEffect(() => {
    // Time out the oldest confirmation; failures wait to be dismissed.
    const transient = notifications.find(({ level }) => !isFailure(level));

    if (transient) {
      const timeout = setTimeout(() => {
        return setNotifications((current) =>
          current.filter(({ id }) => id !== transient.id),
        );
      }, NOTIFICATION_TIMEOUT_MS);
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
        aria-label="Notifications"
        className="flex fixed top-10 left-1/2 flex-col items-center space-y-2 -translate-x-1/2 z-70"
      >
        <AnimatePresence>
          {notifications
            .slice(0, shownNotificationsCount)
            .map(({ id, message, level, detail }) => (
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
                  message={message}
                  detail={detail}
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
                message={`${stackedNotificationsCount} more notifications`}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </FloatingPortal>
  );
};

export default Notifications;
export { notify, useNotify };
