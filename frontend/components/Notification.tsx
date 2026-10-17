"use client";

import CloseIcon from "assets/close.svg";
import { FC } from "react";
import { useTranslations } from "next-intl";

type NotificationLevel = "error" | "warning" | "info" | "success";

/**
 * Returns whether `level` reports a failure, which is true of `error` and
 * `warning`. A failure interrupts the reader and waits to be dismissed, and a
 * confirmation is announced politely and clears itself.
 */
function isFailure(level: NotificationLevel): boolean {
  return level === "error" || level === "warning";
}

type Props = {
  level: NotificationLevel;
  /** What happened, in the past tense: "Publication deleted". */
  message: string;
  /** What it applies to, or what to do next. */
  detail?: string;
  /** Omit for a card that cannot be dismissed, like the stack summary. */
  onDismiss?: () => void;
};

/**
 * Renders one notification card: `message`, `detail` under it, and a dismiss
 * button when `onDismiss` is given. Its level shows as a coloured left edge,
 * and sets its role, `alert` for a failure and `status` otherwise. It does not
 * place itself or time itself out.
 */
const Notification: FC<Props> = ({ level, message, detail, onDismiss }) => {
  const t = useTranslations("notification");

  return (
    <div
      data-level={level}
      role={isFailure(level) ? "alert" : "status"}
      className="
      flex gap-3 items-start py-2.5 pr-2 pl-3 w-96 max-w-[calc(100vw-2rem)]
      text-sm bg-white rounded border-l-4 shadow-md
      data-[level=error]:border-l-red-600
      data-[level=warning]:border-l-amber-500
      data-[level=info]:border-l-indigo-500
      data-[level=success]:border-l-emerald-600
    "
    >
      <div className="flex flex-col gap-0.5 grow min-w-0">
        <span className="font-medium text-gray-900 wrap-break-word">
          {message}
        </span>
        {detail && (
          <span className="text-xs text-gray-600 wrap-break-word">
            {detail}
          </span>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          aria-label={t("dismiss")}
          className="flex shrink-0 justify-center items-center text-gray-500 rounded size-5 focus-ring hover:bg-gray-100 hover:text-gray-700"
          onClick={onDismiss}
        >
          <CloseIcon className="w-3 aspect-square" />
        </button>
      )}
    </div>
  );
};

export default Notification;
export { isFailure };
export type { NotificationLevel, Props as NotificationProps };
