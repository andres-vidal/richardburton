"use client";

import { FloatingPortal } from "@floating-ui/react";
import { AnimatePresence, motion } from "framer-motion";
import { atom, useAtom } from "jotai";
import { store } from "modules/store";
import { usePathname } from "next/navigation";
import { FC, useEffect } from "react";
import { v4 as uuid } from "uuid";

type NotificationLevel = "error" | "warning" | "info" | "success";

type Notification = {
  id: string;
  message: string;
  level: NotificationLevel;
};

const notificationsAtom = atom<Notification[]>([]);

const NOTIFICATION_TIMEOUT_MS = 4000;
const MAX_SNACKBARS = 5;
const NOTIFICATION_ICONS: Record<NotificationLevel, string> = {
  error: "❗️",
  warning: "⚠️",
  info: "ℹ",
  success: "🙌",
};

type Notifier = (notification: Omit<Notification, "id">) => void;

/**
 * Push a notification imperatively. Safe to call outside React (e.g. from the
 * publication remote layer) since it writes straight to the app store.
 */
const notify: Notifier = ({ message, level }) => {
  store.set(notificationsAtom, (current) => [
    ...current,
    { id: uuid(), message, level },
  ]);
};

function useNotify(): Notifier {
  return notify;
}

const Notifications: FC = () => {
  const [notifications, setNotifications] = useAtom(notificationsAtom);
  const pathname = usePathname();

  useEffect(() => {
    if (notifications.length > 0) {
      const timeout = setTimeout(
        () => setNotifications(notifications.slice(1)),
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

  const snackbars = notifications
    .slice(0, shownNotificationsCount)
    .map(({ message, id, level }) => ({ message, key: id, level }))
    .concat({
      message: `${stackedNotificationsCount} more notifications`,
      key: "notification-stack",
      level: "info",
    });

  return (
    <FloatingPortal>
      <section
        aria-label="Notifications"
        className="flex fixed top-10 left-1/2 flex-col items-center space-y-2 -translate-x-1/2 z-70"
      >
        <AnimatePresence>
          {snackbars.map(
            ({ key, message, level }) =>
              (key !== "notification-stack" ||
                stackedNotificationsCount > 0) && (
                <motion.div
                  layout
                  key={key}
                  role="status"
                  className="flex py-2 pr-3 pl-1 space-x-3 w-96 bg-white rounded shadow-md"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  <div
                    aria-hidden="true"
                    data-level={level}
                    className={`
                      flex items-center justify-center w-7 h-6
                      data-[level=info]:text-indigo-700 data-[level=info]:text-xl
                    `}
                  >
                    {NOTIFICATION_ICONS[level]}
                  </div>
                  <span>{message}</span>
                </motion.div>
              ),
          )}
        </AnimatePresence>
      </section>
    </FloatingPortal>
  );
};

export default Notifications;
export { notify, useNotify };
