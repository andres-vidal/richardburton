"use client";

import CopyIcon from "assets/copy.svg";
import { notify } from "components/Notifications";
import { FC, useState } from "react";
import Button from "./Button";

/**
 * Copy a link to the current record.
 *
 * Takes a path and copies it absolute, because a link is for sending to someone
 * else and a relative one is no use to them. Meant for places where the address
 * is not already on screen — inside an overlay, the browser's URL bar is still
 * showing the page underneath, so there is nothing for a reader to select.
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
      // Confirm on the button itself as well as in a notification: the hand is
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
    <Button
      label={copied ? "Copied" : label}
      variant="outline"
      width="fit"
      size="medium"
      Icon={CopyIcon}
      onClick={handleCopy}
    />
  );
};

export default CopyLink;
