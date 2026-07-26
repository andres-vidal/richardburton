"use client";

import CopyIcon from "assets/copy.svg";
import { notify } from "components/Notifications";
import { FC, useState } from "react";
import Tooltip from "./Tooltip";

/**
 * Copy a link to the current record.
 *
 * Takes a path and copies it absolute, because a link is for sending to someone
 * else and a relative one is no use to them. Meant for places where the address
 * is not already on screen — inside an overlay, the browser's URL bar is still
 * showing the page underneath, so there is nothing for a reader to select.
 *
 * Drawn as a bare icon beside whatever it addresses: sharing is an aside to
 * reading, so it belongs in the heading without competing with it.
 */
const CopyLink: FC<{ href: string; label?: string }> = ({
  href,
  label = "Copy link",
}) => {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const url = new URL(href, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(url);
      // Confirm on the control itself as well as in a notification: the hand is
      // already there, and the eye with it.
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      notify({ message: "Link copied", detail: url, level: "success" });
    } catch {
      notify({
        message: "Could not copy the link",
        detail: "Your browser did not allow it — the address is " + url,
        level: "warning",
      });
    }
  }

  return (
    <Tooltip variant="info" message={copied ? "Copied" : label}>
      <button
        type="button"
        aria-label={copied ? "Copied" : label}
        data-copied={copied}
        className="
          flex p-1.5 rounded transition-colors shrink-0 focus-ring
          text-gray-400 hover:text-indigo-600 hover:bg-indigo-50
          data-[copied=true]:text-emerald-600
        "
        onClick={handleCopy}
      >
        <CopyIcon className="w-4 aspect-square" />
      </button>
    </Tooltip>
  );
};

export default CopyLink;
