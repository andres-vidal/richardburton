import { FloatingPortal } from "@floating-ui/react";
import classNames from "classnames";
import { AnimatePresence, motion } from "framer-motion";
import { atom, useAtom, useSetAtom, useStore } from "jotai";
import { usePathname } from "next/navigation";
import { FC, useCallback, useEffect } from "react";
import { v4 as uuid } from "uuid";

type NotificationLevel = "error" | "warning" | "info" | "success";

type Notification = {
  id: string;
  message: string;
  level: NotificationLevel;
};

const NOTIFICATIONS = atom<Notification[]>([]);

const NOTIFICATION_TIMEOUT_MS = 4000;
const MAX_SNACKBARS = 5;
const NOTIFICATION_ICONS: Record<NotificationLevel, string> = {
  error: "❗️",
  warning: "⚠️",
  info: "ℹ",
  success: "🙌",
};

const Notifications: FC = () => {
  const [notifications, setNotifications] = useAtom(NOTIFICATIONS);
  const resetNotifications = useSetAtom(NOTIFICATIONS);
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

  useEffect(
    () => () => resetNotifications([]),
    [pathname, resetNotifications],
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
      <section className="fixed z-[60] flex flex-col items-center space-y-2 -translate-x-1/2 left-1/2 top-10">
        <AnimatePresence>
          {snackbars.map(
            ({ key, message, level }) =>
              (key !== "notification-stack" ||
                stackedNotificationsCount > 0) && (
                <motion.div
                  layout
                  key={key}
                  className="flex py-2 pl-1 pr-3 space-x-3 bg-white rounded shadow-md w-96"
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  aria-modal="true"
                  aria-describedby="snackbar-message"
                  aria-label="Notification"
                >
                  <div
                    role="presentation"
                    className={classNames(
                      "flex items-center justify-center w-7 h-6",
                      { "text-indigo-700 text-xl": level === "info" },
                    )}
                  >
                    {NOTIFICATION_ICONS[level]}
                  </div>
                  <label id={`snackbar-message-${key}`}>{message}</label>
                </motion.div>
              ),
          )}
        </AnimatePresence>
      </section>
    </FloatingPortal>
  );
};

type Notifier = (notification: Omit<Notification, "id">) => void;

const _notify = ({ message, level }: Omit<Notification, "id">) => {
  return (current: Notification[]): Notification[] => {
    return [...current, { id: uuid(), message, level }];
  };
};

function useNotify(): Notifier {
  const s = useStore();
  return useCallback(
    ({ message, level }) => {
      s.set(NOTIFICATIONS, _notify({ message, level })(s.get(NOTIFICATIONS)));
    },
    [s],
  );
}

export default Notifications;
export { NOTIFICATIONS as _NOTIFICATIONS, _notify, useNotify };
