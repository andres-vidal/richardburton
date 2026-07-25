"use client";

import CloseIcon from "assets/close.svg";
import { FC } from "react";

type NotificationLevel = "error" | "warning" | "info" | "success";

/**
 * Whether a level reports something going wrong. Failures interrupt the reader
 * and wait to be dismissed; confirmations announce politely and clear
 * themselves. Both the card (which picks its aria role) and the container
 * (which decides what times out) read this, so the two can never disagree.
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
 * A single message. Purely presentational: it knows nothing about where it
 * sits, how long it lives, or what raised it — `Notifications` owns all of
 * that. The level shows as a coloured edge rather than an icon, in the same
 * semantic palette the publication history uses for its actions.
 */
const Notification: FC<Props> = ({ level, message, detail, onDismiss }) => (
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
      <span className="font-medium text-gray-900 wrap-break-words">
        {message}
      </span>
      {detail && (
        <span className="text-xs text-gray-600 wrap-break-words">{detail}</span>
      )}
    </div>
    {onDismiss && (
      <button
        type="button"
        aria-label="Dismiss notification"
        className="flex shrink-0 justify-center items-center text-gray-500 rounded size-5 focus-ring hover:bg-gray-100 hover:text-gray-700"
        onClick={onDismiss}
      >
        <CloseIcon className="w-3 aspect-square" />
      </button>
    )}
  </div>
);

export default Notification;
export { isFailure };
export type { NotificationLevel, Props as NotificationProps };
