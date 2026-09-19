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
 * A notification names its copy rather than holding it. What raised it is
 * usually not a component — a remote call, a store write — and so has no locale
 * to write in; the card is rendered in React, where there is one.
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
 * Push a notification imperatively. Safe to call outside React (e.g. from the
 * publication remote layer) since it writes straight to the app store.
 */
const notify: Notifier = ({ message, level, detail, values }) => {
  store.set(notificationsAtom, (current) => [
    ...current,
    { id: uuid(), message, level, detail, values },
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
  // Rooted, not scoped: a notification names its copy wherever in the catalogue
  // that copy lives. A name the catalogue has nothing for falls back to its last
  // part, which is how a code the server invented still reaches the reader.
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
export { notify, useNotify };
