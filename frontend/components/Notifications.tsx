import { FloatingPortal } from "@floating-ui/react";
import classNames from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { atom, useAtom } from "jotai";
import { store } from "modules/store";
import { useRouter } from "next/router";
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
  const router = useRouter();

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
  useEffect(
    () => () => setNotifications([]),
    [router.pathname, setNotifications],
  );

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
        className="fixed z-60 flex flex-col items-center space-y-2 -translate-x-1/2 left-1/2 top-10"
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
                  className="flex py-2 pl-1 pr-3 space-x-3 bg-white rounded shadow-md w-96"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                >
                  <div
                    aria-hidden="true"
                    className={classNames(
                      "flex items-center justify-center w-7 h-6",
                      { "text-indigo-700 text-xl": level === "info" },
                    )}
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
